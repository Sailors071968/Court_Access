# Deployment plan — Release Candidate to production

Program 157. **Plan only. Nothing in this document has been executed, and no
change has been made to the server.**

Based on the environment you verified manually, plus facts established by
inspecting this repository. Where the plan needs something neither of those
supplies, it says so and stops rather than guessing.

---

## 1. What the verified environment tells us

| Verified fact | Consequence for deployment |
|---|---|
| Amazon Linux 2023 | `dnf`, not `apt`. `deploy/bootstrap-ec2.sh` from the previous programme calls `apt-get` and **must not be run on this host.** |
| `/var/www/courtaccess` is the live application | Deploy alongside it, not over it, so rollback is a symlink flip. |
| Node runs `/var/www/courtaccess/dist/index.js` | See blocker B1. The RC backend cannot produce that file. |
| Node listens on `127.0.0.1:3000` | The RC backend defaults to **3001** (`src/server.ts:60`). `PORT=3000` must be set. |
| Nginx proxies `/api` to `127.0.0.1:3000` | No nginx change needed if the RC backend listens on 3000. |
| Static served from `/var/www/courtaccess/dist/public` | The RC frontend builds to `dist/` with `index.html` at its root. Files must be placed into `dist/public`, not `dist`. |
| PM2 manages **only** the FAA scanner | See blocker B2. What starts the API is unknown. |
| RC branch exists in GitHub, not deployed | `cursor/gold-standard-upload-portal-9f94`, tip `88fdd12`, 59 commits ahead of `dev`. |

---

## 2. Blockers that must be resolved before any deployment

These are not risks to manage during the deployment. They are things that make
the deployment impossible as currently specified.

### B1 — The RC backend has no build output

The running service is a bundled `dist/index.js`. **This repository cannot
produce that file.**

Established by inspection:

- `backend/package.json` → `"build": "tsc"`
- `backend/tsconfig.json` → `"noEmit": true`, no `outDir`
- Running `tsc --outDir /tmp/tscout` emitted **0 JavaScript files**
- `npx tsc --noEmit` reports **223 type errors**
- No bundler is present: no `esbuild`, `tsup`, `rollup` or `webpack` in
  dependencies, and no bundler config file

The RC backend runs from TypeScript source: `"start": "tsx src/server.ts"`.

Whatever is currently at `/var/www/courtaccess/dist/index.js` was therefore
**not built from this repository**. That is consistent with the remote audit in
`deploy/AUDIT.md`: on the live site every API route returns 404 except
`/api/health`.

**Three options. One must be chosen before proceeding.**

| Option | What it means | Cost | Risk |
|---|---|---|---|
| **B1-a — run from source with `tsx`** | Change the service command to `tsx src/server.ts`. Matches how the RC is developed and tested. | Lowest. Node and `tsx` must be present on the host. | `tsx` compiles on the fly, so startup is slower and a syntax error surfaces at runtime rather than at build time. |
| **B1-b — add a bundler** | Add `esbuild` and a build script producing a single `dist/index.js`, keeping the existing service command unchanged. | A repository change, tested before deployment. | New build path never exercised. Must be proven in staging first. |
| **B1-c — fix `tsc` output** | Set `outDir`, remove `noEmit`, resolve 223 type errors. | Highest. | Largest change to the codebase immediately before a release. |

**Recommendation: B1-a for the first deployment**, because it is the
configuration every certification suite in this repository has run against.
B1-b is the better end state and should follow once the RC is proven in place.

### B2 — The process manager for the API is unknown

You verified PM2 manages only the FAA scanner. Something else starts the Node
process on 3000, and this plan must not guess what.

**Determine it before proceeding** (read-only, safe to run now):

```bash
# What owns port 3000, and what is its parent?
sudo ss -lptn 'sport = :3000'
PID=$(sudo ss -lptnH 'sport = :3000' | grep -oP 'pid=\K[0-9]+' | head -1)
ps -o pid,ppid,user,lstart,cmd -p "$PID"
ps -o pid,cmd -p "$(ps -o ppid= -p "$PID" | tr -d ' ')"

# Is it a systemd unit?
systemctl list-units --type=service --all | grep -iE 'court|node|api'
sudo systemctl status courtaccess 2>/dev/null || echo "no unit named courtaccess"

# Or PM2 after all, under a different user?
sudo -u ec2-user pm2 list 2>/dev/null
sudo -u root pm2 list 2>/dev/null
```

