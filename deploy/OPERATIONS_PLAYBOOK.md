# Operations playbook

Copy-paste procedures for running CourtAccess. Written for an engineer with no
prior knowledge of this deployment.

Commands here were executed against a replica with the release artifact,
PostgreSQL 16, the 30-migration schema, PM2 7.0.3 and nginx, unless marked
**[UNVERIFIED ON HOST]**, which means the form is correct but it has never been
run on the production machine.

Architecture: `DEPLOYMENT_ARCHITECTURE.md`. What breaks and why:
`DEPLOYMENT_FAILURE_MODES.md`. First deployment: `DEPLOY_FROM_SCRATCH.md`.

---

## 0 · Start every session with this

```bash
export V1=/var/www/courtaccess-v1
export V1_PORT=3100
export V1_PM2_NAME=courtaccess-v1
export SRC=/var/www/courtaccess-src            # the git checkout with deploy/
export NODE22="$(dirname "$(command -v npm)")/node"
"$NODE22" --version                            # must be v22.x
```

`NODE22` is derived from `npm` so the two come from the same installation. Every
stage refuses to run otherwise.

**Do not source `.env` into this shell.** PM2 snapshots the environment of
whatever shell starts it, and Node's `--env-file` cannot override a variable that
is already set, so a snapshot outranks the file permanently. When you need
`DATABASE_URL` for `psql`, read it in a subshell so only `PGURL` escapes:

```bash
export PGURL="$(set -a; . "$V1/.env"; set +a; echo "${DATABASE_URL%%\?*}")"
psql "$PGURL" -tAc "select 1"
```

The `%%\?*` strips `?schema=public`. Prisma requires it; `psql` and `pg_dump`
reject it with `invalid URI query parameter: "schema"`.

---

## 1 · Is it healthy? (30 seconds)

```bash
bash "$SRC/deploy/audit-deployment.sh"
```

One command, thirteen groups of checks, read-only, safe during an incident. Exit
status 0 means production ready. Anything else prints `[FAIL]` lines that are
each a reason.

For a quick manual look:

```bash
for p in /api/health /api/health/ready /api/health/deep; do
  printf '%-20s local=%s  nginx=%s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$V1_PORT$p")" \
    "$(curl -s -o /dev/null -w '%{http_code}' "https://courtaccess.net$p")"
done
curl -s -o /dev/null -w 'bad login: %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"wrong"}' \
  https://courtaccess.net/api/auth/login
```

All three **200**, and the login **401**. A 401 means the real build is
answering; a **404 means an older application is live**. That is the single
clearest signal there is.

**`/api/health` cannot tell you the system works** — it returns a literal and
does no I/O. `/api/health/ready` reports `postgres`, `uploads` and `disk`.

```bash
curl -s "http://127.0.0.1:$V1_PORT/api/health/ready" | "$NODE22" -pe '
  const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
  Object.entries(j.components).map(([k,v])=>k+"="+v.status).join("  ")'
```

**`pm2 list` is not a health check.** It shows `online` throughout a crash loop,
because PM2 keeps respawning. Read the restart counter:

```bash
pm2 jlist | "$NODE22" -pe 'JSON.parse(require("fs").readFileSync(0,"utf8"))
  .map(p=>p.name+"  restarts="+p.pm2_env.restart_time
        +"  uptime="+Math.round((Date.now()-p.pm2_env.pm_uptime)/1000)+"s"
        +"  status="+p.pm2_env.status).join("\n")'
```

A counter climbing by tens per minute is a crash loop, whatever the status says.

---

## 2 · Normal deployment

For a **first** deployment follow `DEPLOY_FROM_SCRATCH.md`. This is the routine
release of a new commit onto a host that already runs one.

Stages 1 and 2 refuse to run twice — stage 1 will not overwrite `$V1`, and
stage 2 will not migrate a database that has tables. That is deliberate. So build
to a new path and cut over to it.

