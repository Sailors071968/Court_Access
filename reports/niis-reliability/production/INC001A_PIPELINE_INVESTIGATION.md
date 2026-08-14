# INC-001A — Can PR #167 ship through the existing deploy pipeline?

**Measured:** 2026-08-14T12:50Z  
**Discipline:** Release Engineering  
**Status:** OPEN  

## Verdict

**No. The existing GitHub deployment workflow cannot deploy PR #167’s INC-001 API fix to the production Node process.**

| Question | Answer | Evidence |
|---|---|---|
| Can PR #167 be deployed through the existing GH workflow as written? | **No** (API / INC-001 fix) | Workflow is **frontend website** only → `/opt/courtaccess`; does not restart API PM2 |
| Is direct host access (SSH or equivalent on-box procedure) required for the API fix? | **Yes** | No backend/API deploy job exists in `.github/workflows/` |
| Was PR #167 merged into the production deploy branch (`dev`)? | **No** | `mergedAt: null`, state `OPEN`; base is `cursor/gold-standard-upload-portal-9f94`, not `dev` |
| Did the deploy workflow trigger for this PR / fix? | **No** | Zero `Deploy Production Website` runs since 2026-08-01; last runs 2026-07-05 |
| If it triggered historically, did it succeed? | **No** | Last 3 runs: all `failure`; latest failed `Error: missing server host` (empty `DEPLOY_HOST` / key) |
| What artifact would it deploy if it succeeded? | Frontend `dist/` under `/opt/courtaccess` | `scripts/deploy-production-website.sh` — nginx reload + optional `courtaccess-frontend` PM2 |

**Issue class:** combination of **Git workflow gap** + **CI/CD configuration gap** (+ historical **execution failure** on the website path). Not an NIIS product bug.

---

## Q1 — Was PR #167 merged into the branch production deployment uses?

**No.**

| Fact | Value | Source |
|---|---|---|
| PR | [#167](https://github.com/Sailors071968/Court_Access/pull/167) | `gh pr view 167` |
| State | `OPEN` | |
| `mergedAt` | `null` | |
| PR base | `cursor/gold-standard-upload-portal-9f94` | |
| PR head | `cursor/prod-pipeline-first-fail-54dc` @ `731e841…` | |
| Repo default / deploy branch | `dev` | `gh repo view` → `defaultBranchRef.name` |
| Fix commit `cdaa823` on `origin/dev`? | **No** (`merge-base --is-ancestor` exit 1) | |
| Fix commit on gold-standard base? | **No** | |
| Remotes containing `cdaa823` | **Only** `origin/cursor/prod-pipeline-first-fail-54dc` | `git branch -r --contains cdaa823` |

Production deploy workflow watches **`dev` only**. PR #167 was never merged there.

---

## Q2 — Did the deployment workflow trigger?

**Not for PR #167 / August 2026.**

| Fact | Value | Source |
|---|---|---|
| Workflow | `Deploy Production Website` (`.github/workflows/deploy-production.yml`) | |
| Triggers | `push` to `dev` (path-filtered) · `workflow_dispatch` | |
| Runs since 2026-08-01 | **0** | `gh run list` |
| Last runs | 2026-07-05 only (3 runs) | |

Path filter on push **excludes** `backend/**`. INC-001 files are under `backend/src/...`. Even a future merge to `dev` that only changed backend would **not** trigger this workflow unless other listed frontend paths also changed.

`workflow_dispatch` exists, but the **deploy job** is gated:

```yaml
if: github.ref == 'refs/heads/dev'
```

So dispatch must run on `dev`, and still only runs the website script.

---

## Q3 — If it triggered, did it complete successfully?

**Last triggers (2026-07-05): all failed.**

| Run | Conclusion | Notes |
|---|---|---|
| [28748544732](https://github.com/Sailors071968/Court_Access/actions/runs/28748544732) | failure | Verify job **success**; Deploy job **failure** |
| 28748426281 | failure | |
| 28748098984 | failure | |

Latest deploy log (2026-07-05T17:13:53Z):

- `INPUT_HOST:` empty  
- `INPUT_KEY:` empty  
- CLI: **`Error: missing server host`**

So the website pipeline’s SSH step lacked `DEPLOY_HOST` / `DEPLOY_SSH_KEY` (or they were unset in the Actions environment) at last execution. **CI/CD configuration / secrets problem.**

---

## Q4 — If it completed, what artifact did it deploy?

It did **not** complete successfully in recorded history. By design, a successful run would:

1. SSH to the host  
2. `cd /opt/courtaccess` · `git checkout/pull origin/dev`  
3. Run `scripts/deploy-production-website.sh`:
   - `npm ci` (+ `backend && npm ci` for install only)
   - **`npm run build`** (frontend)
   - reload nginx for `$DEPLOY_DIR/dist`
   - optional `pm2 restart courtaccess-frontend`
4. Smoke: HTML contains “Criminal Case Intelligence Platform”

**It does not:**

- Build/restart the **API** PM2 app (`courtaccess` / `src/server.ts` under `/var/www/courtaccess` per cutover docs)
- Run Prisma migrate for API
- Verify `/api/health` commit SHA

`Publish Dist Artifact` is also frontend-only (tarball of `dist/`).

---

## Q5 — If it did not trigger, why not?

For INC-001 / PR #167 specifically:

1. **PR not merged to `dev`** (deploy branch)  
2. **PR targets a different base** (`gold-standard…`)  
3. **Fix lives only on the feature branch**  
4. **Path filters omit `backend/**`** — API fix would not wake this workflow even on `dev` without frontend path noise  
5. Therefore **no opportunity** for this workflow to place `cdaa823` on the API

---

## Classification

| Class | Applies? | Detail |
|---|---|---|
| Git workflow problem | **Yes** | Fix never landed on `dev`; PR open against non-deploy base |
| CI/CD configuration problem | **Yes** | Website-only deploy; no API job; path filters exclude backend; deploy job secrets were empty on last run |
| Deployment execution problem | **Partial** | Website deploy last attempted July 5 and failed before SSH; **no execution attempt** for PR #167 |

---

## Runtime cross-check (still wrong build)

`GET https://courtaccess.net/api/health` @ 2026-08-14T12:50:37Z:

```json
{"commit":"b52e9aad…","version":"1.1.0","uptimeSeconds":330538,"environment":"production"}
```

Still **not** `cdaa823`. Uptime ~91.8h from sample → process still predates any August deploy of the fix.

---

## What is required to close INC-001A

The existing pipeline **as written cannot** put the INC-001 fix into the running API. Release options (mechanism is a release decision; evidence gate is not):

1. **On-box / SSH (or console) procedure** against the API install directory PM2 actually uses: checkout SHA containing `cdaa823` → build/migrate as needed → restart API PM2 → verify `/api/health` commit  
2. **Or** extend CI/CD with a real **API deploy workflow** (out of scope for “use existing pipeline” — that would be new release engineering work)

Either path must produce a **Deployment Verification Report** (see `DEPLOYMENT_VERIFICATION_REPORT_TEMPLATE.md`) before INC-001 operational PDF validation.

Do **not** debug `uploadedBytes` on `b52e9aad` further.
