import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { BalanceAuditLogEntity } from '../entities/balance-audit-log.entity';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { AuditSource } from '../common/enums';

interface UpdateBalanceInput {
  employeeId: string;
  locationId: string;
  leaveType: string;
  deltaDays: number;
  source: AuditSource;
  referenceId?: string;
}

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    @InjectRepository(BalanceAuditLogEntity)
    private readonly auditRepo: Repository<BalanceAuditLogEntity>,
    private readonly hcmAdapter: HcmAdapter,
    private readonly configService: ConfigService
  ) {}

  async getEmployeeBalances(employeeId: string): Promise<LeaveBalanceEntity[]> {
    return this.balanceRepo.find({ where: { employeeId } });
  }

  async getExactBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    refreshIfStale = true
  ): Promise<LeaveBalanceEntity> {
    const existing = await this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType }
    });

    if (!existing) {
      return this.refreshFromHcm(employeeId, locationId, leaveType, AuditSource.REALTIME_SYNC);
    }

    if (refreshIfStale && this.isStale(existing.lastSyncedAt)) {
      return this.refreshFromHcm(employeeId, locationId, leaveType, AuditSource.REALTIME_SYNC);
    }

    return existing;
  }

  async refreshFromHcm(
    employeeId: string,
    locationId: string,
    leaveType: string,
    source: AuditSource,
    referenceId?: string
  ): Promise<LeaveBalanceEntity> {
    const hcmBalance = await this.hcmAdapter.getBalance(employeeId, locationId, leaveType);
    return this.upsertBalance(
      hcmBalance.employeeId,
      hcmBalance.locationId,
      hcmBalance.leaveType,
      hcmBalance.balanceDays,
      source,
      referenceId
    );
  }

  async upsertBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    balanceDays: number,
    source: AuditSource,
    referenceId?: string
  ): Promise<LeaveBalanceEntity> {
    const existing = await this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType }
    });

    if (!existing) {
      const created = this.balanceRepo.create({
        employeeId,
        locationId,
        leaveType,
        balanceDays,
        hcmBalanceDays: balanceDays,
        lastSyncedAt: new Date(),
        version: 1
      });
      const saved = await this.balanceRepo.save(created);
      await this.writeAudit(employeeId, locationId, leaveType, balanceDays, balanceDays, source, referenceId);
      return saved;
    }

    const previous = existing.balanceDays;
    existing.balanceDays = balanceDays;
    existing.hcmBalanceDays = balanceDays;
    existing.lastSyncedAt = new Date();
    existing.version += 1;
    const saved = await this.balanceRepo.save(existing);

    if (previous !== balanceDays) {
      await this.writeAudit(
        employeeId,
        locationId,
        leaveType,
        balanceDays - previous,
        balanceDays,
        source,
        referenceId
      );
    }

    return saved;
  }

  async adjustBalance(input: UpdateBalanceInput): Promise<LeaveBalanceEntity> {
    let attempts = 0;

    while (attempts < 3) {
      attempts += 1;
      const current = await this.balanceRepo.findOne({
        where: {
          employeeId: input.employeeId,
          locationId: input.locationId,
          leaveType: input.leaveType
        }
      });

      if (!current) {
        throw new NotFoundException('BALANCE_NOT_FOUND');
      }

      const nextBalance = current.balanceDays + input.deltaDays;
      const updateResult = await this.balanceRepo
        .createQueryBuilder()
        .update(LeaveBalanceEntity)
        .set({
          balanceDays: nextBalance,
          version: current.version + 1,
          updatedAt: new Date()
        })
        .where('id = :id AND version = :version', {
          id: current.id,
          version: current.version
        })
        .execute();

      if (updateResult.affected === 1) {
        await this.writeAudit(
          input.employeeId,
          input.locationId,
          input.leaveType,
          input.deltaDays,
          nextBalance,
          input.source,
          input.referenceId
        );
        const updated = await this.balanceRepo.findOneOrFail({ where: { id: current.id } });
        return updated;
      }
    }

    throw new ServiceUnavailableException('CONCURRENT_MODIFICATION');
  }

  private isStale(lastSyncedAt: Date): boolean {
    const ttlMinutes = this.configService.get<number>('balanceFreshnessTtlMin', 5);
    const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
    return ageMs > ttlMinutes * 60 * 1000;
  }

  private async writeAudit(
    employeeId: string,
    locationId: string,
    leaveType: string,
    deltaDays: number,
    balanceAfter: number,
    source: AuditSource,
    referenceId?: string
  ) {
    const log = this.auditRepo.create({
      employeeId,
      locationId,
      leaveType,
      deltaDays,
      balanceAfter,
      source,
      referenceId: referenceId ?? null
    });
    await this.auditRepo.save(log);
  }
}
