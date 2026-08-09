# Deployment architecture

What the deployed system is, and how a request and a release each travel through
it. Written so that the whole deployment can be understood without reading the
application source.

Facts here are marked `[MEASURED]` where they come from an executed observation,
and `[UNVERIFIED ON HOST]` where they describe the production machine, which the
author of this document has never had access to. Everything else is read from the
repository.

Companions: `DEPLOY_FROM_SCRATCH.md` (how to deploy), `OPERATIONS_PLAYBOOK.md`
(how to operate), `DEPLOYMENT_FAILURE_MODES.md` (what breaks),
`DEPLOYMENT_CERTIFICATION.md` (what is proven).

---

## 1 · Shape of the system

Five moving parts on one host.

```
                     ┌──────────────────────────────────────────┐
   internet ───443──▶ │ nginx                                    │
                     │   /            → dist/public  (static)   │
                     │   /api/        → 127.0.0.1:3100 (proxy)  │
                     └──────────────────────┬───────────────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │ PM2 daemon         │
                                  │  courtaccess-v1    │
                                  └─────────┬──────────┘
                                            │ spawns, with
                                            │ --env-file=$V1/.env
                                  ┌─────────▼──────────┐        ┌────────────┐
                                  │ node 22            │───────▶│ PostgreSQL │
                                  │ dist/index.js      │ Prisma │  116 tables│
                                  │ Fastify on :3100   │        └────────────┘
                                  └────────────────────┘
                                            │
                                     (Redis: absent)
```

There is no Redis in the certified configuration, and no object storage: evidence
is written to a filesystem path. Both are deliberate and both are recorded in
§9 and §10.

**Paths.** These are the defaults in `deploy/stages/_common.sh`; every one is
overridable by environment variable.

| Variable | Default | What it is |
|---|---|---|
| `V1` | `/var/www/courtaccess-v1` | The release. `dist/index.js`, `dist/public/`, `prisma/`, `node_modules/`, `.env` |
| `V1_PORT` | `3100` | The port Fastify binds and nginx proxies to |
| `V1_PM2_NAME` | `courtaccess-v1` | The PM2 process name |
| `V1_DB` | `courtaccess_v1` | The PostgreSQL database |
| `BUILD` | `/opt/courtaccess-build` | Scratch space for the build. Never served from |
| `STATE` | `$HOME/courtaccess-deploy-state` | Deployment records: manifest, nginx backup, artifact freeze |
| `NODE22` | *(must be set)* | Absolute path to the Node 22 binary |

## 2 · Release artifact flow

`deploy/build-release.sh` turns a git checkout into the layout the host expects.
Nothing else produces a deployable artifact.

```
git clone ──▶ $BUILD/src ──▶ npm ci (root)      ──▶ vite build   ──▶ dist/          (frontend)
                          └─▶ npm ci (backend)  ──▶ prisma generate
                                                 └─▶ esbuild      ──▶ backend/dist/index.js

                    assembled into $V1:
                      dist/index.js         the API, one bundled file
                      dist/public/          the frontend, served by nginx
                      dist/build-info.json  commit, branch, build time
                      prisma/schema.prisma  read by the boot-time schema guard
                      prisma/migrations/    30 directories
                      node_modules/         584 MB — the bundle keeps deps external
                      package.json
```

Four properties of the artifact that matter operationally:

- **The API is one file.** `esbuild --bundle --platform=node --target=node22
  --format=esm --packages=external`. It requires Node 22 or later, and it does
  not embed `node_modules`, which is why they ship alongside it.
- **There is no TypeScript in a release.** `find $V1 -name '*.ts'` outside
  `node_modules` must be 0; stage 1 and the audit both check it. TypeScript in a
  release means something was copied rather than built.
- **The commit travels with the artifact**, in `dist/build-info.json`, and the
  API reports it at `/api/health`. A release is not a git checkout, so this is
  the only way to know what is running.
