# Environment variable trace — startup to runtime

Program 169. Read-only. Nothing was deployed, and production was not contacted.

## Method and evidence

| Tag | Meaning |
|---|---|
| **[CODE]** | Read from the source or the built bundle at this commit, cited by file and line |
| **[RUNTIME]** | Observed by running the real bundle under PM2 7.0.3 during the Program 168 rehearsal |

The shell in this workspace stopped responding partway through this program, so
**no new runtime tests were run**. Every [RUNTIME] claim below was captured
during the Program 168 rehearsal and is reproduced here with its measurement.
Everything else is static analysis of code I can read.

---

## The fact everything else follows from

**The application never reads `.env`.**

```
$ grep -c "dotenv" backend/dist/index.js
0
```

There is no `dotenv` import, no `dotenv.config()`, and no `--env-file` in any
start script anywhere in `backend/src` [CODE]. Every variable reaches the
application through exactly one mechanism: **the environment of the process
PM2 starts.**

A `.env` file on the production host is therefore documentation and a source
for your shell. It has no effect on the running application by itself.

---

## How a value actually reaches the running code

```
  .env on disk
       │   (only if a human or script sources it)
       ▼
  the shell running pm2
       │   (only on `pm2 start`, or `pm2 reload --update-env`)
       ▼
  PM2's stored process environment  ──►  ~/.pm2/dump.pm2 on `pm2 save`
       │
       ▼
  process.env inside the Node process
       │
       ▼
  read at MODULE LOAD (frozen for the process lifetime)  ── or ──  read PER CALL
```

The last split matters and is covered per variable below. A value read at
module load is captured once when the file is first imported; changing the
environment later cannot affect it without a restart.

### Verified PM2 behaviour [RUNTIME]

`pm2 reload <name>` **preserves** the environment the process was started with.

`pm2 reload <name> --update-env` **replaces** it with the environment of the
invoking shell. Observed during rehearsal — a stray `PORT=3200` in the shell
overrode a `.env` that said `3510`:

```
PORT in .env:                3510
PORT in the running process: 3200
health:                      200 (on the wrong port)
```

The process reported healthy the whole time. Behind nginx that is a silent 502
with a green health check. Sourcing the file into the shell first produced the
correct result:

```
$ set -a; . "$APP/.env"; set +a
$ pm2 reload courtaccess --update-env
PORT in the running process: 3510      health: 200
```

---

## Per-variable trace

"Load-time" means the value is captured when the module is first imported and
is frozen for the life of the process.

### DATABASE_URL

| | |
|---|---|
| Origin | PM2 process environment |
| Read by | `@prisma/client`, via `datasource db { url = env("DATABASE_URL") }` in `prisma/schema.prisma:10` [CODE] |
| Code path | `lib/prisma.ts:12` constructs `new PrismaClient()` at module load → `server.ts:82` `enforceSchemaOnBoot()` → `schemaAssert.ts:232` `prisma.$queryRaw\`SELECT 1\`` |
| When read | Load-time (client construction); the URL is used on first query |
| `.env` alone changes it? | **No** |
| Reload required | `pm2 reload --update-env`, with the value present in the invoking shell |
| Missing or wrong | `schemaAssert.ts:233-245` catches the connection failure and returns `ok:false`; `enforceSchemaOnBoot` then calls **`process.exit(1)`** (`schemaAssert.ts:330`). PM2 restarts, so this shows as a **rising restart count** — visible, not silent. |

### JWT_SECRET — and JWT_REFRESH_SECRET

| | |
|---|---|
| Origin | PM2 process environment |
| Read by | `security/authMiddleware.ts:59-60` [CODE] |
| Code path | `generateAccessToken` (`:74`) signs with it; verification uses the same constant |
| When read | **Load-time.** Captured once at import. |
| `.env` alone changes it? | **No** |
| Reload required | `pm2 reload --update-env` |

```ts
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
```

**If either is absent, the application generates a random 64-byte secret and
starts normally.** No error. No warning. Not even the warning that
`COOKIE_SECRET` gets four lines away.

The consequences are severe and quiet:

- Every restart invalidates **every** access and refresh token in existence.
  All users are signed out, with no log line saying why.
- Login continues to work, so the application looks healthy. The failure only
  appears to users, as sessions that die at unpredictable times.
- Two processes would sign with different secrets, so a token issued by one is
  rejected by the other.

This is the single most dangerous variable in this deployment, because
**omitting it produces no visible symptom on the server side at all.**

