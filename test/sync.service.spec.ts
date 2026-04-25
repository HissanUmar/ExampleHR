import { Repository } from 'typeorm';
import { SyncService } from '../src/sync/sync.service';
import { SyncEventEntity } from '../src/entities/sync-event.entity';
import { FailedHcmJobEntity } from '../src/entities/failed-hcm-job.entity';
import { LeaveBalanceEntity } from '../src/entities/leave-balance.entity';
import { BalancesService } from '../src/balances/balances.service';

describe('SyncService', () => {
  const syncEventRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn()
  } as unknown as jest.Mocked<Repository<SyncEventEntity>>;
  const failedJobRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(),
    find: jest.fn()
  } as unknown as jest.Mocked<Repository<FailedHcmJobEntity>>;
  const balanceRepo = {
    find: jest.fn()
  } as unknown as jest.Mocked<Repository<LeaveBalanceEntity>>;
  const balancesService = {
    upsertBalance: jest.fn(),
    refreshFromHcm: jest.fn().mockResolvedValue({ balanceDays: 5 })
  } as unknown as jest.Mocked<BalancesService>;

  const service = new SyncService(syncEventRepo, failedJobRepo, balanceRepo, balancesService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes batch updates and records success', async () => {
    const result = await service.processBatch({
      batchId: 'batch-1',
      records: [
        {
          employeeId: 'emp-1',
          locationId: 'loc-1',
          leaveType: 'ANNUAL',
          balanceDays: 9
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(balancesService.upsertBalance).toHaveBeenCalledTimes(1);
  });

  it('moves retry jobs through the failure queue', async () => {
    (failedJobRepo.find as jest.Mock).mockResolvedValue([
      {
        attempt: 4,
        status: 'PENDING'
      }
    ]);

    await service.runFailedJobs();

    expect(failedJobRepo.save).toHaveBeenCalled();
  });
});
