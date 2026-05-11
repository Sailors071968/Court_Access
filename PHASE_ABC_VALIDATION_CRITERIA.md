# CourtAccess — Phase A/B/C Validation Criteria

**Prerequisite:** ALL Phase 0 checkpoints must pass before starting Phase A.

---

## Phase A: Secret Rotation Validation Criteria

### A-PRE: Pre-rotation checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| A-PRE-1 | Phase 0 passed | `/api/health` environment | `"production"` |
| A-PRE-2 | .env backup exists | `ls backend/.env.pre-phase0` | File exists |
| A-PRE-3 | Current secrets documented | `grep -c 'SECRET' backend/.env` | ≥ 3 lines |

### A-EXEC: Rotation execution

```bash
# 1. Generate new secrets
NEW_JWT=$(openssl rand -hex 64)
NEW_REFRESH=$(openssl rand -hex 64)
NEW_COOKIE=$(openssl rand -hex 32)

# 2. Backup current .env
cp /var/www/courtaccess_repo/backend/.env /var/www/courtaccess_repo/backend/.env.pre-rotation

# 3. Replace secrets in .env (using sed for precision)
cd /var/www/courtaccess_repo
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"${NEW_JWT}\"|" backend/.env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"${NEW_REFRESH}\"|" backend/.env
sed -i "s|^COOKIE_SECRET=.*|COOKIE_SECRET=\"${NEW_COOKIE}\"|" backend/.env

# 4. Verify replacement
grep '^JWT_SECRET=' backend/.env | wc -c      # Should be ~135 chars (key=value)
grep '^JWT_REFRESH_SECRET=' backend/.env | wc -c  # Should be ~143 chars
grep '^COOKIE_SECRET=' backend/.env | wc -c    # Should be ~79 chars

# 5. Restart
pm2 restart courtaccess-api
sleep 5
```

### A-POST: Post-rotation validation

| # | Check | Command | Pass Criteria |
|---|-------|---------|---------------|
| A-POST-1 | Server started clean | `pm2 logs courtaccess-api --lines 20 --nostream` | No COOKIE_SECRET warning, server running |
| A-POST-2 | Health OK | `curl -s https://courtaccess.net/api/health` | `"status":"ok"`, `"environment":"production"` |
| A-POST-3 | No placeholder secrets | `grep -E '(REPLACE\|CHANGE\|temporary\|TODO)' backend/.env` | No output |
| A-POST-4 | Secret lengths correct | `grep '^JWT_SECRET' backend/.env \| cut -d'"' -f2 \| wc -c` | 129 (128 hex + newline) |
| A-POST-5 | Old tokens rejected | `curl -s -H "Authorization: Bearer OLD_TOKEN" https://courtaccess.net/api/auth/me` | `401` response |
| A-POST-6 | PM2 restart count | `pm2 show courtaccess-api \| grep restarts` | 0 or stable |
| A-POST-7 | Frontend loads | `curl -s https://courtaccess.net \| head -1` | `<!doctype html>` |

### A-ROLLBACK

```bash
cp /var/www/courtaccess_repo/backend/.env.pre-rotation /var/www/courtaccess_repo/backend/.env
pm2 restart courtaccess-api
sleep 3
curl -s https://courtaccess.net/api/health
```

---

## Phase B: Auth Middleware Restoration Validation Criteria

### B-PRE: Pre-auth-enable checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| B-PRE-1 | Phase A passed | All A-POST checks | PASS |
| B-PRE-2 | server.ts backup | `cp backend/src/server.ts backend/src/server.ts.pre-auth` | Created |
| B-PRE-3 | Auth hook commented | `grep 'authenticationHook' backend/src/server.ts` | Shows `//` prefix |
| B-PRE-4 | CSRF hook commented | `grep 'csrfProtectionHook' backend/src/server.ts` | Shows `//` prefix |

### B-STEP-1: Enable authenticationHook ONLY (CSRF stays disabled)

**Code change in `backend/src/server.ts`:**

Find (approximately line 102):
```typescript
  //  app.addHook('onRequest', authenticationHook);
```

Change to:
```typescript
  app.addHook('onRequest', authenticationHook);
```

**Do NOT uncomment csrfProtectionHook yet.**

```bash
pm2 restart courtaccess-api
sleep 5
```

### B-STEP-1-VALIDATE: Auth hook validation matrix

**Public routes — MUST still return non-401 responses:**

