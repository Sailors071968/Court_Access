# Remaining verification before deployment

Program 163. Derived from the Program 162 audit. **Every command here is
read-only.** Nothing starts, stops, restarts, writes or deploys.

Run them in the order given. The order is deliberate: the cheapest checks that
can abort the whole deployment come first, so you do not spend time on
configuration detail before knowing whether the platform can run at all.

> **Superseded in part by [`RECONCILIATION.md`](RECONCILIATION.md)
> (Program 164).** `DATABASE_URL` is now verified present, so A2 is reduced to a
> version and schema-state question. A3 (Redis) was wrong and is withdrawn. Read
> the reconciliation for the current classification of every blocker; this
> document remains the source for the commands themselves.

Fourteen UNKNOWNs remain from the audit, in three groups:

- **Ten block the deployment itself** (groups A and B) — the Release Candidate
  either will not run, or cannot be cut over and undone safely.
- **Three block Case 001** (C1, C3, C4) — the deployment would succeed and the
  upload it exists for would not.
- **One degrades** (C2) — worth fixing, not worth stopping for.

Nine further UNKNOWNs affect neither and are listed at the end so they are not
mistaken for blockers.

---

## Group A — Can the Release Candidate run here at all?

If any of these fails, stop. Nothing later matters.

### A1 · Node version

```bash
node --version
```

**Why:** the bundle is compiled with `--target=node22`. esbuild emits syntax
that older runtimes cannot parse, and the failure appears at startup as a
`SyntaxError` in a 2 MB file, which is unpleasant to diagnose under pressure.

**Expected:** `v22.x.x` or later.

**Blocks if:** below v22. Node must be upgraded before deploying. This is the
single cheapest check and the most fatal, which is why it is first.

### A2 · PostgreSQL is present and reachable

```bash
sudo ss -lntp 'sport = :5432'
psql --version
```

**Why:** the audit could not determine whether a database exists on the host.
The API calls a schema-integrity assert during startup and **will not start
without `DATABASE_URL`** pointing at a reachable PostgreSQL.

**Expected:** a listener on 5432, and `psql (PostgreSQL) 16.x` or later.

**Blocks if:** nothing listening, or no managed instance available. There is
nowhere for the application's data to go. Below PostgreSQL 14 also blocks —
the Prisma schema uses features not present in older majors.

### A3 · Redis — **withdrawn, this was wrong**

Superseded by [`RECONCILIATION.md`](RECONCILIATION.md). Redis is **not**
required to deploy and **not** required for Case 001.

I originally wrote that its absence "blocks", inferring that from BullMQ
appearing across 40-odd files rather than from tracing the certification path.
Having traced it: upload, inventory, ingest, timeline, contradictions and
CALCRIM are all synchronous and none of them touch Redis. The Redis reconciliation
section of that document has the call-by-call evidence.

Set `DISABLE_WORKERS=true` in the release environment so the five BullMQ workers
do not start and retry forever. Nothing else is needed.

### A4 · Free disk space

```bash
df -h / /var /var/www
df -i /var
```

**Why:** during upload each file exists twice — the staged chunks and the
ingested copy — plus the release directory carries roughly 600 MB of
`node_modules`.

**Expected:** at least 20 GB free on the volume holding `/var`, and inodes not
near exhaustion.

**Blocks if:** under about 5 GB free. An upload that fills the disk mid-transfer
leaves a partial corpus and can take the database down with it.

---

## Group B — Can we cut over safely?

These determine whether the deployment can be performed and undone.

### B1 · The exact PM2 process name and mode

```bash
pm2 list
pm2 describe <name-from-above>
```

**Why:** the audit established that PM2 manages the application but not what the
process is called. Section 8 of the execution procedure stops and restarts it by
name; the wrong name stops the wrong thing, or nothing. `exec mode` also decides
whether zero-downtime is achievable.

**Expected:** one process for the application, `status: online`. Note the exact
name, `script path`, `exec cwd` and `exec mode`.

**Blocks if:** you cannot identify which process is the application. Do not
guess — stopping the FAA scanner instead would be an unrelated outage.

**Note:** if `exec mode` is `fork_mode`, zero downtime is not achievable and the
cut-over costs 20–25 seconds. That is a planning fact, not a blocker.

### B2 · PM2 will resurrect after a reboot

```bash
ls -la ~/.pm2/dump.pm2
systemctl list-units --all | grep -i pm2
pm2 startup
```

**Why:** `pm2 startup` **prints** the command to install the boot unit; it does
not install it. Run it exactly as written above — **without `sudo`**. With
`sudo` it installs the unit, which would modify the server. If no unit exists, the
application will not come back after a reboot — and the deployment includes a
reboot test precisely because this is so often missed.

**Expected:** a `dump.pm2` file, and a `pm2-<user>.service` unit present and
enabled. `pm2 startup` reporting the unit is already configured.

**Blocks if:** no boot unit. Not a blocker for the deployment itself, but it is
a blocker for **Case 001**: uploading real discovery to a deployment that will
not survive a reboot is not acceptable.

### B3 · The existing JWT secret