- **`node_modules` is part of the artifact.** A release is not self-contained
  without it, and `npm ci` on the host after verification invalidates the
  fingerprint in §11.

## 3 · Deployment stages

Six scripts in `deploy/stages/`, each sourcing `_common.sh`, each ending in one
`PASS` or `FAIL` with the reasons. They are ordered and mostly one-shot.

| Stage | Does | Re-runnable? | Rollback |
|---|---|---|---|
| `stage0-hostaudit.sh` | Records the host: OS, Node installations, ports, nginx, PM2, disk | Yes, read-only | n/a |
| `stage1-provision.sh` | Clones, builds, assembles `$V1`, verifies the artifact | **No** — refuses if `$V1` exists | `sudo rm -rf $V1 $BUILD` |
| `stage2-database.sh` | Applies migrations to `$V1_DB` | **No** — refuses a non-empty database | `sudo -u postgres dropdb $V1_DB` |
| `standalone-check.sh` | Runs the artifact under plain Node, no PM2, emptied environment | Yes | none needed |
| `stage3-start.sh` | Validates `.env`, starts PM2, verifies, freezes the artifact | Yes | `pm2 delete courtaccess-v1` |
| `stage4-cutover.sh` | `precheck` backs up nginx; `verify` checks the live site | Yes | `rollback.sh` |
| `stage5-observe.sh` | Samples the running system for a window (default 30 min) | Yes, read-only | `rollback.sh` |
| `verify-restart-survival.sh` | Saved definition, restart, resurrect, systemd unit | Yes | none needed |
| `audit-deployment.sh` | All of the above as assertions, read-only | Yes | n/a |

**Stage 4 does not edit nginx.** It backs up the server block, prints the change
to make, and verifies afterwards. Editing `proxy_pass` and reloading is done by
the operator. This is the largest manual step in the deployment; it is classified
in `DEPLOYMENT_CERTIFICATION.md` §7.

Three protections run inside `_common.sh` on every stage:

- **A deterministic environment.** `deploy_env` builds a minimal `PATH` with the
  pinned toolchain first, unsets `NODE_ENV`, `NODE_OPTIONS` and
  `npm_config_prefix`, and refuses to continue without a Node 22 binary. `npx`
  and `npm exec` are used nowhere, because both re-resolve Node from `PATH` and
  have been observed running a different version from a cache.
- **Interpreter verification.** Every stage prints what `node` and `npm` resolve
  to and fails if they are not the pinned pair.
- **Protection of whatever is already running.** `baseline_existing` records the
  other PM2 processes, and `assert_existing_unchanged` fails the stage if their
  pids or restart counters moved during it.

## 4 · Startup sequence

The order matters, because two guards run before the port is bound and a third
runs before either. Line references are to the source; the sequence is
`[MEASURED]`.

```
  T+0      node --env-file=$V1/.env dist/index.js
           └─ Node parses .env and merges it into process.env
              (it does NOT overwrite a variable that is already set)

  T+~600ms module initialisation
           └─ authMiddleware.ts:87  requireSigningKey('JWT_SECRET')
              production and unset      → exit 1, names the variable
              not production and unset  → ephemeral key + warning

  T+~670ms validateEnvironment()                      server.ts:97
           └─ node version, NODE_ENV, DATABASE_URL, JWT_SECRET,
              JWT_REFRESH_SECRET, COOKIE_SECRET, PORT, HOST,
              EVIDENCE_UPLOAD_DIR (write-probed), CERTIFICATION_STAGING_DIR,
              DISABLE_WORKERS
           └─ FAIL stops the boot when NODE_ENV=production, or when neither
              NODE_ENV nor DATABASE_URL is set — see below
                                                      server.ts:99 → exit 1

  T+~1.0s  enforceSchemaOnBoot()                      server.ts:104
           └─ SELECT 1; count applied vs on-disk migrations; check for failed
              ones; upsert schema_versions
           └─ any problem → exit 1                    schemaAssert.ts:361

  T+~1.3s  route registration (~40 modules)
  T+~1.4s  seedDefaultDiscountCodes(), startExpirationWorker()
           startPipelineWorkers()   — returns immediately if DISABLE_WORKERS=true
           startRedisMemoryMonitor()— returns immediately if DISABLE_WORKERS=true
  T+~1.4s  app.listen({ port: PORT, host: HOST })
           └─ "[Server] CourtAccess API running on http://HOST:PORT"
```

