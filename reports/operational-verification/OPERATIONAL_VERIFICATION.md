# CourtAccess Operational Verification

**Verdict: 10 of 10 criteria pass on the instance this verification builds.**

Feature development is stopped. Nothing in this run adds a feature, route, page,
parser or engine. Two defects were fixed and one missing deployment step was added,
all inside the operational path.

---

## Scope, stated before the evidence

This verifies **a release built from commit `ca65f43` and run on this host**. It says
nothing about any other machine.

There is no reachable remote host from this environment:

```
$ timeout 5 curl -s -o /dev/null -w "%{http_code}\n" https://courtaccess.io/api/health
000
no remote host reachable
```

A remote deployment is verified by running `deploy/verify-operational.sh` **on that
host**. Reading this document is not a substitute for that.

## The count

Ten criteria were requested; nine were listed. The tenth below — *the system is
ready to accept work* — was not in the list. It is included because the browser
check found that an instance can pass all nine and still be unable to do anything,
which is the definition the objective actually set: *a usable administrative
system*.

## How to reproduce

```bash
cd /path/to/repo
deploy/verify-operational.sh            # writes reports/operational-verification/
```

Full transcript: [`00-full-transcript.log`](00-full-transcript.log) (328 lines).

---

## Criterion 1 — boots without startup errors

**PASS.**

Command:

```bash
cd /tmp/verify/courtaccess-v1
env -u NODE_ENV -u PORT -u HOST -u DATABASE_URL -u JWT_SECRET -u JWT_REFRESH_SECRET \
    -u COOKIE_SECRET -u EVIDENCE_UPLOAD_DIR -u DISABLE_WORKERS -u NIIS_UPLOAD_DIR \
  node --env-file=.env dist/index.js
```

Output:

```
  port 3110 is free before starting
  pid 411488
  lines matching error patterns: 0
  listener: LISTEN 0 511 127.0.0.1:3110 0.0.0.0:* users:(("node",pid=411488,fd=23))
  listener pid: 411488   started pid: 411488
  health payload: {"status":"ok","version":"1.1.0","service":"court-access-backend",
                   "environment":"production","uptimeSeconds":2}
```

The grep covers `Failed to start`, `FATAL`, `Unhandled`, `ECONNREFUSED`,
`Cannot find module`, `SyntaxError`, `TypeError` and `Error: ` across the whole boot
log ([`app-boot.log`](app-boot.log), 470 lines). Zero matches.

`environment: production` is the application reporting the `NODE_ENV` it actually
loaded — not the file being read back.

**The listener pid is compared to the pid we started.** Without that comparison this
check passes whenever *anything* answers on the port, which is how an earlier draft
of this verification certified a stale release from a previous session. That was a
false positive in the verification itself and it is now impossible.

Artifact: `dist/index.js`, 2,379,654 bytes, sha256
`deb83548bf988c3530daebc5d25b745581061213c196196c52447c5e49a6bce1`.

## Criterion 2 — environment variables load correctly

**PASS.**

```
$ env -u <every .env key> node --env-file=.env -e '<report required keys>'
  NODE_ENV=production
  PORT=3110
  HOST=127.0.0.1
  DATABASE_URL=<set, 84 chars>
  JWT_SECRET=<set, 64 chars>
  JWT_REFRESH_SECRET=<set, 64 chars>
  COOKIE_SECRET=<set, 44 chars>
  EVIDENCE_UPLOAD_DIR=/var/tmp/courtaccess-verify/evidence
  DISABLE_WORKERS=true
  ALL_REQUIRED_PRESENT

$ node -e '<same probe WITHOUT --env-file>'          (negative control)
  CLEAN: no DATABASE_URL without --env-file

  from the file:  NODE_ENV=production PORT=3110
  file declares:  NODE_ENV=production PORT=3110
```

Values are compared, not just presence. Presence alone was not enough, for the
reason below.

### The finding that matters most in this run

**`node --env-file` does not override a variable that is already set.**

Demonstrated rather than asserted:

```
  with an ambient NODE_ENV=development PORT=9999 already set:
    NODE_ENV=development PORT=9999
```

The entire deployment architecture rests on the premise that `.env` is *the single
source of configuration*. That premise holds only when the environment is clean
first. An ambient `NODE_ENV` or `PORT` — from a login shell, a CI runner, or PM2's
snapshot of whoever ran the deploy — silently wins, and the service comes up on the
wrong port with every production guard downgraded to a warning **while every check
that reads the file reports success**.

This is the same shape as the original crash loop. `stage3-start.sh` already strips
these keys before spawning, which is the correct mitigation and was already in place.
This verification did not, and was measuring its own shell: the first run reported
`NODE_ENV=development PORT=3001` from a `.env` file declaring `production` and
`3110`. It now strips them, and demonstrates the hazard so the mitigation is not
taken on trust.

`.env` mode is `600`.

## Criterion 3 — database connects

**PASS.** Two clients, because a `psql` connection does not prove the application's
does — different driver, different connection-string parsing.

