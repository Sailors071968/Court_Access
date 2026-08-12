# NIIS — Continuous Operational Validation

**One job:** the exact list of every newly booked Sacramento inmate, every morning.  
**Architecture frozen.** Historical 08/09→08/10 remains the benchmark — but **do not wait** on it; every live day is a validation dataset.

→ **[PRIMARY_ENGINEERING_DIRECTIVE.md](./PRIMARY_ENGINEERING_DIRECTIVE.md)** — **what** NIIS must discover (superseding)  
→ **[ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md](./ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md)** — **how** claims are proven (evidence-governed)  
→ **[ACCURACY_FIRST.md](./ACCURACY_FIRST.md)** — Phase B deferred until manual-list match  
→ **[DAILY_INTELLIGENCE_OPERATIONS_DIRECTIVE.md](./DAILY_INTELLIGENCE_OPERATIONS_DIRECTIVE.md)** — daily ops phases (subordinate)  
→ **[OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md](./OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md)** — subordinate  
→ **[CONTINUOUS_OPERATIONAL_VALIDATION.md](./CONTINUOUS_OPERATIONAL_VALIDATION.md)**  
→ **[OPERATIONAL_VALIDATION_MODE.md](./OPERATIONAL_VALIDATION_MODE.md)**  
→ **[NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)**  
→ **[DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)**

**Morning command center:** `/admin/intelligence` → `GET /api/admin/intelligence/morning-board`  
**Daily Difference Viewer:** `/admin/intelligence/daily-difference` → `GET /api/admin/intelligence/daily-difference`

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