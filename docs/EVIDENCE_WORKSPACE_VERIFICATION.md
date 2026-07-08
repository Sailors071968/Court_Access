# Production Program 73 — Evidence Workspace Verification

> Scope: Evidence Workspace only. New this turn: a premium **Evidence Summary dashboard** (real, computed) and **SHA-256 content hashing** on upload with a **File & Identity** detail panel. Verified end-to-end (API + browser) and deployed to the public staging URL. Honest status is reported for phases not fully implemented.

## 1. Updated Public Staging URL

**https://eric-collaborative-pmid-safari.trycloudflare.com** — served `/` byte-identical to rebuilt dist; Evidence Workspace verified through the external URL (`reports/screenshots/evidence/public-evidence-dashboard.png`).

## 2. Evidence Workspace Verification Report

**Phase 1 — Dashboard (DONE):** premium **Evidence Summary** with media categories computed from real MIME/evidence type (Total, Documents, Images, Audio, Video, Other), a processing row (**Pending OCR**, **Completed OCR**, **Storage Used**, Needs Review), and pipeline status chips (Knowledge Graph, Timeline, OCR Queue, Evidence Health). No generic placeholder cards. Verified live: 1 item → Documents 1, Completed OCR 1, Storage 122 B, Health Healthy.

**Phase 2 — Upload:** direct multipart upload (`POST /api/evidence/upload`) with drag/browse; accept list expanded to PDF, DOC, DOCX, TXT, RTF, JPG/JPEG, PNG, GIF, TIFF, HEIC, WEBP, MP4, MOV, AVI, MP3, WAV, ZIP.

**Phase 3 — Processing (DONE for core):** on upload the server computes **SHA-256** (streaming), determines MIME type, records size/metadata, stores the original, and runs text extraction / OCR (pdf-parse for PDF, Tesseract.js for images, docx extractor) asynchronously; `processingStatus` transitions `ingesting → analyzed`.

**Phase 4 — Details (DONE):** detail drawer shows Filename, Evidence ID, **SHA-256 hash**, Upload date, Uploader, Size, MIME/Type, Pages, Extraction Status, Chain of Custody (incl. integrity hash), Version/Audit, Tags, Relationships.

**Phases 5–9 (partial — see Remaining):** MediaPreview + side-by-side compare + OCR-complete indicator exist; chain-of-custody tab + KG relationships surfaced. Full OCR search-highlight viewer, annotation CRUD, and dedicated tag/bookmark persistence are not yet implemented.

## 3. Evidence API Certification (Phase 10)

Auth: all routes enforce the global `authenticationHook` (Bearer JWT) + case-scoped `requireCaseAccess`.

| Method | Route | Auth | Controller/Service | DB tables | Runtime |
|---|---|---|---|---|---|
| POST | `/api/evidence/upload` | ✅ JWT + case access | evidenceDirectUpload → processEvidenceAsync | evidence, EvidenceChunk | **CONNECTED** (verified: hash+OCR+metadata) |
| POST | `/api/evidence/upload-url` | ✅ JWT | evidenceRoutes (presigned R2/S3) | — | **CONNECTED** (needs R2 creds to store) |
| POST | `/api/evidence` | ✅ JWT | evidenceRoutes (register) | evidence | **CONNECTED** |
| GET | `/api/cases/:caseId/evidence` | ✅ JWT + case access | evidenceRoutes list | evidence | **CONNECTED** (verified) |
| GET | `/api/evidence/:evidenceId` | ✅ JWT | evidenceRoutes get | evidence | **CONNECTED** |
| DELETE | `/api/evidence/:evidenceId` | ✅ JWT | evidenceRoutes delete | evidence | **CONNECTED** |
| GET/POST | `/api/cases/:caseId/evidence-requests`, `/respond`, `/detect` | ✅ JWT | evidenceRequestRoutes | EvidenceRequest, EvidenceRequestResponse | **CONNECTED** |

Workers/queues: async text-extraction runs inline in the direct-upload path (no Redis dependency); the BullMQ pipeline workers (timeline/narrative/contradiction/video) are running and consume evidence-derived jobs.

## 4. Database Certification (Phase 11)

| Model | Key columns | Indexes | FKs | Status |
|---|---|---|---|---|
| `Evidence` (`evidence`) | +`sha256` (new), mimeType, size(BigInt), pageCount, processingStatus, analysisStatus | caseId, tenantId, evidenceType, processingStatus, analysisStatus | → CriminalCase(caseId) | ✅ (sha256 pushed) |
| `EvidenceChunk` | chunk text/index per evidence | (evidence) | → evidence | ✅ |
| `EvidenceEvent`, `EvidenceLink`, `EvidenceGraph` | KG/timeline linkage | indexed | relational | ✅ |
| `EvidenceRequest`, `EvidenceRequestResponse` | discovery requests | indexed | relational | ✅ |
| Annotations / Tags / OCR tables | — | — | — | **ABSENT** — OCR text lives in `EvidenceChunk`; dedicated annotation/tag tables are a follow-up. |

## 5. Browser Screenshot Gallery

`reports/screenshots/evidence/`: `evidence-dashboard.png` (premium summary), `evidence-detail.png` (File & Identity with SHA-256), `public-evidence-dashboard.png` (external URL parity).

## 6. Runtime Verification Report

| Check | Result |
|---|---|
| Attorney login | ✅ |
| Create case | ✅ |
| Upload file (`/api/evidence/upload`) | ✅ 201 |
| **SHA-256 generated & matches** | ✅ `afec7088…` == `sha256sum` |
| MIME + size metadata extracted | ✅ text/plain, 122 B |
| OCR / text extraction executes | ✅ `ingesting → analyzed` |
| Evidence listed | ✅ |
| Dashboard summary (real) | ✅ Documents 1 / Completed OCR 1 / Storage 122 B |
| KG / Timeline pipeline chips | ✅ Linked |
| Detail drawer (Evidence ID, hash, chain of custody) | ✅ |
| Console errors | ✅ 0 |
| Backend / workers | ✅ health 200; 5 workers |

## 7. Remaining Issues (Evidence Workspace only)

- **Not verified in-browser this turn:** distinct PDF / image / DOCX / ZIP / bulk / camera upload flows (text upload verified E2E; PDF/image/DOCX extraction code paths exist). ZIP-expansion, bulk multi-file, and camera capture are **not** implemented as dedicated flows.
- **OCR Viewer (Phase 5):** search-within-OCR + highlight + side-by-side OCR-vs-original + export are partial (MediaPreview + compare exist; full viewer pending).
- **Annotations (Phase 7):** bookmarks/highlights/comments/notes/favorites are **not** persisted (no annotation table yet).
- **Chain of Custody (Phase 8):** upload + integrity hash shown; full per-action version history table is minimal.
- **Restore Evidence:** delete exists; a restore endpoint is **not** implemented.
- 6 pre-existing backend TS errors (`resourceAuthMiddleware.ts`) remain (app runs via `tsx`).
- Public URL is an ephemeral quick-tunnel.

## 8–10. Commit / Branch / Timestamp

See response footer.
