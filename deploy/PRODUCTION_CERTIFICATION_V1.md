# CourtAccess Version 1.0 — Production Deployment Certification

**Certification date:** 7 August 2026
**Branch:** `cursor/gold-standard-upload-portal-9f94`
**Certified commit:** `4bdaca19b171cb8a920a50a4a6eb19e2733ed724`
**Programs consolidated:** 158–166

Every artifact figure below was measured at `4bdaca1`. Commits after it change
only files under `deploy/`, so `dist/index.js` still hashes to the same value —
re-verified after this document was written. The frontend build stamp embeds
whichever commit it is built from, so expect it to name the commit you deploy,
not necessarily `4bdaca1`.

> **Superseded in part, 7 August 2026, 23:14 UTC.** This is a dated record and
> its observations stand as made. Two things have changed since:
>
> - **Critical blocker C1, the TLS certificate, is RESOLVED.** Renewed to
>   `Nov 5 22:08:52 2026`, serial `060359B4860A6029304A03177AE6E3F61602`,
>   issuer `YE1`, verified by TLS handshake. The critical count is now **2**,
>   not 3.
> - **Several High findings have been implemented** in Programs 181 and 183 —
>   startup validation, signing-key fail-fast, orderly shutdown, the schema
>   guard, and upload transfer integrity. See
>   [`ROADMAP.md`](ROADMAP.md) for the current position.
>
> The verdict below remains **NO GO**, on the nginx body limit and the
> unobserved database rather than on the certificate.

This is the permanent deployment record. Where it disagrees with any earlier
document in `deploy/`, this one governs.

## Evidence tags

Every claim below carries its provenance. Nothing is inferred.

| Tag | Meaning |
|---|---|
| **[OBSERVED]** | Measured against the live host, remotely, 7 August 2026 |
| **[TESTED]** | Executed in this workspace against real PostgreSQL 16.14 and Node 22.14 |
| **[REPOSITORY]** | Read from this codebase at the commit above |
| **[OWNER]** | Stated by the owner from the EC2 host; raw output not provided |
| **UNKNOWN** | No observation exists |

---

# PART 1 — Executive summary

## Current production architecture [OBSERVED]

nginx 1.28.1 on an AWS EC2 instance at `44.209.225.79`, serving
`courtaccess.net` directly with no CDN in front. A static single-page
application built 26 June 2026 is served from disk. Behind nginx, on port 3000,
a Node process answers `/api/health` with `{"status":"ok"}` and returns 404 for
every other route, including `/api/auth/login` and `/api/auth/register`. It has
been running since approximately 22 June 2026.

PM2 manages that process from `/var/www/courtaccess/dist/index.js`, with the
working directory `/var/www/courtaccess` and configuration persisted in
`~/.pm2/dump.pm2` [OWNER].

## Current Release Candidate architecture [REPOSITORY]

A Fastify API bundled by esbuild into a single ESM file, `dist/index.js`,
targeting Node 22, with `node_modules` kept external. It serves a REST API
across roughly 40 route modules, persists to PostgreSQL through Prisma 6 across
115 tables, and serves a Vite-built React SPA from `dist/public`. Background
processing runs on BullMQ over Redis, and can be disabled with a single flag.

## Major differences

**These are not two versions of one application. They are two different
applications.**

| | Production | Release Candidate |
|---|---|---|
| API surface | `/api/health` only [OBSERVED] | ~40 route modules [REPOSITORY] |
| Health response | one field: `status` [OBSERVED] | five fields, `version: "1.1.0"` [TESTED] |
| Frontend transport | calls `/api/trpc/auth.me` [OBSERVED] | plain REST [REPOSITORY] |
| tRPC in this codebase | — | **absent entirely** [REPOSITORY] |
| Authentication | every route 404s [OBSERVED] | register and login both 200 [TESTED] |
| Database | UNKNOWN | 115 tables via Prisma [TESTED] |

The deployed frontend belongs to an earlier generation of the product. **Nobody
has been able to sign in to courtaccess.net for approximately six weeks**, and
no rollback restores that capability, because it has not existed.

## Overall deployment readiness

The Release Candidate is **certified as an artifact** and **not certified
against the target host**. It builds reproducibly, runs with no TypeScript
present, serves every endpoint tested, and works with Redis absent. What has
never been established is the state of the production database, the Node
version, and several host facts that only the host can answer.

## Top deployment risks

1. **The TLS certificate expires 9 August 2026** — about 2 days from
   certification. Independent of any deployment. [OBSERVED]
2. **nginx rejects every upload chunk.** The body limit is 1 MB; the portal
   sends 8 MB chunks. [OBSERVED] [REPOSITORY]
3. **The production database is unobserved**, and one of its three possible
   states makes the RC unable to run at all. [TESTED]
4. **Evidence defaults to a path inside the application directory**, where a
   later deployment can destroy it. [REPOSITORY]
5. **Safari is untested**, and Case 001 is intended to be uploaded from it.

## Overall recommendation

# NO GO

Two verified blockers and two blocking UNKNOWNs. Detail in Parts 10 to 12.

---

# PART 2 — Production runtime inventory

