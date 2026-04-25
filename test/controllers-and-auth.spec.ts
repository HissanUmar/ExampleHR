import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InternalApiKeyGuard } from '../src/auth/internal-api-key.guard';
import { AppController } from '../src/app.controller';
import { BalancesController } from '../src/balances/balances.controller';
import { SyncController } from '../src/sync/sync.controller';
import { JwtStrategy } from '../src/auth/jwt.strategy';

describe('Controllers and auth utilities', () => {
  it('internal api key guard accepts valid key', () => {
    const configService = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
    const guard = new InternalApiKeyGuard(configService);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-internal-api-key': 'secret' } }) })
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('internal api key guard rejects invalid key', () => {
    const configService = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
    const guard = new InternalApiKeyGuard(configService);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-internal-api-key': 'bad' } }) })
    } as never;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('app controller health and metrics endpoints return expected payload', async () => {
    const dataSource = { isInitialized: true } as DataSource;
    const controller = new AppController(dataSource);

    await expect(controller.health()).resolves.toMatchObject({ status: 'ok', db: true, hcm: true });
    expect(controller.metrics()).toContain('time_off_requests_total');
  });

  it('balances controller delegates service calls', async () => {
    const balancesService = {
      getEmployeeBalances: jest.fn().mockResolvedValue([{ employeeId: 'e1' }]),
      getExactBalance: jest.fn().mockResolvedValue({ employeeId: 'e1', balanceDays: 5 })
    } as never;

    const controller = new BalancesController(balancesService);

    await expect(controller.getEmployeeBalances('e1')).resolves.toHaveLength(1);
    await expect(controller.getExactBalance('e1', 'loc', 'ANNUAL')).resolves.toMatchObject({ balanceDays: 5 });
  });

  it('sync controller delegates service calls', async () => {
    const syncService = {
      reconcile: jest.fn().mockResolvedValue({ reconciled: 1 }),
      runFailedJobs: jest.fn().mockResolvedValue(undefined),
      processBatch: jest.fn().mockResolvedValue({ success: true })
    } as never;

    const controller = new SyncController(syncService);

    await expect(controller.trigger()).resolves.toMatchObject({ reconciled: 1 });
    await expect(controller.listFailedJobs()).resolves.toBeUndefined();
    await expect(
      controller.processBatch({
        batchId: 'b1',
        records: [{ employeeId: 'e1', locationId: 'l1', leaveType: 'ANNUAL', balanceDays: 2 }]
      })
    ).resolves.toMatchObject({ success: true });
  });

  it('jwt strategy normalizes optional claims in validate', () => {
    const configService = { get: jest.fn().mockReturnValue('jwt-secret') } as unknown as ConfigService;
    const strategy = new JwtStrategy(configService);

    expect(strategy.validate({ sub: 'emp-1' })).toEqual({ sub: 'emp-1', roles: [], managerOf: [] });
    expect(strategy.validate({ sub: 'emp-2', roles: ['manager'], managerOf: ['emp-1'] })).toEqual({
      sub: 'emp-2',
      roles: ['manager'],
      managerOf: ['emp-1']
    });
  });
});
