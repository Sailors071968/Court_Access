# Deployment failure modes

Every failure recorded here has been observed — in production, in a rehearsal, or
in a replica running a byte-identical artifact. Nothing is included because it
seemed possible. Where a mode was found by reasoning and then reproduced, the
reproduction is what earns it a place.

The **Evidence** column says where the observation comes from:

- `PROD` — observed on courtaccess.net
- `REPLICA` — reproduced against the release artifact with PostgreSQL 16, the
  30-migration schema and nginx
- `REHEARSAL` — observed while executing a procedure against the replica
- `CLEAN-ROOM` — observed while deploying from a fresh clone using only the docs

Classification: **Self-healing** recovers with no action · **Recoverable** needs a
restart or a fix and no data is lost · **Manual** needs a human decision ·
**Silent** produces no error at the moment it goes wrong, which makes it the most
expensive class.

---

## 1 · The process starts with no environment

| | |
|---|---|
| **Cause** | PM2's stored definition carries no `--env-file` and no environment of its own, so the process is spawned with nothing. Either the definition was created from a shell that had not sourced `.env` and predates `--env-file`, or a boot-time `pm2 resurrect` read a different `dump.pm2` than the one `pm2 save` wrote. |
| **Detection** | Restart counter climbing by tens per minute. `[Startup]` reporting `<unset>` for `NODE_ENV` and `not set` for the secrets. |
| **Symptoms** | Every `/api/*` request returns 502 in the same time a static page takes. `/` still returns 200, so the site looks up. `pm2 list` shows `online` throughout. |
| **Recovery** | `bash deploy/stages/stage3-start.sh` — recreates the definition with `--env-file` and withholds the variables from PM2's snapshot. Then `pm2 save`. |
| **Prevention** | `--env-file` in `node_args`, no application variables in PM2's snapshot, and `audit-deployment.sh` §9 asserting both in the saved definition. |
| **Class** | Recoverable — but it took three days to diagnose, for the reasons in §2 and §3. |
| **Evidence** | `PROD` — 578 restarts. `REPLICA` — reproduced: 4 → 13 → 22 → 32 restarts over 45 s, ~40/min, `status=online`, nothing bound on 3100. |

## 2 · A missing environment reports itself as a database fault

| | |
|---|---|
| **Cause** | The startup validator and the signing-key guard were both conditional on `NODE_ENV === 'production'`, and `NODE_ENV` lives in the environment they exist to check. With no environment, both concluded "development", downgraded four fatal conditions to warnings, and let the boot continue to the one check that is unconditional: the Prisma call. |
| **Detection** | The line `[Startup] n check(s) would be fatal in production … Continuing because NODE_ENV is not production`. Treat it as fatal whatever follows. |
| **Symptoms** | `[Schema Assert] ERROR: Database unreachable:`, `Server cannot start with drifted schema`, `Run: npx prisma migrate deploy`. The database was reachable and the schema was not drifted. The real cause, `Environment variable not found: DATABASE_URL`, is on the fourth line of a multi-line Prisma message whose first line is empty. |
| **Recovery** | Supply the environment. `prisma migrate deploy` does nothing for this. |
| **Prevention** | **Fixed.** `DATABASE_URL` is now a second signal: a process with neither it nor `NODE_ENV` was configured by nobody, so enforcement stays on and the validator stops the boot naming the variable. |
| **Class** | **Silent** — the error named the wrong subsystem with total confidence. |
| **Evidence** | `REPLICA` — traced with a `--import` preload. Before: 4 fatals waived, exit at 996 ms from `enforceSchemaOnBoot`. After adding only `NODE_ENV=production`: exit at 617 ms naming `JWT_SECRET`, database never contacted. |

## 3 · Redis noise misdirects the investigation

| | |
|---|---|
| **Cause** | With no environment, `DISABLE_WORKERS` is also unset, so five BullMQ workers start and dial `redis://localhost:6379` — the default when `REDIS_URL` is absent. The errors appear *before* the fatal one and in far greater volume. |
| **Detection** | `[Redis] Connection error (redis://localhost:6379): connect ECONNREFUSED`. If the target is `localhost` and Redis lives elsewhere, `REDIS_URL` is unset. |
| **Symptoms** | A log dominated by Redis errors during an outage Redis is not causing. Previously the line was `[Redis] Connection error:` with nothing after the colon, because a refused connection is an `AggregateError` whose own `message` is empty. |
| **Recovery** | None needed — it is a symptom. Set `DISABLE_WORKERS=true` when Redis is not deployed. |
| **Prevention** | Lazy connection; `startRedisMemoryMonitor()` returns immediately when workers are disabled; the error line now names the nested causes and the target. |
| **Class** | Silent, in the sense that it hides the real fault rather than being one. |
| **Evidence** | `PROD` — the original investigation. `REPLICA` — the monitor produced 8 error lines in 22 s with `DISABLE_WORKERS=true` before the guard was added, and 0 after. |