```bash
# 1 · Build the new release beside the running one
export V1_NEW=/var/www/courtaccess-v1-$(date +%Y%m%d)
bash "$SRC/deploy/build-release.sh" "$V1_NEW"

# 2 · Carry the environment across, unchanged
sudo cp "$V1/.env" "$V1_NEW/.env"
chmod 600 "$V1_NEW/.env"

# 3 · Apply any new migrations (subshell: nothing lands in this shell)
cd "$V1_NEW"
(set -a; . ./.env; set +a; ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma)

# 4 · Prove it starts before PM2 is involved, on a scratch port
cd "$SRC"
V1="$V1_NEW" bash deploy/stages/standalone-check.sh          # must PASS

# 5 · Point the deployment at the new release and restart
V1="$V1_NEW" bash deploy/stages/stage3-start.sh              # must PASS
pm2 save

# 6 · Verify, including through nginx
V1="$V1_NEW" bash deploy/audit-deployment.sh                 # must be PRODUCTION READY
```

nginx serves `dist/public` from a path, so update its `root` to `$V1_NEW` and
reload — see §4. Keep the previous release directory until the next deployment;
it is the fastest rollback available.

**[UNVERIFIED ON HOST]** — the sequence is verified in a replica; the paths above
assume the production layout.

---

## 3 · Emergency deployment

When the service is down and the cause is known. Skips the observation window,
not the verification.

```bash
cd "$SRC"
bash deploy/stages/standalone-check.sh   # 30s. Answers "is the artifact able to start?"
bash deploy/stages/stage3-start.sh       # recreates the PM2 definition correctly
pm2 save
bash deploy/audit-deployment.sh
```

If `standalone-check.sh` fails, the artifact cannot start and PM2 is not the
problem — read the first `[FAIL]` and fix that. Do not restart PM2 repeatedly; a
crash loop produces the same log every few seconds and tells you nothing new.

If the cause is *not* known, roll back first (§5) and investigate afterwards. The
V1 installation and its database are left untouched by a rollback, so nothing is
lost by doing that.

---

## 4 · nginx changes

```bash
export NGINX_SITE=/etc/nginx/sites-available/courtaccess

# What is live right now, and where it comes from
sudo nginx -T | grep -nE 'server_name|proxy_pass|root ' | head -20
sudo nginx -T | grep '^# configuration file'

# Always back up before editing — rollback.sh restores exactly this file
mkdir -p "$STATE"
sudo cp "$NGINX_SITE" "$STATE/nginx-site.backup"
printf '%s\n' "$NGINX_SITE" > "$STATE/nginx-site.path"

sudo vi "$NGINX_SITE"
sudo nginx -t                            # MUST say "test is successful"
sudo systemctl reload nginx
```

**If `nginx -t` fails, do not reload.** Restore and try again:

```bash
sudo cp "$STATE/nginx-site.backup" "$NGINX_SITE"
```

`proxy_pass` must point at the same port as `PORT` in `$V1/.env`. If they
disagree every API request is a 502 while the process looks perfectly healthy.
Check both in one place:

```bash
echo "PORT in .env:  $(env -i "$NODE22" --env-file="$V1/.env" -p 'process.env.PORT')"
echo "proxy_pass:    $(sudo nginx -T 2>/dev/null | grep -oE 'proxy_pass +http://127\.0\.0\.1:[0-9]+' | grep -oE '[0-9]+$' | sort -u | tr '\n' ' ')"
```

---

## 5 · Rollback

```bash
export NGINX_SITE=/etc/nginx/sites-available/courtaccess
export SITE=courtaccess.net
bash "$SRC/deploy/stages/rollback.sh"
```

One file restore plus a reload. It does not depend on PM2, on `.env`, or on the
API being up. Measured at about 1.2 s of downtime.

It must end `PASS`. If it reports **"the NEW release is still serving"**, the
configuration was restored on disk but the reload did not take effect:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Until that succeeds, traffic is still going to the release you are rolling back.

The rollback deliberately leaves the V1 installation running and its database
untouched, so the evidence survives. Remove them only once the cause is
understood.

If PM2 itself is unhealthy and you need the previous process list back:

```bash
pm2 delete "$V1_PM2_NAME"
cp ~/rollback/dump.pm2.rollback ~/.pm2/dump.pm2      # if you have one
pm2 resurrect
```

---

## 6 · Restart

```bash
pm2 restart "$V1_PM2_NAME"          # hard restart, ~1s of refused connections
pm2 reload  "$V1_PM2_NAME"          # drains in-flight requests, ~2.2s
pm2 logs    "$V1_PM2_NAME" --lines 100 --nostream
```

**Never `--update-env`.** It copies your shell's environment onto the process,
which is how the environment stops being a function of `.env`.

A plain restart is enough after editing `.env`, because Node re-reads the file at
every spawn. Confirm what the next spawn will see:

```bash
(env -i "$NODE22" --env-file="$V1/.env" -p 'process.env.PORT')
```

After any change to the process list:

```bash
pm2 save
```

Skip that and the change survives until the next reboot, then vanishes.

---

## 7 · PM2 recovery

**The daemon is not responding.**

```bash
pm2 ping                                  # should print pong
pm2 kill                                  # stops the daemon AND every process it manages
pm2 resurrect                             # restores from dump.pm2
```

`pm2 kill` stops everything the daemon manages. Check what that includes first:

```bash
pm2 list
```

**The process is missing but the daemon is up.**

```bash
pm2 resurrect                             # if dump.pm2 has it
# or recreate the definition properly:
cd "$SRC" && bash deploy/stages/stage3-start.sh && pm2 save
```

**Do not** start it by hand with a bare `pm2 start`. Without `--interpreter` and
`--node-args="--env-file=…"` the process starts on whatever `node` is in `PATH`,
with no environment, and crash-loops.

**The definition looks wrong.**

```bash
pm2 jlist | "$NODE22" -pe 'JSON.parse(require("fs").readFileSync(0,"utf8"))
  .filter(p=>p.name===process.env.V1_PM2_NAME)
  .map(p=>({pid:p.pid, status:p.pm2_env.status, restarts:p.pm2_env.restart_time,
            node_args:p.pm2_env.node_args, interpreter:p.pm2_env.exec_interpreter,
            cwd:p.pm2_env.pm_cwd,
            secrets_held:["DATABASE_URL","JWT_SECRET","COOKIE_SECRET"].filter(k=>p.pm2_env[k])}))'
```

`node_args` must contain `--env-file=$V1/.env`, the interpreter must be an
absolute path to Node 22, and `secrets_held` must be empty. A non-empty
`secrets_held` means PM2 has a copy that outranks `.env` and will go stale — fix
it by re-running `stage3-start.sh` from a shell that has not sourced `.env`.

---

## 8 · Reboot recovery

If the service did not come back:

```bash
pm2 list                                       # is anything running at all?
ls -la ~/.pm2/dump.pm2                         # is there a saved list?
systemctl list-unit-files | grep '^pm2-'       # is there a unit?
systemctl status pm2-$(whoami)                 # did it run, and as whom?
```

Then repair whichever link is missing:

```bash
cd "$SRC" && bash deploy/stages/stage3-start.sh
pm2 save
pm2 startup                                    # prints a command — run exactly that
pm2 save
bash deploy/stages/verify-restart-survival.sh   # must PASS
```

`pm2 startup` must be run as the user whose `dump.pm2` you saved. If the unit runs
as a different user, `pm2 resurrect` reads a different `PM2_HOME` and restores a
different file — or nothing. The audit checks this.

To prove reboot survivability without rebooting:

```bash
FULL_CYCLE=yes bash "$SRC/deploy/stages/verify-restart-survival.sh"
```

It refuses the full cycle while the daemon manages anything other than this
deployment, because `pm2 kill` would stop that too.

---

## 9 · Database

```bash
export PGURL="$(set -a; . "$V1/.env"; set +a; echo "${DATABASE_URL%%\?*}")"

psql "$PGURL" -tAc "select version()"
psql "$PGURL" -tAc "select count(*) from information_schema.tables
                    where table_schema='public' and table_type='BASE TABLE'"   # expect 116
psql "$PGURL" -tAc "select count(*) from _prisma_migrations where finished_at is not null"  # expect 30
psql "$PGURL" -tAc "select migration_name from _prisma_migrations
                    where finished_at is null and rolled_back_at is null"      # expect empty
```

**Migrations are never applied by the application.** If the schema guard reports
pending migrations at boot, apply them deliberately:

```bash
cd "$V1"
(set -a; . ./.env; set +a; ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma)
```

**Backup.**

```bash
pg_dump "$PGURL" -Fc -f "$HOME/courtaccess-$(date +%Y%m%d-%H%M).dump"
```

**Restore into a scratch database first — never over a live one.**

```bash
sudo -u postgres createdb courtaccess_restore_test
pg_restore -d "postgresql://courtaccess@127.0.0.1:5432/courtaccess_restore_test" \
  --no-owner --no-privileges "$HOME/courtaccess-YYYYMMDD-HHMM.dump"
psql "postgresql://courtaccess@127.0.0.1:5432/courtaccess_restore_test" \
  -tAc "select count(*) from information_schema.tables where table_schema='public'"
```