**Why the validator's enforcement rule is what it is.** Downgrading FAIL to
WARNING outside production exists so a developer need not populate a production
environment. It used to key on `NODE_ENV` alone — which lives in the environment
it is checking, so a process launched with *no* environment concluded it was a
developer machine and waived every fatal check, then died a moment later inside
Prisma reporting `Database unreachable`. `DATABASE_URL` is now a second signal:
there is no way to run this server without it, so a process holding neither was
configured by nobody. `[MEASURED]` — see `ROOT_CAUSE_CRASH_LOOP.md`.

Nothing in the startup sequence retries. Every failure is pre-service: the port
is never bound, so no request is ever served by a half-started process.

## 5 · Environment loading

The single most important property of this deployment, and the one that caused
its worst outage when it was not true.

```
   $V1/.env  ──read by Node itself at every spawn──▶  process.env
                        (--env-file, passed by PM2 as node_args)
```

Three consequences, all `[MEASURED]`:

- **`--env-file` does not overwrite a variable that is already set.** The
  inherited value wins. So anything PM2 snapshots from the shell that started it
  permanently outranks the file.
- **Therefore the deployment withholds it.** `stage3-start.sh` reads the keys
  defined in `.env` and removes exactly those from the environment it hands PM2,
  so the snapshot contains none of them and the file is the only source. This
  holds even when the operator's shell has sourced `.env`.
- **`--env-file` values never appear in `/proc/<pid>/environ`.** That file shows
  the environment handed over at exec. Their absence, with the application
  healthy, is the evidence that PM2 holds no copy. `ps` is no better: PM2
  rewrites `process.title`, so even `--env-file` disappears from the command
  line. `pm2 jlist` is the reliable source for arguments.

Node's parser is not the shell. It honours no `export` prefix, does not expand
`${VAR}`, and does not run `$(command)`. `stage3-start.sh` and
`audit-deployment.sh` both refuse a file containing any of those, because
`stage2-database.sh` *sources* the same file for Prisma and the two readers would
otherwise disagree about the database.

`env.release.example` is the template. `deploy/.env.example` is a different file
for a different architecture — see §12.

## 6 · nginx routing

One server block. TLS terminates here; the application never sees a certificate.

```
listen 443 ssl
server_name courtaccess.net

root  $V1/dist/public
index index.html

location /      try_files $uri $uri/ /index.html     # SPA: unknown paths → index.html
location /api/  proxy_pass http://127.0.0.1:3100     # everything else
client_max_body_size 500M
proxy_read_timeout 300s
proxy_send_timeout 300s
```

Consequences worth knowing before debugging anything:

- **`proxy_pass` and `PORT` must agree.** If they disagree, every API request is
  a 502 while the process looks perfectly healthy. Both `stage3-start.sh` and the
  audit compare them.
- **A 502 whose latency matches a static page is a connection refused** — nothing
  is bound. A 502 after a long stall is a different fault. `[MEASURED]`: 22 ms
  against a 22 ms static baseline during the production outage.
- **`/` returns 200 even when the API is completely down**, because the frontend
  is static files on disk. The site looks up while nothing works. This is why
  `/api/health/ready` and not the front page is the monitoring target.
- **Any unknown non-`/api/` path returns `index.html` with 200.** A request for a
  file that does not exist is indistinguishable from a route the SPA handles.

## 7 · PM2 lifecycle

