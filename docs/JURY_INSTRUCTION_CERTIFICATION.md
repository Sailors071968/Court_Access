# Jury Instruction Certification (Program 50)

**Method:** static audit + measured repository counts (Program 44). Evidence only.

**Generated:** 2026-07-06.

---

## 1. Coverage (measured)

| Required | Status | Evidence |
|----------|--------|----------|
| CALCRIM | ⚠️ **minimal** | `calcrim_links` repository = **4 links** against **90 offenses** (`calcrimCoveragePercent: 4.4%`, coverage-report.json) |
| Federal Pattern Instructions | ❌ **0** | no federal ingestion (Program 45) |
| Element mapping | ✅ | `elements` repository = **234 records** (188 statutes) |
| Evidence mapping | ⚠️ | element matrices link supporting/contradictory evidence (`workbenchService`) |
| Witness mapping | ⚠️ | trial-prep witness list; not linked to instructions |
| Authority mapping | ✅ | `authorities` repository = **162 records** |
| Unknown-element detection | ✅ | element status `unknown` + unresolved legal questions |
| Missing-proof detection | ✅ | element matrix `missingEvidenceReason` |
| Contradiction detection | ✅ | contradiction analysis |

## 2. Traceability requirement (instruction → authorities/evidence/repositories)

- CALCRIM links **do** trace to the `calcrim_links` repository (hash-backed, Program 44),
  and elements/authorities are repository-sourced. ✅ for the small set that exists.
- **But CALCRIM coverage is 4.4%** — the vast majority of the 90 PEN offenses have **no
  mapped jury instruction**, and **federal pattern instructions are entirely absent**.

## 3. Verdict

**Jury Instruction Certification: DENIED.**
Element/authority repositories are real and repository-traced, and unknown/missing-proof
detection works. **CALCRIM mapping is 4.4%** (4/90 offenses) and **federal pattern
instructions are 0** — instruction coverage is far below a certifiable threshold.
No coverage figure is estimated; all counts are read from `coverage-report.json`.

## 4. Recommended work

Backfill CALCRIM mappings for the ingested PEN offenses (the linkage machinery exists);
build federal pattern-instruction ingestion after the federal connector (Program 45).
