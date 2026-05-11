# CourtAccess — Phase 0: NODE_ENV Security Remediation

**Purpose:** Fix the critical production security gap where NODE_ENV=development causes permissive CSP, insecure cookies, wrong CORS origins, and verbose Prisma logging.

**Risk level:** LOW — this changes runtime behavior but does NOT modify route logic, auth, or data.

**Downtime:** Zero — PM2 restart is <3 seconds.

---

## Pre-Deployment Snapshot

Run these BEFORE making any changes:

```bash
# 1. Backup .env
cp /var/www/courtaccess_repo/backend/.env \
   /var/www/courtaccess_repo/backend/.env.pre-phase0

# 2. Backup server.ts
cp /var/www/courtaccess_repo/backend/src/server.ts \
   /var/www/courtaccess_repo/backend/src/server.ts.pre-phase0

# 3. Backup ecosystem config
cp /var/www/courtaccess_repo/ecosystem.config.cjs \
   /var/www/courtaccess_repo/ecosystem.config.cjs.pre-phase0

# 4. Backup nginx
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-phase0

# 5. Export PM2 state
pm2 save
pm2 prettylist > /var/www/courtaccess_repo/pm2-pre-phase0.json

# 6. Record current PM2 launch command for rollback
pm2 show courtaccess-api | grep -E 'exec_mode|script|args|cwd|interpreter' \
  > /var/www/courtaccess_repo/pm2-pre-phase0-launch.txt
cat /var/www/courtaccess_repo/pm2-pre-phase0-launch.txt

# 7. Capture current health response as baseline
curl -s https://courtaccess.net/api/health > /var/www/courtaccess_repo/health-pre-phase0.json
cat /var/www/courtaccess_repo/health-pre-phase0.json
```

**Expected baseline health response:**
```json
{"status":"ok","timestamp":"...","version":"1.1.0","service":"court-access-backend","environment":"development"}
```

---

## Deployment Steps

### Step 1: Pull latest code

```bash
cd /var/www/courtaccess_repo
git fetch origin
git merge origin/devin/1778357361-courtaccess-recovery-stabilization
```

**Expected:** Merge succeeds. New/modified files:
- `backend/src/server.ts` — dotenv import added
- `backend/package.json` — dotenv dependency added
- `ecosystem.config.cjs` — updated env block
- `STAGE2_PRE_EXECUTION_ANALYSIS.md` — analysis document

### Step 2: Install dotenv dependency

```bash
cd /var/www/courtaccess_repo/backend
npm install
```

**Expected:** `dotenv` appears in `node_modules/`. Verify:

```bash
node -e "require('dotenv'); console.log('dotenv OK')"
```

**Expected:** `dotenv OK`

### Step 3: Verify .env exists and has NODE_ENV=production

```bash
grep '^NODE_ENV' /var/www/courtaccess_repo/backend/.env
```

**Expected:** `NODE_ENV=production`

**If NODE_ENV is missing or wrong**, add it now:
```bash
# Only if NODE_ENV line is missing:
echo 'NODE_ENV=production' >> /var/www/courtaccess_repo/backend/.env
```

### Step 4: Verify .env has required core variables

```bash
for var in NODE_ENV PORT HOST DATABASE_URL FRONTEND_URL; do
  val=$(grep "^${var}=" /var/www/courtaccess_repo/backend/.env | head -1)
  if [ -n "$val" ]; then
    # Mask secrets, show only var name + first 10 chars
    echo "OK: ${var}=$(echo "$val" | cut -d= -f2 | cut -c1-10)..."
  else
    echo "MISSING: $var"
  fi
done
```

**Expected:** All 5 show `OK:`.

### Step 5: Create log directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown $(whoami):$(whoami) /var/log/pm2
```

### Step 6: Restart PM2 via ecosystem config

```bash
# Stop current process
pm2 delete courtaccess-api

# Start via ecosystem config (picks up NODE_ENV=production + DOTENV_CONFIG_PATH)
cd /var/www/courtaccess_repo
pm2 start ecosystem.config.cjs --only courtaccess-api

# Wait for startup
sleep 5

# Check it's online
pm2 status
```

**Expected:** `courtaccess-api` shows `online` status with 0 restarts.

### Step 7: Check PM2 logs for clean startup

```bash
pm2 logs courtaccess-api --lines 30 --nostream
```

**Expected logs should include:**
- `[Server] CourtAccess API running on http://0.0.0.0:3001`
- `[Server] Registering authentication routes...`
- `[Server] Redis memory monitor disabled (DISABLE_WORKERS=true)`

