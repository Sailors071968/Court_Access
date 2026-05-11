# CourtAccess — Stage 2+ Operations Procedure

**Baseline:** Fastify backend on port 3001 via PM2 (`courtaccess-api`), NGINX serving static frontend, PostgreSQL + Prisma operational, Redis/workers disabled.

---

## 1. Authentication & Core API Verification

### 1A. JWT Flow Verification

```bash
# Step 1: Debug check (no auth required — confirms bcrypt + server version)
curl -s https://courtaccess.net/api/auth/debug-check | python3 -m json.tool
# Expected: {"authVersion":"PR74-bcrypt","bcryptLoaded":true,...}

# Step 2: Register a test user
curl -s -X POST https://courtaccess.net/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Attorney","email":"test-stage2@courtaccess.net","password":"Stage2Test!2026","role":"attorney"}' \
  | python3 -m json.tool
# Expected: {"accessToken":"eyJ...","refreshToken":"eyJ...","user":{...}}
# Save the tokens:
export ACCESS_TOKEN="<accessToken from response>"
export REFRESH_TOKEN="<refreshToken from response>"

# Step 3: Verify access token works
curl -s https://courtaccess.net/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
# Expected: {"user":{"userId":"...","email":"test-stage2@courtaccess.net","role":"attorney",...}}

# Step 4: Login with same credentials
curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}' \
  | python3 -m json.tool
# Expected: new accessToken + refreshToken + user object
```

### 1B. Refresh Token Flow

```bash
# Use the refresh token from registration/login
curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  | python3 -m json.tool
# Expected: new accessToken + new refreshToken (old one is now revoked)
# Update your tokens:
export ACCESS_TOKEN="<new accessToken>"
export REFRESH_TOKEN="<new refreshToken>"

# Verify old refresh token is revoked
curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<OLD_REFRESH_TOKEN>"}' \
  | python3 -m json.tool
# Expected: 401 {"error":"Invalid or expired refresh token"}
```

### 1C. CSRF Token Validation

```bash
# Get CSRF token
curl -s https://courtaccess.net/api/auth/csrf-token \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
# Expected: {"csrfToken":"<64-char-hex>"}
```

**Note:** CSRF enforcement hook is currently commented out in `server.ts` (line 97). This is intentional for Stage 2 — enable it in a later stage after confirming frontend properly sends CSRF tokens with state-changing requests.

### 1D. Logout

```bash
curl -s -X POST https://courtaccess.net/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  | python3 -m json.tool
# Expected: {"message":"Logged out successfully"}

# Verify token is invalidated
curl -s https://courtaccess.net/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Note: access token is stateless (JWT) — it will still work until it expires (15min).
# The refresh token is revoked though, so no new access tokens can be obtained.
```

### 1E. Protected Route Verification

```bash
# Login fresh to get valid tokens
LOGIN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}')
export ACCESS_TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Test without auth (should get 401 when auth hook is enabled)
# NOTE: Auth hook is currently commented out — these will succeed without auth.
# This is expected for Stage 2. Enable auth hook in Stage 3.
curl -s -o /dev/null -w "HTTP %{http_code}" https://courtaccess.net/api/cases
echo ""

# Test with auth
curl -s -o /dev/null -w "HTTP %{http_code}" https://courtaccess.net/api/cases \
  -H "Authorization: Bearer $ACCESS_TOKEN"
echo ""
```

### 1F. Security Header Validation

```bash
# Check response headers
curl -sI https://courtaccess.net/api/health | grep -iE 'x-frame|x-content|strict-transport|referrer|content-security|x-xss'
# Expected headers:
#   X-Frame-Options: DENY
#   X-Content-Type-Options: nosniff
#   X-XSS-Protection: 1; mode=block
#   Referrer-Policy: strict-origin-when-cross-origin
#   Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
#   Content-Security-Policy: default-src 'self'; script-src 'self'; ...

# Verify no X-Powered-By header
curl -sI https://courtaccess.net/api/health | grep -i powered
# Expected: no output (header removed)

# Verify API responses have cache-control
curl -sI https://courtaccess.net/api/health | grep -i cache-control
# Expected: Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
```

### 1G. Cookie Security Verification

```bash
# Login and check Set-Cookie headers
curl -sI -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}' \
  | grep -i set-cookie
# Expected: Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh
# Key flags: HttpOnly (no JS access), Secure (HTTPS only), SameSite=Strict
```

---

## 2. Environment Hardening

### 2A. Generate Production-Grade Secrets

```bash
# On the server — generate secrets
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "COOKIE_SECRET=$(openssl rand -hex 32)"
```

Copy the output values into `/var/www/courtaccess_repo/backend/.env`, replacing any temporary values.

### 2B. Validate .env Loading