| # | Route | Method | Command | Expected Status |
|---|-------|--------|---------|-----------------|
| B1 | `/api/health` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health` | `200` |
| B2 | `/api/metrics` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/metrics` | `200` |
| B3 | `/api/auth/login` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}'` | `400` (not 401) |
| B4 | `/api/auth/register` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/register -H 'Content-Type: application/json' -d '{}'` | `400` (not 401) |
| B5 | `/api/auth/refresh` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/refresh -H 'Content-Type: application/json' -d '{}'` | `400` or `401` (not 500) |
| B6 | `/api/auth/logout` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/logout` | `200` |
| B7 | `/api/auth/debug-check` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/debug-check` | `200` |
| B8 | `/api/auth/forgot-password` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/forgot-password -H 'Content-Type: application/json' -d '{}'` | `400` (not 401) |
| B9 | `/api/billing/webhook` | POST | `curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/billing/webhook` | `400` or `200` (not 401) |
| B10 | `/api/auth/csrf-token` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/csrf-token` | `200` |
| B11 | `/api/discount-codes/validate` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/discount-codes/validate` | `200` or `400` (not 401) |

**Protected routes — MUST return 401 without auth:**

| # | Route | Method | Command | Expected Status |
|---|-------|--------|---------|-----------------|
| B12 | `/api/cases` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cases` | `401` |
| B13 | `/api/evidence/1` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/evidence/1` | `401` |
| B14 | `/api/auth/me` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/me` | `401` |
| B15 | `/api/admin/rate-limits` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/admin/rate-limits` | `401` |
| B16 | `/api/security/logs` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/security/logs` | `401` |
| B17 | `/api/compliance/dashboard` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/compliance/dashboard` | `401` |
| B18 | `/api/narrative/health` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/narrative/health` | `401` |
| B19 | `/api/cpra/policy-matrix` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/cpra/policy-matrix` | `401` |
| B20 | `/api/admin/cpra/progress` | GET | `curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/admin/cpra/progress` | `401` |

**Protected routes — MUST return 200 WITH valid auth:**

```bash
# First, login to get a token:
TOKEN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_PASSWORD"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken','FAILED'))")

echo "Token: ${TOKEN:0:20}..."

# Then test with auth:
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" https://courtaccess.net/api/cases
# Expected: 200 (or 403 if role mismatch, but NOT 401)

curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" https://courtaccess.net/api/auth/me
# Expected: 200
```

### B-STEP-1-COPY-PASTE: All-in-one auth validation script

```bash
#!/bin/bash
echo "=== Phase B Step 1: Auth Hook Validation ==="
echo ""
PASS=0; FAIL=0
BASE="https://courtaccess.net"

check() {
  ACTUAL=$1; EXPECTED=$2; LABEL=$3
  if echo "$EXPECTED" | grep -q "$ACTUAL"; then
    echo "  PASS: $LABEL (got $ACTUAL)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $LABEL (got $ACTUAL, expected $EXPECTED)"
    FAIL=$((FAIL + 1))
  fi
}

echo "--- Public Routes (must NOT return 401) ---"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/health); [ "$R" != "401" ]; check "$R" "200" "GET /api/health"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/metrics); [ "$R" != "401" ]; check "$R" "200" "GET /api/metrics"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{}'); check "$R" "400" "POST /api/auth/login (empty)"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{}'); check "$R" "400" "POST /api/auth/register (empty)"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/logout); check "$R" "200" "POST /api/auth/logout"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/debug-check); check "$R" "200" "GET /api/auth/debug-check"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/csrf-token); check "$R" "200" "GET /api/auth/csrf-token"

echo ""
echo "--- Protected Routes (MUST return 401 without auth) ---"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/cases); check "$R" "401" "GET /api/cases"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/evidence/test); check "$R" "401" "GET /api/evidence/test"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/me); check "$R" "401" "GET /api/auth/me"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/rate-limits); check "$R" "401" "GET /api/admin/rate-limits"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/security/logs); check "$R" "401" "GET /api/security/logs"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/narrative/health); check "$R" "401" "GET /api/narrative/health"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/cpra/policy-matrix); check "$R" "401" "GET /api/cpra/policy-matrix"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/cpra/progress); check "$R" "401" "GET /api/admin/cpra/progress"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/compliance/dashboard); check "$R" "401" "GET /api/compliance/dashboard"

