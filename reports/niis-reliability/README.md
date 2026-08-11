# NIIS — Operational Validation Mode

**Architecture frozen.** Sole objective: 100% accuracy on daily Sacramento PDF comparison.

→ **[OPERATIONAL_VALIDATION_MODE.md](./OPERATIONAL_VALIDATION_MODE.md)**  
→ **[NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)**  
→ **[DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)**

## Gold standard

| Prior | Current | Ground truth |
|---|---|---|
| 08/09/2026 | 08/10/2026 | **67** newly booked |

## Every run emits

| Artifact | Purpose |
|---|---|
| [DAILY_CERTIFICATION_SUMMARY.md](./DAILY_CERTIFICATION_SUMMARY.md) | Operator-facing daily cert (reconcile + business metrics) |
| [SACRAMENTO_VALIDATION_RESULT.md](./SACRAMENTO_VALIDATION_RESULT.md) | Full stage ledger + miss/extra explanations |

### Business metrics (required)

- **Potential New Clients Found** (= true positives)  
- **Potential New Clients Missed** (= false negatives)

## Run

```bash
cd backend
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

## Continuous regression

Verified days accumulate under `fixtures/sacramento/validation/days/`.