```bash
# Check .env exists and has required vars
cat /var/www/courtaccess_repo/backend/.env | grep -E '^(NODE_ENV|PORT|HOST|DATABASE_URL|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET|FRONTEND_URL|DISABLE_WORKERS|SKIP_SCHEMA_ASSERT)' | sed 's/=.*/=***/'
# Expected: all 10 vars present (values masked)
```

### 2C. Verify Production NODE_ENV

```bash
# Check via API
curl -s https://courtaccess.net/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('NODE_ENV:', d.get('environment'))"
# Expected: NODE_ENV: production

# If it says "development", update .env:
#   NODE_ENV=production
# Then restart: pm2 restart courtaccess-api
```

### 2D. Secret Rotation Warning

If JWT_SECRET was previously a random fallback (no env var set), all existing tokens become invalid on restart. This is actually desirable — it forces re-login. But be aware that:
- Active user sessions will be terminated
- Refresh tokens in the DB will fail validation
- Users need to log in again

**Best time to rotate:** During a maintenance window or immediately after confirming auth works.

```bash
# After updating secrets in .env:
pm2 restart courtaccess-api
pm2 logs courtaccess-api --lines 10
# Check for: WARNING: COOKIE_SECRET not set — if you see this, .env isn't loading
```

---

## 3. Core API Smoke-Test Checklist

Run all tests after auth verification passes.

```bash
# Login and export token
LOGIN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}')
export TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
AUTH="-H 'Authorization: Bearer $TOKEN'"
```

### 3A. Health & Observability Routes

```bash
# Basic health
curl -s https://courtaccess.net/api/health | python3 -m json.tool
# Expected: {"status":"ok","version":"1.1.0",...}

# Deep health (checks Postgres, Redis, Neo4j, memory)
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool
# Expected: postgres=healthy, redis=unhealthy (disabled), neo4j=unhealthy (not configured), memory=healthy

# Prometheus metrics
curl -s https://courtaccess.net/api/metrics | head -10
# Expected: # HELP ... / # TYPE ... lines

# JSON metrics
curl -s https://courtaccess.net/api/metrics/json | python3 -m json.tool
```

### 3B. Auth Routes

```bash
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/auth/debug-check && echo "debug-check"
curl -s -o /dev/null -w "%{http_code} " -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}' && echo "login (empty)"
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/auth/me -H "Authorization: Bearer $TOKEN" && echo "me"
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/auth/csrf-token -H "Authorization: Bearer $TOKEN" && echo "csrf-token"
# Expected: 200 debug-check, 400 login (empty), 200 me, 200 csrf-token
```

### 3C. Case Management Routes

```bash
# List cases
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/cases -H "Authorization: Bearer $TOKEN" && echo "GET /api/cases"

# Create case
curl -s -o /dev/null -w "%{http_code} " -X POST https://courtaccess.net/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Stage 2 Smoke Test","description":"Automated verification"}' && echo "POST /api/cases"
# Expected: 200 or 201
```

### 3D. Evidence Routes

```bash
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/evidence/upload -H "Authorization: Bearer $TOKEN" && echo "GET /api/evidence/upload"
# Expected: 404 or 405 (GET not supported on upload endpoint — this is correct)
# Actual uploads require multipart + S3/R2 credentials (Stage 4)
```

### 3E. Admin Routes

```bash
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/admin/stats -H "Authorization: Bearer $TOKEN" && echo "admin/stats"
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/admin/users -H "Authorization: Bearer $TOKEN" && echo "admin/users"
# Expected: 200 (if attorney role has access) or 403 (if admin-only)
```

### 3F. Analysis Routes (Database-only, no Redis needed)

```bash
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/compliance/dashboard -H "Authorization: Bearer $TOKEN" && echo "compliance"
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/policy-pipeline/stats && echo "pipeline stats"
curl -s -o /dev/null -w "%{http_code} " https://courtaccess.net/api/operations/dashboard && echo "operations"
# Expected: 200 for each
```

### 3G. Prisma DB Connectivity Deep Check

```bash
# Via deep health endpoint
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import sys, json
d = json.load(sys.stdin)
pg = d['components']['postgres']
print(f\"Postgres: {pg['status']} ({pg['latencyMs']}ms)\")
"
# Expected: Postgres: healthy (< 50ms)

# Via PM2 logs
pm2 logs courtaccess-api --lines 5 | grep -i 'prisma\|postgres\|database'
```

### 3H. Full Smoke Test Script