**Expected result:** a systemd unit name, or a PM2 process under another user,
or a bare `nohup`/`screen` process.

**Failure condition:** if the process has no supervisor — a bare `node` started
by hand — then it will not survive a reboot, and that must be fixed as part of
this deployment rather than inherited.

### B3 — No PostgreSQL or Redis confirmed on the host

The verified facts list neither. The RC backend requires both and **will not
start without `DATABASE_URL`**.

**Determine before proceeding:**

```bash
sudo ss -lptn 'sport = :5432'          # PostgreSQL
sudo ss -lptn 'sport = :6379'          # Redis
systemctl status postgresql 2>/dev/null || echo "no postgresql unit"
systemctl status redis6 2>/dev/null || systemctl status redis 2>/dev/null || echo "no redis unit"
dnf list installed | grep -iE 'postgres|redis' || echo "neither installed"
```

**Expected result:** both listening, or a decision on how to provide them
(installed locally with `dnf`, or RDS and ElastiCache).

**Failure condition:** neither present and no managed instances available. The
deployment cannot proceed; the RC has no data layer.

### B4 — ffmpeg

Media durations and silent-recording detection depend on it. Without it those
report as unknown — degraded, not fatal.

```bash
command -v ffprobe || echo "ffmpeg absent"
```

---

## 3. Pre-flight, on the host

Read-only. Nothing below changes anything.

```bash
# 3.1 Identify the release
cat /etc/os-release | head -2
node --version                       # RC is developed on Node 22
npm --version
git --version

# 3.2 Record what is running now, so rollback has a target
ls -la /var/www/courtaccess/
ls -la /var/www/courtaccess/dist/ | head
stat -c '%y %n' /var/www/courtaccess/dist/index.js
sha256sum /var/www/courtaccess/dist/index.js

# 3.3 Confirm nginx configuration matches what was verified
sudo nginx -T 2>/dev/null | grep -A 15 'server_name.*courtaccess'

# 3.4 Confirm the API currently answers only health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/auth/login

# 3.5 Disk space — a discovery corpus needs room twice over during upload
df -h /var/www /var
```

**Expected results:** Amazon Linux 2023; Node present; `/api/health` returns
`200`; `/api/auth/login` returns `404`; at least 20 GB free on the upload
volume.

**Failure conditions:** Node older than 20 (the RC uses Node 22 features);
`/api/auth/login` returning anything other than 404, which would mean a real
backend is already deployed and this plan's assumptions are wrong.

---

## 4. Backup — before touching anything

```bash
# 4.1 The current application, kept whole
sudo tar czf /var/backups/courtaccess-app-$(date +%F-%H%M).tar.gz \
  -C /var/www courtaccess

# 4.2 The database, if one exists on this host
sudo -u postgres pg_dump -Fc courtaccess \
  > /var/backups/courtaccess-db-$(date +%F-%H%M).dump

# 4.3 Nginx configuration
sudo cp -a /etc/nginx /var/backups/nginx-$(date +%F-%H%M)

# 4.4 Verify the backups are readable, not just present
ls -lh /var/backups/courtaccess-*
tar tzf /var/backups/courtaccess-app-*.tar.gz | head -3
pg_restore -l /var/backups/courtaccess-db-*.dump | head -3
```

**Expected result:** each backup listable. **Failure condition:** any backup
that cannot be listed is not a backup. Stop.

---

## 5. Deployment

Written for **B1-a** (run from source). If B1-b is chosen, step 5.4 changes to
running the bundler and the service command stays as it is.

### 5.1 Fetch the release beside the live one, not over it

```bash
RELEASE=/var/www/courtaccess-releases/$(date +%F-%H%M)
sudo mkdir -p "$RELEASE"
sudo chown "$USER" "$RELEASE"

git clone --depth 1 --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git "$RELEASE"

cd "$RELEASE"
git rev-parse HEAD          # expect 88fdd12615a7e6168ba25f5054f0d6b696392f61
```

