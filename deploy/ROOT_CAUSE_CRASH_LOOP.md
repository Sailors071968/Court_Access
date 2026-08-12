# Root cause — the `courtaccess-v1` restart loop

**Method:** instrumented trace of two launches of the same binary, one that
succeeds and one that fails, compared to the first divergent instruction.
Findings below are labelled `[MEASURED]` where they come from an executed trace,
`[CODE]` where they come from reading the deployed source, and `[UNRESOLVED]`
where the evidence does not settle the question.

---

## 1 · Answer

The application is not faulty and Redis is not involved. A launch with no
application environment reaches `enforceSchemaOnBoot`, fails to construct a
Prisma client, exits 1, and is respawned — about **40 times a minute**, so the
observed 578 restarts is roughly 14 minutes of looping `[MEASURED]`. The port is
never bound, which is why nginx answers `/api/*` with an immediate 502.

The more consequential finding is *why this was diagnosed as a Redis and then a
database problem for so long:

> **Every guard that exists to catch a missing environment is itself conditional
> on `NODE_ENV`, which is missing from that same environment.**

With no environment at all, `NODE_ENV` is unset, so the process concludes it is
not in production, downgrades four fatal conditions to warnings, and continues
past both of its own safety nets until it dies inside Prisma — where the error
text blames the database.

---

## 2 · Fidelity of the replica

The trace was run against a bundle built from `881f8a7`, the commit stamped into
the frontend currently served by `courtaccess.net`:

```
$ sha256sum /tmp/prod-replica/dist/index.js
c3f5f6f03399b594f4465db2067ba7219b7717335fd8f43355473d47d35ad227
```

That is byte-for-byte `REFERENCE_BUNDLE_SHA` in `deploy/stages/_common.sh:35`,
the certification build. PostgreSQL 16 with the same 30 migrations and 116
tables. So this is the production artifact, not an approximation `[MEASURED]`.

The next commit, `8582c3e`, changed only `deploy/stages/stage3-start.sh`, so the
application is identical either side of it — the difference between the two
launches below is entirely in how the process is started.

Instrumentation is a `--import` preload that wraps `process.env` in a logging
Proxy, patches `process.exit` to record its call site, and timestamps the
application's own output on the same clock. The bundle is unmodified. Variable
values are never printed, only presence.

---

## 3 · The two launches

**A — `envtest`:** `node --env-file=.env dist/index.js`, environment otherwise
emptied.
**B — `courtaccess-v1`:** the same binary with no application environment, which
is what PM2 supplies when its stored definition carries none.

```
$ diff --side-by-side A.norm B.norm        # timestamps removed

env.present  NODE_ENV      yes           |  env.present  NODE_ENV      NO
env.present  PORT          yes           |  env.present  PORT          NO
env.present  DATABASE_URL  yes           |  env.present  DATABASE_URL  NO
env.present  JWT_SECRET    yes           |  env.present  JWT_SECRET    NO
...
                                         >  warn  [Auth] JWT_SECRET is not set; generating an ephemeral key.
                                         >  warn  [Auth] JWT_REFRESH_SECRET is not set; generating an ephemeral key.
log  [Server] CourtAccess 1.1.0 — 881f8a7   log  [Server] CourtAccess 1.1.0 — 881f8a7
log  [Startup] Validating configuration…    log  [Startup] Validating configuration…
log    PASS  NODE_ENV      production    |  log    WARNING  NODE_ENV  "<unset>"
log    PASS  DATABASE_URL  set (80 chars)|  log    WARNING  DATABASE_URL  not set
```

**First divergence: T+0.3 ms, before a line of application code.** A holds 13
environment variables; B holds 3, of which one is the tracer's own label —
`HOME`, `PATH`, `TRACE_LABEL`. Nothing after this point is a cause; it is all
consequence `[MEASURED]`.

**First divergence in behaviour: T+578 ms, `authMiddleware.ts` module
initialisation** — before the server banner and before the validator.

---

## 4 · The failing launch, step by step

