# CourtAccess — Stage 2 Production Hardening Procedure

**Baseline:** Fastify on port 3001 via PM2 (`courtaccess-api`), NGINX static frontend, PostgreSQL operational, Redis/workers disabled.

**Execution order:** A → B → C → D → E → F (sequential, each section validated before proceeding)

---

## A) Production Secret Rotation

### A1. Backup current .env before any changes

```bash
cp /var/www/courtaccess_repo/backend/.env /var/www/courtaccess_repo/backend/.env.stage1-backup
```

**Expected:** File copied, no errors.

### A2. Generate production-grade secrets

```bash
echo "=== Copy these values ==="
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "COOKIE_SECRET=$(openssl rand -hex 32)"
```

**Expected:** Three lines of hex output (128-char, 128-char, 64-char).

### A3. Edit .env with new secrets

```bash
nano /var/www/courtaccess_repo/backend/.env
```

Replace `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` with the generated values.

**Required .env contents after edit:**

```env
# --- Core ---
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
FRONTEND_URL=https://courtaccess.net

# --- Database ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/courtaccess?schema=public"

# --- Auth (rotated) ---
JWT_SECRET="<128-char hex from A2>"
JWT_REFRESH_SECRET="<128-char hex from A2>"
COOKIE_SECRET="<64-char hex from A2>"

# --- Safety flags (still active for Stage 2) ---
DISABLE_WORKERS=true
SKIP_SCHEMA_ASSERT=true
CPRA_SIMULATION_MODE=true
```

### A4. Validate .env has no placeholder/temporary secrets

```bash
grep -E '(REPLACE|CHANGE|temporary|insecure|TODO|FIXME)' /var/www/courtaccess_repo/backend/.env
```

**Expected:** No output (no placeholder values remain).

### A5. Validate all required vars are present

```bash
for var in NODE_ENV PORT HOST DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET FRONTEND_URL DISABLE_WORKERS SKIP_SCHEMA_ASSERT CPRA_SIMULATION_MODE; do
  grep -q "^${var}=" /var/www/courtaccess_repo/backend/.env && echo "OK: $var" || echo "MISSING: $var"
done
```

**Expected:** All 11 lines show `OK:`.

### A6. Restart backend and verify secrets loaded

```bash
pm2 restart courtaccess-api
sleep 3
pm2 logs courtaccess-api --lines 15 --nostream
```

**Expected:**
- NO `WARNING: COOKIE_SECRET not set` message
- NO `WARNING: JWT_SECRET not set` message
- Server starts successfully: `CourtAccess API running on http://0.0.0.0:3001`

### A7. Verify NODE_ENV=production

```bash
curl -s https://courtaccess.net/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
env = d.get('environment', 'MISSING')
print(f'NODE_ENV: {env}')
assert env == 'production', f'FAIL: NODE_ENV is {env}, expected production'
print('PASS')
"
```

**Expected:** `NODE_ENV: production` then `PASS`.

### A8. Verify secret rotation impact

After rotating JWT secrets, **all existing access/refresh tokens are invalidated**. This is expected and desirable — forces re-login. Verify:

```bash
# This should fail with a token issued before rotation
curl -s https://courtaccess.net/api/auth/me \
  -H "Authorization: Bearer <any-old-token>" | python3 -m json.tool
```

**Expected:** `{"error":"Invalid or expired token"}` — confirms rotation took effect.

### A-ROLLBACK: If secrets break the server

```bash
cp /var/www/courtaccess_repo/backend/.env.stage1-backup /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api
curl -s https://courtaccess.net/api/health
```

---

## B) Auth Middleware Restoration

### B1. Current state of security hooks in server.ts

