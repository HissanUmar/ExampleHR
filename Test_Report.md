# ExampleHR Time-Off Microservice - Test Coverage and Results Report

Date: 2026-04-25
Project: ExampleHRModule
Command executed (tests): npm test -- --runInBand --passWithNoTests
Command executed (coverage): npm run test:cov

## 1. Test Execution Summary

- Overall status: PASSED
- Test suites: 8 passed, 0 failed (8 total)
- Test cases: 39 passed, 0 failed (39 total)
- Snapshots: 0 total

## 2. Tests Covered and Results

### 2.1 End-to-End Tests

Source file: test/app.e2e-spec.ts

- App e2e returns health information: PASSED

Coverage intent:
- Verifies a full HTTP round-trip to /api/health.
- Confirms application bootstrap and routing are operational.

### 2.2 Requests Service Unit Tests

Source file: test/requests.service.spec.ts

- RequestsService rejects insufficient balance before HCM debit: PASSED
- RequestsService creates a pending request and enqueues retry when HCM is unavailable: PASSED
- RequestsService approves a request only for the manager: PASSED

Coverage intent:
- Guards against over-consumption of leave balance.
- Verifies transient HCM failure behavior and retry queue path.
- Enforces manager authorization semantics for approvals.

### 2.3 Requests Service Expanded Unit Tests

Source file: test/requests.service.expanded.spec.ts

- RequestsService expanded rejects overlapping requests: PASSED
- RequestsService expanded maps hcm conflict into HCM_REJECTED and rolls back local adjustment: PASSED
- RequestsService expanded returns request when getById finds one: PASSED
- RequestsService expanded throws not found when getById misses: PASSED
- RequestsService expanded forbids approval when user is not manager: PASSED
- RequestsService expanded forbids approval when manager does not own employee: PASSED
- RequestsService expanded rejects approve when request is not pending: PASSED
- RequestsService expanded rejects approve when refreshed balance is invalid: PASSED
- RequestsService expanded reject flow updates status and manager info: PASSED
- RequestsService expanded cancel request forbids foreign employee: PASSED
- RequestsService expanded cancel request blocks after approved grace expiry: PASSED
- RequestsService expanded cancel request blocks non-cancellable status: PASSED
- RequestsService expanded cancel request enqueues credit retry when hcm credit fails: PASSED
- RequestsService expanded listRequests applies all filters: PASSED

Coverage intent:
- Covers overlap conflict, not-found path, manager authorization negatives, status gating, cancellation edge cases, and filter path application.

### 2.4 HCM Adapter Unit Tests

Source file: test/hcm.adapter.spec.ts

- HcmAdapter gets balance successfully: PASSED
- HcmAdapter debits successfully: PASSED
- HcmAdapter credits successfully: PASSED
- HcmAdapter maps 4xx into conflict exception: PASSED
- HcmAdapter maps network failure into service unavailable: PASSED

Coverage intent:
- Covers happy-path HTTP calls plus normalization of 4xx and transient failures.

### 2.5 Controller and Auth Unit Tests

Source file: test/controllers-and-auth.spec.ts

- Controllers and auth utilities internal api key guard accepts valid key: PASSED
- Controllers and auth utilities internal api key guard rejects invalid key: PASSED
- Controllers and auth utilities app controller health and metrics endpoints return expected payload: PASSED
- Controllers and auth utilities balances controller delegates service calls: PASSED
- Controllers and auth utilities sync controller delegates service calls: PASSED
- Controllers and auth utilities jwt strategy normalizes optional claims in validate: PASSED

Coverage intent:
- Covers guard positive/negative paths and controller delegation/utility logic.

### 2.6 Mock HCM Server Integration-Style Tests

Source file: test/mock-hcm-server.spec.ts

- Mock HCM server supports control set-balance and get balance: PASSED
- Mock HCM server debits balance and honors idempotency: PASSED
- Mock HCM server returns insufficient balance on debit overdraw: PASSED
- Mock HCM server credits balance: PASSED
- Mock HCM server applies batch update corpus: PASSED
- Mock HCM server supports forced error mode: PASSED

Coverage intent:
- Validates required mock HCM endpoints and key behaviors used by test scenarios.

### 2.7 Sync Service Unit Tests

Source file: test/sync.service.spec.ts

- SyncService processes batch updates and records success: PASSED
- SyncService moves retry jobs through the failure queue: PASSED

