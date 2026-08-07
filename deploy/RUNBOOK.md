# Deployment execution — CourtAccess 1.0

Program 168, revised. Not an audit. This is the sequence from the current state
to Case 001 in production.

> **Revision note.** The first version of this runbook deployed by symlinking
> `/var/www/courtaccess` to a versioned release directory. **There is no
> observed evidence that production uses versioned releases or symlinks** —
> every recorded fact describes `/var/www/courtaccess` as a plain path — so that
> was a redesign of the deployment model, not a reconciliation with it. It is
> withdrawn. This version deploys **in place**, into the existing directory,
> introducing no new architecture.
>
> Rehearsing the in-place model exposed two failures the symlink version would
> also have hit. Both are now handled in Stage D4 and F3. See "Two failures
> found in rehearsal" near the end.

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
export APP=/var/www/courtaccess
export BUILD=/opt/courtaccess-build          # scratch only; never served from
echo "APP=$APP  BUILD=$BUILD"
```

Do **not** source `.env` here. Stage D4 explains why the shell environment at
the moment of `pm2 reload` decides what the application actually runs with, and
sourcing it early makes that easy to get wrong by accident.

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

**Confirm the deployment model**, since this runbook assumes a plain directory:

```bash
[ -L "$APP" ] && echo "SYMLINK -> $(readlink -f "$APP")" || echo "plain directory"
ls -la /var/www/
ls -la "$APP" | head -15
ls -d /opt/courtaccess* /var/www/releases /var/www/*/releases 2>/dev/null || echo "no release directories"
```

**Expected:** `plain directory`, a conventional layout under `$APP` containing
`dist/`, `node_modules/` and `.env`, and no release directories.

**Stop if:** it reports `SYMLINK`. Production would then already use a versioned
release model, and Stage F3 should swap the symlink instead of renaming
directories. Report what it points at before continuing — the rest of this
runbook assumes in-place.

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

# STAGE B — The certificate · **RESOLVED 7 August 2026**

**No action required.** Verified by TLS handshake at 23:14 UTC on 7 August:

```
issuer    = C = US, O = Let's Encrypt, CN = YE1
notBefore = Aug  7 22:08:53 2026 GMT
notAfter  = Nov  5 22:08:52 2026 GMT
serial    = 060359B4860A6029304A03177AE6E3F61602
```

89 days remaining. A new serial and a different issuing intermediate (`YE1`,
previously `E7`) confirm this is a genuinely new certificate rather than a
cached read.

**One observation worth keeping**, because it cost a confusing twelve minutes.
The certificate was issued at 22:08:53, but a handshake at 23:02 was still
served the old one; the new certificate only appeared at 23:14. **Renewal and
service are two separate events** — certbot writes the new files, and nginx
continues serving the old certificate from memory until it reloads. Checking
`certbot certificates` alone would have shown success while browsers were still
being handed a certificate about to expire.

For future renewals, verify from outside rather than from certbot's own
report:

```bash
echo | openssl s_client -servername courtaccess.net -connect courtaccess.net:443 2>/dev/null \
  | openssl x509 -noout -dates -serial
```

The **serial** is the reliable signal, not the date alone.

Renewal should now be automatic. Confirm the timer exists so this does not
recur, at some point before 5 November:

```bash
systemctl list-timers | grep -i certbot
```

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
sudo mkdir -p "$BUILD" && sudo chown "$(whoami)":"$(whoami)" "$BUILD"
cd "$BUILD"
git clone --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git src 2>/dev/null || \
  (cd src && git fetch origin cursor/gold-standard-upload-portal-9f94 && \
   git checkout cursor/gold-standard-upload-portal-9f94 && git pull)
cd "$BUILD/src"
git rev-parse HEAD
unset NODE_ENV
bash deploy/build-release.sh "$BUILD/out"
```

`$BUILD` is scratch space. Nothing is ever served from it, and it can be deleted
after the deployment.

**Expected:** the script reports the assembled release with `dist/index.js`,
the file count under `dist/public/`, and the `node_modules` size.

**`NODE_ENV` must be unset while building.** npm skips devDependencies under
`NODE_ENV=production`, and TypeScript, Vite and esbuild are all devDependencies,
so the build fails with `tsc: not found`. The script forces `--include=dev`,
and unsetting it is belt and braces.

## D2 [R] · Verify the artifact

```bash
sha256sum "$BUILD/out/dist/index.js"
ls -la "$BUILD/out/dist/public/index.html" "$BUILD/out/dist/build-info.json"
cat "$BUILD/out/dist/build-info.json"
find "$BUILD/out" -name '*.ts' -not -path '*/node_modules/*' | wc -l
grep -o "CourtAccess build:[^<]*" "$BUILD/out/dist/public/index.html"
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

## D4 [R] · Build the environment file — read this before writing it

**The application does not read `.env`.** Verified: the 2 MB bundle contains
**zero** occurrences of `dotenv`. Environment variables reach it only from the
process PM2 starts it with. A `.env` file on disk is documentation and a source
for your shell — nothing more.

This matters because of how `pm2 reload --update-env` behaves. **It replaces
the process environment with the environment of the shell that invokes it.** In
rehearsal, a stray `PORT=3200` in the invoking shell put the application on port
3200 while `.env` plainly said otherwise, and the app came up healthy on the
wrong port — which behind nginx is a silent 502.

So two things must be true at the moment of reload: the file is correct, **and
the shell has been loaded from it**.

### Capture what the running process already has

Do this before writing anything. PM2 holds the current environment, and
`--update-env` will discard whatever you fail to carry forward.

```bash
PID=$(pm2 jlist | python3 -c 'import json,sys;print([p["pid"] for p in json.load(sys.stdin) if p["name"]=="'"$PM2_NAME"'"][0])')
sudo tr '\0' '\n' < /proc/$PID/environ | grep -oE '^[A-Z_]+' | sort > /tmp/current-env-names.txt
cat /tmp/current-env-names.txt
```

**Expected:** the names of every variable the running service has. Any name in
this list that is not in your new file will be **lost** at reload. Values are
not printed.

### Write the file

```bash
sudo cp "$APP/.env" ~/rollback/env.backup 2>/dev/null || echo "no existing .env"
sudo -e "$APP/.env"
```

Contents, with **your** values — invent none:

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=<carried forward>
JWT_SECRET=<carried forward — a new value signs every user out>
JWT_REFRESH_SECRET=<carried forward>
COOKIE_SECRET=<carried forward>
FRONTEND_URL=https://courtaccess.net
DISABLE_WORKERS=true
CERTIFICATION_STAGING_DIR=/var/lib/courtaccess/staging
EVIDENCE_UPLOAD_DIR=/var/lib/courtaccess/evidence
```

Plus anything from `/tmp/current-env-names.txt` that the service needs and this
list does not already cover.

Two names matter more than they look.

- **`PORT=3000`.** The RC defaults to 3001 (`server.ts:60`). nginx proxies to
  3000, so without this every API call returns 502.
- **`EVIDENCE_UPLOAD_DIR`.** Not `EVIDENCE_STORAGE_DIR`, which the application
  does not read. The wrong name silently sends evidence to the default inside
  the application directory.

### Verify

```bash
sudo chmod 600 "$APP/.env"
stat -c '%a' "$APP/.env"                          # expect 600
sudo grep -oE '^[A-Z_]+' "$APP/.env" | sort > /tmp/new-env-names.txt
comm -23 /tmp/current-env-names.txt /tmp/new-env-names.txt
```

**Expected:** `600`, and the `comm` output showing only variables you have
deliberately decided to drop. Anything unexpected there is about to be lost.

Confirm by eye that `PORT`, `DISABLE_WORKERS` and `EVIDENCE_UPLOAD_DIR` are
present.

---

# STAGE E — Database

## E1 [P] · Apply migrations

**The first irreversible step.** Do not start it without C1 verified.

```bash
cd "$BUILD/src/backend"
set -a; . "$APP/.env"; set +a
echo "PORT=$PORT  DB=$(echo "$DATABASE_URL" | sed -E 's#(//[^:]+):[^@]*@#\1:***@#')"
npx prisma migrate deploy
```

The `echo` is there deliberately: it is the first place the sourced environment
is used, and confirming `PORT=3000` here catches a bad `.env` before Stage F.

**Expected:** `All migrations have been successfully applied.` — or, if A2
reported a complete schema, `No pending migrations to apply.`

**On `P3005`:** stop. Nothing was modified; Prisma aborts before executing any
DDL. Return to A2.

**On any other error:** stop and go to the rollback below. Do not retry.

### Verify immediately

```bash
cd "$BUILD/src/backend"
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
cd "$BUILD/out"
set -a; . "$APP/.env"; set +a
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

**Read the startup validator output first.** It runs before the server binds and
reports every configuration problem at once, each naming the variable and the
remedy:

```bash
grep -E "^\[Startup\]|^  (PASS|WARNING|FAIL)" /tmp/smoke.log
```

**Expected:** every line `PASS` and `[Startup] Configuration OK`. A `FAIL` means
the process exited without binding — fix the named variable and re-run. This is
where a missing `JWT_SECRET` or an `EVIDENCE_UPLOAD_DIR` still pointing inside
the release is caught, and it is the cheapest place to catch either.

Then the schema guard and the worker line:

```bash
grep -A4 "Schema Assert" /tmp/smoke.log
grep -E "PipelineWorkers|Security hardening" /tmp/smoke.log
curl -s http://127.0.0.1:3399/api/health/ready
kill $SMOKE
```

**Expected:** `Migrations: 30/30 applied` with a real checksum — **not**
`no-migrations` and `0/0`, which meant the guard could not find the Prisma
directory and was verifying nothing. `[PipelineWorkers] Workers disabled via
DISABLE_WORKERS env var`. And readiness reporting `healthy` with `postgres`,
`uploads` and `disk` each listed.

**Stop if:** health does not return `version: "1.1.0"`, readiness is not
`healthy`, or the process exits. Nothing has been switched; read
`/tmp/smoke.log` and fix before continuing.

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

## F3 [P] · Replace the application, in place

No symlink, no new directory layout. The new `dist` and `node_modules` are
staged **inside `$APP`** — same filesystem, so the swap is a rename rather than
a copy — and then renamed into position. Rehearsed end to end: the rename took
**5 ms**, total downtime **about 2.2 seconds**, and `uploads/` was untouched
throughout.

### Stage alongside — slow, and the service keeps running

```bash
rm -rf "$APP/dist.new" "$APP/node_modules.new"
sudo -u "$(stat -c '%U' "$APP")" mkdir -p "$APP/dist.new"
sudo cp -a "$BUILD/out/dist/." "$APP/dist.new/"
sudo cp -a "$BUILD/out/node_modules" "$APP/node_modules.new"
sudo chown -R "$(stat -c '%U:%G' "$APP")" "$APP/dist.new" "$APP/node_modules.new"
```

### Verify the staged copy before switching to it

```bash
sha256sum "$APP/dist.new/index.js"
ls "$APP/dist.new/public/index.html" "$APP/dist.new/build-info.json"
ls -d "$APP/node_modules.new/@prisma" "$APP/node_modules.new/fastify"
du -sh "$APP/dist.new" "$APP/node_modules.new"
```

**Expected:** the checksum matches D2, both files exist, both packages are
present. **Nothing has been switched yet** — stop here freely if anything is
off, and `rm -rf` the two `.new` directories.

### Warm the page cache

The staged `node_modules` has just been written and is cold. In rehearsal a
cold copy pushed restart time from about 2 seconds to about 9.

```bash
find "$APP/node_modules.new" -type f -exec cat {} + > /dev/null 2>&1
cat "$APP/dist.new/index.js" > /dev/null
```

### The swap — four renames, then one reload

```bash
set -a; . "$APP/.env"; set +a
echo "PORT=$PORT"          # MUST print 3000 before you continue

sudo mv "$APP/dist" "$APP/dist.previous" && sudo mv "$APP/dist.new" "$APP/dist"
sudo mv "$APP/node_modules" "$APP/node_modules.previous" && sudo mv "$APP/node_modules.new" "$APP/node_modules"

pm2 reload "$PM2_NAME" --update-env
```

**`echo "PORT=$PORT"` is not decoration.** `--update-env` takes the environment
from *this shell*. If it prints anything but 3000, stop and fix `.env` — the
application would come up on the wrong port and nginx would return 502 while
the process looked perfectly healthy.

### Verify immediately

```bash
sleep 5
curl -s https://courtaccess.net/api/health
PID=$(pm2 jlist | python3 -c 'import json,sys;print([p["pid"] for p in json.load(sys.stdin) if p["name"]=="'"$PM2_NAME"'"][0])')
sudo tr '\0' '\n' < /proc/$PID/environ | grep -E '^(PORT|NODE_ENV|DISABLE_WORKERS|EVIDENCE_UPLOAD_DIR)='
sudo tr '\0' '\n' < /proc/$PID/environ | grep -c '^JWT_SECRET='
sudo ss -lntp | grep ':3000'
cat "$APP/dist/build-info.json"
pm2 logs "$PM2_NAME" --lines 40 --nostream | grep -A3 'Schema Assert'
pm2 list
```

**Expected:**

- health returns `version: "1.1.0"` — **this is the moment the deployment
  either worked or did not**
- health reports `"environment":"production"`; anything else means cookies are
  being set without the `secure` flag
- the running environment shows `PORT=3000`, `DISABLE_WORKERS=true`, and
  `EVIDENCE_UPLOAD_DIR` pointing outside `$APP`
- **the `JWT_SECRET` count is `1`**
- something is listening on 3000
- `build-info.json` names the commit you built
- `pm2 list` shows `online`

**The `JWT_SECRET` count is not optional.** If it is `0`, the application
generated a random signing key at startup and every user will be signed out on
the next restart — with no error, no warning, and a perfectly healthy-looking
service. It is the only symptom this failure has. See
[`ENV_TRACE.md`](ENV_TRACE.md).

**On the Schema Assert lines**, expect `Migrations: 30/30 applied`. If they
read `Checksum: no-migrations` and `Migrations: 0/0 applied`, the schema
integrity guard could not find the Prisma directory and has silently degraded
to a connectivity test — it is **not** verifying the schema, whatever
"Schema locked and matching" says. That does not block the deployment, since
Stage E1 already verified the schema directly with `migrate diff`, but do not
rely on the guard afterwards.

**Watch the restart counter for five minutes.** A crash-looping deploy shows as
a rising `↺` within seconds, long before anyone reports an outage.

```bash
sleep 300; pm2 list
```

### Rollback for F3

Rehearsed: the renames and reload returned in **198 ms**, with about **1.2
seconds** of downtime, and the previous build stamp was confirmed restored.

```bash
sudo mv "$APP/dist" "$APP/dist.failed" && sudo mv "$APP/dist.previous" "$APP/dist"
sudo mv "$APP/node_modules" "$APP/node_modules.failed" && sudo mv "$APP/node_modules.previous" "$APP/node_modules"
set -a; . ~/rollback/env.backup; set +a
pm2 reload "$PM2_NAME" --update-env
sleep 5
curl -s https://courtaccess.net/api/health
cat "$APP/dist/build-info.json" 2>/dev/null || echo "previous build had no stamp — expected"
```

Note the rollback sources the **backed-up** environment, not the new one.
Restoring the old code with the new environment is a third configuration nobody
has tested.

If PM2 itself is unhealthy:

```bash
pm2 delete "$PM2_NAME"
cp ~/rollback/dump.pm2.rollback ~/.pm2/dump.pm2
pm2 resurrect
```

Understand what this restores: a health-check stub in front of a frontend that
cannot sign anyone in. It is a known state, not a working service.

**Leave `dist.previous` and `node_modules.previous` in place** until Stage G
passes. They are the rollback. Remove them only after Case 001 succeeds.

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
| `/api/health/ready` | **200, `healthy`** | Database, upload directory and disk all usable |
| `/api/health/deep` | **200** | Redis shows `unknown — workers disabled`, which is correct here |

Add readiness to whatever monitors the site, **not** `/api/health`. Liveness
returns a literal and cannot report anything wrong — that is correct for
restart decisions and useless as evidence the platform works. It is precisely
how the current stub went unnoticed for six weeks.

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
| ~~TLS certificate expiring 9 August~~ | **Resolved 7 Aug** | New certificate valid to 5 Nov, serial `060359B4…` |
| nginx 1 MB body limit | F2 | 2 MB POST returns 404, not 413 |
| Production database state unknown | A2 | Inspector summary |
| Node version unknown | A1 | `node --version` |
| No verified backup | C1 | `pg_restore -l` lists a TOC |
| PM2 process name unknown | A1 | `pm2 list` |
| Evidence inside the release directory | D3, D4 | `du -sh` after the first upload |
| Reboot persistence unknown | F5 | Health responds after a real reboot |
| Safari unverified | G2 | A person, on a Mac |

## Measured figures

Rehearsed in this workspace against the real bundle under PM2 7.0.3, not
estimated:

| | |
|---|---|
| Application boot to first `200` | **1.3 s** |
| Rename window during the swap | **5 ms** |
| Cut-over downtime, in place, warm cache | **~2.2 s** |
| Cut-over downtime, **cold** `node_modules` | **~9 s** |
| Rollback downtime | **~1.2 s** |
| Rollback command wall clock | **198 ms** |
| PM2 `resurrect` recovery | **3 s** |

The original estimate of 20–25 seconds was wrong and far too pessimistic. The
cold-cache figure is why F3 warms the page cache before swapping.

## Two failures found in rehearsal

Both were found by rehearsing the in-place model, and both would have hit the
symlink version too. They are the reason this revision exists.

### 1 · The application never reads `.env`

```
$ grep -c "dotenv" dist/index.js
0
```

Zero occurrences in the 2 MB bundle. Writing `PORT=3000` into `.env` does
nothing on its own. Environment variables reach the application only through
the process PM2 starts it with.

### 2 · `pm2 reload --update-env` takes the *shell's* environment

In rehearsal, a stray `PORT=3200` in the invoking shell put the application on
port 3200 while `.env` said 3510. The process reported healthy. Behind nginx
that is a silent 502 with a green health check.

```
PORT in the running process: 3200
PORT in .env:                3510
```

Sourcing the file into the shell first produced the correct result:

```
$ set -a; . "$APP/.env"; set +a
$ pm2 reload courtaccess --update-env
PORT in the running process: 3510      health: 200
```

This is why D4 captures the current process environment before writing the new
file, and why F3 echoes `PORT` immediately before the reload.

## The three things most likely to go wrong

**Login returns 404 after F3.** The cut-over did not take. Check
`cat "$APP/dist/build-info.json"` — if it is missing or names the old commit,
the renames did not complete. Re-run them, then `pm2 restart` rather than
`reload`.

**Every API call returns 502 after F3.** The application is on the wrong port.
Confirm with `sudo tr '\0' '\n' < /proc/<pid>/environ | grep '^PORT='`. Fix
`.env`, re-source it **in the shell**, and reload again.

**The application will not start and the log names a missing module.** The
`node_modules` swap did not complete, or the staged copy was truncated. Roll
back with the F3 procedure and re-stage.
