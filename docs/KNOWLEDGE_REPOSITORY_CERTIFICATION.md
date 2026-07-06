# Knowledge Repository Certification (Program 38)

**Target:** the California legal knowledge repository under
`backend/data/legislative/` and its extraction/discovery pipeline.
**Rule:** evidence only — every number below is read directly from committed data
files (`coverage-report.json`, acquisition indexes, discovery manifests). **No
estimated coverage.**

**Generated:** 2026-07-06.

---

## 1. What is actually ingested (evidence)

| Source | Ingested | Evidence |
|--------|----------|----------|
| **California codes** | **1 of 29** — Penal Code (`PEN`) only | `data/legislative/raw/` contains only `PEN/` |
| PEN raw sections acquired | **4 HTML files** (PC 25, 26, 27, 459); acquisition-index shows **3 success** rows | `raw/PEN/*.html`, `raw/PEN/acquisition-index.jsonl` |
| PEN sections **discovered** | **207** | `discovery/PEN-discovery-manifest.json` (`"section"` ×207) |
| **Federal statutes** | **0** | no federal data directory exists |
| **CALCRIM links** | **1 record** (`calcrimCoveragePercent: 50` of 2 offenses) | `coverage-report.json` |
| **Case law / Authorities** | **13 records** | `coverage-report.json` authorities |
| **Cross references** | **13 records** | `coverage-report.json` crossReferences |

**Headline:** the repository holds a **very small slice of one California code**.
Against 207 discovered PEN sections, **3–4 are acquired** (raw acquisition rate ≈
3/207). Against 29 California codes, **1** has any data. **No federal statutes.**
This is consistent with production blocker **BLK-006**.

---

## 2. Coverage statistics (verbatim from `coverage-report.json`)

Generated 2026-07-04, extractor v1.0.0:

| Repository | Total records | Unknown-field count | Unknown-field rate | Statutes covered |
|------------|---------------|---------------------|--------------------|------------------|
| statutes | 4 | 4 | 0.33 | 3 |
| offenses | 2 | 31 | **5.17** | 3 |
| elements | 4 | 0 | 0 | 3 |
| mens_rea | 2 | 12 | 2.00 | 3 |
| exceptions | 3 | 0 | 0 | 3 |
| defenses | **0** | 0 | 0 | 3 |
| cross_references | 13 | 0 | 0 | 3 |
| regulatory_incorporations | 2 | 0 | 0 | 3 |
| calcrim_links | 1 | 1 | 0.33 | 3 |
| authorities | 13 | 0 | 0 | 3 |

Summary fields: `criminalOffensesIdentified: 2`, `calcrimCoveragePercent: 50`,
`parsingFailures: 0`, `manualReviewCandidates: 0`.

---

## 3. Repository integrity & hashes (evidence)

| Check | Status |
|-------|--------|
| Content hashing | ✅ **SHA-256 per acquired section** — `acquisition-index.jsonl` records `contentHash` (e.g. `f80ea80e…`), `sourceUrl`, `httpStatus: 200`, `retrievedAt` |
| Parsing failures | ✅ **0** (`coverage-report.json`) |
| Manual-review candidates | ✅ **0** |
| Audit trail | ✅ `data/legislative/audit/extraction-audit.jsonl`, `discovery/PEN-discovery-audit.jsonl` |
| Acquisition checkpoint | ✅ `raw/PEN/acquisition-checkpoint.json` |
| Repository partitions | ✅ 11 typed repositories (statutes, offenses, elements, mens_rea, exceptions, defenses, cross_references, regulatory_incorporations, calcrim_links, authorities, statute_classifications) |

**The small ingested set is clean and integrity-hashed** — the problem is **volume/
coverage**, not data quality.

---

## 4. Discovery engine (evidence)

Functional and evidenced for PEN:
- `PEN-discovery-checkpoint.json` — visited URLs, resumable checkpoint (started/updated timestamps)
- `PEN-discovery-manifest.json` — **207 sections discovered**
- `PEN-discovery-audit.jsonl` — audit log

**Gap:** discovery found **207** PEN sections but only **~4** were acquired/extracted
→ the discovery→acquisition→extraction pipeline **stopped early** (only PC 25/26/27/459).
No other CA code and no federal code has been discovered or acquired.

---

## 5. Unknowns (evidence, not estimated)

- `offenses` unknown-field rate **5.17** and `mens_rea` **2.00** → the 2 ingested
  offenses have many unresolved fields (correctly recorded as unknowns, not fabricated).
- `defenses` repository is **empty (0 records)**.
- These are surfaced honestly per the constitution (unknown, not guessed).

---

## 6. Missing areas

1. **28 of 29 California codes** — no data (only PEN).
2. **~203 of 207 discovered PEN sections** — discovered but not acquired/extracted.
3. **All federal statutes** — none.
4. **CALCRIM** — 1 link only (50% of the 2 ingested offenses).
5. **Defenses repository** — empty.
6. **Case law** — only 13 authority records total.

---

## 7. Engineering recommendations

1. **Resume the PEN pipeline** — 207 sections are already discovered; drive them
   through acquisition→extraction (the engine works; it stopped after 4 sections).
2. **Add the remaining California codes** (28) to the discovery engine seed list.
3. **Add a federal statutes source** (e.g., U.S.C.) — currently zero coverage.
4. **Backfill CALCRIM** mapping beyond the single link.
5. **Resolve high unknown-field rates** on offenses/mens_rea before certifying those records.
6. **Publish a live coverage metric** (codes covered / sections acquired / discovered)
   on the Repository Integrity dashboard, sourced from these files — never estimated.
7. **CI gate:** fail release if `coverage-report.json` statute coverage is below the
   V1 target (define the target explicitly rather than estimating).

---

## 8. Completion (measured, not estimated)

| Dimension | Measured value |
|-----------|----------------|
| California codes with data | **1 / 29** |
| PEN sections acquired vs discovered | **~4 / 207** |
| Federal statutes | **0** |
| CALCRIM links | **1** (`calcrimCoveragePercent: 50` of 2 offenses) |
| Authorities | **13** |
| Cross references | **13** |
| Criminal offenses identified | **2** |
| Parsing failures / manual-review | **0 / 0** |
| Repository integrity (hashing, audit, checkpoints) | **Present ✅** |

**Knowledge repository certification: DENIED for coverage.**
The **infrastructure is certified** (discovery engine, SHA-256 integrity hashing,
11 typed repositories, audit trail, coverage reporting, 0 parsing failures). The
**content coverage is minimal** — one California code, a handful of sections, no
federal law — matching **BLK-006**. No coverage figure is estimated; all values are
read from committed data.

---

## 9. Reproduce

```bash
cd backend
ls data/legislative/raw                                   # only PEN/
cat data/legislative/repositories/coverage-report.json    # record counts
rg -o '"section"' data/legislative/discovery/PEN-discovery-manifest.json | wc -l   # 207 discovered
cat data/legislative/raw/PEN/acquisition-index.jsonl      # acquired sections + SHA-256 hashes
```
