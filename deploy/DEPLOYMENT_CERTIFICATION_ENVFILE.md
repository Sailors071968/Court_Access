# Deployment certification — `--env-file` startup architecture

**Verdict: DEPLOYMENT NOT CERTIFIED.** Section 9 states exactly why and exactly
what changes it.

Every result below was produced in a replica, not on the production host. The
agent producing this report has no access to that host: no SSH key, no AWS
credentials, no SSM. Nothing here has been executed against
`/var/www/courtaccess-v1`, and no production traffic was touched.

---

## 1 · Root cause

A launch with no application environment reaches `enforceSchemaOnBoot`, fails to
construct a Prisma client, and exits 1 — about 40 times a minute, so the observed
578 restarts is roughly 14 minutes of looping. `app.listen()` is never reached,
the port is never bound, and nginx answers every `/api/*` request with an
immediate 502.

The environment was absent because it lived in PM2's memory rather than in a
file the process reads. Adding `--env-file` alone does not fix that: Node's
`--env-file` does not replace a variable that is already set, so while `.env` was
also exported into the shell PM2 snapshots, the snapshot silently outranked the
file.

Full trace, code references and negative results: `ROOT_CAUSE_CRASH_LOOP.md`.

## 2 · Permanent fix

Two parts. Both are required; neither substitutes for the other.

**Implemented (this PR).** `stage3-start.sh` starts PM2 with
`--node-args="--env-file=$V1/.env"` *and* removes every variable `.env` defines
from the environment PM2 snapshots, so the file is the only possible source. The
stage validates the file with Node's own parser before touching PM2, checks the
file's `PORT` is the port under test, and then asserts provenance — the
application secrets must be absent from `/proc/<pid>/environ` while the
application is healthy.

**Not implemented — needs a decision.** Both guards for a missing environment
(`authMiddleware.ts:75`, `validateEnvironment.ts:195`) are conditional on
`NODE_ENV === 'production'`, which is itself missing from the environment they
exist to check. An empty environment is therefore treated as a developer laptop,
four fatal conditions are downgraded to warnings, and the failure surfaces
~400 ms later as `Database unreachable` / `Run: npx prisma migrate deploy` —
naming a subsystem that was never at fault. This is why the incident was
investigated as Redis and then as the database. See §9.

## 3 · Verification environment

| | |
|---|---|
| Artifact | `dist/index.js`, esbuild `--target=node22`, sha256 `3a7b0744124ee2f9…` from `2b5fa80` |
| Reference | The unmodified `881f8a7` bundle used for root-cause work hashed to `c3f5f6f0…d35ad227`, byte-for-byte `REFERENCE_BUNDLE_SHA` (`_common.sh:35`). The candidate differs only by the Redis monitor fix. |
| Runtime | Node v22.22.2, pinned by absolute path |
| Database | PostgreSQL 16.14, 30 migrations applied, **116 tables** — matches `REFERENCE_TABLES` |
| Proxy | nginx 1.24.0, `/api/` → `127.0.0.1:3100`, static from `dist/public` |
| Supervisor | PM2 7.0.3 |

**Control.** With nginx up and no backend, the replica reproduced production
exactly — `/` returns 200, every `/api/*` returns 502, and the 502 arrives as
fast as the static 200 (connection refused, nothing bound).

## 4 · Standalone validation — PASS

`deploy/stages/standalone-check.sh`, run with an emptied environment so `.env` is
the only possible source of configuration:

| Requirement | Evidence |
|---|---|
| `.env` loads | All 9 required variables read back by Node from the file alone |
| Node loads | v22.22.2, pinned absolute path, bundle targets node22 |
| Prisma initialises | 0 occurrences of `Environment variable not found` |
| Database connects | `[Schema Assert] Migrations: 30/30 applied`; 116 tables; `postgres=healthy` |
| HTTP healthy | `CourtAccess API running`; `/api/health`, `/api/health/ready`, `/api/health/deep` all 200; bad login 401 |

Negative control: the same probe **without** `--env-file` refused to start
(exit 1), confirming the file — not ambient environment — is what configures the
process. The probe released its port and left nothing behind.