**Expected logs should NOT include:**
- `WARNING: COOKIE_SECRET not set in production!`
- `Error: connect ECONNREFUSED` (Redis connection errors)
- Any uncaught exceptions or crashes

---

## Validation Checkpoint A: Environment Mode

```bash
curl -s https://courtaccess.net/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
env = d.get('environment', 'MISSING')
print(f'environment: {env}')
if env == 'production':
    print('CHECKPOINT A: PASS')
else:
    print(f'CHECKPOINT A: FAIL — expected production, got {env}')
    print('Troubleshoot: Check pm2 env and .env file')
    sys.exit(1)
"
```

**Expected:** `CHECKPOINT A: PASS`

**If FAIL:** Check that .env is being loaded:
```bash
# Verify PM2 has NODE_ENV set
pm2 env courtaccess-api | grep NODE_ENV
# Should show: NODE_ENV: production

# Verify dotenv path resolution
pm2 env courtaccess-api | grep DOTENV_CONFIG_PATH
# Should show the path to backend/.env
```

---

## Validation Checkpoint B: Production Security Behavior

### B1. CSP Header — No unsafe-inline in script-src

```bash
CSP=$(curl -sI https://courtaccess.net/api/health | grep -i 'content-security-policy' | cut -d: -f2-)
echo "CSP Header:"
echo "$CSP"
echo ""

# Check script-src does NOT contain unsafe-inline or unsafe-eval
echo "$CSP" | grep -q "unsafe-inline" && echo "B1a: FAIL — unsafe-inline found in CSP" || echo "B1a: PASS — no unsafe-inline in CSP"
echo "$CSP" | grep -q "unsafe-eval" && echo "B1b: FAIL — unsafe-eval found in CSP" || echo "B1b: PASS — no unsafe-eval in CSP"

# Check connect-src includes courtaccess.net
echo "$CSP" | grep -q "courtaccess.net" && echo "B1c: PASS — courtaccess.net in connect-src" || echo "B1c: FAIL — courtaccess.net missing from connect-src"

# Check connect-src does NOT include localhost
echo "$CSP" | grep -q "localhost" && echo "B1d: FAIL — localhost still in CSP connect-src" || echo "B1d: PASS — no localhost in CSP"
```

**Expected:**
```
B1a: PASS — no unsafe-inline in CSP
B1b: PASS — no unsafe-eval in CSP
B1c: PASS — courtaccess.net in connect-src
B1d: PASS — no localhost in CSP
```

**Note:** `style-src` still allows `unsafe-inline` — this is intentional for CSS-in-JS (React).

### B2. Cookie Secure Flag

```bash
# The CSRF endpoint sets cookies — check their flags
COOKIE_HEADERS=$(curl -sI https://courtaccess.net/api/auth/csrf-token)
echo "Set-Cookie headers:"
echo "$COOKIE_HEADERS" | grep -i 'set-cookie'
echo ""

# Check _session cookie
echo "$COOKIE_HEADERS" | grep -i 'set-cookie.*_session' | grep -qi 'secure' && \
  echo "B2a: PASS — _session cookie has Secure flag" || \
  echo "B2a: FAIL — _session cookie missing Secure flag"

echo "$COOKIE_HEADERS" | grep -i 'set-cookie.*_session' | grep -qi 'httponly' && \
  echo "B2b: PASS — _session cookie has HttpOnly flag" || \
  echo "B2b: FAIL — _session cookie missing HttpOnly flag"

echo "$COOKIE_HEADERS" | grep -i 'set-cookie.*_session' | grep -qi 'samesite=strict' && \
  echo "B2c: PASS — _session cookie has SameSite=Strict" || \
  echo "B2c: FAIL — _session cookie missing SameSite=Strict"

# Check _csrf cookie
echo "$COOKIE_HEADERS" | grep -i 'set-cookie.*_csrf' | grep -qi 'secure' && \
  echo "B2d: PASS — _csrf cookie has Secure flag" || \
  echo "B2d: FAIL — _csrf cookie missing Secure flag"
```

**Expected:** All B2a-B2d PASS.

### B3. CORS — Localhost origins rejected

