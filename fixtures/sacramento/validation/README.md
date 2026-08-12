# Sacramento Validation Suite (certification dataset)

Permanent regression dataset for NIIS’s primary mission: operational accuracy.

**Gold standard:** manual investigator comparison — not the software.  
**Pipeline:** Yesterday PDF → Today PDF → New Inmate Report (CSV is enrichment only).

## Required inputs (not in git — place locally / CI artifact)

| File | Pages | Notes |
|---|---:|---|
| `SACJAILSCAN08-09-2026.pdf` | 87 | Double-spaced Active Inmate Basic Roster |
| `SACJAILSCAN08-10-2026.pdf` | 59 | Single-spaced; may be the compressed upload |

Expected SHA256 (from production Import Inspection):

- 08/09: `a339bc257df862fda4339eea346f232d8dc33bb4e5a35d361be64239bb35cce1`
- 08/10 compressed: `6fd5066261f20405322e5ecd5ccf3be44253cb1f04f9fa33784613c331cb6991`

## Ground truth

**The gold standard is not “67.”**

The gold standard is the investigator’s verified classification for that roster date
(NEW / EXISTING / RETURNING / REVIEW). The historical file
`ground-truth-67-names.md` records the NEW section for **2026-08-10 only** — that
count is a consequence of that day’s evidence, not a permanent target.

Prefer full classifications under:

`fixtures/sacramento/certification-corpus/YYYY-MM-DD__YYYY-MM-DD/manual-classification.md`

## Run

```bash
cd backend
npx tsx scripts/seed-sacramento.ts
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts

# Release gate — replays every verified corpus pair
npm run cert:release -- --version 1.2.0
```

The harness fails unless:

- Precision and recall are 100% vs the investigator classification for that day  
- `New + Existing + Returning + Review = N`  
- Every miss/extra is explained with stage, rule, evidence, and defect category  

## Multi-day

See `multi-day-chain.md` and `../certification-corpus/`. After each verified day,
the corpus grows. Releases must pass the entire corpus.

## Policy

Every future NIIS change affecting Sacramento ingest must keep this suite green before it is considered acceptable. CI job: `sacramento-accuracy-certification`.
NIIS certifies **evidence**, not software.
