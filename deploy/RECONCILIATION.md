# Production environment reconciliation

Program 164. Revises the deployment plan against the production evidence now
available, and retires the assumptions that evidence has disproven.

---

## First, what evidence I actually hold

This matters more than any individual finding, because a reconciliation is only
as good as the provenance of what it reconciles against. Three kinds of evidence
appear below, and they are not equally strong:

| Tag | Meaning |
|---|---|
| **[OBSERVED]** | I measured it myself against the live host on 7 August 2026, remotely. Reproducible. |
| **[REPOSITORY]** | Verified by reading or running this codebase. Reproducible. |
| **[OWNER-REPORTED]** | Stated by you from the EC2 audit. I do not have the raw output. |

**The raw output of `audit-production.sh` has not been provided to me.** What I
have from the host is the set of facts you stated in Programs 159 and 164:

- PM2 manages the application
- The entry point is `/var/www/courtaccess/dist/index.js`
- The working directory is `/var/www/courtaccess`
- nginx proxies `/api` to `localhost:3000`
- Static files are served from `/var/www/courtaccess/dist/public`
- PM2 configuration persists in `~/.pm2/dump.pm2`
- `DATABASE_URL` is verified present
- Redis is **not** configured in `.env` or the running process environment

I treat these as true. I cannot cite them, quote them, or derive anything from
them beyond what they literally say. That limit is the reason several items
below stay UNKNOWN even though you have now run the audit — the answer exists on
your screen and has not reached me. Pasting the audit output would close most of
them in a single step.

---

## Classification of every previously identified blocker

| # | Blocker as previously stated | Classification | Basis |
|---|---|---|---|
| 1 | TLS certificate expires 9 August | **VERIFIED** | [OBSERVED] |
| 2 | nginx caps request bodies at 1 MB | **VERIFIED** | [OBSERVED] |
| 3 | Deployed frontend is a different application generation | **VERIFIED** | [OBSERVED] |
| 4 | The RC backend produces no build output | **DISPROVEN** | [REPOSITORY] |
| 5 | Process manager unknown | **DISPROVEN** | [OWNER-REPORTED] |
| 6 | PostgreSQL may not exist on the host | **DISPROVEN** | [OWNER-REPORTED] |
| 7 | Redis absence blocks deployment | **DISPROVEN** | [REPOSITORY] |
| 8 | Redis absence blocks Case 001 | **DISPROVEN** | [REPOSITORY] |
| 9 | Node version supports the bundle | **UNKNOWN** | — |
| 10 | Production database schema state | **UNKNOWN** | — |
| 11 | A database backup is possible | **UNKNOWN** | — |
| 12 | The PM2 process name | **UNKNOWN** | — |
| 13 | `JWT_SECRET` can be carried forward | **UNKNOWN** | — |
| 14 | ffmpeg present | **UNKNOWN** | — |
| 15 | Outbound HTTPS to leginfo from the host | **UNKNOWN** | — |
| 16 | PM2 survives reboot | **PARTIALLY VERIFIED** | [OWNER-REPORTED] |
| 17 | nginx runtime configuration | **PARTIALLY VERIFIED** | [OBSERVED] |

Four blockers are now disproven and are removed from the plan. Two of those —
7 and 8 — were mine, and they were wrong in a way worth explaining.

---

## The reconciliations you asked for

### PostgreSQL — assumption vs. verified `DATABASE_URL`

**Previously assumed:** the audit recorded PostgreSQL as *"Unknown … the API will
not start without `DATABASE_URL`"* and listed its absence as a hard blocker.
`AUDIT.md` went further and asserted that PostgreSQL *"does not exist on the
host today."*

**Now:** `DATABASE_URL` is present in the verified environment [OWNER-REPORTED].

**Classification: PARTIALLY VERIFIED.** The assertion that no database exists is
**disproven** and has been removed. But `DATABASE_URL` being *set* is a weaker
fact than it appears. It establishes that the variable exists. It does not
establish that the server it points to is reachable, what major version it runs,
whether the target database contains the production schema, or — the question
that actually decides the deployment — whether `_prisma_migrations` exists.

That last one is the live risk. The migration chain was rehearsed only against
an **empty** database, where it applies cleanly and produces 116 tables
[REPOSITORY]. If the production database has tables but no `_prisma_migrations`
table, Prisma treats every migration as pending and will attempt to create
tables that already exist, failing partway and leaving a half-migrated schema.

**Still needed:**