**Expected result:** that exact commit. **Failure condition:** any other SHA
means the branch moved; stop and reconcile.

### 5.2 Install dependencies

```bash
cd "$RELEASE" && npm ci
cd "$RELEASE/backend" && npm ci
```

**Failure condition:** `npm ci` failing on Node 20 or below. Install Node 22.

### 5.3 Build the frontend into the layout production serves

```bash
cd "$RELEASE"
npm run build                                  # emits ./dist
ls dist/index.html dist/assets                 # expect both

# Production serves from dist/public, which this build does not create.
mkdir -p "$RELEASE/serve/public"
cp -a dist/. "$RELEASE/serve/public/"
ls "$RELEASE/serve/public/index.html"
```

**Expected result:** `index.html` and an `assets/` directory under
`serve/public`. **Failure condition:** an empty build; do not continue.

### 5.4 Configure the backend

Create `$RELEASE/backend/.env` with values you supply. **Do not invent any of
these** — each must come from you or from the existing deployment:

```
NODE_ENV=production
PORT=3000                                  # must match the nginx proxy target
HOST=127.0.0.1

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/courtaccess?schema=public
REDIS_URL=redis://127.0.0.1:6379

JWT_SECRET=                                # 48+ random bytes; changing it signs everyone out
FRONTEND_URL=https://courtaccess.net

CERTIFICATION_STAGING_DIR=/var/lib/courtaccess/staging
EVIDENCE_UPLOAD_DIR=/var/lib/courtaccess/evidence
```

```bash
sudo mkdir -p /var/lib/courtaccess/{staging,evidence}
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" /var/lib/courtaccess
chmod 600 "$RELEASE/backend/.env"
```

`SERVICE_USER` is whoever B2 identified as running the Node process.

### 5.5 Apply migrations

```bash
cd "$RELEASE/backend"
npx prisma generate
npm run db:migrate:status                  # inspect before applying
npm run db:migrate:deploy                  # wraps prisma migrate deploy with pre-flight checks
```

**Expected result:** all migrations applied, none pending.

**Failure condition:** any migration failing. **Stop and restore from 4.2.**
The RC adds tables (`official_statutes`, `charging_documents`, `filed_charges`,
`certification_upload_sessions`, `case_stage_events` and others) and one
column, `evidence.sha256`. These are additive, so an existing database should
migrate forward, but a failure mid-way must be restored rather than retried.

Verify no drift:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

**Expected result:** `-- This is an empty migration.`

### 5.6 Start the new backend on a spare port and prove it before cutting over

Do **not** stop the live service yet.

```bash
cd "$RELEASE/backend"
PORT=3099 npx tsx src/server.ts > /tmp/rc-smoke.log 2>&1 &
SMOKE=$!
sleep 20

curl -s http://127.0.0.1:3099/api/health
curl -s -o /dev/null -w 'register: %{http_code}\n' -X POST http://127.0.0.1:3099/api/auth/register
curl -s -o /dev/null -w 'law:      %{http_code}\n' http://127.0.0.1:3099/api/law/status
curl -s -o /dev/null -w 'charging: %{http_code}\n' http://127.0.0.1:3099/api/charging/codes

kill $SMOKE
```

**Expected results:** health returns JSON with `"status":"ok"`; register returns
`400` (missing body) — **not** `404`; law and charging return `401` — **not**
`404`.

**Failure condition:** any `404`. The RC backend has not loaded its routes.
Read `/tmp/rc-smoke.log`. Do not cut over.

### 5.7 Cut over

```bash
# Stop the current service using whatever B2 identified, for example:
#   sudo systemctl stop courtaccess
#   or: pm2 stop <name>

# Point the live path at the new release
sudo ln -sfn "$RELEASE" /var/www/courtaccess-current
# Then update the service's working directory / ExecStart to use
# /var/www/courtaccess-current, and its static root to
# /var/www/courtaccess-current/serve/public

sudo systemctl daemon-reload      # if systemd
# Start the service
```

**Nginx:** only the static root changes, from
`/var/www/courtaccess/dist/public` to
`/var/www/courtaccess-current/serve/public`. The `/api` proxy to
`127.0.0.1:3000` is unchanged.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Failure condition:** `nginx -t` failing. Do not reload. Restore from 4.3.

