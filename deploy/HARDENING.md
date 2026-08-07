# Production hardening — Programs 170, 171, 172

Analysis only. Nothing here is implemented, and no production system was
contacted. Every finding cites a file and line at this commit.

**On effort estimates.** The programs ask for implementation time. I give
change size instead — which files, how many lines, whether the boot path is
touched, whether tests are needed. Calendar estimates for work I am not
performing would be invented numbers, and the boot-path items are risky in a way
that hours do not capture.

| Size | Meaning |
|---|---|
| **S** | One file, under ~30 lines, no new dependency |
| **M** | Two to four files, or a new module under ~200 lines |
| **L** | Touches the boot path or many call sites; needs its own test pass |

---

# PROGRAM 170 — Production hardening items

## REQUIRED

### H1 · Missing JWT secrets fail silently — `security/authMiddleware.ts:59-60`

```ts
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
```

**Why:** a signing key is not something to guess at. If the variable is absent
the application invents one and starts normally.

**Risk:** every restart invalidates every access and refresh token. All users
are signed out, at unpredictable times, with **no log line and no server-side
symptom**. Login continues to work, so monitoring sees nothing. Under PM2 this
recurs on every reload. Four lines away, `COOKIE_SECRET` at `server.ts:113`
warns in the same situation — the signing keys do not.

**Change:** exit non-zero when either is absent and `NODE_ENV=production`.
Keep the random fallback for development. **Size S**, but it is boot-path, so
verify a deliberate absence exits 1 rather than hanging.

### H2 · The schema guard cannot function in the bundle — `database/schemaAssert.ts:24, 59, 178`

`server.ts:82` calls `enforceSchemaOnBoot()` to hard-fail on drift or pending
migrations. In the deployed bundle it cannot.

Each site resolves `resolve(__dirname, '../../prisma')`. esbuild shims
`__dirname` from `import.meta.url` (`dist/index.js:42464-42465`), so at runtime
`__dirname` is `/var/www/courtaccess/dist` and the path becomes
`/var/www/prisma` — which does not exist. Correct from source, where the file
sits at `backend/src/database/`; wrong for a bundle whose entry point is one
level below the application root.

**Risk:** every read is individually guarded, so nothing throws. The check
degrades to a bare connectivity test and then reports success. It **cannot
detect a pending migration or a drifted schema**, which is its only purpose.
`computeMigrationChecksum()` returns the literal `'no-migrations'` (`:44`),
`countPendingMigrations()` returns `{0,0,[]}` (`:69`), `findMissingColumns()`
returns `[]` (`:180`).

Visible in the startup log as `Checksum: no-migrations` and
`Migrations: 0/0 applied` where a working check prints `30/30 applied`.

**Change:** try `../prisma` before `../../prisma` so one code path serves both
layouts. **Size S** in lines, **L** in care — it is the boot path, and it must
be tested from both a source checkout and an assembled release.

### H3 · Graceful shutdown drops in-flight requests — `server.ts:474-481`

```ts
const shutdown = async (signal: string) => {
  stopRedisMemoryMonitor();
  await stopPipelineWorkers();
  process.exit(0);
};
```

**Why:** `app.close()` is never called, and neither is `prisma.$disconnect()`.

**Risk:** on every `pm2 reload`, in-flight HTTP requests are terminated
mid-response. For a GET that is a retry. **For a multi-gigabyte evidence upload
it is a corrupted or partial file**, and the deployment procedure reloads at
least once. Database connections are also dropped rather than released.

**Change:** `await app.close()` before `process.exit(0)`, then
`await prisma.$disconnect()`, with a timeout so a stuck request cannot block
shutdown forever. The Fastify instance is currently local to `startServer()`
and must be hoisted. **Size M.**

### H4 · Startup failures are not uniformly fatal — `server.ts:80-82, 379, 471`

The `try` block begins at line 379. `enforceSchemaOnBoot()` runs at line 82,
outside it, and `startServer()` is invoked at line 471 with no `.catch()`.

