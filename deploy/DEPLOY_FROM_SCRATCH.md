# Deploy CourtAccess from scratch

Clone to a healthy service, assuming no prior knowledge of this project. Every
command here was executed end to end against a clean clone, an empty database
and a fresh PM2 daemon before being written down. Where a step exists only to
catch a specific failure, it says which.

**This is the PM2 deployment, which is what production runs.** `README.md` in
this directory describes a Docker Compose stack. That is a different
architecture with a different environment file, and mixing them is the single
most expensive mistake available here — see [Wrong `.env`](#wrong-env).

Roughly: install prerequisites, build a release, write `.env`, migrate, prove it
starts outside PM2, then hand it to PM2 and prove it survives a restart.

---

## 0 · Prerequisites

Node **22** (the bundle is compiled `--target=node22` and refuses to run on
less), PostgreSQL 16, nginx, PM2, git.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx git
sudo npm install -g pm2
```

Every stage script needs `NODE22` set to an absolute path to the Node 22 binary.
It is pinned by absolute path rather than resolved from `PATH`, because PM2
records the bare string `node` and re-resolves it at spawn — which on a host with
more than one Node has started the service on the wrong runtime.

**`node` and `npm` must come from the same installation.** The stages pin npm
from `NODE22`'s own directory and refuse to run if it is not there, because a
build compiled by one toolchain and executed by another has produced mismatched
native modules. Deriving `NODE22` from `npm` guarantees the pair:

```bash
export NODE22="$(dirname "$(command -v npm)")/node"
"$NODE22" --version                       # must be v22.x
ls "$(dirname "$NODE22")/npm" >/dev/null && echo "node and npm are paired"
```

Do not simply use `command -v node`. On a host with more than one Node that can
resolve to a directory containing `node` and no `npm`, and every stage then stops
at `PATH npm () is not the pinned npm` — which was exactly the first failure when
this procedure was tested from a clean clone.

Set it in the shell you run every stage from; nothing persists it for you. If you
use nvm, `nvm which 22` gives the same answer and the scripts will find it
themselves.

## 1 · Clone

```bash
sudo mkdir -p /var/www && sudo chown "$USER" /var/www
git clone --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git /var/www/courtaccess-src
cd /var/www/courtaccess-src
```

## 2 · Create the database

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE courtaccess_v1;
CREATE USER courtaccess WITH ENCRYPTED PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE courtaccess_v1 TO courtaccess;
ALTER DATABASE courtaccess_v1 OWNER TO courtaccess;
SQL
```

`ALTER … OWNER` is not decoration: without it `prisma migrate deploy` cannot
create the schema and stops partway through.

## 3 · Build the release

```bash
bash deploy/build-release.sh /var/www/courtaccess-v1
```

Produces the layout the service expects — `dist/index.js` (the API, bundled),
`dist/public/` (the frontend, served by nginx), `prisma/`, `node_modules/`. Takes
a couple of minutes, most of it `npm ci`.

Expected tail:

```
Release assembled at /var/www/courtaccess-v1
  dist/index.js      2.1M
  dist/public/       5 files
  node_modules/      584M
```

## 4 · Write the environment file

```bash
cp deploy/env.release.example /var/www/courtaccess-v1/.env
```

Fill in every value under **Required**. Generate secrets rather than inventing
them:

```bash
openssl rand -base64 48     # JWT_SECRET, JWT_REFRESH_SECRET
openssl rand -base64 32     # COOKIE_SECRET
```

`EVIDENCE_UPLOAD_DIR` must point outside the release directory — a deployment
replaces that directory, and would take uploaded discovery with it:

```bash
sudo mkdir -p /var/lib/courtaccess/evidence && sudo chown "$USER" /var/lib/courtaccess/evidence
```

This file now holds every secret the service has, so restrict it. `cp` gives it
the mode of the example, which is world-readable:

```bash
chmod 600 /var/www/courtaccess-v1/.env
```

Confirm Node can read it. This is worth doing before anything else touches the
file, because Node's parser is not the shell — it honours no `export` prefix, no
`${VAR}`, no `$(command)`:

```bash
(env -i "$NODE22" --env-file=/var/www/courtaccess-v1/.env \
  -p '["NODE_ENV","PORT","DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"]
      .map(k=>k+": "+(process.env[k]?"loaded":"MISSING")).join("\n")')
```

Every line must say `loaded`.

## 5 · Apply migrations

```bash
cd /var/www/courtaccess-v1
(set -a; . ./.env; set +a; ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma)
```

The subshell matters. These variables must not remain in the shell you later run
PM2 from — see [Why the subshell](#why-the-subshell).

Expect `All migrations have been successfully applied.` Confirm:

```bash
psql "$(set -a; . ./.env; set +a; echo "${DATABASE_URL%%\?*}")" \
  -tAc "select count(*) from information_schema.tables where table_schema='public';"
```

Expect **116**. `psql` cannot take `DATABASE_URL` directly — Prisma's URL ends in
`?schema=public`, which psql rejects — hence the trimming above.

## 6 · Prove it starts, before involving PM2

```bash
cd /var/www/courtaccess-src
export V1=/var/www/courtaccess-v1
bash deploy/stages/standalone-check.sh
```

Runs the release under plain Node with an emptied environment, so `.env` is the
only possible source of configuration, and includes a negative control that
re-runs it without `--env-file` to confirm the file is what configures it. Must
end `PASS`.

This step exists so that the next one is unambiguous. A PM2 restart loop looks
identical whether the application cannot start or is being launched without an
environment; running it once without PM2 tells you which.

## 7 · Configure nginx

```bash
sudo tee /etc/nginx/sites-available/courtaccess >/dev/null <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/courtaccess-v1/dist/public;
    index index.html;
    client_max_body_size 500M;

    location / { try_files $uri $uri/ /index.html; }

    location /api/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/courtaccess
sudo nginx -t && sudo systemctl reload nginx
```

Record a restore point. `rollback.sh` restores exactly this file, and it reads the
path from here, so without these two lines there is nothing to roll back to and
`audit-deployment.sh` reports rollback readiness as failed:

```bash
export STATE="${STATE:-$HOME/courtaccess-deploy-state}"
mkdir -p "$STATE"
sudo cp /etc/nginx/sites-available/courtaccess "$STATE/nginx-site.backup"
sudo chown "$USER" "$STATE/nginx-site.backup"
printf '%s\n' /etc/nginx/sites-available/courtaccess > "$STATE/nginx-site.path"
```

On a first deployment this records the configuration you have just written, which
is the state to return to if a later release goes wrong. On subsequent releases
`stage4-cutover.sh precheck` does the same thing against the configuration that
is already live.

`proxy_pass` and `PORT` in `.env` must agree. If they disagree every request is a
502 while the process looks perfectly healthy — stage 3 checks this for you.

## 8 · Deploy

```bash
bash deploy/stages/stage3-start.sh
```

Validates `.env`, starts PM2 with `--env-file`, and then verifies what it did:
the interpreter is the pinned one, the restart count is zero, the environment
came from the file and not from a PM2 snapshot, and a 17-check functional smoke
test passes against the running service. Must end `PASS`.

## 9 · Make it survive a reboot

Two commands, neither of which the deployment can do for you:

```bash
pm2 save                # persist the process list
pm2 startup             # prints a command — run exactly what it prints
pm2 save
```

`pm2 startup` must be run as the user whose `dump.pm2` you just saved. If the
generated unit runs as a different user it resurrects a different file, and the
service either does not come back or comes back misconfigured.

Then prove it:

```bash
bash deploy/stages/verify-restart-survival.sh
```

Checks that the saved definition carries `--env-file` and holds no copy of your
secrets, that a restart re-reads the file, and that a systemd unit exists and is
enabled. Must end `PASS`. To include a real daemon kill and resurrect — only safe
when this deployment is the sole entry in `pm2 list`:

```bash
FULL_CYCLE=yes bash deploy/stages/verify-restart-survival.sh
```

## 10 · Verify

One command covers everything below and about forty other assertions — the
environment, the migrations, the ports, PM2's saved definition, rollback
readiness, the artifact fingerprint. It is read-only and safe to re-run at any
time, including during an incident:

```bash
bash deploy/audit-deployment.sh
```

It must end `PRODUCTION READY`. The checks by hand:

```bash
for p in /api/health /api/health/ready /api/health/deep; do
  printf '%-20s local=%s  nginx=%s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100$p)" \
    "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1$p)"
done
curl -s -o /dev/null -w 'login with bad credentials: %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"wrong"}' \
  http://127.0.0.1/api/auth/login
```

All three endpoints **200** on both, and the login **401**. A 401 means the real
build is answering; a 404 means something older is.

`/api/health` is a literal and does no I/O — it cannot tell you the system works.
`/api/health/ready` is the one that reports dependency state; expect
`postgres`, `uploads` and `disk` all `healthy`.

## 11 · Create the administrator

The script imports `@prisma/client`, and Node resolves that from the directory
the *script* lives in — not the working directory. Run it from inside the
release, which is where `node_modules` is; from the source checkout it fails
with `ERR_MODULE_NOT_FOUND`.

```bash
cp /var/www/courtaccess-src/deploy/bootstrap-admin.mjs /var/www/courtaccess-v1/
cd /var/www/courtaccess-v1
(set -a; . ./.env; set +a; \
 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="$(openssl rand -base64 24)" \
 API_URL=http://127.0.0.1:3100 "$NODE22" ./bootstrap-admin.mjs)
```

The service must already be running — this registers through the same route a
customer uses, then sets the admin role and proves the account signs in. Expect:

```
Administrator created: you@example.com
Verified: the account signs in and holds the admin role.
```

Record the password. It is printed once.

The script prints which database it connected to. Check it against `DATABASE_URL`
in the release's `.env`. If the two differ, the account is registered through the
API into one database and promoted in another, and what you get is an account that
signs in but holds the `attorney` role — the deployment looks finished and every
administrative route answers 403. The script refuses rather than leaving that
behind, but the printed line is how you notice before it happens.

## 12 · Register the facility and its parser profiles

Without this the Inmate Intelligence screens load and are empty, and the first
import either has no parser profile — importing with weaker provenance and a
recorded warning — or fails outright for a facility with no compiled-in column map.
It is idempotent, so it is safe on every deployment.

```bash
cd /var/www/courtaccess-src/backend
(set -a; . /var/www/courtaccess-v1/.env; set +a; npx tsx scripts/seed-sacramento.ts)
```

Expect:

```
facility: sacramento (Sacramento County Jail)
profile: sacramento/csv published as v1
profile: sacramento/pdf_text published as v1
```

Confirm in the application under **Administration → New Inmate Intelligence →
Settings**: the Facilities table lists `sacramento`, and Parser profiles lists a
`v1` for both `csv` and `pdf_text`. An empty Parser profiles table there means this
step has not been run.

## 13 · Verify the whole thing

One script, ten criteria, each answered with a command and its output:

```bash
cd /var/www/courtaccess-src
deploy/verify-operational.sh
```

It builds a release, applies migrations to a scratch database, starts the service
with a stripped environment, creates an administrator, signs in, calls the
administrative routes, restarts the service and checks the session survived. It
verifies the instance it builds — running it on this host says nothing about any
other.

---

## Where to go next

| Document | For |
|---|---|
| [`OPERATIONS_PLAYBOOK.md`](OPERATIONS_PLAYBOOK.md) | Running it: releases, rollback, restarts, PM2 and reboot recovery, database and disaster recovery |
| [`DEPLOYMENT_ARCHITECTURE.md`](DEPLOYMENT_ARCHITECTURE.md) | Understanding the whole deployment without reading the source |
| [`DEPLOYMENT_FAILURE_MODES.md`](DEPLOYMENT_FAILURE_MODES.md) | When something breaks — eighteen observed modes, with detection and recovery |
| [`DEPLOYMENT_CERTIFICATION.md`](DEPLOYMENT_CERTIFICATION.md) | What is proven, what is not, and the conditions on certification |
| `audit-deployment.sh` | Whether the deployment is production ready right now |

---

## Rollback

```bash
pm2 delete courtaccess-v1        # stops this deployment
```

Where a previous application is being replaced, `deploy/stages/rollback.sh`
restores the nginx server block backed up at cut-over and reloads. It is a file
restore plus a reload — it does not depend on PM2, on `.env`, or on the API being
up. It deliberately leaves the new installation and its database in place so the
evidence survives.

---

## When it does not work

### Wrong `.env`

`deploy/.env.example` configures the **Docker Compose** stack: it has
`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, from which compose synthesises
`DATABASE_URL`. Copying it to the release produces a file with no `DATABASE_URL`
at all. The service then fails like this:

```
WARNING  DATABASE_URL   not set
[Startup] 4 check(s) would be fatal in production, 4 warnings.
          Continuing because NODE_ENV is not production.
[Schema Assert] ERROR: Database unreachable:
error: Environment variable not found: DATABASE_URL.
[Schema Assert] Server cannot start with drifted schema.
[Schema Assert] Run: npx prisma migrate deploy
```

**The last three lines are misleading.** The database is reachable and the schema
is not drifted. Running `prisma migrate deploy` will not help. The cause is the
line above them. Use `deploy/env.release.example`.

This is not hypothetical: it is the failure that produced a 578-restart crash
loop in production, diagnosed first as Redis and then as the database. Full
analysis in [`ROOT_CAUSE_CRASH_LOOP.md`](ROOT_CAUSE_CRASH_LOOP.md).

### `[Startup] … Continuing because NODE_ENV is not production`

Treat this line as fatal whatever follows it. It means the process could not find
`NODE_ENV`, concluded it was on a developer machine, and downgraded every fatal
configuration error to a warning. If `NODE_ENV` is missing, the rest of the
environment is usually missing too, and the error you eventually see will name
the wrong subsystem.

### PM2 says `online` but nginx returns 502

`online` only means PM2 is respawning it. Check the restart counter:

```bash
pm2 jlist | "$NODE22" -pe 'JSON.parse(require("fs").readFileSync(0,"utf8"))
  .map(p=>p.name+" restarts="+p.pm2_env.restart_time).join("\n")'
```

A counter climbing by tens per minute is a crash loop. `pm2 logs <name> --lines 200
--nostream` has the reason. A 502 that returns as fast as a static page is a
connection refused — nothing is bound. A 502 after a long stall is a different
problem.

### Secrets are absent from `/proc/<pid>/environ`

Correct, and not a fault. `--env-file` values are loaded inside the process;
`/proc` shows only what was handed over at exec. Their **absence** is how you know
PM2 is not holding a copy. `ps` is no better — PM2 rewrites `process.title`, so
even `--env-file` disappears from the command line. Use `pm2 jlist` for
arguments.

### Why the subshell

Node's `--env-file` does not replace a variable that is already set: the
inherited value wins. PM2 snapshots the environment of the shell that starts it,
so if `.env` is also exported into that shell, the snapshot outranks the file
permanently — editing `.env` then changes nothing, and a reboot restores whatever
was captured. Reading the file in a subshell, `(set -a; . ./.env; set +a; …)`,
gives you the values without leaving them behind. `stage3-start.sh` strips them
defensively as well, so it is correct even from a shell that has sourced `.env`.

Never use `pm2 reload/restart --update-env`. It copies your current shell over
the process environment, which is the same failure by another route.
