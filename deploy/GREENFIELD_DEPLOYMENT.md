# Greenfield production deployment — CourtAccess Version 1.0

Supersedes the in-place model in [`RUNBOOK.md`](RUNBOOK.md) for this deployment.

## Why the topology changed

`/var/www/courtaccess` is a valid checkout of `Sailors071968/Court_Access`, but
it sits on **`phase10q-discovery-stabilization`, a branch that does not exist on
the remote** — `git fetch origin phase10q-discovery-stabilization` returns
`fatal: couldn't find remote ref`. Its history has **no common ancestor** with
`origin/dev` (`git merge-base` exits 1), and `origin/dev` shares its root commit
`31200588…` with the Release Candidate.

So the repository contains two disjoint lineages, and production is on the one
that was never pushed. Commit `322e5b9` and 5,693 tracked modifications exist
**only on that host**.

Three consequences, and they drive every decision below:

**Nothing can be merged or compared.** Disjoint histories have no shared base, so
there is no diff to reason about and no upgrade path. This is a replacement, not
an upgrade.

**The existing installation is irreplaceable until it is backed up.** Unpushed
work on an unpushed branch has no second copy.

**The existing database almost certainly belongs to the other lineage.** The
Release Candidate must not migrate it. Greenfield means a new database too.

I earlier concluded "different repository". That was wrong in letter — same
remote — and right in substance: the code lineage is disjoint and nothing about
it is comparable to the Release Candidate.

---

# STAGE 0 — Preserve what exists  **do this first**

Nothing else in this document matters if the host is lost before this is done.

```bash
cd /var/www/courtaccess

# 1. Push the orphan branch so it exists somewhere other than this machine.
git bundle create ~/courtaccess-phase10q-$(date +%F).bundle --all
ls -lh ~/courtaccess-phase10q-*.bundle

# 2. Capture the 5,693 uncommitted modifications as a patch.
git diff > ~/courtaccess-worktree-$(date +%F).patch
git status --porcelain > ~/courtaccess-status-$(date +%F).txt
wc -l ~/courtaccess-worktree-*.patch ~/courtaccess-status-*.txt

# 3. And the whole directory, which captures untracked files the patch misses.
sudo tar czf ~/courtaccess-full-$(date +%F).tar.gz -C /var/www courtaccess
ls -lh ~/courtaccess-full-*.tar.gz
```

### Verify before continuing

```bash
git bundle verify ~/courtaccess-phase10q-*.bundle
tar tzf ~/courtaccess-full-*.tar.gz | wc -l
```

**Expected:** the bundle reports it is okay, and the tar lists a plausible file
count. **Do not proceed until both succeed.** Then copy all three off the host —
S3, another machine, anywhere that is not this instance.

**Consider also** pushing the branch to the remote so it stops being a
single-copy artifact:

```bash
git push origin phase10q-discovery-stabilization
```

That is a write to GitHub, not to production, and it is the only durable fix for
work that exists on one disk.

---

# STAGE 1 — Prerequisites  *(read-only)*

```bash
node --version                 # must be v22 or later
pm2 --version
nginx -v
psql --version
df -h /var /opt
free -h
```

**Stop if** Node is below 22 — the bundle is compiled `--target=node22`.

Note the free space: the new installation needs roughly **1.5 GB** during build
and **600 MB** afterwards, and it must coexist with the existing one.

---

# STAGE 2 — Fresh checkout and build  *(touches nothing in production)*

The new installation lives at `/var/www/courtaccess-v1`. The existing directory
is not read, written, moved, or renamed at any point.

```bash
export V1=/var/www/courtaccess-v1
sudo mkdir -p "$V1" && sudo chown "$(whoami)":"$(whoami)" "$V1"

# Build in scratch, install into $V1. Keeps the build tree out of the release.
sudo mkdir -p /opt/courtaccess-build && sudo chown "$(whoami)":"$(whoami)" /opt/courtaccess-build
cd /opt/courtaccess-build
git clone --branch cursor/gold-standard-upload-portal-9f94 \
  https://github.com/Sailors071968/Court_Access.git src
cd src && git rev-parse HEAD
unset NODE_ENV
bash deploy/build-release.sh "$V1"
```

### Verify

```bash
cd "$V1"
sha256sum dist/index.js
cat dist/build-info.json
find . -name '*.ts' -not -path './node_modules/*' | wc -l
ls -d prisma/migrations/*/ | wc -l
ls dist/public/index.html
```

**Expected:** checksum `c3f5f6f03399b594f4465db2067ba7219b7717335fd8f43355473d47d35ad227`,
`0` TypeScript files, `30` migrations, `index.html` present.

**Stop if the checksum differs** while the commit matches — the build is not
reproducing.

### Rollback for this stage

