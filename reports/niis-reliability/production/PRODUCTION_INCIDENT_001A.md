# INC-001A — Production Deployment Failure

**Discipline:** Release Engineering / DevOps  
**Severity:** Critical (blocks all INC-001 validation)  
**Status:** OPEN  
**Opened:** 2026-08-12  

**Not** an NIIS problem. **Not** a parser/comparison/architecture problem.

## Relationship to INC-001

| Incident | Scope |
|---|---|
| INC-001 | File ingestion bug (multipart deadlock) — **software engineering COMPLETE** |
| **INC-001A** | **Production not running the INC-001 fix** — **release engineering OPEN** |
| INC-002 | CSV worker drain — blocked until INC-001 validated on production |

INC-001 cannot be closed until INC-001A is closed.

## Symptoms

| Signal | Expected | Actual |
|---|---|---|
| Production git commit (`GET /api/health`) | `cdaa823` (or PR #167 tip containing it) | **`b52e9aad`** |
| Process uptime | Restart after 2026-08-12T19:04Z fix | **~50.5h** — process start ≈ **2026-08-10T17:02Z** (predates fix) |
| `importJobMultipartUpload.ts` at prod commit | Present | **Absent** |
| PR #167 validated on production | Yes | **Cannot be validated** |

## Investigation scope (ONLY these questions)

1. Why is production still on `b52e9aad`?
2. Did deployment fail?
3. Did deployment never run?
4. Did PM2 restart the wrong directory?
5. Is nginx proxying to the wrong Node instance?
6. Is the build artifact stale?
7. Is there more than one CourtAccess installation on EC2?

**Out of scope:** upload semantics, parser, comparison, NIIS features, architecture.

## Single primary question

> Show me exactly what code PM2 is executing.

Required host fields (when SSH available):

| Field | Purpose |
|---|---|
| `pm2 describe <app>` → cwd | Working directory |
| `pm2 describe` → script / exec cwd | Script path |
| `git -C <cwd> rev-parse HEAD` | Git hash in that directory |
| ecosystem file path + contents | Intended app definition |
| PID | Running process |
| `/proc/<pid>/exe` and `/proc/<pid>/cwd` | Actual executable / cwd |
| Compare HEAD to `cdaa823` | Deploy success criterion |

If those do not point at a tree containing `cdaa823`, the deployment issue is found.

## Evidence available without host shell

### A. Deployment of PR #167 never ran (high confidence)

1. **GitHub Actions `Deploy Production Website`** (`.github/workflows/deploy-production.yml`):
   - Triggers only on push to branch **`dev`**
   - Deploys via SSH to **`/opt/courtaccess`**
   - Runs **`scripts/deploy-production-website.sh`** (frontend/website path)
   - Does **not** merge or deploy PR branch `cursor/prod-pipeline-first-fail-54dc`
2. **PR #167** base = `cursor/gold-standard-upload-portal-9f94`, state **OPEN** — not merged to `dev` or production cutover tip
3. Therefore: **no automated pipeline was asked to put `cdaa823` on the API host**

**Answer so far to Q3 (“Did deployment never run?”): YES — for PR #167 / fix `cdaa823`, deployment never ran.**

### B. Running process predates the fix (API self-report)

| Field | Value | Source |
|---|---|---|
| commit | `b52e9aadfa35c3547327985bd13e411f217ae0e9` | `/api/health` |
| uptimeSeconds | ~182302 (~50.6h) at 2026-08-12T19:40Z | `/api/health` |
| inferred start | ≈ 2026-08-10T17:02Z | uptime back-calc |
| fix committed | 2026-08-12T19:04:06Z | `cdaa823` |

Process lifetime **predates** the fix commit → either never deployed, never restarted onto new code, or wrong instance.

### C. Known install locations (from repo deploy scripts — not yet confirmed on host)

| Path | Role (from scripts) |
|---|---|
| `/var/www/courtaccess` | Cutover production root; API cwd `{PROD_DIR}/backend`, script `src/server.ts` via `tsx` |
| `/var/www/courtaccess-v1` | V1 greenfield / alternate |
| `/opt/courtaccess` | GH Actions website deploy directory |
| PM2 app name (cutover) | `courtaccess` / `${PM2_PROD_APP}` |
| Ecosystem | `/var/www/courtaccess/ecosystem.production.config.cjs` |
| Uploads path (health) | `/var/lib/courtaccess-v1/evidence` ← suggests **v1** data plane may be live |

**Multiple installation paths exist in the release scripts.** Host inspection must determine which one PM2 actually runs. That is the core INC-001A measurement.

### D. Host PM2 inspection

**BLOCKED** — this agent has no SSH (`Permission denied (publickey)`).  
INC-001A remains open until someone with host access records the PM2 table above.

## Provisional answers

| Question | Provisional answer | Confidence |
|---|---|---|
| Why still on `b52e9aad`? | No release path applied PR #167 to the API process | High |
| Did deployment fail? | No evidence of a failed attempt; none started for this PR | Medium-High |
| Did deployment never run? | **Yes** for PR #167 | High |
| PM2 wrong directory? | Unknown — needs host | Blocked |
| Wrong nginx upstream? | Unknown — needs host | Blocked |
| Stale artifact? | API commit self-report is authoritative for running code; tree at that commit lacks fix | High for “stale/wrong revision” |
| Multiple installs? | Scripts define ≥3 roots; host must enumerate | Suspected |

## Exit criteria for INC-001A

1. Host evidence: PM2 cwd + script + `git rev-parse HEAD` in that tree  
2. That HEAD **equals** `cdaa823` or a descendant containing the multipart fix  
3. `GET /api/health` → `commit` matches that HEAD  
4. Process start time **after** deploy  
5. Then hand back to INC-001 closure Tests 1–11 (upload real PDF, etc.)

## Explicitly not doing

- NIIS feature work  
- Parser / comparison accuracy  
- Re-debugging `uploadedBytes=0` on `b52e9aad`  
- Mixing INC-002 into this incident  
