# Master Program 1 — Repository Consolidation & Production Cleanup Report

> Deterministic analysis (`scripts/repo-consolidation-analysis.mjs`) + build-verified removals. No estimation; entry points (tests, CLIs, npm-script targets, workers, dynamically-registered routes) are excluded from "dead" so nothing reachable is removed. Frontend removals were verified by `tsc -b` + `vite build`.

## Executed removals (this program)

| Wave | Removed | Verification |
|------|---------|--------------|
| Frontend orphans (transitive, 4 waves) | **65 files / ~14,750 lines** | `tsc --noEmit` + `vite build` ✅ |
| Experimental temp file | `backend/src/tmpTriggerVideo.ts` (TEST SCRIPT, 0 refs) | unreferenced ✅ |
| **Total** | **66 files** | build green |

Removed frontend (by area): **45× `src/models/*Model.ts`** (an entire unused frontend model layer), **14× `src/services/*Engine.ts`/`*Service.ts`** (never-wired business-logic engines), **3 orphan pages** (`SettingsPage`, `TimelineViewer.jsx`, `Evidence.tsx`), `src/lib/api.ts` (superseded helper), plus one stray component/constants file. Each was confirmed unreferenced across the whole repo and the production build still succeeds.

> Combined with the earlier Gate 1 cleanup (75 files), this branch has removed **141 dead files**.

## Canonical implementation findings

- **Duplicate API endpoints:** **0** (no method+route registered more than once — `docs/consolidation/duplicates.json`).
- **Duplicate Prisma `@@map`:** **0** (no two models map to the same table). One model (`Charge`) lacks an `@@map` (maps to table `Charge`) — a naming inconsistency, not a duplicate; left untouched (schema/DB stability).
- **Duplicate service basenames:** 1 (documented in `duplicates.json`) — same filename in two locations; flagged for manual canonicalization, not auto-merged (behavioral risk).
- **Demo/placeholder logic:** the demo corpus, `mockData.ts`, and demo pages were already removed in Gate 1; no new demo logic detected.

## Backend candidates — REVIEW (not auto-removed)

57 backend modules have no static importer, **but backend removal is deferred** because these are dominated by dynamically-wired code that static analysis cannot fully resolve safely:
- **`backend/src/workers/*` + `narrative/*Worker.ts` (BullMQ workers)** — started via the queue/worker runtime, not always statically imported.
- **`backend/src/exhibits/exhibitRoutes.ts`** — **confirmed NOT registered in `server.ts`** (its endpoints are unreachable). High-confidence removal candidate, but it anchors an `exhibits/` subsystem (`objectPlacementService`, `terrainGenerator`) partially reused by the registered `forensicReconstructionRoutes`; needs a scoped review before deletion.
- **`backend/src/services/*` (27)** — some are invoked transitively or via workers; require per-file confirmation.

These are enumerated in `docs/consolidation/orphans.json` (`backendCandidates`) for a follow-up, test-backed backend consolidation pass. Removing them blindly risks breaking dynamic worker/route wiring — deferred per the Constitution (production quality over speed).

## Graphs produced

- **Import graph:** `docs/consolidation/import-graph.json` — every scanned module → its local imports (678 files).
- **Repository graph:** `docs/consolidation/repository-graph.json` — top-level module → file count + cross-module dependency counts. Largest: `src/pages` (90), `src/components` (78), `backend/src/services` (53), `backend/src/policy` (49), `backend/src/evidence` (36), `backend/src/legislative` (32).
- **Orphans:** `docs/consolidation/orphans.json` — removable frontend (now 0) + backend candidates (57).
- **Duplicates:** `docs/consolidation/duplicates.json` — Prisma maps, models-without-map, routes, services.

## Feature flags / experimental code

- Removed the experimental `tmpTriggerVideo.ts` test script.
- DEV-only demo corpora remain gated behind `import.meta.env.DEV` (production never renders them) — verified in Gate 1; no additional experimental flags found that leak to production.

## Abandoned branches

Branch management is out of scope for a code-tree pass (handled via git remotes); no in-tree branch artifacts found. This branch remains the working consolidation branch.

## Result

The frontend module graph is now **free of orphan modules** (build-verified), duplicate endpoints and duplicate Prisma tables are **zero**, and demo/temp/experimental code is removed. Remaining consolidation is a scoped, test-backed backend pass (workers + the unregistered `exhibits` subsystem), documented above with exact candidates. Re-run `node scripts/repo-consolidation-analysis.mjs` to regenerate all graphs and candidate lists.