echo ""
echo "--- Stability ---"
RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
echo "  PM2 restarts: $RESTARTS"
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" $BASE); check "$FRONTEND" "200" "Frontend loads"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ $FAIL -eq 0 ] && echo "ALL PASS — proceed to B-STEP-2 (CSRF)" || echo "FAILURES — investigate before continuing"
```

### B-STEP-1-ROLLBACK (if auth hook breaks anything)

```bash
# Restore server.ts with hooks commented out
cp /var/www/courtaccess_repo/backend/src/server.ts.pre-auth \
   /var/www/courtaccess_repo/backend/src/server.ts
pm2 restart courtaccess-api
sleep 3
curl -s https://courtaccess.net/api/health
# Should work immediately — hooks back to commented-out state
```

---

### B-STEP-2: Enable csrfProtectionHook

**Only proceed after B-STEP-1 validation passes completely.**

**Code change in `backend/src/server.ts`:**

Find (approximately line 105):
```typescript
  // app.addHook('onRequest', csrfProtectionHook);
```

Change to:
```typescript
  app.addHook('onRequest', csrfProtectionHook);
```

```bash
pm2 restart courtaccess-api
sleep 5
```

### CSRF Re-Enable Validation Matrix

The key question: **Does enabling CSRF break any existing functionality?**

| # | Scenario | Method | Has Bearer? | Has CSRF Token? | CSRF Hook Behavior | Expected Result |
|---|----------|--------|-------------|-----------------|-------------------|-----------------|
| C1 | Frontend API call (authenticated) | POST/PUT/DELETE | YES (Bearer) | NO | **BYPASS** (line 160) | Works — no change |
| C2 | Frontend login | POST | NO | NO | **EXEMPT** (`/api/auth/login`) | Works — exempt route |
| C3 | Frontend register | POST | NO | NO | **EXEMPT** (`/api/auth/register`) | Works — exempt route |
| C4 | Frontend forgot-password | POST | NO | NO | **EXEMPT** | Works — exempt route |
| C5 | Frontend GET request | GET | YES or NO | N/A | **SKIP** (GET not in CSRF_PROTECTED_METHODS) | Works — GET not checked |
| C6 | Health check | GET | NO | NO | **SKIP** (GET method) | Works |
| C7 | Billing webhook (Stripe) | POST | NO | NO | **EXEMPT** (`/api/billing/webhook`) | Works — exempt route |
| C8 | Evidence upload (multipart) | POST | YES (Bearer) | NO | **BYPASS** (Bearer present) | Works |
| C9 | Cookie-only POST (no Bearer, no CSRF) | POST | NO | NO | Origin check → PASS if same-origin | Depends on origin header |
| C10 | Cross-origin POST (no Bearer) | POST | NO | NO | Origin check → **FAIL** | 403 — correct behavior |

**Bottom line:** Scenarios C1-C8 cover ALL frontend use cases. All pass through either EXEMPT routes or Bearer BYPASS. CSRF enabling should be invisible to the frontend.

### B-STEP-2-VALIDATE: CSRF validation commands

```bash
echo "=== CSRF Validation ==="

# 1. GET requests still work (CSRF only checks POST/PUT/DELETE/PATCH)
R=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
echo "GET /api/health: $R (expect 200)"

# 2. Public POST routes still work (exempt from CSRF)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login -H 'Content-Type: application/json' -d '{}')
echo "POST /api/auth/login (empty): $R (expect 400, not 403)"

# 3. Bearer-authenticated POST works (Bearer bypasses CSRF)
TOKEN="YOUR_VALID_TOKEN_FROM_LOGIN"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"CSRF Test Case","description":"Testing CSRF bypass"}')
echo "POST /api/cases (Bearer): $R (expect 200 or 201, NOT 403)"

# 4. Unauthenticated non-exempt POST gets 401 (auth hook first) not 403 (CSRF)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/cases \
  -H 'Content-Type: application/json' -d '{}')
echo "POST /api/cases (no auth): $R (expect 401, not 403)"

# 5. CSRF token endpoint still works
R=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/csrf-token)
echo "GET /api/auth/csrf-token: $R (expect 200)"

# 6. Frontend still loads
R=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net)
echo "Frontend: $R (expect 200)"
```

**Key principle:** Since the auth hook runs before the CSRF hook (both are `onRequest` hooks, registered in order), unauthenticated requests to protected routes will get `401` from the auth hook before the CSRF hook ever runs. The CSRF hook only matters for requests that:
1. Are POST/PUT/DELETE/PATCH, AND
2. Are NOT exempt, AND
3. Do NOT have a Bearer token, AND
4. Have passed the auth hook (i.e., are on a public route)

In practice, the only POST routes that match criteria 1-4 are the CSRF-exempt ones (login, register, etc.) — which are exempt anyway. **CSRF activation should have zero observable effect on the current system.**

### B-STEP-2-ROLLBACK

```bash
# Comment out CSRF hook in server.ts (keep auth hook enabled)
# Or full rollback:
cp /var/www/courtaccess_repo/backend/src/server.ts.pre-auth \
   /var/www/courtaccess_repo/backend/src/server.ts