```bash
sudo -u postgres psql -d courtaccess -tAc "select to_regclass('public._prisma_migrations') is not null;"
sudo -u postgres psql -d courtaccess -tAc "select count(*), count(*) filter (where finished_at is null) from _prisma_migrations;"
psql --version
```

### Redis — assumption vs. verified absence

This is the reconciliation that changes the plan most, and the correction runs
in my favour, which is exactly why it deserves scrutiny rather than relief.

**Previously assumed:** *"Yes for processing — queues cannot run"*, and in the
dependency verification, *"Blocks if absent. Case 001 could be uploaded and
would never be analysed."*

**That was wrong.** I inferred it from the presence of BullMQ across 40-odd
files rather than from tracing the certification path. Having now traced it:

| Step | Mechanism | Redis? |
|---|---|---|
| Chunked upload and assembly | `certification/uploadPortal.ts` | No |
| Inventory and hashing | `certificationImport.ts` | No |
| Ingest | `await ingestEvidence(...)` — `certificationImport.ts:359` | No |
| Ingest implementation | `evidence/evidenceDirectUpload.ts` — **zero queue or Redis references** | No |
| Media duration | `certification/mediaProbe.ts`, ffprobe, inline | No |
| Timeline | `await reconstructTimeline(...)` — `certificationRun.ts:134` | No |
| Timeline implementation | `timeline/timelineReconstructionService.ts` — Redis appears once, in a comment | No |
| Contradictions | counted from `timelineEvent.conflictFlag` — `certificationRun.ts:273` | No |
| CALCRIM | `await analyzeCase(...)` — `certificationRun.ts:229` | No |

**The entire Case 001 path is synchronous.** Nothing on it enqueues, and nothing
on it reads Redis.

**Classification: DISPROVEN as a blocker, for both deployment and Case 001.**

What Redis absence *does* cause, precisely:

1. **A log flood.** `lib/redis.ts:8` defaults to `redis://localhost:6379`, with
   `maxRetriesPerRequest: null` and a retry strategy capped at 5,000 ms. The
   singleton is constructed at module load, so it begins retrying whether or not
   any worker starts. An `error` handler is attached at line 19, so the process
   does **not** crash — it logs `[Redis] Connection error: … ECONNREFUSED` every
   five seconds, roughly 17,000 lines a day, which will bury real errors in the
   PM2 log.
2. **Five workers that can never connect.** `server.ts:373` calls
   `startPipelineWorkers()`, which starts timeline, narrative, contradiction,
   video and doctrine workers.
3. **Genuinely unavailable features:** the policy and CPRA crawlers, the
   queue-backed analysis workers, and `/api/admin/queues`.

There is a clean mitigation already in the code. `startPipelineWorkers.ts:39`
honours `DISABLE_WORKERS`:

```bash
DISABLE_WORKERS=true
```

Set it. The five workers then do not start, and the queue-backed features are
off deliberately rather than failing continuously. The log flood from the
singleton connection remains — that one is cosmetic but real, and I have **not**
changed it, because altering connection behaviour during a deployment freeze is
a worse trade than noisy logs.

**Consequence for the plan:** Redis moves out of Group A and off the blocker
list. Installing it before Case 001 is no longer required. It becomes a
Version 1.1 item, needed when video and narrative processing matter.

**One thing this does not excuse.** `/api/health` (`server.ts:204`) returns a
static object and never touches Redis or the database. So PM2 will report the
process online, and any uptime monitor will stay green, while every queue-backed
subsystem is dead. That is the same failure mode that let the current stub sit
unnoticed for six weeks. Do not treat a green health check as evidence that the
platform works.

### PM2 runtime

**Previously assumed:** unknown process manager; the deployment plan carried
branches for systemd and for direct execution.

**Now:** PM2 manages the application, the entry point is
`/var/www/courtaccess/dist/index.js`, the working directory is
`/var/www/courtaccess`, and configuration persists in `~/.pm2/dump.pm2`
[OWNER-REPORTED].

**Classification: VERIFIED for the runtime, UNKNOWN for the operational
details.** The systemd and direct-execution branches are **removed** from the
plan. The RC is confirmed compatible with all four of these facts
[REPOSITORY]: it builds to exactly `dist/index.js`, runs under PM2 7.0.3 in fork
mode with 0 restarts, runs with `--cwd` set to the release directory, and
survives `pm2 save` / `pm2 resurrect` with a 3-second recovery.

What remains unknown is what the process is **called** and whether it runs in
fork or cluster mode. The cut-over stops the process by name. Without the name
you cannot perform it, and guessing risks stopping something unrelated. The
existence of `~/.pm2/dump.pm2` confirms the rollback mechanism I rehearsed is
available on the host, which is the single most reassuring fact in this
document.