```
$ psql <database> -c "SELECT version(), current_database(), current_user"
  PostgreSQL ... | courtaccess_verify | courtaccess

$ node -e '<Prisma client connects and counts users>'
  connected=true server_time=2026-08-09T21:25:50.699Z users=1
```

## Criterion 4 — Prisma migrations complete

**PASS.** Run against a database created empty moments earlier.

```
$ psql -c "DROP DATABASE IF EXISTS courtaccess_verify"
$ psql -c "CREATE DATABASE courtaccess_verify OWNER courtaccess"
$ npx prisma migrate deploy
  38 migrations found in prisma/migrations
  ... all 38 applied ...
```

Counted from the database rather than from the command's exit code:

```
  migration directories in the repository: 38
  migrations recorded as applied:          38
  migrations failed or rolled back:        0
  tables created:                          141
```

And Prisma's own view, which reports drift the counts would miss
([`migrate-status.log`](migrate-status.log)):

```
$ npx prisma migrate status
  38 migrations found in prisma/migrations
  Database schema is up to date!
```

## Criterion 5 — a permanent administrator account is created

**PASS**, after fixing the tool.

```
$ ADMIN_EMAIL=admin@courtaccess.local ADMIN_PASSWORD=... API_URL=http://127.0.0.1:3110 \
    node --env-file=.env bootstrap-admin.mjs

  Database: 127.0.0.1:5432/courtaccess_verify
    from:   .env
    note:   the environment also has DATABASE_URL set, pointing at
            127.0.0.1:5432/courtaccess_accept.
            The file wins here. Node would have done the opposite — --env-file does
            not override an existing variable — which is why this script reads the
            file directly.
  API:      http://127.0.0.1:3110
  Administrator created: admin@courtaccess.local
  Verified: the account signs in and the service reports its role as admin.
```

Read back from the database rather than trusting the script:

```
$ psql -tAc "SELECT id, email, role, left(\"passwordHash\",4) FROM users WHERE email='admin@courtaccess.local'"
  b95d9f39-dcaa-4f5d-835f-f2bb1c48126a | admin@courtaccess.local | admin | $2b$
```

`role=admin`, and a bcrypt hash produced by the application's own registration
route rather than written in by hand.

### The defect, stated precisely

`bootstrap-admin.mjs` works through two channels: it registers over HTTP and
promotes the role over a direct database connection. It only works if both reach the
same database, and nothing was checking that.

The documented command in `DEPLOY_FROM_SCRATCH.md` uses `set -a; . ./.env; set +a`,
which **does** override ambient values — so the documented path was sound. But
`--env-file` is the mechanism the rest of this deployment uses, the script's own
header showed it, and under `--env-file` an ambient `DATABASE_URL` wins. The runbook
tells operators to export a connection string for `psql`, so the ambient value is
routinely present.

The observed failure, on the first run of this verification:

- registration landed in the service's database and succeeded;
- promotion ran against the operator's database and found nothing (`P2025`);
- the script exited 1, **and the account remained, as an `attorney`**;
- login returned HTTP 200, and every administrative route returned **403**.

That is a deployment that looks finished and is not — the exact symptom this
objective describes.

The script now builds its Prisma connection from the `--env-file` file rather than
from `process.env`, prints the database it is using, says so loudly when the
environment disagreed, verifies the registered account is visible on its own
connection before promoting, and refuses with a specific diagnosis rather than
leaving a non-administrator behind.

## Criterion 6 — login succeeds

**PASS.**

```
$ curl -X POST /api/auth/login  (as admin@courtaccess.local)
  HTTP 200
  access token:  issued, 333 chars
  refresh token: issued, 393 chars
  returned role: admin
  wrong password is refused with HTTP 401   (control)
```

The control matters: without it, "login succeeds" is satisfied by a service that
accepts anything.

Browser evidence: [`screenshots/01-login-page.webp`](screenshots/01-login-page.webp)
and [`screenshots/02-after-login.webp`](screenshots/02-after-login.webp) — signed in
as *CourtAccess Administrator*, role shown as *Admin*.

## Criterion 7 — the administrative dashboard loads

**PASS**, verified twice: the endpoint, and the rendered page.

```
$ curl -H "Authorization: Bearer <token>" /api/admin/intelligence/dashboard
  {"session":{"date":"2026-08-09","isToday":true,"batchIds":[],"filesProcessed":0,...},
   "results":{"recordsRead":0,"newInmates":0,...},
   "repository":{"people":0,...},"issues":[],"uploads":[]}
```

Zeros are correct: the database was created empty in criterion 4.

Rendered, in a browser:

- [`screenshots/03-admin-dashboard.webp`](screenshots/03-admin-dashboard.webp) —
  `/admin`, showing 1 Total User, System Health all *Operational*, and the
  **Administration** section in the sidebar. That section only renders for `admin`,
  so its presence is independent confirmation of the role.
