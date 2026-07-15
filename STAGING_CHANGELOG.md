# CourtAccess — Staging Deployment Changelog

## Program 116 — Authenticated Endpoint Certification (build `5f934df`)

**Bug fixes (authenticated endpoints — all now 200; browser 30/30 pages 0 errors):**
- `contradiction/recommendations/:caseId`: return a valid empty litigation
  summary for an empty case instead of 404.
- New `GET /api/evidence/uploads` list route, registered before
  `/api/evidence/:evidenceId` (the literal `uploads` segment was being captured
  as an evidenceId → 403).
- New `GET /api/cases/:caseId/litigation-strategy`: repository-backed readiness
  score, roadmap, observations, and recommendations from real evidence/charge/
  witness counts (honest empty state; no fabricated content).
- Frontend: Documents, Litigation Strategy, and Usage pages now send the Bearer
  token (they previously fetched without auth → 401/403).

**Result:** the Attorney Workbench, Contradiction Workspace, Narrative Analysis,
Litigation Strategy, Document Management, and Usage Analytics workspaces are all
operational and browser-verified with zero console errors.

---

# CourtAccess — Staging Deployment Changelog (Program 115)

**Program 115 — Live Staging Deployment, Human Review & Production Synchronization**
**Deployed build (frontend):** commit `1827a6d`, build stamp `2026-07-12T15:01:25Z`
**Backend running:** includes the Program 115 auth-plumbing fix (below)
**Staging (ephemeral, this session only):** Cloudflare quick tunnel — see COURTACCESS_STATUS.md

> The public production site (https://courtaccess.net) currently serves an
> older build ("Court Access System"). Everything below is present in the
> current repository / this staging build but has **not** yet been deployed to
> production (requires the deploy secrets — see blockers).

---

## Backend improvements (Programs 114–115)

- **Backend TypeScript certification:** 186 `tsc` errors → **0**. The backend
  previously never type-checked (an invalid async type predicate aborted
  compilation). Includes a real bug fix: the `/api/evidence/upload` route
  passed `s3Key` where the pipeline reads `localPath` (would crash at runtime).
- **Backend ESLint:** added a backend flat config; eliminated all 68 findings.
- **Auth plumbing fix (this program):** added an *optional* authentication hook
  that populates `request.user` from a valid Bearer token when present and
  never rejects. This lets authenticated data routes see the caller identity
  (route-level guards still enforce access). Before this fix, the global auth
  hook was commented out, so every authenticated data API returned 401 and no
  dashboards/case workspaces could load data.
- Removed dead/broken code (`contradictionStorageService`, `tmpTriggerVideo`).

## Frontend improvements (Program 113)

- Repaired a completely broken ESLint config (missing `globals` dependency);
  eliminated all frontend lint findings (0 errors / 0 warnings).
- Typed `EvidenceUpload`, fixed React hook dependency arrays, extracted a
  utility module for a clean Fast Refresh boundary.
- Wired a runnable frontend test runner (`tsx`); determinism test passes.

## Deployment / tooling (this program)

- `scripts/staging-serve.mjs` — zero-dependency static server for `dist/` with
  an `/api` reverse proxy, so the built frontend + backend can be served on one
  origin and exposed through a single tunnel.
- `scripts/program-115-walkthrough.mjs` — Playwright walkthrough that logs in,
  captures full-page screenshots and console errors across public and
  authenticated routes, and writes a JSON verification report.

## Repository improvements

- Backend `lint` / `typecheck` npm scripts added (CI-ready).
- Documented the pre-existing Prisma migration/schema drift finding.

## Known issues surfaced during browser verification

- `/dashboard/usage`, `/cases/:id/documents` → 401 (routes using a separate
  per-route auth extraction not covered by the optional hook).
- `/cases/:id/attorney-workbench`, `/cases/:id/narrative-analysis` → 500
  (intelligence endpoints error on an empty case / missing data).
- `/cases/:id/contradictions`, `/cases/:id/litigation-strategy` → 404
  (endpoints not registered / path mismatch).
- All page **shells render**; the above are failed data fetches, not UI crashes.
