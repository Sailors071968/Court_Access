# Deployment execution — CourtAccess 1.0

Program 168. Not an audit. This is the sequence from the current state to
Case 001 in production.

## How to read this

Every step is tagged:

| Tag | Meaning |
|---|---|
| **[R]** | Read-only. Changes nothing. Run freely. |
| **[P]** | **Production-changing.** One at a time, verify before the next. |

**The rule: never run two [P] steps without the verification between them
passing.** Each [P] step carries its own rollback, for that step alone.

Steps are numbered in execution order. Do not reorder them — the sequence puts
every reversible action before every irreversible one, and builds the release
before touching the database so a build failure costs nothing.

## Session setup — run first, in every new shell

```bash
export RELEASE=/opt/courtaccess/releases/$(date +%Y%m%d-%H%M)
export APP=/var/www/courtaccess
set -a; . "$APP/.env" 2>/dev/null; set +a
echo "RELEASE=$RELEASE"
echo "DATABASE_URL=$(echo "${DATABASE_URL:-<EMPTY>}" | sed -E 's#(//[^:]+):[^@]*@#\1:***@#')"
```

---

# STAGE A — Facts, before anything changes

## A1 [R] · Collect every outstanding host fact

```bash
node --version
pm2 list
pm2 describe $(pm2 jlist | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["name"])')
df -h /var; df -i /var
sudo nginx -T | grep -n 'server_name.*courtaccess'
sudo nginx -T | grep -nE '^\s*(root|client_max_body_size|proxy_pass|proxy_request_buffering)'
pm2 startup          # WITHOUT sudo — it prints, it does not install
```

**Expected:** Node `v22.x` or later. Exactly one application process in
`pm2 list`; **write its name down**, everything below calls it `$PM2_NAME`. At
least 20 GB free on `/var`. One `server_name courtaccess.net` block; note the
file each directive comes from.

**Stop if:** Node is below 22. The bundle targets `node22` and will fail with a
`SyntaxError` inside a 2 MB file. Upgrade Node first, or rebuild at a lower
target.

**Stop if:** you cannot tell which PM2 process is the application. Guessing
risks stopping something unrelated.

```bash
export PM2_NAME=<the name you wrote down>
```

## A2 [R] · Inspect the production database

```bash
cd "$APP"
node /path/to/inspect-database.mjs
```

Read-only is enforced by `BEGIN TRANSACTION READ ONLY`, not promised.

**Expected:** a `SUMMARY` reading one of:

| Summary | Action |
|---|---|
| `EMPTY DATABASE` | Continue. Migrations create everything. |
| `PRISMA-MANAGED, SCHEMA COMPLETE` | Continue. Step D1 becomes a no-op. |
| `PRISMA-MANAGED, SCHEMA INCOMPLETE`, unfinished 0 | Continue. Migrations complete the chain. |

**Stop if:** `POPULATED BUT NOT PRISMA-MANAGED`. `prisma migrate deploy` will
refuse with `P3005`. **Do not run `prisma migrate resolve --applied`** — it
would record 30 migrations as applied without creating their tables, and that is
the only action in this deployment that cannot be undone. Decide which database
the RC should use before continuing.

**Stop if:** `unfinished` is non-zero. A previous migration was interrupted.

## A3 [R] · Confirm a backup is possible

```bash
pg_dump --version
pg_dump "$DATABASE_URL" --schema-only --no-owner -f /tmp/schema-probe.sql && wc -l /tmp/schema-probe.sql
```

**Expected:** a version, then a file of a few thousand lines.

**Stop if:** `pg_dump: command not found` and the server is not RDS — there
would be no way to undo step D1. If it is RDS, confirm automated snapshots are
on and record the latest restore point instead.

---

# STAGE B — The certificate

Independent of the deployment. **Do this first regardless of everything else.**
The certificate expires `Aug 9 18:14:08 2026 GMT`.

## B1 [R] · Confirm the diagnosis