```bash
#!/bin/bash
echo "=== CourtAccess Stage 2 Smoke Test ==="
echo ""

# Health
echo -n "Health:           " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health && echo ""
echo -n "Deep Health:      " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health/deep && echo ""
echo -n "Metrics:          " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/metrics && echo ""

# Auth
echo -n "Debug Check:      " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/debug-check && echo ""
echo -n "Login (bad):      " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}' && echo ""
echo -n "Register (dup):   " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/register -H 'Content-Type: application/json' -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}' && echo ""

# Pipeline
echo -n "Pipeline Stats:   " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/policy-pipeline/stats && echo ""
echo -n "Operations:       " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/operations/dashboard && echo ""

echo ""
echo "Expected: 200 for health/debug/metrics/pipeline/operations"
echo "Expected: 400 for login (bad), 409 for register (dup)"
```

---

## 4. Safe Redis/BullMQ Restoration Plan

### 4A. Prerequisites

```bash
# Verify Redis is installed and running
redis-cli ping
# Expected: PONG

# If not installed:
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Check Redis version and TLS support
redis-cli info server | grep -E 'redis_version|tcp_port|tls_port'
```

### 4B. Redis TLS Validation

If your Redis uses TLS (e.g., AWS ElastiCache, Upstash):

```bash
# Test TLS connection
redis-cli --tls -u rediss://your-redis-host:6380 PING
# Expected: PONG

# The backend auto-detects TLS from the URL scheme:
#   redis://  → non-TLS
#   rediss:// → TLS (ioredis handles this automatically)
```

### 4C. Staged Worker Re-enable

**Step 1: Update .env — enable Redis but keep workers disabled**
```bash
# Add/update in /var/www/courtaccess_repo/backend/.env:
REDIS_URL=redis://localhost:6379    # or your Redis URL
DISABLE_WORKERS=true                # keep disabled for now

# Restart
pm2 restart courtaccess-api
pm2 logs courtaccess-api --lines 20
```

**Step 2: Verify Redis connectivity via deep health**
```bash
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['components']['redis']
print(f\"Redis: {r['status']} ({r['latencyMs']}ms) {r.get('message','')}\")"
# Expected: Redis: healthy (< 10ms)
```

**Step 3: Enable workers**
```bash
# Remove DISABLE_WORKERS from .env:
sed -i '/DISABLE_WORKERS/d' /var/www/courtaccess_repo/backend/.env

# Restart
pm2 restart courtaccess-api
pm2 logs courtaccess-api --lines 30
# Expected: [PipelineWorkers] Starting 5 ACU-enforced pipeline workers...
# Expected: [PipelineWorkers] All pipeline workers started with backpressure monitoring
```

### 4D. Queue Health Checks

```bash
# Check queue status via admin API
curl -s https://courtaccess.net/api/admin/queues \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Direct Redis check
redis-cli keys 'bull:*' | head -20

# Check worker processes
pm2 logs courtaccess-api --lines 10 | grep -i 'worker\|queue\|bull'
```

### 4E. Worker Rollback

```bash
# If workers cause issues, re-disable:
echo 'DISABLE_WORKERS=true' >> /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api

# Verify
pm2 logs courtaccess-api --lines 10
# Expected: [PipelineWorkers] Workers disabled via DISABLE_WORKERS env var
```

---

## 5. OCR Ingestion Recovery Plan

### 5A. System Dependencies Validation

```bash
# Tesseract.js uses WASM — no system binary needed
# But these system tools are needed for PDF processing:

# Check pdftoppm (from poppler-utils)
which pdftoppm && pdftoppm -v 2>&1 | head -1
# If missing: sudo apt install -y poppler-utils

# Check ImageMagick
which convert && convert --version | head -1
# If missing: sudo apt install -y imagemagick

# Check available disk space for temp files
df -h /tmp
# Need at least 10GB free for large PDF processing
```

### 5B. Tesseract.js Validation

```bash
# Tesseract.js downloads language data on first run
# Verify the npm package is installed:
cd /var/www/courtaccess_repo/backend
node -e "const t = require('tesseract.js'); console.log('tesseract.js version:', t.version || 'loaded')"
# Expected: loaded (no errors)
```

### 5C. PDF Processing Pipeline Verification

```bash
# Test pdf-parse library
cd /var/www/courtaccess_repo/backend
node -e "
const pdfParse = require('pdf-parse');
console.log('pdf-parse loaded successfully');
"

# Verify temp directory is writable
mkdir -p /tmp/courtaccess-ocr-test
echo "test" > /tmp/courtaccess-ocr-test/test.txt
rm -rf /tmp/courtaccess-ocr-test
echo "Temp directory OK"
```

### 5D. CSV Ingestion Verification

```bash
# The ingestion pipeline uses:
#   - stream-json for large JSON parsing
#   - pg-copy-streams for bulk PostgreSQL inserts
#   - Custom normalizer for data cleaning

# Verify stream-json
cd /var/www/courtaccess_repo/backend
node -e "require('stream-json'); console.log('stream-json OK')"

# Verify pg-copy-streams
node -e "require('pg-copy-streams'); console.log('pg-copy-streams OK')"
```

