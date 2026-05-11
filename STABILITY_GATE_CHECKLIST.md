# CourtAccess — Stability Gate Checklist

Mandatory gates BEFORE activating each subsystem. Every gate includes exact commands, expected outputs, rollback triggers, observation windows, and pass/fail criteria.

---

## Gate 1: Redis Activation

### Prerequisites
- Phase 0 (NODE_ENV fix) fully validated
- Phase A (Secret rotation) complete
- Phase B (Auth + CSRF hooks) stable for 10+ minutes
- Phase C (End-to-end auth) all 10 tests passing

### Pre-Activation Checks

```bash
# 1. Verify Redis is reachable (passive ping only)
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['components']['redis']
print(f'Redis status: {r[\"status\"]}')
print(f'Redis latency: {r[\"latencyMs\"]}ms')
print(f'Details: {json.dumps(r.get(\"details\",{}), indent=2)}')
"
# Expected: status=healthy or status=disabled, ping responds

# 2. Verify REDIS_URL is configured
grep -c 'REDIS_URL' /var/www/courtaccess_repo/backend/.env
# Expected: 1 (REDIS_URL present in .env)

# 3. Verify Redis TLS (if configured)
echo $REDIS_URL | grep -c 'rediss://'
# Expected: 1 if TLS required, 0 if local Redis

# 4. Capture pre-activation PM2 state
pm2 show courtaccess-api | grep -E 'restarts|status|memory' > /var/www/courtaccess_repo/phase-logs/redis-pre-activation.txt
cat /var/www/courtaccess_repo/phase-logs/redis-pre-activation.txt
```

### Activation Procedure

```bash
# 1. Take snapshot
cp /var/www/courtaccess_repo/backend/.env /var/www/courtaccess_repo/backend/.env.pre-redis
pm2 save

# 2. Remove DISABLE_WORKERS flag from ecosystem config
# Edit ecosystem.config.cjs: remove the DISABLE_WORKERS line (or set to 'false')
# DO NOT remove SKIP_SCHEMA_ASSERT or CPRA_SIMULATION_MODE yet

# 3. Restart with new config
pm2 restart courtaccess-api
pm2 save

# 4. Verify deep health
sleep 10
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool
```

### Post-Activation Validation

```bash
# 1. Redis connectivity
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['components']['redis']
assert r['status'] == 'healthy', f'Redis unhealthy: {r}'
print('PASS: Redis healthy')
print(f'  Latency: {r[\"latencyMs\"]}ms')
print(f'  Details: {json.dumps(r.get(\"details\",{}), indent=2)}')
"

# 2. Queue state (workers should now be enabled)
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
q=d['components']['queues']
print(f'Queue status: {q[\"status\"]}')
print(f'Details: {json.dumps(q.get(\"details\",{}), indent=2)}')
"
# Expected: status != 'disabled', workers showing running=true

# 3. No Redis connection errors in logs
pm2 logs courtaccess-api --lines 50 --nostream 2>&1 | grep -ci 'ECONNREFUSED\|redis.*error\|redis.*fail'
# Expected: 0

# 4. No restart churn
pm2 show courtaccess-api | grep 'restarts'
# Expected: no increase from pre-activation count
```

### Observation Window
- **Duration:** 10 minutes minimum
- **Use the PM2 stability gate script from PHASE_ABC_VALIDATION_CRITERIA.md ADDENDUM 4**

### Rollback Triggers
- Redis ECONNREFUSED errors in PM2 logs
- PM2 restart count increases
- Memory spike > 100MB above baseline
- Any 5xx responses from API
- Queue retry storm (> 10 retries in 1 minute)

### Rollback Procedure

```bash
# Re-add DISABLE_WORKERS=true to ecosystem.config.cjs
# Then:
pm2 restart courtaccess-api
pm2 save
# Verify health returns to normal
curl -s https://courtaccess.net/api/health | python3 -m json.tool
```

### Pass/Fail Criteria

| Check | Pass | Fail |
|-------|------|------|
| Redis ping | `PONG` within 100ms | Timeout or error |
| Worker status | At least 1 worker running | All workers errored |
| PM2 restart count | Unchanged for 10 min | Any increase |
| Memory | < 50MB increase | > 100MB increase |
| Redis errors in logs | 0 | Any |
| API health | 200 for 10 min | Any non-200 |