pm2 restart courtaccess-api
```

---

## Phase C: Authentication Validation (End-to-End)

### C-PRE: Prerequisites

| # | Check | Required |
|---|-------|----------|
| C-PRE-1 | Phase A (secrets rotated) | PASS |
| C-PRE-2 | Phase B Step 1 (auth hook) | PASS |
| C-PRE-3 | Phase B Step 2 (CSRF hook) | PASS |
| C-PRE-4 | Test user credentials available | email + password for login |

### C-TEST-1: Registration flow

```bash
# Register a new test user
REG_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Phase C Test","email":"phase-c-test@courtaccess.net","password":"TestP@ss2026!"}')

echo "$REG_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, f'Missing accessToken: {d}'
assert 'refreshToken' in d, f'Missing refreshToken: {d}'
assert 'expiresIn' in d, f'Missing expiresIn: {d}'
assert d['expiresIn'] == 900, f'Wrong expiresIn: {d[\"expiresIn\"]}'
print(f'accessToken: {d[\"accessToken\"][:20]}...')
print(f'refreshToken: {d[\"refreshToken\"][:20]}...')
print(f'expiresIn: {d[\"expiresIn\"]}')
print('C-TEST-1: PASS')
"
```

### C-TEST-2: Login flow

```bash
LOGIN_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"phase-c-test@courtaccess.net","password":"TestP@ss2026!"}')

# Extract tokens
ACCESS=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
REFRESH=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")

echo "Access token: ${ACCESS:0:20}..."
echo "Refresh token: ${REFRESH:0:20}..."

# Verify response structure
echo "$LOGIN_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, 'Missing accessToken'
assert 'refreshToken' in d, 'Missing refreshToken'
assert d.get('expiresIn') == 900, f'Wrong expiresIn: {d.get(\"expiresIn\")}'
assert 'user' in d, 'Missing user object'
assert d['user']['email'] == 'phase-c-test@courtaccess.net', 'Wrong email in response'
print('C-TEST-2: PASS')
"
```

### C-TEST-3: Protected route with valid token

```bash
ME_RESP=$(curl -s -H "Authorization: Bearer $ACCESS" https://courtaccess.net/api/auth/me)
echo "$ME_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('email') == 'phase-c-test@courtaccess.net', f'Wrong email: {d}'
print(f'User: {d.get(\"email\")} role={d.get(\"role\")}')
print('C-TEST-3: PASS')
"
```

### C-TEST-4: Protected route without token (must fail)

```bash
R=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/auth/me)
[ "$R" = "401" ] && echo "C-TEST-4: PASS (got 401)" || echo "C-TEST-4: FAIL (got $R, expected 401)"
```

### C-TEST-5: Protected route with invalid token (must fail)

```bash
R=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.token.here" https://courtaccess.net/api/auth/me)
[ "$R" = "401" ] && echo "C-TEST-5: PASS (got 401)" || echo "C-TEST-5: FAIL (got $R, expected 401)"
```

### C-TEST-6: Refresh token rotation

```bash
REFRESH_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")

echo "$REFRESH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'accessToken' in d, f'Missing new accessToken: {d}'
assert 'refreshToken' in d, f'Missing new refreshToken: {d}'
print('New access token received')
print('C-TEST-6: PASS')
"

