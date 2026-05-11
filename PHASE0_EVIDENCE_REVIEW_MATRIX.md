# Phase 0 — Evidence Review Matrix

---

## Checkpoint A — Environment

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| NODE_ENV | `/api/health` JSON | `"environment": "production"` | `"environment": "development"` or missing | YES — immediate | CRITICAL |
| Health status | `/api/health` JSON | `"status": "ok"` | Any other value or no response | YES — immediate | CRITICAL |
| Service name | `/api/health` JSON | `"service": "court-access-backend"` | Missing or different | NO | INFO |
| Version | `/api/health` JSON | `"version": "1.1.0"` | Different version | NO | INFO |

---

## Checkpoint B — Security Headers

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| CSP no unsafe-eval | `curl -sI` response headers | `Content-Security-Policy` does NOT contain `unsafe-eval` | Contains `unsafe-eval` | YES — immediate | CRITICAL |
| CSP no localhost | `curl -sI` response headers | `Content-Security-Policy` does NOT contain `localhost` | Contains `localhost` | YES — immediate | CRITICAL |
| X-Powered-By removed | `curl -sI` response headers | `X-Powered-By` header absent | Header present | NO | HIGH |
| HSTS present | `curl -sI` response headers | `Strict-Transport-Security` header present | Header absent | NO | HIGH |
| CORS localhost rejected | `curl -sI -H 'Origin: http://localhost:3000'` | No `access-control-allow-origin` in response | `access-control-allow-origin: http://localhost:3000` | YES — immediate | CRITICAL |
| X-Frame-Options | `curl -sI` response headers | `X-Frame-Options: DENY` present | Absent | NO | MEDIUM |
| X-Content-Type-Options | `curl -sI` response headers | `X-Content-Type-Options: nosniff` present | Absent | NO | MEDIUM |
| Cookie Secure flag | `curl -sI` POST to auth endpoint | `Set-Cookie` contains `Secure` | Missing `Secure` | NO (verify in browser) | HIGH |
| Cookie HttpOnly flag | `curl -sI` POST to auth endpoint | `Set-Cookie` contains `HttpOnly` | Missing `HttpOnly` | NO (verify in browser) | HIGH |
| Cookie SameSite flag | `curl -sI` POST to auth endpoint | `Set-Cookie` contains `SameSite=Strict` or `SameSite=Lax` | Missing or `SameSite=None` | NO (verify in browser) | HIGH |

---

## Checkpoint C — PM2 Stability

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| Process status | `pm2 status` | `online` | `errored`, `stopped`, `launching` | YES — immediate | CRITICAL |
| Restart count | `pm2 show` | `0` (no restarts since deploy) | Any value > 0 | YES — investigate | CRITICAL |
| NODE_ENV in PM2 env | `pm2 show` grep | `NODE_ENV: production` | `development` or missing | YES — immediate | CRITICAL |
| DOTENV_CONFIG_PATH | `pm2 show` grep | Path present and correct | Missing or wrong path | NO | HIGH |
| Memory usage | `pm2 show` | < 300MB | > 400MB within 5 min of start | YES — if > 400MB | HIGH |

---

## Checkpoint D — Runtime

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| Server started | PM2 logs | `CourtAccess API running on http://0.0.0.0:3001` present | Missing or different port | YES — immediate | CRITICAL |
| Schema assertion | PM2 logs | `Skipped via SKIP_SCHEMA_ASSERT` present | `FATAL: Schema integrity check failed` | YES — immediate | CRITICAL |
| No ECONNREFUSED | PM2 logs | Zero occurrences | Any occurrence | NO (expected if Redis down) | MEDIUM |
| No process.exit | PM2 logs | Zero occurrences of `process.exit(1)` | Any occurrence | YES — immediate | CRITICAL |
| No Prisma errors | PM2 logs | No `PrismaClientInitializationError` | Any occurrence | YES — immediate | CRITICAL |
| NGINX running | `systemctl status nginx` | `active (running)` | `inactive` or `failed` | YES — NGINX rollback | CRITICAL |
| Route registration | PM2 logs | `Registering observability routes` present | Missing | NO | MEDIUM |

---

## Checkpoint D2 — Deep Health (Stage 1)

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| Endpoint responds | `curl /api/health/deep` | HTTP 200 or 503 with JSON body | 404 or connection error | NO (new endpoint) | MEDIUM |
| Infrastructure data | Deep health JSON | `infrastructure` object with `nodeEnv`, `pid`, `uptime` | Missing `infrastructure` | NO | LOW |
| Postgres check | Deep health JSON | `components.postgres.status` = `healthy` | `unhealthy` | NO (investigate) | HIGH |
| Redis check | Deep health JSON | `components.redis.status` = `disabled` or `healthy` | `unhealthy` (when expected healthy) | NO | MEDIUM |
| Failure visibility | `curl /api/metrics/failures` | JSON with all-zero counters | 404 or error | NO | LOW |

---

## Checkpoint E — Rollback Artifacts

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| .env backup | `ls -la backend/.env.pre-phase0` | File exists, non-zero | Missing | STOP — recreate before continuing | CRITICAL |
| server.ts backup | `ls -la backend/src/server.ts.pre-phase0` | File exists, non-zero | Missing | STOP — recreate before continuing | CRITICAL |
| ecosystem backup | `ls -la ecosystem.config.cjs.pre-phase0` | File exists, non-zero | Missing | STOP — recreate before continuing | CRITICAL |
| nginx backup | `ls -la /etc/nginx/nginx.conf.pre-phase0` | File exists, non-zero | Missing | STOP — recreate before continuing | CRITICAL |
| PM2 dump backup | `ls -la ~/.pm2/dump.pm2.pre-phase0` | File exists, non-zero | Missing | STOP — recreate before continuing | CRITICAL |

---

## Stability Gate — 10-Minute Observation

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| Health consistency | 10 curl checks | All return 200 | Any non-200 | YES — immediate | CRITICAL |
| PM2 status stable | 10 pm2 checks | All show `online` | Any non-online | YES — immediate | CRITICAL |
| Restart count stable | 10 pm2 checks | Count unchanged from start | Any increase | YES — immediate | CRITICAL |
| Memory stable | 10 pm2 checks | < 50MB growth over 10 min | > 100MB growth | YES — investigate | HIGH |

---

## Browser Evidence

| Item | Required Artifact | Pass | Fail | Rollback Trigger | Severity |
|------|------------------|------|------|-----------------|----------|
| Zero CSP violations | Console tab screenshot | No red CSP errors | Red CSP violation errors | YES — if frontend broken | CRITICAL |
| Frontend renders | Visual check | Login page loads | White screen or error | YES — immediate | CRITICAL |
| No mixed content | Console tab | No mixed-content warnings | Mixed content warnings | NO | MEDIUM |
| Network requests OK | Network tab | `/api/health` returns 200 | Failed requests (red) | Depends on endpoint | MEDIUM |

---

## Summary Severity Levels

| Severity | Meaning | Action |
|----------|---------|--------|
| CRITICAL | Deployment has failed or is unsafe | Immediate rollback |
| HIGH | Significant issue, not immediately dangerous | Investigate within 5 minutes, rollback if unresolved |
| MEDIUM | Notable but non-blocking | Document and address after stability gate |
| LOW | Informational | Document for future reference |
| INFO | Expected variance | No action needed |
