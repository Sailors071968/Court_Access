# CourtAccess NIIS – Zero Assumption Engineering Directive

> **CourtAccess NIIS is an evidence-governed criminal intelligence system. It does not guess. It does not fabricate. It does not infer facts without evidence. Every conclusion must be traceable to preserved evidence and reproducible by independent verification. The only acceptable measure of success is sustained agreement with verified investigator ground truth.**

**Effective immediately.** NIIS is an evidence-governed engineering project.

This directive sits beside the [Primary Engineering Directive](./PRIMARY_ENGINEERING_DIRECTIVE.md). Primary defines *what* NIIS must discover. This directive defines *how engineering claims are proven*.

## The engineering standard

The standard is no longer:

- "The code compiles."
- "The feature was implemented."
- "The unit tests pass."

The standard is:

> **The software produces the exact same result that an experienced Sacramento County jail investigator produces from the same evidence.**

Nothing else constitutes success.

## Every claim must be proven

Engineering shall not report "Implemented", "Completed", "Fixed", or "Resolved" unless accompanied by measurable evidence answering:

1. What evidence proves this?
2. How was it tested?
3. Against which PDF?
4. Against which roster date?
5. Against which investigator result?
6. What was the exact outcome?

### Replace feature completion with certification

```
Identity Engine / Comparison Engine / Parser / …

Test Dataset:     Sacramento PDF  <roster-date>
Manual Ground Truth:  <N> New Inmates
NIIS Result:          <N> New Inmates
False Positives:      0
False Negatives:      0
Precision:            100%
Recall:               100%
Status:               CERTIFIED | FAIL | BLOCKED | PROVISIONAL | UNKNOWN
```

That is engineering evidence.

## Nothing is trusted until certified

**Not evidence of correctness:**

- Code review
- Unit tests
- Successful compilation
- Successful deployment
- UI screenshots
- Passing API tests

Those prove the software *runs*. They do not prove the software is *correct*.

Correctness is proven only by comparison against verified Sacramento County rosters and investigator manual results.

## Every stage must certify itself

| Stage | Metrics |
|---|---|
| Parser | Pages processed, records extracted, pages skipped, extraction confidence |
| Identity | Exact matches, alias matches, fuzzy candidates, review candidates, merge decisions |
| Comparison | Prior size, current size, new, existing, returning, review |
| Certification | Precision, recall, FP, FN, reconciliation |

## Unknown is never hidden

Whenever NIIS cannot determine something, it must explicitly state **UNKNOWN**.

Never silently substitute blanks, defaults, estimates, inferred values, or fabricated information.

Unknown is an acceptable engineering result. Fabricated information is not.

## Self-verification

After every daily run, NIIS automatically attempts to disprove its own output:

- Did every PDF page parse?
- Did inmate counts reconcile?
- Did alphabetical ordering unexpectedly change?
- Did OCR confidence fall?
- Did page / record counts deviate significantly from recent days?
- Did any inmate fail classification?
- Did every "new" inmate truly have no match on the prior certified roster?

If any answer is uncertain, the report is **Provisional** — never silently certified.

## Permanent learning

Every discrepancy becomes a documented defect, a permanent regression test, and a measured improvement after correction. The same mistake must never reappear unnoticed.

## The one metric that matters

Prominently display:

- **Days Since Last Missed New Inmate**
- **Days Since Last False New Inmate**

When history is insufficient, display **UNKNOWN** — never invent a streak.

## Replay Mode

Given any two historical certified PDFs, NIIS shall:

1. Re-run the pipeline with current algorithms  
2. Compare against original NIIS output (if preserved) and investigator ground truth  
3. Produce a delta report: improved / regressed / why  

## Implementation map

| Capability | Location |
|---|---|
| Self-verification | `backend/src/intelligence/inmates/selfVerification.ts` |
| Stage metrics | `backend/src/intelligence/inmates/stageMetrics.ts` |
| Reliability streaks | `reliabilityStreaks()` in `selfVerification.ts` → morning board |
| Replay Mode | `backend/scripts/niis-replay.ts` + `POST /api/admin/intelligence/replay` |
| UNKNOWN helpers | `unknown.ts` |