**Risk:** anything that throws between lines 80 and 379 becomes an unhandled
rejection, which the handler at line 67 **logs and survives**. The result is a
live process with no HTTP listener — PM2 reports `online`, the restart count
stays at zero, and nothing serves. That is worse than a crash loop, which is at
least visible.

In practice the paths inside `assertSchemaIntegrity` are individually guarded,
so this is latent rather than active. It is one unguarded `await` away from
being real.

**Change:** wrap the whole of `startServer()`, and add
`startServer().catch(err => { console.error(err); process.exit(1); })`.
**Size S.**

### H5 · No configuration validation before the server starts

See Program 172. Nothing verifies that required variables are present, that
directories are writable, or that the Node version matches the build target.

**Risk:** each missing item fails later, separately, and with a symptom that
does not name the cause. A missing `EVIDENCE_UPLOAD_DIR` is discovered when the
first upload lands in the wrong place — after the discovery has been uploaded.

**Change:** a single validator module. **Size M.** Design in Program 172.

## RECOMMENDED

### H6 · OpenAI calls have no timeout — `cpra/services/cpraClassificationEngine.ts:66-79`

A bare `fetch` with no `AbortSignal`. Every other outbound call in the codebase
has one: leginfo uses `AbortSignal.timeout(30000)`
(`law/officialLawSource.ts:255`), ffprobe passes `timeout` (`mediaProbe.ts:33,
61, 200, 214`), the timeline pipeline enforces five minutes
(`timelineReconstructionService.ts:216`), text extraction sixty seconds
(`evidenceTextExtractionService.ts:102-111`).

**Risk:** a hung connection holds the request, and its database connection, for
as long as the socket stays open. **Size S.** Full design in Program 176.

### H7 · Rate limiting is per-process and in-memory — `security/rateLimiter.ts:30`

`const rateLimitStores: Map<string, Map<string, RateLimitEntry>> = new Map();`

**Risk:** limits reset on every reload, so a deployment clears them. In cluster
mode each worker keeps its own counters and the effective limit is multiplied by
the instance count. Not a leak — cleanup runs every 60 s at `:42-51` — but not
a real limit either.

Acceptable for a single fork-mode process, which is what production runs.
Becomes wrong the moment cluster mode is enabled. **Size M**, and it needs
Redis, which is currently absent.

### H8 · Directories are created before the traversal check — `evidence/evidenceDirectUpload.ts:654-662`

```ts
const uploadDir = path.join(UPLOAD_DIR, user.tenantId, caseId);
await fs.mkdir(uploadDir, { recursive: true });     // line 655
// … traversal check at 658-662
```

The check is correct and rejects the request. But `mkdir` already ran, so a
crafted `tenantId` or `caseId` can create empty directories outside the upload
root before being refused. No file is written.

**Risk:** low — directory creation only, and both values come from
authenticated context. Still the wrong order. **Size S:** move the check above
the `mkdir`.

### H9 · No memory ceiling under PM2

Nothing sets `max_memory_restart`. The bundle idles around 275 MB resident
(observed under PM2 in rehearsal) and OCR over a large corpus will exceed that.

**Risk:** a leak or a pathological document grows until the kernel OOM-killer
intervenes, which is abrupt and leaves no diagnostic. A PM2 ceiling restarts
cleanly and logs it. **Size S** — one PM2 flag, no code change.

### H10 · Upload recovery is not verified across a restart — `certification/uploadPortal.ts:21`

Chunks assemble under `CERTIFICATION_STAGING_DIR`, default
`/var/tmp/courtaccess-certification-staging`. Two gaps: `/var/tmp` is not
guaranteed to survive a reboot on all distributions, and nothing prunes
abandoned partial uploads.

**Risk:** a 40 GB corpus interrupted at 90% may not be resumable, and orphaned
chunks accumulate until the disk fills. Resume has never been tested across a
process restart. **Size M**, plus a test.

## OPTIONAL

### H11 · No structured request correlation ID

