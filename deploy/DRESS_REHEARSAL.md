# Production dress rehearsal

Program 161. **Production was not touched.** The rehearsal ran on alternate
ports (application `3200`, nginx `8081`) under an alternate PM2 process name
(`courtaccess-rehearsal`), against a separate database
(`courtaccess_rehearsal`).

Every step of `EXECUTION_PROCEDURE.md` was executed. The purpose was to find
deployment defects before production sees them, and it found four.

| | |
|---|---|
| Commit rehearsed | `689578a` → fixes applied → re-verified |
| Application port | `3200` (production uses 3000) |
| Web port | `8081` (production uses 80/443) |
| PM2 process | `courtaccess-rehearsal` (production uses `courtaccess`) |
| Database | `courtaccess_rehearsal`, created empty |

---

## Defects found

### D1 — The frontend build fails when `NODE_ENV=production` — **blocker, fixed**

The first run of `deploy/build-release.sh` failed:

```
> tsc -b && vite build
sh: 1: tsc: not found
```

`npm ci` installed 127 packages instead of the expected set. The cause is that
**npm skips `devDependencies` when `NODE_ENV=production`**, and `typescript`,
`vite` and `esbuild` are all devDependencies.

`NODE_ENV=production` is routinely exported on production hosts. This would
have failed on the EC2 instance at the first build, and the error — `tsc: not
found` — points at a missing tool rather than at the real cause, so it would
have cost time to diagnose under pressure.

**Fixed.** `build-release.sh` now unsets `NODE_ENV` for the build and passes
`--include=dev` explicitly. Re-run with `NODE_ENV=production` still set in the
shell: the release assembles.

### D2 — The code selector renders empty with no explanation — **fixed**

`WSB-03` failed against the production artifact behind nginx and had passed
against the development server. The California code dropdown had **zero
options**.

The API was not at fault: `/api/charging/codes` returned all 29 codes in 4 ms
through nginx. The component renders the `<select>` with an empty array until
its fetch resolves, so there is a window in which an attorney sees an empty
dropdown with nothing to explain it. Against the dev server the fetch happened
to win the race; behind nginx it did not.

This was only ever a timing accident. On a slow connection, or if the request
fails, the attorney gets a silently broken control on the page where charges
are entered.

**Fixed.** The selector now shows *Loading the California codes…* while
fetching and *Codes unavailable — reload the page* on failure, and is disabled
until it is populated. The browser check now waits for the options rather than
racing them. Re-run: 23 of 23.

### D3 — `build-release.sh` destroys whatever is at its output path — **fixed**

The script did `rm -rf "$OUT"` unconditionally. During the rehearsal it was
re-run against the live rehearsal directory and removed the `.env` the running
service depended on, along with a locally installed PM2. The service then could
not restart.

On production the same mistake would delete the configuration of a running
deployment.

**Fixed.** The script now refuses if the target contains `.env`, `evidence/` or
`staging/`, on the grounds that those mark a live release rather than a build
directory. Verified: pointing it at a directory containing `.env` exits with
*Refusing to overwrite … That looks like a live release.*

### D4 — PM2 cannot fork if its own installation is removed — **operational note**

After D3 removed the PM2 installed inside the release directory, the running
daemon failed every restart with:

```
Error: Cannot find module '/tmp/rehearsal-release/node_modules/pm2/lib/ProcessContainerFork.js'
```

The daemon holds an absolute path to its own installation. If that path
disappears the daemon survives but can no longer start anything, and the error
names PM2's internals rather than the application, which is misleading.

Not a defect in this repository — but it means **PM2 must not be installed
inside a release directory**. On production it is installed globally, so the
condition does not arise. Recorded so nobody introduces it.

---

## What was rehearsed, and what happened

### 1. Release assembly

```
$ NODE_ENV=production bash deploy/build-release.sh /tmp/rehearsal-release
Release assembled at /tmp/rehearsal-release
  dist/index.js      2.1M
  dist/public/       5 files
  node_modules/      584M
```

Passed after D1 was fixed. Failed before.

### 2. Migrations against an empty database

The full chain has never been run from zero before.

```
$ createdb courtaccess_rehearsal
$ npx prisma migrate deploy
All migrations have been successfully applied.
```