| Hook | Line | Status | Purpose |
|------|------|--------|---------|
| `securityHeadersHook` | 88 | **ACTIVE** | X-Frame-Options, HSTS, CSP, etc. |
| `rateLimitHook` | 91 | **ACTIVE** | 100 req/min general, 5/min login |
| `authenticationHook` | 94 | **COMMENTED OUT** | JWT verification + RBAC on all /api routes |
| `csrfProtectionHook` | 97 | **COMMENTED OUT** | CSRF token validation for state-changing requests |
| `uploadProtectionHook` | 100 | **ACTIVE** | File type/size validation |
| `registerSecurityLogging` | 103 | **ACTIVE** | Response tracking |

### B2. Why they were disabled

The `authenticationHook` and `csrfProtectionHook` were likely commented out during initial development/recovery to allow unrestricted API access for testing. With the backend now stable, they should be re-enabled in this order:

1. **Auth hook first** — protects routes from unauthorized access
2. **CSRF hook second** — only needed for cookie-based sessions; Bearer token requests bypass it automatically

### B3. Step 1 — Enable auth hook

Edit `server.ts`:

```bash
cd /var/www/courtaccess_repo
nano backend/src/server.ts
```

**Change line 94 from:**
```typescript
  //  app.addHook('onRequest', authenticationHook);
```

**To:**
```typescript
  app.addHook('onRequest', authenticationHook);
```

### B4. Step 1 — Verify auth hook works

```bash
pm2 restart courtaccess-api
sleep 3

# Public routes should still work (no auth required)
echo -n "Health (public):     " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health && echo ""
echo -n "Login (public):      " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}' && echo ""
echo -n "Register (public):   " && curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/register -H 'Content-Type: application/json' -d '{}' && echo ""
echo -n "Debug-check (public):" && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/debug-check && echo ""
echo -n "Metrics (public):    " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/metrics && echo ""

# Protected routes should return 401 WITHOUT a token
echo ""
echo -n "Cases (no auth):     " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases && echo ""
echo -n "Admin (no auth):     " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/admin/stats && echo ""
echo -n "Compliance (no auth):" && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/compliance/dashboard && echo ""
```

**Expected:**
```
Health (public):     200
Login (public):      400    (missing email/password)
Register (public):   400    (missing email/password)
Debug-check (public):200
Metrics (public):    200

Cases (no auth):     401
Admin (no auth):     401
Compliance (no auth):401
```

**CRITICAL CHECK:** If public routes return 401, the auth hook has a bug. Rollback immediately (Section B-ROLLBACK).

### B5. Step 1 — Verify auth with valid token

```bash
# Login to get a fresh token
LOGIN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-stage2@courtaccess.net","password":"Stage2Test!2026"}')
echo "$LOGIN" | python3 -m json.tool

# If test user doesn't exist yet, register first:
# curl -s -X POST https://courtaccess.net/api/auth/register \
#   -H 'Content-Type: application/json' \
#   -d '{"name":"Test Attorney","email":"test-stage2@courtaccess.net","password":"Stage2Test!2026","role":"attorney"}'

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Protected routes should work with valid token
echo -n "Cases (auth):     " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases -H "Authorization: Bearer $TOKEN" && echo ""
echo -n "Auth/me (auth):   " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/me -H "Authorization: Bearer $TOKEN" && echo ""
```

**Expected:** Both return `200`.

### B6. Step 1 — Verify RBAC (role-based access)

```bash
# The test user has role "attorney"
# Admin-only routes should return 403

echo -n "Admin-only (attorney role): " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/security/log -H "Authorization: Bearer $TOKEN" && echo ""
```

