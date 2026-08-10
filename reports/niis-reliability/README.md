# NIIS Phase 1 — Sacramento ground-truth acceptance

Feature / architecture work is stopped until the Sacramento Validation Suite passes.

## Acceptance test (primary)

- **[SACRAMENTO_ACCEPTANCE_TEST.md](./SACRAMENTO_ACCEPTANCE_TEST.md)** — objective, pass criteria, how to run  
- **Harness:** `backend/scripts/sacramento-validation-suite.ts`  
- **Gold list:** `fixtures/sacramento/validation/ground-truth-67-names.txt` (67 names)  
- **Latest result:** [SACRAMENTO_VALIDATION_RESULT.md](./SACRAMENTO_VALIDATION_RESULT.md)

**Pass:** Ground Truth 67 / NIIS 67 / Missing 0 / Extra 0

## Prior audit notes

- **[PHASE1_RELIABILITY_ASSESSMENT.md](./PHASE1_RELIABILITY_ASSESSMENT.md)** — root-cause documentation from the blocked audit  
- **[ground-truth-67-new-inmates-2026-08-10.md](./ground-truth-67-new-inmates-2026-08-10.md)** — administrator list (same 67)

## Unblock checklist

1. Place complete `SACJAILSCAN08-09-2026.pdf` (87 pp) and `SACJAILSCAN08-10-2026.pdf` (59 pp) under `fixtures/sacramento/validation/` or `/tmp/sacjail/`.  
2. Prefer a clean DB: `SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts` from `backend/`.  
3. Fix root causes until the suite is green — then Phase 2 may continue.
