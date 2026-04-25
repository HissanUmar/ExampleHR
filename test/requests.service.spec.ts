import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RequestsService } from '../src/requests/requests.service';
import { TimeOffRequestEntity } from '../src/entities/time-off-request.entity';
import { BalancesService } from '../src/balances/balances.service';
import { HcmAdapter } from '../src/hcm/hcm.adapter';
import { SyncService } from '../src/sync/sync.service';
import { RequestStatus } from '../src/common/enums';

describe('RequestsService', () => {
  const requestRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn()
  } as unknown as jest.Mocked<Repository<TimeOffRequestEntity>>;
  const balancesService = {
    getExactBalance: jest.fn(),
    adjustBalance: jest.fn(),
    upsertBalance: jest.fn(),
    refreshFromHcm: jest.fn()
  } as unknown as jest.Mocked<BalancesService>;
  const hcmAdapter = {
    debit: jest.fn(),
    credit: jest.fn()
  } as unknown as jest.Mocked<HcmAdapter>;
  const syncService = {
    enqueueHcmRetry: jest.fn()
  } as unknown as jest.Mocked<SyncService>;
  const configService = {
    get: jest.fn((key: string, defaultValue: number) => defaultValue)
  } as unknown as jest.Mocked<ConfigService>;

  const service = new RequestsService(
    requestRepo,
    balancesService,
    hcmAdapter,
    syncService,
    configService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects insufficient balance before HCM debit', async () => {
    (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null)
    });
    (balancesService.getExactBalance as jest.Mock).mockResolvedValue({ balanceDays: 1 });

    await expect(
      service.createRequest(
        { sub: 'emp-1', roles: ['employee'] },
        {
          locationId: 'loc-1',
          leaveType: 'ANNUAL',
          startDate: '2026-07-01',
          endDate: '2026-07-05',
          daysRequested: 5
        }
      )
    ).rejects.toMatchObject({ response: { error: 'INSUFFICIENT_BALANCE' } });
  });

  it('creates a pending request and enqueues retry when HCM is unavailable', async () => {
    (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null)
    });
    (balancesService.getExactBalance as jest.Mock).mockResolvedValue({ balanceDays: 8 });
    (requestRepo.save as jest.Mock).mockResolvedValue({ id: 'req-1' });
    (balancesService.adjustBalance as jest.Mock).mockResolvedValue({});
    (hcmAdapter.debit as jest.Mock).mockRejectedValue(new Error('service down'));
    (syncService.enqueueHcmRetry as jest.Mock).mockResolvedValue({});

    const result = await service.createRequest(
      { sub: 'emp-1', roles: ['employee'] },
      {
        locationId: 'loc-1',
        leaveType: 'ANNUAL',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        daysRequested: 2
      }
    );

    expect(result.code).toBe(202);
    expect(syncService.enqueueHcmRetry).toHaveBeenCalled();
  });

  it('approves a request only for the manager', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      daysRequested: 2,
      status: RequestStatus.PENDING,
      updatedAt: new Date()
    });
    (balancesService.refreshFromHcm as jest.Mock).mockResolvedValue({ balanceDays: 8 });
    (requestRepo.save as jest.Mock).mockResolvedValue({});

    const result = await service.approveRequest('req-1', { sub: 'mgr-1', roles: ['manager'], managerOf: ['emp-1'] });

    expect(result.status).toBe(RequestStatus.APPROVED);
  });
});