| Item | Value | Evidence |
|---|---|---|
| Host | `44.209.225.79`, AWS us-east-1 range | [OBSERVED] |
| Web server | nginx/1.28.1 | [OBSERVED] `Server` header |
| CDN | **None.** DNS resolves straight to the EC2 address; no `CF-Ray` | [OBSERVED] |
| Node version | **UNKNOWN** | — |
| npm version | **UNKNOWN** | — |
| PM2 version | **UNKNOWN** | — |
| PM2 process name | **UNKNOWN** | — |
| PM2 exec mode | **UNKNOWN** — decides whether zero-downtime is possible | — |
| PM2 manages the app | Yes | [OWNER] |
| PM2 persistence | `~/.pm2/dump.pm2` | [OWNER] |
| PM2 boot unit | **UNKNOWN** | — |
| Startup method | PM2 | [OWNER] |
| Working directory | `/var/www/courtaccess` | [OWNER] |
| Runtime entry point | `/var/www/courtaccess/dist/index.js` | [OWNER] |
| What that file is | **Not this codebase.** Answers one health field, 404s all else | [OBSERVED] |
| Git branch on host | **UNKNOWN** | — |
| Git commit on host | **UNKNOWN** | — |
| Backend uptime | ~3,963,107 s — started about 22 June 2026 | [OBSERVED] |
| API port | 3000 | [OWNER] |
| Static assets | `/var/www/courtaccess/dist/public` | [OWNER] |
| Deployed bundle | `index-HSm04BBy.js`, `Last-Modified` 26 June 2026 | [OBSERVED] |
| HTTP → HTTPS | Working, 301 | [OBSERVED] |
| Certificate | Let's Encrypt E7, CN `courtaccess.net` | [OBSERVED] |
| `notBefore` | `May 11 18:14:09 2026 GMT` | [OBSERVED] |
| `notAfter` | **`Aug 9 18:14:08 2026 GMT`** | [OBSERVED] |
| Upload limit | **1 MB** (nginx default) | [OBSERVED] |
| Compression, HTML | gzip working | [OBSERVED] |
| Compression, JS | **Not enabled** — no `Content-Encoding` on the bundle | [OBSERVED] |
| Caching | `ETag` only; no `Cache-Control`, no `Expires` | [OBSERVED] |
| Proxy timeouts | **UNKNOWN** | — |
| Proxy buffering | **UNKNOWN** | — |
| Config file path | **UNKNOWN** — needed to make the upload-limit edit | — |

**How the 1 MB limit was measured** [OBSERVED] — POST bodies of increasing size
to `/api/health`:

| Body | Response | Meaning |
|---|---|---|
| 1024 KB | 404 | Body accepted; the API rejected the path |
| 1536 KB | **413** | nginx refused before the API saw it |

The portal's chunk size is 8 MB — `CHUNK_BYTES`,
`backend/src/certification/uploadPortal.ts:24` [REPOSITORY].

---

# PART 3 — Environment inventory

Derived by scanning `process.env` across the backend [REPOSITORY]. Presence on
the host is UNKNOWN for every row; the audit script reports presence only, never
values.

## Required — the RC will not work without these

| Variable | Required | Runtime effect | Restart | Safe to change live |
|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | Server will not start. Read by `schema.prisma:10` | Yes | No |
| `JWT_SECRET` | **Yes** | Signs access tokens | Yes | **No** — changing it signs every user out |
| `JWT_REFRESH_SECRET` | **Yes** | Signs refresh tokens | Yes | **No** — invalidates all sessions |
| `COOKIE_SECRET` | **Yes** | Cookie signing | Yes | No |
| `FRONTEND_URL` | **Yes** | CORS origin and generated links | Yes | Yes |

## Required for this host specifically

| Variable | Required | Runtime effect | Restart | Safe to change live |
|---|---|---|---|---|
| `PORT` | **Yes** | **Defaults to 3001** (`server.ts:60`). nginx proxies to 3000, so this must be `3000` or every API call 502s | Yes | Yes |
| `HOST` | Recommended | Set `127.0.0.1`; nginx is the only client | Yes | Yes |
| `NODE_ENV` | Recommended | Set `production` **at runtime only** | Yes | Yes |
| `DISABLE_WORKERS` | **Yes here** | `true` stops five BullMQ workers starting. Verified: log line `[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var` | Yes | Yes |

**`NODE_ENV=production` must not be set while building.** npm then skips
devDependencies, and TypeScript, Vite and esbuild are all devDependencies, so
the build fails with `tsc: not found`. Found in the dress rehearsal;
`build-release.sh` now handles it.

## Storage — one of these was wrong in every earlier document

| Variable | Default | Notes |
|---|---|---|
| `EVIDENCE_UPLOAD_DIR` | **`/var/www/courtaccess/uploads/evidence`** | `evidenceDirectUpload.ts:40` |
| `CERTIFICATION_STAGING_DIR` | `/var/tmp/courtaccess-certification-staging` | `uploadPortal.ts:21` |

**`EVIDENCE_STORAGE_DIR` does not exist in this codebase.** Every earlier
deployment document of mine named it, including the execution procedure. Setting
it has **no effect whatsoever**, and evidence would then silently fall back to
the default — inside `/var/www/courtaccess`, the directory a deployment
replaces. Corrected throughout in this commit.

## Optional — absence degrades, never blocks

