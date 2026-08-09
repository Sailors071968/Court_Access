# Deployment certification

**Verdict: CONDITIONALLY CERTIFIED.** §8 lists every condition, each with the
command that discharges it.

Every requirement below is exactly one of **PASS**, **FAIL**, **NOT VERIFIED**,
or **NOT APPLICABLE**. PASS means it was executed and observed. NOT VERIFIED
means it was not executed, whatever the reason and however likely it is to work.
No requirement is marked from inspection of the source alone.

**Scope, stated once.** Nothing in this document was executed on the production
host. The agent producing it has no access: no SSH key, no AWS credentials, no
SSM. Every PASS was obtained against a replica —

| | |
|---|---|
| Artifact | `dist/index.js`, esbuild `--target=node22`, from the branch under review |
| Reference | The unmodified `881f8a7` bundle used for root-cause work hashed `c3f5f6f0…d35ad227`, byte-for-byte `REFERENCE_BUNDLE_SHA` in `_common.sh:35` |
| Runtime | Node v22.22.2, pinned by absolute path |
| Database | PostgreSQL 16.14, 30 migrations, **116 tables** — matches `REFERENCE_TABLES` |
| Proxy | nginx 1.24.0, `/api/` → `127.0.0.1:3100`, static from `dist/public` |
| Supervisor | PM2 7.0.3 |

A PASS is therefore a statement about the architecture and the artifact, not
about the production machine. The distinction is the whole of §8.

---

## 1 · Artifact

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1.1 | The release builds from a clean clone with one command | **PASS** | `build-release.sh` — `dist/index.js` 2.1 MB, `dist/public` 5 files, `node_modules` 584 MB |
| 1.2 | The bundle runs on Node 22 and refuses lower | **PASS** | Validator fails below major 22; audit §1 |
| 1.3 | No TypeScript source in the release | **PASS** | `find $V1 -name '*.ts'` outside `node_modules` = 0; audit §12 |
| 1.4 | The artifact carries its own commit | **PASS** | `dist/build-info.json`, reported at `/api/health` |
| 1.5 | The running build is the artifact on disk | **PASS** | Audit §12 compares the build stamp to the live `commit` |
| 1.6 | The artifact is frozen after verification | **PASS** | `stage3-start.sh` writes the fingerprint; audit §12 re-checks it |
| 1.7 | Migrations ship inside the artifact | **PASS** | 30 directories under `$V1/prisma/migrations` |

## 2 · Environment loading

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 2.1 | The environment is loaded by Node from `.env`, not by a shell | **PASS** | `node_args = ["--env-file=$V1/.env"]` in the live definition |
| 2.2 | PM2 holds no copy of the application secrets | **PASS** | 0 in `/proc/<pid>/environ` and 0 in `pm2_env`, application healthy. Before the fix: 4 |
| 2.3 | Editing `.env` and restarting changes the running configuration | **PASS** | Marker appended, observed at the next spawn, file restored byte-identical |
| 2.4 | Correct from a shell that has already sourced `.env` | **PASS** | Stage 3 run from such a shell: PM2 received none of the variables |
| 2.5 | The file is validated before PM2 is touched | **PASS** | Stage 3 reads it back with an emptied environment and names any variable Node cannot see |
| 2.6 | Shell-only syntax is rejected | **PASS** | `export` prefix, `${VAR}` and `$(cmd)` all caught in a deliberately bad file; comments correctly ignored |
| 2.7 | `PORT` in `.env` matches the port under test | **PASS** | Stage 3 and audit §4 |
| 2.8 | A release template exists that boots the service | **PASS** | `env.release.example`, filled in and booted from a clean clone |
| 2.9 | `.env` is not world-readable | **PASS** | Audit §4 fails a non-zero "other" digit; found 644 after a clean-room deploy, `chmod 600` clears it |

