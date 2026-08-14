# CourtAccess Version 1.0 — Operations Manual

Written for an engineer with no prior knowledge of this project. Programs
189–193 consolidated: failure modes, monitoring, procedures, acceptance, and
disaster recovery.

Commands here were verified against a real PostgreSQL 16 and PM2 7.0.3 unless
marked **[UNVERIFIED ON HOST]**, which means the command is correct in form but
has never been run on the production machine.

---

## 0 · What this system is, in one page

A Fastify API bundled by esbuild into a single file, `dist/index.js`, run by PM2
from `/var/www/courtaccess`. nginx terminates TLS and proxies `/api` to
`127.0.0.1:3000`, serving the React frontend from `dist/public`. Data lives in
PostgreSQL via Prisma — 116 tables, 30 migrations.

**Three facts that will save you an hour each.**

**Node reads `.env`, and nothing else may.** There is no `dotenv` in the bundle;
the environment arrives because PM2 starts the process with
`--env-file=/var/www/courtaccess/.env`, which Node applies itself at every
spawn. Editing `.env` and restarting is therefore enough, and is the only
supported way to change configuration.

What breaks this is putting the same variables in your shell. Node's
`--env-file` does **not** replace a variable that is already set — the inherited
value wins — so anything PM2 snapshotted from a shell outranks the file
permanently, including after `pm2 save` and a reboot. That is what caused a
578-restart crash loop here. Do not `set -a; . .env; set +a` before a PM2
command, and do not use `--update-env`. If you need `DATABASE_URL` for `psql`,
read it in a subshell so it never reaches the PM2 client:

```bash
export PGURL="$(set -a; . /var/www/courtaccess/.env; set +a; echo "${DATABASE_URL%%\?*}")"
```

**Secrets do not appear in `/proc/<pid>/environ`, and that is correct.**
`--env-file` values are loaded inside the process; `/proc` shows only what was
handed to it at exec. Absence there is the evidence that PM2 is not holding a
copy. `ps` is no better: PM2 rewrites `process.title`, so even `--env-file`
itself disappears from the command line. Use `pm2 jlist` for the arguments.

**`psql` cannot use `DATABASE_URL` directly.** Prisma's URL ends in
`?schema=public`, which psql and pg_dump reject with
`invalid URI query parameter: "schema"`. Strip it:

```bash
set -a; . /var/www/courtaccess/.env; set +a
export PGURL="${DATABASE_URL%%\?*}"
```

Prisma commands take `DATABASE_URL`. Everything else takes `PGURL`.

**`/api/health` cannot tell you the system works.** It returns a literal and
does no I/O — correct for a supervisor deciding whether to restart, useless as
evidence. Use `/api/health/ready`. A stub returning `{"status":"ok"}` is exactly
how a completely non-functional deployment went unnoticed for six weeks here.

---

## 1 · Failure modes by subsystem  *(Program 189)*

Classification: **Self-healing** recovers with no action · **Recoverable** needs
a restart or retry · **Manual** needs a human decision · **Fatal** means data
loss or an outage until repaired.

### Startup

| Failure | Detection | Symptom | Log | Class |
|---|---|---|---|---|
| Missing required secret | Startup validator, before binding | Process exits 1, PM2 restart loop | `[Startup] FAILED — n fatal` naming the variable and remedy | **Recoverable** |
| Node below 22 | Validator | Exits 1 | `node version … bundle targets node22` | **Manual** — upgrade Node |
| Database unreachable | `schemaAssert` `SELECT 1` | Exits 1, restart loop | `[Schema Assert] Database unreachable` | **Recoverable** |
| Pending migrations / drift | `enforceSchemaOnBoot` | Exits 1 | Names each pending migration and `npx prisma migrate deploy` | **Manual** |
| Port already in use | Fastify listen | Exits 1 | `EADDRINUSE` | **Recoverable** |
| Wrong `PORT` | None at startup | **502 through nginx while the process looks healthy** | Nothing | **Manual** — the validator warns if not 3000 |

**No permanent data loss is possible during startup.** Every failure is
pre-service.

### Upload and chunk assembly