```bash
sudo rm -rf /var/www/courtaccess-v1 /opt/courtaccess-build
```

---

# STAGE 3 — A new database

**Do not migrate the existing database.** It belongs to the other lineage; the
Release Candidate's 30 migrations would either be refused (`P3005`) or, if
forced, would damage an application that is not this one.

First, confirm what is there — read-only:

```bash
sudo -u postgres psql -lAt | cut -d'|' -f1
```

Then create a separate database:

```bash
sudo -u postgres createdb courtaccess_v1 -O "$(sudo -u postgres psql -tAc "select rolname from pg_roles where rolcanlogin and rolname <> 'postgres' limit 1")"
sudo -u postgres psql -tAc "select datname from pg_database where datname='courtaccess_v1';"
```

**Expected:** `courtaccess_v1`.

**If a dedicated role is needed instead**, create it explicitly rather than
reusing whatever the other application uses:

```bash
sudo -u postgres createuser courtaccess_v1 --pwprompt
sudo -u postgres psql -c "ALTER DATABASE courtaccess_v1 OWNER TO courtaccess_v1;"
```

### Rollback

```bash
sudo -u postgres dropdb courtaccess_v1
```

Harmless — nothing else uses it.

---

# STAGE 4 — Configuration

```bash
sudo -e "$V1/.env"
```

Contents, with **your** values:

```
NODE_ENV=production
PORT=3100
HOST=127.0.0.1
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/courtaccess_v1?schema=public
JWT_SECRET=<random, at least 32 characters>
JWT_REFRESH_SECRET=<random, at least 32 characters>
COOKIE_SECRET=<random, at least 32 characters>
FRONTEND_URL=https://courtaccess.net
DISABLE_WORKERS=true
CERTIFICATION_STAGING_DIR=/var/lib/courtaccess-v1/staging
EVIDENCE_UPLOAD_DIR=/var/lib/courtaccess-v1/evidence
```

**`PORT=3100`, not 3000.** The new application runs alongside the old one on a
spare port for the whole of Stages 5 and 6. nginx is not touched until Stage 7,
so the live site is unaffected while the new installation is fully verified.

Because this is a new installation, the secrets are new. There are no existing
sessions to preserve — nobody can sign in to the current site anyway.

```bash
sudo chmod 600 "$V1/.env"
sudo mkdir -p /var/lib/courtaccess-v1/{staging,evidence}
sudo chown -R "$(whoami)":"$(whoami)" /var/lib/courtaccess-v1
```

### Verify

```bash
stat -c '%a' "$V1/.env"                      # 600
sudo grep -oE '^[A-Z_]+' "$V1/.env" | sort | tr '\n' ' '
ls -ld /var/lib/courtaccess-v1/{staging,evidence}
```

**Evidence and staging live outside the release directory** so a future
deployment cannot destroy uploaded discovery.

---

# STAGE 5 — Migrate the new database

```bash
cd "$V1"
set -a; . "$V1/.env"; set +a
export PGURL="${DATABASE_URL%%\?*}"          # psql rejects Prisma's ?schema=
echo "PORT=$PORT"                            # must print 3100
npx prisma migrate deploy
```

### Verify

```bash
psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
psql "$PGURL" -tAc "select count(*) filter (where finished_at is not null), count(*) filter (where finished_at is null) from _prisma_migrations;"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

**Expected:** `116` tables, `30 | 0`, and **`No difference detected.`**

### Rollback

```bash
sudo -u postgres dropdb courtaccess_v1 && sudo -u postgres createdb courtaccess_v1 -O <owner>
```

The old database is untouched throughout.

---

# STAGE 6 — Start and fully verify, still on port 3100

The live site is still served by the old installation. Nothing user-facing
changes in this stage.

```bash
cd "$V1"
set -a; . "$V1/.env"; set +a
pm2 start dist/index.js --name courtaccess-v1 --cwd "$V1" --update-env
sleep 10
pm2 list
```

### Verify — every check must pass before Stage 7

```bash
pm2 logs courtaccess-v1 --lines 60 --nostream | grep -E "^\[Server\]|^\[Startup\]|Schema Assert"
curl -s http://127.0.0.1:3100/api/health
curl -s http://127.0.0.1:3100/api/health/ready
curl -s -o /dev/null -w 'deep: %{http_code}\n' http://127.0.0.1:3100/api/health/deep
curl -s -o /dev/null -w 'login(bad creds): %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{"email":"a@b.c","password":"wrong"}' \
  http://127.0.0.1:3100/api/auth/login