```bash
# Production origin should be accepted
PROD_CORS=$(curl -sI -H "Origin: https://courtaccess.net" https://courtaccess.net/api/health | grep -i 'access-control-allow-origin')
echo "Production origin: $PROD_CORS"
echo "$PROD_CORS" | grep -q "courtaccess.net" && echo "B3a: PASS — production origin accepted" || echo "B3a: FAIL — production origin rejected"

# Localhost origin should be rejected (no ACAO header)
LOCAL_CORS=$(curl -sI -H "Origin: http://localhost:5173" https://courtaccess.net/api/health | grep -i 'access-control-allow-origin')
echo "Localhost origin: $LOCAL_CORS"
[ -z "$LOCAL_CORS" ] && echo "B3b: PASS — localhost origin rejected (no ACAO header)" || echo "B3b: FAIL — localhost origin accepted: $LOCAL_CORS"
```

**Expected:**
```
B3a: PASS — production origin accepted
B3b: PASS — localhost origin rejected (no ACAO header)
```

### B4. Other security headers present

```bash
HEADERS=$(curl -sI https://courtaccess.net/api/health)

echo "$HEADERS" | grep -qi 'x-frame-options.*deny' && echo "B4a: PASS — X-Frame-Options: DENY" || echo "B4a: FAIL"
echo "$HEADERS" | grep -qi 'x-content-type-options.*nosniff' && echo "B4b: PASS — X-Content-Type-Options: nosniff" || echo "B4b: FAIL"
echo "$HEADERS" | grep -qi 'strict-transport-security' && echo "B4c: PASS — HSTS present" || echo "B4c: FAIL"
echo "$HEADERS" | grep -qi 'referrer-policy' && echo "B4d: PASS — Referrer-Policy present" || echo "B4d: FAIL"
echo "$HEADERS" | grep -qi 'x-powered-by' && echo "B4e: FAIL — X-Powered-By still present (information leak)" || echo "B4e: PASS — X-Powered-By removed"
```

**Expected:** All PASS.

---

## Validation Checkpoint C: PM2 Configuration

### C1. Ecosystem config loaded correctly

```bash
pm2 show courtaccess-api | head -20
```

**Expected:** Shows `courtaccess-api` with:
- `exec_mode: fork_mode`
- `script: npx`
- `args: tsx backend/src/server.ts`

### C2. DOTENV_CONFIG_PATH resolved correctly

```bash
pm2 env courtaccess-api | grep -E 'NODE_ENV|PORT|HOST|DOTENV_CONFIG_PATH|DISABLE_WORKERS|SKIP_SCHEMA_ASSERT'
```

**Expected:**
```
NODE_ENV: production
PORT: 3001
HOST: 0.0.0.0
DOTENV_CONFIG_PATH: /var/www/courtaccess_repo/backend/.env
DISABLE_WORKERS: true
SKIP_SCHEMA_ASSERT: true
```

### C3. PM2 env vars match expected production values

```bash
# Verify PM2 process is using production env
pm2 show courtaccess-api | grep -E 'status|restarts|uptime|memory'
```

**Expected:**
- `status: online`
- `restarts: 0` (or very low)
- `uptime: > 30s` (stable, not crash-looping)
- `memory: < 512M`

### C4. Restart behavior works properly

```bash
# Test restart
pm2 restart courtaccess-api
sleep 3

# Verify it came back online
pm2 status | grep courtaccess-api

# Verify health still responds
curl -s https://courtaccess.net/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['status'] == 'ok', f'Health check failed: {d}'
assert d['environment'] == 'production', f'NODE_ENV reset: {d[\"environment\"]}'
print('C4: PASS — restart successful, environment still production')
"
```

**Expected:** `C4: PASS`

---

## Validation Checkpoint D: Production Stability

### D1. Frontend still loads

```bash
curl -s https://courtaccess.net | head -5
```

**Expected:** `<!doctype html>` with `<div id="root">` — React SPA loads.

### D2. Auth routes still reachable

```bash
# Login endpoint (should return 400 for empty body, not 500 or 404)
echo -n "Login route:    " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}' && echo ""

# Register endpoint
echo -n "Register route: " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/register -H 'Content-Type: application/json' -d '{}' && echo ""

# CSRF token endpoint
echo -n "CSRF endpoint:  " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/csrf-token && echo ""

# Debug check
echo -n "Debug check:    " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/debug-check && echo ""
```

**Expected:**
```
Login route:    400
Register route: 400
CSRF endpoint:  200
Debug check:    200
```

### D3. No increase in PM2 restart count

```bash
pm2 show courtaccess-api | grep restarts
```

**Expected:** `restarts: 0` (after the intentional restart in C4) or `restarts: 1` (from the test restart). NOT climbing.

Wait 30 seconds and check again:
```bash
sleep 30
pm2 show courtaccess-api | grep restarts
```

**Expected:** Same number — not increasing (no crash loop).

### D4. No Prisma initialization failures