```bash
sudo certbot certificates
systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

**Expected:** the dry run reports success. It uses the staging endpoint and
writes no certificate.

**If the dry run fails,** fix the cause before B2. The usual causes are a
webroot that has moved, or port 80 no longer reaching certbot.

## B2 [P] · Renew

```bash
sudo certbot renew
```

**Expected:** `Congratulations, all renewals succeeded`. If certbot's nginx
installer is in use it reloads nginx itself; otherwise:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Verify immediately

```bash
echo | openssl s_client -servername courtaccess.net -connect courtaccess.net:443 2>/dev/null | openssl x509 -noout -dates
curl -sI https://courtaccess.net/api/health | head -1
```

**Expected:** `notAfter` roughly 90 days out, and `HTTP/2 200`.

**Do not continue until `notAfter` has moved.**

### Rollback for B2

Certbot keeps the previous certificate:

```bash
sudo ls -la /etc/letsencrypt/archive/courtaccess.net/
# repoint the symlinks in /etc/letsencrypt/live/courtaccess.net/ to the prior
# certN.pem / privkeyN.pem, then:
sudo nginx -t && sudo systemctl reload nginx
```

Reverting to a certificate that expires in two days is only worth doing if the
new one is somehow broken.

---

# STAGE C — Backups

## C1 [P] · Take them

Changes disk, not service.

```bash
mkdir -p ~/rollback
pg_dump "$DATABASE_URL" -Fc -f ~/rollback/db-$(date +%F-%H%M).dump
cp ~/.pm2/dump.pm2 ~/rollback/dump.pm2.rollback
sudo cp -a /etc/nginx ~/rollback/nginx-$(date +%F)
sudo cp -a "$APP" "$APP.rollback-$(date +%F)"
```

### Verify immediately

```bash
pg_restore -l ~/rollback/db-*.dump | head -20
ls -lh ~/rollback/
sudo ls "$APP.rollback-"*/dist/index.js
```

**Expected:** `pg_restore -l` lists a table of contents. A dump that cannot be
listed cannot be restored — **do not continue on an empty or erroring listing.**

### Rollback for C1

None needed. Nothing was changed. To undo the disk usage,
`rm -rf ~/rollback "$APP.rollback-"*`.

---

# STAGE D — Build and stage

## D1 [R] · Build the release

Nothing here touches production. The release is inert until Stage F.

```bash
mkdir -p /opt/courtaccess/releases
cd /opt/courtaccess
git clone --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git build-src 2>/dev/null || \
  (cd build-src && git fetch origin cursor/gold-standard-upload-portal-9f94 && \
   git checkout cursor/gold-standard-upload-portal-9f94 && git pull)
cd /opt/courtaccess/build-src
git rev-parse HEAD
unset NODE_ENV
bash deploy/build-release.sh "$RELEASE"
```

**Expected:** the script reports the assembled release with `dist/index.js`,
the file count under `dist/public/`, and the `node_modules` size.

**`NODE_ENV` must be unset while building.** npm skips devDependencies under
`NODE_ENV=production`, and TypeScript, Vite and esbuild are all devDependencies,
so the build fails with `tsc: not found`. The script forces `--include=dev`,
and unsetting it is belt and braces.

## D2 [R] · Verify the artifact

```bash
sha256sum "$RELEASE/dist/index.js"
ls -la "$RELEASE/dist/public/index.html" "$RELEASE/dist/build-info.json"
cat "$RELEASE/dist/build-info.json"
find "$RELEASE" -name '*.ts' -not -path '*/node_modules/*' | wc -l
grep -o "CourtAccess build:[^<]*" "$RELEASE/dist/public/index.html"
```

**Expected:**

```
bad0f1ec9f09ddb5ea044b04b87dd594d147d1fd7d6875ba3e3989efc173df69  dist/index.js
0                       <- TypeScript files outside node_modules
CourtAccess build: <commit> <timestamp>
```

**Stop if:** the checksum differs and `backend/src` has not changed since the
certified commit. It means the build did not come from that commit.

## D3 [P] · Relocate evidence storage

**Do this before the cut-over, not after.** Evidence defaults to
`/var/www/courtaccess/uploads/evidence`, which is inside the directory the
cut-over replaces.

```bash
sudo mkdir -p /var/lib/courtaccess/{staging,evidence}
sudo chown -R "$(whoami)":"$(whoami)" /var/lib/courtaccess
ls -la "$APP/uploads/evidence" 2>/dev/null && \
  sudo rsync -a "$APP/uploads/evidence/" /var/lib/courtaccess/evidence/