```

**Expected:**

| Check | Must be |
|---|---|
| Build line | `CourtAccess 1.1.0 — <commit> … (from stamp)` |
| Validator | `[Startup] Configuration OK` |
| Schema guard | `Migrations: 30/30 applied` — **not** `no-migrations` / `0/0` |
| `/api/health` | `commit` matches `dist/build-info.json` |
| `/api/health/ready` | `healthy` |
| `/api/health/deep` | `200` |
| Login, bad credentials | `401` |
| `pm2 list` | `online`, restart count `0` |

Also confirm the two outbound dependencies before any upload:

```bash
curl -s -o /dev/null -w 'jsDelivr (OCR model): %{http_code}\n' --max-time 25 \
  https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz
curl -s -o /dev/null -w 'leginfo (statutes):   %{http_code}\n' --max-time 25 \
  'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.'
```

Both must be **200**. jsDelivr unreachable means OCR reports every scanned page
as blank, which is indistinguishable from a genuinely blank page.

### Rollback

```bash
pm2 delete courtaccess-v1
```

Production never saw this process.

---

# STAGE 7 — Cut over nginx  **the only user-visible change**

Everything to this point is reversible by deleting directories. This stage is
the deployment.

```bash
# Identify and back up the live server block.
sudo nginx -T | grep -n 'server_name.*courtaccess'
sudo cp <that file> ~/rollback/nginx-serverblock.backup
```

Change three things in that server block, and nothing else:

```nginx
    root /var/www/courtaccess-v1/dist/public;          # was /var/www/courtaccess/dist/public

    location /api {
        proxy_pass http://127.0.0.1:3100;              # was 3000
        client_max_body_size 64m;                      # was the 1 MB default
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
```

`client_max_body_size` matters as much as the port: at the default 1 MB, every
8 MB upload chunk is rejected with 413.

```bash
sudo nginx -t
```

**Stop if that fails.** Restore the backup and do not reload.

```bash
sudo systemctl reload nginx
```

### Verify immediately

```bash
curl -s https://courtaccess.net/api/health
curl -s https://courtaccess.net/api/health/ready
curl -s -o /dev/null -w 'login: %{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -d '{"email":"a@b.c","password":"wrong"}' https://courtaccess.net/api/auth/login
curl -s https://courtaccess.net/ | grep -o "CourtAccess build:[^<]*"
head -c 2000000 /dev/zero > /tmp/2mb.bin
curl -s -o /dev/null -w '2 MB POST: %{http_code}\n' -X POST --data-binary @/tmp/2mb.bin \
  https://courtaccess.net/api/health && rm -f /tmp/2mb.bin
```

**Expected:**

| Check | Must be | Why |
|---|---|---|
| `/api/health` | `commit` present and correct | The old stub returns no `commit` field at all |
| `/api/health/ready` | `healthy` | |
| Login, bad credentials | **401** | **404 means the old application is still answering** |
| Build stamp | the deployed commit | New frontend is being served |
| 2 MB POST | **404, not 413** | 404 means nginx passed the body upstream |

Watch the restart counter for five minutes:

```bash
sleep 300 && pm2 list
```

### Rollback for Stage 7 — under a minute

```bash
sudo cp ~/rollback/nginx-serverblock.backup <that file>
sudo nginx -t && sudo systemctl reload nginx
curl -s https://courtaccess.net/api/health
```

The old installation is still running on its original port, untouched, with its
own database. Reverting nginx restores it exactly.

---

# STAGE 8 — Persist across reboot

Only after Stage 7 has held for a while.

```bash
pm2 save
pm2 startup            # WITHOUT sudo — it prints the command to run
# run exactly what it prints
```

Then schedule a reboot test. A deployment that does not survive a restart is not
a deployment, and Case 001 should not be uploaded until it has.

```bash
sudo reboot
# after it returns:
curl -s https://courtaccess.net/api/health
pm2 list
```

---

# STAGE 9 — Case 001

Only after Stages 7 and 8 pass, and after Safari has been exercised by hand —
all 116 automated browser checks ran on Chromium, and the upload portal's folder
picker uses `webkitdirectory`, whose behaviour differs across engines.

Follow the acceptance test in [`OPERATIONS.md`](OPERATIONS.md) §4. The stage most
likely to pass falsely is the timeline: a non-zero event count looks like
success whether or not it covers the whole corpus. **Empty `warnings[]` is the
pass condition.**

---

# What is preserved, and for how long

| | Status during the deployment |
|---|---|
| `/var/www/courtaccess` | **Never touched.** Not read, moved, or renamed |
| Its database | **Never touched.** The new installation uses `courtaccess_v1` |
| Its PM2 process | Left running on its original port throughout |
| Orphan branch and 5,693 modifications | Bundled, patched and tarred in Stage 0 |

**Keep all of it until Version 1.0 has been validated in production**, meaning
Case 001 has completed and the platform has run for a week without incident.
Only then consider reclaiming the space, and take a final archive first.

Rollback at any stage is either deleting a new directory or restoring one nginx
file. Nothing in this plan is destructive to the existing installation.
