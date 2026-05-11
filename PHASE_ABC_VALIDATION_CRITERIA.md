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

## ADDENDUM 1: Pre-Auth Baseline Capture (Before Phase B)

**Purpose:** Preserve exact current behavior of all 20 regression routes as an artifact, so post-auth changes are diffable.

Run this BEFORE enabling auth hook:

```bash
#!/bin/bash
echo "=== Pre-Auth Baseline Capture: $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee /var/www/courtaccess_repo/pre-auth-baseline.txt
BASE="https://courtaccess.net"

capture() {
  ROUTE=$1; METHOD=${2:-GET}
  if [ "$METHOD" = "POST" ]; then
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$ROUTE" -H 'Content-Type: application/json' -d '{}')
  else
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$ROUTE")
  fi
  echo "$METHOD $ROUTE → $CODE" | tee -a /var/www/courtaccess_repo/pre-auth-baseline.txt
}

echo "--- Public Routes ---" | tee -a /var/www/courtaccess_repo/pre-auth-baseline.txt
capture "/api/health"
capture "/api/metrics"
capture "/api/auth/login" "POST"
capture "/api/auth/register" "POST"
capture "/api/auth/logout" "POST"
capture "/api/auth/debug-check"
capture "/api/auth/csrf-token"
capture "/api/auth/forgot-password" "POST"
capture "/api/auth/refresh" "POST"
capture "/api/billing/webhook" "POST"
capture "/api/discount-codes/validate"

echo "--- Currently-Unprotected Routes (will become 401 after auth hook) ---" | tee -a /var/www/courtaccess_repo/pre-auth-baseline.txt
capture "/api/cases"
capture "/api/evidence/test"
capture "/api/auth/me"
capture "/api/admin/rate-limits"
capture "/api/security/logs"
capture "/api/narrative/health"
capture "/api/cpra/policy-matrix"
capture "/api/admin/cpra/progress"
capture "/api/compliance/dashboard"

echo "--- Baseline complete ---" | tee -a /var/www/courtaccess_repo/pre-auth-baseline.txt
```

Save as artifact: `/var/www/courtaccess_repo/pre-auth-baseline.txt`

---

## ADDENDUM 2: Browser Session Validation (After Auth Hook Enabled)

Run these 5 browser scenarios after B-STEP-1 passes curl validation:

### BS-1: Clean browser session
1. Open browser incognito/private window
2. Navigate to `https://courtaccess.net/dashboard`
3. **Expected:** Redirect to `/login` (ProtectedRoute checks `isAuthenticated` in Zustand store)
4. **No white screen, no console errors**

### BS-2: Stale localStorage token
1. Open browser devtools → Application → Local Storage → `courtaccess.net`
2. Set `court-access-token` to `"expired.stale.token"`
3. Set `court-access-auth` to `{"state":{"user":{"id":"x","name":"test","email":"test@test.com","role":"admin"},"isAuthenticated":true,"subscriptionStatus":"active"},"version":0}`
4. Navigate to `https://courtaccess.net/dashboard`
5. **Expected:** Dashboard may initially render (Zustand rehydrates from localStorage), but API calls to `/api/cases` etc. will return 401
6. **Check:** No infinite retry loops in Network tab, no uncaught exceptions in Console
7. **Action:** Components should show error states or empty data, NOT crash

### BS-3: Expired refresh token
1. Login normally → get tokens
2. Wait or manually clear: `localStorage.removeItem('court-access-refresh-token')`
3. Let access token expire (15 minutes) or manually delete it
4. Attempt navigation to a protected page
5. **Expected:** API calls fail with 401, user is effectively logged out
6. **Note:** The frontend does NOT have an automatic refresh interceptor. When access token expires, API calls fail. User must manually re-login.

### BS-4: Private/Incognito window
1. Open incognito
2. Go to `https://courtaccess.net`
3. **Expected:** Landing page loads
4. Navigate to `/login` → login with test credentials
5. **Expected:** Login succeeds, redirect to dashboard, API calls work
6. Close incognito → reopen → go to `/dashboard`
7. **Expected:** Redirect to `/login` (localStorage cleared on incognito close)

### BS-5: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
1. Login normally
2. Navigate to dashboard (data loads)
3. Press Ctrl+Shift+R (hard refresh)
4. **Expected:** Page reloads, Zustand rehydrates from `court-access-auth` in localStorage, token still in `court-access-token`, API calls succeed
5. **No logout, no flash of login page**

---

## ADDENDUM 3: Frontend Failure-Mode Validation

The frontend uses Zustand with `persist` middleware. Auth state is stored in `localStorage` key `court-access-auth`. Access token is in `court-access-token`. Refresh token is in `court-access-refresh-token`.

**Architecture insight:** The frontend does NOT have a global 401 interceptor or automatic token refresh. Each API call in `caseApi.ts` does `if (!res.ok) throw new Error(...)`. Components catch these errors individually. There is no `ErrorBoundary` component.

