# CourtAccess NIIS – Immutable Evidence & Operational Truth Directive

> CourtAccess NIIS is an evidence-governed criminal intelligence system. It does not guess. It does not fabricate. It does not infer facts without evidence. Every conclusion must be traceable to preserved evidence and reproducible by independent verification. The only acceptable measure of success is sustained agreement with verified investigator ground truth.

## The most important realization

There is only one truly irreplaceable asset in NIIS.

It is **not** the database, the algorithms, the reports, the parser, or even the code.

It is:

1. the **daily Sacramento County jail rosters** (original PDFs), and  
2. the **investigator’s verified classifications**.

Everything else can be rebuilt. Those cannot.

## The Daily Evidence Package

Every morning’s processing creates a single **immutable** package. Example:

```
fixtures/sacramento/evidence-packages/2026-08-12/
  MANIFEST.json                 ← sealed; never mutated
  CASE.md                       ← case-file summary
  evidence/
    yesterday.pdf
    today.pdf
  analysis/
    canonical-yesterday.json
    canonical-today.json
    niis-classification.json
    manual-classification.md
  certification/
    engineering-certification.json
    engineering-certification.md
    evidence-ledger.json
    learning-queue.json
  disposition/
    report.json                 ← generated operational report (if any)
    repository-snapshot.json    ← content hashes / counts for rebuild
  versions/
    software.json               ← software / parser / identity / normalization / comparison
  forensic/                     ← only when Forensic Mode enabled
    raw-parser-prior.json
    raw-parser-current.json
    normalized-records.json
    comparison-candidates.json
    identity-decisions.json
    rule-evaluations.json
    discarded-candidates.json
    confidence-calculations.json
    reconciliation.json
```

**That package never changes.**

If the software improves later, create a **new certification revision** (and optionally a new package seal under a new `certification/revisions/N/`), not an overwrite of the old one.

## Treat every day like a criminal case file

```
Case: Sacramento Jail — 2026-08-12

Evidence
  Yesterday PDF
  Today PDF

Analysis
  Canonical Rosters
  Comparison
  Manual Review

Certification
  Engineering Certification
  Evidence Ledger

Disposition
  PASS | FAIL | BLOCKED | PROVISIONAL
```

Nothing gets replaced. Nothing disappears.

## Immutable operational truth

NIIS must never rewrite history.

```
Original Classification
    ↓
Correction
    ↓
Reason
    ↓
Reviewer
    ↓
Timestamp
    ↓
Superseding Certification
```

Database rows for certifications are **append-only revisions**. The previous PASS/FAIL remains queryable forever.

## The repository must be rebuildable

```
Delete Database
    ↓
Replay Every Evidence Package
    ↓
Produce Identical Results
```

If it cannot, some information exists only in the database and not in preserved evidence — a violation of the evidence-governed philosophy.

```bash
cd backend && npm run cert:rebuild -- --packages ../fixtures/sacramento/evidence-packages
```

## Operational reproducibility (determinism)

Given the **same evidence package** and the **same software version**, NIIS must always produce the **exact same result**.

If it does not, there is hidden state that must be eliminated.

## Release promotion

A release is promoted only after:

1. Every certified evidence package is replayed  
2. Results are compared to gold-standard manual classifications  
3. There are **zero** missed new inmates, **zero** false new, **zero** unexplained regressions  
4. Any intentional behavioral changes are **explicitly documented**  

```bash
npm run cert:release -- --version X.Y.Z --changelog path/to/INTENTIONAL_CHANGES.md
```

## Forensic Mode

When `NIIS_FORENSIC_MODE=1` (or `--forensic` on packaging/replay), NIIS preserves everything from a daily run: raw parser output, normalized records, comparison candidates, identity decisions, rule evaluations, discarded candidates, confidence calculations, reconciliation results, and certification artifacts.

Enable when validating a new parser, investigating a discrepancy, or introducing a major algorithm change. Not required every day.

## Long-term goal

The growing archive of Sacramento County evidence packages becomes more valuable than the code itself. It enables historical replay, parser/identity validation, regression measurement, release certification, and the same discipline for new jurisdictions.

## Implementation map

| Artifact | Location |
|---|---|
| Evidence packages | `fixtures/sacramento/evidence-packages/` |
| Package builder | `backend/src/intelligence/inmates/evidencePackage.ts` |
| Pipeline versions | `backend/src/intelligence/inmates/pipelineVersions.ts` |
| Superseding certs | `engineeringCertification.ts` + Prisma revisions |
| Forensic Mode | `forensicMode.ts` |
| Rebuild | `scripts/rebuild-from-evidence.ts` (`npm run cert:rebuild`) |
| Release promotion | `scripts/release-certification.ts` |
