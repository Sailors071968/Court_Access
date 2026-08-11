# NIIS — Continuous Operational Validation

**One job:** the exact list of every newly booked Sacramento inmate, every morning.  
**Architecture frozen.** Historical 08/09→08/10 remains the benchmark — but **do not wait** on it; every live day is a validation dataset.

→ **[CONTINUOUS_OPERATIONAL_VALIDATION.md](./CONTINUOUS_OPERATIONAL_VALIDATION.md)**  
→ **[OPERATIONAL_VALIDATION_MODE.md](./OPERATIONAL_VALIDATION_MODE.md)**  
→ **[NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)**  
→ **[DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)**

## Gold standard

| Prior | Current | Ground truth |
|---|---|---|
| 08/09/2026 | 08/10/2026 | **67** newly booked |

## Two morning reports

| Report | Audience | Artifact |
|---|---|---|
| **Operational** (revenue) | Staff | New Inmate Intelligence Report |
| **Engineering Certification** | Admin / developers | [ENGINEERING_CERTIFICATION_REPORT.md](./ENGINEERING_CERTIFICATION_REPORT.md) |

Plus [DAILY_CERTIFICATION_SUMMARY.md](./DAILY_CERTIFICATION_SUMMARY.md) and Learning Queue (`GET /api/admin/intelligence/learning-queue`).

### Business metrics (required)

- **Potential New Clients Found**  
- **Potential New Clients Missed**

## Every morning after manual compare

```bash
cd backend
npx tsx scripts/record-daily-ground-truth.ts --date YYYY-MM-DD --gold /path/to/manual-list.md
```

## Historical suite (when PDFs available)

```bash
cd backend
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

## Production readiness

**10 consecutive PASS days** (zero misses, zero false news, zero reconcile failures) — not a single benchmark day.

## Continuous regression

Verified days accumulate under `fixtures/sacramento/validation/days/`.