```bash
pm2 logs courtaccess-api --lines 50 --nostream | grep -iE 'prisma|database|error|exception'
```

**Expected:** No Prisma errors. May see normal `[Server] Registering...` lines. Should NOT see:
- `PrismaClientInitializationError`
- `Can't reach database server`
- `Schema engine error`

### D5. NGINX proxying remains healthy

```bash
# API through NGINX
curl -s https://courtaccess.net/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'API: {d[\"status\"]} ({d[\"environment\"]})')"

# Frontend through NGINX
curl -s -o /dev/null -w "Frontend: HTTP %{http_code}\n" https://courtaccess.net

# NGINX status
sudo nginx -t 2>&1
sudo systemctl is-active nginx
```

**Expected:**
```
API: ok (production)
Frontend: HTTP 200
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
active
```

---

## Validation Checkpoint E: Rollback Verification

### E1. Confirm rollback snapshot integrity

```bash
# Verify all backup files exist
echo "Checking rollback files..."
[ -f /var/www/courtaccess_repo/backend/.env.pre-phase0 ] && echo "OK: .env backup" || echo "MISSING: .env backup"
[ -f /var/www/courtaccess_repo/backend/src/server.ts.pre-phase0 ] && echo "OK: server.ts backup" || echo "MISSING: server.ts backup"
[ -f /var/www/courtaccess_repo/ecosystem.config.cjs.pre-phase0 ] && echo "OK: ecosystem.config.cjs backup" || echo "MISSING: ecosystem.config.cjs backup"
[ -f /etc/nginx/nginx.conf.pre-phase0 ] && echo "OK: nginx.conf backup" || echo "MISSING: nginx.conf backup"
[ -f /var/www/courtaccess_repo/pm2-pre-phase0.json ] && echo "OK: PM2 state backup" || echo "MISSING: PM2 state backup"
[ -f /var/www/courtaccess_repo/health-pre-phase0.json ] && echo "OK: health baseline" || echo "MISSING: health baseline"
```

**Expected:** All show `OK`.

### E2. Confirm rollback commands are correct

The following commands will revert Phase 0 completely:

```bash
# === PHASE 0 FULL ROLLBACK ===

# 1. Restore original server.ts (no dotenv import)
cp /var/www/courtaccess_repo/backend/src/server.ts.pre-phase0 \
   /var/www/courtaccess_repo/backend/src/server.ts

# 2. Restore original ecosystem config
cp /var/www/courtaccess_repo/ecosystem.config.cjs.pre-phase0 \
   /var/www/courtaccess_repo/ecosystem.config.cjs

# 3. Restore .env
cp /var/www/courtaccess_repo/backend/.env.pre-phase0 \
   /var/www/courtaccess_repo/backend/.env

# 4. Restart PM2 with original command
pm2 delete courtaccess-api

# Use the launch command documented in pm2-pre-phase0-launch.txt
# Typically something like:
# PORT=3001 DISABLE_WORKERS=true SKIP_SCHEMA_ASSERT=true CPRA_SIMULATION_MODE=true \
#   pm2 start npx --name courtaccess-api --cwd /var/www/courtaccess_repo \
#   -- tsx backend/src/server.ts

pm2 save

# 5. Verify rollback
curl -s https://courtaccess.net/api/health
# Should return "environment":"development" (back to pre-Phase 0 state)
```

### E3. Previous PM2 launch command documented

```bash
cat /var/www/courtaccess_repo/pm2-pre-phase0-launch.txt
```

This file was created in the Pre-Deployment Snapshot step and contains the exact PM2 configuration used before Phase 0.

---

## Complete Validation Script

Run this all-in-one script after deployment to check every checkpoint:

```bash
#!/bin/bash
echo "=============================================="
echo "Phase 0 — Complete Validation"
echo "=============================================="
echo ""

PASS=0
FAIL=0

check() {
  if [ $1 -eq 0 ]; then
    echo "  PASS: $2"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $2"
    FAIL=$((FAIL + 1))
  fi
}

# A: Environment
echo "--- A: Environment Mode ---"
ENV=$(curl -sf https://courtaccess.net/api/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('environment',''))" 2>/dev/null)
[ "$ENV" = "production" ]; check $? "NODE_ENV = production (got: $ENV)"

# B: Security Headers
echo ""
echo "--- B: Production Security ---"
HDR=$(curl -sI https://courtaccess.net/api/health)
CSP=$(echo "$HDR" | grep -i content-security-policy | head -1)

echo "$CSP" | grep -qv "unsafe-eval"; check $? "CSP: no unsafe-eval"
echo "$CSP" | grep -q "courtaccess.net"; check $? "CSP: courtaccess.net in connect-src"
echo "$CSP" | grep -qv "localhost"; check $? "CSP: no localhost in CSP"

CSRF_HDR=$(curl -sI https://courtaccess.net/api/auth/csrf-token)
echo "$CSRF_HDR" | grep -i 'set-cookie.*_session' | grep -qi 'secure'; check $? "Cookie: _session has Secure flag"
echo "$CSRF_HDR" | grep -i 'set-cookie.*_session' | grep -qi 'httponly'; check $? "Cookie: _session has HttpOnly flag"
echo "$CSRF_HDR" | grep -i 'set-cookie.*_session' | grep -qi 'samesite=strict'; check $? "Cookie: _session has SameSite=Strict"

LOCAL_CORS=$(curl -sI -H "Origin: http://localhost:5173" https://courtaccess.net/api/health | grep -i 'access-control-allow-origin')
[ -z "$LOCAL_CORS" ]; check $? "CORS: localhost origin rejected"

PROD_CORS=$(curl -sI -H "Origin: https://courtaccess.net" https://courtaccess.net/api/health | grep -i 'access-control-allow-origin' | grep -q 'courtaccess.net'; echo $?)
[ "$PROD_CORS" = "0" ]; check $? "CORS: production origin accepted"

echo "$HDR" | grep -qi 'x-frame-options.*deny'; check $? "Header: X-Frame-Options DENY"
echo "$HDR" | grep -qi 'strict-transport-security'; check $? "Header: HSTS present"
echo "$HDR" | grep -qi 'x-powered-by'; XPOW=$?; [ $XPOW -ne 0 ]; check $? "Header: X-Powered-By removed"

# C: PM2
echo ""
echo "--- C: PM2 Configuration ---"
PM2_ENV=$(pm2 env courtaccess-api 2>/dev/null | grep 'NODE_ENV' | head -1)
echo "$PM2_ENV" | grep -q "production"; check $? "PM2 NODE_ENV = production"

PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; apps=json.load(sys.stdin); print(apps[0]['pm2_env']['status'])" 2>/dev/null)
[ "$PM2_STATUS" = "online" ]; check $? "PM2 process online (status: $PM2_STATUS)"

# D: Stability
echo ""
echo "--- D: Production Stability ---"
curl -sf https://courtaccess.net > /dev/null 2>&1; check $? "Frontend loads"
curl -sf -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}' > /dev/null 2>&1; RC=$?; [ $RC -eq 0 -o $RC -eq 22 ]; check $? "Auth routes reachable"
curl -sf https://courtaccess.net/api/auth/csrf-token > /dev/null 2>&1; check $? "CSRF endpoint responsive"
sudo nginx -t > /dev/null 2>&1; check $? "NGINX config valid"

# E: Rollback
echo ""
echo "--- E: Rollback Files ---"
[ -f /var/www/courtaccess_repo/backend/.env.pre-phase0 ]; check $? ".env backup exists"
[ -f /var/www/courtaccess_repo/backend/src/server.ts.pre-phase0 ]; check $? "server.ts backup exists"
[ -f /var/www/courtaccess_repo/ecosystem.config.cjs.pre-phase0 ]; check $? "ecosystem.config.cjs backup exists"

echo ""
echo "=============================================="
echo "Results: $PASS passed, $FAIL failed"
echo "=============================================="

if [ $FAIL -eq 0 ]; then
  echo "ALL CHECKS PASSED — Phase 0 complete."
  echo "Safe to proceed to Phase A (Secret Rotation)."
else
  echo "FAILURES DETECTED — DO NOT proceed to Phase A."
  echo "Investigate failures above, or rollback."
fi
```

---

## Post-Phase 0 State

After successful validation, the system state is:

| Component | State |
|-----------|-------|
| NODE_ENV | `production` |
| CSP | Strict (no unsafe-inline in script-src, no localhost) |
| Cookies | `Secure`, `HttpOnly`, `SameSite=Strict` |
| CORS | Only `courtaccess.net`, `www.courtaccess.net`, `beta.courtaccess.net` |
| Auth hook | Still **commented out** (Phase B) |
| CSRF hook | Still **commented out** (Phase B) |
| Redis | Still **disabled** (Phase D) |
| Workers | Still **disabled** (Phase D) |
| Secrets | Still current values (Phase A rotates them) |

**Next:** Phase A — Secret Rotation (only after ALL Phase 0 checkpoints pass).