## 4 · `--env-file` is inert because PM2 holds a copy

| | |
|---|---|
| **Cause** | Node's `--env-file` does not replace a variable that is already set. `stage3-start.sh` used to export `.env` into its own shell before `pm2 start`, so PM2 snapshotted those values, injected them at every spawn, and the flag could never override them. |
| **Detection** | Application secrets present in `sudo tr '\0' '\n' < /proc/<pid>/environ`, or a non-zero count in `pm2 jlist`'s `pm2_env`. |
| **Symptoms** | None, until `.env` is edited and the change has no effect, or a reboot restores a stale value. The deployment looks correct because the snapshot and the file agree at first. |
| **Recovery** | Re-run `stage3-start.sh` from a shell that has not sourced `.env`; it strips them regardless. Then `pm2 save`. |
| **Prevention** | The stage removes the keys `.env` defines from the environment it hands PM2. The audit asserts zero secrets in both `/proc/<pid>/environ` and the PM2 definition. |
| **Class** | Silent. |
| **Evidence** | `REPLICA` — before: 4 secrets snapshotted; editing `.env` and restarting left the old value, which survived `pm2 save`, `pm2 kill` and `resurrect`. After: 0 snapshotted, and the process tracks the file across all of those. |

## 5 · The documented procedure produced the outage

| | |
|---|---|
| **Cause** | `deploy/README.md` is the obvious entry point and describes the Docker Compose stack. Its `.env.example` is the compose environment: `POSTGRES_USER`/`PASSWORD`/`DB`, from which compose synthesises `DATABASE_URL`. Copied into a PM2 release it yields a file with no `DATABASE_URL` at all. |
| **Detection** | The failure of §2, on a first deployment. |
| **Symptoms** | Identical to §1 and §2 — a crash loop blaming the database, on a host where nothing was ever misconfigured by hand. |
| **Recovery** | Use `env.release.example`. |
| **Prevention** | `env.release.example` exists; `DEPLOY_FROM_SCRATCH.md` is the single procedure; `README.md` says at the top which architecture it describes and what the other one needs. |
| **Class** | Manual — and the most dangerous kind, because following instructions caused it. |
| **Evidence** | `CLEAN-ROOM` — `cp .env.example .env` then boot, reproduced the production failure line for line. |

## 6 · Rollback reports success without rolling back

| | |
|---|---|
| **Cause** | The verification asserted only that `https://$SITE/api/health` returns 200. The release being rolled back answers that URL too. |
| **Detection** | Before the fix, none — it printed `[ OK ] responds — 200`. Now the check asserts the *previous* application is answering. |
| **Symptoms** | A rollback declared complete while every request still reaches the release being rolled back. |
| **Recovery** | Check the reload actually applied: `sudo nginx -t && sudo systemctl reload nginx`. The restored configuration is already on disk. |
| **Prevention** | The releases are distinguishable because only the new one reports a `commit` in `/api/health`; that is now asserted. The audit also fails when the recorded backup is byte-identical to the live configuration, which would make a rollback a no-op. |
| **Class** | Silent. |
| **Evidence** | `REHEARSAL` — the nginx reload failed, and the verification still passed while displaying the new release's commit in its own output. After the fix, a rollback whose backup pointed at the new release fails despite every mechanical step reporting OK. |

## 7 · `node` and `npm` from different installations

| | |
|---|---|
| **Cause** | `NODE22` set from `command -v node` on a host with more than one Node can resolve to a directory containing `node` and no `npm`. Every stage pins npm from `NODE22`'s directory. |
| **Detection** | `[FAIL] PATH npm () is not the pinned npm (…)` in interpreter verification, before any work is done. |
| **Symptoms** | Every stage stops immediately. Nothing is half-done. |
| **Recovery** | `export NODE22="$(dirname "$(command -v npm)")/node"`. |
| **Prevention** | `DEPLOY_FROM_SCRATCH.md` §0 derives it from `npm` and says why; the audit checks the pair. |
| **Class** | Recoverable, and loudly. |
| **Evidence** | `CLEAN-ROOM` — the first attempt failed here at step 6 of 12. |

## 8 · `PORT` and `proxy_pass` disagree

