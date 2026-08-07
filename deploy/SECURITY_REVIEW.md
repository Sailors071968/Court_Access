# Production security review — Program 175

Risk identification only. Nothing redesigned, nothing implemented, no production
system contacted. Every finding cites a file and line at this commit.

## Summary

The security posture is **better than I expected** and better than most of what
this audit series has found elsewhere. Authentication is JWT with database-backed
refresh tokens and a persisted `SecurityLog`. CSRF protection, rate limiting and
security headers are all registered as hooks. Upload handling has layered
defences — tenant isolation, filename sanitisation, an extension allowlist and a
path-traversal check.

The issues below are real, but none is an open door. The two highest are both
**failures of configuration to be enforced**, not missing controls: the controls
exist and can be silently switched off by an absent environment variable.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 5 |
| Low | 4 |
| Informational | 3 |

---

## HIGH

### S1 · Session signing keys are silently randomised when absent

`security/authMiddleware.ts:59-60`

```ts
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
```

**Risk.** Not a compromise of confidentiality — a random 64-byte key is
cryptographically stronger than most configured ones. The risk is **availability
and auditability**. Every restart invalidates every session, users are signed
out at unpredictable times, and the `SecurityLog` records no cause. In an
application whose audit trail is meant to be evidentiary, sessions ending for
unrecorded reasons is a defect in the record, not just an annoyance.

It also breaks any future multi-instance deployment outright: two processes
would sign with different keys and reject each other's tokens.

**Why it is High rather than Medium:** there is no symptom. Nothing logs it,
nothing reports it, and the service looks perfectly healthy.

### S2 · `COOKIE_SECRET` falls back to a constant published in this repository

`server.ts:113-117`

```ts
secret: process.env.COOKIE_SECRET || 'court-access-cookie-secret-change-in-production',
```

**Risk.** Anyone who can read this repository can forge a signed cookie. Signed
cookies are used for CSRF and refresh-token handling, so this weakens two
controls at once.

Mitigating: it does warn in production (`:114`), unlike S1. A warning in a log
nobody is reading is not a control, but it is more than nothing.

### S3 · `NODE_ENV` silently controls the `secure` cookie flag

`security/authMiddleware.ts:504, 737`, `security/identityRoutes.ts:163`

```ts
httpOnly: true,
secure: process.env.NODE_ENV === 'production',
sameSite: 'strict',
```

The cookie configuration is otherwise correct — `httpOnly` and `sameSite:
'strict'` are both right. But if `NODE_ENV` is anything other than
`production`, **refresh-token cookies are transmitted without the `secure`
flag**, meaning a browser will send them over plain HTTP.

**Why this is High.** The usual symptom of a wrong `NODE_ENV` would be CORS
failures, which are loud. But `server.ts:102` appends `FRONTEND_URL` to the
allowed origins *regardless* of `NODE_ENV`, so with `FRONTEND_URL` set the
application works normally and the insecure cookies go unnoticed. The one loud
symptom is suppressed by an unrelated line.

HSTS is present on the live host (`max-age=31536000; includeSubDomains`,
observed), which mitigates this substantially in practice for browsers that have
already seen the header. It does not help a first visit.

---

## MEDIUM

### S4 · CSRF tokens are stored in-process and lost on every reload

`security/csrfProtection.ts:57`, whose own comment reads
`// Token store (in-memory; production: tie to session store)`.

**Risk.** Every deployment and every `pm2 reload` invalidates all outstanding
CSRF tokens. Users mid-session get CSRF rejections on their next state-changing
request. Not a vulnerability — failing closed is correct — but it is a
self-inflicted outage at exactly the moment of a deployment, and the deployment
procedure reloads at least once.

Also incorrect under cluster mode: a token issued by one worker is unknown to
the others, so validation fails roughly `(n-1)/n` of the time.

### S5 · Rate limiting is per-process and in-memory

`security/rateLimiter.ts:30`

**Risk.** Limits reset on restart, so an attacker who can trigger a restart —
or who simply waits for a deployment — gets a fresh budget. Under cluster mode
the effective limit is multiplied by the worker count, so a configured 100
requests/minute becomes 400 across four workers.

Correct for the current single fork-mode process. Becomes wrong silently the
moment cluster mode is enabled, with no error to indicate it.

Not a leak: cleanup runs every 60 seconds at `:42-51`.

### S6 · Upload directories are created before the traversal check

`evidence/evidenceDirectUpload.ts:654-662`

```ts
const uploadDir = path.join(UPLOAD_DIR, user.tenantId, caseId);
await fs.mkdir(uploadDir, { recursive: true });   // ← runs first
const resolvedLocal = path.resolve(localPath);
const resolvedBase = path.resolve(UPLOAD_DIR);
if (!resolvedLocal.startsWith(resolvedBase + path.sep)) {
  return { ok: false, status: 400, error: 'Invalid filename' };
}
```

**Risk.** The check is correct and no file is written outside the base. But
`mkdir -p` has already run against an unvalidated path, so a crafted `tenantId`
or `caseId` could create empty directories elsewhere on the filesystem.
Both values come from authenticated context, which limits reachability
considerably. The ordering is still wrong.