### PORT

| | |
|---|---|
| Origin | PM2 process environment |
| Read by | `server.ts:60` — `parseInt(process.env.PORT \|\| '3001', 10)` [CODE] |
| When read | Load-time |
| Default | **3001** |
| `.env` alone changes it? | **No** |
| Missing | Binds 3001. nginx proxies to 3000, so **every API call returns 502** while the process reports healthy on 3001. |

### HOST

| | |
|---|---|
| Read by | `server.ts:61` — `process.env.HOST \|\| '0.0.0.0'` [CODE] |
| When read | Load-time |
| Default | **`0.0.0.0`** — binds every interface |
| Missing | The API is reachable directly on port 3000 from outside, bypassing nginx and its TLS, headers and rate limits, if the security group permits. Set `127.0.0.1`. |

### NODE_ENV

Read in at least nine places [CODE]. It is not a label; it changes behaviour:

| Location | Effect when not `production` |
|---|---|
| `server.ts:89` | CORS allows only `localhost` origins instead of the courtaccess.net domains |
| `server.ts:113` | The missing-`COOKIE_SECRET` warning is suppressed |
| `authMiddleware.ts:504, 737` | Cookies are set **without the `secure` flag** — sent over plain HTTP |
| `identityRoutes.ts:163` | Same |
| `authMiddleware.ts:907` | Extra non-production behaviour is enabled |
| `organizationService.ts:240-245` | Invitation URLs are returned in API responses |
| `stripeWebhookHandler.ts:16` | Webhook signature checking is relaxed |
| `lib/prisma.ts:16` | The Prisma client is cached on `globalThis` |
| `server.ts:209` | `/api/health` reports `"environment"` — **the one externally visible signal** |

`server.ts:102` softens the CORS consequence: `FRONTEND_URL` is appended to the
allowed origins regardless of `NODE_ENV`. So CORS may still work while cookies
are silently insecure. **The `secure` cookie flag is the consequence that
matters, and nothing surfaces it.**

Verify from outside: `/api/health` must report `"environment":"production"`.

### COOKIE_SECRET

| | |
|---|---|
| Read by | `server.ts:113-117` [CODE] |
| When read | Load-time |
| Missing in production | Logs `WARNING: COOKIE_SECRET not set in production! Using insecure hardcoded fallback`, then uses the literal string `'court-access-cookie-secret-change-in-production'` |

Unlike the JWT secrets, this one warns. The fallback is a constant published in
this repository, so cookie signatures would be forgeable by anyone who reads it.

### FRONTEND_URL

Read at `server.ts:102` (CORS, load-time) and `authMiddleware.ts:861` (password
reset links, **per call**, defaulting to `https://courtaccess.net`) [CODE].
One of the few variables read per call rather than at load.

### DISABLE_WORKERS

| | |
|---|---|
| Read by | `workers/startPipelineWorkers.ts:39` [CODE] |
| When read | Load-time, at `server.ts:373` |
| Effect | `'true'` prevents five BullMQ workers starting |
| Verified | Log line `[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var` [RUNTIME] |

### REDIS_URL — and REDIS_HOST / REDIS_PORT

Two independent mechanisms, which is worth knowing before setting either:

- `lib/redis.ts:8` reads **`REDIS_URL`**, defaulting to `redis://localhost:6379`
- `cpra/workers/cpraCampaignWorker.ts:46-47`, `cpraAnnualUpdateWorker.ts:52-53`
  and `policy/workers/siteCrawlWorker.ts:317,331` read **`REDIS_HOST`** and
  **`REDIS_PORT`** separately [CODE]

Setting `REDIS_URL` alone does not configure the CPRA and policy workers.
Neither blocks deployment — Redis is absent and `DISABLE_WORKERS=true` — but
setting only one of the two would half-configure the system later.

### EVIDENCE_UPLOAD_DIR

| | |
|---|---|
| Read by | `evidence/evidenceDirectUpload.ts:40` [CODE] |
| When read | Load-time |
| Default | **`/var/www/courtaccess/uploads/evidence`** — inside the directory a deployment replaces |

The name is `EVIDENCE_UPLOAD_DIR`. `EVIDENCE_STORAGE_DIR`, which several of my
earlier documents named, **does not exist in this codebase** and setting it does
nothing.

### CERTIFICATION_STAGING_DIR

`certification/uploadPortal.ts:21`, load-time, defaults to
`/var/tmp/courtaccess-certification-staging` — outside the application
directory, so the default is safe [CODE].

