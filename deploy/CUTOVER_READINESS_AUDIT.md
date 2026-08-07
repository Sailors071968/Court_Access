# Production cutover readiness audit

Program 162. **Read only. Nothing was deployed, restarted, modified, built or
merged.**

I have no SSH access to the EC2 instance and no credentials of any kind, so
Phases 1–4, 7, 8 and 9 cannot be observed from here. What follows separates,
strictly, what was **observed** from what is **unverifiable without host
access**. Nothing is inferred into the observed column.

Run [`audit-production.sh`](audit-production.sh) on the host to collect the
rest. It is read-only and prints no secrets.

---

## Verdict

# NOT READY

Three blockers, each supported by evidence gathered remotely today. The first
is a live production incident independent of any deployment.

---

## Blocker 1 — The TLS certificate expires in 2 days

**Observed** by TLS handshake against `courtaccess.net:443`:

```
subject = CN = courtaccess.net
issuer  = C = US, O = Let's Encrypt, CN = E7
notBefore = May 11 18:14:09 2026 GMT
notAfter  = Aug  9 18:14:08 2026 GMT
```

Now: 7 August 2026, 16:53 UTC. **Remaining: 2 days, 1 hour.**

A Let's Encrypt certificate has a 90-day life and certbot normally renews at 30
days remaining. This one is at 2 days, which means **automatic renewal has not
run for at least 28 days**.

If it lapses, every browser refuses the site with a full-page security warning.
Peter would not reach the upload portal in Safari or anywhere else.

**This is happening whether or not you deploy.** It is the most urgent item in
this audit.

Check on the host:

```bash
systemctl list-timers | grep -i certbot
certbot certificates
sudo certbot renew --dry-run
```

## Blocker 2 — nginx rejects the upload portal's chunks

**Observed** by posting bodies of increasing size to `https://courtaccess.net/api/health`:

| Body | Response |
|---|---|
| 256 KB | 404 |
| 512 KB | 404 |
| 1024 KB | 404 |
| **1536 KB** | **413** |
| 2048 KB | 413 |

The 404s are the API rejecting the path — the body was accepted and passed
upstream. The 413 is **nginx** refusing before the application sees it. The
limit therefore sits at nginx's default, **1 MB**.

The upload portal sends **8 MB chunks** (`CHUNK_BYTES` in
`backend/src/certification/uploadPortal.ts:24`).

**Every chunk of Case 001 would be rejected with 413 by nginx.** Not one byte
of discovery would reach the application.

The fix is one directive, already in `deploy/nginx.conf` and section 8.3 of the
execution procedure:

```nginx
client_max_body_size 64m;
proxy_request_buffering off;
```

## Blocker 3 — The deployed frontend is a different application

**Observed** by loading `https://courtaccess.net` in a real browser:

- It issues `GET /api/trpc/auth.me?batch=1&input=…` → **404**
- Console error: `SyntaxError: Unexpected token '<'` — a script request returned
  HTML, meaning a referenced asset is missing and nginx served the SPA fallback
- `/login` renders **no email field**
- No `CourtAccess build:` stamp in the page source

The Release Candidate uses plain REST — `POST /api/auth/login`. **tRPC is not
used anywhere in this codebase.** The deployed frontend is from an entirely
different, earlier generation of the application, not an older build of this
one.

Combined with the Program 158 finding that every API route except
`/api/health` returns 404, this means **nobody can sign in to courtaccess.net
today**, and has not been able to for approximately six weeks.

---

## Phase-by-phase

### Phase 1 — Runtime · **NOT VERIFIABLE FROM HERE**

Node, npm, PM2 versions, startup configuration, dump file, ecosystem file,
executable, working directory, git commit and branch, and all environment
variables require host access. Collected by `audit-production.sh` sections
"PHASE 1".

The only runtime fact observable remotely is that something answers
`/api/health` with Helmet security headers, and by uptime it started around
22 June 2026.

### Phase 2 — Database · **NOT VERIFIABLE FROM HERE**

PostgreSQL version, size, tables, migrations, pending migrations, connections,
backup strategy and last backup all require host access. Collected by the
script's "PHASE 2".