---

## Gate 2: OCR Activation

### Prerequisites
- Gate 1 (Redis) passed
- Queue system stable for 10+ minutes
- No retry storms or dead-letter entries

### Pre-Activation Checks

```bash
# 1. Verify OCR dependencies
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
o=d['components']['ocr']
print(f'OCR status: {o[\"status\"]}')
print(f'Details: {json.dumps(o.get(\"details\",{}), indent=2)}')
"
# Expected: pdftoppm=installed, ImageMagick=installed, tesseract=installed

# 2. Verify temp directory writable
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
o=d['components']['ocr']
ts=o.get('details',{}).get('tempStorage',{})
print(f'Temp writable: {ts.get(\"writable\")}')
print(f'Available MB: {ts.get(\"availableMB\")}')
"
# Expected: writable=True, availableMB > 1000

# 3. Verify disk space
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
dk=d['components']['disk']
print(f'Disk: {dk[\"message\"]}')
avail=dk.get('details',{}).get('availableMB',0)
assert avail > 2000, f'Insufficient disk: {avail}MB'
print('PASS: Sufficient disk space')
"
```

### Activation Procedure

```bash
# 1. Take snapshot
pm2 save
cp /var/www/courtaccess_repo/ecosystem.config.cjs /var/www/courtaccess_repo/ecosystem.config.cjs.pre-ocr

# 2. Remove CPRA_SIMULATION_MODE flag from ecosystem config
# Edit ecosystem.config.cjs: remove CPRA_SIMULATION_MODE line

# 3. Restart
pm2 restart courtaccess-api
pm2 save

# 4. Verify health
sleep 10
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool
```

### Post-Activation Validation

```bash
# 1. Verify no OCR errors in logs
pm2 logs courtaccess-api --lines 50 --nostream 2>&1 | grep -ci 'ocr.*error\|tesseract.*fail\|pdftoppm.*fail'
# Expected: 0

# 2. Verify failure visibility shows no OCR failures
curl -s https://courtaccess.net/api/metrics/failures | python3 -c "
import json,sys
d=json.load(sys.stdin)
o=d['ocr']
print(f'OCR failed pages: {o[\"failedPages\"]}')
print(f'Temp storage failures: {o[\"tempStorageFailures\"]}')
assert o['failedPages'] == 0, 'OCR failures detected'
assert o['tempStorageFailures'] == 0, 'Temp storage failures detected'
print('PASS: No OCR failures')
"

# 3. PM2 stability check
pm2 show courtaccess-api | grep -E 'restarts|status|memory'
```

### Observation Window
- **Duration:** 10 minutes minimum
- Monitor `pm2 logs courtaccess-api --lines 0` in separate terminal

### Rollback Triggers
- OCR temp storage failures
- Disk space drops below 500MB
- PM2 restart count increases
- Memory spike > 200MB
- tesseract/pdftoppm process hangs

### Rollback Procedure

```bash
# Re-add CPRA_SIMULATION_MODE=true to ecosystem.config.cjs
pm2 restart courtaccess-api
pm2 save
```

### Pass/Fail Criteria

| Check | Pass | Fail |
|-------|------|------|
| OCR tools available | All 3 installed | Any missing |
| Temp dir writable | Yes | No |
| Disk available | > 2000MB | < 500MB |
| OCR errors | 0 | Any |
| Temp storage failures | 0 | Any |
| PM2 restart count | Unchanged 10 min | Any increase |

---

## Gate 3: Ingestion Activation

### Prerequisites
- Gate 2 (OCR) passed
- OCR system stable for 10+ minutes
- Queue system stable
- No failure visibility events

### Pre-Activation Checks

