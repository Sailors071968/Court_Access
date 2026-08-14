# Production Incident #001 — uploadedBytes = 0

**Severity:** Critical  
**Status:** OPEN — root cause identified · fix in PR #167 · **not RESOLVED until closure Tests 1–10 pass on production**  
**Target:** https://courtaccess.net · EC2 `44.209.225.79` · commit `b52e9aad` (pre-fix)  
**Opened:** 2026-08-12  
**Closure checklist:** `PRODUCTION_INCIDENT_001_CLOSURE.md`  
**Related (do not mix):** INC-002 CSV worker drain — `PRODUCTION_INCIDENT_002.md`  

## Mission boundary

Ignore parser / comparison / roster / investigator / reports / certification / accuracy until:

- `uploadedBytes > 0`
- `uploadStartedAt != null`
- `uploadFinishedAt != null`
- JobFile `status = uploaded`
- parser enqueue can run (`maybeAutoProcess` / `startJobProcessing`)

## Symptoms (operator)

- Upload UI creates Import Job (“Phase: uploading”)
- `uploadedBytes = 0`, `uploadStartedAt = null`
- Worker never begins for that PDF
- Morning Ops / Today's New Inmates stale

## Measured root cause (not assumed)

**Import Job multipart handler deadlocks by deferring stream consumption.**

In `POST /api/admin/intelligence/import-jobs/:jobId/uploads` the handler collected file streams into an array, then called `storeJobFileUpload` only **after** `for await (request.parts())` completed. busboy will not finish the parts iterator until each file stream is drained. Above the internal buffer (~96–128 KB) this is a hard deadlock:

1. Browser / curl sends full body  
2. Node never reaches `markBatchUploading`  
3. `uploadStartedAt` stays `null`, `uploadedBytes` stays `0`, JobFile stays `pending`  
4. Client times out → often JobFile `failed_upload` / error `aborted`

### Control experiments (live production)

| Path | Size | Result |
|---|---|---|
| Import Job `/import-jobs/:id/uploads` | 39 B CSV | PASS — `uploadedBytes=39`, `uploadStartedAt` set |
| Import Job `/import-jobs/:id/uploads` | 50–96 KB PDF | PASS |
| Import Job `/import-jobs/:id/uploads` | 200 KB PDF | FAIL — timeout; later `failed_upload` / `aborted`; `uploadStartedAt=null` |
| Import Job `/import-jobs/:id/uploads` | 5–15 MB PDF | FAIL — curl sends all bytes, **0 bytes response**, hang 180–300s |
| Direct `/api/admin/intelligence/uploads` (consumes stream in-loop) | 200 KB / 2 MB / 5 MB / **15 MB** | PASS — 15 MB in **0.20s**, `uploadId` issued |

Direct upload proves: nginx, disk (`/var/lib/courtaccess-v1/evidence` healthy), Node `storeUpload`, and multipart itself are fine. **Only the Import Job batch path is broken.**

UI (`BulkImportPanel`) exclusively uses the Import Job path → every Sacramento PDF (~15 MB) dies before File Storage.

### Why job status says `uploading` with 0 bytes

`recountJob` sets job `status=uploading` whenever any JobFile is `pending`. That is **not** proof that a byte transfer started. Operator “upload succeeds” = manifest/job create only.

## Required trace (instrumented in fix)

Each transition logs JSON with `incident: INC-001`:

`multipart_request_open` → `multipart_file_part` → `jobfile_uploading` → `file_store_ok|fail` → `batch_complete`  
(fields: timestamp, durationMs, bytes, filename, uploadId, jobFileId, jobId)

## Fix

`backend/src/intelligence/inmates/importJobRoutes.ts`: consume + `storeJobFileUpload` **inside** the `parts()` loop (same pattern as direct `/uploads` and `/inspect`).

## Relationship to the 100 stuck CSVs

Those rows are `status=uploaded` with bytes already on disk (smoke/acceptance CSVs from 2026-08-10). That is a **later** stage (Queue → Worker / process never drained). It is **not** the same first FAIL as `uploadedBytes=0`.

Small CSVs cleared the Import Job hang threshold, stored bytes, then sat unprocessed. Large PDFs never stored bytes at all.

After INC-001 deploy proves `uploadedBytes > 0` for a ~15 MB PDF, open a separate incident for the uploaded-but-not-processed backlog if it still blocks E2E.

## Acceptance (production)

1. Deploy fix to EC2.  
2. Re-upload Sacramento PDF via Import Job / Upload Files.  
3. Prove continuous trace: bytes stored → parser starts → roster → comparison → New Inmates → Morning Ops.  
4. No manual DB surgery.

## Blocked on

- **Production deploy** (`DEPLOY_SSH_KEY` or other cutover path). Code fix is on branch; live EC2 still runs `b52e9aad` with the deadlock.
