# CourtAccess — Stage 2 Pre-Execution Analysis

**Purpose:** Complete security-first analysis addressing all 6 pre-execution requests before any production changes are made.

**Critical finding:** NODE_ENV is reporting `"development"` because `server.ts` never imports `dotenv`. This must be fixed FIRST — before auth restoration — because it changes CSP policy, CORS origins, cookie security flags, and Prisma behavior.

---

## 1. Authentication Hook Re-enable Analysis

### Which routes become PROTECTED once `authenticationHook` is enabled

The hook (authMiddleware.ts:251-309) skips routes in the `PUBLIC_ROUTES` list (line 226-238) and all non-`/api/` paths. Everything else under `/api/` requires a valid Bearer token.

**Routes that REMAIN PUBLIC (no auth required):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/metrics` | GET | Prometheus-style metrics |
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/auth/refresh` | POST | Token rotation |
| `/api/auth/logout` | POST | Session invalidation |
| `/api/auth/debug-check` | GET | Deployment verification (should be removed post-hardening) |
| `/api/auth/forgot-password` | POST | Password reset request |
| `/api/auth/reset-password` | POST | Password reset execution |
| `/api/discount-codes/validate` | GET | Public discount code lookup |
| `/api/billing/webhook` | POST | Stripe webhook receiver |

All public route matching uses **prefix-based** comparison (`path === route || path.startsWith(route + '/')`), so `/api/auth/login/anything` would also be public. This is acceptable since the route handlers themselves only match exact paths.

**Routes that become PROTECTED (401 without token):**

Every `/api/` route NOT in the list above, including:
- `/api/cases`, `/api/cases/:id` — case CRUD
- `/api/evidence/*` — evidence management + upload
- `/api/compliance/*` — compliance analysis
- `/api/forensic/*` — forensic reconstruction
- `/api/policy-pipeline/*` — pipeline stats
- `/api/policy-intelligence/*` — intelligence operations
- `/api/operations/*` — operations console
- `/api/admin/*` — admin management
- `/api/security/*` — security logs
- `/api/contradiction/*` — contradiction engine
- `/api/cpra/*` — CPRA management
- `/api/narrative/*` — narrative engine
- `/api/timeline/*` — timeline reconstruction
- `/api/auth/me` — current user info
- `/api/auth/csrf-token` — CSRF token endpoint
- `/api/charges/*` — charge routes
- `/api/calcrim/*` — CALCRIM routes

### Role-based access control (RBAC) enforcement

After authentication, the hook checks `ROUTE_PERMISSIONS` (line 186-204) to enforce role restrictions. Routes with NO explicit permission entry allow ANY authenticated user.

| Route Prefix | Allowed Roles | Denied Roles |
|-------------|---------------|--------------|
| `/api/compliance` | admin, attorney, investigator | staff, defendant |
| `/api/policy-intelligence` | admin, attorney, staff | investigator, defendant |
| `/api/policy-pipeline` | admin, staff | attorney, investigator, defendant |
| `/api/operations` | admin, staff | attorney, investigator, defendant |
| `/api/exhibits` | admin, attorney | investigator, staff, defendant |
| `/api/cpra` | admin, staff | attorney, investigator, defendant |
| `/api/crawler` | admin only | all others |
| `/api/forensic` | admin, attorney, investigator | staff, defendant |
| `/api/forensic/expert-package` | admin, attorney | investigator, staff, defendant |
| `/api/forensic/jury-view` | admin, attorney | investigator, staff, defendant |
| `/api/admin/discount-codes` | admin, staff | attorney, investigator, defendant |
| `/api/admin/stats` | admin, staff | attorney, investigator, defendant |
| `/api/admin/users` | admin, staff | attorney, investigator, defendant |
| `/api/admin/cases` | admin, staff | attorney, investigator, defendant |
| `/api/admin/evidence` | admin, staff | attorney, investigator, defendant |
| `/api/admin` (catch-all) | admin only | all others |
| `/api/security` | admin only | all others |
| All other `/api/` routes | ANY authenticated user | unauthenticated only |

### Will frontend boot/login/register break?

