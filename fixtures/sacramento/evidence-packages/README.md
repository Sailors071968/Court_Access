# Daily Evidence Packages

**The irreplaceable asset.** Original Sacramento County jail roster PDFs and
investigator verified classifications cannot be rebuilt. Everything else can.

Each morning seals one immutable package:

```text
YYYY-MM-DD/
  MANIFEST.json                 ← sealed once; never mutated
  MANIFEST.CURRENT.json         ← pointer after superseding revisions
  MANIFEST.revisions.jsonl      ← append-only seal history
  CASE.md                       ← criminal case-file summary
  evidence/
    yesterday.pdf
    today.pdf
  analysis/
    canonical-*.json
    niis-classification.json
    manual-classification.md    ← gold standard
    revisions/                  ← superseding analysis only
  certification/
    CURRENT.json
    revisions/N/                ← never overwrite; always append
  disposition/
  versions/
  forensic/                     ← only when NIIS_FORENSIC_MODE=1 or --forensic
```

## Rules

1. **Nothing gets replaced. Nothing disappears.**
2. Software improvements create a **new certification revision**, not an overwrite.
3. Given the same package + same software version → **identical results** (determinism).
4. `Delete DB → Replay every package → Identical results` must always be possible.

## Commands

```bash
cd backend

# Seal / record a day (writes corpus + evidence package + ledger)
npm run cert:daily-truth -- \
  --date 2026-08-12 \
  --classification /path/to/manual-classification.md \
  --prior /path/yesterday.pdf \
  --current /path/today.pdf \
  [--forensic] \
  [--correction-reason "…"] [--reviewer "Name"]

# Rebuild proof
npm run cert:rebuild -- --packages ../fixtures/sacramento/evidence-packages

# Release promotion
npm run cert:release -- --version 1.2.0 --changelog ../reports/niis-reliability/INTENTIONAL_CHANGES.md
```

## Forensic Mode

```bash
NIIS_FORENSIC_MODE=1 npm run cert:rebuild -- --date 2026-08-12 --forensic
```

Preserves raw parser output, normalized records, comparison candidates, identity
decisions, rule evaluations, discarded candidates, confidence calculations, and
reconciliation results under `forensic/`.
