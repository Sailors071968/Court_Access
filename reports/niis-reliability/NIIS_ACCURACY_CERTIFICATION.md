# NIIS Accuracy Certification — Engineering Directive

**Effective:** 2026-08-11  
**Status:** Binding. **Architecture frozen** — see `OPERATIONAL_VALIDATION_MODE.md`.

## Sole objective

Operational accuracy for Sacramento County Jail rosters:

| Requirement | Target |
|---|---|
| Recall (never miss a new inmate) | **100%** |
| Precision (never report a non-new inmate as new) | **100%** |
| Potential New Clients Found | = ground-truth new count |
| Potential New Clients Missed | **0** |

No other development task outranks this. No architectural changes, new engines, UI work, watch-list work, or API integrations until certified.

## Gold-standard principle

**The manual comparison performed by an experienced investigator is the gold standard — not the software.**

NIIS must never assume it is correct merely because processing completed. Whenever a human identifies a discrepancy (for example, 67 newly booked inmates), that manual result becomes the benchmark the software must **explain or match**. The system stays grounded in operational reality and improves only when it closes measured gaps against that benchmark.

## Official certification dataset

| Item | Value |
|---|---|
| Prior roster | `SACJAILSCAN08-09-2026.pdf` (87 pages, double-spaced) |
| Current roster | `SACJAILSCAN08-10-2026.pdf` (59 pages, single-spaced) |
| Ground truth | **67** newly booked inmates (administrator, 2026-08-10) |
| Gold list | `fixtures/sacramento/validation/ground-truth-67-names.md` |

This pair is the permanent Sacramento certification / regression dataset.

## Account for every inmate

The comparison engine must produce a disposition for **every** inmate on the current roster. Exactly one of:

- **New inmate**
- **Existing inmate** (still in custody / known)
- **Returning inmate**
- **Review required**

No unclassified inmates.

If today’s roster contains \(N\) inmates:

```
New + Existing + Returning + Review = N
```

If the totals do not reconcile, **the run fails**.

Finding the 67 is necessary but not sufficient; full roster accounting is mandatory.

## Stage-by-stage accounting

Every certification run must report counts after each stage:

```
PDF extracted
  → Roster records parsed
  → Normalized
  → Identity candidates
  → Identity decisions
  → Classification
  → Report generation
```

The count entering each stage must equal the count leaving the previous stage unless the loss/gain is **explicitly explained**. No silent losses.

## Explain every miss

If any of the expected 67 are absent from the New Inmate Report, the run must identify for each:

1. The inmate  
2. The exact processing stage where they left the “new” path  
3. The rule responsible  
4. The evidence considered  
5. Why that rule produced the result  

Do not stop at “missing.”

## Explain every extra

If NIIS reports an inmate that is not actually new, the run must explain why the system believed they were new. Do **not** merely remove them from the report — fix the underlying reasoning.

## Regression suite (mandatory)

The Sacramento Validation Suite is mandatory. Every future build shall execute:

```
08/09 roster → 08/10 roster → Expected 67 → Actual 67 → PASS
```

plus full disposition reconciliation. Any deviation fails CI.

Harness: `backend/scripts/sacramento-validation-suite.ts`  
CI job: `.github/workflows/ci.yml` → `sacramento-accuracy-certification`

## Multi-day validation

Passing 08/09 → 08/10 is necessary but insufficient. After that pair is green, validate consecutive days:

```
08/10 → 08/11
08/11 → 08/12
08/12 → 08/13
…
```

until NIIS consistently reproduces manual results. Manifest: `fixtures/sacramento/validation/multi-day-chain.md`.

## Production readiness

NIIS is production-ready for Sacramento only when it repeatedly satisfies:

1. Every inmate accounted for  
2. Every new inmate detected  
3. Zero unexplained omissions  
4. Zero unexplained additions  
5. Printable report exactly matches manual verification  
6. Every conclusion traceable to preserved evidence  

## Daily workflow (PDF primary)

Certification exercises the revenue path:

**Yesterday PDF → Today PDF → comparison → new-inmate report** (CSV is optional enrichment and must not determine newness).

See `DAILY_PDF_PRIMARY_WORKFLOW.md` and the `InmateDailyCase` operational unit.

## What may change before certification passes

Only root-cause fixes required to pass this certification (parser, normalization, identity, classification, report semantics, evidence preservation, Daily Case / PDF-primary wiring). No unrelated Phase 2 feature work.