**NO.** The frontend (`authStore.ts`) uses:
- `POST /api/auth/login` — PUBLIC
- `POST /api/auth/register` — PUBLIC
- `POST /api/auth/logout` — PUBLIC (fire-and-forget, works with or without token)
- All other API calls include `Authorization: Bearer <token>` from localStorage

The frontend SPA itself is served by NGINX (static files), not by the API server, so it loads regardless of auth middleware state.

**One edge case:** If a user's access token is expired and they navigate to a protected page, API calls will return 401. The frontend does NOT currently have an automatic token refresh interceptor — it stores the refresh token but never auto-refreshes. Users will need to re-login when their 15-minute access token expires. This is a pre-existing limitation, not introduced by enabling the hook.

### Do any admin routes rely on hooks being disabled?

**YES — currently all admin routes are accessible without authentication.** Once the hook is enabled:
- `/api/admin/stats`, `/api/admin/users`, `/api/admin/cases` require `admin` or `staff` role
- `/api/admin/queues` falls under the `/api/admin` catch-all (admin only)
- `/api/security/log`, `/api/security/logs`, `/api/security/summary` require admin only

This is correct behavior. No functionality breaks — it just becomes properly secured.

---

## 2. CSRF Restoration Risk Analysis

### Bearer-token bypass behavior

**CONFIRMED SAFE.** The CSRF hook (csrfProtection.ts:156-162) explicitly checks for Bearer tokens FIRST:

```typescript
const authHeader = request.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
  return; // ← bypasses ALL CSRF validation
}
```

Since the frontend exclusively uses Bearer tokens for all authenticated requests, enabling CSRF will NOT block any frontend API calls.

### Do any browser form uploads depend on CSRF cookies?

**NO.** Evidence uploads use XHR with explicit Bearer token header (caseApi.ts:454-455):

```typescript
xhr.open('POST', `${API_BASE}/evidence/upload`, true);
if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
```

This triggers the Bearer bypass in the CSRF hook. No `<form>` submissions or `fetch()` calls rely on cookie-based session auth.

### Are evidence upload endpoints impacted?

**NO.** Evidence upload uses `@fastify/multipart` with Bearer token auth. The CSRF hook:
1. Checks if method is POST/PUT/DELETE/PATCH → YES for upload
2. Checks if route is in CSRF_EXEMPT_ROUTES → NO (upload is not exempt)
3. **Checks for Bearer token → YES → BYPASSES** (returns immediately)

### Do multipart uploads require exemptions?

**NO.** The multipart `Content-Type` header is not inspected by the CSRF hook. The Bearer token in the `Authorization` header is sufficient to bypass CSRF. No exemptions needed.

### CSRF-exempt routes for reference

These POST routes skip CSRF entirely regardless of auth method:
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/debug-check`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/health`
- `/api/billing/webhook`

### Summary: CSRF can be safely enabled with zero frontend changes.

---

## 3. Secret Rotation Safety

### Will existing refresh tokens/sessions be invalidated?

**YES — completely.** Here's why:

1. **Access tokens** (15min expiry): Signed with `JWT_SECRET`. Rotating this secret means `jwt.verify()` will throw `JsonWebTokenError: invalid signature` for ALL existing access tokens. Users see `401 Invalid or expired token`.

2. **Refresh tokens** (7 day expiry): Signed with `JWT_REFRESH_SECRET`. Rotating this means `jwt.verify()` fails for existing refresh tokens. The `/api/auth/refresh` endpoint returns an error. Users must re-login.

3. **Cookie secret**: Used by `@fastify/cookie` for signed cookies. Rotating invalidates signed cookie values. The `_session` and `_csrf` cookies become unverifiable. This is harmless — they'll be re-created on next CSRF token request.

### Staged rotation strategy

**Recommended: Rotate all three at once.** There's no benefit to rotating separately because:
- Access tokens are short-lived (15min) — most will expire naturally within one rotation window
- Refresh tokens are in PostgreSQL — they'll fail JWT verification, so the DB records become inert
- Cookie secret rotation only affects CSRF (which is currently disabled anyway)

**However, this MUST happen AFTER the NODE_ENV fix** because:
- If NODE_ENV is not "production", the COOKIE_SECRET warning won't fire
- If NODE_ENV is not "production", cookie `Secure` flags won't be set
- If NODE_ENV is not "production", CSP uses the development policy (allows `unsafe-inline`, `unsafe-eval`)