PM2 supervises one process. What it stores, and where, determines everything
about restart and reboot behaviour.

```
pm2 start $V1/dist/index.js \
  --name courtaccess-v1 --cwd $V1 \
  --interpreter $NODE22 \
  --node-args="--env-file=$V1/.env"

  ├─ live definition   in the daemon's memory      (pm2 jlist)
  └─ saved definition  $PM2_HOME/dump.pm2          (written only by `pm2 save`)
```

- **The interpreter is pinned by absolute path.** Given a bare `node`, PM2 records
  the string and re-resolves it from `PATH` at every spawn, which on a host with
  more than one Node starts the service on the wrong runtime.
- **`node_args` is what makes the environment reload**, and PM2 persists it into
  both the live definition and `dump.pm2` `[MEASURED]`.
- **`pm2 save` is manual and not idempotent with respect to time.** The saved
  definition is a snapshot; change the process list and it is stale until saved
  again. A stale `dump.pm2` is invisible until a reboot. The audit compares saved
  against live for this reason.
- **PM2 reports `status=online` while crash-looping**, because it keeps
  respawning. `[MEASURED]`: 32 restarts in 45 s with `status=online` throughout
  and nothing bound. `pm2 list` is not a health check; the restart counter is.
- **Never `--update-env`.** It copies the invoking shell's environment onto the
  process, recreating the snapshot that outranks `.env`.

Five PM2 operations were tested against the certified bundle from a shell holding
none of the application variables. All five preserved the captured environment,
including into `dump.pm2`: `restart`, `restart --update-env`,
`reload --update-env`, `save`/`kill`/`resurrect`, and `pm2 update` `[MEASURED]`.
A snapshot does not decay; it is either never taken or restored from a different
file — see §9.

## 8 · Prisma and migration validation

The application never migrates. Migrations are applied once, by
`stage2-database.sh`, using the Prisma CLI from the release's own
`node_modules`.

At every boot, `enforceSchemaOnBoot` then asserts the schema:

1. `SELECT 1` — the database is reachable.
2. Count migration directories in `$V1/prisma/migrations`, count rows in
   `_prisma_migrations` with `finished_at IS NOT NULL`, and compare. Any pending
   migration is fatal and each is named.
3. Any migration with `started_at` and no `finished_at` is fatal.
4. Upsert a row in `schema_versions` recording version, checksum and that drift
   was checked.

The migrations directory is located by trying `../../prisma` (source layout),
`../prisma` (release layout), then `./prisma` relative to the working directory,
and a candidate only counts if it actually contains `schema.prisma` or
`migrations/`. Resolving only the source layout previously meant the bundle found
nothing and the whole check silently degraded to a connectivity test while still
printing `Schema locked and matching`.

The certified reference is **30 migrations, 116 tables**. Both are recorded and
compared by the audit, and neither is a gate: a newer commit legitimately changes
them. The gates are behavioural — the migrations the artifact carries are the
migrations the database has, and none are unfinished or rolled back.

## 9 · Restart, reboot and rollback architecture

Three different mechanisms, often confused with each other.

**Restart** — PM2 respawns the process, either on request or after a crash. The
new process re-reads `.env` because `--env-file` is in the definition. Nothing
else is needed. `[MEASURED]`: health returns to 200 with no stale environment
after `pm2 restart`, `pm2 update`, and `pm2 kill` + `pm2 resurrect`.

**Reboot** — the chain is longer and every link is required:

```
  boot → systemd starts pm2-<user>.service
       → pm2 resurrect
       → reads $PM2_HOME/dump.pm2          ← written by `pm2 save`
       → spawns with the saved node_args   ← must contain --env-file
       → node reads $V1/.env
```