```bash
pm2 list
pm2 describe <name>
```

### Nginx runtime

**Classification: PARTIALLY VERIFIED**, unchanged, and everything in it is
[OBSERVED] rather than inferred.

Confirmed working: nginx/1.28.1; HTTP→HTTPS redirect returning 301; HSTS; CSP;
`X-Frame-Options: SAMEORIGIN`; `X-Content-Type-Options: nosniff`; COOP and CORP
`same-origin`; gzip on HTML. The security posture is genuinely good, and I am
not proposing to touch it.

Confirmed by you: `/api` proxies to `localhost:3000`, static from
`/var/www/courtaccess/dist/public` [OWNER-REPORTED]. This makes one existing
plan item mandatory rather than advisory — **the RC defaults to `PORT=3001`**
[REPOSITORY], so `PORT=3000` must be set explicitly or nginx will proxy to a
closed port and every API call will 502.

Still unknown: which file holds the server block, proxy buffering, and proxy
timeouts. You need the file path to make the upload-limit change, because
editing the wrong include silently changes nothing.

```bash
sudo nginx -T | grep -n 'server_name.*courtaccess'
sudo nginx -T | grep -nE '^\s*(root|client_max_body_size|proxy_pass|proxy_request_buffering)'
```

### Current production entry point

**Classification: VERIFIED, and the finding is worse than "stale".**

Two facts collide productively here. You report the entry point is
`/var/www/courtaccess/dist/index.js` [OWNER-REPORTED]. I observed what answers
on that port [OBSERVED]:

- `/api/health` returns `{"status":"ok"}` and nothing else
- every other route 404s, including `/api/auth/login` and `/api/auth/register`
- the process has been up since approximately 22 June 2026
- the frontend calls `GET /api/trpc/auth.me`, which 404s

The Release Candidate's `/api/health` returns five fields — `status`,
`timestamp`, `version: "1.1.0"`, `service`, `environment` (`server.ts:204`)
[REPOSITORY]. The running one returns one field. **The file currently at
`/var/www/courtaccess/dist/index.js` is not this codebase, and not an older
build of it.** tRPC appears nowhere in this repository; the deployed frontend
belongs to a different application generation entirely.

The practical consequence is that **there is no meaningful "previous version" to
roll back to.** Rollback restores a health-check stub in front of a broken
frontend. That is still worth doing if the deployment fails — a known state
beats a half-migrated one — but nobody should imagine it restores service. Six
weeks of nobody being able to sign in is the state we would be returning to.

This also means the deployment cannot make the user-facing situation worse. It
is currently at zero.

### SSL renewal

**Classification: VERIFIED. The most urgent item here, and the only one whose
deadline is not under your control.**

```
notBefore = May 11 18:14:09 2026 GMT
notAfter  = Aug  9 18:14:08 2026 GMT
```

[OBSERVED] by TLS handshake. As of this writing, roughly **2 days remain**.
Let's Encrypt issues 90-day certificates and certbot renews at 30 days, so
automatic renewal has not run for at least 28 days.

Nothing about this is affected by the deployment decision. If it lapses, every
browser refuses the site with a full-page interstitial, and Safari — the browser
Case 001 is intended to be uploaded from — is the least forgiving of them.