```

### Verify immediately

```bash
ls -ld /var/lib/courtaccess/staging /var/lib/courtaccess/evidence
sudo du -sh "$APP/uploads/evidence" /var/lib/courtaccess/evidence 2>/dev/null
```

**Expected:** both directories exist and are owned by the user PM2 runs as. If
the old location had data, the two sizes match. `rsync` copies rather than
moves, so the original is still there — leave it until after Stage G.

### Rollback for D3

`sudo rm -rf /var/lib/courtaccess`. Nothing was removed from the old location.

## D4 [R] · Write the release configuration

```bash
sudo cp "$APP/.env" "$RELEASE/.env" 2>/dev/null || touch "$RELEASE/.env"
chmod 600 "$RELEASE/.env"
```

Then edit `$RELEASE/.env` so it contains, with **your** values — invent none:

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=<carried forward from the existing .env>
JWT_SECRET=<carried forward — a new value signs every user out>
JWT_REFRESH_SECRET=<carried forward>
COOKIE_SECRET=<carried forward>
FRONTEND_URL=https://courtaccess.net
DISABLE_WORKERS=true
CERTIFICATION_STAGING_DIR=/var/lib/courtaccess/staging
EVIDENCE_UPLOAD_DIR=/var/lib/courtaccess/evidence
```

Two names matter more than they look.

- **`PORT=3000`.** The RC defaults to 3001. nginx proxies to 3000, so without
  this every API call returns 502.
- **`EVIDENCE_UPLOAD_DIR`.** Not `EVIDENCE_STORAGE_DIR`, which the application
  does not read. Setting the wrong name silently sends evidence back to the
  default inside the application directory.

### Verify

```bash
grep -c '=' "$RELEASE/.env"
grep -oE '^[A-Z_]+' "$RELEASE/.env" | sort
stat -c '%a' "$RELEASE/.env"      # expect 600
```

Confirm `PORT`, `DISABLE_WORKERS` and `EVIDENCE_UPLOAD_DIR` are in the list.

---

# STAGE E — Database

## E1 [P] · Apply migrations

**The first irreversible step.** Do not start it without C1 verified.

```bash
cd "$RELEASE"
set -a; . "$RELEASE/.env"; set +a
npx prisma migrate deploy
```

**Expected:** `All migrations have been successfully applied.` — or, if A2
reported a complete schema, `No pending migrations to apply.`

**On `P3005`:** stop. Nothing was modified; Prisma aborts before executing any
DDL. Return to A2.

**On any other error:** stop and go to the rollback below. Do not retry.

### Verify immediately

```bash
psql "$DATABASE_URL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
psql "$DATABASE_URL" -tAc "select count(*) filter (where finished_at is not null), count(*) filter (where finished_at is null) from _prisma_migrations;"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

**Expected:** `116` tables, `30 | 0`, and **`No difference detected.`**

**Do not continue until the diff is clean.**

### Rollback for E1

```bash
# Only if you are abandoning the deployment. Migrations are not reversible:
# there are no down migrations, and four columns of schema_versions are dropped.
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"
pg_restore -d "$DATABASE_URL" --clean --if-exists ~/rollback/db-*.dump
```

---

# STAGE F — Cut-over

## F1 [R] · Smoke test on a spare port

Production is untouched. This proves the release works against the real,
now-migrated database before anything is switched.

```bash
cd "$RELEASE"
set -a; . "$RELEASE/.env"; set +a
PORT=3399 node dist/index.js > /tmp/smoke.log 2>&1 &
SMOKE=$!
sleep 5
curl -s http://127.0.0.1:3399/api/health
```

**Expected**, within about 1.3 seconds — measured, not estimated:

```json
{"status":"ok","timestamp":"…","version":"1.1.0",
 "service":"court-access-backend","environment":"production"}
