# Multi-day Sacramento certification chain

Passing **08/09 → 08/10** (67 new) is necessary but insufficient.

## Required sequence (after day-1 certification is green)

| Step | Prior | Current | Manual gold (new) | Status |
|---|---|---|---|---|
| 1 | 08/09/2026 | 08/10/2026 | **67** (attached) | Suite implemented; PDFs pending |
| 2 | 08/10/2026 | 08/11/2026 | *(administrator list TBD)* | Blocked on roster + gold list |
| 3 | 08/11/2026 | 08/12/2026 | *(administrator list TBD)* | Blocked |
| 4 | 08/12/2026 | 08/13/2026 | *(administrator list TBD)* | Blocked |

## How to run a pair

```bash
cd backend
SAC_PRIOR_PDF=/path/prior.pdf \
SAC_CURRENT_PDF=/path/current.pdf \
SAC_GOLD_LIST=/path/gold-names.md \
SAC_PRIOR_DATE=2026-08-10 \
SAC_CURRENT_DATE=2026-08-11 \
SAC_EXPECTED_NEW=NN \
SAC_WIPE=1 \
npx tsx scripts/sacramento-validation-suite.ts
```

Each pair must satisfy: 100% recall, 100% precision, and  
`New + Existing + Returning + Review = current roster N`.
