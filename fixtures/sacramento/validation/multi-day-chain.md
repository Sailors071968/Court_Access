# Multi-day Sacramento certification chain

The Sacramento Certification Corpus is the permanent benchmark:

`fixtures/sacramento/certification-corpus/`

Passing any single day is necessary but insufficient. Releases must replay **every**
verified pair (`npm run cert:release`).

## Gold standard is not a constant

| Step | Prior | Current | Manual gold | Status |
|---|---|---|---|---|
| 1 | 2026-08-09 | 2026-08-10 | Partial NEW list (67 that day only) | Corpus entry seeded; durable PDFs pending |
| 2 | 2026-08-10 | 2026-08-11 | Full NEW/EXISTING/RETURNING/REVIEW TBD | pending_pdfs |
| 3 | 2026-08-11 | 2026-08-12 | Full classification TBD | pending_pdfs |
| … | … | … | Investigator classification for that day | grows daily |

If a day has 41 new inmates, the gold standard is 41.
If a day has 112, the gold standard is 112.

## How to record / replay a pair

```bash
cd backend

# Record investigator classification into the corpus + evidence ledger
npm run cert:daily-truth -- \
  --date 2026-08-11 \
  --classification /path/to/manual-classification.md \
  --prior /path/to/yesterday.pdf \
  --current /path/to/today.pdf

# Single-pair replay
npm run cert:replay -- \
  --prior /path/prior.pdf --prior-date 2026-08-10 \
  --current /path/current.pdf --current-date 2026-08-11 \
  --gold /path/to/new-names-or-prefer-classification

# Release gate — entire corpus
npm run cert:release -- --version 1.2.0
```

Each verified pair must satisfy: 0 missed inmates, 0 false new, and
`New + Existing + Returning + Review = current roster N` when full classification exists.
