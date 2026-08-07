# Production deployment — execution procedure

Program 159. Written for the architecture you verified. **Nothing here has been
run against production.** The build steps in section 2 *have* been run and
verified in this workspace; everything from section 3 onwards is for the host.

## Verified architecture this procedure uses

| | |
|---|---|
| Process manager | PM2 |
| Entry point | `/var/www/courtaccess/dist/index.js` |
| Working directory | `/var/www/courtaccess` |
| API port | `127.0.0.1:3000`, proxied by nginx at `/api` |
| Static root | `/var/www/courtaccess/dist/public` |
| PM2 persistence | `~/.pm2/dump.pm2` |

Nothing in this procedure changes any of that. No Docker. No new server. No
change to how the runtime works.

---

## 1. The blocker that had to be closed first, and how

The Release Candidate could not previously produce `dist/index.js`. Its build
script was plain `tsc`, `tsconfig.json` sets `noEmit: true` with no `outDir`,
and running `tsc` with an explicit `outDir` emitted **zero** JavaScript files.
The RC ran only from TypeScript source via `tsx`.

Since the instruction is not to redesign the runtime, the build was changed to
produce what the runtime already expects, rather than the runtime changed to
suit the build.

`backend/package.json` now has:

```json
"typecheck": "tsc --noEmit",
"build": "esbuild src/server.ts --bundle --platform=node --target=node22 --format=esm --packages=external --outfile=dist/index.js"
```

`--packages=external` keeps `node_modules` outside the bundle, which Prisma
requires — its query engine is a native binary and cannot be inlined.

**Bundling exposed a latent defect.** Two stale compiled files,
`src/lib/prisma.js` and `src/lib/redis.js`, were sitting beside their
TypeScript sources and had been committed months ago. Under `tsx` the
`.js` in an import specifier resolves to the `.ts`; under a real build it
resolves to the actual `.js`, which carried only a default export. One import
in `src/database/schemaAssert.ts` used the named form and failed to bundle.
Both artefacts are removed and the import normalised to match the other
seventy.

**Verified in this workspace, not asserted:** the bundle builds (2.0 MB),
starts, and serves the API. `/api/health` returns its JSON;
`/api/auth/register` and `/api/auth/login` return `400` to an empty POST;
`/api/law/status`, `/api/charging/codes` and `/api/certification/status`
return `401`. **No route returned 404**, which is the failure that would mean
the routes had not loaded.

---

## 2. Build the release — on a build machine, not on production

```bash
git clone --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git courtaccess-rc
cd courtaccess-rc
git rev-parse HEAD
```

**Expected:** the tip of that branch. Record it; you will need it for rollback.

```bash
bash deploy/build-release.sh
```

**Expected output:**

```
Release assembled at .../release
  dist/index.js      2.0M
  dist/public/       N files
  node_modules/      ...
```

**Failure conditions:**

- `Frontend build produced no index.html` — the Vite build failed. Do not continue.
- `Backend build produced no dist/index.js` — esbuild failed. Read the error; it
  names the file and line.
- Node older than 22 — the bundle targets node22. Check with `node --version`.

Sanity-check the bundle before it leaves the build machine:

```bash
node --input-type=module -e "import('./release/dist/index.js').catch(e=>{console.error(e.message);process.exit(1)})" &
sleep 5; kill %1 2>/dev/null
```

This will complain about a missing `DATABASE_URL`, which is expected and proves
the file parses and executes.

---

## 3. Pre-flight on production — read-only

```bash
# 3.1 Record the running state
pm2 list
pm2 describe courtaccess          # substitute the real process name from pm2 list
pm2 info courtaccess | grep -E 'script path|exec cwd|status|uptime|restarts'

# 3.2 Record what is being replaced
ls -la /var/www/courtaccess/dist/
sha256sum /var/www/courtaccess/dist/index.js
stat -c '%y' /var/www/courtaccess/dist/index.js

# 3.3 Confirm the current behaviour, so the comparison after is meaningful
curl -s -o /dev/null -w 'health: %{http_code}\n' http://127.0.0.1:3000/api/health
curl -s -o /dev/null -w 'login:  %{http_code}\n' -X POST http://127.0.0.1:3000/api/auth/login

# 3.4 Data layer — the RC will not start without these
sudo ss -lptn 'sport = :5432' || echo 'NO POSTGRES ON THIS HOST'
sudo ss -lptn 'sport = :6379' || echo 'NO REDIS ON THIS HOST'

# 3.5 Room to work
df -h /var/www /var
node --version
```

**Expected:** PM2 shows the app online; `login` returns `404` today; both data
stores listening; Node 22; at least 20 GB free.