- **116 tables** created
- Drift check returns `-- This is an empty migration.`
- Every Release Candidate table present: `official_statutes`,
  `charging_documents`, `filed_charges`, `certification_upload_sessions`,
  `case_stage_events`, `charge_audit_events`
- `evidence.sha256` column present

No manual intervention was needed. The chain applies cleanly from nothing.

### 3. PM2 on an alternate process and port

```
$ pm2 start dist/index.js --name courtaccess-rehearsal --cwd /tmp/rehearsal-release --time
│ courtaccess-rehearsal │ fork │ online │ 0 restarts │
$ curl 127.0.0.1:3200/api/health → 200
```

### 4. nginx in the production shape

`/api` proxied to the application, static served from `dist/public`,
`proxy_request_buffering off`, 64 MB body limit.

| Request | Result |
|---|---|
| `GET /` | 200 (static) |
| `GET /api/health` | 200 |
| `POST /api/auth/login` | 400 |
| `GET /api/law/status` | 401 |
| `GET /cases` | 200 (SPA fallback) |

### 5. Browser verification against the production artifact

**This path had never been tested.** Every browser suite in this repository had
run against the development server and Vite's dev output. These ran against the
bundled `dist/index.js` behind nginx — the exact configuration production will
use.

| Suite | Result |
|---|---|
| Gold Standard browser | 17 / 17 |
| Charging documents browser | 17 / 17 |
| War room browser | 11 / 11 |
| Upload portal browser | 21 / 21 |
| Complaint workspace browser | 23 / 23 *(after D2)* |
| Strategy workspace browser | 15 / 15 |
| Evidence coverage browser | 12 / 12 |
| **Total** | **116 / 116** |

The upload portal working here matters most: chunked upload through nginx with
`proxy_request_buffering off` is a different path from the development server,
and it is the path Case 001 will take.

### 6. Failed deploy and rollback

A deliberately broken bundle was deployed to see what a bad deploy looks like
and how quickly it can be undone.

```
2. BAD DEPLOY
   status: errored   restarts: 15
   api: 502

3. ROLLBACK (pm2 resurrect from the saved dump)
   recovered in 3s
   health: 200   login: 400   static: 200
```

Confirmed genuinely restored, not cached: `pm2 jlist` shows
`status: online`, `restarts: 0`, script path back at the good release, and
`/api/law/status` returns 401 — a response only the real application produces.

**`pm2 resurrect` from a dump saved before the deploy is the fastest rollback:
three seconds.** Deleting and restarting by hand takes the application's full
startup time, 20–25 seconds. Take the dump before cutting over.

Note that PM2 restarted the broken process **15 times** before giving up. A
crash-looping deploy will generate a burst of restarts; that count is the
signal to roll back, and it is visible in `pm2 list` as the `↺` column.

---

## What the rehearsal did not cover

- **The production host.** This ran in a development environment on Ubuntu with
  nginx 1.24. Production is Amazon Linux 2023 with nginx 1.28. Package
  management, SELinux and file ownership differ.
- **TLS.** The rehearsal served plain HTTP on 8081. Certificate handling and the
  HTTPS redirect are unrehearsed.
- **Safari.** Every browser check above ran in Chromium. The upload portal's
  folder selection uses `webkitdirectory`, which differs across engines, and
  Case 001 is intended to be dragged from Finder in Safari. **This remains the
  single largest untested path.**
- **Production data volumes.** The rehearsal database was empty. Migration time
  against a populated production database was not measured.
- **Cluster mode.** The process ran in `fork_mode`, where `pm2 reload` is a
  restart. Zero-downtime cut-over was not demonstrated because the production
  process model is fork.

---

## Recommendation

The four defects found were all in the deployment path rather than the
application, which is what a rehearsal is for. Three are fixed in this
repository and verified; the fourth is an operational note.

The procedure in `EXECUTION_PROCEDURE.md` now reflects what was actually
observed rather than what was expected. Two changes are worth carrying into the
production run:

1. **Take a `pm2 save` dump immediately before cutting over.** It turns
   rollback from a 25-second restart into a 3-second resurrect.
2. **Watch the restart count.** A crash-looping deploy shows as a rising `↺` in
   `pm2 list` within seconds, well before anyone reports an outage.