| Failure | Detection | Symptom | Class |
|---|---|---|---|
| Network interruption mid-chunk | Offset mismatch on the next chunk | 409 telling the browser where to resume | **Self-healing** |
| Duplicate chunk (client retry) | Per-file lock plus offset check | 409; exactly one chunk is applied | **Self-healing** |
| Truncated transfer | Final-size check | 422 `needs to be sent again` | **Recoverable** |
| Overrun | Size check during and at completion | 422 `Overrun` | **Recoverable** |
| Missing `totalSize` | Route validation | 400 naming the field | **Recoverable** |
| Disk full mid-upload | Write error | 500, partial file unlinked | **Recoverable** |
| Path traversal attempt | Resolved-path containment | 400 `Invalid filename` | **Self-healing** |
| **Server restart mid-upload** | None | Staged chunks survive under the staging dir; resume is **untested** | **Manual** |

**Permanent data loss risk: one.** If `EVIDENCE_UPLOAD_DIR` points inside
`/var/www/courtaccess`, the next deployment destroys uploaded discovery. The
startup validator now refuses to boot in production if the variable is unset,
which closes the default case. **It cannot catch a variable deliberately set to
a path inside the release** — verify after the first upload (§3).

### Ingestion and OCR

| Failure | Detection | Symptom | Class |
|---|---|---|---|
| Unsupported file type | Extension allowlist | 415 listing supported formats | **Self-healing** |
| Corrupt or encrypted PDF | Extraction throws | `processingStatus: 'failed'` with a user-facing message | **Recoverable** |
| Extraction exceeds 60 s | Per-item timeout | Marked failed | **Recoverable** |
| OCR worker crash | `errorHandler` at `evidenceDirectUpload.ts:286` | Warning logged; the API survives | **Self-healing** |
| **jsDelivr unreachable** | **None** | "No text could be recognised" — **identical to a blank page** | **Manual** |
| Status update fails after a processing failure | Logged | Record stuck at `ingesting` | **Manual** |

**The jsDelivr row is the most dangerous entry in this manual.** OCR downloads
its 10.9 MB language model from `cdn.jsdelivr.net` on first use, because no call
site sets `langPath`. If egress is blocked, every scanned page reports no text —
and a scanned page that genuinely is blank reports the same thing. That is
incomplete legal analysis presented as complete. **Verify before the first
upload** (§3).

### Timeline, contradictions, CALCRIM

| Failure | Detection | Symptom | Class |
|---|---|---|---|
| More than 200 evidence items | Cap at `timelineReconstructionService.ts:108` | Warning in `warnings[]`; timeline covers 200 | **Manual** |
| Pipeline exceeds 5 minutes | Deadline check before each item | Warning; remaining items skipped | **Manual** |
| leginfo unreachable | 30 s timeout | Statute unavailable; CALCRIM and mens rea report UNKNOWN | **Recoverable** |
| CALCRIM mapping absent | Lookup miss | Reports UNKNOWN — by design | **Self-healing** |

**Neither cap re-runs automatically.** With `DISABLE_WORKERS=true` the only
automatic caller is the single inline run during certification. A capped run
stays capped until someone calls `POST /api/timeline/rebuild/:caseId`.
**Always read `warnings[]` before treating a timeline as complete.**

### Shutdown, restart, deployment, rollback

| Failure | Detection | Symptom | Class |
|---|---|---|---|
| In-flight request during reload | — | Drains cleanly; 30 s deadline then forced exit | **Self-healing** |
| Reload with wrong environment | Post-reload env check | 502, or silent session loss if `JWT_SECRET` vanished | **Manual** |
| Migration fails mid-chain | Prisma exits non-zero | Deployment stops | **Manual** — restore the dump |
| `P3005` non-empty schema | Prisma refuses | Nothing modified | **Manual** — do **not** baseline blindly |
| PM2 does not survive reboot | Reboot test | Service gone after restart | **Manual** |
| Corrupt release copy | Checksum mismatch | Caught before cut-over | **Recoverable** |

---

## 2 · Procedures  *(Program 191)*

Always start with:

```bash
export APP=/var/www/courtaccess
export PM2_NAME=<name from `pm2 list`>

# In a subshell: these variables must not be in the environment when you run a
# PM2 command, or PM2 snapshots them and they outrank .env from then on.
export PGURL="$(set -a; . "$APP/.env"; set +a; echo "${DATABASE_URL%%\?*}")"
```

### Start, stop, restart

```bash
pm2 list                                    # what is running
pm2 start "$APP/dist/index.js" --name "$PM2_NAME" --cwd "$APP" \
  --interpreter "$NODE22" --node-args="--env-file=$APP/.env"
pm2 stop "$PM2_NAME"
pm2 reload "$PM2_NAME"                      # drains in-flight requests, ~2.2 s
pm2 restart "$PM2_NAME"                     # harder; use if reload does not pick up changes
pm2 save                                    # persist the process list for reboot
pm2 logs "$PM2_NAME" --lines 100 --nostream
```

Logs: `~/.pm2/logs/<name>-out.log` and `-error.log`.

**Never `--update-env`.** It copies your current shell's environment over the
process's, which is how the environment stops being a function of `.env`. A
plain `pm2 restart` is enough: Node re-reads the file on the new spawn. After
an `.env` change, restart and then confirm the new value took:

```bash
pm2 restart "$PM2_NAME"
(env -i "$NODE22" --env-file="$APP/.env" -p 'process.env.PORT')   # what the next spawn sees
```

To confirm PM2 is not holding a copy of anything, and that the deployment would
survive a reboot:

```bash
bash deploy/stages/verify-restart-survival.sh
```

### Verify a deployment took

```bash
curl -s https://courtaccess.net/api/health        # commit field must match what you deployed
curl -s https://courtaccess.net/api/health/ready  # must be "healthy"
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -d '{"email":"x@y.z","password":"wrong"}' https://courtaccess.net/api/auth/login
```

**401 on that login means the new build is live. 404 means the old stub still
is.** That is the single clearest signal.

### Roll back the application

```bash
sudo mv "$APP/dist" "$APP/dist.failed" && sudo mv "$APP/dist.previous" "$APP/dist"
sudo mv "$APP/node_modules" "$APP/node_modules.failed" && sudo mv "$APP/node_modules.previous" "$APP/node_modules"
set -a; . ~/rollback/env.backup; set +a          # the OLD environment, not the new one
pm2 reload "$PM2_NAME" --update-env
```

Measured at ~1.2 s downtime. If PM2 itself is unhealthy:

```bash
pm2 delete "$PM2_NAME"; cp ~/rollback/dump.pm2.rollback ~/.pm2/dump.pm2; pm2 resurrect
```

### Back up and restore the database

```bash
# Backup — verified round trip
pg_dump "$PGURL" -Fc -f ~/rollback/db-$(date +%F-%H%M).dump
pg_restore -l ~/rollback/db-*.dump | head        # must list objects, or it is not a backup

# Restore — destructive, only when abandoning a deployment
psql "$PGURL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"
pg_restore -d "$PGURL" --clean --if-exists ~/rollback/db-<stamp>.dump
psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"   # expect 116
```

### Back up and restore uploads

```bash
tar czf ~/rollback/evidence-$(date +%F).tar.gz -C "$(dirname "$EVIDENCE_UPLOAD_DIR")" "$(basename "$EVIDENCE_UPLOAD_DIR")"
tar tzf ~/rollback/evidence-*.tar.gz | head      # verify before trusting it
# Restore
tar xzf ~/rollback/evidence-<stamp>.tar.gz -C "$(dirname "$EVIDENCE_UPLOAD_DIR")"
```

**Evidence on disk and evidence rows in the database must be restored
together.** A database restored to an earlier point references files that may no
longer exist, and vice versa. Restore both from the same timestamp.

### Renew the certificate

```bash
sudo certbot renew --dry-run          # proves it can
sudo certbot renew                    # does it
sudo nginx -t && sudo systemctl reload nginx     # REQUIRED — see below
echo | openssl s_client -servername courtaccess.net -connect courtaccess.net:443 2>/dev/null \
  | openssl x509 -noout -dates -serial
```