```bash
PID=$(pm2 jlist | python3 -c 'import json,sys;[print(p["pid"]) for p in json.load(sys.stdin) if p["pm2_env"]["status"]=="online"]' | head -1)
sudo tr '\0' '\n' < /proc/$PID/environ | grep -c '^JWT_SECRET='
ls -la /var/www/courtaccess/.env 2>/dev/null
sudo grep -c 'JWT_SECRET' /var/www/courtaccess/.env 2>/dev/null
```

**Why:** the audit could not read the running environment. `JWT_SECRET` signs
every access and refresh token. Deploying with a **new** secret invalidates
every existing session and signs out every user at cut-over.

**Expected:** the count is `1` — the variable is set somewhere you can carry
forward. The commands print only a count, never the value.

**Blocks if:** it cannot be found. You would be forced to generate a new one,
which is survivable — everyone signs in again — but it must be a decision
rather than a surprise.

### B4 · Which nginx file holds the site configuration

```bash
sudo nginx -T | grep -n 'server_name.*courtaccess'
sudo nginx -T | grep -nE '^\s*(root|client_max_body_size|proxy_pass)' | head -20
```

**Why:** the audit measured `client_max_body_size` at 1 MB from outside but
cannot say which file sets it. That directive must be raised to 64 MB or **every
8 MB upload chunk is rejected with 413**, and the static `root` must be
repointed at the new release.

**Expected:** one server block for `courtaccess.net`, with a `root` under
`/var/www/courtaccess` and a `proxy_pass` to `127.0.0.1:3000`. Note the file
path each directive comes from.

**Blocks if:** the configuration is spread across several server blocks or
included from an unexpected path. Editing the wrong one silently changes
nothing, and you would discover it when Case 001's first chunk returned 413.

### B5 · Whether a database already exists, and its state

```bash
sudo -u postgres psql -lAt | cut -d'|' -f1
sudo -u postgres psql -d courtaccess -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
sudo -u postgres psql -d courtaccess -tAc "select to_regclass('public._prisma_migrations') is not null;"
sudo -u postgres psql -d courtaccess -tAc "select count(*), count(*) filter (where finished_at is null) from _prisma_migrations;"
sudo -u postgres psql -d courtaccess -tAc "select pg_size_pretty(pg_database_size('courtaccess'));"
```

**Why:** the migration chain was rehearsed against an **empty** database, where
it applies cleanly and produces 116 tables. Against a populated production
database it is unrehearsed. If `_prisma_migrations` is missing, Prisma will
treat every migration as pending and attempt to create tables that may already
exist.

**Expected:** the database exists, `_prisma_migrations` is present, and the
unfinished count is `0`.

The first command lists the database names; the rest assume it is called
`courtaccess`. If the first command shows a different name, substitute it. If it
shows no application database at all, that is A2 failing rather than B5 —
there is nothing to migrate.

**These commands assume PostgreSQL runs on the EC2 instance.** `sudo -u postgres
psql` connects over the local socket as a superuser, and fails outright if
`DATABASE_URL` points at RDS or any external host — which would read as "no
database" and be exactly the wrong conclusion. Use the `psql "$DATABASE_URL"`
forms in [`DATABASE_CERTIFICATION.md`](DATABASE_CERTIFICATION.md) instead; they
are correct either way.

**Blocks if:** tables exist but `_prisma_migrations` does not.

**Corrected by Program 165.** I originally wrote that Prisma would fail partway
and leave a half-migrated schema, and that baselining was the fix. Both were
wrong. `migrate deploy` aborts with `P3005` before executing any DDL, so nothing
is modified — but the RC then cannot run at all, and **baselining is the one
action here capable of causing unrecoverable damage**, because it records 30
migrations as applied without creating any of their tables. Run the read-only
schema diff in [`DATABASE_CERTIFICATION.md`](DATABASE_CERTIFICATION.md) first.

**Also blocks if:** the unfinished count is non-zero. A previous migration was
interrupted and must be resolved first.

### B6 · A verified backup exists before you touch anything

```bash
ls -lht /var/backups/*.dump /var/backups/*.sql* 2>/dev/null | head -5
crontab -l 2>/dev/null | grep -iE 'pg_dump|backup'
sudo -u postgres pg_dump --version
```

**Why:** rollback of the application is a three-second `pm2 resurrect`, but
rollback of the *database* requires a dump. The audit could not determine
whether any backup exists.

**Expected:** a recent dump, or at minimum `pg_dump` available so section 4 of
the execution procedure can take one.

**Blocks if:** `pg_dump` is unavailable **and** no backup exists. Deploying with
no way to restore the database is not a risk worth taking for a platform holding
privileged discovery.

---

## Group C — Will Case 001 actually work?

These do not block the deployment but block the upload it exists for.

### C1 · Outbound HTTPS to the Legislature

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 \
  'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.'