### OPENAI_API_KEY

| | |
|---|---|
| Read by | `cpra/services/cpraClassificationEngine.ts:43, 212` and `doctrine/doctrineEmbeddingPipeline.ts:69` [CODE] |
| When read | **Per call** at `:43` and `:212`; load-time at `:69` |
| Missing | `:212` falls back to `classifyWithHeuristics`. `:43` throws `OPENAI_API_KEY not configured` if reached directly. |

Not required. Nothing on the Case 001 path calls it.

### ANTHROPIC_API_KEY, GOOGLE_API_KEY / GOOGLE_AI_API_KEY, TWILIO_*

**These variables do not exist in the application.** A search across the whole
repository for `ANTHROPIC`, `GOOGLE_AI`, `GOOGLE_API`, `CLAUDE_API`, `GEMINI`
and `TWILIO_` returns matches in exactly two files — `deploy/audit-production.sh`
and `deploy/PRODUCTION_CERTIFICATION_V1.md`, **both of which I wrote** [CODE].

There is no Anthropic client, no Google AI client and no Twilio client in
`backend/src`. I listed them in earlier documents without checking, the same
error as `EVIDENCE_STORAGE_DIR`. Setting them has no effect. They should not
appear in any environment file, and I have no basis for having named them.

### Variables with hardcoded development paths

| Variable | Default | Effect in production |
|---|---|---|
| `CERTIFICATION_REPORTS_DIR` | `/workspace/reports/certification` (`readinessService.ts:19`) | The directory does not exist. `readdir(...).catch(() => [])` at `:64` returns empty, so the readiness view reports **no suites** rather than erroring. Degrading, silent. |
| `GIT_COMMIT` | falls back to the build stamp, then git | Fixed earlier this branch; previously stored a null commit against every certification |

---

## Answers to the questions asked

### Does changing `.env` alone change the running application?

**No. Never.** Not for any variable. The application does not read the file, and
every consumer above reads `process.env`, which PM2 populates at process start.
Editing `.env` and doing nothing else changes nothing at all — and, worse,
leaves the file and the running process disagreeing with no indication.

### Is `pm2 reload` or `pm2 reload --update-env` required?

For a **code-only** change with no environment change: `pm2 reload <name>`.
It preserves the existing process environment, which is the safe default.

For **any environment change**: `pm2 reload <name> --update-env`, **and the new
values must be in the shell that runs it**:

```bash
set -a; . /var/www/courtaccess/.env; set +a
echo "PORT=$PORT"          # confirm before reloading
pm2 reload <name> --update-env
```

`--update-env` is not additive. It **replaces** the process environment with the
shell's. Anything the running service has that the shell lacks is dropped.

### Does the deployment procedure preserve every variable?

**Only if the `.env` file is complete first, and this is the weakest point in
the whole deployment.**

The risk is concrete. `--update-env` discards any variable the shell does not
have. The current production process was started at some unknown time with an
unknown environment, and `~/.pm2/dump.pm2` holds whatever that was. If it
carries a variable the new `.env` omits, that variable is **silently lost**
at reload.

For most variables the loss would be obvious — `DATABASE_URL` exits 1, `PORT`
gives 502. For `JWT_SECRET` it is invisible: the application generates a random
one, starts cleanly, and signs everybody out on every restart from then on.

The runbook (Stage D4) mitigates this by capturing the running process
environment before the new file is written:

```bash
sudo tr '\0' '\n' < /proc/$PID/environ | grep -oE '^[A-Z_]+' | sort > /tmp/current-env-names.txt
comm -23 /tmp/current-env-names.txt /tmp/new-env-names.txt
```

Anything that `comm` prints is about to be dropped. Names only; no values.

**One addition this trace argues for**, because no existing check would catch
it. After the cut-over, confirm the secret survived:

```bash
PID=$(pgrep -f 'dist/index.js' | head -1)
sudo tr '\0' '\n' < /proc/$PID/environ | grep -c '^JWT_SECRET='
```

Expect `1`. A `0` means every user will be signed out on the next restart, and
nothing else will tell you.

---

## Defects found

Three, all found by reading code rather than by running anything. None is being
fixed in this commit: **the shell in this workspace is unavailable, so I cannot
build or test, and I will not ship an untested change to the boot path.**

### 1 · Missing JWT secrets fail silently — HIGH

`authMiddleware.ts:59-60`. A missing `JWT_SECRET` or `JWT_REFRESH_SECRET`
produces a random secret with no log line. Sessions then die on every restart.

