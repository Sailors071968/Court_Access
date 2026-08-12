# Production Pipeline — First Failing Stage (2026-08-12)

**Target:** https://courtaccess.net · EC2 `44.209.225.79`  
**Measured:** 2026-08-12T18:32:21.881667+00:00  
**Prod commit:** `b52e9aadfa35c3547327985bd13e411f217ae0e9` · version `1.1.0` · env `production`  
**Postgres:** healthy (2ms) · uploads path `/var/lib/courtaccess-v1/evidence`

## Verdict

**First failing stage: File stored (byte upload)**  
Import Job was created. PDF bytes were never written. Everything downstream is stale or seed data.

## Stage ledger (production evidence only)

| Stage | Verdict | Evidence |
|---|---|---|
| PDF received / job declared | PASS | Job `99bb599a-9e08-4d23-b4ef-3388155a3570` · `SACJAILSCAN08-12-2026.pdf` · sha256 `1b4a8e346f55249b54a7c0c67901594346fef3a1d6f3b95eb6822d3c4eb299e8` · **14,815,141 bytes** |
| Import Job created | PASS | `status=uploading` · `autoProcess=true` · `filesPending=1` · created `2026-08-12T14:26:53.067Z` |
| **File stored** | **FAIL** | JobFile `1686f521-…` `status=pending` · `uploadId=null` · `uploadedBytes=0` · `uploadStartedAt=null` · **zero** `InmateRosterUpload` rows for this PDF |
| Queue / Worker | NOT_REACHED | `processStartedAt=null` |
| Parser | NOT_REACHED | — |
| Canonical roster | NOT_REACHED | — |
| Comparison | NOT_REACHED | — |
| Morning Operations | STALE | Headline: “No roster has been imported for 48 hours. Today's Sacramento export has not been processed.” |
| Today's New Inmates | STALE_SEED | Unscoped list shows NGUYEN/BROWN/GARCIA @ 100% from Aug 10 CSV — not today's comparison |
| Report | NOT_REACHED | — |

## Same failure pattern (other SACJAIL PDFs)

All stuck `uploading` with `filesUploaded=0` / `uploadStartedAt=null`:

| Job | Roster date | Filename | Size |
|---|---|---|---|
| 99bb599a… | 2026-08-12 | SACJAILSCAN08-12-2026.pdf | 14.8 MB |
| b1d3e755… | 2026-08-11 | SACJAILSCAN08-11-2026.pdf | 17.8 MB |
| c56f8e89… | 2026-08-11 | SACJAILSCAN08-11-2026.pdf | (same pattern) |
| 6ff96d9a… | 2026-08-10 | SACJAILSCAN08-09-2026.pdf | — |
| f0bba4c6… | 2026-08-10 | SACJAILSCAN08-10-2026.pdf | — |

## Upload limit probe (live)

`POST` 70MB → **413** `Upload size (70MB) exceeds maximum (50MB)` (`maxSize=52428800`).

Declared PDF size **14.1 MB < 50 MB**, so the size cap alone does **not** explain this failure. The transfer **never started** (`uploadStartedAt=null`).

Likely client abandon / multipart failure / browser session loss after job create — needs nginx + pm2 access logs on EC2 (`DEPLOY_SSH_KEY` requested).

## What must not be done next

- Do not add features.
- Do not validate cloud-agent / fixture DBs.
- Fix **byte upload completion** for SACJAIL PDFs on production until `InmateRosterUpload` exists and job leaves `uploading`.

## Next production action

1. Obtain `DEPLOY_SSH_KEY` → inspect nginx access/error + pm2 logs around `2026-08-12T14:26:53Z`.
2. Re-upload `SACJAILSCAN08-12-2026.pdf` (sha256 `1b4a8e34…`) until jobFile.status=`uploaded` and uploadId is set.
3. Confirm autoProcess advances to parser → roster → comparison.
4. Only then re-check Morning Ops / New Inmates / Report against one Daily Case.

Raw JSON: `PROD_PIPELINE_FIRST_FAIL_2026-08-12.json`


## Import Inspection (same PDF — bytes not retained)

Inspection `d29a39fd-3ebb-4809-8fff-4a69afb0a8a3` at `2026-08-12T17:47:40.017Z`:

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

So: parser path was proven viable via Inspect. Durable **Upload Files / Import Job** path never stored the file. That is the break.