| Variable | Effect if absent |
|---|---|
| `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` | Defaults to `redis://localhost:6379`. Queue features unavailable. See Part 4 |
| `STRIPE_*` (~20 variables) | Billing inert |
| `AWS_*`, `S3_POLICY_BUCKET`, `R2_*` | Object storage unused; evidence writes to local disk |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` | AI analysis unavailable |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | Policy graph unavailable. Driver is lazy (`neo4jPolicyGraph.ts:16-24`); verified not required at startup [TESTED] |
| `SMTP_HOST`, `SES_REGION`, `PASSWORD_RESET_FROM_EMAIL` | Mail will not send |
| `CPRA_*` | CPRA campaigns unavailable |
| `LAW_CACHE_MAX_AGE_MS` | Defaults to 24 h |
| `LEGINFO_MIN_GAP_MS` | Defaults to 400 ms. Do not lower — it is politeness to a public service |
| `GIT_COMMIT` | Falls back to the build stamp, then to git |

---

# PART 4 — External services

| Service | Configured | Verified | Classification |
|---|---|---|---|
| PostgreSQL | `DATABASE_URL` present [OWNER] | Version, schema, reachability all UNKNOWN | **Blocking** |
| Redis | **Absent** [OWNER] | RC runs without it [TESTED] | **Optional** |
| California Legislative Information | UNKNOWN on host | Reachable from here, HTTP 200 [TESTED] | Blocking for statutory retrieval |
| Cloudflare | **Not present** [OBSERVED] | Host serves directly and correctly | Optional |
| OCR (tesseract) | UNKNOWN | Never verified on host | Blocking for Case 001 |
| ffmpeg / ffprobe | UNKNOWN | Never verified on host | Optional — durations report unknown |
| Speech-to-text | **Not implemented** [REPOSITORY] | Nothing spoken in a recording is searchable | Known limitation |
| Video processing | **Storage and duration only** [REPOSITORY] | No transcoding or analysis | Known limitation |
| Neo4j | UNKNOWN | Lazy driver; not needed at startup [TESTED] | Optional |
| OpenAI | UNKNOWN | Never exercised | Optional |
| Anthropic | UNKNOWN | Never exercised | Optional |
| Google AI | UNKNOWN | Never exercised | Optional |
| Stripe | UNKNOWN | Never exercised | Optional |
| Twilio | UNKNOWN | Never exercised | Optional |
| SMTP | UNKNOWN | Never exercised | Optional |
| AWS SES | UNKNOWN | Never exercised | Optional |
| AWS S3 / R2 | UNKNOWN | Never exercised | Optional |

"Never exercised" means exactly that: no certification suite in this repository
has run against these services with real credentials.

## Redis — reclassified, with the evidence

Programs 163 and 164 classified Redis absence as blocking. **That was wrong**,
and it was my error. It was inferred from BullMQ appearing across 40-odd files
rather than from tracing the certification path.

The Case 001 path traced call by call [REPOSITORY]:

| Step | Location | Uses Redis |
|---|---|---|
| Chunked upload | `certification/uploadPortal.ts` | No |
| Inventory and hashing | `certificationImport.ts` | No |
| Ingest | `await ingestEvidence(...)` — `certificationImport.ts:359` | No |
| Ingest implementation | `evidence/evidenceDirectUpload.ts` — zero queue references | No |
| Media duration | `certification/mediaProbe.ts`, ffprobe, inline | No |
| Timeline | `await reconstructTimeline(...)` — `certificationRun.ts:134` | No |
| Contradictions | `timelineEvent.conflictFlag` — `certificationRun.ts:273` | No |
| CALCRIM | `await analyzeCase(...)` — `certificationRun.ts:229` | No |

Then verified at runtime [TESTED] — the bundled artifact with
`REDIS_URL=redis://127.0.0.1:6399` (nothing listening):

```
GET  /api/health   -> {"status":"ok", … "version":"1.1.0" …}
POST /api/auth/login -> 200
```

**Measured cost of Redis absence:** the singleton connection
(`lib/redis.ts:8`, retry capped at 5,000 ms) logs a connection error
continuously. Counted over 60 seconds: **12 per minute, about 17,280 per day.**
The process does not crash — an `error` handler is attached at line 19 — but
that volume will bury real errors in the PM2 log. Set `DISABLE_WORKERS=true`;
the log noise from the singleton remains.

**A caution that outlives this deployment.** `/api/health` (`server.ts:204`)
returns a static object and touches neither Redis nor the database. PM2 reports
online and any uptime monitor stays green while every queue-backed subsystem is
dead. That is precisely the failure mode that let the current stub sit unnoticed
for six weeks. A green health check is not evidence that the platform works.

---

# PART 5 — Database certification

## Production database

| Field | Value |
|---|---|
| Version | **UNKNOWN** |
| Database name | **UNKNOWN** |
| Owner | **UNKNOWN** |
| Schema | **UNKNOWN** |
| Encoding / collation | **UNKNOWN** |
| Size | **UNKNOWN** |
| Local or external | **UNKNOWN** |
| `_prisma_migrations` exists | **UNKNOWN** |
| Applied migrations | **UNKNOWN** |
| Latest migration | **UNKNOWN** |
| Failed migrations | **UNKNOWN** |
| Pending migrations | **UNKNOWN** |
| Drift | **UNKNOWN** |

The Program 166 commands were produced and no output has been returned. Per
"No Observation → UNKNOWN", nothing here is filled in.

## Release Candidate schema [TESTED]

| | |
|---|---|
| Migrations | 30 |
| Tables after full apply | 116 (115 models + `_prisma_migrations`) |
| Indexes | 484 |
| Foreign keys | 53 |
| Enums | 0 |
| Extensions | 0 (beyond default `plpgsql`) |
| Functions / triggers / views / matviews | 0 each |
| Down migrations | **0** |

No extensions and no enums removes two entire categories of incompatibility.
The RC needs an ordinary UTF8 PostgreSQL 14+ database and nothing else.

## Every statement that modifies existing data [REPOSITORY]

| Statement | Location | Effect |
|---|---|---|
| `INSERT INTO "schema_versions"` | `…schema_version_control:20` | Seeds a row into a table the same migration creates |
| `UPDATE "schema_versions"` | `…drift_repair:73` | Copies snake_case columns to camelCase |
| `DROP COLUMN` ×4 | `…drift_repair:82-85` | **Irreversible** |
| `SET DATA TYPE TIMESTAMP(3)` ×4 | `…drift_repair:50,52,53,55` | Truncates microseconds to milliseconds — **irreversible, silent** |
| `ADD COLUMN … NOT NULL DEFAULT` ×5 | `…drift_repair:22,62-65` | Writes a default into existing rows |
| `DROP NOT NULL` ×5 | `…drift_repair:38-43` | Relaxes constraints; no data change |

And the counts that matter as much: **`DROP TABLE` 0, `DELETE` 0, `TRUNCATE` 0,
`DROP CONSTRAINT` 0, `SET NOT NULL` 0.**

No migration deletes, truncates or drops any user, case, evidence, document or
timeline data. The only destructive statements target four columns of
`schema_versions`, an internal bookkeeping table, and their contents are copied
forward first. `20260805200000_v1_schema_drift_repair` is the only migration in
the chain carrying any risk; the other 29 are pure creation.

## The three states, tested rather than reasoned about [TESTED]

| Production state | Result | Classification |
|---|---|---|
| Empty | 116 tables, 30 applied, "No difference detected" | READY WITH MIGRATIONS |
| Partially applied | 20 → 98 tables, then 30 → 116; identical to all-at-once | READY WITH MIGRATIONS |
| Populated, not Prisma-managed | `P3005`, **no DDL executed, database unchanged** | NOT READY |