**The reload is not optional.** On 7 August the certificate was issued at
22:08:53 and browsers were still receiving the old one at 23:02 — nginx serves
the certificate it loaded at start. `certbot certificates` reported success the
whole time. **Verify from outside, and treat the serial as the signal.**

### Rebuild Prisma and the release

```bash
cd "$APP" && npx prisma generate                 # after a Prisma version change
cd /opt/courtaccess-build/src && git pull && unset NODE_ENV && bash deploy/build-release.sh /opt/courtaccess-build/out
sha256sum /opt/courtaccess-build/out/dist/index.js
```

### Clear disk

In order of safety. **Never delete from the evidence directory.**

```bash
pm2 flush                                        # PM2 logs
sudo journalctl --vacuum-time=7d
find /var/tmp/courtaccess-certification-staging -type d -mtime +7    # review, then remove abandoned staging
sudo rm -rf "$APP"/dist.failed "$APP"/node_modules.failed            # after a verified deployment
sudo rm -rf /opt/courtaccess-build                                   # build scratch
```

### Recover interrupted work

**Interrupted upload** — staged chunks persist. Re-drive the same upload from
the portal; the server answers each chunk with the offset it actually holds.
Resume across a *server restart* is untested.

**Failed OCR** — check whether jsDelivr is reachable first (§3). Then re-upload
the affected file; per-file status is in `processingStatus`.

**Capped timeline** — `POST /api/timeline/rebuild/:caseId`, repeatedly, until
`warnings[]` is empty and the event count stops changing.

**Failed OpenAI request** — no retry exists. The CPRA classifier falls back to
heuristics only when the key is *absent*, not when a call fails. Re-run the
operation.

---

## 3 · Monitoring checklists  *(Program 190)*

### Before every upload — the two that matter most

```bash
curl -s -o /dev/null -w 'jsDelivr (OCR model): %{http_code}\n' --max-time 25 \
  https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz
curl -s -o /dev/null -w 'leginfo (statutes):   %{http_code}\n' --max-time 25 \
  'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.'
curl -s https://courtaccess.net/api/health/ready
```

Both must be **200**. If jsDelivr is not, OCR will silently report every scanned
page as blank. If leginfo is not, charges resolve to nothing.

### After every upload

```bash
du -sh "$EVIDENCE_UPLOAD_DIR"
sudo du -sh "$APP/uploads/evidence" 2>/dev/null || echo "nothing in the app directory — correct"
psql "$PGURL" -tAc "select processing_status, count(*) from evidence group by 1;" 2>/dev/null \
  || psql "$PGURL" -tAc "select \"processingStatus\", count(*) from evidence group by 1;"
```

Files must appear in the configured directory and **not** under `$APP`. Any
evidence stuck at `ingesting` is a failure whose status update did not land.

Then, in the interface: read `warnings[]` on the certification result before
believing any count.

### Daily

`pm2 list` — status online, restart counter unchanged · `/api/health/ready`
healthy · disk above 10 GB · `grep -c ERROR ~/.pm2/logs/*-error.log`

### Weekly

Certificate expiry above 21 days · `pg_restore -l` on the newest dump ·
database size trend · evidence directory size trend · `pm2 save` current

### Monthly

`sudo certbot renew --dry-run` · restore a dump into a scratch database and
count 116 tables · review `warnings[]` across recent certifications · confirm
the PM2 boot unit still exists

### At deployment

The full sequence is in [`RUNBOOK.md`](RUNBOOK.md). The four gates: artifact
checksum matches · migrations report `30/30 applied` · validator all PASS ·
login returns 401 rather than 404.

---

## 4 · Production acceptance test  *(Program 192)*

One Case 001 upload, every stage observable. Record PASS or FAIL for each; no
stage may be skipped or assumed.

