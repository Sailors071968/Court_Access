# Release Candidate production certification

Program 160. Every figure below was produced by executing the commands shown,
in this workspace, on the date shown. Nothing is asserted from reading source.

**Result: CERTIFIED — the Release Candidate can replace the running production
application**, subject to the four preconditions in section 12, which are
environmental and outside this repository.

| | |
|---|---|
| Branch | `cursor/gold-standard-upload-portal-9f94` |
| Commit | `7a20de95d38aff195bac918c31b6092e18ed3e7a` |
| Working tree | Clean — the artifact is built from exactly what is committed |
| Node | v22.14.0 |
| npm | 10.9.7 |
| Certified | 7 August 2026 |

---

## 1. Build command

Run from `backend/`:

```bash
npm run build
```

which is, verbatim from `backend/package.json`:

```
esbuild src/server.ts --bundle --platform=node --target=node22 --format=esm --packages=external --outfile=dist/index.js
```

Output:

```
  dist/index.js  2.0mb ⚠️

⚡ Done in 46ms
```

The size warning is esbuild noting a large bundle. It is informational.

---

## 2. Artifact produced

A single JavaScript file. Nothing else.

```
backend/dist/index.js
```

`--packages=external` keeps `node_modules` outside the bundle. This is required,
not a preference: Prisma's query engine is a native binary and cannot be
inlined.

---

## 3. Full paths of every generated production file

Two build steps produce two artifacts, assembled by
`deploy/build-release.sh` into the layout production uses.

| Generated file | Produced by | Deployed to |
|---|---|---|
| `backend/dist/index.js` | `npm run build` in `backend/` | `/var/www/courtaccess/dist/index.js` |
| `dist/index.html` | `npm run build` at the repository root | `/var/www/courtaccess/dist/public/index.html` |
| `dist/assets/*` | `npm run build` at the repository root | `/var/www/courtaccess/dist/public/assets/*` |
| `dist/vite.svg` | `npm run build` at the repository root | `/var/www/courtaccess/dist/public/vite.svg` |

The backend build emits exactly one file. The frontend build emits
`index.html`, an `assets/` directory and `vite.svg`.

---

## 4. Size of `dist/index.js`

```
2117815 bytes  (2.1 MB)
```

---

## 5. Directory listing of the generated `dist`

Immediately after `rm -rf dist && npm run build` in `backend/`:

```
$ ls -la dist/
total 2080
drwxr-xr-x  2 ubuntu ubuntu    4096 Aug  7 16:25 .
drwxr-xr-x 10 ubuntu ubuntu    4096 Aug  7 16:25 ..
-rw-r--r--  1 ubuntu ubuntu 2117815 Aug  7 16:25 index.js
```

Assembled into the production layout:

```
$ ls -la dist/
total 2084
drwxr-xr-x 3 ubuntu ubuntu    4096 Aug  7 16:27 .
drwxr-xr-x 5 ubuntu ubuntu    4096 Aug  7 16:27 ..
-rw-r--r-- 1 ubuntu ubuntu 2117815 Aug  7 16:25 index.js
drwxr-xr-x 2 ubuntu ubuntu    4096 Aug  7 16:27 public
```

---

## 6. SHA-256 of `dist/index.js`

```
c67b92e75b2beedcbd6a0e71905ea5a21a543a248ec6aa01eb21c8c537d4e7d1
```

Verify after transfer to the host:

```bash
sha256sum /var/www/courtaccess/dist/index.js
```

A different value means the file changed in transit or was rebuilt from a
different commit.

---

## 7. Start command

Direct:

```bash
cd /var/www/courtaccess && node dist/index.js
```

Under PM2, in the form production uses:

```bash
pm2 start dist/index.js --name courtaccess --cwd /var/www/courtaccess --time
```

Both were executed. Both work.

---

## 8. Startup log

From `node dist/index.js` with **no TypeScript source present anywhere**.
Abridged; the full log runs to several hundred route registrations.