```bash
sudo certbot certificates
systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

Run this today, before anything else in this document.

### Upload limits

**Classification: VERIFIED.**

[OBSERVED] by posting bodies of increasing size to `/api/health`:

| Body | Response |
|---|---|
| 1024 KB | 404 — body accepted, path rejected by the API |
| 1536 KB | **413 — nginx refused it before the API saw it** |

The limit is nginx's 1 MB default. The upload portal sends **8 MB chunks**
(`CHUNK_BYTES`, `backend/src/certification/uploadPortal.ts:24`) [REPOSITORY].
Every chunk of Case 001 would be rejected. Not one byte of discovery would
reach the application.

The application's own limits are 500 MB per non-video file and 10 GB per video
[REPOSITORY], so nginx is the only constraint that bites.

```nginx
client_max_body_size 64m;
proxy_request_buffering off;
```

This is not a pre-flight check but a required edit during the deployment, and
it must land in the same server block that carries the `proxy_pass`.

---

## Assumptions removed from the plan

Deleted, not merely annotated, because a plan that carries disproven statements
gets read selectively by whoever is executing it at speed:

1. **"PostgreSQL … does not exist on the host today"** (`AUDIT.md`). Disproven.
2. **"Redis … blocks Case 001"** (`DEPENDENCY_VERIFICATION.md`, group A).
   Disproven; reclassified as degrading and moved out of the blocking group.
3. **"Yes for processing — queues cannot run"** as a blocking entry
   (`CUTOVER_READINESS_AUDIT.md`, Phase 7). Reclassified.
4. **"The RC backend has no build output"** (`DEPLOYMENT_PLAN.md`, B1). Resolved
   in Program 160; esbuild produces `dist/index.js`, SHA-256 `c67b92e7…`,
   reproducible, and it runs with every TypeScript file deleted from disk.
5. **The systemd and direct-execution deployment branches.** PM2 is confirmed;
   the alternatives were speculation and are gone.
6. **"Node, npm, PM2 versions … not verifiable"** as a blanket statement. You
   can now read all three; they are simply unreported.

---

## One defect found while reconciling

Not a blocker, but it would have quietly defeated a stated requirement.

`certificationRun.ts:96` resolved the git commit for every certification record
by running `git -C /workspace rev-parse HEAD` — a **hardcoded path that exists
only in a development checkout**. In production the application lives at
`/var/www/courtaccess`, and a deployed release is not a git checkout at all, so
the call fails and the `catch` returns `null`.

Every certification recorded in production would have stored **no commit**.
Program 145 Phase 10 requires permanent history to carry the Git Commit, and
Phase 8 of the Release Constitution counts traceability as sufficient
justification for a change during the freeze, so I fixed it:

- `deploy/build-release.sh` now writes `dist/build-info.json` carrying the
  commit, branch and build time into the release
- `certificationRun.ts` reads `GIT_COMMIT`, then that stamp, then falls back to
  git in the actual working directory

Verified: `import.meta.url` survives esbuild bundling intact, so the stamp
resolves to `/var/www/courtaccess/dist/build-info.json` at runtime — exactly
where the build script writes it. The bundle rebuilds cleanly, and the file
contributes 0 type errors.

---

## Revised Go/No-Go

**NO-GO**, on two verified blockers and five unresolved UNKNOWNs.

The verdict is unchanged from Program 162, but the *shape* of it has improved
substantially, and the distinction matters for what you do next.

**Cleared since the last assessment:** the build artifact, the process manager,
the existence of a database, and Redis — which was two of my seven blockers and
was simply wrong. Of what remains, only two are verified problems, and both have
known one-line fixes.

### Verified blockers — 2

| | Blocker | Fix |
|---|---|---|
| 1 | TLS certificate expires 9 August | `certbot renew`; independent of deployment; **do this today** |
| 2 | nginx `client_max_body_size` is 1 MB against 8 MB chunks | `client_max_body_size 64m;` during cut-over |

### Unresolved UNKNOWNs that gate the decision — 5

| | UNKNOWN | Why it gates | Command |
|---|---|---|---|
| 3 | Node version | Bundle targets `node22`; older runtimes fail with a `SyntaxError` inside a 2 MB file | `node --version` |
| 4 | `_prisma_migrations` state | Tables without it means a half-migrated schema | `psql … to_regclass('public._prisma_migrations')` |
| 5 | Backup capability | No database rollback without a dump | `sudo -u postgres pg_dump --version` |
| 6 | PM2 process name | The cut-over stops it by name | `pm2 list` |
| 7 | `JWT_SECRET` | A new one signs out every user at cut-over | `grep -c '^JWT_SECRET='` |

Every one of these is answered by output you already have. This is the shortest
path from NO-GO to a decision: **paste the audit output.**

### Not blocking

Redis, ffmpeg, leginfo reachability, Stripe, S3, SES, the AI providers, Twilio,
Cloudflare, JS compression, and static `Cache-Control`. Deploy without them.

### What GO would require

1. The certificate renewed — today, regardless of everything else
2. Items 3–7 answered and each landing on the acceptable side
3. `client_max_body_size 64m` and `proxy_request_buffering off` staged
4. `PORT=3000` and `DISABLE_WORKERS=true` set in the release environment
5. A database dump taken and its restore verified

### A limitation that no host command can settle

**Safari remains untested.** 116 of 116 browser checks pass against the bundled
artifact behind nginx, but all of them ran on Chromium [REPOSITORY]. The upload
portal's folder selection uses `webkitdirectory`, whose behaviour differs across
engines, and Case 001 is intended to be dragged from Finder in Safari. There is
a documented fallback — **Select Discovery** with multi-file selection — but it
has never been exercised there. This does not block deploying. It is a real risk
to the first upload, and it needs a person with a Mac, not a command.