Scenario 3 in full:

```
$ npx prisma migrate deploy
Error: P3005
The database schema is not empty.

$ psql -tAc "select table_name from information_schema.tables where table_schema='public';"
cases
users
$ ... to_regclass('public._prisma_migrations') is not null
f
```

This **disproves** the half-migrated-schema blocker claimed in Programs 163 and
164. Prisma refuses before executing anything.

**But it introduces a worse hazard.** `prisma migrate resolve --applied` — the
remedy the P3005 message invites — marks migrations applied *without running
them*. Against a foreign schema that would record 30 migrations as applied on a
database missing 113 tables, and Prisma would then believe the schema correct.
**That is the only action in this entire deployment capable of unrecoverable
damage.** Run the read-only diff first.

## Rollback compatibility

**Chain reversibility: NO.** Zero down migrations, four `DROP COLUMN`, four
irreversible precision reductions. Database rollback requires restoring a dump.

**Old application compatibility: YES**, and nearly moot — the currently
deployed application issues no database queries at all. Every route except
`/api/health` 404s [OBSERVED]. A process that queries nothing cannot be broken
by an additive schema change. Independently, no table is dropped, no column
outside `schema_versions` is dropped, and all five constraint changes *relax*
nullability.

## Classification

# NOT READY

Not from a defect. Compatibility is a comparison; one side is unobserved, and
one of its three possible states cannot be resolved by migration at all.

---

# PART 6 — Filesystem certification

| Directory | Purpose | Default | State |
|---|---|---|---|
| `/var/www/courtaccess` | Application root | — | Exists [OWNER] |
| `/var/www/courtaccess/dist` | Runtime entry | — | Exists [OWNER] |
| `/var/www/courtaccess/dist/public` | Static assets | — | Exists [OWNER] |
| `/var/www/courtaccess/node_modules` | Required — bundle keeps packages external | — | **UNKNOWN** |
| `/var/www/courtaccess/uploads/evidence` | **Evidence, by default** | `evidenceDirectUpload.ts:40` | **UNKNOWN** |
| `/var/tmp/courtaccess-certification-staging` | Upload chunk assembly | `uploadPortal.ts:21` | **UNKNOWN** |
| `~/.pm2/dump.pm2` | PM2 persistence | — | Exists [OWNER] |
| PM2 logs | `~/.pm2/logs` | — | **UNKNOWN** |
| Permissions and ownership | | | **UNKNOWN** |
| Disk utilisation | | | **UNKNOWN** |
| Backup status | | | **UNKNOWN** |

## Capable of preventing deployment

**1. Evidence defaults inside the application directory.** `EVIDENCE_UPLOAD_DIR`
defaults to `/var/www/courtaccess/uploads/evidence` — the directory a
deployment replaces. Set it to `/var/lib/courtaccess/evidence` **using that
exact name**. The name in every earlier revision of my documents was
`EVIDENCE_STORAGE_DIR`, which the application never reads, so following those
documents would have produced a false sense of safety while evidence landed in
the default location.

**2. `node_modules` must accompany the release.** The bundle keeps packages
external (`--packages=external`), and Prisma's query engine is a native binary.
Verified: the isolated release required `node_modules` and about 600 MB
[TESTED].

**3. Disk space.** During upload each file exists twice — staged chunks plus the
ingested copy — on top of the release. Free space is UNKNOWN.

**4. `build-release.sh` is destructive by design.** It runs `rm -rf` on its
output directory. A guard added after the dress rehearsal refuses if the target
contains `.env`, `evidence/` or `staging/`. Never point it at a live release.

---

# PART 7 — Security certification

| Control | Status | Evidence |
|---|---|---|
| TLS | Present and valid | [OBSERVED] |
| **Certificate renewal** | **FAILING** — expires 9 Aug 2026; not renewed in ≥28 days | [OBSERVED] |
| HTTP → HTTPS | Working, 301 | [OBSERVED] |
| HSTS | `max-age=31536000; includeSubDomains` | [OBSERVED] |
| CSP | Full policy present | [OBSERVED] |
| `X-Frame-Options` | `SAMEORIGIN` | [OBSERVED] |
| `X-Content-Type-Options` | `nosniff` | [OBSERVED] |
| COOP / CORP | `same-origin` | [OBSERVED] |
| Authentication | JWT; register and login both 200 | [TESTED] |
| Authorization | `/api/law/status` and `/api/charging/codes` return **401 unauthenticated, 200 with a token** | [TESTED] |
| Security hardening at startup | `JWT auth, rate limiting, CSRF, security headers, upload protection, security logging` | [TESTED] |
| Secrets handling | Presence-only in all audit tooling; the inspector masks the password | [REPOSITORY] |
| API exposure | UNKNOWN — whether the API binds `0.0.0.0` or `127.0.0.1` on the host | — |

**Requiring attention:**

1. **Certificate renewal is broken.** A 90-day certificate renewed at 30 days
   remaining should never reach 2. This is the single most urgent item in this
   document and is unaffected by any deployment decision.
2. **`HOST=127.0.0.1` should be set explicitly.** The RC defaults to `0.0.0.0`.
   nginx is the only legitimate client of port 3000.
3. **The security header posture is genuinely good** and should not be disturbed
   by the upload-limit edit.

---

# PART 8 — Release Candidate certification

All [TESTED] at commit `4bdaca1` unless noted.

## Build reproducibility

```
build 1: bad0f1ec9f09ddb5ea044b04b87dd594d147d1fd7d6875ba3e3989efc173df69
build 2: bad0f1ec9f09ddb5ea044b04b87dd594d147d1fd7d6875ba3e3989efc173df69
REPRODUCIBLE
```

Two clean rebuilds, byte-identical.

## Artifacts