---

## 6. Verification

### 6.1 On the host

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s -o /dev/null -w 'register: %{http_code}\n' -X POST http://127.0.0.1:3000/api/auth/register
curl -s -o /dev/null -w 'static:   %{http_code}\n' http://127.0.0.1/
```

**Expected:** health JSON; register `400`; static `200`.

### 6.2 Through the domain

```bash
curl -s https://courtaccess.net/api/health
curl -s -o /dev/null -w 'login: %{http_code}\n' -X POST https://courtaccess.net/api/auth/login
curl -sI https://courtaccess.net/ | grep -i last-modified
```

**Expected:** login returns `400` or `401`, **never `404`**. `Last-Modified`
should be today's date, not 26 June.

### 6.3 Reboot persistence

This is the check that most often fails and is most often skipped.

```bash
sudo reboot
# wait, then:
curl -s https://courtaccess.net/api/health
curl -s -o /dev/null -w 'login: %{http_code}\n' -X POST https://courtaccess.net/api/auth/login
```

**Failure condition:** anything other than a working API after reboot means the
service is not supervised. Fix before proceeding to Case 001.

### 6.4 Browser verification

Perform in **Safari on macOS** first, because that is the browser Case 001 will
be uploaded from and the only one the upload portal has never been tested in.
Then Chrome, Firefox and Edge.

| Step | Expected result |
|---|---|
| Load `https://courtaccess.net` | Current build. Confirm via the `CourtAccess build:` comment in page source. |
| Register a throwaway account | Succeeds and signs in. |
| Sign in as the administrator | Lands on the dashboard. |
| Open the browser console | **No uncaught exceptions.** |
| Sidebar → Admin | Shows Gold Standard Certification, Statutory Intelligence, Production Readiness, Production Operations. |
| Admin → Statutory Intelligence, retrieve PEN 459 | Statute text with a `leginfo.legislature.ca.gov` link, legislative note and fingerprint. Proves outbound HTTPS works from the host. |
| Admin → Production Readiness | Gate renders. Expect READY WITH LIMITATIONS, blocked by CASE-001/002/003. |
| Admin → Gold Standard Certification → Import | Drag & drop zone, Select Discovery, Select Folder. |
| Drag a small test folder from Finder | Progress bar with speed, time remaining, files remaining. |
| Pause, then resume | Resumes; does not restart. |
| Confirm and process | Stages reported; lands on inventory. |
| Open a case → War Room, Charges, Evidence Coverage | Each renders. |

**Failure condition for Safari specifically:** if folder selection does not
work, `webkitdirectory` is behaving differently than in Chromium. Fall back to
**Select Discovery** with a multi-file selection and record it as a defect.
Every browser check in this repository has run in Chromium only.

---

## 7. Where Case 001 goes

**Not before every check in section 6 has passed, including 6.3 reboot
persistence.**

The order matters, and this is the reason:

1. Section 6 complete, including a reboot.
2. **Upload a small non-privileged test folder first** — five to ten files —
   through the portal end to end, and confirm inventory, processing and
   certification. This proves the path on production infrastructure with
   material that does not matter.
3. Only then upload Case 001, from Finder, in Safari, at
   **Admin → Gold Standard Certification → Import**.
4. Immediately after import, attest it:
   `POST /api/certification/cases/{id}/authorize` with an
   `authorizationNote` recording who authorised the use of the material. Until
   that is done the corpus is treated as a test fixture and does not count
   towards the release gate — deliberately, because the gate previously counted
   fixtures as real cases.
5. Run the certification and review the report.
6. Repeat for Cases 002 and 003.

**Do not upload Case 001 to prove the deployment works.** It is privileged
material and the first upload to a new deployment is the one most likely to
expose a defect.

---

## 8. Rollback

Rollback is a symlink flip and a service restart, which is the reason for
deploying beside the live application rather than over it.

### 8.1 Immediate — application only

