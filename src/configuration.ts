export default () => ({
  port: Number(process.env.PORT ?? 3000),
  hcm: {
    baseUrl: process.env.HCM_BASE_URL ?? 'http://localhost:4100/hcm',
    apiKey: process.env.HCM_API_KEY ?? 'replace-me',
    timeoutMs: Number(process.env.HCM_TIMEOUT_MS ?? 5000)
  },
  balanceFreshnessTtlMin: Number(process.env.BALANCE_FRESHNESS_TTL_MIN ?? 5),
  reconcileCron: process.env.RECONCILE_CRON ?? '0 */6 * * *',
  alertDriftDays: Number(process.env.ALERT_DRIFT_DAYS ?? 1),
  cancelGraceHours: Number(process.env.CANCEL_GRACE_HOURS ?? 24),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  dbPath: process.env.DB_PATH ?? './data/db.sqlite'
});