### Frontend logout behavior after rotation

**Clean degradation.** The frontend:
1. Stores `accessToken` and `refreshToken` in localStorage
2. On API call → sends Bearer token → gets 401
3. Frontend does NOT auto-refresh — user sees an error or is redirected to login
4. User clicks login → gets fresh tokens signed with new secret
5. Old localStorage tokens are overwritten with new ones

**No action required from users beyond re-logging in.** There is no "stuck state" because the login endpoint itself is public and doesn't require an existing valid token.

### Timing recommendation

Rotate secrets during **low-traffic hours** to minimize the number of active sessions that get interrupted. Inform users in advance if possible.

---

## 4. NODE_ENV Investigation

### Why `/api/health` reports `"environment":"development"`

**ROOT CAUSE: `server.ts` never imports `dotenv`.** The `.env` file at `backend/.env` is never read.

Here is the chain of evidence:

1. **server.ts** (line 111): `environment: process.env.NODE_ENV || 'development'`
2. **server.ts** imports: No `dotenv` import anywhere in the file
3. **PM2 start command** (used during Stage 1): `pm2 start npx --name courtaccess-api -- tsx backend/src/server.ts`
   - This runs `tsx backend/src/server.ts` directly
   - `tsx` does NOT auto-load `.env` files
   - No `-r dotenv/config` preload flag was specified
4. **PM2 env block** (root ecosystem.config.cjs line 19): Sets `NODE_ENV: 'production'` — but this only applies if you start via `pm2 start ecosystem.config.cjs`

**Contrast with the backend ecosystem config** (`backend/ecosystem.config.cjs`):
- Line 5: `require("dotenv").config();` — loads .env into the config file itself
- Line 17: `interpreter_args: "tsx -r dotenv/config"` — preloads dotenv before server.ts
- Line 31: `DOTENV_CONFIG_PATH: "/var/www/courtaccess/backend/.env"` — explicit path

But this file points to the OLD path (`/var/www/courtaccess/backend`), not the repo path (`/var/www/courtaccess_repo/backend`).

### Current security behavior under `development` mode

| Feature | Development Mode (current) | Production Mode (desired) |
|---------|---------------------------|--------------------------|
| **CSP** | Allows `unsafe-inline`, `unsafe-eval`, `localhost:*` | Strict: `self` only, `courtaccess.net` domains |
| **CORS** | `localhost:5173`, `localhost:4173`, `localhost:3000` | `courtaccess.net`, `www.courtaccess.net`, `beta.courtaccess.net` |
| **Cookie Secure flag** | `false` (cookies sent over HTTP) | `true` (cookies require HTTPS) |
| **Cookie warning** | No warning (only fires in production) | Warns if COOKIE_SECRET missing |
| **Prisma logging** | `['warn', 'error']` verbose | `['error']` only |
| **Prisma global cache** | Attached to `globalThis` | NOT cached on globalThis |

**This is a critical security gap.** In development mode:
- Cookies are not marked `Secure`, meaning they'd be sent over plain HTTP
- CSP allows `unsafe-inline` and `unsafe-eval` (XSS vector)
- CORS allows localhost origins (not useful in production, but not harmful behind Cloudflare)

### How to fix

**Option 1 (recommended): Fix PM2 startup to inject NODE_ENV**

```bash
# Kill current process
pm2 delete courtaccess-api

# Restart with explicit env and dotenv preload
cd /var/www/courtaccess_repo
NODE_ENV=production pm2 start npx \
  --name courtaccess-api \
  --cwd /var/www/courtaccess_repo \
  --node-args="-r dotenv/config" \
  -- tsx backend/src/server.ts

# Or use the ecosystem.config.cjs (after updating paths)
pm2 start ecosystem.config.cjs --only courtaccess-api
```

**Option 2 (belt and suspenders): Also add dotenv import to server.ts**

Add at the very top of `backend/src/server.ts` (before any other imports):

```typescript
import 'dotenv/config';
```

This ensures `.env` is loaded regardless of how the server is started (PM2, direct tsx, etc.). This is the most reliable fix because it doesn't depend on the PM2 startup command being exactly right.

**Recommendation: Do BOTH.** Add the import to server.ts AND fix the PM2 startup. Belt and suspenders for a production system.

