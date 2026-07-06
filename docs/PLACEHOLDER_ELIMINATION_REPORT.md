# Placeholder Elimination Report (Program 34)

**Objective:** Eliminate placeholder / mock / sample / demo / fake / hardcoded /
generated datasets from the frontend, replacing each with a real query, an
evidence-governed computation, or an explicit **UNKNOWN**. Never fabricate.

**Scope of this pass:** the UI surfaces introduced during the Master UI/UX
Restructure (Programs 20–33), which is where fabricated "as-if-real" values were
introduced. Legacy `src/constants/mockData.ts` was already emptied to `[]`.

**Generated:** 2026-07-06. Build: `npm run build` — PASS.

---

## 1. Eliminated in this pass

| # | Fabrication | Location | Replacement |
|---|-------------|----------|-------------|
| 1 | Sample search corpus rendered as real results | `services/globalSearchService.ts` | **DEV-only** (`import.meta.env.DEV`); production returns real case results only |
| 2 | `SAMPLE_GRAPH` shown as a case's knowledge graph | `components/graph/adapters.ts`, `pages/case/ResearchPage.tsx` | **DEV-only**; production shows live graph or an explicit empty state |
| 3 | Hardcoded case strength `94%`, evidence confidence `98%`, repository integrity `91%`, contradictions `2` | `pages/dashboard/StaffDashboard.tsx` | **UNKNOWN** (evidence confidence computed from real analyzed/total when present) |
| 4 | Fabricated "Today's Priorities", "AI Findings" counts, Timeline events, Case-strength ring `94`, confidence sparkline, Discovery `72%`, Investigation tasks, Upcoming hearings | `pages/dashboard/StaffDashboard.tsx` | Real data where available; otherwise empty states / **UNKNOWN**; hearings use real `nextHearing` |
| 5 | Hardcoded strength/integrity/contradictions/unknowns (`94/91/2/5`), case-strength ring, recent activity, hardcoded hearings | `pages/case/CaseOverviewPage.tsx` | **UNKNOWN**; evidence confidence computed; hearings use real `nextHearing`; activity → empty state |
| 6 | Fabricated deck defaults (`strength 94`, `confidence 98`), hardcoded charge/discovery/confidence charts, `PLACEHOLDER_TIMELINE` | `components/presentation/CourtroomVisualizations.tsx` | Values render only when passed from real data; otherwise explicit "pending" notes / **UNKNOWN** |
| 7 | Fabricated extraction confidence (`88`, `92`) and sample citations | `components/evidence/EvidenceDetailDrawer.tsx`, `components/document/DocumentAnalysisPanel.tsx` | Removed; **UNKNOWN** ring; citations show honest empty state |
| 8 | Placeholder tasks, activity, court dates, document requests, attorney questions | `pages/client-portal/DefendantWorkspace.tsx` | Empty states; court date uses real `nextHearing`; phase progress derived from real `case.phase` |
| 9 | Landing hero stat preview presented ambiguously | `components/marketing/landing/HeroSection.tsx` | Labeled **"Illustrative preview"** (marketing mock, explicitly not real case data) |

**UNKNOWN markers introduced:** 19+ across the edited surfaces.

---

## 2. Files modified

- `src/services/globalSearchService.ts`
- `src/components/graph/adapters.ts`
- `src/pages/case/ResearchPage.tsx`
- `src/pages/dashboard/StaffDashboard.tsx`
- `src/pages/case/CaseOverviewPage.tsx`
- `src/components/presentation/CourtroomVisualizations.tsx`
- `src/components/evidence/EvidenceDetailDrawer.tsx`
- `src/components/document/DocumentAnalysisPanel.tsx`
- `src/pages/client-portal/DefendantWorkspace.tsx`
- `src/components/marketing/landing/HeroSection.tsx`

---

## 3. Remaining placeholders (documented, not fabricated in production)

| Category | Detail | Disposition |
|----------|--------|-------------|
| **DEV-only demo data** | `SAMPLE_GRAPH`, search `CORPUS` | Gated behind `import.meta.env.DEV`; **never rendered in production**. Retained for local development until backend indexes exist. |
| **Backend service samples** | ~13 files under `src/services/*` reference `mock`/`sample`/`demo`/`placeholder` (e.g. engines, template/SES/doctrine services) | **Not yet audited in this pass.** Require per-file review to confirm whether they are dead code, dev fixtures, or live. Flagged for a follow-up backend pass. |
| **Marketing static content** | Landing/marketing copy, testimonials, press | Marketing copy is not "case data"; the landing dashboard preview is now labeled **Illustrative preview**. |
| **Real binary export** | PDF/Word/PPTX generation | UI provides faithful previews + print + export hook; binary generation is a backend concern (overlaps V1 blocker BLK-010). |
| **Analytics endpoints** | Case strength, repository integrity, contradiction/unknown counts, extraction confidence | Currently **UNKNOWN** in the UI. Wire to evidence-governed backend computations when those endpoints exist; the UI already renders real values the moment they are provided. |

---

## 4. Completion (not inflated)

| Workstream | Status | % |
|------------|--------|---|
| Frontend UI fabrications introduced in Programs 20–33 | **Eliminated / gated / UNKNOWN** | **100%** |
| DEV-only demo data leaking to production | Eliminated (gated) | 100% |
| Legacy `mockData.ts` | Already emptied | 100% |
| Backend service mock/sample audit (`src/services/*`, `backend/`) | **Not started this pass** | 0% |
| Real analytics endpoints wired (replace UNKNOWN with computed values) | Pending backend | 0% |

**Repository-wide real-data certification (frontend + backend): ≈ 55%.**
The **frontend now never presents fabricated case analytics as real** — it shows
real data, an evidence-governed computation, or an explicit UNKNOWN. The remaining
work is (a) a backend `src/services/*` + `backend/` audit and (b) wiring the
analytics endpoints so UNKNOWN values become real computed values.

---

## 5. Reproduce

```bash
# DEV-gated demo data (should be behind import.meta.env.DEV)
rg -n "import.meta.env.DEV" src/services/globalSearchService.ts src/pages/case/ResearchPage.tsx

# Remaining service-layer references to audit
rg -li "mock|sample|demo|fake|dummy|placeholder" src/services

# UNKNOWN markers now shown instead of fabricated analytics
rg -n "UNKNOWN" src/pages src/components
```