| T+ | Event | Reference |
|---|---|---|
| 0.3 ms | 4 variables present; no `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT` | — |
| 578 ms | `[Auth] JWT_SECRET is not set; generating an ephemeral key` (×2) — **warning, not fatal** | `authMiddleware.ts:83`, called at `:87–88` |
| 667 ms | Validator reports `NODE_ENV "<unset>"`, `DATABASE_URL not set`, `JWT_SECRET not set`, `JWT_REFRESH_SECRET not set`, `COOKIE_SECRET not set`, `PORT not set` — **all as `WARNING`** | `validateEnvironment.ts:94, 195–196` |
| 667 ms | `[Startup] 4 check(s) would be fatal in production, 6 warnings. Continuing because NODE_ENV is not production.` | `validateEnvironment.ts:219` |
| 668 ms | Boot continues into `enforceSchemaOnBoot()` | `server.ts:99–104` |
| 993 ms | `[Schema Assert] ERROR: Database unreachable:` followed by `error: Environment variable not found: DATABASE_URL` | `schemaAssert.ts:275` |
| 993 ms | `[Schema Assert] Server cannot start with drifted schema.` / `Run: npx prisma migrate deploy` | `schemaAssert.ts:359–360` |
| 996 ms | `process.exit(1)` from `enforceSchemaOnBoot` | `schemaAssert.ts:361` |
| — | `app.listen()` never reached — 0 occurrences of `CourtAccess API running` | `server.ts:412` |

Restart, and repeat. Reproduced under PM2: restart counter 4 → 13 → 22 → 32 over
45 seconds, `status=online` throughout, nothing listening on 3100 `[MEASURED]`.

---

## 5 · Why it read as Redis, then as the database

Three separate pieces of misdirection, in the order an operator meets them.

**The `[Redis]` noise is unrelated to the crash.** With no environment,
`DISABLE_WORKERS` is also unset, so five BullMQ workers start and dial
`redis://localhost:6379` — the default when `REDIS_URL` is absent
(`lib/redis.ts:8`). Every one of those lines is a *symptom of the same missing
environment*, appearing before the fatal error and in far greater volume. The
Redis investigation was chasing a second-order effect.

**The fatal error names the wrong subsystem.** The three most visible lines are
`Database unreachable`, `Server cannot start with drifted schema`, and
`Run: npx prisma migrate deploy`. All three point at the database. The actual
cause — `Environment variable not found: DATABASE_URL` — is on the *fourth* line
of a multi-line Prisma message whose first line is empty, so
`[Schema Assert] ERROR: Database unreachable:` appears to trail off into
nothing. The database was reachable and the schema was not drifted.

**Both guards were disarmed by the same absence.** This is the finding worth
acting on. Two independent mechanisms exist to catch exactly this situation, and
both are keyed on `NODE_ENV === 'production'`:

- `authMiddleware.ts:75` — fatal if a signing key is missing, *in production*.
- `validateEnvironment.ts:195–196` — `overall = FAIL` only if
  `failed.length > 0 && production`.

`validateEnvironment.ts` documents the intent: *"a FAIL must describe something
that genuinely breaks production… Outside production every FAIL is downgraded to
a WARNING, so running tests or a local server does not require a full production
environment."* That is sound reasoning with one gap: **an empty environment is
indistinguishable from a developer's laptop**, because the signal used to tell
them apart lives in the environment that is missing.

The counterfactual confirms it. Launch C — the same empty environment with
`NODE_ENV=production` added and nothing else:

```
[Auth] FATAL: JWT_SECRET is not set. Refusing to start with a generated key —
every restart would sign out every user with no other symptom.
process.exit code=1 at requireSigningKey
```

It stopped at **617 ms instead of 996 ms**, named the missing variable, and
**never contacted the database** — 0 occurrences of `Schema Assert` `[MEASURED]`.
The machinery works perfectly. It was switched off by the fault it was built to
report.

---

## 6 · What the evidence does *not* support

The working hypothesis on record is that "PM2 restarted using a definition that
no longer contained those variables", i.e. that some PM2 operation erased the
environment. **I could not reproduce that.** Against the real bundle, starting it
exactly as `881f8a7` does (`set -a; . .env; set +a` then `pm2 start … --update-env`)
and then running each operation from a shell holding none of the variables:

| Operation, run from a clean shell | Environment after | Health |
|---|---|---|
| `pm2 restart <name>` | `DATABASE_URL` held | 200 |
| `pm2 restart <name> --update-env` | `DATABASE_URL` held | 200 |
| `pm2 reload <name> --update-env` | `DATABASE_URL` held | 200 |
| `pm2 save` → `pm2 kill` → `pm2 resurrect` | `DATABASE_URL` held | 200 |
| `pm2 update` (daemon restart in place) | `DATABASE_URL` held | 200 |