## 5 · Controlled deployment — PASS (replica)

`deploy/stages/stage3-start.sh`:

```
[ OK ] Node parsed /tmp/lab-release/.env
[ OK ] every required variable is readable by Node from the file alone
[ OK ] .env has no shell-only syntax — both readers see the same values
[ OK ] PORT in .env matches the port under test — 3100
       variables withheld from PM2        10 defined in .env
[ OK ] new process pid — 31433
[ OK ] process runs the pinned interpreter
[ OK ] restart count — 0
[ OK ] PM2 injected none of the application secrets — the file is the only source
       node_args in the live definition   --env-file=/tmp/lab-release/.env
[ OK ] startup validator passed
[ OK ] schema guard reports 30/30 applied
[ OK ] security hardening active
       17/17 checks passed  (functional smoke test)
       PASS
```

PM2 status after deployment: `status=online restarts=0`,
`node_args=["--env-file=…/.env"]`, **`secrets_in_pm2_env=0`**.

## 6 · Restart validation — PASS (replica)

After each scenario: health on localhost and through nginx, readiness, deep
health, restart counter, and the number of application secrets held in PM2's
definition.

| Scenario | restarts | stale secrets | local | nginx | ready | deep |
|---|---|---|---|---|---|---|
| baseline after deployment | 0 | 0 | 200 | 200 | 200 | 200 |
| `pm2 restart` | 1 | 0 | 200 | 200 | 200 | 200 |
| `pm2 save` | 1 | 0 | 200 | 200 | 200 | 200 |
| `pm2 resurrect` after `pm2 kill` | 0 | 0 | 200 | 200 | 200 | 200 |
| PM2 daemon restart (`pm2 update`) | 0 | 0 | 200 | 200 | 200 | 200 |
| server reboot simulation | 0 | 0 | 200 | 200 | 200 | 200 |

`stale secrets = 0` in every row is the load-bearing column: the environment is
reconstructed from the file at every spawn and PM2 never holds a copy.

The reboot simulation killed the daemon and the application outright. During the
outage the port was unbound and nginx returned **502** — the production
signature — and the service returned to 200 on all four endpoints after
`pm2 resurrect` from a shell with all ten variables stripped.

`verify-restart-survival.sh` additionally confirmed the saved definition carries
`--env-file` and holds no application secrets, and that a fresh spawn picks up an
edit to `.env` (marker appended, observed, file restored and compared byte for
byte).

## 7 · Health verification

**Localhost (`127.0.0.1:3100`)** — `/api/health` 200, `/api/health/ready` 200,
`/api/health/deep` 200.

**Through nginx** — same three 200, plus `/` 200.

```json
{"status":"ok","version":"1.1.0","commit":"2b5fa80ab6d3…",
 "service":"court-access-backend","environment":"production"}
{"status":"healthy","components":{"postgres":{"status":"healthy","latencyMs":2},
 "uploads":{"status":"healthy"},"disk":{"status":"healthy","message":"233.0 GB free"}}}
```

**Public production endpoint** — `https://courtaccess.net` at the time of
writing: `/` 200; `/api/health`, `/api/health/ready` and `/api/health/deep` all
**502**. The public API is down and has been throughout this work.

## 8 · Architecture requirements

| Requirement | Status | Basis |
|---|---|---|
| Deterministic startup | **Satisfied** | Interpreter pinned by absolute path and verified against `/proc/<pid>/exe`; artifact frozen by fingerprint after verification; no `npx`, no PATH resolution |
| Deterministic environment loading | **Satisfied** | Node reads `.env` at every spawn; PM2 holds no copy (`secrets_in_pm2_env=0` in all six scenarios); file validated with Node's own parser before use |
| Restart-safe | **Satisfied** | `pm2 restart`, `pm2 save`, `pm2 resurrect`, `pm2 update` — all 200 with no stale environment |
| Reboot-safe | **Not established** | The resurrect path is proven, but a reboot only replays it if a `pm2` systemd unit exists and is enabled. `verify-restart-survival.sh` reports `[FAIL] no pm2 systemd unit` in the replica, and this is **unverified on the host** |
| No dependency on the launching shell | **Satisfied** | Verified from a shell that had sourced `.env`: PM2 still received none of the variables. The stage strips them regardless of what the operator's shell holds |
| No dependency on manual operator intervention | **Not satisfied** | See below |