**Expected:** `403` (attorney doesn't have access to /api/security routes, which require admin role).

### B7. Step 2 — Enable CSRF hook (optional for Stage 2)

The CSRF hook **automatically bypasses Bearer token requests** (line 156-162 in csrfProtection.ts). Since the frontend exclusively uses Bearer tokens (stored in localStorage), enabling CSRF will NOT break the frontend.

Edit `server.ts`:

**Change line 97 from:**
```typescript
  // app.addHook('onRequest', csrfProtectionHook);
```

**To:**
```typescript
  app.addHook('onRequest', csrfProtectionHook);
```

```bash
pm2 restart courtaccess-api
sleep 3

# Bearer token requests should still work (CSRF bypass)
echo -n "Cases (Bearer):  " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases -H "Authorization: Bearer $TOKEN" && echo ""
echo -n "Health (public): " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health && echo ""
```

**Expected:** Both `200` — Bearer auth bypasses CSRF.

### B8. Commit auth restoration changes

```bash
cd /var/www/courtaccess_repo
git add backend/src/server.ts
git commit -m "Stage 2: Re-enable auth and CSRF hooks for production"
```

### B-ROLLBACK: If auth lockout occurs

```bash
# Option 1: Comment out the auth hook again
cd /var/www/courtaccess_repo
sed -i "s|  app.addHook('onRequest', authenticationHook);|  //  app.addHook('onRequest', authenticationHook);|" backend/src/server.ts
sed -i "s|  app.addHook('onRequest', csrfProtectionHook);|  // app.addHook('onRequest', csrfProtectionHook);|" backend/src/server.ts
pm2 restart courtaccess-api

# Option 2: Full rollback to Stage 1
cd /var/www/courtaccess_repo
git checkout backend/src/server.ts
pm2 restart courtaccess-api

# Verify
curl -s https://courtaccess.net/api/health
```

---

## C) Safe Authentication Validation

Run these **after Section B (auth hook enabled)**.

### C1. End-to-end registration

```bash
# Register a new user
REG=$(curl -s -X POST https://courtaccess.net/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Stage2 Validator","email":"validator-s2@courtaccess.net","password":"S2Validate!2026","role":"attorney"}')
echo "$REG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, f'FAIL: no accessToken in response: {d}'
assert 'refreshToken' in d, f'FAIL: no refreshToken in response: {d}'
assert d['user']['email'] == 'validator-s2@courtaccess.net', 'FAIL: email mismatch'
assert d['user']['role'] == 'attorney', 'FAIL: role mismatch'
print('PASS: Registration successful')
print(f'  userId: {d[\"user\"][\"userId\"]}')
print(f'  accessToken: {d[\"accessToken\"][:20]}...')
"
```

**Expected:** `PASS: Registration successful` with userId and token prefix.

### C2. End-to-end login

```bash
LOGIN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"validator-s2@courtaccess.net","password":"S2Validate!2026"}')
echo "$LOGIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, f'FAIL: {d}'
assert d['expiresIn'] == 900, f'FAIL: expiresIn is {d.get(\"expiresIn\")}, expected 900 (15min)'
print('PASS: Login successful, token expires in 15min')
"
ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
REFRESH=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")
```

**Expected:** `PASS: Login successful, token expires in 15min`.

### C3. Refresh token rotation

```bash
REFRESH_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$REFRESH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, f'FAIL: {d}'
assert 'refreshToken' in d, f'FAIL: no new refreshToken in response'
print('PASS: Token rotation successful')
"

# Old refresh token should now be revoked
OLD_REFRESH_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$OLD_REFRESH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'error' in d, f'FAIL: old token still works: {d}'
print('PASS: Old refresh token correctly revoked')
"

# Update tokens
ACCESS=$(echo "$REFRESH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
REFRESH=$(echo "$REFRESH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")
```

**Expected:** Two `PASS` lines.

### C4. CSRF token endpoint

```bash
CSRF_RESP=$(curl -s https://courtaccess.net/api/auth/csrf-token \
  -H "Authorization: Bearer $ACCESS")
echo "$CSRF_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
token = d.get('csrfToken', '')
assert len(token) == 64, f'FAIL: csrfToken length is {len(token)}, expected 64'
print(f'PASS: CSRF token received ({token[:8]}...)')
"
```

**Expected:** `PASS: CSRF token received`.

### C5. Cookie security flags

```bash
COOKIE_HEADERS=$(curl -sI -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"validator-s2@courtaccess.net","password":"S2Validate!2026"}')
echo "$COOKIE_HEADERS" | grep -i 'set-cookie' | while read -r line; do
  echo "$line"
  echo "$line" | grep -qi 'httponly' && echo "  ✓ HttpOnly" || echo "  ✗ MISSING HttpOnly"
  echo "$line" | grep -qi 'secure' && echo "  ✓ Secure" || echo "  ✗ MISSING Secure"
  echo "$line" | grep -qi 'samesite=strict' && echo "  ✓ SameSite=Strict" || echo "  ✗ MISSING SameSite=Strict"
done
```

**Expected:** refreshToken cookie with HttpOnly, Secure, SameSite=Strict flags.

### C6. Protected route enforcement

```bash
# Without auth → 401
echo -n "No auth → " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases && echo ""

# With expired/garbage token → 401
echo -n "Bad token → " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases -H "Authorization: Bearer invalid.token.here" && echo ""

# With valid token → 200
echo -n "Valid token → " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases -H "Authorization: Bearer $ACCESS" && echo ""
```

**Expected:** `401`, `401`, `200`.

### C7. Logout invalidation

```bash
# Logout
LOGOUT_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/logout \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$LOGOUT_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('message') == 'Logged out successfully', f'FAIL: {d}'
print('PASS: Logout successful')
"

# Refresh token should now fail
AFTER_LOGOUT=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$AFTER_LOGOUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'error' in d, f'FAIL: refresh token still works after logout: {d}'
print('PASS: Refresh token invalidated after logout')
"
```

**Expected:** Two `PASS` lines.

### C8. Browser validation procedure

Open a browser on your local machine (or phone):

1. Navigate to `https://courtaccess.net`
2. Frontend should load (React SPA)
3. Navigate to login page
4. Enter test credentials: `validator-s2@courtaccess.net` / `S2Validate!2026`
5. Login should succeed → redirects to dashboard
6. Open DevTools → Network tab
7. Verify all `/api/` requests include `Authorization: Bearer ...` header
8. Verify no requests go to `localhost:3001`
9. Verify no CORS errors in Console tab
10. Click logout → verify redirect to login page
11. Verify protected pages redirect to login when not authenticated

---

## D) Controlled Redis/BullMQ Restoration

### D1. Check Redis server status

```bash
redis-cli ping
```

**Expected:** `PONG`

**If Redis is not installed:**
```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
```

**If using remote Redis (ElastiCache, Upstash):**
```bash
# Test TLS connection
redis-cli --tls -u "$REDIS_URL" PING
```

### D2. Add REDIS_URL to .env (keep workers disabled)

```bash
# Add Redis URL — workers stay disabled
echo '' >> /var/www/courtaccess_repo/backend/.env
echo '# --- Redis (Stage 2D) ---' >> /var/www/courtaccess_repo/backend/.env
echo 'REDIS_URL=redis://localhost:6379' >> /var/www/courtaccess_repo/backend/.env

# Verify DISABLE_WORKERS is still true
grep DISABLE_WORKERS /var/www/courtaccess_repo/backend/.env
```

**Expected:** `DISABLE_WORKERS=true` is present.

### D3. Restart and verify Redis connectivity

```bash
pm2 restart courtaccess-api
sleep 3

# Check via deep health endpoint
curl -s https://courtaccess.net/api/health/deep | python3 -c "
import sys, json
d = json.load(sys.stdin)
for comp, data in d['components'].items():
    print(f'{comp:12s}: {data[\"status\"]:10s} ({data[\"latencyMs\"]}ms) {data.get(\"message\",\"\")}')
"
```

**Expected:**
```
postgres    : healthy    (< 50ms)
redis       : healthy    (< 10ms)
neo4j       : unhealthy  (not configured)
memory      : healthy    (< 1ms)
```

### D4. Enable workers (remove DISABLE_WORKERS flag)

```bash
# Remove DISABLE_WORKERS
sed -i '/^DISABLE_WORKERS/d' /var/www/courtaccess_repo/backend/.env

# Verify it's gone
grep DISABLE_WORKERS /var/www/courtaccess_repo/backend/.env
```

**Expected:** No output (flag removed).

```bash
pm2 restart courtaccess-api
sleep 5

# Check worker startup
pm2 logs courtaccess-api --lines 30 --nostream | grep -iE 'worker|pipeline|backpressure|redis'
```

**Expected logs:**
```
[PipelineWorkers] Starting 5 ACU-enforced pipeline workers...
[PipelineWorkers] All pipeline workers started with backpressure monitoring
[Redis] Connected to redis://***@localhost:6379
```

### D5. Verify queue health

```bash
# Direct Redis check
redis-cli keys 'bull:*' | head -20
# Expected: queue keys appear (or empty if no jobs yet)

# Memory check
redis-cli info memory | grep -E 'used_memory_human|maxmemory_human'
```

### D6. Test adding a job to a queue (smoke test)

```bash
# This endpoint may trigger queue activity — check logs
curl -s https://courtaccess.net/api/admin/queues \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "Queue endpoint may not be accessible without admin role"
```

### D7. Verify Redis memory monitor started

```bash
pm2 logs courtaccess-api --lines 10 --nostream | grep -i 'redis.*memory\|memory.*monitor'
```

### D-ROLLBACK: If workers cause issues

```bash
# Re-add DISABLE_WORKERS
echo 'DISABLE_WORKERS=true' >> /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api

# Verify
pm2 logs courtaccess-api --lines 10 --nostream | grep -i 'worker.*disabled'
```

**Expected:** `[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var`

---

## E) OCR/Intelligence Pipeline Recovery

### E1. System dependency check

```bash
echo "=== System Dependencies ==="

# pdf-parse (npm package — no system dep needed)
echo -n "pdf-parse: "
cd /var/www/courtaccess_repo/backend && node -e "require('pdf-parse'); console.log('OK')" 2>&1

# tesseract.js (npm package — uses WASM, no system binary needed)
echo -n "tesseract.js: "
node -e "require('tesseract.js'); console.log('OK')" 2>&1

# stream-json (for large JSON/CSV ingestion)
echo -n "stream-json: "
node -e "require('stream-json'); console.log('OK')" 2>&1

# pg-copy-streams (bulk PostgreSQL inserts)
echo -n "pg-copy-streams: "
node -e "require('pg-copy-streams'); console.log('OK')" 2>&1

# pdftoppm (system binary — for PDF to image conversion)
echo -n "pdftoppm: "
which pdftoppm && pdftoppm -v 2>&1 | head -1 || echo "MISSING — install: sudo apt install -y poppler-utils"

# ImageMagick (system binary — for image processing)
echo -n "ImageMagick: "
which convert && convert --version 2>&1 | head -1 || echo "MISSING — install: sudo apt install -y imagemagick"
```

**Expected:** All show `OK` or version info. Install missing system deps if needed:

```bash
sudo apt update && sudo apt install -y poppler-utils imagemagick
```

### E2. Temp storage validation

```bash
# Check disk space for OCR processing
df -h /tmp
# Need at least 5GB free

# Verify temp directory is writable
mkdir -p /tmp/courtaccess-ocr-test && echo "test" > /tmp/courtaccess-ocr-test/test.txt && rm -rf /tmp/courtaccess-ocr-test && echo "Temp storage: OK"
```

**Expected:** `Temp storage: OK` with adequate disk space.

### E3. AWS Textract connectivity (optional — requires AWS keys)

```bash
# Only if AWS_ACCESS_KEY_ID and AWS_REGION are in .env
grep -q AWS_ACCESS_KEY_ID /var/www/courtaccess_repo/backend/.env && echo "AWS keys configured" || echo "AWS keys not configured (Textract unavailable — pdf-parse and tesseract.js will be used)"
```

### E4. Ingestion CLI validation

```bash
cd /var/www/courtaccess_repo
npx tsx backend/src/ingestion/cli.ts --help 2>&1 | head -10
```

**Expected:** Usage/help text without errors.

### E5. Full OCR pipeline test (requires Redis/workers from Section D)

This requires a test PDF file. Create one:

```bash
echo "This is a test document for Stage 2 OCR validation." | \
  python3 -c "
import sys
try:
    from reportlab.pdfgen import canvas
    c = canvas.Canvas('/tmp/test-stage2.pdf')
    c.drawString(100, 750, 'Stage 2 OCR Test Document')
    c.drawString(100, 700, 'This text should be extracted by pdf-parse.')
    c.save()
    print('Test PDF created: /tmp/test-stage2.pdf')
except ImportError:
    print('reportlab not available — create a test PDF manually')
    sys.exit(0)
"
```

If reportlab isn't available, upload any small PDF through the API to test the pipeline.

### E-ROLLBACK

OCR/ingestion issues don't affect the core server. If workers fail on OCR:

```bash
echo 'DISABLE_WORKERS=true' >> /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api
```

---

## F) Production Hardening

### F1. PM2 ecosystem.config.cjs

The `ecosystem.config.cjs` in the repo is already production-ready. To use it:

```bash
cd /var/www/courtaccess_repo

# Stage 2 — API only (workers still disabled)
pm2 delete all
pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save

# Verify
pm2 status
```

**Expected:** Single process `courtaccess-api` running.

**Later stages (with workers):**
```bash
# Start all processes
pm2 start ecosystem.config.cjs
pm2 save
```

### F2. Create PM2 log directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown $(whoami):$(whoami) /var/log/pm2
```

### F3. Install PM2 log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
```

**Verify:**
```bash
pm2 conf pm2-logrotate
```

### F4. NGINX optimization

Add to your `nginx.conf` **inside the `http {}` block** (before the `server {}` block):

```bash
sudo nano /etc/nginx/nginx.conf
```

Add (if not already present):

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 1000;
gzip_types
    text/plain
    text/css
    text/xml
    application/json
    application/javascript
    application/xml
    application/rss+xml
    image/svg+xml;

# Rate limiting zone (defense in depth)
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
```

Add `limit_req` inside the `/api/` location block:

```nginx
location ^~ /api/ {
    limit_req zone=api burst=50 nodelay;
    # ... existing proxy_pass and headers ...
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Verify:**
```bash
# Check gzip is working
curl -sI -H 'Accept-Encoding: gzip' https://courtaccess.net/api/health | grep -i content-encoding
# Expected: content-encoding: gzip (for responses > 1000 bytes)
```

### F5. Health monitoring cron

```bash
# Create monitoring script
cat > /var/www/courtaccess_repo/scripts/health-check.sh << 'SCRIPT'
#!/bin/bash
HEALTH=$(curl -sf --max-time 10 https://courtaccess.net/api/health 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ALERT: Health check failed" >> /var/log/courtaccess-health.log
  pm2 restart courtaccess-api
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Auto-restarted courtaccess-api" >> /var/log/courtaccess-health.log
fi
SCRIPT
chmod +x /var/www/courtaccess_repo/scripts/health-check.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/courtaccess_repo/scripts/health-check.sh") | crontab -
```

**Verify:**
```bash
crontab -l | grep health-check
```

### F6. Automated PostgreSQL backups

```bash
# Create backup directory
sudo mkdir -p /var/backups/courtaccess
sudo chown $(whoami):$(whoami) /var/backups/courtaccess

# Create backup script
cat > /var/www/courtaccess_repo/scripts/db-backup.sh << 'SCRIPT'
#!/bin/bash
set -e
source /var/www/courtaccess_repo/backend/.env
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/var/backups/courtaccess/db-${TIMESTAMP}.sql.gz"

pg_dump "$DATABASE_URL" 2>/dev/null | gzip > "$BACKUP_FILE"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" >> /var/log/courtaccess-backup.log

# Retain 30 days of backups
find /var/backups/courtaccess -name '*.sql.gz' -mtime +30 -delete
SCRIPT
chmod +x /var/www/courtaccess_repo/scripts/db-backup.sh

# Add to crontab (daily at 3 AM UTC)
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/courtaccess_repo/scripts/db-backup.sh") | crontab -
```

**Verify:**
```bash
# Test the backup script
/var/www/courtaccess_repo/scripts/db-backup.sh
ls -la /var/backups/courtaccess/
```

### F7. NGINX config backup

```bash
sudo cp /etc/nginx/nginx.conf /var/backups/courtaccess/nginx.conf.$(date +%Y%m%d)
```

### F8. Final verification checklist

```bash
#!/bin/bash
echo "=========================================="
echo "CourtAccess Stage 2 Final Verification"
echo "=========================================="
echo ""

# Infrastructure
echo "--- Infrastructure ---"
echo -n "PM2 status:    " && pm2 jlist 2>/dev/null | python3 -c "import sys,json; apps=json.load(sys.stdin); print(f'{len(apps)} process(es), all online' if all(a['pm2_env']['status']=='online' for a in apps) else 'ISSUE')" 2>/dev/null || echo "ERROR"
echo -n "Port 3001:     " && ss -tlnp | grep -q ':3001' && echo "listening" || echo "NOT listening"
echo -n "Port 3000:     " && ss -tlnp | grep -q ':3000' && echo "STILL LISTENING (should be gone)" || echo "clear"
echo -n "Disk space:    " && df -h / | tail -1 | awk '{print $5, "used"}'
echo ""

# API
echo "--- API Health ---"
echo -n "Health:        " && curl -sf --max-time 5 https://courtaccess.net/api/health > /dev/null && echo "OK" || echo "FAIL"
echo -n "Deep health:   " && curl -sf --max-time 10 https://courtaccess.net/api/health/deep > /dev/null && echo "OK" || echo "FAIL"
echo -n "Debug check:   " && curl -sf --max-time 5 https://courtaccess.net/api/auth/debug-check > /dev/null && echo "OK" || echo "FAIL"
echo -n "Metrics:       " && curl -sf --max-time 5 https://courtaccess.net/api/metrics > /dev/null && echo "OK" || echo "FAIL"
echo ""

# Security
echo "--- Security ---"
echo -n "Auth enforced: " && curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases && echo " (should be 401)"
echo -n "HSTS header:   " && curl -sI https://courtaccess.net/api/health | grep -qi 'strict-transport' && echo "present" || echo "MISSING"
echo -n "X-Frame-Opts:  " && curl -sI https://courtaccess.net/api/health | grep -qi 'x-frame-options' && echo "present" || echo "MISSING"
echo -n "CSP header:    " && curl -sI https://courtaccess.net/api/health | grep -qi 'content-security-policy' && echo "present" || echo "MISSING"
echo -n "No X-Powered:  " && curl -sI https://courtaccess.net/api/health | grep -qi 'x-powered-by' && echo "LEAK!" || echo "clean"
echo ""

# Frontend
echo "--- Frontend ---"
echo -n "HTTPS site:    " && curl -sf --max-time 5 https://courtaccess.net > /dev/null && echo "OK" || echo "FAIL"
echo -n "SPA fallback:  " && curl -sf --max-time 5 https://courtaccess.net/dashboard > /dev/null && echo "OK" || echo "FAIL"
echo ""

echo "=========================================="
echo "Verification complete."
echo "=========================================="
```

---

## Stage 2 Summary — What Changed

| Item | Before (Stage 1) | After (Stage 2) |
|------|------------------|-----------------|
| JWT secrets | Temporary/random | Production-grade (128-char hex) |
| Cookie secret | Hardcoded fallback | Production-grade (64-char hex) |
| Auth hook | Commented out | Active (JWT + RBAC enforced) |
| CSRF hook | Commented out | Active (Bearer bypass enabled) |
| Redis | Disconnected | Connected (if Section D done) |
| Workers | Disabled | Enabled (if Section D done) |
| Log rotation | None | 50MB max, 30-day retention |
| DB backups | None | Daily at 3 AM UTC |
| Health monitoring | Manual | Cron every 5 minutes |
| NGINX | Basic | Gzip + rate limiting |
