import express from 'express';

type Mode = 'normal' | 'error';

interface BalanceRecord {
  balanceDays: number;
}

const keyOf = (employeeId: string, locationId: string, leaveType: string) =>
  `${employeeId}::${locationId}::${leaveType}`;

export const createMockHcmApp = () => {
  const app = express();
  app.use(express.json());

  const balances = new Map<string, BalanceRecord>();
  const idempotency = new Map<string, { transactionId: string; balanceDays: number }>();
  let mode: Mode = 'normal';

  app.get('/hcm/balance/:employeeId/:locationId/:leaveType', (req, res) => {
    if (mode === 'error') {
      return res.status(503).json({ error: 'HCM_DOWN' });
    }

    const { employeeId, locationId, leaveType } = req.params;
    const key = keyOf(employeeId, locationId, leaveType);
    const current = balances.get(key) ?? { balanceDays: 0 };

    return res.json({ employeeId, locationId, leaveType, balanceDays: current.balanceDays });
  });

  app.post('/hcm/debit', (req, res) => {
    if (mode === 'error') {
      return res.status(503).json({ error: 'HCM_DOWN' });
    }

    const { employeeId, locationId, leaveType, days, idempotencyKey } = req.body as {
      employeeId: string;
      locationId: string;
      leaveType: string;
      days: number;
      idempotencyKey?: string;
    };

    if (idempotencyKey && idempotency.has(idempotencyKey)) {
      return res.json(idempotency.get(idempotencyKey));
    }

    const key = keyOf(employeeId, locationId, leaveType);
    const current = balances.get(key) ?? { balanceDays: 0 };

    if (current.balanceDays < days) {
      return res.status(409).json({ error: 'INSUFFICIENT_BALANCE' });
    }

    const next = current.balanceDays - days;
    balances.set(key, { balanceDays: next });

    const result = {
      transactionId: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      balanceDays: next
    };

    if (idempotencyKey) {
      idempotency.set(idempotencyKey, result);
    }

    return res.json(result);
  });

  app.post('/hcm/credit', (req, res) => {
    if (mode === 'error') {
      return res.status(503).json({ error: 'HCM_DOWN' });
    }

    const { employeeId, locationId, leaveType, days, idempotencyKey } = req.body as {
      employeeId: string;
      locationId: string;
      leaveType: string;
      days: number;
      idempotencyKey?: string;
    };

    if (idempotencyKey && idempotency.has(idempotencyKey)) {
      return res.json(idempotency.get(idempotencyKey));
    }

    const key = keyOf(employeeId, locationId, leaveType);
    const current = balances.get(key) ?? { balanceDays: 0 };
    const next = current.balanceDays + days;
    balances.set(key, { balanceDays: next });

    const result = {
      transactionId: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      balanceDays: next
    };

    if (idempotencyKey) {
      idempotency.set(idempotencyKey, result);
    }

    return res.json(result);
  });

  app.post('/hcm/batch', (req, res) => {
    const { records } = req.body as {
      records: Array<{
        employeeId: string;
        locationId: string;
        leaveType: string;
        balanceDays: number;
      }>;
    };

    for (const record of records ?? []) {
      balances.set(keyOf(record.employeeId, record.locationId, record.leaveType), {
        balanceDays: record.balanceDays
      });
    }

    return res.json({ ok: true, count: (records ?? []).length });
  });

  app.post('/hcm/__control/set-balance', (req, res) => {
    const { employeeId, locationId, leaveType, balanceDays } = req.body as {
      employeeId: string;
      locationId: string;
      leaveType: string;
      balanceDays: number;
    };

    balances.set(keyOf(employeeId, locationId, leaveType), { balanceDays });
    return res.json({ ok: true });
  });

  app.post('/hcm/__control/set-mode', (req, res) => {
    const { mode: nextMode } = req.body as { mode: Mode };
    mode = nextMode === 'error' ? 'error' : 'normal';
    return res.json({ ok: true, mode });
  });

  return app;
};