### Dotenv resolution path

When `dotenv/config` is imported from `backend/src/server.ts`, dotenv searches for `.env` starting from `process.cwd()`. If PM2 sets `--cwd /var/www/courtaccess_repo`, then dotenv looks for `/var/www/courtaccess_repo/.env`. But the actual `.env` is at `/var/www/courtaccess_repo/backend/.env`.

**Fix: Set `DOTENV_CONFIG_PATH` explicitly in PM2 env:**

```javascript
env: {
  DOTENV_CONFIG_PATH: '/var/www/courtaccess_repo/backend/.env',
}
```

Or better: use `dotenv.config({ path: ... })` in server.ts with a relative path:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
```

This resolves from `backend/src/server.ts` → `backend/.env` regardless of cwd.

---

## 5. PM2 Production Migration Plan

### Updated ecosystem.config.cjs

The root `ecosystem.config.cjs` needs updating for the repo path and proper env injection. Here is the production-safe version for Stage 2 (API only, workers disabled):

```javascript
// ecosystem.config.cjs — Stage 2 (API only)
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'courtaccess-api',
      script: 'npx',
      args: 'tsx backend/src/server.ts',
      cwd: '/var/www/courtaccess_repo',

      // Ensure dotenv loads the .env file
      interpreter_args: '',
      node_args: '-r dotenv/config',

      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: '0.0.0.0',
        DOTENV_CONFIG_PATH: '/var/www/courtaccess_repo/backend/.env',
        DISABLE_WORKERS: 'true',
        SKIP_SCHEMA_ASSERT: 'true',
        CPRA_SIMULATION_MODE: 'true',
      },

      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      error_file: '/var/log/pm2/courtaccess-api-error.log',
      out_file: '/var/log/pm2/courtaccess-api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

### Production-safe PM2 startup command

```bash
# Ensure log directory exists
sudo mkdir -p /var/log/pm2 && sudo chown $(whoami):$(whoami) /var/log/pm2

# Delete any existing processes
pm2 delete all

# Start from ecosystem config
cd /var/www/courtaccess_repo
pm2 start ecosystem.config.cjs --only courtaccess-api

# Save and configure startup
pm2 save
pm2 startup
# Run the sudo command it outputs
pm2 save --force
```

### Env injection strategy

**Three layers of env injection (defense in depth):**

1. **`dotenv/config` import in server.ts** — reads `backend/.env` at boot (code-level)
2. **PM2 `env` block** — sets critical vars like `NODE_ENV`, `PORT`, safety flags (process-level)
3. **`DOTENV_CONFIG_PATH`** — tells dotenv exactly where to find `.env` (path-level)

PM2's `env` block values take precedence over `.env` file values (because PM2 sets them as actual environment variables before the process starts, and dotenv only sets vars that don't already exist).

### Memory restart ceilings

| Process | Recommended | Rationale |
|---------|-------------|-----------|
| courtaccess-api | 512M | Handles all API routes, Prisma connections, file processing |
| CPRA workers | 256M each | Lightweight email/ingestion processing |
| Contradiction worker | 256M | Text analysis, bounded input size |
| Video processing worker | 512M | Handles video file parsing |

### Structured log output strategy

Fastify has built-in JSON logging (already enabled with `logger: true` in server.ts:51). PM2 captures stdout/stderr to log files. Combined with `pm2-logrotate`:

```bash
# Install log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

Logs will be at:
- `/var/log/pm2/courtaccess-api-out.log` — application logs (JSON from Fastify)
- `/var/log/pm2/courtaccess-api-error.log` — stderr/crashes

For structured log queries:
```bash
# Recent errors
cat /var/log/pm2/courtaccess-api-out.log | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        if d.get('level', 0) >= 50:  # error level
            print(json.dumps(d, indent=2))
    except: pass
"
```

---

## 6. Pre-Auth Snapshot Procedure

Execute these commands BEFORE making any auth or security changes.

### 6A. Backup backend .env

```bash
cp /var/www/courtaccess_repo/backend/.env \
   /var/www/courtaccess_repo/backend/.env.pre-auth-snapshot
