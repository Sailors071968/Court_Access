# INC-001 Closure Requirements — File Ingestion

**Incident:** INC-001 — Large PDF Import Job upload deadlock  
**Subsystem:** File ingestion (not NIIS accuracy)  
**Status:** OPEN — fix coded; **not RESOLVED** until production Tests 1–10 pass  

The incident is **not** resolved when the code compiles.  
The incident is **not** resolved when the PR merges.  
The incident is resolved **only** after the production evidence below exists.

## Closure tests (production EC2 only)

Target file: `SACJAILSCAN08-12-2026.pdf`  
sha256 `1b4a8e346f55249b54a7c0c67901594346fef3a1d6f3b95eb6822d3c4eb299e8` · 14,815,141 bytes  

| Test | Requirement | Evidence status |
|---|---|---|
| 1 | `uploadedBytes > 0` | PENDING deploy + re-upload |
| 2 | `uploadStartedAt != null` and `uploadFinishedAt != null` | PENDING |
| 3 | JobFile.status = `uploaded` | PENDING |
| 4 | Parser started automatically (no manual Process) | PENDING |
| 5 | Canonical roster created | PENDING |
| 6 | Comparison executed | PENDING |
| 7 | Morning Operations reflects today's Daily Case | PENDING |
| 8 | Today's New Inmates from today's comparison (no seed/stale) | PENDING |
| 9 | Printable New Inmate Report exists | PENDING |
| 10 | All evidence preserved (upload row + stored path + job + report) | PENDING |

Only when all ten are **PASS** may INC-001 be marked **RESOLVED**.

## Regression (every release)

`npm run test:ingestion-size-matrix` in `backend/` must pass for:

50 KB · 100 KB · 500 KB · 5 MB · 15 MB · 30 MB  

Each size must reach: `uploadedBytes > 0` → parser auto-start → comparison start signal.  
Hang/timeout = release fail. Never let INC-001 return.

## Out of scope for INC-001

- INC-002 — CSV worker not draining queue (100 `status=uploaded` rows since 2026-08-10)  
- INC-003 — Parser accuracy  
- INC-004 — Comparison accuracy  

Close one incident at a time.

## Deploy gate

Production still serves commit `b52e9aad` until the INC-001 fix is deployed to EC2.  
Blocked on: `DEPLOY_SSH_KEY` + real PDF bytes for Test 1.
