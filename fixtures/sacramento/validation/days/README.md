# Continuous daily certification datasets

Every verified morning becomes a permanent regression case.

## Layout

```
days/
  YYYY-MM-DD/                 ← current (today) roster date
    prior.pdf                 ← yesterday SACJAILSCAN
    current.pdf               ← today SACJAILSCAN
    ground-truth-new.md       ← investigator’s manual new-inmate list
    niis-certification.json   ← copied from DAILY_CERTIFICATION_SUMMARY.json after a PASS
    README.md                 ← optional notes (page counts, spacing, anomalies)
```

## How to add a day

1. Run the morning PDF comparison (manual + NIIS).  
2. When the investigator verifies the new-inmate list, save it as `ground-truth-new.md`.  
3. Place both PDFs in the day folder (or symlink).  
4. Re-run:

```bash
cd backend
SAC_PRIOR_PDF=../fixtures/sacramento/validation/days/YYYY-MM-DD/prior.pdf \
SAC_CURRENT_PDF=../fixtures/sacramento/validation/days/YYYY-MM-DD/current.pdf \
SAC_GOLD_LIST=../fixtures/sacramento/validation/days/YYYY-MM-DD/ground-truth-new.md \
SAC_PRIOR_DATE=YYYY-MM-DD-1 \
SAC_CURRENT_DATE=YYYY-MM-DD \
SAC_EXPECTED_NEW=<count> \
SAC_WIPE=1 \
npx tsx scripts/sacramento-validation-suite.ts
```

5. On PASS, copy `reports/niis-reliability/DAILY_CERTIFICATION_SUMMARY.json` into the day folder.

## Anchor dataset

`../` (parent) holds the permanent 08/09 → 08/10 pair with **67** ground-truth names.

If any future code change disagrees with a previously verified day, CI / the suite must fail.