## 3 · Startup

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 3.1 | The artifact starts under plain Node with `--env-file` and nothing inherited | **PASS** | `standalone-check.sh` PASS with an emptied environment |
| 3.2 | It refuses to start without `--env-file` | **PASS** | Negative control in the same run: exit 1 |
| 3.3 | Prisma initialises | **PASS** | 0 occurrences of `Environment variable not found` |
| 3.4 | The database connects and the schema is asserted | **PASS** | `[Schema Assert] Migrations: 30/30 applied` |
| 3.5 | The server binds and serves | **PASS** | `CourtAccess API running`; port held by the probe's own pid |
| 3.6 | A missing environment fails fast, naming the cause | **PASS** | FAIL at the validator, before Prisma, before binding. Previously: 4 fatals waived, death at 996 ms blaming the database |
| 3.7 | A developer with a database but no production environment still boots | **PASS** | `DATABASE_URL` set, `NODE_ENV` unset: warnings, health 200 |
| 3.8 | The interpreter is pinned by absolute path | **PASS** | `/proc/<pid>/exe` compared to `$NODE22`; audit §8 |
| 3.9 | No `npx` or `npm exec` in any deployment command | **PASS** | Asserted by `verify_interpreter` in every stage |

## 4 · Runtime and health

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 4.1 | `/api/health` 200 locally | **PASS** | Audit §7 |
| 4.2 | `/api/health/ready` 200 locally, all components healthy | **PASS** | `postgres=healthy uploads=healthy disk=healthy` |
| 4.3 | `/api/health/deep` 200 locally | **PASS** | Audit §7 |
| 4.4 | All three 200 through nginx | **PASS** | Verified through nginx 1.24.0 proxying to 3100 |
| 4.5 | All three 200 through the production nginx | **FAIL** | `https://courtaccess.net` returns **502** on all three, persistently, at connection-refused latency |
| 4.6 | A bad login returns 401, not 404 | **PASS** | Locally and through nginx |
| 4.7 | The functional smoke test passes | **PASS** | 17/17 — registration, token, case, upload, extraction, CALCRIM, contradiction, statute lookup |
| 4.8 | The API binds loopback only | **PASS** | `127.0.0.1:3100`; audit §6 |
| 4.9 | Redis absence does not degrade health | **PASS** | Workers `unknown` not unhealthy; 0 Redis errors with `DISABLE_WORKERS=true` |

## 5 · Restart, reboot, rollback

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 5.1 | `pm2 restart` returns to health with no stale environment | **PASS** | 200 on all four endpoints, 0 stale secrets |
| 5.2 | `pm2 save` persists `--env-file` | **PASS** | Present in `dump.pm2` |
| 5.3 | The saved definition holds no application secrets | **PASS** | Audit §9 |
| 5.4 | `pm2 resurrect` after `pm2 kill` returns to health | **PASS** | 200, restart counter 0, resurrected from a shell with all 10 variables stripped |
| 5.5 | A PM2 daemon restart preserves the environment | **PASS** | `pm2 update`: 200, 0 stale secrets |
| 5.6 | A simulated reboot returns to health | **PASS** | Daemon and application killed; 502 during the outage; 200 after resurrect |
| 5.7 | **A real reboot on the production host returns to health** | **NOT VERIFIED** | No host access. The systemd link in the chain is unproven there |
| 5.8 | A `pm2` systemd unit exists, is enabled, and runs as the user owning `dump.pm2` | **NOT VERIFIED** | Audit §9 checks all three; the replica has no systemd, so it reports the unit absent |
| 5.9 | Rollback restores the previous application | **PASS** | Executed: previous application on :3001, cut over, rolled back, verified |
| 5.10 | Rollback detects its own failure | **PASS** | A rollback whose backup pointed at the new release now FAILs despite every mechanical step reporting OK |
| 5.11 | Rollback does not depend on PM2, `.env`, or the API being up | **PASS** | One file restore plus a reload; V1 and its database left running |
| 5.12 | A rollback on the production host | **NOT VERIFIED** | No host access |

## 6 · Database

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 6.1 | Migrations apply to an empty database | **PASS** | 30 applied, 116 tables from empty |
| 6.2 | Applied count matches the artifact | **PASS** | Audit §5 |
| 6.3 | No unfinished or rolled-back migrations | **PASS** | Both 0 |
| 6.4 | The boot-time schema guard is not inert | **PASS** | Reports `30/30`, not `0/0` or `no-migrations` |
| 6.5 | Stage 2 refuses a non-empty database | **PASS** | Read from the stage and confirmed by its precondition |
| 6.6 | A backup restores | **PASS** | `pg_dump -Fc` → `pg_restore` into a scratch database: 116 tables |
| 6.7 | A backup taken from the production host restores | **NOT VERIFIED** | No host access; no restore timed at production volume |