**Why the last requirement fails.** Three manual steps remain, each of which
silently breaks reboot survivability if skipped:

1. `pm2 save` must be re-run after any change to the process list. Nothing
   enforces it, and a stale `dump.pm2` is invisible until a reboot.
2. `pm2 startup` must have been run once, and its unit enabled, as the same user
   whose `PM2_HOME` holds `dump.pm2`. A mismatch here resurrects a different
   file — one of the two candidate explanations for how the environment went
   missing in the first place.
3. `NODE22` must be exported before running any stage.

The architecture removes the dependency on the shell's *environment*. It does
not remove the dependency on the operator performing steps 1–3 correctly. A
systemd unit owning the service directly, with `EnvironmentFile=`, would; PM2
with `pm2 save` cannot.

## 9 · Why this is NOT CERTIFIED

Certification is a statement about the target system. Three things block it:

1. **Nothing has been executed on the production host.** Every PASS above comes
   from a replica. It is a faithful replica — same bundle hash lineage, same
   Node major, same PostgreSQL schema, same table count, same proxy topology —
   but it is not the host, and its `.env`, its PM2 daemon, its systemd
   configuration and its filesystem permissions are not the host's.
2. **Reboot survivability is unproven where it matters.** The one check that
   FAILs in the replica — no `pm2` systemd unit — is precisely the check that
   determines whether the service returns after a reboot. On the host it may
   already be configured; that is unknown, and §6 of the root-cause report shows
   a `PM2_HOME` mismatch here is a live candidate for the original fault.
3. **Production is currently down.** The public API has returned 502 on every
   endpoint throughout. A deployment cannot be certified from a state where the
   thing being deployed over is not running.

**What changes the verdict.** On the host, in order:

```bash
bash deploy/stages/standalone-check.sh          # must PASS
bash deploy/stages/stage3-start.sh              # must PASS
pm2 save
bash deploy/stages/verify-restart-survival.sh   # must PASS, including autostart
```

If the fourth still reports `no pm2 systemd unit`, run `pm2 startup`, execute the
command it prints, `pm2 save` again, and re-run it. When all four pass on the
host and the public endpoints return 200, this report can be reissued as
certified.

## 10 · Rollback

Unchanged and independent of everything above. Rollback is an nginx file restore
plus a reload — it does not depend on the API being up, on PM2, or on `.env`:

```bash
bash deploy/stages/rollback.sh
```

It restores the server block backed up at cut-over, runs `nginx -t`, reloads, and
verifies the previous application answers. It deliberately does not stop or
modify the V1 installation or its database, so the evidence survives.

The stage-3 rollback for the change in this PR is narrower: `pm2 delete
courtaccess-v1`. Nothing in this PR modifies nginx, the legacy application, the
database, or `.env`.

## 11 · Remaining risks

| Risk | Severity | Mitigation |
|---|---|---|
| A missing environment still surfaces as a database fault | High — it cost this incident its diagnosis time | Not yet fixed; §2 |
| Reboot depends on `pm2 save` being current and a `pm2` unit being enabled | High | `verify-restart-survival.sh` detects both; run it after any process-list change |
| `.env` must remain parseable by Node, which is not the shell | Medium | Stage 3 fails the deployment if Node cannot read a required variable, or if the file contains `export`, `${VAR}` or `$(cmd)` |
| Replica fidelity | Medium | Same bundle lineage and schema, but the host's `.env`, permissions and systemd are unverified |
| `/proc/<pid>/environ` and `ps` cannot show `--env-file` values | Low, but caused a false alarm | Docs corrected; `pm2 jlist` is the reliable source |
| `changeManagement.ts:12` resolves migrations to `<parent-of-release>/backend/prisma/migrations` and silently reports none | Low — admin reporting only, not boot | Noted, not fixed; out of scope for this change |

---

**DEPLOYMENT NOT CERTIFIED**
