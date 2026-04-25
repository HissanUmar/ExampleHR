import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HcmAdapter } from '../src/hcm/hcm.adapter';

describe('HcmAdapter', () => {
  const httpService = {
    get: jest.fn(),
    post: jest.fn()
  } as unknown as jest.Mocked<HttpService>;

  const configService = {
    get: jest.fn((key: string, defaultValue?: string | number) => {
      if (key === 'hcm.baseUrl') return 'http://hcm.local';
      if (key === 'hcm.timeoutMs') return 1234;
      if (key === 'hcm.apiKey') return 'abc';
      return defaultValue;
    })
  } as unknown as jest.Mocked<ConfigService>;

  const adapter = new HcmAdapter(httpService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets balance successfully', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      of({ data: { employeeId: 'e', locationId: 'l', leaveType: 'A', balanceDays: 5 } })
    );

    const result = await adapter.getBalance('e', 'l', 'A');

    expect(result.balanceDays).toBe(5);
    expect(httpService.get).toHaveBeenCalledWith(
      'http://hcm.local/balance/e/l/A',
      expect.objectContaining({ timeout: 1234 })
    );
  });

  it('debits successfully', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      of({ data: { transactionId: 't1', balanceDays: 3 } })
    );

    const result = await adapter.debit({
      employeeId: 'e',
      locationId: 'l',
      leaveType: 'A',
      days: 2,
      idempotencyKey: 'key'
    });

    expect(result.transactionId).toBe('t1');
  });

  it('credits successfully', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      of({ data: { transactionId: 't2', balanceDays: 7 } })
    );

    const result = await adapter.credit({
      employeeId: 'e',
      locationId: 'l',
      leaveType: 'A',
      days: 2,
      idempotencyKey: 'key'
    });

    expect(result.transactionId).toBe('t2');
  });

  it('maps 4xx into conflict exception', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      throwError(() => ({ response: { status: 409, data: { reason: 'bad' } }, message: 'reject' }))
    );

    await expect(adapter.getBalance('e', 'l', 'A')).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps network failure into service unavailable', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      throwError(() => ({ message: 'timeout' }))
    );

    await expect(
      adapter.debit({
        employeeId: 'e',
        locationId: 'l',
        leaveType: 'A',
        days: 2,
        idempotencyKey: 'key'
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