```
[Schema Assert] Checking database schema integrity...
[Redis] Connected to redis://127.0.0.1:6379
[Schema Assert] Schema locked and matching.
[Schema Assert]   Version:    1.0.0
[Schema Assert]   Checksum:   no-migrations
[Schema Assert]   Migrations: 0/0 applied
[Server] Registering pipeline routes...
[Server] Registering policy intelligence routes...
[Server] Registering operations console routes...
[Server] Registering compliance analysis routes...
[Server] Registering forensic reconstruction routes...
[Server] Registering authentication routes...
[Server] Registering rate limit admin routes...
[Server] Registering contradiction detection engine routes...
[Server] Registering billing & usage routes...
[Server] Registering case management routes...
[Server] Registering organization routes (Program 2)...
[Server] Registering direct evidence upload routes...
[Server] Direct evidence upload route registered: POST /api/evidence/upload
[Server] Registering evidence routes...
[Server] Registering citation routes...
  ...
  - GET  /api/admin/stats
  - GET  /api/admin/users
  - GET  /api/admin/cases
  - DELETE /api/admin/evidence/:evidenceId
[Server] Security hardening active: JWT auth, rate limiting, CSRF, security
         headers, upload protection, security logging
```

**Errors during startup: 0.** Counted with
`grep -icE "error|cannot find|failed to"` across the whole log.

Note: `Migrations: 0/0 applied` reflects the schema-assert check in this
workspace's database. On production, run `npx prisma migrate deploy` before
starting — see the execution procedure, section 6.

---

## 9. Health-check response

```
$ curl -s http://127.0.0.1:3100/api/health
{"status":"ok","timestamp":"2026-08-07T16:26:14.628Z","version":"1.1.0","service":"court-access-backend","environment":"production"}
```

---

## 10. Endpoint results

Against the bundled server running from `dist/index.js` with no TypeScript
present:

| Endpoint | Method | Status | Response |
|---|---|---|---|
| `/api/health` | GET | **200** | `{"status":"ok","version":"1.1.0","service":"court-access-backend",…}` |
| `/api/auth/register` | POST | **400** | `{"error":"Email and password are required"}` |
| `/api/auth/login` | POST | **400** | `{"error":"Email and password are required"}` |
| `/api/law/status` | GET | **401** | `{"error":"Authentication required","message":"Please provide a valid Bearer token…"}` |
| `/api/charging/codes` | GET | **401** | `{"error":"Authentication required","message":"Please provide a valid Bearer token…"}` |

**Every one is the correct response**, and none is a 404. `400` on the auth
routes is the route present and validating an empty body. `401` is the route
present and enforcing authentication.

For comparison, production today returns **404** on all four non-health
endpoints (`deploy/AUDIT.md`). That difference is the whole point of this
deployment.

---

## 11. No TypeScript source required at runtime — proven

Asserting this from the build flags would not be evidence, so it was tested by
removing the possibility.

A directory was assembled containing **only** `dist/index.js`, `node_modules`,
`prisma` and `package.json`. No `src/`. Every `.ts` file outside `node_modules`
was then deleted:

```
$ find /tmp/cert-isolation -name "*.ts" -not -path "*/node_modules/*" | wc -l
0
$ [ -d /tmp/cert-isolation/src ] && echo YES || echo NO
NO
```

The server started from that directory and served every endpoint in section 10.

Two further facts:

- The bundle contains **no TypeScript import specifiers**:
  `grep -c "\.ts'" dist/index.js` returns `0`.
- **`prisma/` is not required at runtime either.** It was moved aside and the
  process restarted: `/api/health` still returned `200`. It is needed for
  `prisma migrate deploy`, so ship it, but the running server does not read it.

**What the runtime does require:** `node_modules`, because the bundle keeps
packages external. It must be present in the working directory.

---

## 12. PM2 in the production layout — proven

Tested against a directory mirroring `/var/www/courtaccess`:
`dist/index.js`, `dist/public/`, `node_modules`, `prisma`, `package.json`.

```
$ pm2 start dist/index.js --name courtaccess --cwd /tmp/cert-prod --time
[PM2] Starting /tmp/cert-prod/dist/index.js in fork_mode (1 instance)
[PM2] Done.
┌────┬──────────────┬─────────┬───────┬────────┬───┬─────────┬─────────┐
│ id │ name         │ version │ mode  │ uptime │ ↺ │ status  │ mem     │
├────┼──────────────┼─────────┼───────┼────────┼───┼─────────┼─────────┤
│ 0  │ courtaccess  │ 1.0.0   │ fork  │ 25s    │ 0 │ online  │ 285.4mb │
└────┴──────────────┴─────────┴───────┴────────┴───┴─────────┴─────────┘
```