| Artifact | Size | SHA-256 (first 16) |
|---|---|---|
| `dist/index.js` | 2,118,331 bytes | `bad0f1ec9f09ddb5` |
| `dist/public/assets/index-DBzLrGca.js` | 1,637,754 bytes (382.61 kB gzipped) | `f0d93006359cbe61` |
| `dist/public/assets/index-BBWlHAaa.css` | 56,321 bytes | `966e1ed26f9a885c` |
| `dist/public/index.html` | 1,560 bytes | — |
| `dist/public/vite.svg` | 1,497 bytes | — |
| `dist/build-info.json` | commit, branch, build time | — |

Build stamp in the served HTML:
`CourtAccess build: 4bdaca1 2026-08-07T18:14:14.384Z`

Build command: `npm run build` in the repository root (frontend) and in
`backend/` (esbuild bundle). `deploy/build-release.sh` performs both and
assembles the production layout.

## TypeScript independence

An isolated release was assembled containing only `dist/index.js`,
`dist/build-info.json`, `node_modules` and `package.json`:

```
TypeScript files outside node_modules: 0
prisma/ directory: absent
```

It started and served correctly. **No TypeScript source and no `prisma/`
directory are required at runtime.** `node_modules` is required.

## Startup verification

```
[Server] Security hardening active: JWT auth, rate limiting, CSRF,
         security headers, upload protection, security logging
[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var
```

## Health verification

```json
{"status":"ok","timestamp":"2026-08-07T18:10:33.931Z","version":"1.1.0",
 "service":"court-access-backend","environment":"production"}
```

## Endpoint verification — the five requested in Program 160

| Endpoint | Result |
|---|---|
| `GET /api/health` | **200** |
| `POST /api/auth/register` | **200**, returns an access token |
| `POST /api/auth/login` | **200**, returns an access token |
| `GET /api/law/status` | **401** unauthenticated, **200** with a token |
| `GET /api/charging/codes` | **401** unauthenticated, **200** with a token |

The 401s are correct behaviour, not defects — both routes are authenticated.
An initial `POST /api/auth/register` returned 400 with
`{"error":"You must accept the Terms of Service and Privacy Policy"}`; that is
the API enforcing `termsAccepted` and `privacyAccepted`
(`security/authMiddleware.ts:543`), not a fault.

## PM2 compatibility

Verified under PM2 7.0.3 in fork mode: online, 0 restarts, runs with `--cwd`
set to the release directory, serves on port 3000, and survives
`pm2 save` / `pm2 resurrect` with a **3-second** recovery.

## Redis independence

Verified with nothing listening on the configured Redis port: server starts,
health 200, login 200. Cost measured at 12 log lines per minute.

## Browser verification

**116 of 116 checks pass** against the bundled artifact behind nginx.

| Browser | Verified |
|---|---|
| Chromium (Chrome / Edge engine) | **Yes** — all 116 |
| Safari, macOS | **No** |
| Safari, iPadOS / mobile | **No** |
| Firefox | **No** |
| Edge | Inferred only — Chromium engine, not run |

## Safari compatibility — UNKNOWN

The upload portal's folder selection uses `webkitdirectory`, whose behaviour
differs across engines, and Case 001 is intended to be dragged from Finder in
Safari. A documented fallback exists — **Select Discovery** with multi-file
selection — but it has never been exercised there. No command on the host can
settle this; it needs a person with a Mac.

## Case 001 upload path

Certified end to end in code and synchronous throughout (Part 4 table). The
path is blocked today by the nginx 1 MB limit, and its analysis quality depends
on OCR and leginfo reachability, both UNKNOWN on the host.

---

# PART 9 — Production deployment plan

The full runbook with exact commands is
[`EXECUTION_PROCEDURE.md`](EXECUTION_PROCEDURE.md). This is the authoritative
sequence and the conditions attached to each stage.

## Stage 0 — Independent of deployment, do today

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

The certificate expires 9 August. If renewal is broken, fix it before anything
else. Once it lapses no browser reaches the site at all.

## Stage 1 — Pre-deployment checklist

- [ ] Certificate renewed; new expiry at least 60 days out
- [ ] `node --version` ≥ 22
- [ ] `pm2 list` recorded; **process name and exec mode known**
- [ ] PM2 boot unit present (`pm2 startup` — **without `sudo`**; with `sudo` it installs)
- [ ] `DATABASE_URL` readable; database reachable
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` located and carried forward
- [ ] Disk: ≥ 20 GB free on the `/var` volume
- [ ] nginx server-block file path identified
- [ ] `/var/lib/courtaccess/{staging,evidence}` created and owned by the PM2 user

## Stage 2 — Database verification

Run `deploy/inspect-database.mjs`, then `prisma migrate status`, then
`prisma migrate diff`. All read-only; the inspector is enforced read-only by
`BEGIN TRANSACTION READ ONLY`.

**Gate:** proceed only if the summary reads `EMPTY DATABASE`,
`PRISMA-MANAGED, SCHEMA COMPLETE`, or `PRISMA-MANAGED, SCHEMA INCOMPLETE` with
unfinished migrations at 0. **Stop** on `POPULATED BUT NOT PRISMA-MANAGED` and
**do not baseline**.

## Stage 3 — Backup checklist

- [ ] `pg_dump "$PGURL" -Fc -f ~/backup-$(date +%F).dump` — or, if RDS, a snapshot with its restore point recorded
- [ ] Restore verified listable: `pg_restore -l ~/backup-*.dump | head`
- [ ] `cp ~/.pm2/dump.pm2 ~/dump.pm2.rollback`
- [ ] `sudo cp -a /var/www/courtaccess /var/www/courtaccess.rollback`
- [ ] nginx config copied aside

## Stage 4 — Build

```bash
git fetch origin cursor/gold-standard-upload-portal-9f94
git checkout cursor/gold-standard-upload-portal-9f94
git rev-parse HEAD          # expect 4bdaca19b171cb8a920a50a4a6eb19e2733ed724
bash deploy/build-release.sh /opt/courtaccess-release-$(date +%Y%m%d)
```

Build with `NODE_ENV` unset. The script forces `--include=dev`.

## Stage 5 — Artifact verification

```bash
sha256sum "$RELEASE/dist/index.js"   # expect bad0f1ec9f09ddb5ea044b04b87dd594d147d1fd7d6875ba3e3989efc173df69
ls "$RELEASE/dist/public/index.html" "$RELEASE/dist/build-info.json"
find "$RELEASE" -name '*.ts' -not -path '*/node_modules/*' | wc -l   # expect 0
```

**Failure condition:** a differing checksum means the backend bundle did not
come from the certified commit. Stop. The checksum holds for any commit that
changes only `deploy/`; it will legitimately differ once `backend/src` changes,
and re-certification is then required.

## Stage 6 — Configuration

Write `$RELEASE/.env` per Part 3. `PORT=3000`, `DISABLE_WORKERS=true`,
`EVIDENCE_UPLOAD_DIR` — that exact name. `chmod 600`.

## Stage 7 — Migrations

```bash
cd "$RELEASE" && npx prisma migrate deploy
```

**Failure condition:** `P3005` — stop, nothing was modified. Any other error —
stop and restore from Stage 3.

## Stage 8 — Smoke test on a spare port

Start the release on 3399 under a temporary PM2 name, confirm `/api/health`
returns `version: "1.1.0"`, then stop it. **Production is untouched to this
point.**

## Stage 9 — nginx

```nginx
client_max_body_size 64m;
proxy_request_buffering off;
```

In the same server block as the `proxy_pass`. Then `sudo nginx -t` before
`sudo systemctl reload nginx`.

**Failure condition:** `nginx -t` fails — revert the file, do not reload.

## Stage 10 — Cut-over

Point PM2 at the new release and reload. In fork mode expect 20–25 seconds of
downtime; cluster mode allows zero. **Watch the restart counter** — a
crash-looping deploy shows as a rising `↺` in `pm2 list` within seconds, well
before anyone reports an outage. Then `pm2 save`.

## Stage 11 — Post-deployment verification

- [ ] `curl -s https://courtaccess.net/api/health` shows `version: "1.1.0"`
- [ ] `POST /api/auth/login` returns 200, not 404
- [ ] The page source carries `CourtAccess build: 4bdaca1`
- [ ] A 2 MB POST is **not** rejected with 413
- [ ] `pm2 list` shows 0 restarts after five minutes
- [ ] Reboot test, scheduled deliberately: the process returns by itself