### 5E. Ingestion CLI Test

```bash
# The ingestion CLI is at: backend/src/ingestion/cli.ts
# Run with --help to verify it loads
cd /var/www/courtaccess_repo
npx tsx backend/src/ingestion/cli.ts --help
```

### 5F. Full OCR Pipeline Test (requires Redis + workers)

Only run after Stage 4 (Redis/workers enabled):
```bash
# Create a test document upload via API
# This triggers: upload → evidence queue → OCR worker → text extraction → indexing

# 1. Upload a small test PDF
curl -X POST https://courtaccess.net/api/evidence/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.pdf" \
  -F "caseId=<CASE_ID>"

# 2. Check processing status
pm2 logs courtaccess-api --lines 20 | grep -i 'ocr\|evidence\|extract'
```

---

## 6. Production Hardening Recommendations

### 6A. PM2 Ecosystem Config

The `ecosystem.config.cjs` in the repo is already configured. For Stage 2 (workers disabled), use:

```bash
# Start only the main API
cd /var/www/courtaccess_repo
pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save
```

For later stages (with workers):
```bash
# Start all processes
pm2 start ecosystem.config.cjs
pm2 save
```

### 6B. NGINX Improvements

Current config is good. Recommended additions for production:

```nginx
# Add to the server block in /etc/nginx/nginx.conf:

# Gzip compression for API responses
gzip on;
gzip_types application/json text/plain text/css application/javascript;
gzip_min_length 1000;
gzip_comp_level 6;

# Rate limiting at NGINX level (defense in depth)
# Add to http {} block (outside server {}):
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

# Then in the /api location:
# limit_req zone=api burst=50 nodelay;

# Request buffering for evidence uploads
proxy_request_buffering off;  # Stream large uploads directly
```

### 6C. Health Monitoring

```bash
# PM2 monitoring
pm2 monit    # Real-time CPU/memory dashboard

# Simple cron health check (add to crontab)
# crontab -e
# */5 * * * * curl -sf https://courtaccess.net/api/health > /dev/null || echo "CourtAccess health check failed at $(date)" >> /var/log/courtaccess-health.log
```

### 6D. Memory Limits

Already configured in `ecosystem.config.cjs`:
- `courtaccess-api`: 512MB max (`max_memory_restart: '512M'`)
- Workers: 256MB max each

To adjust:
```bash
# Increase API memory limit if needed
pm2 delete courtaccess-api
pm2 start ecosystem.config.cjs --only courtaccess-api
# Or edit ecosystem.config.cjs and change max_memory_restart
```

### 6E. Structured Logging

Already implemented via Fastify logger (`logger: true` in server.ts). For enhanced logging:

```bash
# View formatted logs
pm2 logs courtaccess-api --json | python3 -m json.tool

# Log rotation (already suggested in RESTORATION_PLAN.md)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### 6F. Backup Recommendations

```bash
# PostgreSQL automated backup (daily)
# Add to crontab:
# 0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/courtaccess/db-$(date +\%Y\%m\%d).sql.gz

# Create backup directory
sudo mkdir -p /var/backups/courtaccess
sudo chown ubuntu:ubuntu /var/backups/courtaccess

# Retain 30 days of backups
# Add to crontab:
# 0 4 * * * find /var/backups/courtaccess -name '*.sql.gz' -mtime +30 -delete

# NGINX config backup
sudo cp /etc/nginx/nginx.conf /var/backups/courtaccess/nginx.conf.backup

# PM2 ecosystem backup
cp /var/www/courtaccess_repo/ecosystem.config.cjs /var/backups/courtaccess/
```

---

## Quick Reference — Stage 2 Execution Order

1. Run auth verification (Section 1A-1G)
2. Generate and set production secrets (Section 2A-2B)
3. Restart and verify NODE_ENV (Section 2C)
4. Run full smoke test script (Section 3H)
5. (Optional) Set up NGINX improvements (Section 6B)
6. (Optional) Set up log rotation (Section 6E)
7. (Optional) Set up backups (Section 6F)

**Do NOT proceed to Redis/workers (Section 4) until all of Section 1-3 pass.**

---

## Rollback (Stage 2 → Stage 1 baseline)

If auth or other changes break the server:

```bash
# Check PM2 logs for errors
pm2 logs courtaccess-api --lines 50

# If .env changes broke it, restore:
# (keep a backup before editing)
cp /var/www/courtaccess_repo/backend/.env.backup /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api

# If code changes broke it, revert to Stage 1:
cd /var/www/courtaccess_repo
git stash  # or git checkout .
pm2 restart courtaccess-api
```
