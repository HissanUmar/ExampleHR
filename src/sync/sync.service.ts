import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BatchBalanceDto } from '../balances/dto/batch-balance.dto';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { SyncEventEntity } from '../entities/sync-event.entity';
import { FailedHcmJobEntity } from '../entities/failed-hcm-job.entity';
import { AuditSource, SyncEventStatus, SyncEventType } from '../common/enums';
import { BalancesService } from '../balances/balances.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncEventEntity)
    private readonly syncEventRepo: Repository<SyncEventEntity>,
    @InjectRepository(FailedHcmJobEntity)
    private readonly failedJobRepo: Repository<FailedHcmJobEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    private readonly balancesService: BalancesService
  ) {}

  async processBatch(payload: BatchBalanceDto) {
    const syncEvent = this.syncEventRepo.create({
      id: randomUUID(),
      type: SyncEventType.BATCH,
      status: SyncEventStatus.RUNNING,
      recordsTotal: payload.records.length,
      recordsOk: 0,
      recordsFailed: 0,
      errorSummary: null,
      startedAt: new Date(),
      finishedAt: null
    });
    await this.syncEventRepo.save(syncEvent);

    let recordsOk = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    for (const record of payload.records) {
      try {
        await this.balancesService.upsertBalance(
          record.employeeId,
          record.locationId,
          record.leaveType,
          record.balanceDays,
          AuditSource.BATCH_SYNC,
          payload.batchId
        );
        recordsOk += 1;
      } catch (error) {
        recordsFailed += 1;
        errors.push(`${record.employeeId}:${record.locationId}:${record.leaveType}`);
        this.logger.warn(`Batch sync failed for ${record.employeeId}`);
      }
    }

    syncEvent.recordsOk = recordsOk;
    syncEvent.recordsFailed = recordsFailed;
    syncEvent.status = recordsFailed > 0 ? SyncEventStatus.PARTIAL : SyncEventStatus.SUCCESS;
    syncEvent.errorSummary = errors.join(', ') || null;
    syncEvent.finishedAt = new Date();
    await this.syncEventRepo.save(syncEvent);

    return {
      success: syncEvent.status === SyncEventStatus.SUCCESS,
      batchId: payload.batchId,
      recordsTotal: payload.records.length,
      recordsOk,
      recordsFailed
    };
  }

  async enqueueHcmRetry(requestId: string, operation: string, payload: unknown) {
    const job = this.failedJobRepo.create({
      requestId,
      attempt: 0,
      nextRunAt: new Date(Date.now()),
      operation,
      payload: JSON.stringify(payload),
      status: 'PENDING',
      lastError: null
    });
    await this.failedJobRepo.save(job);
    return job;
  }

  async reconcile(): Promise<{ reconciled: number }> {
    const rows = await this.balanceRepo.find();
    let reconciled = 0;

    for (const row of rows) {
      const hcm = await this.balancesService.refreshFromHcm(
        row.employeeId,
        row.locationId,
        row.leaveType,
        AuditSource.RECONCILE
      );
      if (hcm.balanceDays !== row.balanceDays) {
        reconciled += 1;
      }
    }

    return { reconciled };
  }

  async runFailedJobs() {
    const jobs = await this.failedJobRepo.find({ where: { status: 'PENDING' } });
    for (const job of jobs) {
      const attempts = job.attempt + 1;
      job.attempt = attempts;
      if (attempts > 5) {
        job.status = 'DEAD_LETTER';
        job.lastError = 'MAX_RETRIES_EXCEEDED';
        await this.failedJobRepo.save(job);
        continue;
      }

      const delays = [0, 30_000, 120_000, 600_000, 3_600_000];
      job.nextRunAt = new Date(Date.now() + delays[Math.min(attempts - 1, delays.length - 1)]);
      await this.failedJobRepo.save(job);
    }
  }
}
