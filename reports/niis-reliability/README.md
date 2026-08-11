# NIIS Accuracy Certification

**Sole objective:** 100% recall and 100% precision on Sacramento new-inmate detection.  
**Gold standard:** manual investigator comparison — not the software.

## Binding directive

→ **[NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)**  
→ **[DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)** — PDF comparison first; CSV enrichment only

## Certification pair (permanent dataset)

| Prior | Current | Ground truth |
|---|---|---|
| 08/09/2026 (87 pp) | 08/10/2026 (59 pp) | **67** newly booked |

- Gold list: `fixtures/sacramento/validation/ground-truth-67-names.md`
- Harness: `backend/scripts/sacramento-validation-suite.ts`
- Latest result: [SACRAMENTO_VALIDATION_RESULT.md](./SACRAMENTO_VALIDATION_RESULT.md)
- Multi-day chain: `fixtures/sacramento/validation/multi-day-chain.md`

## Pass requires

1. Precision 100% / Recall 100% vs the 67  
2. `New + Existing + Returning + Review = N` (current roster)  
3. Stage ledger with no silent losses  
4. Every miss and every extra explained (stage, rule, evidence, why)

## Run

```bash
cd backend
npx tsx scripts/seed-sacramento.ts
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

Place PDFs under `fixtures/sacramento/validation/` or `/tmp/sacjail/`.

## CI

`.github/workflows/ci.yml` job `sacramento-accuracy-certification` always runs the jail-scan unit tests and the suite. Exit `0` = pass; exit `1` = fail the build; exit `2` = blocked on missing PDFs (warns until fixtures are attached).

## Prior audit notes

- [PHASE1_RELIABILITY_ASSESSMENT.md](./PHASE1_RELIABILITY_ASSESSMENT.md)
- [SACRAMENTO_ACCEPTANCE_TEST.md](./SACRAMENTO_ACCEPTANCE_TEST.md)