| # | Stage | How to observe | PASS |
|---|---|---|---|
| 1 | Login | Sign in as Administrator | Session established |
| 2 | Portal reachable | Administration → Gold Standard Certification | Page lists corpora, no `jwt expired` |
| 3 | Chunk upload | Progress UI advances | Bytes climb, no 413 |
| 4 | Chunk assembly | Inventory file sizes | Each matches the source exactly |
| 5 | Hashing | Inventory SHA-256 column | Every file has one; none empty |
| 6 | Duplicate detection | Inventory | Duplicates flagged, not double-counted |
| 7 | OCR | Open a scanned page | **Text present.** Empty = FAIL, check jsDelivr |
| 8 | Ingestion | Evidence status | `analyzed`; none stuck at `ingesting` |
| 9 | Statutory retrieval | Open a charge | Official title and text from leginfo |
| 10 | CALCRIM | Charge view | Instruction mapped, or explicit UNKNOWN |
| 11 | Timeline | Timeline view | Events present, **and `warnings[]` empty** |
| 12 | Contradictions | Contradictions view | Each cites two sources |
| 13 | Database persistence | Reload the page | Everything survives |
| 14 | Search | Search a known phrase | Returns the document |
| 15 | Report | Generate certification report | Produced, **git commit non-null** |
| 16 | Audit trail | Audit view | Upload and user recorded |
| 17 | Cleanup | `du -sh` staging | No unbounded growth |
| 18 | Stability | `pm2 list` | Restart counter unchanged throughout |

**Stage 11 is the one most likely to pass falsely.** A timeline with events looks
successful whether or not it covers the whole corpus. Empty `warnings[]` is the
PASS condition, not a non-zero event count.

---

## 5 · Disaster recovery  *(Program 193)*

Design only. **Not drilled on this host.**

| Scenario | Sequence | Expected downtime | Needs |
|---|---|---|---|
| **Server loss** | New instance → Node 22, PM2, nginx, PostgreSQL → restore DB dump → restore evidence tarball → deploy release → certbot → DNS | **Hours.** Bounded by evidence restore size | DB dump, evidence tarball, `.env`, nginx config |
| **Database corruption** | Stop PM2 → `pg_restore --clean` → verify 116 tables → start | 15–60 min | Recent verified dump |
| **Disk failure** | Restore from snapshot, or rebuild as server loss | Hours | EBS snapshot or backups |
| **Filesystem corruption** | `fsck` → verify evidence hashes against the database → restore missing | Hours | Evidence tarball |
| **Expired certificate** | `certbot renew` → **reload nginx** → verify serial | Under 10 min | Port 80 reachable |
| **PM2 failure** | `pm2 resurrect`, or start explicitly and `pm2 save` | Under 5 min | `dump.pm2` backup |
| **nginx failure** | `nginx -t` → fix → reload; restore config from backup | Under 10 min | nginx config backup |
| **PostgreSQL outage** | Service restart; app crash-loops until it returns, then recovers | Duration of the outage | — |
| **OpenAI outage** | No action. Not on the Case 001 path | None | — |
| **Upload interruption** | Re-drive the upload; server reports true offsets | None | — |

**Verification after any recovery**, in this order:

```bash
psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"   # 116
curl -s https://courtaccess.net/api/health          # commit matches expectation
curl -s https://courtaccess.net/api/health/ready    # healthy
du -sh "$EVIDENCE_UPLOAD_DIR"                       # evidence present
```

Then re-run the §4 acceptance test. A recovery that restores the service but not
the evidence is not a recovery.

**The gap worth naming:** the database and the evidence files are backed up
separately and there is no mechanism keeping them consistent. Restoring a
database from Monday alongside evidence from Wednesday produces rows pointing at
files that exist and files nothing points at. Always restore both from the same
timestamp, and verify by comparing evidence row count against files on disk.

---

## 6 · Emergency reference

| | |
|---|---|
| Host | `44.209.225.79` · `courtaccess.net` |
| App root | `/var/www/courtaccess` |
| Entry point | `dist/index.js`, PM2, port 3000 |
| Logs | `~/.pm2/logs/<name>-{out,error}.log` |
| Rollback assets | `~/rollback/` |
| Certificate expiry | **5 November 2026** |
| Escalation | Owner (Peter). No on-call rotation exists. |

**Stop and think before:** `prisma migrate resolve --applied` — it marks
migrations applied without running them and is the only unrecoverable action
here · deleting anything under the evidence directory · `pm2 delete` without a
saved dump · restoring a database without matching evidence.