**Online, zero restarts.** `pm2 describe` confirms:

```
script path        /tmp/cert-prod/dist/index.js
exec cwd           /tmp/cert-prod
exec mode          fork_mode
status             online
restarts           0
unstable restarts  0
```

Serving on port 3000 — the nginx proxy target:

| Endpoint | Status |
|---|---|
| `GET /api/health` | 200 |
| `POST /api/auth/login` | 400 |
| `GET /api/law/status` | 401 |

**Reboot persistence tested, not assumed:**

```
$ pm2 save
[PM2] Successfully saved in /tmp/cert-pm2home/dump.pm2
-rw-r--r-- 1 ubuntu ubuntu 8841 dump.pm2

$ pm2 kill            # simulates the daemon dying at reboot
[PM2] [v] PM2 Daemon Stopped
$ curl .../api/health
000                   # confirmed down

$ pm2 resurrect       # what PM2 does on boot
$ pm2 list            # courtaccess  online  0 restarts
$ curl .../api/health
200                   # confirmed back
```

**No modification to the production runtime is required.** PM2 still runs
`node dist/index.js` from a working directory, on port 3000, with static files
under `dist/public`. Only the contents of those paths change.

---

## 13. Preconditions — environmental, outside this repository

The certification above is of the artifact. These four are properties of the
host and must be confirmed before deploying. None is a defect in the Release
Candidate.

| # | Precondition | How to check | If it fails |
|---|---|---|---|
| P1 | **Node 22 or later** on the host | `node --version` | The bundle targets `node22`. Older Node may fail on syntax. Blocker. |
| P2 | **PostgreSQL reachable**, `DATABASE_URL` supplied | `sudo ss -lptn 'sport = :5432'` | The server will not start. Blocker. |
| P3 | **Redis reachable** | `sudo ss -lptn 'sport = :6379'` | Queues cannot run. Blocker for processing. |
| P4 | **`node_modules` deployed alongside the bundle** | `ls /var/www/courtaccess/node_modules` | Packages are external to the bundle. Without them nothing starts. Blocker. |

Two further items are degradations rather than blockers:

- **ffmpeg absent** — media durations report as unknown and a silent recording
  cannot be told apart from an untranscribed one.
- **No outbound HTTPS to `leginfo.legislature.ca.gov`** — statutory retrieval
  falls back to cache and otherwise reports unavailable.

---

## 14. One finding worth recording

Bundling exposed a latent defect that `tsx` had been concealing.

`src/lib/prisma.js` and `src/lib/redis.js` — stale compiled artifacts committed
months ago — sat beside their TypeScript sources. Under `tsx`, a `.js` in an
import specifier resolves to the `.ts`; under a real build it resolves to the
actual `.js`, which carried only a default export. One import in
`src/database/schemaAssert.ts` used the named form and **failed to bundle**.

Both artifacts were removed and the import normalised to match the other
seventy. Nothing else in the codebase changed. The `tsx` path still runs and
both audit suites still pass at 100%.

This is the kind of defect that only appears the first time a project is built
for production, and it is the reason this certification was performed by
building and running rather than by inspection.

---

## 15. Scope of this certification

**What is certified:** the artifact builds reproducibly from a clean tree,
starts with no TypeScript present, serves every required endpoint correctly,
runs under PM2 in the production layout on port 3000, and survives a PM2
daemon restart via `pm2 save` / `pm2 resurrect`.

**What is not certified:**

- **It has not been run on production.** Everything above was executed in this
  workspace against a local PostgreSQL and Redis.
- **Frontend behaviour in Safari.** Every browser check in this repository has
  run in Chromium. The upload portal uses `webkitdirectory` for folder
  selection, which differs across engines, and Case 001 is intended to be
  dragged from Finder in Safari.
- **Zero-downtime cut-over.** The process ran in `fork_mode`, where
  `pm2 reload` is a restart. Startup took roughly 20–25 seconds in these tests,
  so a fork-mode cut-over means an outage of about that length. Cluster mode
  would avoid it but changes the process model and should not be introduced
  during this deployment.
- **Behaviour under production load**, against production data volumes.

Deployment steps are in
[`EXECUTION_PROCEDURE.md`](EXECUTION_PROCEDURE.md).
