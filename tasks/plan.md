# Implementation Plan: Production Hardening

> **Execution status (2026-09-21):** Code-level implementation and local verification are complete.
> The checkbox lists below are the original acceptance specification, not the authoritative release ledger.
> Current evidence and the exact `NOT READY` verdict are recorded in
> [`docs/PRODUCTION_READINESS_REPORT.md`](../docs/PRODUCTION_READINESS_REPORT.md).

## Overview

Audit HEAD `7fc6879af48b94d7b42537d50f6487a5ec7e3749` and remediate the production-readiness findings in priority order. Source, tests, schema, runtime configuration, and CI evidence take precedence over historical documentation.

## Architecture Decisions

- Preserve the current Next.js -> API Gateway -> NestJS services -> per-service MySQL architecture.
- Reuse the order service `CompensationTask` worker for durable inventory commit intent; do not introduce a broker.
- Bind provider webhooks to a persisted payment attempt and enforce database uniqueness for provider transaction IDs.
- Keep production credentials external to the repository and fail startup when enabled payment configuration is incomplete.
- Add behavior-focused regression tests before each production-code fix.

## Dependency Graph

Secret/config hygiene
  -> payment provider public contract
  -> payment authorization
  -> payment-attempt schema and migration
  -> amount validation and concurrent webhook idempotency
  -> durable paid-to-inventory commit tasks
  -> inventory/worker invariants and HTTP resilience
  -> CI, production boot, observability, documentation

## Task List

### Phase 1: P0 security boundaries

- [ ] P0-01 remove key material from HEAD, harden certificate handling, add secret scanning and documentation
- [ ] P0-02 expose only public MoMo settings and enforce production fail-fast credentials
- [ ] P0-03 centralize payment/order ownership checks for every customer-facing payment read/action endpoint

### Checkpoint: P0 security

- [ ] Focused regression tests pass
- [ ] Secret scan and repository search pass
- [ ] Order service builds and typechecks

### Phase 2: P0 financial integrity

- [ ] P0-04 require exact expected webhook amount before any paid transition
- [ ] P0-05 make webhook handling concurrency-safe with a durable provider transaction idempotency key
- [ ] P0-06 bind create/query/webhook/retry to the exact persisted payment attempt

### Checkpoint: payment integrity

- [ ] Exact/mismatched amount tests pass
- [ ] Concurrent duplicate webhook test proves one financial transition
- [ ] Old-attempt webhook cannot update a newer attempt

### Phase 3: P0 inventory durability

- [ ] P0-07 persist `COMMIT_INVENTORY` intent atomically with paid state
- [ ] Extend the existing worker with atomic claim, timeout, retry, backoff, stale recovery, and idempotent commit
- [ ] Verify paid-order reservations are recoverably committed after inventory outage

### Checkpoint: P0 complete

- [ ] All P0 regression/integration tests pass
- [ ] Prisma validation/generation and deterministic migration pass
- [ ] No unresolved P0 remains

### Phase 4: P1 configuration and resilience

- [ ] Verify MoMo identifier consistency and production environment contract
- [ ] Add explicit timeouts/correlation IDs to critical internal HTTP calls without unsafe POST retries
- [ ] Replace inventory clamps with invariant failures and prevent overlapping workers
- [ ] Review distributed rate limiting and reduce production Swagger/test/debug surface

### Phase 5: P1 CI and integration gates

- [ ] Correct unit/build ordering and make integration jobs run real critical tests
- [ ] Add production-like compose build/boot/health smoke test with runtime certificates
- [ ] Run auth, inventory, checkout, payment, migration, and production configuration gates

### Phase 6: P2 observability and truthful documentation

- [ ] Add structured payment/inventory event context without secrets
- [ ] Update deployment/status/audit/remediation documents from observed evidence
- [ ] Add `docs/PRODUCTION_READINESS_REPORT.md` and final command/result matrix

### Checkpoint: release decision

- [ ] Lint, typecheck, unit, integration, and build gates pass
- [ ] Production compose config/build/boot pass
- [ ] Secret scan passes
- [ ] Final status is exactly READY or NOT READY with blockers

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing tests depend on live MySQL/Docker | High | Separate fast regression tests from runtime integration gates and report unrun gates honestly |
| Schema migration changes payment semantics | High | Add deterministic migration, generate Prisma client, and test multi-attempt/idempotency behavior |
| Paid state can outlive inventory availability | Critical | Persist commit intent in the same order DB transaction as the paid transition |
| Old MoMo webhook races a new attempt | Critical | Persist provider order/request IDs per attempt and resolve the exact attempt |
| Historical docs overstate readiness | Medium | Update documents only after final verification |

## Open Questions

- None required to begin. External Docker/network availability may affect final runtime evidence; any unavailable gate remains a release blocker rather than being inferred as passing.
