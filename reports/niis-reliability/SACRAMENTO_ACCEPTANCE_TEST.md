# NIIS Acceptance Test — Sacramento Ground Truth

**Status:** Suite implemented; full run **blocked** until durable 08/09 + 08/10 PDF bytes are attached.  
**Directive:** Stop feature / architecture work. Fix only root causes required to pass this test.

## Objective

Given complete Sacramento County jail rosters for **08/09/2026** and **08/10/2026**, NIIS must independently produce the same **67** newly booked inmates identified by manual comparison.

## Pass criteria

| Metric | Required |
|---|---:|
| Ground truth | 67 |
| NIIS | 67 |
| Missing (FN) | 0 |
| Extra (FP) | 0 |
| Precision | 100% |
| Recall | 100% |

## Suite location

| Artifact | Path |
|---|---|
| Gold list | `fixtures/sacramento/validation/ground-truth-67-names.txt` |
| Roster PDFs | `fixtures/sacramento/validation/SACJAILSCAN08-0{9,10}-2026.pdf` (**must be provided**) |
| Harness | `backend/scripts/sacramento-validation-suite.ts` |
| Jail-scan parser | `backend/src/intelligence/inmates/parsers/sacramentoJailScan.ts` |
| Result | `reports/niis-reliability/SACRAMENTO_VALIDATION_RESULT.md` |

## How to run

```bash
cd backend
npx tsx scripts/seed-sacramento.ts
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

## What the harness measures

1. PDF parse stage counts (pages, rows) for both files  
2. Offline set-diff of parsed names (diagnostic)  
3. Full ingest of 08/09 then 08/10 on a clean facility slice (`SAC_WIPE=1`)  
4. New Inmate Report / `getNewInmates` for roster date 08/10  
5. Per-name TP / FP / FN vs the 67  

## Parser work authorized for this test

Real SACJAILSCAN layout is **Active Inmate Basic Roster** (Name / XREF / Housing / Gender / DOB), not the v1 pipe-delimited table. A dedicated reassembling parser and Sacramento PDF profile **v2** are included so the suite can pass once the PDFs are present.

## Blocker

Import Inspection deleted production copies. Re-attach:

- `SACJAILSCAN08-09-2026.pdf` (87 pages, double-spaced)  
- `SACJAILSCAN08-10-2026 (1)_compressed.pdf` (59 pages, single-spaced)  

to `fixtures/sacramento/validation/` or `/tmp/sacjail/` (and point `SAC_*_PDF` env vars).

## Policy going forward

These two rosters + the 67-name list are the permanent **Sacramento Validation Suite**. Any future NIIS change that alters Sacramento ingest must keep this suite green (exactly 67) before it is considered acceptable.
