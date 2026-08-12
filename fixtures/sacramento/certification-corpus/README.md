# Sacramento Certification Corpus

**This is the definitive evidence benchmark for every future NIIS release.**

NIIS certifies **evidence**, not software. Each corpus entry is a permanent artifact pair:

| Artifact | Purpose |
|---|---|
| Yesterday PDF | Source evidence (immutable) |
| Today PDF | Source evidence (immutable) |
| Canonical extracted roster | Deterministic parse output |
| Manual classification | Investigator gold standard (NEW / EXISTING / RETURNING / REVIEW) |
| Certified NIIS output | System classification under certification |
| Discrepancies | Diff against investigator |
| Root-cause analysis | Defect category + notes |
| Final resolution | Accepted / rejected / corrected |

## Gold standard is not a number

The gold standard is **not** “67 new inmates.”

The gold standard is the investigator’s verified classification for that roster date:

```text
Roster Date: YYYY-MM-DD

Manual Classification

NEW:
...

EXISTING:
...

RETURNING:
...

REVIEW:
...
```

If tomorrow there are 41 new inmates, the gold standard is 41.
If tomorrow there are 112, the gold standard is 112.

NIIS must never optimize for matching a historical constant.
It must optimize for matching the investigator’s verified classification **every day**.

## Layout

```text
certification-corpus/
  index.json                          # corpus registry
  TEMPLATE/                           # copy for new days
  YYYY-MM-DD__YYYY-MM-DD/             # one entry per roster pair
    meta.json
    yesterday.pdf                     # or symlink / path pointer in meta
    today.pdf
    canonical-roster.json             # optional cached extract
    manual-classification.md          # investigator gold (required for Verified)
    niis-output.json                  # certified NIIS classification
    discrepancies.json
    root-cause.md
    resolution.json
```

## Status values

| Status | Meaning |
|---|---|
| `pending_pdfs` | Durable PDFs not yet preserved |
| `pending_manual` | PDFs present; investigator classification not yet recorded |
| `verified` | Manual classification recorded and sealed |
| `certified` | NIIS output matched investigator with zero missed / zero false new |
| `regressed` | Previously certified; current replay failed |

## Release gate

```bash
npm run cert:release -- --version 1.2.0
```

Replays **every** corpus entry marked `verified` or `certified`.
Any regression fails the release.

## Recording a day

```bash
# 1. Preserve PDFs into the corpus directory (or point meta.json paths)
# 2. Record investigator classification:
npm run cert:daily-truth -- \
  --date 2026-08-11 \
  --prior-date 2026-08-10 \
  --classification /path/to/manual-classification.md \
  --prior /path/to/yesterday.pdf \
  --current /path/to/today.pdf
```

Legacy `--gold` (NEW names only) remains supported for migration, but full
classification is preferred.
