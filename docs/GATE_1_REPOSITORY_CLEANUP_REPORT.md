# Master Production Gate 1 — Repository Cleanup Report

**Status:** EXECUTED (static analysis + verified removals).
**Verification:** Frontend `tsc --noEmit -p tsconfig.app.json` → 0 errors; `vite build` → success (1675 modules, 3.96s) **after** all removals. Dead backend files had 0 importers (removal cannot create dangling imports).
**Constitution:** Only files provably unreferenced across the entire repository were removed. Nothing ambiguous was deleted; deeper consolidation candidates are listed as recommendations, not executed blindly.

## Summary

| Metric | Value |
|--------|-------|
| Files removed | **75** |
| Lines removed | **~18,300** |
| Frontend source removed | ~552 KB (68 orphan modules) + `frontend/` stub (4 files) + `DefendantDashboard.tsx` (1,030 lines) |
| Backend files removed | 2 dead route files |
| Build after cleanup | ✅ passes (frontend typecheck + production build) |

## Detection method

An orphan detector (`readFileSync` + reference scan) walked `src`, `tests`, `workers`, `scripts`, and `backend/src`, then flagged every `src` TypeScript/TSX module whose filename is **not referenced by any import specifier anywhere else in the repository** (barrels and entry points `main.tsx`/`App.tsx` excluded). Backend candidates were separately confirmed to be unregistered in `server.ts` and imported by zero files. Every removal was then validated by a clean frontend typecheck and a successful production build.

## Files removed

### Demo / placeholder data (Constitution: "no demo data")
- `src/constants/mockData.ts` — mock dataset, unreferenced.
- `src/components/common/DemoModeBadge.tsx`, `src/pages/DemoRequestPage.tsx` — demo UI, unrouted.

### Orphaned frontend "engine"/service logic (54 files, never wired to UI)
Frontend business-logic modules with zero importers, e.g.:
`driftDetectorEngine`, `interpretationGuardEngine`, `auditTraceEngine`, `merkleProofEngine`, `bounceHandlerEngine`, `escalationAutomationEngine`, `crossCaseVariationEngine`, `agencyReviewQueueEngine`, `analysisExportEngine`, `structuredIssueIndexEngine`, `issueIndexEngine`, `annotationEngine`, `deviationEngine`, `ingestionService`, `officerIndexEngine`, `monitoringSnapshotHashEngine`, `creditLedgerEngine`, `policyComparisonEngine`, `mediaAlignmentEngine`, `calcrimMappingEngine`, `purgeService`, `attorneyAccessControlEngine`, `attorneyOnboardingEngine`, `dailyIntegrityJobRunner`, `caseVersionEngine`, `attorneyApprovalEngine`, `agencyCrawlerEngine`, `templateRenderEngine`, `refusalEngine`, `sesDispatchService`, `riskEventLedger`, `modelVersionEngine`, `portfolioAggregationEngine`, `onboardingEventLedger`, `acquisitionEventLedger`, `sesSnsWebhookController`, `documentIntegrityEngine`, `outputConstitutionEngine`, `tenantBoundaryEngine`, `exportProvenanceEngine`, `riskGuardEngine`, `agencyValidationEngine`, `uploadValidationService`, `restoreService`, `freezeStateEngine`, `constitutionalAuditEngine`, `aiProcessingIsolationEngine`, `abuseProtectionEngine`, `collaborationAccessEngine`, `extractionEngine`, `authService`, `intelligenceEngine`, `prosecutionAnalysisEngine`, `riskScoringEngine`.

> These represent frontend-resident logic that duplicated (or pre-empted) backend responsibilities and was never imported by any page/component. Backend equivalents (auth, ingestion, extraction, audit, tenant isolation) remain the source of truth.

### Orphaned pages (unrouted in `App.tsx`)
- `src/pages/DashboardPage.tsx`, `src/pages/NotFoundPage.tsx`, `src/pages/case/CourtroomView.tsx`, `src/pages/DemoRequestPage.tsx`.
- `src/pages/dashboard/DefendantDashboard.tsx` — 1,030-line dashboard superseded by `src/pages/client-portal/DefendantWorkspace.tsx`; not wired.

### Orphaned components
- `src/components/evidence/ResumableUploader.tsx`, `EvidenceUploadPanel.tsx`
- `src/components/case/ClientEvidenceViewer.tsx` (built, never routed)
- `src/components/LegalDisclaimer.tsx`, `src/components/layout/Container.tsx`, `src/components/marketing/landing/FeatureCard.tsx`

### Orphaned utilities / assets
- `src/utils/routeValidator.ts`, `src/assets/3d-objects/objectLibrary.ts`

### Duplicate / obsolete build target
- `frontend/` (4-file demo stub: `App.tsx`, `main.tsx`, `lib/api.ts`, `services/videoService.ts`) — not part of the product build (root `vite`/`index.html`/`src`), no config, not referenced by CI/deploy.

### Dead backend routes
- `backend/src/routes/evidenceRoutes.ts` — legacy, 0 exports, unregistered (superseded by `backend/src/evidence/evidenceRoutes.ts`).
- `backend/src/narrative/narrativeRoutes.ts` — back-compat re-export imported by nothing (`server.ts` imports `registerNarrativeIntelligenceRoutes` directly from `intelligence/intelligenceRoutes.ts`).

## Recommendations NOT auto-executed (require deeper review)

To honor "deterministic execution" and avoid breaking dynamic behavior, the following were **identified but left in place** pending owner review:

1. **Bundle splitting** — production JS bundle is 1.65 MB (399 KB gzip); a single chunk. Recommend `manualChunks` / route-level `dynamic import()` (feeds Gate 9).
2. **Legacy light-theme components in `src/components/common/`** — coexist with the newer `src/components/ui/` design system; consolidation is a UI concern (Gates 4/17), not dead code.
3. **Backend service consolidation** — several overlapping extraction/graph services exist; merging them changes runtime wiring and needs targeted tests before removal.

## Dependency-graph note

No circular dependency was introduced (removals only delete leaf/unreferenced modules). A full import-graph/circular-dependency analysis is scoped under Gate 2.