PM2 7.0.3 persists the captured environment through all five, including into
`dump.pm2` `[MEASURED]`. So the loop was almost certainly **not** caused by a
definition decaying over time. It is far more likely the definition never had the
environment: something started `courtaccess-v1` without the exports, or a
boot-time resurrect read a different `dump.pm2` than the one `pm2 save` wrote —
`pm2 resurrect` under a different `PM2_HOME` finds a different file, and if the
`pm2 startup` unit runs as another user it will `[MEASURED]`.

**`[UNRESOLVED]`** — which of those occurred on the host cannot be determined
from here; I have no access to it. Section 8 lists the commands that settle it.

---

## 7 · Current production state, measured from outside

`https://courtaccess.net` at the time of writing:

- `/` returns **200** — nginx is healthy and serving the V1 frontend, stamped
  `881f8a7`, built 2026-08-08T13:58:13Z.
- `/api/health`, `/api/health/ready`, `/api/health/deep`, `/api/auth/csrf-token`
  and `POST /api/auth/login` all return **502**, persistently over a 30-second
  sample.
- The 502 arrives in **22 ms**, the same as the static 200 baseline. nginx is
  getting an immediate connection refused, so nothing is bound on the upstream
  port. A hung process would instead stall and return 504 after the 300 s
  `proxy_read_timeout`.

That is the exact signature of section 4: the process never reaches
`app.listen()`.

---

## 8 · Settling the open question on the host

Read-only; none of these change anything.

```bash
# Does the stored definition carry an environment, and where did it come from?
pm2 jlist | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8"))
  .filter(p=>p.name==="courtaccess-v1")
  .map(p=>({restarts:p.pm2_env.restart_time, node_args:p.pm2_env.node_args,
            hasDbUrl:!!p.pm2_env.DATABASE_URL, exec:p.pm2_env.pm_exec_path,
            created:new Date(p.pm2_env.created_at).toISOString()}))'

# Same question of the saved definition a reboot would restore.
node -pe 'JSON.parse(require("fs").readFileSync(process.env.HOME+"/.pm2/dump.pm2","utf8"))
  .map(a=>({name:a.name, hasDbUrl:!!(a.env&&a.env.DATABASE_URL), node_args:a.node_args}))'

# Is the daemon that resurrects at boot the same one you save from?
systemctl cat pm2-*.service 2>/dev/null | grep -E "User=|Environment=PM2_HOME|ExecStart"
ls -la /root/.pm2/dump.pm2 "$HOME/.pm2/dump.pm2" 2>&1

# Which PM2, and when did the loop start?
pm2 --version
pm2 logs courtaccess-v1 --lines 400 --nostream | grep -nE "Startup\]|Schema Assert\]|<unset>" | head -40
```

The first command answers it directly. `hasDbUrl:false` with a high restart
count means the definition never held the environment, and `created` dates the
start that introduced it.

---

## 9 · Recommendation

Now that the divergence is identified, the fix follows from it and has two
independent parts. They address different failures and neither substitutes for
the other.

**1 · Make the environment a property of the file.** `--env-file` is the right
mechanism, and the change already prepared is correct, with one addition that
turns out to be essential: Node's `--env-file` does not override a variable that
is already set, so `.env` must *not* also be exported into the shell PM2
snapshots — otherwise the snapshot silently outranks the file. Both halves are
required. This prevents the loop.

**2 · Stop the guards disarming themselves.** This is the part not yet
addressed, and it is what cost the investigation its time. A missing environment
currently presents as a database fault, ~400 ms and one misleading error message
away from the truth. The minimal change is to stop inferring "not production"
from an absent `NODE_ENV` when the environment is evidently absent — for example,
treat a missing `DATABASE_URL` *together with* a missing `NODE_ENV` as a
configuration failure rather than a development default, so the validator's
existing, accurate report becomes the thing that stops the boot. Secondary, and
cheap: `schemaAssert` should distinguish "no `DATABASE_URL`" from "database
unreachable" instead of recommending `prisma migrate deploy` for a variable that
was never set.

Fix 1 without fix 2 leaves a system that fails just as opaquely the next time an
environment goes missing for any other reason.