### FM-1: Access token missing (localStorage cleared)
- **Trigger:** Delete `court-access-token` from localStorage
- **Zustand state:** Still has `isAuthenticated: true` (persisted separately)
- **Behavior:** ProtectedRoute passes (checks Zustand, not token). API calls go out WITHOUT Bearer header. Auth hook returns 401. Components throw errors.
- **Expected:** Components show error states. No redirect to login (Zustand still thinks user is authenticated).
- **Risk:** MEDIUM — user sees broken dashboard, not login redirect. Must manually clear state or logout.
- **Mitigation:** This is pre-existing behavior, not caused by auth hook. A global 401 interceptor would fix this but is out of scope for Phase B.

### FM-2: Access token malformed
- **Trigger:** Set `court-access-token` to `"not-a-jwt"`
- **Behavior:** Auth hook tries to verify, fails, returns 401
- **Expected:** Same as FM-1 — API calls fail, components show errors
- **Risk:** LOW — identical to FM-1

### FM-3: Refresh token revoked (after rotation or logout)
- **Trigger:** Call refresh endpoint with old token after rotation
- **Behavior:** Server returns 401 with `"Invalid refresh token"`
- **Expected:** No auto-refresh in frontend. User must re-login.
- **Risk:** LOW — expected behavior

### FM-4: `/api/auth/me` returns 401
- **Trigger:** Access protected route with expired/missing token
- **Behavior:** The `/me` endpoint is only called when explicitly requested (not on every page load). Most pages use the Zustand-cached user object.
- **Expected:** If `/me` is called and returns 401, the calling component throws an error. No global state change.
- **Risk:** LOW — `/me` is not called automatically

### Frontend Failure Summary

| Scenario | White Screen? | Infinite Loop? | Uncaught Exception? | User Impact |
|----------|--------------|----------------|---------------------|-------------|
| FM-1: Token missing | NO | NO | NO (errors caught) | Broken dashboard, must re-login |
| FM-2: Token malformed | NO | NO | NO (errors caught) | Same as FM-1 |
| FM-3: Refresh revoked | NO | NO | NO | Must re-login |
| FM-4: /me returns 401 | NO | NO | NO | Component-level error |

**No white-screen crashes. No infinite retry loops. No uncaught promise rejections.** The worst case is a broken dashboard that requires manual re-login. This is acceptable for Phase B.

---

## ADDENDUM 4: PM2 10-Minute Stability Gate

After EACH phase transition (A→B1, B1→B2, B2→C), run this monitoring window:

```bash
#!/bin/bash
echo "=== PM2 Stability Gate: $(date -u) ==="
echo "Monitoring for 10 minutes..."

# Capture initial state
INITIAL_RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
INITIAL_MEMORY=$(pm2 show courtaccess-api 2>/dev/null | grep 'used memory' | awk '{print $NF}')
echo "Initial restarts: $INITIAL_RESTARTS"
echo "Initial memory: $INITIAL_MEMORY"

# Check every 60 seconds for 10 minutes
for i in $(seq 1 10); do
  sleep 60
  STATUS=$(pm2 show courtaccess-api 2>/dev/null | grep 'status' | head -1 | awk '{print $NF}')
  RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
  MEMORY=$(pm2 show courtaccess-api 2>/dev/null | grep 'used memory' | awk '{print $NF}')
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
  echo "[Min $i] status=$STATUS restarts=$RESTARTS memory=$MEMORY health=$HEALTH"

  if [ "$STATUS" != "online" ]; then
    echo "ALERT: Process not online! Investigate immediately."
  fi
  if [ "$RESTARTS" != "$INITIAL_RESTARTS" ]; then
    echo "ALERT: Restart count changed ($INITIAL_RESTARTS → $RESTARTS)!"
  fi
done

# Final check
FINAL_RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
echo ""
echo "=== Stability Gate Result ==="
if [ "$FINAL_RESTARTS" = "$INITIAL_RESTARTS" ]; then
  echo "PASS: Zero restarts in 10 minutes"
else
  echo "FAIL: Restart count changed ($INITIAL_RESTARTS → $FINAL_RESTARTS)"
fi

# Check for unhandled rejections in PM2 logs
REJECTIONS=$(pm2 logs courtaccess-api --lines 200 --nostream 2>&1 | grep -ci 'unhandled\|rejection\|ECONNREFUSED\|FATAL')
if [ "$REJECTIONS" -eq 0 ]; then
  echo "PASS: No unhandled rejections in last 200 log lines"
else
  echo "WARNING: $REJECTIONS potential issues in PM2 logs — review manually"
fi
```

### Stability gate criteria:

| Check | Pass | Fail |
|-------|------|------|
| PM2 restart count | Unchanged | Any increase |
| PM2 status | `online` for all 10 checks | Any non-online |
| Health endpoint | `200` for all 10 checks | Any non-200 |
| Memory growth | < 50MB increase | > 100MB increase |
| Unhandled rejections | 0 in last 200 lines | Any count > 0 |

---

## ADDENDUM 5: Attacker-Style CSRF Security Verification

Run AFTER Phase B2 (CSRF hook enabled):

