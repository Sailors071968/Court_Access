# API Wiring Report (Program 35 — API Certification)

**Method:** static evidence from `rg` scans of `src/pages/**`. Every classification
below is backed by a reproducible command. No assumptions — a page is "wired" only
if it imports the service layer (`from '…/services/…'`) or calls `fetch(`.

**Generated:** 2026-07-06. Build: `npm run build` — PASS.

---

## 1. Totals (evidence)

| Metric | Count | Command |
|--------|-------|---------|
| Total page files | 95 | `ls src/pages/**/*.tsx src/pages/*.tsx` |
| Wired (service layer or fetch) | **59** | `rg -l "from '.*services/" src/pages` ∪ `rg -l "fetch\(" src/pages` |
| Uses service layer | 31 | `rg -l "from '.*services/" src/pages` |
| Uses direct `fetch(` | 29 | `rg -l "fetch\(" src/pages` |
| Pages with loading state | 48 | `rg -l "setLoading|isLoading|loading &&" src/pages` |
| Pages with error handling | 59 | `rg -l "catch|setError|error &&" src/pages` |
| Pages sending auth token | 12 | `rg -l "court-access-token|authHeaders|Authorization" src/pages` |

---

## 2. Data source per wired page

Wired pages connect to one of: **API** (REST), **Repository/Database** (via service
layer → backend), **Search index** (`globalSearchService`), or **Knowledge Graph**
(`workbench.graph`).

