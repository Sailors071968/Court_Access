# NIIS Operational Acceptance — 2026-08-12

**Overall: REJECT / BLOCKED**  
**Blocked at: Stage 1 — PDF received**  
**Measured at:** 2026-08-12T18:05:54.024Z  
**Database under test:** `courtaccess_verify` (agent VM)  
**Production host reachable:** `https://courtaccess.net` → health 200 (`environment: production`)  
**Production API auth:** 401 (no admin credentials on this agent)  
**Deploy SSH:** absent (`DEPLOY_SSH_KEY` not in environment)

---

## Stage results (what actually happened)

| # | Stage | Verdict | Evidence |
|---|---|---|---|
| 1 | PDF received | **FAIL** | No `InmateRosterUpload` for 2026-08-12. Path `fixtures/sacramento/real/SACJAILSCAN08-12-2026.pdf` does not exist on this VM. Only durable PDF present: `SACJAILSCAN08-10-2026.pdf` (353304 bytes, 1 page — not the 08-12 file). |
| 2 | Import Job created | **SKIPPED** | Stopped at Stage 1 |
| 3 | Parser executed | **SKIPPED** | Stopped at Stage 1 |
| 4 | Canonical roster built | **SKIPPED** | Stopped at Stage 1 |
| 5 | Yesterday's certified roster loaded | **SKIPPED** | Stopped at Stage 1 |
| 6 | Comparison executed | **SKIPPED** | Stopped at Stage 1 |
| 7 | Today's New Inmates populated | **SKIPPED** | Stopped at Stage 1 |
| 8 | Morning Operations updated | **SKIPPED** | Stopped at Stage 1 |
| 9 | Report generated | **SKIPPED** | Stopped at Stage 1 |
| 10 | Investigator Workspace | **SKIPPED** | Stopped at Stage 1 |

Full machine ledger: [ACCEPTANCE.json](./ACCEPTANCE.json)

---

## Stage 1 detail (measured)

```
verdict: FAIL
timestamp: null
databaseWrites: []
recordCounts: { uploads: 0 }
executionTimeMs: 64
evidence:
  - No InmateRosterUpload for 2026-08-12
  - Local path missing: .../SACJAILSCAN08-12-2026.pdf
  - OPERATIONAL BLOCKER: attach durable SACJAILSCAN08-12-2026.pdf and re-run
```

Filesystem search for `SACJAILSCAN08-12*` / `*08-12-2026*.pdf` under `/workspace`, `/tmp`, `/home/ubuntu`, `/var/lib`: **0 hits**.

---

## Seed/demo data purge (completed on agent DBs)

Requirement: permanently delete fake operational inmates — not hide them.

| Database | Action | Result |
|---|---|---|
| courtaccess_verify | DELETE NGUYEN, BAKER, SILVA, OKAFOR, WASHINGTON, GARCIALOPEZ, OBRIEN, SMITH + seed uploads | **0 inmates remain** |
| courtaccess_acc | DELETE seed surnames + TRAN fixture + seed uploads | **0 inmates remain** |
| courtaccess_accept | DELETE seed surnames + uploads | **0 inmates remain** |
| courtaccess_ops | DELETE seed batches + inmates | **0 inmates remain** |
| courtaccess_sac | DELETE seed batches + OKONKWO/DELACRUZ/HAYES | **0 inmates remain** |

Tool: `npx tsx scripts/purge-seed-demo-inmates.ts --confirm`

**Production EC2 (`courtaccess.net`) was not purged** — no `DEPLOY_SSH_KEY` / admin credentials on this agent. That purge is still required on the live host before acceptance can PASS.

---

## Screenshot requirement

**Not produced.** The acceptance criteria require a screenshot after the pipeline completes successfully with matching Daily Case ID / roster date / counts across Morning Operations, Today's New Inmates, and Import Summary.

Pipeline did not complete. A success screenshot would be fabricated evidence. None was taken.

---

## What is required to re-run to ACCEPT

1. Attach durable bytes: `SACJAILSCAN08-12-2026.pdf` → `fixtures/sacramento/real/` (or upload via NIIS Import Job until `InmateRosterUpload.status=completed`).
2. Provide production access: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and/or `NIIS_ADMIN_EMAIL` + `NIIS_ADMIN_PASSWORD`.
3. Ensure yesterday (`2026-08-11`) has a certified/validated roster snapshot — else Stage 5 BLOCKED by design.
4. Re-run:

```bash
cd backend
npm run ops:accept -- --date 2026-08-12 --pdf ../fixtures/sacramento/real/SACJAILSCAN08-12-2026.pdf
```

5. Capture the one composite screenshot only after overall `ACCEPT`.

---

## Honest conclusion

PR #166 plumbing changes are **not accepted** under this operational test.

The code direction may be correct. The milestone — upload real 08/12 PDF → automatic process → every screen same Daily Case → New Inmates from comparison not seeds — **has not been demonstrated** on a system that holds the real PDF.

Until Stage 1 PASSes with the real file fingerprint, stages 2–10 cannot produce evidence.