## 7 · Manual steps and tribal knowledge

Every manual step in the deployment, classified. **Automatable** means it could
be automated and has not been. **Documented** means it is manual by necessity and
the documentation is sufficient. **Required** means a human must decide or supply
something. **Avoidable** means it should not exist.

| Step | Class | Where documented | Note |
|---|---|---|---|
| `export NODE22` | **Documented** | `DEPLOY_FROM_SCRATCH.md` §0, playbook §0 | Derived from `npm` so the pair matches. Scripts self-resolve under nvm and print the remedy otherwise |
| Create the database and role | **Required** | `DEPLOY_FROM_SCRATCH.md` §2 | Includes `ALTER … OWNER`, without which migrations stop partway |
| Fill in `.env` secrets | **Required** | `env.release.example` | Secrets cannot be generated by a deployment that must not know them |
| `chmod 600 $V1/.env` | **Automatable** | `DEPLOY_FROM_SCRATCH.md` §4 | Audit fails it. Could be done by `build-release.sh` |
| **Edit nginx `proxy_pass` at cut-over** | **Automatable** | Stage 4 prints the change; playbook §4 | The largest manual step. Stage 4 deliberately only prechecks and verifies. Highest-risk item on this list |
| `sudo nginx -t && systemctl reload nginx` | **Documented** | Playbook §4 | Deliberately manual: it is the moment traffic moves |
| `pm2 save` | **Automatable** | Playbook §6, §8 | Not idempotent over time. Audit detects a stale dump; nothing prevents one |
| `pm2 startup` and running its printed command | **Required** | `DEPLOY_FROM_SCRATCH.md` §9 | Prints a `sudo` command that must be run as the right user. Cannot be safely automated blind |
| Create the administrator | **Required** | Playbook §12 | A human must choose the account |
| Remove smoke-test data | **Documented** | Playbook §11 | Query provided; no automated cleanup exists |
| Copy backups off the host | **Required** | Playbook §10 | A backup on the machine does not survive the machine |

**Eliminated during this work** — each previously existed only because someone
knew to do it:

- That the environment must not be sourced before a PM2 command. Now enforced by
  stage 3 regardless of the shell, and stated in both the playbook and the
  runbook.
- That `deploy/README.md`'s `.env.example` is for a different architecture. Now
  said at the top of that file, and a correct template exists.
- That `/proc/<pid>/environ` showing no secrets is correct. Now positive evidence
  in the audit, and the runbook check that called it an emergency is replaced.
- That `pm2 list` showing `online` does not mean healthy. Now the restart counter
  is the assertion, in the audit and the playbook.
- That the stage sequence is the real deployment path. Now one document,
  `DEPLOY_FROM_SCRATCH.md`, executed from a clean clone.
- That `bootstrap-admin.mjs` must run from inside the release. Now in the step
  itself, with the error it produces otherwise.

**Remaining single points of failure**, all human rather than technical:

1. The nginx cut-over edit — one hand-edited line moves all production traffic.
2. `pm2 save` currency — silent until a reboot.
3. The `pm2 startup` unit's user — a mismatch resurrects a different `dump.pm2`.

Each is detected by `audit-deployment.sh`. None is prevented by it.

## 8 · Conditions on certification

Discharging these is execution on the production host, not development. Each is
objectively checkable and none requires a judgement call.

| # | Condition | Discharged by | Blocks |
|---|---|---|---|
| C1 | The artifact starts on the host under plain Node with `--env-file` | `bash deploy/stages/standalone-check.sh` → PASS | 3.1–3.5 on the host |
| C2 | The deployment is created on the host with `--env-file` and no PM2-held secrets | `bash deploy/stages/stage3-start.sh` → PASS | 2.1–2.7 on the host |
| C3 | The saved definition is current and carries `--env-file` | `pm2 save`, then `bash deploy/stages/verify-restart-survival.sh` → PASS | 5.2, 5.3 |
| C4 | A `pm2` systemd unit exists, is enabled, and runs as the user owning `dump.pm2` | `pm2 startup`, run its printed command, `pm2 save`, re-run C3 | **5.7, 5.8** |
| C5 | The public endpoints return 200 | `curl` the three health paths against `https://courtaccess.net` | **4.5** |
| C6 | The whole deployment audits clean on the host | `bash deploy/audit-deployment.sh` → `PRODUCTION READY` | all of the above |
| C7 | A backup taken from the host restores into a scratch database | Playbook §9 | 6.7 |