### S7 · Evidence is world-readable by default

Files are written with `createWriteStream` (`:669`) and directories with
`fs.mkdir` (`:655`), neither specifying a mode. They inherit the process umask,
typically `0644` for files and `0755` for directories.

**Risk.** Any local user on the EC2 instance can read uploaded criminal
discovery. For a single-tenant host with one operator this is low; for a
platform whose entire premise is attorney-authorized privileged material, the
files should be `0600` and the directories `0700`. The database is protected by
credentials, the evidence on disk is not.

### S8 · No antivirus or content scanning on upload

The extension allowlist (`:632`) and the byte-level type re-derivation
(`:645-652`) prevent the *platform* from mishandling a file, but nothing scans
content. A malicious PDF stored and later downloaded by an attorney is passed
through intact.

Program 145 named a "Virus Scan Hook" as part of the pipeline. There is no
implementation of one in `backend/src`.

**Risk.** The threat model matters here: uploads are from authenticated
administrators uploading their own case discovery, not from the public. The
exposure is a defence attorney opening a booby-trapped file that came from
prosecution discovery — plausible, but not an attack on the platform.

---

## LOW

### S9 · A removed endpoint remains in the CSRF exemption list

`security/csrfProtection.ts:46` still lists `/api/auth/debug-check`. The endpoint
itself was removed — `authMiddleware.ts:375-378` explains that it "disclosed the
running auth build and password-hashing configuration to anyone."

Dead configuration, exploitable only if something re-registers that path. Worth
removing so the list stays trustworthy.

### S10 · `HOST` defaults to `0.0.0.0`

`server.ts:61`. The API binds every interface, so port 3000 is reachable
directly — bypassing nginx's TLS termination, security headers and body-size
limit — if the EC2 security group permits it. The security group is UNKNOWN.

Set `HOST=127.0.0.1`. Defence in depth against a security-group
misconfiguration.

### S11 · Login failures log request body keys

`security/authMiddleware.ts:385`

```ts
console.log(`[Auth:Login] REJECTED: missing email or password. body keys=${Object.keys(body || {})}`);
```

Keys, not values, so no credential reaches the log. But it logs an
attacker-influenced value into an unstructured stream — if a client posts a key
containing newlines, the log can be split. Low impact, easy to bound.

### S12 · Password reset links are constructed from `FRONTEND_URL` at call time

`security/authMiddleware.ts:861`, defaulting to `https://courtaccess.net`. Read
per call rather than at load, so a mid-flight change of the variable changes the
links. The default is safe and hardcoded, so this is not host-header injection —
it is a consistency note.

---

## INFORMATIONAL — what is done well

### S13 · Error handling does not leak internals

`server.ts:124-173` is the strongest security-relevant code in the application.
Every unhandled error is logged with a reference, and the client receives a safe
message plus that reference. Prisma error codes are mapped explicitly. The
comment at `:120-123` names the exact risk being defended against — a Prisma
failure serialising the query, source file and surrounding lines to the client.

### S14 · Tenant isolation is enforced at the query, not in the handler

`evidence/evidenceDirectUpload.ts:615-617` scopes the case lookup by
`tenantId: user.tenantId` rather than fetching and then comparing. That is the
right pattern: it cannot be bypassed by forgetting a check, because there is no
separate check to forget.

### S15 · Layered upload defences

Four independent controls, any one of which would be reasonable alone:
`path.basename()` plus `..` stripping (`:627`), an extension allowlist (`:632`),
a resolved-path containment check (`:658-662`), and byte-level type
re-derivation rather than trusting the declared MIME (`:645-652`). The comment
at `:629-631` explains why the extension check has to live here rather than in
the request hook — the request Content-Type is always `multipart/form-data`.

---

## Areas evaluated with no issue found

| Area | Finding |
|---|---|
| JWT structure | Signed, 15-minute access tokens, 7-day refresh, database-backed |
| Session revocation | `RefreshToken` model persists tokens; revocable |
| Cookies | `httpOnly` and `sameSite: 'strict'` both correct |
| CORS | Explicit origin allowlist, `credentials: true`, no wildcard |
| Security headers | HSTS, CSP, `X-Frame-Options`, `nosniff`, COOP, CORP — all observed live |
| Request size | Fastify `bodyLimit` 10 MB for JSON; multipart capped at 500 MB and streamed |
| Directory traversal | Blocked, three ways |
| Audit logging | `SecurityLog` persisted to the database rather than a rotating file |
| Secrets in errors | None observed reaching a client |

---

## Priority

Before deployment: **S1, S2, S3** — all three are configuration-enforcement
problems and all three are addressed by the Program 172 startup validator, which
would refuse to start rather than run with an invented signing key, a published
cookie constant, or a `NODE_ENV` that quietly disables `secure` cookies. One
change closes all three.

Before Case 001: **S7** — the discovery being uploaded is privileged, and
`0644` on disk is the wrong default for it.

Before public beta: **S4, S5** — both become materially wrong under multiple
instances, and both need Redis, which the current deployment does not have.

**S8** deserves a decision rather than a fix: the threat model does not obviously
justify a scanner, but Program 145 promised one, and a promised control that does
not exist is worse than one that was never claimed.
