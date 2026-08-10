# Sacramento Validation Suite (gold-standard regression)

Permanent acceptance dataset for NIIS’s primary mission: detect newly booked inmates.

## Required inputs (not in git — place locally)

| File | Pages | Notes |
|---|---:|---|
| `SACJAILSCAN08-09-2026.pdf` | 87 | Double-spaced Active Inmate Basic Roster |
| `SACJAILSCAN08-10-2026.pdf` | 59 | Single-spaced; may be named `…(1)_compressed.pdf` |

Expected SHA256 (from production Import Inspection):

- 08/09: `a339bc257df862fda4339eea346f232d8dc33bb4e5a35d361be64239bb35cce1`
- 08/10 compressed: `6fd5066261f20405322e5ecd5ccf3be44253cb1f04f9fa33784613c331cb6991`

## Ground truth

`ground-truth-67-names.txt` — administrator’s manually verified 67 newly booked names (08/10 vs 08/09).

## Run

```bash
cd backend
npx tsx scripts/seed-sacramento.ts          # publishes PDF profile v2 when needed
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

Optional paths: `SAC_PRIOR_PDF`, `SAC_CURRENT_PDF`, `SAC_GOLD_LIST`.

## Pass criteria

```
Ground Truth: 67
NIIS: 67
Missing: 0
Extra: 0
```

Result written to `reports/niis-reliability/SACRAMENTO_VALIDATION_RESULT.md`.

## Policy

Every future parser, normalization, identity, or reporting change that affects Sacramento ingest must keep this suite green before it is considered acceptable.
