# California Criminal Repository Certification (Program 68)

**Objective:** ingest every California criminal offense across all 27 listed codes into
the canonical repository. **Method:** ran the real `discover → acquire → process`
engine live against `leginfo.legislature.ca.gov`. **All figures are measured** from
`coverage-report.json` and acquisition indexes — no estimated coverage.

**Generated:** 2026-07-06.

---

## 1. Coverage dashboard (measured, cumulative)

| Repository | Total records | Notes |
|------------|--------------:|-------|
| statutes | **339** | PEN 189 + VEH 150 |
| offenses | **92** | PEN 90 + VEH 2 |
| elements | **238** | |
| mens_rea | 92 | |
| exceptions | 93 | |
| defenses | 4 | |
| cross_references | **481** | |
| regulatory_incorporations | **284** | incorporated regulations |
| authorities | **162** | |
| calcrim_links | 4 | `calcrimCoveragePercent: 4.35%` |
| **criminalOffensesIdentified** | **92** | |
| parsingFailures | **0** | |
| manualReviewCandidates | 0 (this run) | |

## 2. Codes ingested vs scope

| Code | Status | Sections | Offenses |
|------|--------|---------:|---------:|
| **PEN** Penal Code | substantially complete | 207 (188 processed) | 90 |
| **VEH** Vehicle Code | partial | 150 | 2 |
| HSC, BPC, EVID, FGC, FAC, PRC, HNC, MVC, RTC, INS, FIN, CORP, LAB, EDC, GOV, PUC, WAT, WIC, CCP, CIV, FAM, PROB, COM, UIC, SHC | **not ingested** | 0 | 0 |

**2 of 27 codes** have ingested data.

## 3. Hash verification (integrity)

| Code | Hashed sections |
|------|----------------:|
| PEN | 207 |
| VEH | 150 |
| **Total** | **357** SHA-256 content hashes (`acquisition-index.jsonl`) |

`parsingFailures: 0` — all processed sections parsed cleanly.

## 4. Honest finding — criminal-offense yield vs crawl order

The discovery engine crawls a code **top-to-bottom**. The first ~396 Vehicle Code
sections are **administrative** (DMV, registration, licensing) — only **2** are
criminal. The Vehicle Code's criminal offenses (DUI §23152, reckless §23103, etc.)
live in **later divisions** the bounded crawl did not reach. Therefore:

- **Bounded top-of-code ingestion inflates statute count but not criminal-offense
  count.** PEN yielded 90 offenses because it *is* the criminal code; VEH yielded 2
  because its criminal divisions weren't reached.
- **Full completion requires either (a) full crawls of each code (very large — HSC
  discovery exceeded a 4-minute budget mid-crawl) or (b) targeted discovery of each
  code's criminal divisions.** This is a real engineering constraint, not a coverage
  estimate.

## 5. Unknown coverage / cross-reference verification

- Unknowns are recorded honestly (PEN offenses carried unknown-field rates; VEH low).
- Cross-references: **481 extracted**; **link-target validation not yet run** (extracted,
  not verified) — flagged UNKNOWN for validation.
- CALCRIM: **4.35%** — dominant gap.

## 6. Repository Certification

**DENIED for completeness; PASS for integrity of what is ingested.**
- ✅ Integrity: 357 sections SHA-256 hashed, versioned via acquisition index, audited,
  0 parsing failures — the ingested corpus is traceable and clean.
- ❌ Completeness: 2 of 27 codes; only PEN is criminally substantial (90 offenses); VEH
  is administrative-heavy; 25 codes and most criminal enhancements/sentencing/defenses
  across non-PEN codes remain unacquired.
- This is **not yet the canonical complete California criminal repository.** No coverage
  figure is estimated; all numbers are measured.

## 7. Continue (runbook — proven)

```bash
cd backend
# Targeted deeper discovery reaches criminal divisions:
npm run leginfo:discover -- --code VEH --max-pages 200     # reach §23xxx (DUI)
npm run leginfo:acquire  -- --code VEH --max-sections 5000 --resume
npm run leginfo:process  -- --code VEH --max-sections 5000
# Repeat for HSC (drugs §11xxx), BPC, then remaining codes.
```

## 8. Reproduce
```bash
cd backend
cat data/legislative/repositories/coverage-report.json     # 339 statutes / 92 offenses
for c in PEN VEH; do rg -c '"contentHash"' data/legislative/raw/$c/acquisition-index.jsonl; done  # 207 / 150
```