```bash
# 1. Full system health
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'Overall: {d[\"status\"]}')
for name, comp in d['components'].items():
    print(f'  {name}: {comp[\"status\"]}')
assert d['status'] == 'healthy', f'System not healthy: {d[\"status\"]}'
print('PASS: All components healthy')
"

# 2. Failure visibility clean
curl -s https://courtaccess.net/api/metrics/failures | python3 -c "
import json,sys
d=json.load(sys.stdin)
failures = d['recentFailures']
print(f'Recent failures: {len(failures)}')
if len(failures) > 0:
    for f in failures[-5:]:
        print(f'  [{f[\"severity\"]}] {f[\"category\"]}: {f[\"message\"]}')
assert len(failures) == 0, 'Active failures present'
print('PASS: No recent failures')
"

# 3. Queue depths at 0
curl -s https://courtaccess.net/api/metrics/json | python3 -c "
import json,sys
d=json.load(sys.stdin)
depth = d.get('courtaccess_queue_depth', {})
print(f'Queue depths: {json.dumps(depth, indent=2)}')
"
```

### Post-Activation Validation

```bash
# 1. Check ingestion metrics
curl -s https://courtaccess.net/api/metrics/failures | python3 -c "
import json,sys
d=json.load(sys.stdin)
i=d['ingestion']
print(f'Total runs: {i[\"totalRuns\"]}')
print(f'Failed runs: {i[\"failedRuns\"]}')
print(f'Duplicates: {i[\"totalDuplicatesDetected\"]}')
print(f'Unmatched rows: {i[\"totalUnmatchedRows\"]}')
assert i['failedRuns'] == 0, 'Ingestion failures detected'
print('PASS: No ingestion failures')
"
```

### Pass/Fail Criteria

| Check | Pass | Fail |
|-------|------|------|
| All components healthy | Yes | Any unhealthy |
| Recent failures | 0 | Any |
| Ingestion failed runs | 0 | Any |
| Unmatched rows | 0 | > 0 per run |
| PM2 restart count | Unchanged 10 min | Any increase |

---

## Gate 4: Auth Restoration

### Prerequisites
- Phase 0 (NODE_ENV fix) fully validated

### Pre-Activation Checks
See `PHASE_ABC_VALIDATION_CRITERIA.md` — Phase B Step 1 (20-route regression checklist)

### Post-Activation Validation
See `PHASE_ABC_VALIDATION_CRITERIA.md` — Phase B validation + ADDENDUM 1-6

### Pass/Fail Criteria
See `PHASE_ABC_VALIDATION_CRITERIA.md` — Go/No-Go Decision Matrix

---

## Gate 5: CSRF Restoration

### Prerequisites
- Gate 4 (Auth) passed and stable 10+ minutes

### Pre-Activation Checks
See `PHASE_ABC_VALIDATION_CRITERIA.md` — Phase B Step 2 (CSRF validation matrix)

### Post-Activation Validation
See `PHASE_ABC_VALIDATION_CRITERIA.md` — CSRF 10-scenario validation + ADDENDUM 5 (attacker tests)

### Pass/Fail Criteria
See `PHASE_ABC_VALIDATION_CRITERIA.md` — Go/No-Go Decision Matrix

---

## Evidence Collection Template

For every gate transition, collect and preserve:

```bash
#!/bin/bash
GATE=$1  # e.g. "redis", "ocr", "ingestion", "auth", "csrf"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
LOGDIR="/var/www/courtaccess_repo/phase-logs/gate-${GATE}_${TIMESTAMP}"
mkdir -p "$LOGDIR"

# Standard evidence package
curl -s https://courtaccess.net/api/health > "$LOGDIR/health.json"
curl -s https://courtaccess.net/api/health/deep > "$LOGDIR/health-deep.json"
curl -s https://courtaccess.net/api/metrics/json > "$LOGDIR/metrics.json"
curl -s https://courtaccess.net/api/metrics/failures > "$LOGDIR/failures.json"
curl -sI https://courtaccess.net > "$LOGDIR/response-headers.txt"
pm2 status > "$LOGDIR/pm2-status.txt" 2>&1
pm2 show courtaccess-api > "$LOGDIR/pm2-show.txt" 2>&1
pm2 logs courtaccess-api --lines 200 --nostream > "$LOGDIR/pm2-logs.txt" 2>&1
sudo tail -100 /var/log/nginx/error.log > "$LOGDIR/nginx-error.txt" 2>&1
sudo tail -100 /var/log/nginx/access.log > "$LOGDIR/nginx-access.txt" 2>&1

echo "Evidence collected at: $LOGDIR"
ls -la "$LOGDIR"
```
