# Operations Certification Report (Program 42)

**Scope:** production operations. Split into **(A) artifact-verified** (scripts,
configs, code exist and are correct) and **(B) runtime-verified** (services actually
running). Runtime checks require the deployed V1 stack on EC2, which is **not
reachable** (only the stale legacy build responds — BLK-001), so live state is
**UNKNOWN** and never fabricated.

**Generated:** 2026-07-06.

---

## 1. Component matrix (evidence)

| Component | Artifact (code/config) | Runtime (live) | Evidence |
|-----------|------------------------|----------------|----------|
| **PM2** | ✅ `ecosystem.config.cjs` — 11 apps (api, frontend, 6 workers, queueMonitor, graphIntegrityCheck, systemHealth); `autorestart`, `max_memory_restart`, log files, boot startup | **UNKNOWN** | verify script checks `pm2 describe … online` |
| **Redis** | ✅ BullMQ + `redisMemoryAlert` (30s), `courtaccess_redis_connected` gauge | **UNKNOWN** | `deepHealthCheck.ts` pings Redis |
| **PostgreSQL** | ✅ Prisma; deep-health checks Postgres | **UNKNOWN** | `deepHealthCheck.ts` (Prisma) |
| **Nginx** | ✅ verify script runs `nginx -t`, checks listen port | **UNKNOWN** | `v1-greenfield-verify.sh` §Nginx |
| **Workers** | ✅ 6 PM2 workers + `queueManager` | **UNKNOWN** | ecosystem + queueManager |
| **Queues** | ✅ BullMQ configs w/ retries/backoff/timeouts (see OCR report) | **UNKNOWN** | `queueManager.ts` |
| **Stripe** | ✅ `billingRoutes`, cert harness | ⚠️ **live cert incomplete (BLK-004)** | `stripeLiveCertification.ts` |
| **Email** | ✅ AWS SES (`@aws-sdk/client-ses`) | **UNKNOWN** | package dep + billing email paths |
| **SMS** | ❌ **NOT implemented** | ❌ FAIL | production gate PG-014 "SMS not implemented" |
| **Storage** | ✅ Cloudflare R2 / S3 (`@aws-sdk/client-s3`, `lib/r2`) | **UNKNOWN** | `evidenceRoutes.ts`, `adminRoutes.ts` |
| **Logging** | ✅ `structuredLogger` w/ correlationId | **UNKNOWN** | `observability/structuredLogger.ts` |
| **Metrics** | ✅ `/api/metrics` (Prometheus) + `/api/metrics/json`; `metricsCollector` | **UNKNOWN** | `observabilityRoutes.ts` |
| **Tracing** | ⚠️ correlationId propagation only (no distributed tracing/OTel) | **UNKNOWN** | `structuredLogger.ts` |
| **Alerts** | ✅ `redisMemoryAlert`; ops dashboard alerts array | **UNKNOWN** | `redisMemoryAlert.ts`, ops dashboard |
| **Repository monitoring** | ✅ `graphIntegrityCheck`, `systemHealth`, RepositoryIntegrity dashboard | **UNKNOWN** | PM2 workers + dashboards |
| **Health endpoints** | ✅ `/api/health`, `/api/health/deep` (Postgres+Redis+Neo4j), `/api/metrics` | Legacy only: prod `/api/health/deep` → **404** | `server.ts`, `observabilityRoutes.ts` |
| **Deployment scripts** | ✅ preflight, install, verify, cutover, readiness certificate | **UNKNOWN (not run on EC2)** | `scripts/v1-greenfield-*.sh` |
| **Rollback** | ✅ cutover writes `rollback-to-legacy.sh` (backs up legacy dir, v1 snapshot, nginx) | **UNKNOWN (not exercised)** | `v1-production-cutover.sh` §rollback |

---

## 2. Deployment & rollback (artifact-verified)

- **Greenfield pipeline** (Program 1A): `v1-greenfield-preflight.sh` → `install` →
  `verify` → `v1-production-cutover.sh`, with `v1-deployment-readiness-certificate.sh`.
- **Verify script** asserts: `/api/health` + `/api/health/deep` reachable, PM2 app
  online, `nginx -t` valid, nginx listening, SSL — a real acceptance gate.
- **Rollback**: cutover snapshots the legacy production dir + v1 + nginx config and
  emits `rollback-to-legacy.sh` that restores nginx and the legacy site — a real,
  scripted rollback path.
- **Not yet executed on EC2** → runtime state UNKNOWN (BLK-001).

---

## 3. Observability (artifact-verified)

- **Health:** `/api/health` (liveness) + `/api/health/deep` (Postgres, Redis, Neo4j).
- **Metrics:** Prometheus exposition at `/api/metrics` + JSON at `/api/metrics/json`;
  `metricsCollector` registers gauges (incl. `courtaccess_redis_connected`).
- **Logging:** `structuredLogger` with `correlationId` request tracing.
- **Alerts:** `redisMemoryAlert` (configurable interval); ops dashboard alert feed.
- **Gap:** no distributed tracing (OpenTelemetry/spans) — correlationId only.

---

## 4. Production readiness score (honest)

Weighted by whether each area is (a) artifact-complete and (b) runtime-verified:

| Area | Artifact | Runtime | Score |
|------|----------|---------|-------|
| PM2 / workers | ✅ | UNKNOWN | 0.5 |
| Redis / Postgres / Nginx | ✅ | UNKNOWN | 0.5 |
| Queues | ✅ | UNKNOWN | 0.5 |
| Health / metrics / logging | ✅ | UNKNOWN | 0.5 |
| Deployment scripts / rollback | ✅ | UNKNOWN | 0.5 |
| Storage (R2/S3) | ✅ | UNKNOWN | 0.5 |
| Email | ✅ | UNKNOWN | 0.4 |
| Tracing | ⚠️ partial | UNKNOWN | 0.25 |
| Stripe | ✅ code | ❌ live cert incomplete | 0.4 |
| **SMS** | ❌ not implemented | ❌ | 0.0 |

**Production readiness score: ≈ 42%.**
Operations **tooling is well-built** (PM2 config, greenfield pipeline with verify +
scripted rollback, deep health, Prometheus metrics, structured logging, alerting).
**Certification is DENIED** because nothing is runtime-verified on a V1 stack
(BLK-001), SMS is unimplemented, and Stripe live cert is incomplete.

---

## 5. Outstanding risks

1. **BLK-001 — V1 not deployed/cutover** → every runtime ops check is UNKNOWN. Highest risk.
2. **BLK-003 — DB migration drift** (Program 36) → `migrate deploy` yields an incomplete schema.
3. **SMS not implemented** (PG-014) → court-date SMS reminders unavailable.
4. **BLK-004 — Stripe live cert incomplete** → billing not production-certified.
5. **No distributed tracing** → cross-service latency/error diagnosis is limited.
6. **Rollback never exercised** → the scripted rollback path is untested against a real cutover.
7. **Service-layer retry/timeout gap** (Program 35) → client resilience limited.

---

## 6. Reproduce

```bash
cat ecosystem.config.cjs | rg "name: '"                       # PM2 apps
rg -n "pm2|nginx|health|ssl" scripts/v1-greenfield-verify.sh   # acceptance gates
rg -n "rollback|BACKUP_ROOT|nginx" scripts/v1-production-cutover.sh
rg -n "/api/health/deep|/api/metrics" backend/src/observability/observabilityRoutes.ts
curl -s -o /dev/null -w "%{http_code}\n" https://courtaccess.net/api/health/deep   # 404 → legacy, not V1
```
