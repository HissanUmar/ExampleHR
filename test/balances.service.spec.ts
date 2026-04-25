import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BalancesService } from '../src/balances/balances.service';
import { LeaveBalanceEntity } from '../src/entities/leave-balance.entity';
import { BalanceAuditLogEntity } from '../src/entities/balance-audit-log.entity';
import { HcmAdapter } from '../src/hcm/hcm.adapter';
import { AuditSource } from '../src/common/enums';

describe('BalancesService', () => {
  const balanceRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn((entity) => entity),
    createQueryBuilder: jest.fn()
  } as unknown as jest.Mocked<Repository<LeaveBalanceEntity>>;
  const auditRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn()
  } as unknown as jest.Mocked<Repository<BalanceAuditLogEntity>>;
  const hcmAdapter = {
    getBalance: jest.fn()
  } as unknown as jest.Mocked<HcmAdapter>;
  const configService = {
    get: jest.fn((key: string, defaultValue: number) => defaultValue)
  } as unknown as jest.Mocked<ConfigService>;

  const service = new BalancesService(balanceRepo, auditRepo, hcmAdapter, configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes stale balances from HCM', async () => {
    (balanceRepo.findOne as jest.Mock).mockResolvedValue({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      balanceDays: 6,
      lastSyncedAt: new Date(Date.now() - 10 * 60 * 1000)
    });
    (hcmAdapter.getBalance as jest.Mock).mockResolvedValue({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      balanceDays: 7
    });
    (balanceRepo.save as jest.Mock).mockResolvedValue({ balanceDays: 7 });

    const result = await service.getExactBalance('emp-1', 'loc-1', 'ANNUAL', true);

    expect(result.balanceDays).toBe(7);
    expect(hcmAdapter.getBalance).toHaveBeenCalledTimes(1);
  });

  it('adjusts balance with optimistic locking', async () => {
    (balanceRepo.findOne as jest.Mock)
      .mockResolvedValueOnce({ id: 1, version: 2, balanceDays: 10 })
      .mockResolvedValueOnce({ id: 1, version: 3, balanceDays: 8 });

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 })
    };
    (balanceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    (balanceRepo.findOneOrFail as jest.Mock).mockResolvedValue({ id: 1, balanceDays: 8 });

    const updated = await service.adjustBalance({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      deltaDays: -2,
      source: AuditSource.REQUEST,
      referenceId: 'req-1'
    });

    expect(updated.balanceDays).toBe(8);
    expect(auditRepo.save).toHaveBeenCalled();
  });
});