C4 and C5 are the two that matter. C5 is currently **FAIL**, not NOT VERIFIED:
production is measurably down. C4 is the only requirement in this document that
cannot be satisfied by a replica at all, because it is a property of the host's
init system.

## 9 · Success criteria

| Criterion | Status |
|---|---|
| A new engineer can deploy from a clean clone using only the documentation | **PASS** — 12 steps, 0 deviations, third attempt; first two failed and both causes were fixed |
| Every deployment stage is reproducible | **PASS** — with the recorded exception that stages 1 and 2 refuse to run twice by design |
| Restart behaviour is verified | **PASS** — six scenarios, 0 stale secrets in every one |
| Rollback is verified | **PASS** — both directions, and it found a defect in itself |
| Reboot persistence is verified on the production host | **NOT VERIFIED** — C4 |
| Health endpoints are verified | **PASS** locally and through nginx; **FAIL** through the production nginx |
| Documentation exactly matches the deployed system | **PASS** for the replica. **NOT VERIFIED** for the host, whose `.env`, nginx block, systemd configuration and permissions are unseen |
| The deployment can be audited entirely from evidence | **PASS** — `audit-deployment.sh`, read-only, one verdict |

## 10 · What is deliberately not certified

**NOT APPLICABLE** to this deployment, and recorded so their absence is not
mistaken for an oversight:

| | Why |
|---|---|
| Redis / queue processing | Not deployed. `DISABLE_WORKERS=true` |
| Object storage (R2, S3) | Not used; evidence is on a filesystem path |
| Email (SES) | No credentials; verification mail and invitations are inert |
| Payments (Stripe) | No key; subscription flows are inert |
| Horizontal scale | One process, `instances: 1` |
| Zero-downtime deployment | Cut-over is an nginx change |
| Automated backup verification | Only the manual drill in playbook §9 |

---

## Verdict

**CONDITIONALLY CERTIFIED.**

The deployment architecture is certified against a replica with the same bundle
lineage, runtime, schema, table count and proxy topology. Every claim in §§1–6
marked PASS was executed and observed.

The exercise of proving them found and fixed **sixteen defects**, none of which
was visible by reading the code:

*Deployment scripts (5)* — `--env-file` rendered inert by PM2's snapshot; the
`.env` syntax check failing on its own template's comments; `standalone-check.sh`
orphaning a probe that held the port and a database connection;
`verify-restart-survival.sh` reading `/proc/<pid>/cmdline`, which PM2 overwrites;
`rollback.sh` unable to detect a failed rollback.

*Application (3)* — the Redis memory monitor reopening a connection that
`DISABLE_WORKERS=true` was meant to prevent; a Redis error line that printed
nothing after the colon; the validator disarming itself on the exact condition it
exists to catch.

*The audit tool itself (2)* — a bind-address test that matched `ss`'s peer
column, and a permission test that would have accepted world-readable secrets.
Both found by running it.

*Documentation (6)* — `OPERATIONS.md` instructing the pattern that breaks the
fix; `RUNBOOK.md` verifying deployments with a check that reports a
sign-everyone-out emergency on a healthy system; an unverified claim that PM2
erased the environment, retracted after five operations were measured preserving
it; no release `.env` template, with the obvious entry point leading to the
compose one; a `NODE22` instruction that can select a Node with no `npm`; an
administrator bootstrap that cannot run as documented.

One of those documentation defects is the sharpest result here: **following the
written procedure from a clean clone reproduced the production outage**, line for
line, on a host where nothing had been misconfigured by hand.

The audit also found the release `.env` at mode 644 immediately after a
deployment that followed the corrected documentation exactly — a configuration
finding rather than a defect, and the reason `chmod 600` is now a step.

Certification for the **production host** is withheld pending C1–C7. Six of the
seven are single commands. C4 — a `pm2` systemd unit, enabled, owned by the user
whose `dump.pm2` was saved — is the only one a replica cannot stand in for, and it
is the difference between a deployment that survives a reboot and one that
appears to.

One requirement is **FAIL** rather than NOT VERIFIED: 4.5. The production API
returns 502 on every health endpoint and has throughout this work. No deployment
can be certified over a service that is down.
