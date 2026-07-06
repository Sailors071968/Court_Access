# OCR Certification Report (Program 37)

**Target:** the evidence OCR/extraction pipeline in `backend/src`.
**Method:** static analysis of the extraction services, workers, and queue configs.
A live run requires Redis + Cloudflare R2 + AWS Textract credentials + real files,
which are **not available in this environment** — so measured metrics (average
processing time, failure rate, live confidence) are marked **requires-runtime** and
never fabricated.

**Generated:** 2026-07-06.

---

## 1. Extraction architecture (evidence)

Three-method fallback chain — `src/policy/ocr/documentTextExtractor.ts`:

| Order | Method | Library | Handles | Confidence source |
|-------|--------|---------|---------|-------------------|
| 1 | `pdf-parse` | `pdf-parse@2.4.5` | PDFs with embedded text | **Heuristic** (text-length: 0.95 / 0.7 / 0.1) |
| 2 | AWS Textract | `@aws-sdk/client-textract` (`DetectDocumentTextCommand`) | Complex/scanned docs & images | **Real** (Textract block confidence) |
| 3 | Tesseract.js | `tesseract.js@7` (`createWorker('eng')` → `recognize`) | Images / fallback | **Real** (`result.data.confidence / 100`) |

Second extraction path — `src/services/evidenceTextExtractionService.ts`:
- `text/plain` → direct read
- `application/pdf` → pdf-parse
- `image/*` → Tesseract OCR
- `audio/*`, `video/*` → **transcript placeholder returns `null`** (not implemented)

---

## 2. Format coverage

| Input | Support | Evidence |
|-------|---------|----------|
| PDF (text) | ✅ pdf-parse | `extractTextFromPdf` |
| PDF (scanned/image-only) | ✅ falls back to Textract → Tesseract | fallback chain |
| Multi-page PDF | ✅ `numpages` tracked | pdf-parse `pageCount` |
| Images (png/jpg/…) | ✅ Tesseract / Textract | `recognize(buffer)` |
| Large documents | ⚠️ **capped at 50 MB**, 60 s extraction timeout | `MAX_EXTRACTION_BUFFER_BYTES`, `EXTRACTION_TIMEOUT_MS` |
| Rotation / skew | ❌ **no deskew/rotation correction** (no `sharp`; no PSM/OSD config) | no rotation code found |
| Low-quality scans | ⚠️ Tesseract defaults only, `eng` language, no preprocessing | `createWorker('eng')` |
| Audio / video | ❌ transcript pipeline is a placeholder (`null`) | service header |

---

## 3. Downstream extraction stages (queue-backed)

`src/evidence/evidenceProcessingPipeline.ts` enqueues (all through BullMQ):
`evidence-ingestion → document-analysis (normalization, OCR, multiplex detection) →
graph node creation → contradiction-analysis`. Video routes to `video-segment`.

| Stage | Status | Note |
|-------|--------|------|
| Text extraction (OCR) | ✅ implemented | 3-method chain |
| Evidence extraction | ✅ pipeline stage | document-analysis queue |
| Timeline extraction | ✅ `TimelineEvent` + `NormalizedClaimEvent`; `claimExtractionWorker` | |
| Contradiction detection | ✅ `contradiction-analysis-queue` | |
| Witness / Charge / Citation extraction | ⚠️ **AI/NER-dependent** — stages exist but accuracy unmeasured; require model services | |
| Knowledge-graph updates | ✅ "graph node creation" stage; `evidence_graphs`/`evidence_links` models | |

---

## 4. Worker execution, queues, retries, timeouts (evidence)

BullMQ workers registered via `src/workers/queueManager.ts` + `startWorkers.ts`
(require Redis). Configured envelopes:

| Queue | Concurrency | Max retries | Backoff | Timeout |
|-------|-------------|-------------|---------|---------|
| evidence-ingestion | 3 | 3 | 10 s | 300 s |
| document-analysis (OCR) | 3 | 3 | 10 s | 180 s |
| video-segment | 2 | 2 | 30 s | 600 s |
| contradiction-analysis | 2 | 2 | 15 s | 300 s |
| policy-ocr-queue | 3 | 2 | 10 s | 180 s |

✅ **Retries, exponential-ish backoff, per-job timeouts, and bounded concurrency are
all configured.** Failure handling: extraction methods catch errors and return
`confidenceScore: 0` / `method: 'failed'` rather than throwing (graceful degrade).

---

## 5. Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Average processing time | **requires-runtime** | Design bound: ≤180 s (doc-analysis timeout), ≤600 s (video) |
| Failure rate | **requires-runtime** | No live corpus processed in this env |
| Confidence — Tesseract | Real (`data.confidence`) | ✅ measured at runtime |
| Confidence — Textract | Real (block confidence) | ✅ measured at runtime |
| Confidence — pdf-parse | **Heuristic (text length)** | ⚠️ not a true OCR confidence |

There is **no OCR unit/integration test** (`tests/` contains only leginfo HTML
fixtures), so no offline metric can be produced. Measured metrics must come from the
Program 2 Attorney E2E certification on a deployed stack.

---

## 6. Remaining limitations

1. **No image preprocessing** — no deskew/rotation/binarization (`sharp` not a dep);
   rotated or low-quality scans degrade Tesseract accuracy.
2. **pdf-parse confidence is a length heuristic**, not a measured OCR confidence —
   should be replaced with a real per-page metric or marked UNKNOWN.
3. **Audio/video transcription is a placeholder** (returns `null`) — no ASR.
4. **50 MB / 60 s extraction limits** in `evidenceTextExtractionService` — very large
   or slow documents are skipped/time out (the queue's 180 s doc-analysis timeout is
   more generous; the two limits should be reconciled).
5. **English-only** Tesseract (`'eng'`) — no multilingual OCR.
6. **No OCR test fixtures/tests** — cannot regression-test extraction offline.
7. **Runtime dependencies** — Redis (queues), R2 (storage), AWS Textract creds must be
   configured; absence disables OCR silently at the queue layer.

---

## 7. Completion (not inflated)

| Workstream | Status | % |
|------------|--------|---|
| Extraction methods (pdf/textract/tesseract) | Implemented | 100% |
| Format coverage (pdf/image/multi-page) | Implemented | ~85% |
| Rotation / low-quality handling | Not implemented | 0% |
| Audio/video transcription | Placeholder | 0% |
| Queues / retries / timeouts / workers | Configured | 100% |
| Real confidence (tesseract/textract) | Implemented | 100% |
| pdf-parse confidence | Heuristic (needs real metric) | ~30% |
| Measured perf / failure-rate metrics | requires-runtime | 0% |
| OCR tests | None | 0% |

**OCR certification: ≈ 60%.**
The extraction pipeline is real and queue-governed with retries/timeouts, and OCR
confidence is measured for Tesseract/Textract. **Certification is INCOMPLETE** until:
(a) live metrics are captured on a deployed stack (average time, failure rate), and
(b) the limitations above (rotation/low-quality preprocessing, pdf-parse confidence,
audio/video ASR, OCR tests) are addressed.

---

## 8. Reproduce

```bash
cd backend
rg -n "createWorker|recognize|DetectDocumentText|pdf-parse" src | rg -i ocr
rg -n "maxRetries|retryBackoffMs|timeoutMs|concurrency" src/workers/queueManager.ts src/evidence/evidenceProcessingPipeline.ts
rg -n "confidenceScore|data.confidence" src/policy/ocr/documentTextExtractor.ts
rg -n "MAX_EXTRACTION_BUFFER_BYTES|EXTRACTION_TIMEOUT_MS" src/services/evidenceTextExtractionService.ts
```
