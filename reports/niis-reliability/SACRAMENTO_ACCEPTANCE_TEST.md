# Sacramento Acceptance Test (superseded detail → see Accuracy Certification)

This document is retained for continuity. The binding directive is:

**[NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)**

## Objective

Given complete Sacramento County jail rosters for **08/09/2026** and **08/10/2026**, NIIS must independently produce the same **67** newly booked inmates identified by manual comparison — and account for every inmate on the current roster.

## Pass criteria

| Requirement | Target |
|---|---|
| Ground truth new | 67 |
| NIIS new | 67 |
| Missing (FN) | 0 |
| Extra (FP) | 0 |
| Precision / Recall | 100% / 100% |
| New+Existing+Returning+Review | = current roster N |
| Unclassified | 0 |
| Silent stage losses | 0 |

## Suite

| Artifact | Path |
|---|---|
| Gold list | `fixtures/sacramento/validation/ground-truth-67-names.md` |
| Roster PDFs | `fixtures/sacramento/validation/SACJAILSCAN08-0{9,10}-2026.pdf` (**must be provided**) |
| Harness | `backend/scripts/sacramento-validation-suite.ts` |
| Jail-scan parser | `backend/src/intelligence/inmates/parsers/sacramentoJailScan.ts` |
| Result | `reports/niis-reliability/SACRAMENTO_VALIDATION_RESULT.md` |

```bash
cd backend
npx tsx scripts/seed-sacramento.ts
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

## Gold-standard principle

The manual comparison performed by an experienced investigator is the gold standard — not the software. Discrepancies become the benchmark NIIS must explain or match.