**Failure conditions:**

- **No PostgreSQL or Redis.** Stop. The RC cannot run. Provide them first.
- **Node below 22.** Stop. The bundle targets node22.
- `login` returning anything but `404` — a real backend is already deployed and
  this procedure's assumptions no longer hold.

---

## 4. Backup

```bash
sudo tar czf /var/backups/courtaccess-app-$(date +%F-%H%M).tar.gz \
  -C /var/www courtaccess

cp ~/.pm2/dump.pm2 ~/pm2-dump-$(date +%F-%H%M).bak

sudo -u postgres pg_dump -Fc courtaccess \
  > /var/backups/courtaccess-db-$(date +%F-%H%M).dump

# Verify each is readable. A backup that cannot be listed is not a backup.
tar tzf /var/backups/courtaccess-app-*.tar.gz | head -3
pg_restore -l /var/backups/courtaccess-db-*.dump | head -3
head -c 80 ~/pm2-dump-*.bak
```

**Failure condition:** any backup that will not list. Stop.

---

## 5. Stage the release beside the live one

Deploying beside, then switching, is what makes the rollback a symlink flip.

```bash
RELEASE=/var/www/courtaccess-releases/$(date +%F-%H%M)
sudo mkdir -p "$RELEASE"
sudo chown "$USER" "$RELEASE"

# Copy the built release from the build machine
rsync -a --delete ./release/ "$RELEASE/"

ls "$RELEASE/dist/index.js" "$RELEASE/dist/public/index.html"
```

**Expected:** both present. **Failure condition:** either missing — the release
did not transfer intact.

Carry the configuration across:

```bash
# If the current deployment keeps a .env
sudo cp /var/www/courtaccess/.env "$RELEASE/.env" 2>/dev/null || \
  echo 'No .env in the current deployment — create one before continuing.'
```

`$RELEASE/.env` must contain, with values **you** supply — do not invent any:

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/courtaccess?schema=public
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=                        # changing this signs everyone out
FRONTEND_URL=https://courtaccess.net
CERTIFICATION_STAGING_DIR=/var/lib/courtaccess/staging
EVIDENCE_STORAGE_DIR=/var/lib/courtaccess/evidence
```

```bash
chmod 600 "$RELEASE/.env"
sudo mkdir -p /var/lib/courtaccess/{staging,evidence}
sudo chown -R "$USER":"$USER" /var/lib/courtaccess
```

The upload and evidence directories are **outside the release directory** so
that deploying a new release never touches uploaded discovery.

---

## 6. Migrations

Additive only — new tables plus one nullable column, `evidence.sha256`.

```bash
cd "$RELEASE"
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

**Expected:** migrations applied; the diff prints
`-- This is an empty migration.`

**Failure condition:** any migration error. **Stop and restore from section 4.**
Do not retry a partially applied migration.

---

## 7. Prove the release on a spare port before touching PM2

The live service keeps running throughout this step.

```bash
cd "$RELEASE"
set -a; . ./.env; set +a
PORT=3099 node dist/index.js > /tmp/rc-smoke.log 2>&1 &
SMOKE=$!
sleep 20

curl -s http://127.0.0.1:3099/api/health; echo
curl -s -o /dev/null -w 'register: %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3099/api/auth/register
curl -s -o /dev/null -w 'login:    %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3099/api/auth/login
curl -s -o /dev/null -w 'law:      %{http_code}\n' http://127.0.0.1:3099/api/law/status
curl -s -o /dev/null -w 'charging: %{http_code}\n' http://127.0.0.1:3099/api/charging/codes

kill $SMOKE
```

**Expected — these exact values, observed in this workspace:**

| Check | Expected |
|---|---|
| `/api/health` | JSON with `"status":"ok"` |
| `POST /api/auth/register` | `400` |
| `POST /api/auth/login` | `400` |
| `/api/law/status` | `401` |
| `/api/charging/codes` | `401` |

**Failure condition: any `404`.** The routes have not loaded. Read
`/tmp/rc-smoke.log`. **Do not proceed to section 8.**

A `500` on health usually means `DATABASE_URL` is wrong or PostgreSQL is
unreachable.

---

## 8. Cut over with PM2

The runtime is unchanged: PM2 still runs `node dist/index.js` from a working
directory. Only which directory that is changes.

### 8.1 Zero-downtime, if the app is in cluster mode

Check first:

```bash
pm2 describe courtaccess | grep -E 'exec mode|instances'
```

**If `exec mode` is `cluster`**, `pm2 reload` restarts workers one at a time and
no request is dropped:

```bash
sudo ln -sfn "$RELEASE" /var/www/courtaccess-current
pm2 reload courtaccess --update-env
```

**If `exec mode` is `fork`** — one process — then **zero downtime is not
achievable with PM2 alone.** `pm2 reload` on a fork process is a restart, and
there will be a gap of roughly the application's startup time, which was about
15–20 seconds in testing. Options:

- Accept a brief outage in a maintenance window, or
- Convert to cluster mode as a separate, later change. Do **not** convert during
  this deployment; it changes the runtime, and a first deployment is the wrong
  time to test a new process model.

### 8.2 Point PM2 at the new release

PM2 records the script path and cwd when a process is started, so changing the
directory contents is not enough — it must be restarted against the new path.

```bash
# Name from `pm2 list`
pm2 delete courtaccess

cd "$RELEASE"
pm2 start dist/index.js \
  --name courtaccess \
  --cwd "$RELEASE" \
  --time \
  --max-memory-restart 1G

pm2 save          # rewrites ~/.pm2/dump.pm2 so this survives a reboot
```

**Expected:** `pm2 list` shows `courtaccess` **online**. `pm2 save` reports the
dump was written.

**Failure condition:** status `errored` or a climbing restart count. Read
`pm2 logs courtaccess --lines 100` and go to section 10.

### 8.3 Nginx

Only the static root moves. The `/api` proxy to `127.0.0.1:3000` is unchanged.

```bash
sudo nginx -T | grep -n 'root .*courtaccess'
# Change the root to /var/www/courtaccess-current/dist/public
sudo nginx -t && sudo systemctl reload nginx
```

**Failure condition:** `nginx -t` failing. **Do not reload.** Restore the
config from backup.

---

## 9. Verification

### 9.1 On the host

```bash
pm2 list
curl -s http://127.0.0.1:3000/api/health; echo
curl -s -o /dev/null -w 'register: %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/api/auth/register
curl -s -o /dev/null -w 'static:   %{http_code}\n' http://127.0.0.1/
```

**Expected:** online; health JSON; register `400`; static `200`.

### 9.2 Through the domain

```bash
curl -s https://courtaccess.net/api/health; echo
curl -s -o /dev/null -w 'login: %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' https://courtaccess.net/api/auth/login
curl -sI https://courtaccess.net/ | grep -i last-modified
```

**Expected:** `login` returns `400` — **never `404`**. `Last-Modified` is
today, not 26 June.

### 9.3 Reboot persistence — the check most often skipped

```bash
sudo reboot
# then, once it is back:
pm2 list
curl -s -o /dev/null -w 'login: %{http_code}\n' -X POST https://courtaccess.net/api/auth/login
```

**Expected:** PM2 resurrects the app from `~/.pm2/dump.pm2` and the API answers.

**Failure condition:** PM2 empty after reboot means `pm2 save` did not take, or
`pm2 startup` was never configured. Run `pm2 startup`, follow its instruction,
then `pm2 save` again — and reboot a second time to confirm.

### 9.4 Browser verification

Do **Safari on macOS first.** It is the browser Case 001 will be uploaded from
and the only one the upload portal has never been tested in — every browser
check in this repository has run in Chromium.

| Step | Expected |
|---|---|
| Load `https://courtaccess.net` | Current build; confirm via the `CourtAccess build:` comment in page source |
| Browser console | No uncaught exceptions |
| Register a throwaway account | Succeeds and signs in |
| Sign in as administrator | Reaches the dashboard |
| Sidebar → Admin | Gold Standard Certification, Statutory Intelligence, Production Readiness, Production Operations all listed |
| Statutory Intelligence → retrieve PEN 459 | Statute text, `leginfo.legislature.ca.gov` link, legislative note, fingerprint. Proves outbound HTTPS from the host. |
| Production Readiness | Gate renders; expect READY WITH LIMITATIONS blocked by CASE-001/002/003 |
| Gold Standard → Import | Drag & drop zone, Select Discovery, Select Folder |
| Drag a small test folder from Finder | Progress with speed, time remaining, files remaining |
| Pause, then resume | Resumes; does not restart |
| Confirm and process | Stages reported; lands on inventory |

**Safari-specific failure:** if **Select Folder** does nothing, `webkitdirectory`
is behaving differently than in Chromium. Fall back to **Select Discovery** with
a multi-file selection, and record it as a defect.

Then repeat the load-and-sign-in checks in Chrome, Firefox and Edge.

---

## 10. Rollback

### 10.1 Application — under a minute