**Note for when you have the data:** the Release Candidate's migrations are
additive — new tables plus one nullable column, `evidence.sha256`. Against an
empty database the full chain applies cleanly and produces 116 tables with no
drift, verified in the dress rehearsal. Against a *populated* production
database the chain is unrehearsed, because the production schema is unknown.

### Phase 3 — Redis · **RESOLVED — absent, and not required**

Superseded by [`RECONCILIATION.md`](RECONCILIATION.md). Redis is not configured
on the host, and the certification path does not use it: upload, inventory,
ingest, timeline, contradictions and CALCRIM are all synchronous. Deploy with
`DISABLE_WORKERS=true`.

### Phase 4 — Storage · **NOT VERIFIABLE FROM HERE**

Upload directory, disk space, ownership, permissions and backups require host
access. Collected by "PHASE 4".

**Maximum upload size is partly observable** and is the subject of Blocker 2:
nginx caps request bodies at 1 MB. The application's own limits, verified in
this repository, are 500 MB for a non-video file and 10 GB for a video.

### Phase 5 — Nginx · **PARTIALLY OBSERVED**

| Item | Observed | Evidence |
|---|---|---|
| Server | nginx/1.28.1 | `Server` header |
| HTTP → HTTPS | **Working** | `http://courtaccess.net` → `301` |
| HSTS | **Present** | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| CSP | **Present** | full policy on `/api/health` |
| `X-Frame-Options` | **Present** | `SAMEORIGIN` |
| `X-Content-Type-Options` | **Present** | `nosniff` |
| Cross-origin policies | **Present** | COOP and CORP `same-origin` |
| Compression | **Working on HTML** | `Content-Encoding: gzip` on `/` |
| Compression on JS | **NOT enabled** | no `Content-Encoding` on `/assets/index-*.js` |
| Caching | **ETag only** | `ETag` present; **no `Cache-Control`, no `Expires`** |
| Upload limit | **1 MB** | Blocker 2 |
| Certificate | **Expires in 2 days** | Blocker 1 |

The security header posture is good. Two non-blocking observations: the main
JavaScript bundle is served uncompressed, and static assets carry no
`Cache-Control`, so browsers revalidate on every load. Both are performance
matters, not correctness.

Proxy buffering, timeouts and the full configuration require host access.

### Phase 6 — Browser readiness · **PARTIALLY VERIFIED**

| Browser | Verified | Evidence |
|---|---|---|
| Chromium (Chrome/Edge engine) | **Yes** | 116 of 116 browser checks against the bundled artifact behind nginx, dress rehearsal |
| Safari, macOS | **No** | Never tested |
| Safari, iPadOS / mobile | **No** | Never tested |
| Firefox | **No** | Never tested |
| Edge | **Inferred only** — Chromium engine, but not run | |

**Safari is the material gap.** The upload portal's folder selection uses
`webkitdirectory`, whose behaviour differs across engines, and Case 001 is
intended to be dragged from Finder in Safari. The interface has a documented
fallback — **Select Discovery** with a multi-file selection — but it is
untested there.

No responsive or touch testing has been performed, so iPadOS and mobile Safari
are unknown rather than merely untested.

### Phase 7 — External services

| Service | Configured | Verified | Blocking? |
|---|---|---|---|
| California Legislative Information | Unknown on host | **Reachable from here** (HTTP 200) | **Yes if unreachable** — every charged statute would fall back to cache or report unavailable |
| PostgreSQL | **`DATABASE_URL` verified present** (Program 164) | Version and schema state still unknown | **Partly** — the API will not start without it, but it is set |
| Redis | **Verified absent** (Program 164) | Certification path traced and is synchronous throughout | **No** — see `RECONCILIATION.md`; set `DISABLE_WORKERS=true` |
| OCR (tesseract / ffmpeg) | Unknown | Not verifiable remotely | **Degrading** — media durations report unknown; silent recordings indistinguishable from untranscribed |
| Cloudflare | **Not present** | Observed: DNS resolves straight to `44.209.225.79`; no `CF-Ray` header | No |
| Stripe | Unknown | Never exercised by this platform | No — billing inert without it |
| AWS S3 / object storage | Unknown | Never exercised | No — evidence writes to local disk |
| AWS SES / SMTP | Unknown | Never exercised | No — verification mail will not send |
| OpenAI | Unknown | Never exercised | No |
| Anthropic | Unknown | Never exercised | No |
| Google AI | Unknown | Never exercised | No |
| Twilio | Unknown | Never exercised | No |
| Speech-to-text | **Not implemented** | Repository fact — nothing spoken in a recording is searchable | No — a known limitation |
| Video processing | **Storage and duration only** | Repository fact — no transcoding or analysis | No |