## Stage 12 — Browser verification

Chrome and Safari, macOS: sign in, open the Gold Standard Certification portal,
select a small folder, confirm the progress UI advances. **Safari is the
material gap and must be exercised by hand.**

## Stage 13 — Case 001

**Only after Stage 12 passes in Safari.** Administration → Gold Standard
Certification → Import Certification Case. Upload through the portal; never by
SSH or file copy.

**Do not upload Case 001 if the PM2 boot unit is missing.** Real discovery
should not go into a deployment that will not survive a reboot.

## Rollback

```bash
pm2 delete <new-name>
cp ~/dump.pm2.rollback ~/.pm2/dump.pm2
pm2 resurrect
```

Rehearsed: **3-second** recovery. Then restore nginx and reload. Restore the
database **only** if migrations ran and you are abandoning the deployment.

**What rollback actually restores:** a health-check stub in front of a frontend
that cannot sign anyone in. A known state, not a working service.

## Recovery from a failed migration

Do not run `migrate resolve --applied`. Restore the Stage 3 dump, then diagnose
with `prisma migrate diff` before attempting again.

---

# PART 10 — Remaining unknowns

There are remaining deployment UNKNOWNs. Every command below is read-only.

## Blocking

| UNKNOWN | Why it matters | Command | Safe |
|---|---|---|---|
| Production database state | The RC reads 115 tables unconditionally; one state makes it unrunnable | `node deploy/inspect-database.mjs` | Yes — enforced by `BEGIN TRANSACTION READ ONLY`; 8 write types refused with 25006 |
| Node version | Bundle targets `node22`; older runtimes fail with a `SyntaxError` inside a 2 MB file | `node --version` | Yes |
| Certificate renewal works | Expiry is ~2 days out; lapse locks everyone out of the site | `sudo certbot renew --dry-run` | Yes — staging endpoint, writes no certificate |
| Backup capability | The chain is irreversible; a dump is the only rollback | `pg_dump --version && pg_dump "$PGURL" --schema-only -f /tmp/probe.sql` | Yes — reads only |

## Blocking the cut-over specifically

| UNKNOWN | Why it matters | Command | Safe |
|---|---|---|---|
| PM2 process name and exec mode | The cut-over stops it by name; guessing risks stopping something unrelated | `pm2 list && pm2 describe <name>` | Yes |
| nginx server-block file | The 1 MB limit must be raised in the right file; the wrong one silently changes nothing | `sudo nginx -T \| grep -n 'server_name.*courtaccess'` | Yes |
| `JWT_SECRET` present | A new one signs out every user at cut-over | `sudo tr '\0' '\n' < /proc/$PID/environ \| grep -c '^JWT_SECRET='` | Yes — prints a count, never the value |
| PM2 boot unit | Blocks Case 001, not the deployment | `pm2 startup` — **without `sudo`** | Yes without `sudo`; **with `sudo` it installs the unit** |
| Disk space | An upload that fills the disk leaves a partial corpus | `df -h /var && df -i /var` | Yes |

## Blocking Case 001 only

| UNKNOWN | Why it matters | Command | Safe |
|---|---|---|---|
| Outbound HTTPS to leginfo | Charges resolve to nothing; upload succeeds, analysis empty | `curl -s -o /dev/null -w '%{http_code}\n' https://leginfo.legislature.ca.gov/` | Yes |
| OCR present | No text extracted; nothing citable | `command -v tesseract && tesseract --version` | Yes |
| Evidence directory location | If it already holds data inside `/var/www/courtaccess`, moving it is part of the deployment | `ls -ld /var/www/courtaccess/uploads/evidence` | Yes |
| **Safari** | Case 001 is intended to be uploaded from it | **No command exists.** Requires a Mac | — |

## Non-blocking