A dump that exists is not a dump that restores. The sequence above was executed
against the replica: `pg_dump -Fc` produced a 320 KB dump and `pg_restore` into a
scratch database recreated all **116** tables. **[UNVERIFIED ON HOST]** — no
backup taken from the production host has been restored, and no restore has been
timed at production data volume.

---

## 10 · Disaster recovery

Host lost entirely. Rebuild is `DEPLOY_FROM_SCRATCH.md` plus a restore.

```
1  Provision a host: Node 22, PostgreSQL 16, nginx, PM2, git
2  Follow DEPLOY_FROM_SCRATCH.md §1–§4 (clone, database, build, .env)
3  Instead of §5's migrate: restore the most recent dump into $V1_DB
4  Continue at §6 (standalone-check), §7 (nginx), §8 (deploy)
5  pm2 save; pm2 startup; run what it prints; pm2 save
6  bash deploy/audit-deployment.sh
7  Restore the evidence directory from backup to EVIDENCE_UPLOAD_DIR
```

What you need off the host to do this, and which is not on it:

- the most recent database dump
- `$V1/.env`, or the secrets to rebuild it
- the contents of `EVIDENCE_UPLOAD_DIR`
- the nginx server block and the TLS certificate

**A backup on the same machine does not survive the machine.** Copy all four off
the host. **[UNVERIFIED ON HOST]** — this sequence has not been rehearsed
end to end.

---

## 11 · Post-deployment verification

Run in this order. Stop at the first failure.

```bash
cd "$SRC"

# 1 · The audit: thirteen groups, one verdict
bash deploy/audit-deployment.sh

# 2 · Restart, save, resurrect and the systemd unit
bash deploy/stages/verify-restart-survival.sh

# 3 · The functional smoke test — registration, case, upload, analysis
"$NODE22" deploy/stages/smoke-test.mjs "http://127.0.0.1:$V1_PORT"

# 4 · The public path, end to end
for p in /api/health /api/health/ready /api/health/deep; do
  printf '%-20s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://courtaccess.net$p")"
done
curl -s -o /dev/null -w 'bad login (401 expected): %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"wrong"}' \
  https://courtaccess.net/api/auth/login

# 5 · Watch it for a window before declaring success
OBSERVE_MINUTES=30 bash deploy/stages/stage5-observe.sh
```

The observation window matters: the outage that prompted all of this happened
*after* a clean 30-minute window, on a later respawn. Step 2 is what covers that
gap, so do not skip it.

The smoke test leaves data tagged `smoke-<timestamp>`. Remove it when convenient:

```bash
psql "$PGURL" -tAc "select email from users where email like 'smoke-%@smoke.local'"
```

---

## 12 · Administrator account

```bash
cp "$SRC/deploy/bootstrap-admin.mjs" "$V1/"
cd "$V1"
(set -a; . ./.env; set +a; \
 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="$(openssl rand -base64 24)" \
 API_URL="http://127.0.0.1:$V1_PORT" "$NODE22" ./bootstrap-admin.mjs)
```

The script must run from inside the release: it imports `@prisma/client`, which
Node resolves relative to the script's own directory, so from the source checkout
it fails with `ERR_MODULE_NOT_FOUND`. The service must already be running — it
registers through the same route a customer uses, then sets the role and proves
the account signs in. The password is printed once.

---

## 13 · Logs

```bash
pm2 logs "$V1_PM2_NAME" --lines 200 --nostream
ls -la ~/.pm2/logs/

# The startup sequence, which is where nearly every deployment fault appears
pm2 logs "$V1_PM2_NAME" --lines 300 --nostream \
  | grep -E '\[Startup\]|\[Schema Assert\]|\[Server\] CourtAccess|\[PipelineWorkers\]|\[Redis\]'
```

Three lines worth recognising on sight:

| Line | Means |
|---|---|
| `[Startup] Configuration OK` | the environment loaded from `.env` |
| `[Startup] … Continuing because NODE_ENV is not production` | **treat as fatal.** `NODE_ENV` is missing, so the rest of the environment probably is too, and the error you eventually see will name the wrong subsystem |
| `[Schema Assert] Database unreachable` with `Environment variable not found: DATABASE_URL` four lines below | the database is fine. `DATABASE_URL` is missing. Do not run `prisma migrate deploy` |
