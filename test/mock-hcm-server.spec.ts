import request from 'supertest';
import { createMockHcmApp } from './mock-hcm-server';

describe('Mock HCM server', () => {
  const app = createMockHcmApp();

  it('supports control set-balance and get balance', async () => {
    await request(app)
      .post('/hcm/__control/set-balance')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', leaveType: 'ANNUAL', balanceDays: 10 })
      .expect(200);

    const result = await request(app)
      .get('/hcm/balance/emp-1/loc-1/ANNUAL')
      .expect(200);

    expect(result.body.balanceDays).toBe(10);
  });

  it('debits balance and honors idempotency', async () => {
    const payload = {
      employeeId: 'emp-1',
      locationId: 'loc-1',
      leaveType: 'ANNUAL',
      days: 2,
      idempotencyKey: 'idem-1'
    };

    const first = await request(app).post('/hcm/debit').send(payload).expect(200);
    const second = await request(app).post('/hcm/debit').send(payload).expect(200);

    expect(first.body.transactionId).toBe(second.body.transactionId);
    expect(first.body.balanceDays).toBe(second.body.balanceDays);
  });

  it('returns insufficient balance on debit overdraw', async () => {
    await request(app)
      .post('/hcm/debit')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', leaveType: 'ANNUAL', days: 999 })
      .expect(409);
  });

  it('credits balance', async () => {
    const credit = await request(app)
      .post('/hcm/credit')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', leaveType: 'ANNUAL', days: 3 })
      .expect(200);

    expect(credit.body.balanceDays).toBeGreaterThanOrEqual(3);
  });

  it('applies batch update corpus', async () => {
    await request(app)
      .post('/hcm/batch')
      .send({
        records: [
          { employeeId: 'emp-2', locationId: 'loc-uk', leaveType: 'SICK', balanceDays: 7 }
        ]
      })
      .expect(200);

    const result = await request(app)
      .get('/hcm/balance/emp-2/loc-uk/SICK')
      .expect(200);

    expect(result.body.balanceDays).toBe(7);
  });

  it('supports forced error mode', async () => {
    await request(app).post('/hcm/__control/set-mode').send({ mode: 'error' }).expect(200);
    await request(app).get('/hcm/balance/emp-2/loc-uk/SICK').expect(503);

    await request(app).post('/hcm/__control/set-mode').send({ mode: 'normal' }).expect(200);
    await request(app).get('/hcm/balance/emp-2/loc-uk/SICK').expect(200);
  });
});