| UNKNOWN | Effect |
|---|---|
| ffmpeg | Durations report unknown; a silent recording cannot be distinguished from an untranscribed one |
| npm and PM2 versions | Informational |
| Proxy timeouts and buffering | Large uploads may need `proxy_read_timeout` raised |
| Git branch and commit on host | Informational; the running artifact is not this codebase anyway |
| Stripe, S3, SES, AI providers, Twilio, Neo4j | Features inert; nothing else depends on them |

---

# PART 11 — Final risk matrix

## Critical

**C1 — The TLS certificate expires 9 August 2026 · RESOLVED 7 August 2026**
*Renewed the same day* to `Nov 5 22:08:52 2026`, serial `060359B4…`, issuer
`YE1`, verified by TLS handshake. The entry is retained as the record of what
was observed; it is no longer a blocker.
*Evidence at the time* [OBSERVED]: `notAfter = Aug 9 18:14:08 2026 GMT`; not renewed in ≥28 days.
*Impact:* every browser refuses the site with a full-page interstitial. Peter cannot reach the portal in any browser.
*Probability:* certain unless renewal is fixed.
*Mitigation:* `sudo certbot renew --dry-run` today, then renew.

**C2 — nginx rejects every upload chunk**
*Evidence* [OBSERVED]: 413 at 1536 KB; `CHUNK_BYTES` is 8 MB [REPOSITORY].
*Impact:* not one byte of Case 001 reaches the application.
*Probability:* certain.
*Mitigation:* `client_max_body_size 64m; proxy_request_buffering off;`

**C3 — The production database is unobserved**
*Evidence:* no output returned from Program 166.
*Impact:* one of three states makes the RC unable to run; another risks an unrecoverable baseline error.
*Probability:* unquantifiable — that is the problem.
*Mitigation:* run `deploy/inspect-database.mjs`.

## High

**H1 — Node version unknown**
*Evidence* [REPOSITORY]: bundle built `--target=node22`.
*Impact:* `SyntaxError` inside a 2 MB minified file — unpleasant to diagnose under pressure.
*Probability:* low; EC2 images commonly ship Node 20 or 22.
*Mitigation:* `node --version`. If below 22, upgrade or rebuild at a lower target.

**H2 — Evidence defaults inside the application directory**
*Evidence* [REPOSITORY]: `evidenceDirectUpload.ts:40`.
*Impact:* a later deployment destroys uploaded discovery — privileged criminal discovery.
*Probability:* high if unaddressed; every earlier document of mine named a variable that does not exist.
*Mitigation:* set `EVIDENCE_UPLOAD_DIR=/var/lib/courtaccess/evidence`, verify after the first upload that files actually land there.

**H3 — No verified backup**
*Evidence* [REPOSITORY]: 0 down migrations; `DROP COLUMN` at `…drift_repair:82-85`.
*Impact:* a failed migration cannot be undone.
*Probability:* low — `P3005` aborts cleanly — but non-zero.
*Mitigation:* Stage 3, including a verified listable dump.

**H4 — Safari untested**
*Evidence:* all 116 browser checks ran on Chromium.
*Impact:* Case 001 cannot be uploaded from the intended browser.
*Probability:* moderate — `webkitdirectory` differs across engines.
*Mitigation:* exercise both the folder picker and the **Select Discovery** fallback on a Mac before Case 001.

## Medium

**M1 — PM2 process name unknown.** Cut-over stops it by name; guessing risks an unrelated outage. Mitigation: `pm2 list`.

**M2 — Rollback restores nothing usable.** The previous version is a stub in front of a broken frontend [OBSERVED]. Impact: no fallback to working software exists. Mitigation: none available; proceed with eyes open.

**M3 — PM2 boot persistence unknown.** Mitigation: `pm2 startup` without `sudo`. Blocks Case 001, not the deployment.

**M4 — Redis absence floods the log.** 12 lines per minute, ~17,280 per day [TESTED]. Real errors get buried. Mitigation: `DISABLE_WORKERS=true` reduces it; installing Redis in 1.1 removes it.

**M5 — Fork mode means real downtime.** 20–25 seconds if PM2 runs in fork mode. Mitigation: schedule it; or use cluster mode if already configured.

## Low

**L1 — JS bundle served uncompressed** [OBSERVED]. 1.6 MB instead of 383 kB.
**L2 — No `Cache-Control` on static assets** [OBSERVED]. Browsers revalidate every load; `ETag` keeps it correct.
**L3 — Timestamp precision loss** on `evidence_chunks` and `verified_facts`, silent [REPOSITORY]. Sub-millisecond precision is not used for evidence ordering.
**L4 — `GIT_COMMIT` fallback** now resolves through a build stamp; previously stored null in production.

## Informational

**I1 — Speech-to-text not implemented.** Nothing spoken in a recording is searchable. A documented product limitation, not a defect.
**I2 — Video processing is storage and duration only.** No transcoding or analysis.
**I3 — No Cloudflare.** The host serves directly and correctly.
**I4 — 164 TypeScript type errors** under `tsc --noEmit`. The bundle is produced by esbuild, which does not typecheck; runtime behaviour is verified by the 116 browser checks and the endpoint tests. Not a deployment blocker, and a real quality debt for 1.1.

---

# PART 12 — Final GO / NO-GO

# NO GO

## Supported by

**Two verified blockers**, both measured against the live host:

1. The TLS certificate expires 9 August 2026 — about 2 days from certification —
   and automatic renewal has not run in at least 28 days. [OBSERVED]
2. nginx caps request bodies at 1 MB against 8 MB upload chunks. [OBSERVED]

**Two blocking unknowns**, each resolvable by one read-only command:

3. The production database state is unobserved, and one of its three possible
   states leaves the RC unable to run. [TESTED — the state exists and is real]
4. The Node version is unobserved and the bundle targets Node 22.

## What is *not* holding this up

The Release Candidate itself. It builds reproducibly to a known checksum, runs
with no TypeScript present, serves every endpoint tested including full
registration and login, passes 116 of 116 browser checks behind nginx, runs
under PM2 with a rehearsed 3-second rollback, and works with Redis entirely
absent. Four earlier blockers — the missing build output, the unknown process
manager, the supposed absence of PostgreSQL, and Redis — are disproven and
withdrawn.

