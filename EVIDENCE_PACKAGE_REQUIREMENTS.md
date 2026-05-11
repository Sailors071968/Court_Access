# CourtAccess — Evidence Package Requirements

Standard evidence collection procedure for every operational phase transition.

---

## Required Evidence Per Phase

Every future operational phase **MUST** include the following evidence artifacts **before advancing** to the next phase.

### 1. API Health Snapshots

```bash
# Basic health
curl -s https://courtaccess.net/api/health | python3 -m json.tool > health.json

# Deep health (all dependencies)
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool > health-deep.json

# Metrics (JSON)
curl -s https://courtaccess.net/api/metrics/json | python3 -m json.tool > metrics.json

# Failure visibility
curl -s https://courtaccess.net/api/metrics/failures | python3 -m json.tool > failures.json
```

### 2. HTTP Response Headers

```bash
# Full response headers (verify security headers, CSP, HSTS, etc.)
curl -sI https://courtaccess.net > response-headers.txt

# CSP header specifically
curl -sI https://courtaccess.net | grep -i 'content-security-policy' > csp-header.txt

# Cookie flags
curl -sI -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test","password":"test"}' | grep -i 'set-cookie' > cookie-flags.txt
```

### 3. PM2 Status

```bash
# Process table
pm2 status > pm2-status.txt

# Detailed process info (restart count, memory, uptime)
pm2 show courtaccess-api > pm2-show.txt

# Environment variables (verify NODE_ENV, DOTENV_CONFIG_PATH, etc.)
pm2 env $(pm2 id courtaccess-api 2>/dev/null | tr -d '[] ') > pm2-env.txt
```

### 4. PM2 Logs

```bash
# Last 200 lines (captures startup + recent activity)
pm2 logs courtaccess-api --lines 200 --nostream > pm2-logs.txt 2>&1
```

### 5. NGINX Logs

```bash
# Error log (last 100 lines)
sudo tail -100 /var/log/nginx/error.log > nginx-error.txt

# Access log (last 100 lines)
sudo tail -100 /var/log/nginx/access.log > nginx-access.txt
```

### 6. Browser Console Output

Manual capture:
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Right-click → "Save as..." → `browser-console.txt`
4. Navigate to Network tab
5. Verify no failed requests (red entries)
6. Screenshot any errors

### 7. Validation Script Output

```bash
# Run the validation script for the current phase
# Redirect output to file
./phase-validation.sh 2>&1 | tee validation-output.txt
```

### 8. Rollback Artifacts

```bash
# List rollback files
ls -la /var/www/courtaccess_repo/backend/.env.pre-*
ls -la /var/www/courtaccess_repo/backend/src/server.ts.pre-*
ls -la /var/www/courtaccess_repo/ecosystem.config.cjs.pre-*
ls -la /etc/nginx/nginx.conf.pre-*

# Verify rollback commands are documented
cat /var/www/courtaccess_repo/phase-logs/*/rollback-commands.txt
```

---

## Standard Evidence Collection Script

Copy-paste single script that collects all evidence:

```bash
#!/bin/bash
PHASE=$1  # Pass the phase name, e.g. "phase0", "phaseA", "phaseB1", "redis-activation"

if [ -z "$PHASE" ]; then
  echo "Usage: $0 <phase-name>"
  echo "Example: $0 phaseB1"
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
LOGDIR="/var/www/courtaccess_repo/phase-logs/${PHASE}_${TIMESTAMP}"
mkdir -p "$LOGDIR"

echo "=== Evidence Collection: $PHASE ($TIMESTAMP) ==="
echo "Output directory: $LOGDIR"
echo ""

# 1. API Health
echo "[1/8] Collecting API health snapshots..."
curl -s https://courtaccess.net/api/health > "$LOGDIR/health.json" 2>&1
curl -s https://courtaccess.net/api/health/deep > "$LOGDIR/health-deep.json" 2>&1
curl -s https://courtaccess.net/api/metrics/json > "$LOGDIR/metrics.json" 2>&1
curl -s https://courtaccess.net/api/metrics/failures > "$LOGDIR/failures.json" 2>&1

# 2. Response Headers
echo "[2/8] Collecting response headers..."
curl -sI https://courtaccess.net > "$LOGDIR/response-headers.txt" 2>&1
curl -sI https://courtaccess.net | grep -i 'content-security-policy' > "$LOGDIR/csp-header.txt" 2>&1

# 3. PM2 Status
echo "[3/8] Collecting PM2 status..."
pm2 status > "$LOGDIR/pm2-status.txt" 2>&1
pm2 show courtaccess-api > "$LOGDIR/pm2-show.txt" 2>&1

# 4. PM2 Env
echo "[4/8] Collecting PM2 environment..."
pm2 env $(pm2 id courtaccess-api 2>/dev/null | tr -d '[] ') > "$LOGDIR/pm2-env.txt" 2>&1

# 5. PM2 Logs
echo "[5/8] Collecting PM2 logs..."
pm2 logs courtaccess-api --lines 200 --nostream > "$LOGDIR/pm2-logs.txt" 2>&1

# 6. NGINX Logs
echo "[6/8] Collecting NGINX logs..."
sudo tail -100 /var/log/nginx/error.log > "$LOGDIR/nginx-error.txt" 2>&1
sudo tail -100 /var/log/nginx/access.log > "$LOGDIR/nginx-access.txt" 2>&1

# 7. Quick validation checks
echo "[7/8] Running quick validation..."
{
  echo "=== Quick Validation: $(date -u) ==="

  # Health check
  HEALTH=$(curl -s https://courtaccess.net/api/health)
  ENV=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('environment','UNKNOWN'))" 2>/dev/null)
  echo "Environment: $ENV"
  [ "$ENV" = "production" ] && echo "  PASS" || echo "  FAIL: expected production"

  # API reachable
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
  echo "Health HTTP: $HTTP"
  [ "$HTTP" = "200" ] && echo "  PASS" || echo "  FAIL"

  # PM2 status
  PM2_STATUS=$(pm2 show courtaccess-api 2>/dev/null | grep 'status' | head -1 | awk '{print $NF}')
  echo "PM2 status: $PM2_STATUS"
  [ "$PM2_STATUS" = "online" ] && echo "  PASS" || echo "  FAIL"

  # Restart count
  RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
  echo "PM2 restarts: $RESTARTS"

} > "$LOGDIR/quick-validation.txt" 2>&1
cat "$LOGDIR/quick-validation.txt"

# 8. Rollback artifacts
echo "[8/8] Checking rollback artifacts..."
{
  echo "=== Rollback Artifacts ==="
  ls -la /var/www/courtaccess_repo/backend/.env.pre-* 2>/dev/null || echo "No .env backups found"
  ls -la /var/www/courtaccess_repo/backend/src/server.ts.pre-* 2>/dev/null || echo "No server.ts backups found"
  ls -la /var/www/courtaccess_repo/ecosystem.config.cjs.pre-* 2>/dev/null || echo "No ecosystem backups found"
} > "$LOGDIR/rollback-artifacts.txt" 2>&1

echo ""
echo "=== Evidence collection complete ==="
echo "Directory: $LOGDIR"
echo "Files:"
ls -la "$LOGDIR"
echo ""
echo "To review: cat $LOGDIR/<filename>"
```

---

## Evidence Review Checklist

Before advancing to the next phase, verify ALL items:

| # | Item | How to verify | Pass |
|---|------|---------------|------|
| 1 | `environment` = `production` | `health.json` | Yes/No |
| 2 | Health status OK | `health.json` → `status: "ok"` | Yes/No |
| 3 | Deep health — no `unhealthy` components | `health-deep.json` | Yes/No |
| 4 | No critical failures | `failures.json` → `recentFailures` empty | Yes/No |
| 5 | CSP header strict (no `unsafe-eval`) | `csp-header.txt` | Yes/No |
| 6 | Security headers present | `response-headers.txt` | Yes/No |
| 7 | PM2 status = `online` | `pm2-status.txt` | Yes/No |
| 8 | PM2 restart count stable | `pm2-show.txt` | Yes/No |
| 9 | No errors in PM2 logs | `pm2-logs.txt` | Yes/No |
| 10 | No NGINX errors | `nginx-error.txt` | Yes/No |
| 11 | Browser console clean | `browser-console.txt` | Yes/No |
| 12 | Rollback artifacts present | `rollback-artifacts.txt` | Yes/No |
| 13 | Validation script passes | `validation-output.txt` | Yes/No |

**All 13 items must be YES before proceeding.**

---

## Log Retention Policy

- Keep all phase-logs for minimum **30 days**
- Archive to off-host storage monthly
- Never delete logs from a phase that hasn't been superseded by a stable successor
- Directory structure:

```
/var/www/courtaccess_repo/phase-logs/
├── phase0_20260510_030000/
├── phaseA_20260510_040000/
├── phaseB1_20260510_050000/
├── phaseB2_20260510_060000/
├── phaseC_20260510_070000/
├── gate-redis_20260511_080000/
├── gate-ocr_20260511_090000/
└── gate-ingestion_20260511_100000/
```