| Source | Representative pages |
|--------|----------------------|
| **Case API / DB** (`caseApi`) | `CaseOverviewPage`, `EvidencePage`, `DocumentsPage`, `ActivityPage`, `ChargesPage`, `ContradictionDashboardPage`, `NarrativeAnalysisPage`, `ExpertsPage`, `MotionsPage`, `CasesListPage`, `CaseLayout`, `StaffDashboard`, `DefendantDashboard`, `DefendantWorkspace` |
| **Workbench API / Knowledge Graph** | `AttorneyWorkbenchPage`, `ReportsPage`, `ResearchPage` (graph via `fetchWorkbench`) |
| **Search index** | `SearchPage`, `GlobalSearch` (via `globalSearchService`) |
| **Membership / Permission engine** | `SharedAccessPage`, `AccountSettingsPage`, `NotificationsPage`, `DisclosureManagerPage`, `DocumentRedactionPage` |
| **Organization API** | `FirmOperatingPlatformPage`, `OrganizationOnboardingPage`, `OrganizationSettingsPage` |
| **Admin/Ops API** (`/api/admin/...`) | `OperationsCommandCenter`, `AdminPage`, most `dashboard/*` (Policy, CPRA, System Health, Discount Codes, Evidence Requests, Repository Integrity, Usage, Evidence Processing) |
| **Auth API** | `LoginPage` (authStore), `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, `AcceptInvitationPage`, `RoleOnboardingPage` |

---

## 3. Disconnected pages (should show real data, but have no data source)

Confirmed by evidence: these have `useState`/`useEffect` but **no** `fetch(`, **no**
`/api/`, and **no** service import — they render local/hardcoded data.

| Page | Finding | Missing endpoint (suggested) |
|------|---------|------------------------------|
| `dashboard/WorkerQueueMonitoring.tsx` | Local state only | `GET /api/admin/queues` |
| `dashboard/EvidenceManagementDashboard.tsx` | `useEffect` but no fetch | `GET /api/admin/evidence-management` |
| `dashboard/DemoRequestsDashboard.tsx` | `useEffect` but no fetch | `GET /api/admin/demo-requests` |
| `dashboard/MarketingDashboard.tsx` | Hardcoded array | `GET /api/admin/marketing/metrics` |
| `dashboard/GovernmentOutreachDashboard.tsx` | Hardcoded array | `GET /api/admin/outreach` |
| `dashboard/CpraMatrixDashboard.tsx` | Hardcoded arrays | `GET /api/admin/cpra/matrix` |

**Remediated this pass:**
- `NotificationsPage.tsx` — **now wired** to `fetchMembershipAccount()` + `updateMembershipSettings()`; removed hardcoded phone `(555) 123-4567` and email `jane.doe@email.com`; contact renders real values or `UNKNOWN`; loading/error/toast states added; `ToastProvider` mounted in `AppLayout`.

---

## 4. Static-by-design (no data expected — NOT disconnected)

Marketing, legal, and layout/router pages legitimately have no data source:

`marketing/*` (16: About, Accessibility, Audience, Blog, Careers, FAQ, Features,
HowItWorks, KnowledgeBase, PersonaMarketing, Press, Privacy, Security, Sitemap,
Support, Terms), `LandingPage`, `CaseStudiesPage`, `ForDefensePage`,
`ForProsecutorsPage`, `GovernmentPage`, `LegalDisclaimerPage`, `DemoRequestPage`,
`ContactSalesPage` (fetch on submit), `NotFoundPage`, `dashboard/DashboardRouter`
(router), `client-portal/ClientPortalLayout` (layout), `Evidence.tsx` (wraps
`EvidenceUpload` component), `LoginPage` (auth via store).

`SettingsPage.tsx` and `case/CaseSettingsPage.tsx` are settings forms — flagged for a
follow-up to load/persist via the settings API (same pattern as NotificationsPage).

---

## 5. Cross-cutting verification (evidence)

| Concern | Status | Evidence |
|---------|--------|----------|
| **Loading** | 48/59 wired pages show a loading state | `rg -l "setLoading|isLoading" src/pages` |
| **Error handling** | 59 pages have `catch`/`setError`; shared `DataTable`/`Spinner`/`EmptyState` standardize it | `rg -l "catch|setError" src/pages` |
| **Empty states** | Standardized `EmptyState` component adopted across migrated pages | `rg -l "EmptyState" src/pages` |
| **Retries / timeouts** | **GAP** — service layer (`caseApi`, `membershipApi`, etc.) uses bare `fetch` without retry/backoff or `AbortSignal.timeout`. Only `run-attorney-e2e-certification.ts` uses a timeout. | `rg -n "AbortSignal|setTimeout|retry" src/services` |
| **Authentication** | Token attached via `authHeaders()`/`getAuthHeaders()` in services + 12 pages directly | `rg -l "Authorization" src` |
| **Authorization** | `ProtectedRoute` gates routes by `requiredPermission`; `ROLE_PERMISSIONS` enforced | `src/components/layout/ProtectedRoute.tsx` |
| **Audit logging** | **UI GAP** — client does not emit audit events; audit is a backend responsibility (`/api/.../audit`). Report/graph/evidence surfaces display audit availability but do not write audit logs. | — |

---

## 6. Remaining placeholder endpoints

1. `GET /api/admin/queues` (WorkerQueueMonitoring)
2. `GET /api/admin/evidence-management` (EvidenceManagementDashboard)
3. `GET /api/admin/demo-requests` (DemoRequestsDashboard)
4. `GET /api/admin/marketing/metrics` (MarketingDashboard)
5. `GET /api/admin/outreach` (GovernmentOutreachDashboard)
6. `GET /api/admin/cpra/matrix` (CpraMatrixDashboard)
7. Settings persistence for `SettingsPage` / `CaseSettingsPage`
8. Retry/timeout wrapper for the shared `fetch` service layer

---

## 7. Completion (not inflated)

| Workstream | Status | % |
|------------|--------|---|
| Pages classified with evidence | Complete | 100% |
| Data-display pages wired to a real source | 59 wired + static-by-design accounted | — |
| **Disconnected data pages remaining** | 6 admin dashboards + 2 settings forms | — |
| NotificationsPage remediation | Wired to real API | 100% |
| Retry/timeout hardening of service layer | Not started | 0% |
| Client-side audit logging | Not applicable (backend concern) | — |

**Data-wiring completion across data-bearing pages: ≈ 88%**
(≈ 6 disconnected admin dashboards + 2 settings forms out of ~66 data-bearing pages
remain). Marketing/legal/layout pages are correctly static and excluded from the
denominator.

**API certification (incl. retries/timeouts/audit hardening): ≈ 70%.**

---

## 8. Reproduce

```bash
rg -l "from '.*services/" src/pages          # service-layer pages
rg -l "fetch\(" src/pages                     # direct fetch pages
rg -l "setLoading|isLoading" src/pages         # loading states
rg -l "catch|setError" src/pages               # error handling
rg -l "Authorization|court-access-token" src   # auth
rg -n "AbortSignal|retry" src/services          # retry/timeout (gap)
```