## What converts this to GO WITH LIMITATIONS

- The certificate renewed, verified by a new expiry date
- `node --version` reporting 22 or later
- `inspect-database.mjs` reporting `EMPTY DATABASE` or `PRISMA-MANAGED` with 0
  unfinished migrations
- A verified, listable database dump
- `client_max_body_size 64m` staged

The limitation that would remain even then, and it is not small: **Safari is
unverified**, and Case 001 is intended to be uploaded from it. That is a
limitation on the *first upload*, not on the deployment.

## What would keep it at NO GO

`inspect-database.mjs` reporting `POPULATED BUT NOT PRISMA-MANAGED`. The
question then becomes which database the RC should use, and that is a decision,
not an audit.

---

# PART 13 — Permanent release record

```
────────────────────────────────────────────────────────────────────────
  COURTACCESS — VERSION 1.0 DEPLOYMENT CERTIFICATION
────────────────────────────────────────────────────────────────────────

  Release version      1.0 Release Candidate (API reports 1.1.0)
  Git branch           cursor/gold-standard-upload-portal-9f94
  Git commit           4bdaca19b171cb8a920a50a4a6eb19e2733ed724
  Certification date   7 August 2026
  Programs             158–166

  ── ARTIFACT ────────────────────────────────────────────────────────
  dist/index.js        2,118,331 bytes
  SHA-256              bad0f1ec9f09ddb5ea044b04b87dd594d147d1fd7d6875ba
                       3e3989efc173df69
  Reproducible         Yes — byte-identical across clean rebuilds
  Frontend bundle      1,637,754 bytes (382.61 kB gzipped)
  Build stamp          CourtAccess build: 4bdaca1 2026-08-07T18:14:14Z
  TypeScript at run    None required — verified by deletion
  node_modules         Required (~600 MB), packages kept external

  ── INFRASTRUCTURE ──────────────────────────────────────────────────
  Host                 AWS EC2, 44.209.225.79, us-east-1
  Web server           nginx/1.28.1, serving directly, no CDN
  Process manager      PM2, dump at ~/.pm2/dump.pm2
  Entry point          /var/www/courtaccess/dist/index.js
  Static assets        /var/www/courtaccess/dist/public
  API port             3000
  TLS                  Let's Encrypt E7 — EXPIRES 9 AUGUST 2026
  Upload limit         1 MB — REJECTS THE 8 MB UPLOAD CHUNKS

  ── RUNTIME ─────────────────────────────────────────────────────────
  Node version         UNKNOWN (bundle targets node22)
  PM2 version          UNKNOWN
  PM2 process name     UNKNOWN
  Currently deployed   NOT this codebase — a health-check stub
                       serving a tRPC frontend, since ~22 June 2026

  ── DATABASE ────────────────────────────────────────────────────────
  Production state     UNKNOWN — not observed
  RC schema            116 tables, 484 indexes, 53 foreign keys
                       0 enums, extensions, functions, triggers, views
  Migrations           30, no down migrations
  Destructive          0 DROP TABLE, 0 DELETE, 0 TRUNCATE
                       4 DROP COLUMN, all on schema_versions
  Rollback             Requires a dump restore
  Classification       NOT READY — unobserved

  ── VERIFICATION ────────────────────────────────────────────────────
  Browser checks       116 of 116, Chromium, behind nginx
  Safari               NOT VERIFIED
  Endpoints            health, register, login, law/status,
                       charging/codes — all pass
  PM2 rollback         Rehearsed, 3-second recovery
  Redis independence   Verified — runs with Redis absent
  Migration chain      Verified against empty and partial databases

  ── DEPLOYMENT READINESS ────────────────────────────────────────────
  Release Candidate    CERTIFIED as an artifact
  Target host          NOT CERTIFIED
  Critical issues      3   (TLS expiry, upload limit, database unknown)
  High issues          4
  Blocking unknowns    4

  ── CERTIFICATION STATUS ────────────────────────────────────────────

           FINAL RECOMMENDATION:        NO GO

  Blocked by two verified defects on the host and two unresolved
  unknowns, each resolvable by a single read-only command. The
  Release Candidate itself is not the obstacle.

  Certified by       Automated audit, Programs 158–166
  Evidence           deploy/*.md in this commit
────────────────────────────────────────────────────────────────────────
```

## Supporting documents at this commit

| Document | Contents |
|---|---|
| [`EXECUTION_PROCEDURE.md`](EXECUTION_PROCEDURE.md) | The runbook with exact commands |
| [`DATABASE_CERTIFICATION.md`](DATABASE_CERTIFICATION.md) | Migration analysis and the three tested scenarios |
| [`DATABASE_VERIFICATION_COMMANDS.md`](DATABASE_VERIFICATION_COMMANDS.md) | Read-only commands for the host |
| [`inspect-database.mjs`](inspect-database.mjs) | Read-only inspector, enforced by transaction |
| [`RECONCILIATION.md`](RECONCILIATION.md) | Blocker classifications and withdrawn assumptions |
| [`CUTOVER_READINESS_AUDIT.md`](CUTOVER_READINESS_AUDIT.md) | Remote probe of the live host |
| [`DRESS_REHEARSAL.md`](DRESS_REHEARSAL.md) | Rehearsal and the four defects it found |
| [`CERTIFICATION_REPORT.md`](CERTIFICATION_REPORT.md) | Original artifact certification |
| [`DEPENDENCY_VERIFICATION.md`](DEPENDENCY_VERIFICATION.md) | Per-unknown verification commands |
| [`audit-production.sh`](audit-production.sh) | Read-only host audit script |

**Note on earlier documents.** Several contain classifications this
certification supersedes, marked in place rather than deleted, so the record
shows what was believed and when it changed. Four assumptions were disproven
during this work: that the RC had no build output, that Redis absence blocked
deployment, that PostgreSQL was absent from the host, and that a failed
migration would leave a half-migrated schema. Each was withdrawn on evidence.