It fails silently if the unit does not exist, is not enabled, or **runs as a
different user than the one whose `dump.pm2` was saved** — `pm2 resurrect` reads
whichever `PM2_HOME` it runs as, so a mismatch restores a different file. The
audit checks all four conditions. Reboot persistence has been demonstrated by
simulation — daemon killed, application killed, resurrect from a shell stripped
of all ten variables `[MEASURED]` — and is **`[UNVERIFIED ON HOST]`**.

**Rollback** — restoring the previous nginx server block and reloading. It is one
file restore plus a reload: it does not depend on PM2, on `.env`, or on the API
being up. `rollback.sh` deliberately leaves the new installation and its database
running, so the evidence survives for diagnosis.

Its verification asserts that the *previous* application is answering, not merely
that something returns 200 — the release being rolled back answers the same URL,
so a reload that did not take would otherwise report success. The two releases
are distinguishable because only the new one reports a `commit` in
`/api/health`. `[MEASURED]`: a rollback whose backup pointed at the new release
passed every mechanical step, returned 200, and is now correctly failed.

## 10 · Redis

**Not deployed.** `DISABLE_WORKERS=true` in `.env` is what makes that safe.

The connection is created lazily, so importing the module costs nothing on a host
with no Redis. `startPipelineWorkers()` and `startRedisMemoryMonitor()` both
return immediately when `DISABLE_WORKERS=true` — the monitor's guard matters
because its first `INFO` call is what would open the socket, which measured 8
error lines in 22 seconds on a Redis-less host `[MEASURED]`.

`/api/health/deep` reports workers as `unknown` rather than unhealthy when they
are disabled, so an absent Redis does not make the platform look broken.

What is unavailable without it: the five BullMQ pipeline workers (timeline,
narrative, contradiction, video, doctrine). Queue-backed features do not run.
Everything exercised by the 17-check functional smoke test does.

If Redis is ever added, set `REDIS_URL` **and** `DISABLE_WORKERS=false`. Setting
neither leaves the code defaulting to `redis://localhost:6379`, so a host whose
Redis lives elsewhere fails looking exactly like Redis being down.

## 11 · Artifact freeze

After `stage3-start.sh` passes, it fingerprints what it verified: the bundle,
the build stamp, the frontend index, `.env`, the file list of `dist/public`, and
the migration directory list. `stage4-cutover.sh` re-checks it before touching
nginx.

The point is that the artifact verified is the artifact that deploys. A rebuild,
an `npm install`, a `git pull` or an edit to `.env` between verification and
cut-over changes the fingerprint and stops the cut-over.

## 12 · Two deployment architectures live in this repository

The single most expensive thing to get wrong, so it is stated plainly.

| | PM2 deployment | Docker Compose stack |
|---|---|---|
| Documented in | `DEPLOY_FROM_SCRATCH.md` | `README.md` |
| Runs | `dist/index.js` under PM2 | containers via `docker-compose.yml` |
| Environment file | `env.release.example` → `$V1/.env` | `.env.example` → `deploy/.env` |
| `DATABASE_URL` | set explicitly | synthesised from `POSTGRES_*` |
| Used by production | **Yes** | No |

Copying `.env.example` into a PM2 release produces a file with no `DATABASE_URL`.
The service then fails with `Database unreachable` and advice to run
`prisma migrate deploy`, none of which is the problem. `[MEASURED]` — this was
reproduced from a clean clone, and it is the same failure as the production
outage.

## 13 · What this architecture does not provide

- **No horizontal scale.** One process, `instances: 1`. Fastify is single-node
  and nothing shares session state.
- **No zero-downtime deploy.** `pm2 reload` drains in-flight requests in about
  2.2 s, but the cut-over itself is an nginx change.
- **No object storage.** Evidence is on a filesystem path. R2 and S3 are
  unexercised.
- **No email or payments** without SES and Stripe credentials; those flows are
  inert rather than broken.
- **No automatic backup verification.** A dump existing is not a dump restoring.
- **No queue processing** while `DISABLE_WORKERS=true`.

Each is a deliberate boundary of the certified configuration, not an oversight.