```

Check the log for the worker line and no fatal errors:

```bash
grep -E "PipelineWorkers|Security hardening" /tmp/smoke.log
kill $SMOKE
```

**Expected:** `[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var`.

**Stop if:** health does not return `version: "1.1.0"`, or the process exits.
Nothing has been switched; read `/tmp/smoke.log` and fix before continuing.

## F2 [P] · Raise the nginx upload limit

```bash
sudo cp <the server-block file from A1> /tmp/nginx-block.backup
```

Add inside the `server { … }` block that carries `proxy_pass`:

```nginx
client_max_body_size 64m;
proxy_request_buffering off;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

```bash
sudo nginx -t
```

**Expected:** `syntax is ok` and `test is successful`.

**Stop if:** it fails. Restore the file from `/tmp/nginx-block.backup` and do
not reload.

```bash
sudo systemctl reload nginx
```

### Verify immediately

```bash
curl -sI https://courtaccess.net/api/health | head -1
head -c 2000000 /dev/zero > /tmp/2mb.bin
curl -s -o /dev/null -w "2 MB body -> %{http_code}\n" -X POST \
  --data-binary @/tmp/2mb.bin https://courtaccess.net/api/health
```

**Expected:** `HTTP/2 200` for the header check, and the 2 MB POST returning
**404, not 413**. 404 means nginx passed the body upstream and the API rejected
the path. 413 means nginx is still refusing.

### Rollback for F2

```bash
sudo cp /tmp/nginx-block.backup <the server-block file>
sudo nginx -t && sudo systemctl reload nginx
```

## F3 [P] · Swap the release

The mechanism below was rehearsed end to end: symlink swap plus `pm2 reload`,
with **measured downtime of about 1.2 seconds** in fork mode.

```bash
# Turn the application directory into a symlink, preserving every path that
# PM2 and nginx already record.
sudo mv "$APP" "$APP.previous"
sudo ln -sfn "$RELEASE" "$APP"
ls -la /var/www/ | grep courtaccess
```

**Expected:** `courtaccess -> /opt/courtaccess/releases/<timestamp>`.

```bash
pm2 reload "$PM2_NAME" --update-env
```

### Verify immediately

```bash
sleep 5
curl -s https://courtaccess.net/api/health
PID=$(pm2 jlist | python3 -c 'import json,sys;print([p["pid"] for p in json.load(sys.stdin) if p["name"]=="'"$PM2_NAME"'"][0])')
readlink /proc/$PID/cwd
pm2 list
```

**Expected:**

- health returns `version: "1.1.0"` — **this is the moment the deployment
  either worked or did not**
- `/proc/<pid>/cwd` resolves to the new release directory
- `pm2 list` shows `online` and a restart count of `0`

**Watch the restart counter for five minutes.** A crash-looping deploy shows as
a rising `↺` within seconds, long before anyone reports an outage.

```bash
sleep 300; pm2 list
```

### Rollback for F3

Rehearsed at about 1.2 seconds:

```bash
sudo ln -sfn "$APP.previous" "$APP"
pm2 reload "$PM2_NAME" --update-env
sleep 5
curl -s https://courtaccess.net/api/health
```

If PM2 itself is unhealthy:

```bash
pm2 delete "$PM2_NAME"
cp ~/rollback/dump.pm2.rollback ~/.pm2/dump.pm2
pm2 resurrect
```

Understand what this restores: a health-check stub in front of a frontend that
cannot sign anyone in. It is a known state, not a working service.

## F4 [P] · Persist the process list

```bash
pm2 save
```

### Verify

```bash
ls -la ~/.pm2/dump.pm2
python3 -c "import json;print([p['name'] for p in json.load(open('$HOME/.pm2/dump.pm2'))])"
```

**Expected:** the dump's timestamp is now, and it lists `$PM2_NAME`.

### Rollback for F4

```bash
cp ~/rollback/dump.pm2.rollback ~/.pm2/dump.pm2
```

## F5 [P] · Reboot persistence

**Schedule this.** It is a real outage, and it is the only way to know the
service comes back by itself.

```bash
pm2 startup            # WITHOUT sudo — prints the command
# run exactly the command it prints, which will use sudo
sudo reboot
```

### Verify after the host returns

```bash
curl -s https://courtaccess.net/api/health
pm2 list
```

**Expected:** health returns `version: "1.1.0"` **without anyone starting
anything**, and `pm2 list` shows the process online.

**Stop if:** the process did not come back. Fix boot persistence before Case
001. Real discovery should not go into a deployment that does not survive a
reboot.

### Rollback for F5

Not applicable — nothing to undo. If the boot unit is wrong,
`sudo pm2 unstartup systemd` removes it.

---

# STAGE G — Acceptance

## G1 [R] · API acceptance

```bash
curl -s https://courtaccess.net/api/health
curl -s -o /dev/null -w "login    -> %{http_code}\n" -X POST \
  -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
  https://courtaccess.net/api/auth/login
curl -s -o /dev/null -w "law      -> %{http_code}\n" https://courtaccess.net/api/law/status
curl -s -o /dev/null -w "codes    -> %{http_code}\n" https://courtaccess.net/api/charging/codes
curl -s https://courtaccess.net/ | grep -o "CourtAccess build:[^<]*"
```

**Expected:**

| Check | Expected | Why it matters |
|---|---|---|
| health | `version: "1.1.0"` | The new bundle is live |
| login with bad credentials | **401** | 404 means the old stub is still answering |
| `/api/law/status` | **401** | Route exists and is authenticated |
| `/api/charging/codes` | **401** | Same |
| build stamp | the commit you deployed | The new frontend is being served |

**A 404 on login is the signal that the cut-over did not take.** That is the
single clearest indicator, because the old stub 404s every route.

## G2 [P] · Browser verification — a person, not a script

Sign in and click through. In **Chrome**, then in **Safari on macOS**.

- Sign in as the Administrator
- Administration → Gold Standard Certification — the page loads and lists corpora
- Open a case, open the Complaint Workspace, confirm the California code
  selector populates rather than sitting empty
- Start a small folder upload and confirm the progress UI advances, then cancel

**Safari is the material gap.** All 116 automated browser checks ran on
Chromium. The folder picker uses `webkitdirectory`, whose behaviour differs
across engines.

**If Safari's folder picker does not work,** use **Select Discovery** with a
multi-file selection. That fallback has never been exercised either — test it
before Case 001, not during.

**Stop if:** the certification page shows `jwt expired` or a raw backend error.

## G3 [P] · Case 001

**Only after G1 and G2 pass, and only after F5 confirmed reboot persistence.**

Administration → Gold Standard Certification → Import Certification Case.
Select the discovery from the local computer. No SSH, no file copy, no
Linux commands.

### Verify during

```bash
watch -n 5 'pm2 list; df -h /var | tail -1; du -sh /var/lib/courtaccess/evidence'
```

**Expected:** the evidence directory grows, `/var` does not approach full, and
the PM2 restart counter stays where it was.

**Confirm evidence landed in the right place** — this is the one that catches
a wrong `EVIDENCE_UPLOAD_DIR`:

```bash
du -sh /var/lib/courtaccess/evidence
sudo du -sh "$APP/uploads/evidence" 2>/dev/null || echo "nothing in the app directory — correct"
```

**Stop if** files appear under `$APP/uploads/evidence`. The variable name is
wrong in `.env`, and the next deployment would destroy them. Fix `.env`, reload,
and move the files.

### Verify after

In the interface: the inventory lists every file with its SHA-256; the
certification report shows a **non-null git commit**; the timeline has events;
findings carry citations that navigate to their source.

**Expected of the report:** counts that match what was uploaded, and UNKNOWN
where the platform genuinely does not know — not zeros, and not fabricated
figures.

### Rollback for G3

Uploaded discovery is data, not deployment. To remove a certification corpus,
delete it through the portal. Do not delete files from disk directly — the
database would still reference them.

---

# Where each blocker is eliminated

| Blocker | Eliminated at | Verified at |
|---|---|---|
| TLS certificate expiring 9 August | B2 | `openssl x509 -noout -dates` |
| nginx 1 MB body limit | F2 | 2 MB POST returns 404, not 413 |
| Production database state unknown | A2 | Inspector summary |
| Node version unknown | A1 | `node --version` |
| No verified backup | C1 | `pg_restore -l` lists a TOC |
| PM2 process name unknown | A1 | `pm2 list` |
| Evidence inside the release directory | D3, D4 | `du -sh` after the first upload |
| Reboot persistence unknown | F5 | Health responds after a real reboot |
| Safari unverified | G2 | A person, on a Mac |

## Measured figures

Rehearsed in this workspace, not estimated:

| | |
|---|---|
| Application boot to first `200` | **1.3 s** |
| Cut-over downtime, `pm2 reload`, fork mode | **~1.2 s** |
| Rollback downtime, symlink swap back | **~1.2 s** |
| PM2 `resurrect` recovery | **3 s** |

The earlier estimate of 20–25 seconds of downtime was wrong and too pessimistic.

## The two things most likely to go wrong

**Login returns 404 after F3.** The cut-over did not take. Check
`readlink /proc/<pid>/cwd` — if it still points at `$APP.previous`, PM2 did not
pick up the swap. `pm2 restart` rather than `reload`.

**Every API call returns 502 after F3.** `PORT` is not `3000`. The RC defaults
to 3001. Fix `$RELEASE/.env` and `pm2 reload "$PM2_NAME" --update-env`.