```bash
# Stop the new service
sudo systemctl stop courtaccess           # or the B2 equivalent

# Point back at the previous release
sudo ln -sfn /var/www/courtaccess /var/www/courtaccess-current
# Restore the service's ExecStart and static root to their original values

sudo systemctl daemon-reload
sudo systemctl start courtaccess
sudo nginx -t && sudo systemctl reload nginx

curl -s http://127.0.0.1:3000/api/health
```

**Expected:** back to the prior behaviour within a minute.

### 8.2 If migrations were applied

Prisma migrations do not roll back. The RC's migrations are **additive** —
new tables and one new nullable column, `evidence.sha256` — so the previous
application will continue to run against a migrated database, since it simply
does not use the new objects.

Restore the database only if data was corrupted, not merely because the schema
moved forward:

```bash
sudo systemctl stop courtaccess
sudo -u postgres dropdb courtaccess
sudo -u postgres createdb courtaccess
sudo -u postgres pg_restore -d courtaccess /var/backups/courtaccess-db-<timestamp>.dump
sudo systemctl start courtaccess
```

**Anything uploaded after the backup is lost.** If Case 001 has been uploaded,
do not restore the database without copying the evidence directory first.

### 8.3 Complete restoration

```bash
sudo systemctl stop courtaccess
sudo rm -rf /var/www/courtaccess
sudo tar xzf /var/backups/courtaccess-app-<timestamp>.tar.gz -C /var/www
sudo rm -rf /etc/nginx && sudo cp -a /var/backups/nginx-<timestamp> /etc/nginx
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl start courtaccess
```

### 8.4 Rollback triggers

Roll back without further diagnosis if any of these occur:

- Any API route returning 404 that returned 200 in the 5.6 smoke test
- Sign-in failing for an account that worked before
- Data visible across firms
- The service not surviving the 6.3 reboot
- Any evidence file unreadable after deployment

---

## 9. Go / no-go checklist

Every line must be **yes**. A single no is a no-go.

**Blockers resolved**

- [ ] B1 decided, and the chosen option tested off-production
- [ ] B2 answered: the supervisor of the Node process is known by name
- [ ] B3 answered: PostgreSQL and Redis reachable, with credentials
- [ ] B4 answered: ffmpeg present, or its absence accepted

**Before deployment**

- [ ] Section 3 pre-flight run, all expected results seen
- [ ] Section 4 backups taken **and verified listable**
- [ ] Rollback rehearsed at least once, or a maintenance window agreed
- [ ] `JWT_SECRET`, `DATABASE_URL` and `REDIS_URL` supplied by you, not invented
- [ ] Branch tip confirmed as `88fdd12615a7e6168ba25f5054f0d6b696392f61`

**After deployment, before Case 001**

- [ ] 5.6 smoke test: no route returned 404
- [ ] 6.1 and 6.2 verification passed
- [ ] 6.3 reboot persistence passed
- [ ] 6.4 browser verification passed **in Safari on macOS**
- [ ] A small non-privileged test folder uploaded and processed end to end
- [ ] Backups confirmed running on the new deployment

**Known limitations, accepted before launch**

- [ ] Object storage is a local volume; R2/S3 has never been exercised
- [ ] Email will not send without SES credentials
- [ ] Payments are inert without a Stripe key
- [ ] Ingestion caps a single non-video file at 500 MB
- [ ] CALCRIM mapping covers 7 instructions; other charges return UNKNOWN
- [ ] No disaster recovery drill has been rehearsed on this host

---

## 10. What this plan does not cover

Stated so nobody assumes otherwise:

- **It has not been executed or tested.** No command here has been run against
  the production host, and no part of this repository has been deployed
  anywhere.
- **`deploy/bootstrap-ec2.sh` must not be used on this host.** It targets
  Debian/Ubuntu with `apt-get`, assumes Docker, and would fight the existing
  layout. It remains valid for a fresh host only.
- **The `deploy/docker-compose.yml` stack is not part of this plan.** It is an
  alternative for a clean deployment, not a migration of a live one.
- **Cloudflare is not covered.** The remote audit found no Cloudflare in front
  of this host — DNS resolves directly to the EC2 address and no `CF-Ray`
  header is returned. If Cloudflare is to be introduced, that is separate work.
- **Merging to `dev` is not part of this plan** and would trigger the existing
  frontend-only workflow, which is not what this deployment needs.
