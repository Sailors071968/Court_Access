# CourtAccess Design Debt & Migration Report (Program 24)

**Method:** Static scan of `src/` on branch `cursor/master-ui-ux-restructure-48a3`.
Documentation only — no code changed by this program.
**Generated:** 2026-07-06.

> Evidence-backed. Counts come from `rg` scans; commands are reproducible.

---

## 1. Repository Surface

| Metric | Count | Source |
|--------|-------|--------|
| React page files (`src/pages/**`) | 93 | `ls src/pages/**/*.tsx` |
| Component files (`src/components/**`) | 51 | `ls src/components/**/*.tsx` |
| Design-system components (Program 18) | 45+ | `COMPONENT_LIBRARY.md` |

---

## 2. Design Debt Findings

| # | Debt category | Files affected | Command |
|---|---------------|----------------|---------|
| D1 | Light-theme surface `bg-white` | **55 / 93 pages** | `rg -l "bg-white" src/pages` |
| D2 | Legacy text color `text-gray-*` | **60 / 93 pages** | `rg -l "text-gray-" src/pages` |
| D3 | Legacy surface `bg-slate-50` / `bg-gray-50` | **53 / 93 pages** | `rg -l "bg-slate-50\|bg-gray-50" src/pages` |
| D4 | Legacy gold via raw `amber-*` (should be `gold`) | **62 / 93 pages** | `rg -l "amber-" src/pages` |
| D5 | Inline `style={{…}}` | **22 pages** | `rg -c "style=\{\{" src/pages` |
| D6 | Duplicate local `Card` / `StatusBadge` definitions | ≥5 pages | `rg -l "function StatusBadge\|const Card =" src/pages` |
| D7 | Duplicate navigation shells | 2 (`Sidebar`, `ClientPortalLayout`) | `rg -l "fixed left-0 top-0\|<aside" src` |
| D8 | Pages importing library barrel `@/components/ui` | **0 / 93** (pre-migration) | `rg -l "components/ui'" src/pages` |
| D9 | Pages fully on dark system (no legacy classes) | **16 / 93** | scan for absence of D1–D3 |

### Interpretation

- **Typography drift (D2):** 60 pages still use `text-gray-*` instead of `text-slate-*` / `text-white`.
- **Color drift (D4):** 62 pages use raw `amber-*` instead of the `gold` token family.
- **Surface drift (D1/D3):** ~55 pages remain light-themed; target is dark `ca-panel` / `bg-navy-*`.
- **Duplication (D6/D7):** local `Card`/`StatusBadge` and a second sidebar duplicate library behavior.
- **Adoption (D8):** the component library exists but pages have not yet imported it — expected, since Program 18 explicitly deferred page migration.

---

## 3. Component Reuse Report

| Component concept | Canonical source | Known duplicates to remove |
|-------------------|------------------|----------------------------|
| Card / StatCard | `components/ui/card.tsx` | local defs in `AttorneyWorkbenchPage`, `CpraDashboard`, `CpraMatrixDashboard`, `PolicyIntelligenceDashboard`, `OperationsCommandCenter` |
| StatusBadge | `components/indicators/indicators.tsx` | inline `StatusBadge` in `AttorneyWorkbenchPage` and dashboards |
| Sidebar / shell | `components/layout/*` | `client-portal/ClientPortalLayout.tsx` (second sidebar) |
| Domain icons | `components/icons/registry.tsx` | direct `lucide-react` domain imports across pages |
| Tabs | `components/ui/tabs.tsx` | inline tab strips (e.g. `AttorneyWorkbenchPage`, `CaseLayout`) |

**Reuse target:** every page imports from `@/components`; zero local re-implementations of
Card, StatusBadge, Tabs, StatCard, or navigation.

---

## 4. Files Requiring Migration (priority order)

### P0 — Flagship & shell (highest visibility)
- `src/pages/case/AttorneyWorkbenchPage.tsx` (Program 20)
- `src/pages/case/InvestigatorWorkbenchPage.tsx` (Program 21)
- `src/pages/dashboard/DefendantDashboard.tsx` + `client-portal/*` (Program 22)
- `src/pages/admin/OperationsCommandCenter.tsx` (Program 23)

### P1 — Case experience (daily use)
- `src/pages/case/*` — `CaseOverviewPage`, `EvidencePage`, `DocumentsPage`, `ChargesPage`,
  `NarrativeAnalysisPage`, `MotionsPage`, `ResearchPage`, `ExpertsPage`, `ActivityPage`,
  `CaseLayout`, `CaseSettingsPage`

### P2 — Admin dashboards (~20 files)
- `src/pages/dashboard/*` — CPRA, policy, evidence, system-health, worker-queue dashboards

### P3 — Auth & onboarding
- `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`,
  `AcceptInvitationPage`, `RoleOnboardingPage`

### P4 — Marketing long-tail
- `src/pages/marketing/*`, `ForDefensePage`, `ForProsecutorsPage`, `GovernmentPage`,
  `CaseStudiesPage`, `ContactSalesPage`, legal pages

---

## 5. Migration Priority Report

| Priority | Bucket | Files (approx) | Rationale |
|----------|--------|----------------|-----------|
| P0 | Flagship + shell | 5 | Most-seen surfaces; set the standard |
| P1 | Case pages | ~14 | Core daily attorney/investigator workflow |
| P2 | Admin dashboards | ~20 | Internal ops; high duplication payoff |
| P3 | Auth/onboarding | ~6 | First-run experience |
| P4 | Marketing | ~25 | Public but lower interactivity |

---

## 6. Estimated Completion

| Workstream | Status | % |
|------------|--------|---|
| Design tokens (dark) | Complete | 100% |
| Icon system (Program 19) | Complete | 100% |
| Component library (Program 18) | Complete | 100% |
| Global shell (AppLayout/Sidebar/Header) | Migrated | 100% |
| Public landing + login | Migrated | 100% |
| **Page migration overall** | 16 / 93 pages dark | **~17%** |
| Programs 20–23 workspace redesigns | Attorney in progress | ~15% |

**Overall UI/UX restructure completion (foundation + pages): ≈ 45%.**
Foundation (Programs 1, 18, 19) is done; the bulk of remaining effort is mechanical page
migration (Phases E–F) plus the four workspace redesigns (Programs 20–23) and final
audit/screenshots (Programs 16–17).

---

## 7. Reproduce this report

```bash
rg -l "bg-white" src/pages | wc -l           # D1
rg -l "text-gray-" src/pages | wc -l          # D2
rg -l "bg-slate-50|bg-gray-50" src/pages | wc -l  # D3
rg -l "amber-" src/pages | wc -l              # D4
rg -c "style=\{\{" src/pages | wc -l          # D5
rg -l "function StatusBadge|const Card =" src/pages  # D6
```