```bash
pm2 delete courtaccess
cd /var/www/courtaccess
pm2 start dist/index.js --name courtaccess --cwd /var/www/courtaccess --time
pm2 save

sudo ln -sfn /var/www/courtaccess /var/www/courtaccess-current
# Restore the nginx root to /var/www/courtaccess/dist/public
sudo nginx -t && sudo systemctl reload nginx

curl -s -o /dev/null -w 'health: %{http_code}\n' http://127.0.0.1:3000/api/health
```

### 10.2 PM2 configuration

```bash
pm2 kill
cp ~/pm2-dump-<timestamp>.bak ~/.pm2/dump.pm2
pm2 resurrect
pm2 list
```

### 10.3 Database

Prisma migrations do not roll back. The RC's are **additive**, so the previous
application runs unchanged against a migrated database — it simply does not use
the new tables. **Restore only if data was corrupted, not because the schema
moved forward.**

```bash
pm2 stop courtaccess
sudo -u postgres dropdb courtaccess
sudo -u postgres createdb courtaccess
sudo -u postgres pg_restore -d courtaccess /var/backups/courtaccess-db-<timestamp>.dump
pm2 start courtaccess
```

**Anything uploaded since the backup is lost.** If Case 001 has been uploaded,
copy `/var/lib/courtaccess/evidence` elsewhere before restoring.

### 10.4 Complete restoration

```bash
pm2 delete courtaccess
sudo rm -rf /var/www/courtaccess
sudo tar xzf /var/backups/courtaccess-app-<timestamp>.tar.gz -C /var/www
cd /var/www/courtaccess
pm2 start dist/index.js --name courtaccess --cwd /var/www/courtaccess
pm2 save
sudo nginx -t && sudo systemctl reload nginx
```

### 10.5 Roll back immediately, without further diagnosis, if

- Any route returns 404 that returned 200 in the section 7 smoke test
- Sign-in fails for an account that worked before
- Data is visible across firms
- PM2 restart count climbs after cut-over
- The app does not come back after the section 9.3 reboot
- Any evidence file is unreadable

---

## 11. Where Case 001 goes

**Only after every check in section 9 has passed, including the reboot.**

1. Section 9 complete.
2. **Upload a small non-privileged test folder first** — five to ten files —
   through the portal, end to end, and confirm inventory and processing. The
   first upload to a new deployment is the one most likely to expose a defect,
   and privileged discovery is the wrong material to find it with.
3. Then Case 001, from Finder, in Safari, at **Admin → Gold Standard
   Certification → Import**.
4. Immediately after import, attest it:
   `POST /api/certification/cases/{id}/authorize` with an `authorizationNote`
   recording who authorised the use of the material. Until then it counts as a
   test fixture and does not move the release gate — deliberately, because the
   gate previously counted fixtures as certified cases.
5. Run the certification and read the report.
6. Repeat for Cases 002 and 003.

---

## 12. Production acceptance checklist

Every line must be **yes**.

**Before deployment**

- [ ] PostgreSQL and Redis confirmed reachable from the host
- [ ] Node 22 or later on the host
- [ ] `pm2 list` recorded; process name known
- [ ] Application, database and `dump.pm2` backed up **and verified listable**
- [ ] `DATABASE_URL`, `REDIS_URL` and `JWT_SECRET` supplied, not invented
- [ ] Release built by `deploy/build-release.sh`, both artefacts present
- [ ] Branch tip recorded for rollback
- [ ] `exec mode` known — cluster gives zero downtime; fork does not

**After cut-over, before Case 001**

- [ ] Section 7 smoke test: no route returned 404
- [ ] Section 9.1 and 9.2 passed; `login` returns 400, never 404
- [ ] `Last-Modified` shows today
- [ ] Section 9.3 reboot: PM2 resurrected the app
- [ ] Section 9.4 browser verification passed **in Safari**
- [ ] Small non-privileged folder uploaded and processed end to end
- [ ] `pm2 save` run and `~/.pm2/dump.pm2` updated

**Accepted limitations**

- [ ] Evidence is on a local volume; R2/S3 has never been exercised
- [ ] Email will not send without SES credentials
- [ ] Payments inert without a Stripe key
- [ ] Single non-video upload capped at 500 MB
- [ ] CALCRIM covers 7 instructions; other charges return UNKNOWN
- [ ] No disaster recovery drill rehearsed on this host

---

## 13. What this procedure does not do

- It has not been executed against production.
- It does not use Docker, provision a new server, or change the runtime.
  `deploy/bootstrap-ec2.sh` and `deploy/docker-compose.yml` are for a fresh
  host and **must not be used here**.
- It does not merge to `dev`. Merging would trigger the existing frontend-only
  workflow, which is not what this deployment needs.
- It does not introduce Cloudflare. The remote audit found none in front of
  this host.