```bash
echo "=== CSRF Security Verification ==="

# Test 1: Cross-origin POST without Bearer (attacker scenario)
# The Origin header simulates a request from an attacker's site
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/cases \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://evil-attacker.com' \
  -d '{"name":"Attacker Case"}')
echo "Attacker POST (no Bearer, foreign origin): $R"
[ "$R" = "401" ] && echo "  PASS: Auth hook blocks first (401 before CSRF)" || echo "  INVESTIGATE: got $R"

# Test 2: Cross-origin POST with stolen Bearer (attacker has XSS-leaked token)
# This tests whether CSRF provides defense-in-depth beyond Bearer
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/cases \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://evil-attacker.com' \
  -H 'Authorization: Bearer FAKE_TOKEN_HERE' \
  -d '{"name":"Attacker Case"}')
echo "Attacker POST (fake Bearer, foreign origin): $R"
echo "  Note: Bearer bypass means CSRF does not block this — but the fake token fails auth (401)"

# Test 3: Same-origin POST with valid Bearer (legitimate request)
# Replace VALID_TOKEN with a real token from login
VALID_TOKEN="REPLACE_WITH_REAL_TOKEN"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/cases \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://courtaccess.net' \
  -H "Authorization: Bearer $VALID_TOKEN" \
  -d '{"name":"CSRF Test Case","description":"Testing CSRF with valid auth"}')
echo "Legitimate POST (valid Bearer, same origin): $R"
[ "$R" = "200" ] || [ "$R" = "201" ] && echo "  PASS: Legitimate request succeeds" || echo "  INVESTIGATE: got $R"

# Test 4: POST to public route without any auth (should still work)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://courtaccess.net' \
  -d '{"email":"test@test.com","password":"wrong"}')
echo "Public route POST (no Bearer, same origin): $R"
[ "$R" = "401" ] && echo "  PASS: Login fails with wrong creds (not CSRF blocked)" || echo "  INFO: got $R"

# Test 5: POST to public route from foreign origin (should still work — exempt route)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://other-site.com' \
  -d '{"email":"test@test.com","password":"wrong"}')
echo "Public route POST (no Bearer, foreign origin): $R"
echo "  Note: Auth routes are CSRF-exempt, so foreign origin is allowed"
```

---

## ADDENDUM 6: Logging Preservation Requirements

For **every phase transition**, preserve the following BEFORE advancing:

```bash
#!/bin/bash
PHASE=$1  # e.g., "B1", "B2", "C"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
LOGDIR="/var/www/courtaccess_repo/phase-logs/${PHASE}_${TIMESTAMP}"
mkdir -p "$LOGDIR"

# 1. PM2 logs (last 200 lines)
pm2 logs courtaccess-api --lines 200 --nostream > "$LOGDIR/pm2-logs.txt" 2>&1

# 2. PM2 status
pm2 status > "$LOGDIR/pm2-status.txt" 2>&1

# 3. PM2 env
pm2 env $(pm2 id courtaccess-api 2>/dev/null | tr -d '[] ') > "$LOGDIR/pm2-env.txt" 2>&1

# 4. NGINX error log (last 100 lines)
sudo tail -100 /var/log/nginx/error.log > "$LOGDIR/nginx-error.txt" 2>&1
sudo tail -100 /var/log/nginx/access.log > "$LOGDIR/nginx-access.txt" 2>&1

# 5. Validation script output (if run)
# Copy from terminal or redirect output when running

# 6. Health check snapshot
curl -s https://courtaccess.net/api/health > "$LOGDIR/health.json" 2>&1
curl -sI https://courtaccess.net > "$LOGDIR/response-headers.txt" 2>&1

echo "Logs preserved at: $LOGDIR"
ls -la "$LOGDIR"
```

**Browser console output:** After each browser test, open DevTools → Console → right-click → "Save as..." → save to `$LOGDIR/browser-console.txt`

### Log retention structure:
```
/var/www/courtaccess_repo/phase-logs/
├── A_20260510_030000/
│   ├── pm2-logs.txt
│   ├── pm2-status.txt
│   ├── pm2-env.txt
│   ├── nginx-error.txt
│   ├── nginx-access.txt
│   ├── health.json
│   └── response-headers.txt
├── B1_20260510_040000/
│   └── ...
├── B2_20260510_050000/
│   └── ...
└── C_20260510_060000/
    └── ...
```

---

## Go/No-Go Decision Matrix (Updated)

| Phase | Gate | Criteria | Stability Gate | Action if FAIL |
|-------|------|----------|----------------|----------------|
| A→B1 | Post-rotation | Health OK + environment=production + no warnings | 10-min PM2 stable | Restore .env.pre-rotation |
| B1→B2 | Auth hook | All B1-B20 pass + frontend loads + browser tests pass | 10-min PM2 stable | Restore server.ts.pre-auth |
| B2→C | CSRF hook | All CSRF validations pass + attacker tests pass + no 403 on Bearer | 10-min PM2 stable | Comment out CSRF hook only |
| C→D | Auth complete | All C-TEST 1-10 pass + browser validation pass + logs clean | 10-min PM2 stable | Full rollback to pre-auth state |
