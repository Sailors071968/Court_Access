# Deployment Dependency Map

Authoritative activation sequence. No phase may begin until all prerequisites pass.

---

## Sequence

```
Phase 0 (NODE_ENV fix)
    │
    ├── Required evidence: Checkpoint A-E + stability gate + browser validation
    ├── Stability gate: 10-minute observation, zero restarts
    ├── Rollback: server.ts + ecosystem.config.cjs restore
    ├── Blocked: everything below
    │
    ▼
Phase A (Secret Rotation)
    │
    ├── Required evidence: /api/health returns production + all Phase 0 gates green
    ├── Stability gate: 10-minute observation after rotation
    ├── Rollback: restore .env.pre-rotation + restart
    ├── Blocked: auth hooks, CSRF, Redis, OCR, ingestion
    │
    ▼
Phase B1 (Auth Hook Restoration)
    │
    ├── Required evidence: Phase A stable + pre-auth route baseline captured
    ├── Stability gate: 10-minute observation + 20-route regression check
    ├── Rollback: comment out auth hook (1 line) + restart
    ├── Blocked: CSRF, Redis, OCR, ingestion
    │
    ▼
Phase B2 (CSRF Hook Restoration)
    │
    ├── Required evidence: Phase B1 stable + CSRF validation matrix (10 scenarios)
    ├── Stability gate: 10-minute observation + attacker-style POST test
    ├── Rollback: comment out CSRF hook (1 line) + restart
    ├── Blocked: Redis, OCR, ingestion
    │
    ▼
Phase C (End-to-End Auth Validation)
    │
    ├── Required evidence: 10 auth tests pass + browser session validation
    ├── Stability gate: 10-minute observation
    ├── Rollback: revert to Phase B2 state
    ├── Blocked: Redis, OCR, ingestion
    │
    ▼
Gate 0.5: NGINX Config Apply
    │
    ├── Required evidence: backend confirmed on port 3001 + nginx -t passes
    ├── Stability gate: verify frontend loads + API responds after reload
    ├── Rollback: restore nginx.conf.pre-stage1 + reload
    ├── Blocked: nothing (can occur anytime after Phase 0)
    │
    ▼
Gate 1: Redis Activation
    │
    ├── Required evidence: Phase C complete + Redis reachable via health/deep
    ├── Stability gate: 10-minute observation + queue state check
    ├── Rollback: re-add DISABLE_WORKERS=true + restart
    ├── Blocked: OCR, ingestion
    │
    ▼
Gate 2: OCR Activation
    │
    ├── Required evidence: Gate 1 stable + OCR deps installed + disk > 2GB free
    ├── Stability gate: 10-minute observation + zero OCR errors
    ├── Rollback: re-add CPRA_SIMULATION_MODE=true + restart
    ├── Blocked: ingestion
    │
    ▼
Gate 3: Ingestion Activation
    │
    ├── Required evidence: Gate 2 stable + all components healthy
    ├── Stability gate: 10-minute observation + zero failure visibility events
    ├── Rollback: disable ingestion trigger + restart
    ├── Blocked: nothing (full production)
    │
    ▼
Full Production
```

---

## Per-Transition Detail

### Phase 0 → Phase A

| Item | Value |
|------|-------|
| Required evidence | Checkpoint A: `environment=production`. Checkpoint B: CSP hardened, CORS restricted. Checkpoint C: PM2 stable. Checkpoint D: no fatal errors. Checkpoint E: rollback files exist. Browser: zero CSP violations. |
| Stability gate | 10 minutes, zero restarts, health=200 |
| Rollback checkpoint | `server.ts.pre-phase0`, `ecosystem.config.cjs.pre-phase0` |
| Blocked subsystems | Auth hooks, CSRF, Redis workers, OCR, ingestion, queue execution |

### Phase A → Phase B1

| Item | Value |
|------|-------|
| Required evidence | `/api/health` returns production. No warnings in PM2 logs. Secrets rotated and verified. |
| Stability gate | 10 minutes after secret rotation |
| Rollback checkpoint | `.env.pre-rotation` |
| Blocked subsystems | Auth hooks, CSRF, Redis workers, OCR, ingestion |

### Phase B1 → Phase B2

| Item | Value |
|------|-------|
| Required evidence | 11 public routes return non-401. 9 protected routes return 401. Pre-auth and post-auth route baselines captured and diffed. Browser session validation (5 scenarios). |
| Stability gate | 10 minutes after auth hook enable |
| Rollback checkpoint | Comment out auth hook line in `server.ts` |
| Blocked subsystems | CSRF, Redis workers, OCR, ingestion |

### Phase B2 → Phase C

| Item | Value |
|------|-------|
| Required evidence | CSRF 10-scenario matrix all pass. Bearer-token requests NOT blocked. Attacker-style POST returns 403. |
| Stability gate | 10 minutes after CSRF hook enable |
| Rollback checkpoint | Comment out CSRF hook line in `server.ts` |
| Blocked subsystems | Redis workers, OCR, ingestion |

### Phase C → Gate 1 (Redis)

| Item | Value |
|------|-------|
| Required evidence | All 10 auth tests pass. Browser session tests pass. Frontend stable under auth enforcement. |
| Stability gate | 10 minutes |
| Rollback checkpoint | Phase B2 state (both hooks enabled, CSRF validated) |
| Blocked subsystems | Redis workers, OCR, ingestion |

### Gate 1 → Gate 2 (OCR)

| Item | Value |
|------|-------|
| Required evidence | Redis PONG < 100ms. Workers running. Zero queue errors. Zero retry storms. |
| Stability gate | 10 minutes after DISABLE_WORKERS removed |
| Rollback checkpoint | Re-add `DISABLE_WORKERS=true` |
| Blocked subsystems | OCR, ingestion |

### Gate 2 → Gate 3 (Ingestion)

| Item | Value |
|------|-------|
| Required evidence | OCR deps all installed. Temp dir writable. Disk > 2GB. Zero OCR errors. |
| Stability gate | 10 minutes after CPRA_SIMULATION_MODE removed |
| Rollback checkpoint | Re-add `CPRA_SIMULATION_MODE=true` |
| Blocked subsystems | Ingestion |

### Gate 3 → Full Production

| Item | Value |
|------|-------|
| Required evidence | All components healthy. Zero failure visibility events. Queue depths stable. |
| Stability gate | 10 minutes after ingestion enabled |
| Rollback checkpoint | Disable ingestion trigger |
| Blocked subsystems | None |

---

## Blocked Subsystem Matrix

| Phase | Auth | CSRF | Redis | OCR | Ingestion | Queues |
|-------|------|------|-------|-----|-----------|--------|
| Phase 0 | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Phase A | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Phase B1 | ACTIVE | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Phase B2 | ACTIVE | ACTIVE | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Phase C | ACTIVE | ACTIVE | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Gate 1 | ACTIVE | ACTIVE | ACTIVE | BLOCKED | BLOCKED | ACTIVE |
| Gate 2 | ACTIVE | ACTIVE | ACTIVE | ACTIVE | BLOCKED | ACTIVE |
| Gate 3 | ACTIVE | ACTIVE | ACTIVE | ACTIVE | ACTIVE | ACTIVE |
