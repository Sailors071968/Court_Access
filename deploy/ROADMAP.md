# Production engineering roadmap

Program 181. Written after implementing the REQUIRED items, so the first
section describes work that is **done and verified**, not planned.

Everything cites evidence. Effort is expressed as change size rather than
calendar time, because the boot-path items carry a risk that hours do not
capture:

| Size | Meaning |
|---|---|
| **S** | One file, under ~30 lines |
| **M** | Two to four files, or a new module |
| **L** | Boot path or many call sites; needs its own verification pass |

---

## Completed

Nine changes across Programs 181 and 183, each built, typechecked,
regression-tested, and verified at runtime against a production-shaped release.
The suite went from 446 tests (442 pass, 4 fail) to **453 (449 pass, 4 fail)** —
the same four pre-existing failures throughout, plus seven new tests.

Programs 181 (items 1–5) and 183 (items 6–9).

### 1 · Event-loop holders removed

`rateLimiter.ts:42`, `csrfProtection.ts:60`, `lib/redis.ts`

Two housekeeping sweeps and an eagerly-opened Redis socket kept any importing
process alive forever. Diagnosed with `process.getActiveResourcesInfo()`:
importing `lib/redis` added a `TCPSocketWrap` no other module did. Both sweeps
are now `unref`'d and the Redis client uses `lazyConnect`.

**Measured effect:** with Redis absent, connection errors over 20 seconds went
from ~4 to **0**. The flood was 12 a minute, about 17,280 a day, burying real
errors in the PM2 log. With Redis present, unchanged — workers start and `ss`
confirms established sockets to 6379.

### 2 · The schema guard actually guards

`database/schemaAssert.ts`

`enforceSchemaOnBoot` exists to hard-fail on a drifted or un-migrated database.
In the bundle it could not: all three reads resolved `../../prisma` from
`__dirname`, which esbuild derives from `import.meta.url`, so in a release it
pointed at `/var/www/prisma`. Every read was individually guarded, so nothing
threw — the checksum returned the literal `no-migrations`, the pending count
returned zero, and the server logged **"Schema locked and matching"** having
verified nothing but connectivity.

**Verified:** against a production-shaped release on a migrated database it now
reports `Migrations: 30/30 applied`; against an empty one it **exits 1**,
naming 30 pending migrations, 115 missing tables, and the remedy. Before this,
the same release would have started and served against an empty database.

### 3 · Startup validation and signing-key fail-fast

`startup/validateEnvironment.ts` (new), `server.ts`, `security/authMiddleware.ts`

Configuration is now checked before the server binds — node version, `NODE_ENV`,
the four secrets, `PORT`, `HOST`, and whether the upload and staging directories
are writable, tested by writing a probe file rather than reading permission bits,
which say nothing about ACLs or a read-only mount.

A missing `JWT_SECRET` previously generated a random key and started normally,
so every restart signed out every user with **no error and no server-side
symptom** — the only completely silent failure in the configuration. Now fatal in
production, still ephemeral with a warning in development.

`startServer()` was also invoked with no `.catch()`, so an early throw became an
unhandled rejection logged as "server kept running" — which it did, with no HTTP
listener, reporting online to PM2 with zero restarts.

**Verified:** `JWT_SECRET` absent in production exits 1 without binding; absent
in development warns and serves; `EVIDENCE_UPLOAD_DIR` unset in production exits
1 naming the data-loss risk **and the correct variable name**; fully configured
reports all PASS and serves.

### 4 · Orderly shutdown

`server.ts`

The handler stopped workers and called `process.exit(0)` without closing Fastify
or disconnecting Prisma, so every `pm2 reload` terminated in-flight requests
mid-response. For a GET that is a retry; for a multi-gigabyte evidence upload it
is a truncated file, and the deployment reloads at least once.

Now closes the server so requests drain, then stops monitors and workers, then
disconnects Prisma, with a 30-second deadline so a stuck request cannot prevent
exit and a re-entrancy guard for SIGTERM followed by SIGINT.

**Verified:** SIGTERM produced `HTTP server closed; in-flight requests
completed`, then worker shutdown, then `Shutdown complete`, exit 0, port
released.

### 5 · Liveness and readiness separated

`observability/deepHealthCheck.ts`, `observabilityRoutes.ts`

`/api/health/deep` reported the platform **unhealthy** in the certified
configuration, because it pings Redis and that deployment deliberately has none.
Redis is now `unknown — workers disabled` and excluded from the overall status
when `DISABLE_WORKERS` is set; unreachable Redis with workers *enabled* is still
unhealthy.

New `/api/health/ready` checks only what serving a request needs — database, a
writable upload directory, disk headroom. Redis, Neo4j and OpenAI are excluded:
removing an instance from rotation over an optional dependency causes an outage
rather than preventing one.

**Verified:** with the upload directory made unwritable, readiness returned
**503** naming the path and errno while liveness held at **200** — so a
dependency fault cannot trigger a restart storm — and both recovered when
permissions were restored.