"Never exercised" means exactly that: no certification suite in this repository
has ever run against these services with real credentials.

### Phase 8 — Environment variables

Presence cannot be determined without host access. The script reads the running
process's environment and reports **presence only, never values**.

The inventory the Release Candidate requires:

| Variable | Required | Default | Safe to change | Restart | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | none | No | Yes | Server will not start without it |
| `JWT_SECRET` | **Yes** | none | **No** | Yes | Changing it signs every user out |
| `PORT` | Recommended | `3001` | Yes | Yes | **Must be `3000`** — nginx proxies there, the RC defaults to 3001 |
| `HOST` | Recommended | `0.0.0.0` | Yes | Yes | Set `127.0.0.1`; nginx is the only client |
| `NODE_ENV` | Recommended | none | Yes | Yes | Set `production` at runtime — but see Blocker note below |
| `REDIS_URL` | Yes for queues | none | Yes | Yes | Background processing needs it |
| `JWT_REFRESH_SECRET` | Yes | none | No | Yes | Changing it invalidates refresh tokens |
| `COOKIE_SECRET` | Yes | none | No | Yes | |
| `FRONTEND_URL` | Yes | none | Yes | Yes | CORS and links |
| `CERTIFICATION_STAGING_DIR` | Recommended | `/var/tmp/...` | Yes | Yes | Must have room for the largest corpus |
| `EVIDENCE_UPLOAD_DIR` | Recommended | app-relative | Yes | Yes | **Keep outside the release directory** or a deploy destroys uploads |
| `STRIPE_SECRET_KEY` | No | none | Yes | Yes | Billing inert without it |
| `AWS_*` | No | none | Yes | Yes | Object storage unused today |
| `LAW_CACHE_MAX_AGE_MS` | No | 24 h | Yes | Yes | |
| `LEGINFO_MIN_GAP_MS` | No | 400 ms | Yes | Yes | Do not lower; it is politeness to a public service |

**One caveat carried from the dress rehearsal:** `NODE_ENV=production` must not
be set *when building*. npm skips `devDependencies`, and TypeScript, Vite and
esbuild are all devDependencies, so the build fails with `tsc: not found`.
`deploy/build-release.sh` now handles this. Setting it at runtime is correct.

### Phase 9 — Release Candidate compatibility

| Requirement | Status | Evidence |
|---|---|---|
| Node 22 | **Unknown** | Host version not observable. The bundle targets `node22`. |
| PostgreSQL 16 | **Unknown** | Not observable |
| Redis 7 | **Unknown** | Not observable |
| PM2 | **Compatible** | Bundle verified under PM2 7.0.3 in fork mode: online, 0 restarts, survives `save`/`resurrect` |
| `dist/index.js` entry | **Compatible** | Bundle builds to exactly this path; SHA-256 `c67b92e7…`, reproducible |
| Working directory | **Compatible** | Runs with `--cwd` set to the release directory |
| Port 3000 | **Compatible** | Verified serving on 3000 via `PORT=3000` |
| Static from `dist/public` | **Compatible** | `build-release.sh` assembles exactly this layout |
| `node_modules` alongside | **Required** | Bundle keeps packages external; Prisma's engine is a native binary |
| ffmpeg | **Unknown** | Absence degrades media measurement |
| Outbound HTTPS to leginfo | **Unknown from host** | Reachable from here |

Nothing in the Release Candidate is known to be incompatible. Four items are
unknown purely because the host cannot be read.

---

## Phase 10 — Case 001 readiness

### If Peter opens Safari and visits `https://courtaccess.net` today

**Observed, not predicted:**