- [`screenshots/06-intelligence-dashboard.webp`](screenshots/06-intelligence-dashboard.webp)
  — `/admin/intelligence`.

Every administrative page was opened and rendered with no error banner, no blank
screen and no console error: `/admin`, `/admin/intelligence`, and the eight
Inmate Intelligence screens.

## Criterion 8 — administrative routes are accessible

**PASS.** Each route was called twice — once with the administrator's token, once
anonymously — because a route that answers 200 to everyone is not "accessible", it
is unguarded.

```
  PASS  /api/admin/stats                        authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/overview        authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/dashboard       authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/settings        authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/uploads         authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/new-inmates     authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/review          authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/import-history  authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/engines         authenticated=200  anonymous=401
  PASS  /api/admin/intelligence/statistics      authenticated=200  anonymous=401
```

## Criterion 9 — session persistence survives restart

**PASS.**

```
  RefreshToken rows before restart: 3        (stored, not held in memory)
$ kill 411488
  process alive after stop: no
$ node --env-file=.env dist/index.js        (started again)
  new pid 411642
  health after restart: 200

$ curl -X POST /api/auth/refresh   (with the refresh token issued before the restart)
  HTTP 200
  new access token: issued, 333 chars
  admin route with the renewed token:     HTTP 200
  pre-restart access token after restart: HTTP 200
```

The last line is the one that proves it. A token signed by the **old** process is
accepted by the **new** one, which only holds if the signing secret came from `.env`
both times. Had the secret been generated per boot, or read from a shell that no
longer had it, this would be 401 and every user would be signed out by every
restart.

Browser evidence:
[`screenshots/04-session-survives-reload.webp`](screenshots/04-session-survives-reload.webp)
— still signed in after a browser reload on an admin page.

## Criterion 10 — the system is ready to accept work

**PASS**, after adding the missing step.

This was not on the list. The browser check found that a fresh instance passes all
nine criteria above and still cannot ingest anything: no facility and no parser
profile exists, so the Settings screen reads *"No facilities registered — run the
Sacramento seed script"*. A system that tells its operator to go and run a script
that the deployment guide never mentions is not yet operational.

`scripts/seed-sacramento.ts` already existed and is idempotent. It is now step 12 of
`DEPLOY_FROM_SCRATCH.md`, and step 13 is this verification.

```
$ npx tsx scripts/seed-sacramento.ts
  facility: sacramento (Sacramento County Jail)
  profile: sacramento/csv published as v1
  profile: sacramento/pdf_text published as v1

  active facilities:      1
  active parser profiles: 2
  as the Settings screen sees it: facilities=1 profiles=2
```

Confirmed in the browser —
[`screenshots/05-settings-facility-and-parser-profiles.webp`](screenshots/05-settings-facility-and-parser-profiles.webp)
shows the Facilities table listing `sacramento` / Sacramento County Jail / Full
population / Active, and Parser profiles listing `csv v1` and `pdf_text v1`, both
effective `2020-01-01 → present`.

---

## What changed in this run

Nothing that adds capability.

| Change | Why |
| --- | --- |
| `deploy/bootstrap-admin.mjs` | Reads `DATABASE_URL` from the env file rather than the environment; prints the database; verifies the registered account is visible before promoting; refuses with a diagnosis instead of leaving an `attorney`. |
| `deploy/verify-operational.sh` | New. The ten criteria as a reproducible script. |
| `deploy/DEPLOY_FROM_SCRATCH.md` | Steps 12 (seed the facility and parser profiles) and 13 (run this verification), plus a note on checking the database the bootstrap prints. |
| `vite.config.ts` | The dev proxy target is configurable. It was hard-coded to `3001`, so a browser pointed at a release on the documented port `3100` silently reached a different service or nothing. |

## Two false positives found in the verification itself

Worth recording, because both would have produced a green result on a broken system.

**It certified someone else's process.** The boot check waited for `/api/health` on
the port and accepted any answer. A stale PM2-managed release from an earlier
session held that port, so the check passed while the process under test had already
died of `EADDRINUSE`. It now compares the listening pid to the pid it started, and
refuses to run at all if the port is held by a process it did not start.

**It measured its own shell.** Criterion 2 checked that variables were *present*,
which they were — from the shell, not the file. It now strips them first and compares
values against what the file declares.

## Not verified

- **Any other host.** See the scope note. `deploy/verify-operational.sh` must be run
  on the target.
- **nginx.** The release was reached directly on `127.0.0.1:3110`. A `proxy_pass`
  that disagrees with `PORT` is a 502 while the service is perfectly healthy;
  `deploy/audit-deployment.sh` checks that pairing on a host that has nginx.
- **PM2 supervision and reboot recovery.** This started the service directly, which
  is what isolates the application from the process manager. PM2 restart and reboot
  survival are covered by `deploy/verify-restart-survival.sh`.
- **Redis-backed workers.** `DISABLE_WORKERS=true`, which is the certified
  configuration. Nothing here exercises the queue path.
