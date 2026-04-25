import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { BalancesService } from '../balances/balances.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestUser } from '../common/request-user.interface';
import { AuditSource, RequestStatus } from '../common/enums';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { SyncService } from '../sync/sync.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(TimeOffRequestEntity)
    private readonly requestRepo: Repository<TimeOffRequestEntity>,
    private readonly balancesService: BalancesService,
    private readonly hcmAdapter: HcmAdapter,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService
  ) {}

  async createRequest(user: RequestUser, dto: CreateRequestDto) {
    await this.assertNoOverlap(user.sub, dto.locationId, dto.leaveType, dto.startDate, dto.endDate);

    const currentBalance = await this.balancesService.getExactBalance(
      user.sub,
      dto.locationId,
      dto.leaveType,
      true
    );

    if (currentBalance.balanceDays < dto.daysRequested) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        available: currentBalance.balanceDays,
        requested: dto.daysRequested
      });
    }

    const request = this.requestRepo.create({
      id: randomUUID(),
      employeeId: user.sub,
      locationId: dto.locationId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      daysRequested: dto.daysRequested,
      status: RequestStatus.PENDING,
      managerId: null,
      managerNote: null,
      hcmRefId: null,
      hcmSubmittedAt: null,
      failureReason: null
    });
    await this.requestRepo.save(request);

    await this.balancesService.adjustBalance({
      employeeId: user.sub,
      locationId: dto.locationId,
      leaveType: dto.leaveType,
      deltaDays: -dto.daysRequested,
      source: AuditSource.REQUEST,
      referenceId: request.id
    });

    try {
      const result = await this.hcmAdapter.debit({
        employeeId: user.sub,
        locationId: dto.locationId,
        leaveType: dto.leaveType,
        days: dto.daysRequested,
        idempotencyKey: request.id
      });

      request.hcmRefId = result.transactionId;
      request.hcmSubmittedAt = new Date();
      await this.requestRepo.save(request);

      await this.balancesService.upsertBalance(
        user.sub,
        dto.locationId,
        dto.leaveType,
        result.balanceDays,
        AuditSource.REALTIME_SYNC,
        request.id
      );

      return { requestId: request.id, status: request.status, code: 201 };
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        await this.syncService.enqueueHcmRetry(request.id, 'DEBIT', {
          employeeId: user.sub,
          locationId: dto.locationId,
          leaveType: dto.leaveType,
          days: dto.daysRequested,
          idempotencyKey: request.id
        });

        return { requestId: request.id, status: request.status, code: 202 };
      }

      await this.balancesService.adjustBalance({
        employeeId: user.sub,
        locationId: dto.locationId,
        leaveType: dto.leaveType,
        deltaDays: dto.daysRequested,
        source: AuditSource.REQUEST,
        referenceId: request.id
      });

      request.status = RequestStatus.REJECTED;
      request.failureReason =
        error instanceof Error ? error.message : 'HCM rejected request';
      await this.requestRepo.save(request);

      throw new ConflictException({ error: 'HCM_REJECTED' });
    }
  }

  async listRequests(filters: {
    employeeId?: string;
    status?: RequestStatus;
    from?: string;
    to?: string;
  }) {
    const qb = this.requestRepo.createQueryBuilder('r').orderBy('r.created_at', 'DESC');

    if (filters.employeeId) {
      qb.andWhere('r.employee_id = :employeeId', { employeeId: filters.employeeId });
    }
    if (filters.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    if (filters.from) {
      qb.andWhere('r.start_date >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('r.end_date <= :to', { to: filters.to });
    }

    return qb.getMany();
  }

  async getById(id: string): Promise<TimeOffRequestEntity> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('REQUEST_NOT_FOUND');
    }
    return request;
  }

  async approveRequest(id: string, manager: RequestUser, note?: string) {
    const request = await this.getById(id);
    this.assertManagerCanAct(manager, request.employeeId);

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('REQUEST_NOT_PENDING');
    }

    const latest = await this.balancesService.refreshFromHcm(
      request.employeeId,
      request.locationId,
      request.leaveType,
      AuditSource.REALTIME_SYNC,
      request.id
    );

    if (latest.balanceDays < 0) {
      throw new ConflictException('INVALID_BALANCE_STATE');
    }

    request.status = RequestStatus.APPROVED;
    request.managerId = manager.sub;
    request.managerNote = note ?? null;
    await this.requestRepo.save(request);

    return { status: request.status };
  }

  async rejectRequest(id: string, manager: RequestUser, note?: string) {
    const request = await this.getById(id);
    this.assertManagerCanAct(manager, request.employeeId);

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('REQUEST_NOT_PENDING');
    }

    await this.reverseHcmDeduction(request);

    request.status = RequestStatus.REJECTED;
    request.managerId = manager.sub;
    request.managerNote = note ?? null;
    await this.requestRepo.save(request);

    return { status: request.status };
  }

  async cancelRequest(id: string, user: RequestUser) {
    const request = await this.getById(id);
    if (request.employeeId !== user.sub) {
      throw new ForbiddenException('CANNOT_CANCEL_FOREIGN_REQUEST');
    }

    if (request.status === RequestStatus.APPROVED) {
      const graceHours = this.configService.get<number>('cancelGraceHours', 24);
      const cutoff = new Date(request.updatedAt);
      cutoff.setHours(cutoff.getHours() + graceHours);
      if (new Date() > cutoff) {
        throw new ConflictException('CANCEL_GRACE_WINDOW_EXPIRED');
      }
    }

    if (
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.APPROVED
    ) {
      throw new ConflictException('REQUEST_NOT_CANCELLABLE');
    }

    await this.reverseHcmDeduction(request);

    request.status = RequestStatus.CANCELLED;
    await this.requestRepo.save(request);

    return { status: request.status };
  }

  private async reverseHcmDeduction(request: TimeOffRequestEntity) {
    try {
      const credit = await this.hcmAdapter.credit({
        employeeId: request.employeeId,
        locationId: request.locationId,
        leaveType: request.leaveType,
        days: request.daysRequested,
        idempotencyKey: `credit-${request.id}`
      });

      await this.balancesService.upsertBalance(
        request.employeeId,
        request.locationId,
        request.leaveType,
        credit.balanceDays,
        AuditSource.REALTIME_SYNC,
        request.id
      );
    } catch {
      await this.syncService.enqueueHcmRetry(request.id, 'CREDIT', {
        employeeId: request.employeeId,
        locationId: request.locationId,
        leaveType: request.leaveType,
        days: request.daysRequested,
        idempotencyKey: `credit-${request.id}`
      });
    }
  }

  private assertManagerCanAct(manager: RequestUser, employeeId: string) {
    if (!manager.roles.includes('manager')) {
      throw new ForbiddenException('MANAGER_ROLE_REQUIRED');
    }

    if (!manager.managerOf?.includes(employeeId)) {
      throw new ForbiddenException('NOT_EMPLOYEE_MANAGER');
    }
  }

  private async assertNoOverlap(
    employeeId: string,
    locationId: string,
    leaveType: string,
    startDate: string,
    endDate: string
  ) {
    const existing = await this.requestRepo
      .createQueryBuilder('r')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.location_id = :locationId', { locationId })
      .andWhere('r.leave_type = :leaveType', { leaveType })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [RequestStatus.PENDING, RequestStatus.APPROVED]
      })
      .andWhere('r.start_date <= :endDate AND r.end_date >= :startDate', {
        startDate,
        endDate
      })
      .getOne();

    if (existing) {
      throw new ConflictException({ error: 'OVERLAP_CONFLICT', requestId: existing.id });
    }
  }
}