1. The page loads. Title *Court Access System*, marketing content, a **Sign In**
   link.
2. The browser console throws `SyntaxError: Unexpected token '<'` — a script
   request returned HTML.
3. The page requests `/api/trpc/auth.me` → **404**.
4. He clicks Sign In. `/login` loads but renders **no email field**.

**He cannot sign in.** There is no login form to fill in.

Even if there were, every authentication route on that host returns 404. The
deployed frontend is a different application generation using tRPC; the
Release Candidate uses REST.

### If he tries to upload Case 001

He cannot get that far — there is no way to authenticate, and the Gold Standard
portal does not exist in the deployed build.

**If all of that were fixed and only nginx were left unchanged**, the upload
would fail differently and specifically: the portal sends 8 MB chunks, nginx
caps bodies at 1 MB, so the **first chunk returns 413** before reaching the
application. The interface would report the failure rather than hang, but no
discovery would be stored.

### Exact blockers, in order

1. **No login form** — deployed frontend is a different application.
2. **No working API** — every route except `/api/health` returns 404.
3. **nginx `client_max_body_size` is 1 MB** against 8 MB chunks.
4. **The TLS certificate expires 9 August**, after which Safari refuses the site
   entirely.

None is a defect in the Release Candidate. All four are properties of what is
currently deployed.

---

## Phase 11 — Cutover estimates

Derived from the dress rehearsal, where every step was timed. Host-dependent
figures are marked.

| | Estimate | Basis |
|---|---|---|
| Build the release | 3–6 min | Measured: ~23 s for the build; the rest is `npm ci` twice |
| Transfer to host | Host-dependent | ~600 MB including `node_modules` |
| Migrations | **Unknown** | Clean from empty in seconds; against a populated production schema, unrehearsed |
| Smoke test on a spare port | 1–2 min | Measured: ~25 s startup plus checks |
| **Downtime at cut-over** | **20–25 s** | Measured startup time in `fork_mode`, where `pm2 reload` is a restart. Zero downtime needs cluster mode, which changes the process model and should not be introduced during this deployment. |
| **Rollback** | **3 s** | Measured: `pm2 resurrect` from a dump saved before cut-over. A manual restart is 20–25 s. |
| Total window | 30–45 min | Including verification, excluding the reboot test |
| Reboot persistence test | 3–5 min | Recommended before Case 001 |

**Database risk: low to moderate.** The migrations are additive, so the current
application would continue to run against a migrated schema. The risk is not
the schema but the unknown: the production database has never been inspected.

**User impact: none.** Nobody can use the site today — there is no login form.
This deployment can only improve on that.

**Recovery time: 3 seconds** with a pre-cut-over dump; 20–25 seconds without;
minutes if a database restore is needed.

---

## Phase 12 — Final recommendation

# NOT READY

Not because of the Release Candidate. It is certified: the bundle builds
reproducibly, runs with no TypeScript present, serves every endpoint correctly,
and passed 116 of 116 browser checks against the production artifact behind
nginx.

**NOT READY because of the production host**, on three pieces of evidence:

1. **The TLS certificate expires in 2 days** and automatic renewal has plainly
   not run in at least 28 days. Fix this first, today, regardless of the
   deployment.
2. **nginx caps request bodies at 1 MB** — measured — against 8 MB upload
   chunks. Case 001 cannot be uploaded until that directive changes.
3. **Phases 1–4 and 7–9 are unverified.** Node, PostgreSQL and Redis versions
   and availability are unknown, and the API will not start without a database.
   Deploying blind would be a guess.

### To reach READY

1. Renew the certificate and fix the renewal timer. **Today.**
2. Run [`audit-production.sh`](audit-production.sh) on the host and return the
   output. It is read-only and prints no secrets.
3. From that output, confirm Node 22, PostgreSQL, Redis and ffmpeg.
4. Raise `client_max_body_size` to 64 MB and set
   `proxy_request_buffering off` — part of the deployment, not before it.
5. Test Safari against the rehearsal or the deployment before Case 001 goes
   anywhere near it.

Steps 1 and 2 are the whole of the remaining work on your side. Everything
after that is in `EXECUTION_PROCEDURE.md`.
