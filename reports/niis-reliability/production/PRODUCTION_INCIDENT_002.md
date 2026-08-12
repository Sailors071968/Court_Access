# Production Incident #002 — CSV worker not draining queue

**Severity:** High  
**Status:** OPEN — **do not work until INC-001 is RESOLVED**  
**Subsystem:** File ingestion / processing queue (not parser accuracy)  

## Facts (from INC-001 investigation)

`GET /api/admin/intelligence/uploads/queue` on production showed **100** active rows, all `status=uploaded`, **0 PDFs**, dated ~2026-08-10 (`smoke-bulk-*.csv`, `roster-acceptance-*.csv`).

These files **already have bytes on disk**. They are **not** blocked by the INC-001 multipart deadlock.

## Boundary

| Incident | Failure | Symptom |
|---|---|---|
| INC-001 | Import Job multipart deadlock ≳100 KB | `uploadedBytes = 0`, `uploadStartedAt = null` |
| INC-002 | Worker / autoProcess never drains `uploaded` rows | Bytes stored; parser never starts for those CSVs |

Do not mix. Do not open INC-003/004 until INC-001 then INC-002 are closed.

## Acceptance (when opened for work)

- Queue depth of abandoned `uploaded` CSVs drains or is explicitly cancelled with audit  
- New Import Job with `autoProcess=true` that stores bytes advances to processing without manual Process  
- Evidence from production logs + DB only  

## Explicitly deferred

No work on INC-002 until INC-001 closure Tests 1–10 are PASS on production.
