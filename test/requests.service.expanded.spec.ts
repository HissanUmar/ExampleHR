import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestsService } from '../src/requests/requests.service';
import { TimeOffRequestEntity } from '../src/entities/time-off-request.entity';
import { BalancesService } from '../src/balances/balances.service';
import { HcmAdapter } from '../src/hcm/hcm.adapter';
import { SyncService } from '../src/sync/sync.service';
import { RequestStatus } from '../src/common/enums';

const createOverlapQueryBuilder = (existing: unknown) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(existing)
});

describe('RequestsService expanded', () => {
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

  const baseDto = {
    locationId: 'loc-1',
    leaveType: 'ANNUAL',
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    daysRequested: 2
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(createOverlapQueryBuilder(null));
    (requestRepo.save as jest.Mock).mockImplementation(async (v) => v);
    (requestRepo.create as jest.Mock).mockImplementation((v) => ({ ...v }));
  });

  it('rejects overlapping requests', async () => {
    (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(
      createOverlapQueryBuilder({ id: 'existing-req' })
    );

    await expect(
      service.createRequest({ sub: 'emp-1', roles: ['employee'] }, baseDto)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps hcm conflict into HCM_REJECTED and rolls back local adjustment', async () => {
    (balancesService.getExactBalance as jest.Mock).mockResolvedValue({ balanceDays: 10 });
    (balancesService.adjustBalance as jest.Mock).mockResolvedValue({});
    (hcmAdapter.debit as jest.Mock).mockRejectedValue(new ConflictException('hcm reject'));

    await expect(
      service.createRequest({ sub: 'emp-1', roles: ['employee'] }, baseDto)
    ).rejects.toBeInstanceOf(ConflictException);

    expect(balancesService.adjustBalance).toHaveBeenCalledTimes(2);
  });

  it('returns request when getById finds one', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({ id: 'req-1' });
    const result = await service.getById('req-1');
    expect(result).toMatchObject({ id: 'req-1' });
  });

  it('throws not found when getById misses', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids approval when user is not manager', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.PENDING
    });

    await expect(
      service.approveRequest('req-1', { sub: 'emp-2', roles: ['employee'] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids approval when manager does not own employee', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.PENDING
    });

    await expect(
      service.approveRequest('req-1', {
        sub: 'mgr-1',
        roles: ['manager'],
        managerOf: ['someone-else']
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects approve when request is not pending', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.REJECTED
    });

    await expect(
      service.approveRequest('req-1', {
        sub: 'mgr-1',
        roles: ['manager'],
        managerOf: ['emp-1']
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects approve when refreshed balance is invalid', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      status: RequestStatus.PENDING
    });
    (balancesService.refreshFromHcm as jest.Mock).mockResolvedValue({ balanceDays: -1 });

    await expect(
      service.approveRequest('req-1', {
        sub: 'mgr-1',
        roles: ['manager'],
        managerOf: ['emp-1']
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reject flow updates status and manager info', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      daysRequested: 2,
      status: RequestStatus.PENDING
    });
    (hcmAdapter.credit as jest.Mock).mockResolvedValue({ balanceDays: 10, transactionId: 'tx-1' });

    const result = await service.rejectRequest(
      'req-1',
      { sub: 'mgr-1', roles: ['manager'], managerOf: ['emp-1'] },
      'reject-note'
    );

    expect(result.status).toBe(RequestStatus.REJECTED);
    expect(balancesService.upsertBalance).toHaveBeenCalled();
  });

  it('cancel request forbids foreign employee', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.PENDING
    });

    await expect(
      service.cancelRequest('req-1', { sub: 'emp-2', roles: ['employee'] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancel request blocks after approved grace expiry', async () => {
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.APPROVED,
      updatedAt: oldDate
    });

    await expect(
      service.cancelRequest('req-1', { sub: 'emp-1', roles: ['employee'] })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancel request blocks non-cancellable status', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      status: RequestStatus.REJECTED,
      updatedAt: new Date()
    });

    await expect(
      service.cancelRequest('req-1', { sub: 'emp-1', roles: ['employee'] })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancel request enqueues credit retry when hcm credit fails', async () => {
    (requestRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      daysRequested: 2,
      status: RequestStatus.PENDING,
      updatedAt: new Date()
    });
    (hcmAdapter.credit as jest.Mock).mockRejectedValue(new Error('down'));

    const result = await service.cancelRequest('req-1', {
      sub: 'emp-1',
      roles: ['employee']
    });

    expect(result.status).toBe(RequestStatus.CANCELLED);
    expect(syncService.enqueueHcmRetry).toHaveBeenCalled();
  });

  it('listRequests applies all filters', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([])
    };
    (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.listRequests({
      employeeId: 'emp-1',
      status: RequestStatus.PENDING,
      from: '2026-01-01',
      to: '2026-12-31'
    });

    expect(qb.andWhere).toHaveBeenCalledTimes(4);
  });
});
