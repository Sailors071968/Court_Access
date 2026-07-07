# Master Program 5 — Evidence Platform Certification

> The evidence workflow was **executed live** against the running staging server (real upload → real DB). No fabricated PASS. Two real bugs were found and fixed during execution.

## Canonical pipeline (as executed)

`POST /api/evidence/upload` (direct multipart) runs a **synchronous, Redis-free** pipeline: save file → create `Evidence` row → `processEvidenceAsync` (text extraction → `EvidenceChunk` rows with SHA-256 checksums). Downstream, the workbench/intelligence/search endpoints read those records. This is the canonical working path for upload → extract → chunk → search → workbench.

## Per-stage runtime evidence

| # | Stage | Result | Evidence |
|---|-------|--------|----------|
| 1 | Attorney (auth) | **PASS** | login → JWT |
| 2 | Upload | **PASS** | `POST /api/evidence/upload` → **HTTP 201** (after UPLOAD_DIR fix) |
| 3 | OCR / Text Extraction | **PASS** | evidence `processingStatus = analyzed`; 546 chars extracted |
| 4 | Evidence Storage | **PASS** | `Evidence` DB row created + file on local disk |
| 5 | Chunk Generation | **PASS** | 1 `EvidenceChunk` row, 546 chars, checksum `d13e4b4e…` (SHA-256) |
| 6 | Knowledge Graph | **PASS** | workbench `evidenceWorkbench.graph` → 1 node from the evidence |
| 7 | Timeline | **PASS** | `GET /api/timeline/:id/events` → 200, real DB-sourced events, **auth enforced** (after fix) |
| 8 | Contradictions | **PARTIAL / UNKNOWN** | 0 detected inline — event-extraction → contradiction detection is BullMQ **worker-driven** and is not triggered by the synchronous upload path (see below) |
| 9 | Search | **PASS** | `GET /api/search?q=Vermont&types=ocr_text` → returned the uploaded report's extracted chunk |
| 10 | Reports | **PASS** | `GET /api/cases/:id/intelligence` → 200 |
| 11 | Motion Builder | **PASS** | `GET /api/cases/:id/litigation-strategy` → 2 recommendations, 5 readiness metrics |
| 12 | Attorney Workbench | **PASS** | `GET /api/cases/:id/workbench` → 200, evidence item present |

**Summary: 10 PASS · 1 PARTIAL/UNKNOWN · 0 FAIL** (after fixes).

## Bugs found + fixed during execution

1. **`EVIDENCE_UPLOAD_DIR` hardcoded to `/var/www/courtaccess`** — uploads failed with `EACCES` (non-portable production path baked as the default). Fixed: default is now repo-relative (`<cwd>/data/uploads/evidence`), still overridable via env. Upload went from HTTP 500 → 201.
2. **Timeline `/events` served fabricated data with auth disabled** — the handler returned hardcoded test events ("Defendant entered the house") ignoring `caseId`, with `{}` (auth disabled), and ran a broken legal-cascade (`runLegalCascade` undefined). Fixed: now returns **real DB-sourced events + conflicts** via `getTimelineEvents`/`getTimelineConflicts`, with `authMiddleware` enforced (401 without token). This removes a Constitution violation (fabricated data + disabled auth).

## Honest finding — two pipelines, one gap

- The **inline upload pipeline** (executed here) is synchronous and Redis-free: it covers upload → extraction → chunking → storage, and the results are immediately searchable and visible in the workbench/graph.
- **Deeper analysis** — timeline event extraction into `timeline_events`, `verified_facts`/`narrative_claims`, and **contradiction detection** — is driven by the BullMQ `caseAnalysisWorker`, which the inline upload path does **not** enqueue synchronously. For the uploaded report, `verified_facts = 0`, `narrative_claims = 0`, `timeline_events = 0`, and the known witness-vs-dispatch contradiction (21:15 vs 21:40) was **not** auto-detected. This stage is therefore **UNKNOWN** in the inline path — not fabricated as passing.
- **To make it "one canonical pipeline"** end-to-end: have `processEvidenceAsync` also run event extraction + contradiction detection inline (or enqueue the analysis worker and confirm it consumes). That is a scoped follow-up; the extraction+chunk+search+workbench spine is proven working.

## Verdict

**CONDITIONAL PASS.** The evidence spine (upload → OCR/text → storage → chunks → knowledge graph → search → reports → motion → workbench) executes end-to-end with live evidence, and two real defects were fixed. Contradiction/deep-timeline auto-analysis from an inline upload is the one outstanding stage (worker-driven), documented as UNKNOWN rather than claimed.
