# NIIS Operational Acceptance — 2026-08-12

**Overall:** BLOCKED_NO_PDF
**Facility:** sacramento
**Generated:** 2026-08-12T18:05:54.024Z
**Total time:** 64ms
**Database:** postgresql://courtaccess:***@127.0.0.1:5432/courtaccess_verify?schema=public
**Blocked at:** PDF received

## Summary
```json
{}
```

## Stages

| # | Stage | Verdict | Time (ms) |
|---|---|---|---|
| 1 | PDF received | **FAIL** | 64 |

### Stage 1: PDF received — FAIL

- Timestamp: —
- DB writes: —
- Counts: `{"uploads":0}`
- Execution: 64ms
- Evidence:
  - No InmateRosterUpload for 2026-08-12
  - Local path missing: ../fixtures/sacramento/real/SACJAILSCAN08-12-2026.pdf
  - OPERATIONAL BLOCKER: attach durable SACJAILSCAN08-12-2026.pdf and re-run