```

**Why:** every charged statute is retrieved from leginfo on demand. This was
reachable from my environment but the host's egress rules are unknown — many
EC2 security groups restrict outbound traffic.

**Expected:** `200`.

**Blocks Case 001 if:** unreachable. Charges would resolve to nothing, and
CALCRIM, mens rea and evidence coverage would all report the statute as
unavailable. The upload would succeed; the analysis would be empty.

### C2 · ffmpeg

```bash
command -v ffprobe && ffprobe -version | head -1
```

**Why:** media durations are measured with ffprobe, and silent-recording
detection uses ffmpeg's volumedetect.

**Expected:** present.

**Degrades if absent:** video and audio durations report as unknown, and a muted
body-camera recording cannot be told apart from one that simply has not been
transcribed. That distinction matters to counsel — one is a disclosure issue.
Not a blocker, but install it before Case 001 if you can.

### C3 · Where uploads will be written, and whether the service can write there

```bash
PID=$(pm2 jlist | python3 -c 'import json,sys;[print(p["pid"]) for p in json.load(sys.stdin) if p["pm2_env"]["status"]=="online"]' | head -1)
ps -o user= -p $PID
sudo tr '\0' '\n' < /proc/$PID/environ | grep -E '^(CERTIFICATION_STAGING_DIR|EVIDENCE_UPLOAD_DIR)='
ls -ld /var/lib/courtaccess /var/lib/courtaccess/staging /var/lib/courtaccess/evidence 2>/dev/null
```

**Why:** chunks are assembled in the staging directory and ingested files land
in the evidence directory. Both must be writable by the user PM2 runs as, and
both must sit **outside** the release directory — otherwise the next deployment
deletes uploaded discovery.

**Expected:** the service user identified, and either the directories exist and
are owned by that user, or they do not exist yet and will be created by section
5 of the execution procedure.

**Blocks Case 001 if:** the directories exist inside `/var/www/courtaccess` and
already contain data. Moving them is then part of the deployment, not an
afterthought.

### C4 · Certbot renewal

```bash
sudo certbot certificates
systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

**Why:** the audit observed the certificate expiring **9 August 2026** — renewal
has not run in at least 28 days. `--dry-run` performs a full renewal against the
staging endpoint and writes no certificate, so it is safe.

**Expected:** the dry run succeeds.

**Blocks everything if:** the dry run fails. Once the certificate lapses, Safari
refuses the site entirely and Peter cannot reach the portal at all. **This is
the most urgent item in this document and is independent of the deployment.**

---

## Order of execution

```
A1  node --version                     ─┐
A2  PostgreSQL present                  │  stop here if any fail
A3  Redis present                       │  nothing later matters
A4  disk space                         ─┘

B1  PM2 process name and mode          ─┐
B2  PM2 boot unit                       │  determines whether cut-over
B3  JWT secret present                  │  and rollback are safe
B4  nginx configuration file            │
B5  database state                      │
B6  backup capability                  ─┘

C4  certbot renewal   ← run this first in practice; it is the live incident
C1  leginfo reachable                  ─┐
C2  ffmpeg                              │  determines whether Case 001
C3  upload directories                 ─┘  will work once deployed
```

C4 is listed last by category but should be **run first in wall-clock time**.
The certificate expires in two days and that is happening whether or not
anything is deployed.

[`audit-production.sh`](audit-production.sh) collects most of the above in one
pass, if you would rather not run twenty commands by hand. It does **not**
include two of them, deliberately:

- `certbot renew --dry-run` (C4) — it makes live network calls, so it should be
  a decision rather than a side effect of running an audit script
- `pm2 startup` (B2) — it prints an installation command, and seeing that
  printed output in context matters

Run those two yourself. Note also that the script does not use `sudo`, so run
it as the user PM2 belongs to; several checks above need `sudo` and are marked
accordingly.

---

## UNKNOWNs that do not block

Recorded so they are not mistaken for blockers, and so nobody later believes
they were verified.

| UNKNOWN | Why it does not block |
|---|---|
| Stripe configuration | Billing is inert without it; nothing else depends on it |
| AWS S3 / object storage | Evidence writes to local disk; remote storage has never been exercised by this platform |
| SES / SMTP | Verification mail and invitations will not send; no other function depends on it |
| OpenAI / Anthropic / Google AI keys | No certification suite has ever exercised these |
| Twilio | Unused |
| Cloudflare | Observed absent; the host serves directly and correctly |
| Speech-to-text | Not implemented at all — nothing spoken in a recording is searchable, by design |
| Compression of the JS bundle | Performance only; observed absent |
| `Cache-Control` on static assets | Performance only; `ETag` is present so correctness is unaffected |

---

## What is already verified and needs no further checking

From Programs 160 and 161, so you do not re-verify what is settled:

- The bundle builds reproducibly — SHA-256 `c67b92e75b2be…`, identical across
  clean rebuilds
- It runs with **no TypeScript present anywhere** — proven by deleting every
  `.ts` outside `node_modules` and starting it
- `prisma/` is not needed at runtime; `node_modules` is
- It runs under PM2 in the production layout on port 3000, survives
  `pm2 save` / `resurrect`, recovering in 3 seconds
- 116 of 116 browser checks pass against the bundled artifact behind nginx
- The migration chain applies cleanly from an empty database, 116 tables, no
  drift

The one thing still untested anywhere is **Safari**, which no command on the
host can settle — it needs a browser.
