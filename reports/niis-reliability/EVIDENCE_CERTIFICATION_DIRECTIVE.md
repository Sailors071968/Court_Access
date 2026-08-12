# CourtAccess NIIS – Evidence Certification Directive

> CourtAccess NIIS is an evidence-governed criminal intelligence system. It does not guess. It does not fabricate. It does not infer facts without evidence. Every conclusion must be traceable to preserved evidence and reproducible by independent verification. The only acceptable measure of success is sustained agreement with verified investigator ground truth.

**Effective immediately, NIIS shall certify evidence, not software.**

- Every uploaded Sacramento County PDF becomes a **permanent piece of evidence**.
- Every certified roster becomes a **permanent evidence artifact**.
- Every manual comparison becomes a **permanent gold-standard evidence artifact**.

**Algorithms are temporary. Evidence is permanent.**

## The gold standard is not “67”

The gold standard is **not** a target count.

The gold standard is the investigator’s full verified classification for a roster date:

```
Roster Date: 2026-08-10
Prior Roster Date: 2026-08-09

NEW:
…

EXISTING:
…

RETURNING:
…

REVIEW:
…
```

The number of NEW names (historically 67 for 08/10) is merely a **consequence** of that evidence.

- If tomorrow there are 41 new inmates, the gold standard is **41**.
- If tomorrow there are 112, the gold standard is **112**.

NIIS must never optimize for matching “67.”  
It must optimize for matching the investigator’s verified classification **every day**.

## Sacramento Certification Corpus

Permanent repository:

```
fixtures/sacramento/certification-corpus/
  README.md
  index.json
  TEMPLATE/
  2026-08-09__2026-08-10/
    meta.json
    yesterday.pdf / today.pdf   (or path pointers once preserved)
    canonical-roster.json
    manual-classification.md    ← gold standard (all four classes)
    niis-output.json
    discrepancies.json
    root-cause.md
    resolution.json
  2026-08-10__2026-08-11/
  2026-08-11__2026-08-12/
  …
```

Each verified pair is a definitive benchmark for every future release.

## Release Certification

Every release must pass the **entire** certification corpus before deployment:

```
Release X.Y.Z
Replay: N certified roster pairs
Missed inmates: 0
False new: 0
Regression: 0
Status: CERTIFIED | FAIL
```

If any previously certified day regresses, the release **fails**.

```bash
cd backend && npm run cert:release
```

## Algorithm quality vs data quality

When NIIS disagrees with the investigator, classify why:

| Category | Example |
|---|---|
| `parser_defect` | Missed an inmate because a page failed to parse |
| `ocr_defect` | Name extracted incorrectly |
| `identity_defect` | Failed to recognize an alias |
| `comparison_defect` | Classified an existing inmate as new |
| `source_defect` | PDF itself contained inconsistent data |
| `manual_review` | Investigator corrected an ambiguous case |

Over time this yields objective evidence of where improvements are most needed.

## Evidence Ledger

Every daily run creates an immutable ledger recording:

1. Evidence received  
2. Evidence processed  
3. Evidence preserved  
4. Evidence certified  
5. Intelligence produced  
6. Manual verification  
7. Final certification  

Implementation: `InmateEvidenceLedger` + `evidenceLedger.ts`.

## Implementation map

| Artifact | Location |
|---|---|
| Corpus | `fixtures/sacramento/certification-corpus/` |
| Manual classification | `manualClassification.ts` |
| Defect categories | `defectCategories.ts` |
| Evidence ledger | `evidenceLedger.ts` + Prisma |
| Release cert | `scripts/release-certification.ts` (`npm run cert:release`) |
| Daily truth (full classes) | `scripts/record-daily-ground-truth.ts --classification …` |