Fastify's `logger: true` gives each request a `reqId`, and the error handler
mints an 8-character `reference` (`server.ts:126`) returned to the client. But
the reference exists only on the error path, so a slow or wrong-but-successful
request cannot be traced. **Size M.** Program 174.

### H12 · `CERTIFICATION_REPORTS_DIR` defaults into `/workspace` — `certification/readinessService.ts:19`

A development path that will not exist in production. The read is caught
(`:64`), so the readiness view silently reports no suites. Same class as the
hardcoded `/workspace` git path already fixed on this branch. **Size S.**

### H13 · `console.log` and Fastify's logger are used side by side

Startup and worker logs go through `console.*`; request logs go through Pino.
Two formats in one stream makes log shipping awkward. **Size M.** Program 174.

---

# PROGRAM 171 — Environment variable requirements

Full derivation in [`ENV_TRACE.md`](ENV_TRACE.md). This is the recommendation
layer.

## Every variable, with startup behaviour

| Variable | Required | Default | If missing at startup | Security impact | Runtime impact | Should startup fail? |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | none | `process.exit(1)` via `schemaAssert.ts:330` | none | Nothing works | **Already does** |
| `JWT_SECRET` | **Yes** | **random** | Starts silently | **High** | Everyone signed out on every restart | **YES — change this** |
| `JWT_REFRESH_SECRET` | **Yes** | **random** | Starts silently | **High** | Same | **YES — change this** |
| `COOKIE_SECRET` | **Yes** | **published constant** | Warns, continues | **High** | Cookie signatures forgeable | **YES — change this** |
| `NODE_ENV` | **Yes** | `development` | Starts | **High** | Cookies lose `secure`; CORS narrows | **YES — require `production`** |
| `PORT` | **Yes here** | `3001` | Binds 3001 | none | 502 behind nginx | Warn if not 3000 |
| `HOST` | Recommended | `0.0.0.0` | Binds all interfaces | **Medium** | API reachable bypassing nginx | Warn in production |
| `FRONTEND_URL` | Yes | `https://courtaccess.net` | Starts | Low | CORS rejection | Warn |
| `EVIDENCE_UPLOAD_DIR` | **Yes here** | inside `$APP` | Starts | none | **Evidence destroyed by next deploy** | **YES in production** |
| `CERTIFICATION_STAGING_DIR` | Recommended | `/var/tmp/…` | Starts | none | Safe default | No |
| `DISABLE_WORKERS` | Yes here | unset | Workers start | none | ~17,280 log lines/day | No |
| `REDIS_URL` | No | `redis://localhost:6379` | Starts | none | Queue features unavailable | No |
| `REDIS_HOST` / `REDIS_PORT` | No | `localhost` / `6379` | Starts | none | Separate from `REDIS_URL` | No |
| `OPENAI_API_KEY` | No | none | Starts | none | Heuristic fallback | No |
| `CERTIFICATION_REPORTS_DIR` | No | `/workspace/…` | Starts | none | Readiness reports empty | No |
| `HEALTH_RSS_LIMIT_MB` | No | heap limit × 1.5 | Starts | none | Health thresholds | No |
| `LAW_CACHE_MAX_AGE_MS` | No | 24 h | Starts | none | Cache staleness | No |
| `LEGINFO_MIN_GAP_MS` | No | 400 ms | Starts | none | Politeness to a public service | No |
| `NEO4J_URI` | No | `bolt://localhost:7687` | Starts, lazy | none | Policy graph unavailable | No |

## Unsafe defaults

Four, ranked by consequence.

**1. `JWT_SECRET` and `JWT_REFRESH_SECRET` → random per process.** The worst of
the four, because it is the only one with *no symptom*. The application is
indistinguishable from a correctly configured one until users start being
signed out. `authMiddleware.ts:59-60`.

**2. `COOKIE_SECRET` → `'court-access-cookie-secret-change-in-production'`.**
A constant published in this repository. Anyone who reads the source can forge a
signed cookie. It does warn (`server.ts:114`), which is better than the JWT
keys, but a warning in a log nobody reads is not a control. `server.ts:117`.

