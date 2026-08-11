# CourtAccess NIIS — Operational Validation Mode

**Effective:** 2026-08-11  
**Status:** Binding.  
**Also see:** [CONTINUOUS_OPERATIONAL_VALIDATION.md](./CONTINUOUS_OPERATIONAL_VALIDATION.md) — every day is a validation dataset; do not wait on history alone.

## Architecture freeze

The architecture is **frozen**. Until Sacramento daily PDF comparison sustains 100% recall and 100% precision (see 10-day readiness standard):

| Forbidden | Allowed |
|---|---|
| Architectural changes | Root-cause fixes required for certification |
| New intelligence engines | Parser / normalize / identity / classification fixes proven by stage ledger |
| UI enhancements | Certification summary / suite output improvements |
| Watch-list enhancements | Evidence preservation needed for explain-miss/extra |
| External API integrations | Nothing else |

**Sole engineering objective:** 100% operational accuracy on the daily Sacramento County jail roster comparison (PDF primary).

## Morning operational workflow

```
Yesterday PDF
        │
Today's PDF
        │
        ▼
Validate PDFs
        │
        ▼
Extract roster
        │
        ▼
Normalize roster
        │
        ▼
Compare with previous roster
        │
        ▼
Identify ALL newly booked inmates
        │
        ▼
Historical lookup
        │
        ▼
Generate New Inmate Intelligence Report
        │
        ▼
Persist repository
        │
        ▼
Await optional CSV enrichment
```

PDF comparison is the **revenue-producing** operation. CSV enrichment is secondary and never determines newness.

## Daily certification summary (required every run)

Every daily run must produce:

| Field | Meaning |
|---|---|
| Previous roster date | Yesterday |
| Current roster date | Today |
| Previous inmate count | Unique names on prior PDF |
| Current inmate count | Unique names on current PDF (= N) |
| New inmates | Disposition count |
| Existing inmates | Disposition count |
| Returning inmates | Disposition count |
| Review required | Disposition count |
| Total reconciliation | Must equal N |
| Processing time | Wall clock for the run |
| Certification status | PASS / FAIL / BLOCKED |

Reconciliation identity:

```
Today's Roster Count (N) = New + Existing + Returning + Review Required
```

No inmate may disappear without explanation.

## Technical + business metrics

| Technical | Business |
|---|---|
| Precision | **Potential New Clients Found** (= true positives vs manual gold) |
| Recall | **Potential New Clients Missed** (= false negatives vs manual gold) |
| Missing / Extra | — |

A single miss is not only a false negative — it is a potentially missed business opportunity. Surface both metrics every morning.

## Gold standard dataset

| Pair | Ground truth |
|---|---|
| 08/09/2026 → 08/10/2026 | **67** new inmates |

Build is not certified until Recall 100%, Precision 100%, Missing 0, Extra 0.

## Continuous improvement

Beginning with each new daily upload:

1. Preserve the PDFs  
2. Preserve the investigator’s manual new-inmate list  
3. Preserve NIIS certification output  

That verified day becomes a permanent regression case under  
`fixtures/sacramento/validation/days/YYYY-MM-DD/`.

If any future code change disagrees with a previously verified day, the regression suite fails.

## Harness

```bash
cd backend
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

Emits:

- `reports/niis-reliability/SACRAMENTO_VALIDATION_RESULT.md`
- `reports/niis-reliability/SACRAMENTO_VALIDATION_RESULT.json`
- `reports/niis-reliability/DAILY_CERTIFICATION_SUMMARY.md` (operator-facing)
