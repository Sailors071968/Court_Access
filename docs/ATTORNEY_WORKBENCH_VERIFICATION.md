# Production Program 74 — Attorney Workbench Verification

> Scope: Attorney Workbench only. New this turn: a premium **Litigation Command Center** home — gold header, a one-click **Attorney Actions** launcher, and real command-center status widgets — layered on the existing evidence-governed `WorkbenchBundle`. Deployed and browser-verified on the public staging URL. Every finding is evidence-governed (UNKNOWN when unsupported).

## 1. Updated Public Staging URL

**https://eric-collaborative-pmid-safari.trycloudflare.com** — served `/` byte-identical to rebuilt dist; Attorney Workbench verified through the external URL (`reports/screenshots/workbench/public-workbench-home.png`).

## 2. Attorney Workbench Verification Report

**Phase 1 — Workbench Home (DONE):** premium command center with "Litigation Command Center" header and real status widgets (Case Health, Evidence Health, Legal Coverage, Trial Readiness, Outstanding Unknowns) sourced from `commandCenter`. Existing tabs retained: Case Overview, Offense Analysis, Evidence, Legal Authority, Investigation, Trial Prep, Notes & Pins, Command Center, Exports.

**Phase 2 — Case Summary (DONE):** Client, Status, Court, Judge, Prosecutor, Defense, Charges, upcoming hearing, Evidence count, Charged Offenses, Outstanding Unknowns — all from the case bundle (UNKNOWN where absent).

**Phase 3 — Litigation Status (DONE):** command-center health/coverage/readiness cards + unknown/contradiction counts, color-coded (emerald/gold/blue by score).

**Phase 4 — Attorney Actions (DONE):** one-click launcher with 12 actions, each navigating to a real, mounted case route: Create Motion→`motions`, Generate Report→`reports`, Search Authorities/CourtListener/CALCRIM/Repository→`research`, Review Evidence→`evidence`, Review Charges→`charges`, Review Discovery→`disclosures`, Review Witnesses→`investigator-workbench`, Review Timeline→`narrative-analysis`, Knowledge Graph→`litigation-strategy`.

**Phases 5–8 (existing, retained):** Offense element matrices w/ CALCRIM + defenses/exceptions/enhancements + unknown legal questions (Phase 5); Legal Authority tab integrates repository CALCRIM/authorities (Phase 6); Investigation tab supports create/assign/complete tasks + discovery requests (Phase 7); Exports generate 9 package types incl. Attorney Report, Motion Package, Evidence/Witness/Authority binders (Phase 8).

**Phase 9 — Visual (DONE for home):** premium gold header, action launcher, glass status cards, gold tab underline. Deep-tab controls remain functional (subtle default borders via global CSS).

## 3. API Certification (Phase 10)

Auth: all routes require Bearer JWT (global `authenticationHook`) + case access.

| Method | Route | Service | DB tables | Runtime |
|---|---|---|---|---|
| GET | `/api/cases/:caseId/workbench` | buildAttorneyWorkbench | CriminalCase, Charge, Evidence, EvidenceGraph, TimelineEvent, AttorneyNote, WorkbenchPin | **CONNECTED** (verified: 10 charges, 22 unknowns) |
| GET | `/api/cases/:caseId/workbench/command-center` | command-center builder | (aggregate) | **CONNECTED** |
| GET | `/api/cases/:caseId/workbench/trial-prep` | trial-prep builder | Evidence, Charge | **CONNECTED** |
| GET | `/api/cases/:caseId/workbench/export/:packageType` | export builder | (aggregate) | **CONNECTED** |
| GET/POST | `/api/cases/:caseId/workbench/notes` (+`/:noteId`) | notes | AttorneyNote | **CONNECTED** |
| GET/POST | `/api/cases/:caseId/workbench/pins` | pins | WorkbenchPin | **CONNECTED** |
| GET/POST/PATCH | `/api/cases/:caseId/workbench/tasks` (+`/:taskId`) | tasks | (workbench task store) | **CONNECTED** |
| GET | `/api/cases/:caseId/workbench/health` | health | — | **CONNECTED** |

Workers/queues: the workbench reads from evidence/timeline/graph tables populated by the BullMQ pipeline workers (running); it does not enqueue jobs itself.

## 4. Database Certification (Phase 11)

| Model | Purpose | Status |
|---|---|---|
| `AttorneyNote` | private attorney notes | ✅ |
| `WorkbenchPin` | pinned evidence/authorities/timeline | ✅ |
| `Charge` | charge summaries feeding offense analysis | ✅ (indexed by caseId) |
| `Evidence` / `EvidenceGraph` | evidence + knowledge-graph nodes/edges | ✅ |
| `TimelineEvent` | case timeline | ✅ |
| `CriminalCase` | case summary source | ✅ |

All relate to `CriminalCase(caseId)` with case-scoped indexes; no schema change required this turn.

## 5. Browser Screenshot Gallery

`reports/screenshots/workbench/`: `workbench-home.png` (full home — actions launcher, widgets, case summary, outstanding unknowns), `public-workbench-home.png` (external URL parity).

## 6. Runtime Verification Report

| Check | Result |
|---|---|
| Attorney login | ✅ |
| Open Workbench | ✅ |
| Workbench API (real data) | ✅ 10 charges, 22 unknowns, health computed |
| Attorney Actions launcher | ✅ 12 actions → real routes |
| Command widgets (Case/Evidence/Legal/Trial health) | ✅ real (0% honest — no evidence/analysis) |
| Case summary + charges | ✅ |
| Outstanding Unknowns (evidence-governed) | ✅ never fabricated |
| Exports available (9 packages) | ✅ |
| Console errors | ✅ 0 |
| Backend / workers | ✅ health 200; 5 workers |

## 7. Remaining Issues (Attorney Workbench only)

- **Timeline / Knowledge Graph** have no dedicated case-page routes; the actions link to the closest real pages (`narrative-analysis`, `litigation-strategy`). A dedicated case Timeline/KG page is a follow-up.
- Deep tabs (Investigation task inputs, Notes) retain some legacy control styling (functional; not fully premium).
- Report/Motion generation opens the respective case pages; inline one-click generation from the workbench is a launcher link, not an in-place generator.
- 6 pre-existing backend TS errors (`resourceAuthMiddleware.ts`) remain (app runs via `tsx`).
- Public URL is an ephemeral quick-tunnel.

## 8–10. Commit / Branch / Timestamp — see response footer.