**3. `NODE_ENV` → `development`.** Drives at least nine behaviours. The one that
matters is `secure: process.env.NODE_ENV === 'production'` on cookies
(`authMiddleware.ts:504, 737`, `identityRoutes.ts:163`) — without it, session
cookies are transmitted over plain HTTP. Because `FRONTEND_URL` is appended to
CORS regardless (`server.ts:102`), the usual symptom of a wrong `NODE_ENV` —
CORS failures — **does not appear**, so the insecure cookies go unnoticed.

**4. `EVIDENCE_UPLOAD_DIR` → `/var/www/courtaccess/uploads/evidence`.** Inside
the directory a deployment replaces. Not a security issue; a data-loss one, and
the data is privileged criminal discovery. `evidenceDirectUpload.ts:40`.

`HOST → 0.0.0.0` is a fifth, milder case: it binds every interface, so port 3000
is reachable directly if the security group permits, bypassing nginx's TLS,
headers and rate limits.

## Recommended to become mandatory in production

Fail startup when `NODE_ENV=production` and any of these is absent:

| Variable | Rationale |
|---|---|
| `DATABASE_URL` | Already fatal; keep |
| `JWT_SECRET` | Silent session destruction |
| `JWT_REFRESH_SECRET` | Same |
| `COOKIE_SECRET` | Published fallback constant |
| `EVIDENCE_UPLOAD_DIR` | Prevents evidence loss on the next deployment |

Warn but continue:

| Variable | Rationale |
|---|---|
| `PORT` not `3000` | Correct for other topologies; wrong for this one |
| `HOST` not `127.0.0.1` | Legitimate in some topologies |
| `FRONTEND_URL` absent | Has a sane default |
| `DISABLE_WORKERS` unset with Redis unreachable | Predicts the log flood |

**One caution about making things fatal.** Every variable moved into the fatal
set is a new way for the service to refuse to start. That is the right trade for
a signing key — a service that will not start is better than one that silently
signs everybody out — but the validator must name the variable and say what to
set, or a 3 a.m. restart turns into an outage of unknown cause.

---

# PROGRAM 172 — Production startup validator

## Design

A new module, `backend/src/startup/validateEnvironment.ts`, called from
`server.ts` **before** `enforceSchemaOnBoot()` and before Fastify is
constructed.

### Result model

```ts
type Level = 'PASS' | 'WARNING' | 'FAIL';

interface CheckResult {
  name: string;
  level: Level;
  message: string;      // what was found
  remedy?: string;      // what to set, exactly
}

interface ValidationReport {
  overall: Level;        // FAIL if any FAIL; WARNING if any WARNING
  checks: CheckResult[];
  nodeVersion: string;
  environment: string;
}
```

`FAIL` only when `NODE_ENV=production`. In development the same conditions
report `WARNING`, so nobody has to populate a full production environment to run
tests.

### The checks

| # | Check | PASS | WARNING | FAIL |
|---|---|---|---|---|
| 1 | Node version | ≥ 22 | 20–21 | < 20 |
| 2 | `NODE_ENV` | `production` | `staging` | unset or `development` on a production host |
| 3 | `DATABASE_URL` | set and parses | — | absent or unparseable |
| 4 | Database connectivity | `SELECT 1` under 1 s | 1–5 s | unreachable |
| 5 | Migrations | 0 pending, 0 failed | checksum unavailable | pending or failed |
| 6 | `JWT_SECRET` | ≥ 32 chars | 16–31 chars | absent or < 16 |
| 7 | `JWT_REFRESH_SECRET` | ≥ 32 chars | 16–31 | absent |
| 8 | `COOKIE_SECRET` | set, not the fallback | — | absent or equal to the fallback |
| 9 | `PORT` | 3000 | any other value | not a number |
| 10 | `HOST` | `127.0.0.1` | `0.0.0.0` in production | — |
| 11 | Uploads directory | exists, writable, outside the app dir | exists but inside the app dir | not writable |
| 12 | Staging directory | exists, writable | created on demand | not writable |
| 13 | Disk space | > 20 GB free | 5–20 GB | < 5 GB |
| 14 | `OPENAI_API_KEY` | set | **absent — WARNING, never FAIL** | — |
| 15 | Redis | reachable, or `DISABLE_WORKERS=true` | unreachable and workers disabled | unreachable and workers **enabled** |