### 6 · Upload transfer integrity

`certification/uploadPortal.ts`, `uploadPortalRoutes.ts`, and a new
`tests/upload-portal-concurrency.test.ts`

One class of defect: **the server accepted bytes it could not verify.**
`receiveChunk` read the staged size, compared it to the declared offset, then
appended — a check-then-act sequence, so two chunks in flight for the same file
could both pass and both append. The only backstop was a final-size comparison,
and that was itself optional because `totalSize` was parsed with `?? '0'`.

Appends are now serialised per staging path, `totalSize` is required and must be
positive, and overrun is detected as it happens rather than only if a final
chunk arrives.

**Verified the test catches the real defect:** with the lock reverted, "does not
duplicate bytes when the same chunk is sent twice concurrently" fails because
both chunks are applied. Seven tests added.

### 7 · Build identity

`lib/buildInfo.ts` (new), `server.ts`, `certification/certificationRun.ts`

Nothing recorded which build was running. `/api/health` reported a hardcoded
`1.1.0` that never changed, and `dist/build-info.json` was read only by the
certification record. That resolution is now one module used by the startup log,
the health endpoint and the certification record, so a finding cannot disagree
with the API about which code produced it.

**Verified:** startup logs
`CourtAccess 1.1.0 — 6874085 · <branch> · built <ts> (from stamp)`, and the
commit in `/api/health` matches `dist/build-info.json` exactly.

### 8 · Readiness stopped mutating what it checks

`observability/deepHealthCheck.ts`

My own code from item 5 ran `mkdir` + write probe + `unlink` on every poll —
thousands of writes a day into the evidence directory, and it created what it
was checking, so a mistyped `EVIDENCE_UPLOAD_DIR` would be created and reported
healthy. Now `access(W_OK)`, with a missing directory reported as degraded
rather than conjured into existence.

### 9 · Test suite variance, recorded

While verifying item 8 a run reported 440 tests where three consecutive runs
before and after reported 453. Investigated rather than dismissed: no suite was
lost, and five graph-related suites appeared in one run and not another, so the
composition varies with external state rather than with the code. Three
consecutive identical runs confirm the current state.

**Consequence for verification:** test counts alone are a weak regression
signal for this suite. Compare the failing-test *names*, not just totals.

---

## Required before Version 1.0 deployment

Nothing further in code. What remains is operational and is already in
[`RUNBOOK.md`](RUNBOOK.md):

| | Item | Evidence |
|---|---|---|
| 1 | **Renew the TLS certificate** | `notAfter = Aug 9 18:14:08 2026 GMT`, observed; renewal has not run in ≥28 days |
| 2 | **Raise nginx `client_max_body_size` to 64m** | 413 measured at 1536 KB against 8 MB chunks |
| 3 | **Run `inspect-database.mjs`** against production | Database state unobserved; one of three states makes the RC unrunnable |
| 4 | **Confirm `node --version` ≥ 22** | Bundle targets `node22` |
| 5 | **Take a verified `pg_dump`** | 30 migrations, no down migrations, four irreversible `DROP COLUMN` |

The startup validator now closes what were items 6 and 7 on this list — a
missing `JWT_SECRET` and a misconfigured `EVIDENCE_UPLOAD_DIR` are refused at
boot rather than discovered later.

---

## Strongly recommended before public beta

### CRITICAL

**B1 · Verify Safari.** All 116 browser checks ran on Chromium. The upload
portal's folder picker uses `webkitdirectory`, whose behaviour differs across
engines, and Case 001 is intended to be dragged from Finder in Safari. The
documented **Select Discovery** fallback has never been exercised there either.
No command settles this. **Size: a person with a Mac.**

**B2 · Surface incompleteness in the interface.** The timeline pipeline caps at
200 evidence items (`timelineReconstructionService.ts:108`) with a 5-minute
budget (`:105`) against a 60-second per-item timeout
(`evidenceTextExtractionService.ts:24`), processed sequentially. Five slow
documents consume the whole budget. It warns truthfully in `warnings[]` — and
with `DISABLE_WORKERS=true` the only automatic caller is the single inline run
during certification (`certificationRun.ts:149`), so a capped run is never
retried. **A partial timeline displayed as complete is the most dangerous output
this platform can produce.** Size **M** for the UI surfacing; the pipeline itself
is 1.1 work.

**B3 · State plainly that media is not transcribed.** Speech-to-text is not
implemented anywhere in `backend/src`. An attorney who searches for a phrase,
finds nothing, and concludes it was never said has been misled by silence. Under
this platform's own constitution absence must be reported, not implied. Size
**S** to label it; **F1** below to fix it.

**B4 · Configure email.** `SMTP_HOST`/`SES_REGION` are read but never exercised.
Without it password reset and invitations do not work, which is every user who
is not the Administrator. Size **M**, mostly configuration.

### HIGH