Coverage intent:
- Verifies batch upsert orchestration and success accounting.
- Verifies failed job retry progression logic.

### 2.8 Balances Service Unit Tests

Source file: test/balances.service.spec.ts

- BalancesService refreshes stale balances from HCM: PASSED
- BalancesService adjusts balance with optimistic locking: PASSED

Coverage intent:
- Verifies stale-cache refresh policy through HCM adapter.
- Verifies concurrency-safe balance mutation using optimistic locking.

## 3. Artifact Evidence

Primary machine-readable artifact:
- test-results.json

Human-readable artifact:
- test-results.txt

Result metadata extracted from test-results.json:
- numPassedTestSuites: 8
- numTotalTestSuites: 8
- numPassedTests: 39
- numTotalTests: 39
- numFailedTests: 0
- success: true

Coverage evidence artifacts:
- coverage-summary.txt
- coverage/coverage-final.json
- coverage/lcov.info
- coverage/clover.xml
- coverage/lcov-report/index.html

Coverage proof extracted from coverage-summary.txt:
- Statements: 91.58%
- Branches: 83.33%
- Functions: 81.96%
- Lines: 90.79%

Coverage threshold status from Jest output:
- Branches threshold 70%: MET (83.33%)
- Lines threshold 80%: MET (90.79%)
- Functions threshold 80%: MET (81.96%)
- Statements threshold 80%: MET (91.58%)

Important note:
- Expanded suite now passes all tests and exceeds 80% on all global coverage dimensions.

## 4. Recommended Future Tests

The current tests are a strong starting baseline. The following tests should be added next to improve regression protection and align more closely with the TRD behavior expectations.

### 4.1 Request Lifecycle and Validation

1. Overlap conflict detection
- Add test for creating a request overlapping an existing PENDING or APPROVED request.
- Expected: 409 OVERLAP_CONFLICT.

2. Reject flow restores balance
- Add test for manager rejection after request creation.
- Expected: status REJECTED and balance restored (or credit job queued on HCM unavailability).

3. Cancel flow (pending)
- Add test for employee cancellation of PENDING request.
- Expected: status CANCELLED and HCM/local balance reversal.

4. Cancel flow (approved with grace window)
- Add tests both within and beyond CANCEL_GRACE_HOURS.
- Expected: success within grace, 409 when grace expired.

### 4.2 Authorization and Access Control

1. Non-manager approval/rejection attempts
- Expected: 403 MANAGER_ROLE_REQUIRED.

2. Manager not responsible for employee
- Expected: 403 NOT_EMPLOYEE_MANAGER.

3. Internal API key protection
- Verify /api/sync/trigger and /api/balances/batch reject invalid keys.
- Expected: 403 INTERNAL_API_KEY_INVALID.

### 4.3 HCM Integration Robustness

1. HCM conflict behavior on debit/credit
- Simulate HCM 4xx rejection.
- Expected: request rejected with mapped conflict response.

2. Retry exhaustion path
- Ensure retry job transitions to DEAD_LETTER after max attempts.
- Validate alert/log hook behavior if implemented.

3. Idempotency behavior
- Validate repeated HCM writes with same idempotency key do not double-deduct.

### 4.4 Sync and Reconciliation

1. Partial batch sync
- Include one invalid record among valid records.
- Expected: sync event status PARTIAL with accurate record counts.

2. Reconciliation drift correction
- Diverge local and HCM balances intentionally.
- Expected: local corrected to HCM, audit log entry written.

### 4.5 API-Level End-to-End Expansion

1. Full employee-manager workflow e2e
- Submit request, approve request, verify resulting balance and request state.

2. Failure-first then recovery workflow
- Simulate HCM down on request creation (202), then recovery path via retry processing.

3. DTO validation edge tests
- Invalid dates, negative/zero daysRequested, malformed leaveType/locationId.

## 5. Suggested CI Test Commands

- Fast local run:
  - npm test -- --runInBand --passWithNoTests

- Coverage run:
  - npm run test:cov

- Optional open-handle diagnostics when needed:
  - npm test -- --runInBand --detectOpenHandles

## 6. Conclusion

All currently implemented tests pass successfully. The service has baseline validation for health endpoint behavior, balance stale-refresh and optimistic locking, request submission edge conditions, manager approval authorization, and sync retry/batch pathways. Expanding the recommended tests will improve confidence in lifecycle completeness, authorization hardening, and long-term regression safety.
