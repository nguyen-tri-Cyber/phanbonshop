# Production Hardening Tasks

> **Execution status (2026-09-21):** The implementation items below have been executed and reviewed;
> remaining external release gates are tracked in
> [`docs/PRODUCTION_READINESS_REPORT.md`](../docs/PRODUCTION_READINESS_REPORT.md).
> Local HTTP development is verified ready. Production remains blocked by the runtime
> dependency audit (1 Critical, 5 High) and final CI/release-environment evidence.

## Task 1: P0 secret and certificate hygiene

**Acceptance criteria:**
- [ ] No private key/certificate material is tracked in HEAD; generated local cert paths are ignored.
- [ ] Production certificates are mounted from an external path and Let's Encrypt setup never copies keys into the repository.
- [ ] CI secret scanning and secret-management documentation exist.

**Verification:**
- [ ] `git ls-files`/repository secret checks pass.
- [ ] Focused hardening tests pass.

**Dependencies:** None

## Task 2: P0 MoMo public configuration and startup validation

**Acceptance criteria:**
- [ ] Public settings never expose signing credentials.
- [ ] Production MoMo enablement fails fast when required credentials are missing.
- [ ] Offline sandbox fallback is impossible in production.

**Verification:**
- [ ] Regression test fails on old behavior and passes after fix.
- [ ] Order service build/typecheck pass.

**Dependencies:** Task 1

## Task 3: P0 payment authorization

**Acceptance criteria:**
- [ ] Customer access to payment, transaction history, and retry is owner-scoped.
- [ ] Existing privileged roles retain explicit access.
- [ ] Unauthorized resource access follows the repository's non-disclosure policy.

**Verification:**
- [ ] Owner/cross-user/privileged regression tests pass.

**Dependencies:** Task 2

## Task 4: P0 webhook amount, attempt binding, and idempotency

**Acceptance criteria:**
- [ ] Webhook maps to the exact persisted attempt/provider identifiers.
- [ ] Received VND amount exactly equals the expected amount before paid transition.
- [ ] Concurrent duplicate provider transactions cause one successful financial side effect.

**Verification:**
- [ ] Amount boundary, multi-attempt, and concurrent duplicate tests pass.
- [ ] Prisma migration validates and applies to a test database.

**Dependencies:** Task 3

## Task 5: P0 durable inventory commit

**Acceptance criteria:**
- [ ] Paid transition and inventory commit intent are persisted atomically.
- [ ] Existing compensation worker safely retries idempotent commits across replicas and crashes.
- [ ] Inventory recovery test completes the pending commit after an outage.

**Verification:**
- [ ] Durable commit regression/integration tests pass.
- [ ] Checkout/payment/inventory related tests remain green.

**Dependencies:** Task 4

## Task 6: P1 configuration, HTTP, inventory, workers, rate limiting, attack surface

**Acceptance criteria:**
- [ ] Production env names match all consumers and compose inputs.
- [ ] Critical internal HTTP calls have explicit timeout/correlation behavior.
- [ ] Inventory invariant violations fail loudly; workers do not overlap.
- [ ] Production debug/test/Swagger exposure and distributed throttling have safe implementations or explicit blockers.

**Verification:**
- [ ] Focused config/inventory/worker tests and builds pass.

**Dependencies:** Task 5

## Task 7: P1 CI and production-like boot

**Acceptance criteria:**
- [ ] CI runs real unit/integration/payment/inventory/auth tests after required builds.
- [ ] CI secret scan fails on real leaks.
- [ ] Production compose builds, boots with runtime certs, and passes readiness checks.

**Verification:**
- [ ] Workflow static validation passes.
- [ ] Local equivalent release commands are recorded with real results.

**Dependencies:** Task 6

## Task 8: P2 observability and final documentation

**Acceptance criteria:**
- [ ] Payment/inventory events carry trace identifiers without credentials.
- [ ] Required documentation reflects measured results and remaining risks.
- [ ] Final readiness report contains revision, findings, changes, tests, evidence, and exact READY/NOT READY verdict.

**Verification:**
- [ ] Full release matrix is executed and documented.
- [ ] Final code review has no unresolved Critical/Required findings.

**Dependencies:** Task 7