**B5 · Fix the four failing tests** (`SECURITY_REVIEW.md`, verified this
program). All four are test faults, not product defects — a stale `findUnique`
on a column whose unique index a migration dropped, two assertions that expect
looser authorization than the implementation enforces, and one Stripe test that
needs credentials. But a suite with four known failures means "tests pass" is
not a usable signal. Size **M**.

**B6 · Separate the two hanging assessment tests.**
`master-production-assessment.test.ts` and `production-operations.test.ts` run
real drills, shell out via `execSync`, and write tracked report files. They do
not exit, so `npm test` still needs `--test-force-exit`, and they dirty the
working tree. Move them out of the unit suite. Size **M**.

**B7 · Evidence files are world-readable.** Written with the default umask, so
`0644` in `0755` directories. For privileged criminal discovery, `0600`/`0700`.
Size **S**.

**B8 · Add a timeout to OpenAI calls.** The only outbound call in the codebase
without one — leginfo, ffprobe, the timeline pipeline and the worker queues all
have them. A hung connection holds a request and its database connection
indefinitely. Size **S**; the fuller design is in
[`OPENAI_INTEGRATION.md`](OPENAI_INTEGRATION.md).

**B9 · ~~Log build identity at startup~~** — done, item 7 above. The second half,
logging the *resolved configuration*, is covered by the startup validator's
report from item 3.

### MEDIUM

**B10 · `max_memory_restart` under PM2.** Resident is ~275 MB at idle, measured.
No ceiling means an OOM kill instead of a logged restart. Size **S**, no code.

**B11 · Enable gzip for JavaScript and add `Cache-Control`** in nginx. The
bundle is served at 1.6 MB instead of 383 kB gzipped. Both belong in the Stage
F2 edit that already has to change `client_max_body_size`. Size **S**.

**B12 · `CERTIFICATION_REPORTS_DIR` defaults into `/workspace`**
(`readinessService.ts:19`). The read is caught, so the readiness view silently
reports no suites. Same class as the `/workspace` git path already fixed. Size
**S**.

**B13 · Upload resume across a restart is untested.** Nothing prunes abandoned
chunks under `CERTIFICATION_STAGING_DIR`. For a 40 GB corpus interrupted at 90%,
this is the difference between an inconvenience and a lost day. Size **M** plus a
test.

---

## Version 1.1 and later

**F1 · Speech-to-text with timestamped transcripts.** The largest capability gap
and the one that most changes what the platform is worth. Promised across
Programs 145, 150 and 153.

**F2 · Parallelise text extraction.** Currently sequential with a 60-second
per-item timeout inside a 5-minute pipeline budget. Extraction is CPU-bound and
embarrassingly parallel; a concurrency of 4 would plausibly bring a 200-item run
inside the existing budget without touching the timeouts. The largest single
performance win available.

**F3 · Make the pipeline resumable.** Order the `findMany` and record a
high-water mark so repeated runs make progress instead of re-processing the same
first 200 items.

**F4 · Move rate limiting and CSRF to shared state.** Both are in-process
`Map`s, so limits reset on every reload and CSRF tokens are invalidated by every
deployment. Correct for one fork-mode process; silently wrong at two instances.
Needs Redis.

**F5 · Multi-instance operation.** Depends on F4, plus connection-pool limits and
a shared session store.

**F6 · Object storage for evidence.** `AWS_*` and `R2_*` are read but never
exercised. Criminal discovery should not live on a single EBS volume.

**F7 · Unify logging.** Pino for requests, `console.*` for everything else — half
JSON, half prose in one stream. Mechanical but touches many files.

**F8 · Drive down 164 TypeScript errors.** esbuild does not typecheck, so the
type system is currently not a safety net for any change.

**F9 · Video analysis and Neo4j policy graph.** Both are stubs today; either
finish or remove. A placeholder that reads as a feature is worse than an absence.

---

## What did not get implemented, and why

**A `--validate-only` flag.** Designed in `HARDENING.md` Program 172 as a way to
run the validator against a staged release before cut-over. Not implemented: the
smoke test in Stage F1 already starts the release on a spare port, and the
validator now runs there, so the flag would add a code path for something the
runbook already achieves.

**Reordering the signing-key check.** The fatal in `authMiddleware.ts` fires at
module load, before `startServer()` runs, so a missing `JWT_SECRET` produces one
precise message rather than the validator's full report. Fixing the ordering
means restructuring the boot path to dynamically import after validating —
disproportionate risk for the benefit of discovering a second missing secret in
the same restart rather than the next one.

**Rate limiting and CSRF shared state, and OpenAI retries.** Both are correct
improvements and both are listed above. Neither is required for a single-process
deployment with one Administrator, and Program 181 asks for changes that reduce
operational risk without materially increasing complexity. Adding a Redis
dependency to a deployment that currently has no Redis fails that test.

**The four failing tests.** They are test faults, and fixing tests was not in the
REQUIRED set. Each is diagnosed in this program's findings so the work is
straightforward when it is picked up.