| | |
|---|---|
| **Cause** | `.env` and the nginx server block are edited independently. |
| **Detection** | `stage3-start.sh` compares the file's `PORT` to the port under test; the audit compares it to every `proxy_pass` upstream. |
| **Symptoms** | Every API request is a 502 while the process is healthy, bound and passing its own health checks on the other port. |
| **Recovery** | Make them agree; reload nginx. |
| **Prevention** | Both checks above. The validator also warns when `PORT` is unset, because the default is 3001. |
| **Class** | Manual. |
| **Evidence** | `REPLICA` — the 502-with-nothing-bound signature is the same one measured in production; the disagreement variant is the same failure with the process alive on the wrong port. |

## 9 · A reboot starts nothing

| | |
|---|---|
| **Cause** | Any link in the chain missing: no `dump.pm2` because `pm2 save` was never run; the app absent from it; no `pm2` systemd unit because `pm2 startup` was never run; the unit present but not enabled; or the unit running as a different user, so `pm2 resurrect` reads a different `PM2_HOME`. |
| **Detection** | `verify-restart-survival.sh` and `audit-deployment.sh` §9 check all five conditions. |
| **Symptoms** | After a reboot the site serves static files and every API call 502s. Indistinguishable from §1 by symptom alone. |
| **Recovery** | `pm2 startup`, run the command it prints, `pm2 save`, re-run the audit. |
| **Prevention** | The audit fails when any condition is unmet, including a saved definition that differs from the live one. |
| **Class** | Silent until the reboot. |
| **Evidence** | `REPLICA` — resurrect from a stripped shell restores health; the systemd conditions are checked and reported. A `PM2_HOME` mismatch was demonstrated to resurrect a different file. **Not verified on the production host.** |

## 10 · A stale `dump.pm2`

| | |
|---|---|
| **Cause** | `pm2 save` is manual. The live definition changes; the saved one does not. |
| **Detection** | The audit compares saved `node_args` against live and fails on any difference. |
| **Symptoms** | Everything is correct until a reboot, which restores an older definition. |
| **Recovery** | `pm2 save`. |
| **Prevention** | Only detection. PM2 offers no mechanism to keep them in step. |
| **Class** | Silent. |
| **Evidence** | `REPLICA` — `pm2 save` demonstrably writes `node_args` and the environment into `dump.pm2`, and nothing re-writes it on subsequent changes. |

## 11 · `.env` written with shell syntax

| | |
|---|---|
| **Cause** | `export FOO=bar`, `${VAR}`, or `$(command)` in the file. `set -a; . .env` handles all three; Node's `--env-file` handles none. |
| **Detection** | `stage3-start.sh` and the audit both parse assignments and report the offending key by name. |
| **Symptoms** | Divergence between readers: `stage2-database.sh` sources the file for Prisma and migrates one database while the application connects to another, or to none. |
| **Recovery** | Rewrite as plain `KEY=value`. |
| **Prevention** | The two checks above; `env.release.example` states the rule. |
| **Class** | Recoverable. |
| **Evidence** | `REHEARSAL` — the check itself first produced a false positive by grepping comments, which is how the comment-skipping version was arrived at; it still catches an `export` prefix, a `${VAR}` and a `$(cmd)` in a deliberately bad file. |

## 12 · `.env` world-readable

| | |
|---|---|
| **Cause** | `cp env.release.example $V1/.env` gives the new file the example's mode, 644. |
| **Detection** | Audit §4 reads the "other" permission digit. |
| **Symptoms** | None. Every account on the host can read every secret. |
| **Recovery** | `chmod 600 $V1/.env`. |
| **Prevention** | The audit fails on it; `DEPLOY_FROM_SCRATCH.md` §4 includes the `chmod`. |
| **Class** | Silent. |
| **Evidence** | `REPLICA` — the audit found the release `.env` at 644 immediately after a clean-room deployment that followed the documentation exactly. |

## 13 · The artifact changes between verification and cut-over

| | |
|---|---|
| **Cause** | A rebuild, `npm install`, `git pull`, or an edit to `.env` after `stage3-start.sh` passed. |
| **Detection** | `assert_artifact_frozen` in `stage4-cutover.sh`, and audit §12. |
| **Symptoms** | The thing cut over to is not the thing that was verified. |
| **Recovery** | Re-run stages 1 to 3. |
| **Prevention** | The fingerprint covers the bundle, build stamp, frontend index, `.env`, the `dist/public` file list and the migration directory list. |
| **Class** | Manual. |
| **Evidence** | `REPLICA` — the freeze is written by stage 3 and verified by the audit on an unchanged artifact. |

## 14 · `/api/health` says nothing useful