Two of these deserve comment.

**Check 11** is the one that would have caught a real defect. "Writable" is not
enough — verify the resolved path is **not inside the application directory**,
because that is where the default puts it and where a deployment destroys it.
Implement by writing and deleting a probe file, not by reading permission bits,
which say nothing about ACLs or a read-only mount.

**Check 15** inverts the usual logic. Redis being unreachable is fine; Redis
being unreachable *while five workers are trying to reach it* is the failure.

### Output

```
[Startup] Validating production environment…

  PASS     node version              v22.14.0
  PASS     NODE_ENV                  production
  PASS     DATABASE_URL              set
  PASS     database connectivity     42 ms
  PASS     migrations                30/30 applied, 0 pending
  FAIL     JWT_SECRET                not set
           → Set JWT_SECRET to a random value of at least 32 characters.
             Changing it signs out every existing session.
  PASS     COOKIE_SECRET             set
  WARNING  HOST                      0.0.0.0 — the API is reachable
                                     bypassing nginx. Set 127.0.0.1.
  PASS     uploads directory         /var/lib/courtaccess/evidence writable
  PASS     disk space                104 GB free
  WARNING  OPENAI_API_KEY            not set — AI classification will use
                                     heuristics
  PASS     redis                     unreachable, workers disabled

[Startup] FAILED — 1 fatal, 2 warnings. Server will not start.
```

Every `FAIL` names the variable and the remedy. A validator that prints
`Configuration invalid` and exits has moved the diagnosis problem rather than
solved it.

## Implementation steps

1. **Create `backend/src/startup/validateEnvironment.ts`** exporting
   `validateEnvironment(): Promise<ValidationReport>`. Pure checks, no side
   effects beyond the writability probe. **Size M**, roughly 250 lines.

2. **Reuse, do not duplicate.** Checks 4 and 5 are already implemented in
   `database/schemaAssert.ts` — `assertSchemaIntegrity()` returns pending and
   failed migrations. Import it rather than writing a second version that can
   disagree with the first.

3. **Fix H2 first.** The migration check is worthless until the Prisma path
   resolves in the bundle. Sequence matters: H2, then the validator.

4. **Call it from `server.ts`**, first statement inside `startServer()`, before
   `enforceSchemaOnBoot()`:

   ```ts
   const report = await validateEnvironment();
   printValidationReport(report);
   if (report.overall === 'FAIL') process.exit(1);
   ```

5. **Add `--validate-only`.** Invoked as `node dist/index.js --validate-only`,
   run the checks, print, exit with 0 or 1, never bind a port. This is what makes
   the validator useful during deployment: it can be run against the staged
   release **before** cut-over, which is exactly where you want to learn that
   `JWT_SECRET` is missing.

6. **Wire it into the runbook** as a new step between F1 and F2 — the smoke test
   already starts the release on a spare port, so `--validate-only` costs
   nothing and checks more.

7. **Test the failure paths**, not just the happy one. Each `FAIL` condition
   deliberately triggered, confirming exit code 1 and a message naming the
   remedy. Then confirm a fully configured environment reports all `PASS` and
   the server starts normally. **Size M** for the tests, and they matter more
   than the validator, because a validator that wrongly fails is an outage.

## What this does not solve

The validator runs at startup, so it catches configuration that is wrong *then*.
It cannot catch a variable that is correct at boot and irrelevant later, and it
cannot catch `pm2 reload --update-env` being run from a shell with a different
environment — that damage is done before the process starts, and the validator
would faithfully report the wrong values as present. Stage D4 of the runbook,
which diffs the variable names against the running process, is the control for
that.
