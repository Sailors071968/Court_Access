# Production Pipeline — First Failing Stage (2026-08-12)

**Target:** https://courtaccess.net · EC2 `44.209.225.79`  
**Measured:** 2026-08-12T18:32:21Z · **Re-measured:** 2026-08-12T18:35:00Z (live admin API)  
**Prod commit:** `b52e9aadfa35c3547327985bd13e411f217ae0e9` · version `1.1.0` · env `production`  
**Postgres:** healthy (2ms) · uploads path `/var/lib/courtaccess-v1/evidence` · disk 20.2 GB free  

**Access this run:** Admin API ✅ · SSH (`DEPLOY_SSH_KEY`) ❌ · Production RDS URL ❌ (agent `DATABASE_URL` is local `courtaccess_verify` only)

## Verdict

**First failing stage: File stored (byte upload)**  
Import Job was created. PDF bytes were never written. Everything downstream is stale or seed data.

**Root cause (measured in INC-001):** Import Job multipart handler deferred stream consumption and deadlocked busboy for files ≳100 KB. Direct `/uploads` stores a 15 MB PDF in 0.2s on the same host. See `PRODUCTION_INCIDENT_001.md`.

No new features. No cloud-agent / fixture / local acceptance work. Production EC2 only.

## Stage ledger (production evidence only)

| Stage | Verdict | Evidence |
|---|---|---|
| PDF received / job declared | PASS | Job `99bb599a-9e08-4d23-b4ef-3388155a3570` · `SACJAILSCAN08-12-2026.pdf` · sha256 `1b4a8e346f55249b54a7c0c67901594346fef3a1d6f3b95eb6822d3c4eb299e8` · **14,815,141 bytes** |
| Import Job created | PASS | `status=uploading` · `autoProcess=true` · `filesPending=1` · created `2026-08-12T14:26:53.067Z` · unchanged on re-measure |
| **File stored** | **FAIL** | JobFile `1686f521-…` `status=pending` · `uploadId=null` · `uploadedBytes=0` · `uploadStartedAt=null` · **zero** `InmateRosterUpload` rows for this PDF/sha |
| Queue | NOT_REACHED (PDF) | No PDF in `/uploads/queue`. See secondary backlog below. |
| Worker | NOT_REACHED (PDF) | `processStartedAt=null` |
| Parser | NOT_REACHED | — |
| Canonical roster | NOT_REACHED | — |
| Comparison | NOT_REACHED | — |
| Morning Operations | STALE | Headline: “No roster has been imported for 48 hours. Today's Sacramento export has not been processed.” · last success `2026-08-10T18:01:18Z` CSV · `todaysRosterImported=false` |
| Today's New Inmates | STALE_SEED | Unscoped list: NGUYEN/BROWN/GARCIA/PATEL/WILLIAMS… `discoveredOn` **2026-08-10**, confidence 100/95 — not today's comparison |
| Report | STALE | `/reports/new-inmates` HTML still titled for 2026-08-12 but rows are Aug 10 seed names |

## Same failure pattern (other SACJAIL PDFs)

All stuck `uploading` with `filesUploaded=0` / `uploadStartedAt=null`:

| Job | Roster date | Filename | Size |
|---|---|---|---|
| 99bb599a… | 2026-08-12 | SACJAILSCAN08-12-2026.pdf | 14.8 MB |
| b1d3e755… | 2026-08-11 | SACJAILSCAN08-11-2026.pdf | 17.8 MB |
| c56f8e89… | 2026-08-11 | SACJAILSCAN08-11-2026.pdf | (same pattern) |
| 6ff96d9a… | 2026-08-10 | SACJAILSCAN08-09-2026.pdf | — |
| f0bba4c6… | 2026-08-10 | SACJAILSCAN08-10-2026.pdf | — |
| 6ee01597… | 2026-08-09 | SACJAILSCAN08-09-2026.pdf | — |

## Secondary production defect (after File stored)

`GET /api/admin/intelligence/uploads/queue` → **100 active** rows, **all** `status=uploaded`, **0 PDFs**.

These are smoke/acceptance CSVs from `2026-08-10` (`smoke-bulk-*.csv`, `roster-acceptance-*.csv`). Bytes were stored; **Worker never drained them**.

Implication: even after SACJAIL byte upload succeeds, E2E may hit a **second** fail at Queue → Worker unless that backlog / worker path is cleared on EC2. That is not today's first fail — first fail remains File stored.

## Upload limit probe (live)

`POST` 70MB → **413** `Upload size (70MB) exceeds maximum (50MB)` (`maxSize=52428800`).

Declared PDF size **14.8 MB < 50 MB**, so the size cap alone does **not** explain this failure. The transfer **never started** (`uploadStartedAt=null`).

Likely client abandon / multipart failure / browser session loss after job create — needs nginx + pm2 access logs on EC2 (`DEPLOY_SSH_KEY` requested).

## Import Inspection (same PDF — bytes not retained)

Inspection `d29a39fd-3ebb-4809-8fff-4a69afb0a8a3`:

| Field | Value |
|---|---|
| filename | SACJAILSCAN08-12-2026.pdf |
| sha256 | 1b4a8e346f55249b54a7c0c67901594346fef3a1d6f3b95eb6822d3c4eb299e8 |
| sizeBytes | 14815141 |
| pageCount | 59 |
| hasTextLayer | true |
| verdict | **would_import** |
| parserConfidence | 75 |
| download endpoints | **404** (inspection does not retain durable bytes) |

Parser path is viable via Inspect. Durable **Upload Files / Import Job** path never stored the file. That is the break.

## What must not be done next

- Do not add features.
- Do not validate cloud-agent / fixture / local acceptance DBs.
- Fix **byte upload completion** for SACJAIL PDFs on production until JobFile → `uploaded` + `InmateRosterUpload` exists and job leaves `uploading`.
- Then clear/diagnose the **uploaded-but-not-processed** queue backlog so Worker → Parser can run.

## Next production action (blocked on secrets / artifacts)

1. **`DEPLOY_SSH_KEY`** → nginx access/error + pm2 logs around `2026-08-12T14:26:53Z` for job `99bb599a…`.
2. Optional **`PRODUCTION_DATABASE_URL`** (RDS) for direct JobFile / InmateRosterUpload proof (API already sufficient for first-fail).
3. Re-upload `SACJAILSCAN08-12-2026.pdf` (sha256 `1b4a8e34…`) until `jobFile.status=uploaded` and `uploadId` set. (This agent does not currently have the 08-12 PDF bytes.)
4. Confirm autoProcess / worker advances parser → roster → comparison.
5. Only then re-check Morning Ops / New Inmates / Report against one Daily Case.

Raw JSON: `PROD_PIPELINE_FIRST_FAIL_2026-08-12.json`