| | |
|---|---|
| **Cause** | It returns a literal and performs no I/O. Correct for a supervisor deciding whether to restart; useless as evidence of function. |
| **Detection** | Compare it with `/api/health/ready`, which reports `postgres`, `uploads` and `disk`. |
| **Symptoms** | A green health check on a non-functional deployment. A stub returning `{"status":"ok"}` is how a completely broken deployment went unnoticed here for six weeks. |
| **Recovery** | n/a — a monitoring choice. |
| **Prevention** | Monitor `/api/health/ready`. Every stage and the audit also assert that a bad login returns **401**, because only a build with real authentication answers that; a 404 means an older application is live. |
| **Class** | Silent. |
| **Evidence** | `PROD` — recorded in `AUDIT.md`; the six-week outage predates this work. |

## 15 · The evidence directory inside the release

| | |
|---|---|
| **Cause** | `EVIDENCE_UPLOAD_DIR` left at its default, which is inside the application directory. |
| **Detection** | The validator fails it in production; audit §4 fails any path under `$V1`. |
| **Symptoms** | None until the next deployment replaces the directory and uploaded discovery goes with it. |
| **Recovery** | None after the fact. |
| **Prevention** | The two checks above. `env.release.example` sets it to `/var/lib/courtaccess/evidence` and says why. |
| **Class** | Silent, and the only mode here that destroys data. |
| **Evidence** | `REPLICA` — the validator's write-probe and the audit's path check both fire on a path inside the release. |

## 16 · `pm2 list` shows `online` during a crash loop

| | |
|---|---|
| **Cause** | `online` means PM2 has a process; it respawns immediately, so the status is almost always `online`. |
| **Detection** | The restart counter, not the status. Audit §8 fails a counter above 3, and fails a short uptime combined with a high counter. |
| **Symptoms** | An operator concludes the service is up. |
| **Recovery** | n/a — read the counter. |
| **Prevention** | Documented in the playbook's health verification; asserted by the audit. |
| **Class** | Silent. |
| **Evidence** | `REPLICA` — `status=online` at every sample while the counter went 4 → 13 → 22 → 32 and nothing was bound. |

## 17 · `/proc/<pid>/environ` looks empty, and a runbook called that an emergency

| | |
|---|---|
| **Cause** | `--env-file` values are applied inside the process. `/proc/<pid>/environ` shows only what was handed over at exec, so it shows none of them. `ps` also shows nothing useful, because PM2 rewrites `process.title`. |
| **Detection** | n/a — this is the correct state. |
| **Symptoms** | `RUNBOOK.md` previously verified deployments with `grep -c '^JWT_SECRET='` against `/proc`, expecting 1, and documented 0 as meaning an ephemeral key had been generated and every user was about to be signed out. On a correct deployment it returns 0 with the secret set. |
| **Recovery** | n/a. |
| **Prevention** | The runbook now reads the file the way Node does, and checks the application's own `generating an ephemeral key` warning, which is the real symptom. Absence from `/proc` is used as *positive* evidence that PM2 holds no copy. |
| **Class** | Silent — it would cause an operator to condemn a healthy deployment, or to "fix" it by exporting `.env` and reintroducing §4. |
| **Evidence** | `REPLICA` — 0 from that grep while the secret was set and no ephemeral-key warning was logged. |

## 18 · Stage 1 and stage 2 are not re-runnable

| | |
|---|---|
| **Cause** | Deliberate. Stage 1 refuses if `$V1` exists; stage 2 refuses a database with any tables. |
| **Detection** | Each stage stops with the reason before doing anything. |
| **Symptoms** | A redeploy attempt stops at stage 1. |
| **Recovery** | Remove the target explicitly — `sudo rm -rf $V1 $BUILD`, `sudo -u postgres dropdb $V1_DB` — or deploy to a new path. Both are in the playbook. |
| **Prevention** | n/a — the refusal is the feature. It prevents a redeploy silently overwriting a live installation or migrating a populated database. |
| **Class** | Manual. |
| **Evidence** | Read from the source and confirmed by the stage's own preconditions. |

---

## Modes ranked by cost of discovery

Ordered by how long each takes to understand, not by likelihood. Everything in
the top group produces no error at the moment it goes wrong.

1. §2 — the error names the wrong subsystem, confidently
2. §17 — a documented check reports an emergency on a healthy system
3. §6 — a rollback reports success without rolling back
4. §4 — a change to `.env` silently has no effect
5. §15 — data loss with no symptom until the next deployment
6. §9, §10 — correct until a reboot
7. §16 — `online` while dead
8. §3 — the loudest thing in the log is not the fault

`audit-deployment.sh` asserts against all of them. That is what it is for: every
mode in that top group was found by executing something, and each check exists
because the mode above it was once believed to be impossible.