# Store new tokens
NEW_ACCESS=$(echo "$REFRESH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
NEW_REFRESH=$(echo "$REFRESH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")
```

### C-TEST-7: Old refresh token revoked after rotation

```bash
OLD_REFRESH_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")

echo "$OLD_REFRESH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'error' in d, f'Old refresh token should fail: {d}'
print(f'Error: {d[\"error\"]}')
print('C-TEST-7: PASS (old token rejected)')
"
```

### C-TEST-8: Logout invalidation

```bash
# Logout with new token
LOGOUT_RESP=$(curl -s -X POST https://courtaccess.net/api/auth/logout \
  -H "Authorization: Bearer $NEW_ACCESS" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")

echo "$LOGOUT_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('message') == 'Logged out successfully', f'Unexpected: {d}'
print('C-TEST-8a: PASS (logout succeeded)')
"

# Verify refresh token no longer works after logout
POST_LOGOUT=$(curl -s -X POST https://courtaccess.net/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")

echo "$POST_LOGOUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'error' in d, f'Token should be revoked: {d}'
print('C-TEST-8b: PASS (refresh token revoked after logout)')
"
```

### C-TEST-9: Cookie security flags (on login)

```bash
COOKIE_RESP=$(curl -sI -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"phase-c-test@courtaccess.net","password":"TestP@ss2026!"}')

echo "Set-Cookie headers:"
echo "$COOKIE_RESP" | grep -i 'set-cookie'

# Check refreshToken cookie
echo "$COOKIE_RESP" | grep -i 'set-cookie.*refreshToken' | grep -qi 'httponly' && echo "C-TEST-9a: PASS (HttpOnly)" || echo "C-TEST-9a: FAIL"
echo "$COOKIE_RESP" | grep -i 'set-cookie.*refreshToken' | grep -qi 'secure' && echo "C-TEST-9b: PASS (Secure)" || echo "C-TEST-9b: FAIL"
echo "$COOKIE_RESP" | grep -i 'set-cookie.*refreshToken' | grep -qi 'samesite=strict' && echo "C-TEST-9c: PASS (SameSite=Strict)" || echo "C-TEST-9c: FAIL"
```

### C-TEST-10: RBAC enforcement (role-based)

```bash
# Login with the test user (likely 'defendant' or 'staff' role)
TOKEN=$(curl -s -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"phase-c-test@courtaccess.net","password":"TestP@ss2026!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Admin-only route should return 403 (not 401)
R=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" https://courtaccess.net/api/security/logs)
echo "Non-admin accessing /api/security/logs: $R"
[ "$R" = "403" ] && echo "C-TEST-10: PASS (RBAC enforced)" || echo "C-TEST-10: INFO (got $R — check user role)"
```

---

## Rollback Diff Expectations: Pre-Auth vs Post-Auth States

### Files modified in Phase B

| File | Pre-Auth State | Post-Auth State | Diff |
|------|---------------|-----------------|------|
| `backend/src/server.ts` | Lines ~102,105 have `//` comment prefix on auth/CSRF hooks | Lines ~102,105 uncommented | 2 lines changed |

**No other files are modified in Phase B.** The auth logic, RBAC rules, public route list, and CSRF configuration are all unchanged — only the hook registration lines in `server.ts` are uncommented.

### Runtime behavior differences

| Behavior | Pre-Auth (hooks disabled) | Post-Auth (hooks enabled) |
|----------|--------------------------|---------------------------|
| GET `/api/cases` without token | Returns data (200) | Returns 401 |
| POST `/api/cases` without token | Returns data (200) | Returns 401 |
| POST `/api/cases` with valid Bearer | Returns data (200) | Returns data (200) |
| POST `/api/cases` with expired token | Returns data (200) | Returns 401 |
| GET `/api/admin/*` without token | Returns data (200) | Returns 401 |
| GET `/api/admin/*` with non-admin token | Returns data (200) | Returns 403 |
| GET `/api/health` | Returns 200 | Returns 200 (unchanged) |
| POST `/api/auth/login` | Returns 400/200 | Returns 400/200 (unchanged) |
| Frontend SPA loads | Yes | Yes (unchanged — served by NGINX) |
| Frontend login works | Yes | Yes (unchanged — public route) |
| Frontend API calls with token | 200 | 200 (unchanged — Bearer accepted) |

### Rollback distance

**Phase B rollback = 2 lines in 1 file.** Either:
- Manually add `//` before the two hooks
- Or restore `server.ts.pre-auth` backup

Either way, `pm2 restart courtaccess-api` and the system is back to pre-auth state within 10 seconds.

---

## Go/No-Go Decision Matrix

| Phase | Gate | Criteria | Action if FAIL |
|-------|------|----------|----------------|
| A→B | Post-rotation | Health OK + environment=production + no warnings | Restore .env.pre-rotation |
| B-1→B-2 | Auth hook | All B1-B20 pass + frontend loads | Restore server.ts.pre-auth |
| B-2→C | CSRF hook | All CSRF validations pass + no 403 on Bearer requests | Comment out CSRF hook only |
| C→D | Auth complete | All C-TEST 1-10 pass | Full rollback to pre-auth state |