Contrast `COOKIE_SECRET` at `server.ts:113`, which warns in production. The
same treatment — or a hard exit, which would be better for a signing key —
would make this visible.

### 2 · The schema guard is inert in the deployed bundle — HIGH

`server.ts:82` calls `enforceSchemaOnBoot()`, whose stated purpose is to
hard-fail on a drifted schema or pending migrations. **In the bundle it cannot
do that.**

`schemaAssert.ts:24, 59, 178` resolve the Prisma directory as
`resolve(__dirname, '../../prisma')`. esbuild shims `__dirname` from
`import.meta.url` (`dist/index.js:42464-42465`), so at runtime:

```
__dirname = /var/www/courtaccess/dist
../../prisma → /var/www/prisma          ← does not exist
```

The path is correct when running from source, where `schemaAssert.ts` sits in
`backend/src/database/`. It is wrong for the bundle, whose entry point is one
directory below the application root rather than three.

Each read is individually guarded, so nothing throws — they return safe
defaults. The result is that the check silently degrades to a connectivity test
and then reports success:

- `computeMigrationChecksum()` returns the literal `'no-migrations'` (`:44`)
- `countPendingMigrations()` returns `{0, 0, []}` (`:69`) — **no pending
  migration can ever be detected**
- `findMissingColumns()` returns `[]` (`:180`) — **no drift can ever be
  detected**

**This is detectable in the startup log**, which is the useful part. A working
check prints `Migrations: 30/30 applied`. A broken one prints:

```
[Schema Assert] Schema locked and matching.
[Schema Assert]   Checksum:   no-migrations
[Schema Assert]   Migrations: 0/0 applied
```

`Checksum: no-migrations` and `0/0 applied` are the signature. Add both to the
Stage F3 verification, and do not read "Schema locked and matching" as
meaning the schema was checked.

The fix is to try `../prisma` as well as `../../prisma`, so the same code works
from source and from the bundle. It is small, but it changes the boot path and
must be tested before it ships.

### 3 · `CERTIFICATION_REPORTS_DIR` defaults into `/workspace` — LOW

`readinessService.ts:19`. A development path that will not exist in production.
The read is caught and returns an empty list, so the readiness view reports no
suites rather than failing. Same class of defect as the hardcoded `/workspace`
git path already fixed on this branch.

---

## Summary table

| Variable | Required | Read at | Default if absent | Failure mode if missing |
|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | Load | none | `process.exit(1)`, PM2 restart loop — **visible** |
| `JWT_SECRET` | **Yes** | Load | **random** | **Silent.** Everyone signed out on every restart |
| `JWT_REFRESH_SECRET` | **Yes** | Load | **random** | **Silent.** Same |
| `COOKIE_SECRET` | **Yes** | Load | published constant | Warns in production |
| `PORT` | **Yes here** | Load | `3001` | 502 through nginx; process looks healthy |
| `HOST` | Recommended | Load | `0.0.0.0` | API exposed directly, bypassing nginx |
| `NODE_ENV` | **Yes** | Load ×9 | `development` | Cookies lose `secure`; CORS narrows |
| `FRONTEND_URL` | Yes | Load + per call | `https://courtaccess.net` | CORS rejection |
| `DISABLE_WORKERS` | Yes here | Load | unset | Five workers retry Redis forever |
| `EVIDENCE_UPLOAD_DIR` | **Yes here** | Load | inside `$APP` | Evidence destroyed by the next deployment |
| `CERTIFICATION_STAGING_DIR` | Recommended | Load | `/var/tmp/...` | Safe default |
| `REDIS_URL` | No | Load | `redis://localhost:6379` | ~17,280 log lines/day [RUNTIME] |
| `REDIS_HOST` / `REDIS_PORT` | No | Load | `localhost` / `6379` | Separate from `REDIS_URL` |
| `OPENAI_API_KEY` | No | Per call | none | Falls back to heuristics |
| `ANTHROPIC_API_KEY` | **Does not exist** | — | — | No effect |
| `GOOGLE_API_KEY` / `GOOGLE_AI_API_KEY` | **Does not exist** | — | — | No effect |
| `TWILIO_*` | **Does not exist** | — | — | No effect |
| `EVIDENCE_STORAGE_DIR` | **Does not exist** | — | — | No effect |

Four of the names in this table are ones I put into earlier deployment
documents without verifying that the application reads them. Only the code
column is authoritative.