```

### 6B. Export current PM2 config

```bash
pm2 save
pm2 prettylist > /var/www/courtaccess_repo/pm2-pre-auth-snapshot.json
```

### 6C. Backup nginx.conf

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-auth-snapshot
```

### 6D. Backup server.ts (current commented-out state)

```bash
cp /var/www/courtaccess_repo/backend/src/server.ts \
   /var/www/courtaccess_repo/backend/src/server.ts.pre-auth-snapshot
```

### 6E. Create tarball archive

```bash
cd /var/www
sudo tar czf courtaccess_pre-auth-snapshot.tar.gz \
  courtaccess_repo/backend/.env \
  courtaccess_repo/backend/src/server.ts \
  courtaccess_repo/ecosystem.config.cjs
```

### 6F. Rollback commands (if anything goes wrong)

```bash
# === FULL ROLLBACK TO PRE-AUTH STATE ===

# 1. Restore server.ts (hooks commented out)
cp /var/www/courtaccess_repo/backend/src/server.ts.pre-auth-snapshot \
   /var/www/courtaccess_repo/backend/src/server.ts

# 2. Restore .env
cp /var/www/courtaccess_repo/backend/.env.pre-auth-snapshot \
   /var/www/courtaccess_repo/backend/.env

# 3. Restart PM2
pm2 restart courtaccess-api

# 4. Verify
sleep 3
curl -s https://courtaccess.net/api/health
pm2 logs courtaccess-api --lines 10 --nostream

# 5. Restore nginx if changed
sudo cp /etc/nginx/nginx.conf.pre-auth-snapshot /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## Revised Execution Order (incorporating findings)

Based on the NODE_ENV discovery, the execution order MUST be adjusted:

### Phase 0 (NEW — PREREQUISITE): Fix NODE_ENV + dotenv loading

This is now the **blocking prerequisite** before anything else, because:
- Secret rotation is meaningless if .env isn't loaded (secrets stay as random fallbacks)
- Cookie `Secure` flag is `false` in development mode
- CSP is permissive in development mode
- CORS allows localhost in development mode

**Steps:**
1. Take pre-auth snapshot (Section 6 above)
2. Add `dotenv` import to server.ts (code change)
3. Update ecosystem.config.cjs with correct paths + `DOTENV_CONFIG_PATH`
4. Restart via ecosystem config
5. Verify `/api/health` returns `"environment":"production"`
6. Verify CORS rejects localhost origins
7. Verify CSP header is production-strict

### Phase A: Secret Rotation
(As previously documented — but now .env is actually loaded)

### Phase B: Auth Hook Restoration
(As previously documented)

### Phase C: Auth Validation
(As previously documented)

### Phase D-F: Redis, OCR, Hardening
(As previously documented, after A-C confirmed stable)

---

## Summary of Findings

| # | Question | Answer | Risk |
|---|----------|--------|------|
| 1 | Routes protected by auth hook | All `/api/` except 11 public routes | LOW — frontend uses Bearer tokens |
| 1 | Frontend breaks on auth enable? | NO — login/register are public, all other calls use Bearer | NONE |
| 1 | Admin routes affected? | YES — properly secured behind role checks | CORRECT BEHAVIOR |
| 2 | CSRF blocks Bearer requests? | NO — explicit Bearer bypass (line 156-162) | NONE |
| 2 | Multipart uploads affected? | NO — uses Bearer auth, not cookies | NONE |
| 2 | Any CSRF exemptions needed? | NO — all existing exemptions are sufficient | NONE |
| 3 | Secrets rotation invalidates sessions? | YES — all tokens invalidated, users must re-login | EXPECTED |
| 3 | Frontend handles invalidation? | YES — gets 401, user re-logins, gets new tokens | CLEAN |
| 3 | Staged rotation needed? | NO — rotate all three at once | SIMPLEST |
| 4 | Why NODE_ENV = development? | server.ts never imports dotenv; PM2 not passing env | **CRITICAL** |
| 4 | Security impact? | CSP permissive, cookies not Secure, CORS allows localhost | **HIGH** |
| 4 | Fix required before auth? | **YES — MUST fix first** | BLOCKING |
| 5 | PM2 ecosystem config ready? | YES — updated for repo paths + dotenv | READY |
| 6 | Rollback procedure documented? | YES — snapshot + restore commands | READY |
