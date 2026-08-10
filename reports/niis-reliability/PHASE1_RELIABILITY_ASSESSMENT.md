# NIIS Reliability Assessment — Phase 1 Validation Audit

**Status:** BLOCKED on full 67-row scoring — real PDFs are now visible via Import Inspection, but they have **not been imported into the repository**, and the **67-name list is still outstanding**.  
**Date of audit:** 2026-08-10 (updated after SACJAILSCAN Import Inspection)  
**Directive:** Stop feature development until core new-inmate detection is validated against known ground truth. **No code fixes are implemented in this deliverable.**

---

## 1. Executive conclusion

| Question | Answer |
|---|---|
| Can NIIS be scored against the 67 new inmates for 08/10/2026 vs 08/09/2026? | **No — not with data currently available to the agent.** |
| Are real Sacramento County rosters for those dates in the repository? | **No.** Only format-aligned **sample** fixtures exist (5 rows on 08/09, 8 on 08/10). |
| Is production usable as a clean ground-truth environment? | **No.** Production NIIS repository is **contaminated** by bulk-import acceptance clones (~1,800 synthetic CSV batches). |
| What does production currently report for “today”? | **10** people labeled as newly booked; **14,619** returning; **14,629** bookings across **10** people. |
| Feature work status | **Stopped.** Corrections listed below are recommendations only. |

**Primary blocker:** The administrator’s ground truth (67 newly booked) cannot be reconciled to any roster file the agent can read. The sample CSV for 08/10 contains **8** people; at most **5** are “new” relative to the sample prior file. That is not the county export that produced the 67-person benchmark.

---

## 2. Validation dataset inventory

### 2.1 Expected (administrator)

| Item | Value |
|---|---|
| Prior roster date | 2026-08-09 |
| Current roster date | 2026-08-10 |
| Ground-truth newly booked | **67** (human visual comparison of the two PDFs) |
| Prior file name | `SACJAILSCAN08-09-2026.pdf` |
| Current file name | `SACJAILSCAN08-10-2026.pdf` |

### 2.2 Real county PDFs — Import Inspection (production, 2026-08-10)

These were uploaded through **Import Inspection** (analysis only — **nothing written to the inmate repository**). Fingerprints match the stuck Import Jobs that never received bytes.

| File | Inspection ID | Size | Pages | Text layer | OCR used | Verdict | Parser confidence |
|---|---|---:|---:|---|---|---|---:|
| `SACJAILSCAN08-09-2026.pdf` | `74087247-dd79-4d6f-bc8d-f976ab1bc48b` | 27.6 MB | **87** | yes | no | would_import_with_warnings | **45%** |
| `SACJAILSCAN08-10-2026.pdf` | `4de36a2a-a26a-490d-acf8-09c90164dd28` | 345 KB | **1** | yes | no | would_import_with_warnings | **45%** |

**Inspection structural findings (both files):**
- `columns: []` — **zero columns recognized** against the published Sacramento PDF profile (expects BOOKING, NAME, DOB, SEX, BOOKED, HOUSING, CHARGES, BAIL).
- Layout is **multi-line per inmate** (Name / XREF / Housing / Classification / Gender / DOB on separate lines). Compatibility reason: *“No line carries both a date and a name…”*
- Sample text on **08/09** includes visitor-instruction pages plus “Active Inmate Basic Roster **08/09/2026**” (garbled tokens like `Of=FICE`, `Classlflcatlon`).
- Sample text on the file named **08/10** shows roster header date **`08/09/2026 06:20`** and only **1 page** — **file-identity risk: this may not be a full 08/10 roster** (size/page count vs 87-page prior is inconsistent with a same-format daily roster).

**Finding R-07 (parser / profile):** Real Sacramento PDF layout does not match the v1 PDF profile. Import Inspection correctly warns at 45% confidence; a successful “Would import with warnings” is **not** evidence that 67 new inmates can be extracted.

**Finding R-08 (08/10 file integrity):** Before scoring the 67, confirm `SACJAILSCAN08-10-2026.pdf` is the complete 08/10 Active Inmate Basic Roster (expected: multi-page, date line 08/10/2026). Current inspection text says **08/09/2026** on a **1-page** file.

### 2.3 Sample fixtures still in git (not the ground-truth pair)

| File | Rows (excl. header) | Role |
|---|---:|---|
| `fixtures/sacramento/roster-2026-08-09-prior.csv` | 5 | Sample prior roster |
| `fixtures/sacramento/roster-2026-08-10.csv` | 8 | Sample current roster |
| `fixtures/sacramento/roster-2026-08-10.pdf` | text-layer sample | Sample PDF |
| `fixtures/sacramento/README.md` | — | Explicitly: *“format-aligned… until a real county export is available”* |

### 2.3 Production snapshot (courtaccess.net, audited 2026-08-10 ~18:00 UTC)

| Metric | Value | Interpretation |
|---|---:|---|
| Repository people | 10 | Identity collapsed sample names across clones |
| Bookings | 14,629 | Dominated by acceptance harness clones |
| Observations | 14,637 | Same |
| Batches completed “today” | 1,830 | Acceptance pollution |
| Morning headline new / returning | 10 / 14,619 | Not county ground truth |
| Unresolved review | 0 | — |
| Active parser profiles | 2 (CSV + PDF) | Sacramento configured |

**Finding R-01 (environment integrity):** Production cannot be used to prove the 67-person mission until the repository is reset or isolated and only real 08/09–08/10 county files are ingested in order.

---

## 3. Sample-fixture presence analysis (not the 67)

Independent row comparison of the **sample** CSVs (X-Ref based):

| # | X-Ref | Name (08/10) | On 08/09 sample? | Fixture-relative classification |
|---|---|---|---|---|
| 1 | XR-10001 | RAMIREZ, JOSE ANTONIO | No | **New inmate** |
| 2 | XR-10002 | CHEN, MEI LIN | No | **New inmate** |
| 3 | XR-10003 | JOHNSON, MARCUS | Yes (prior BK-260720-009) | **Returning inmate** |
| 4 | XR-88001 | WILLIAMS, ANDREA R | Yes (prior BK-260701-044) | **Returning inmate** |
| 5 | XR-10005 | PATEL, RAJ K | No | **New inmate** |
| 6 | XR-10006 | GARCIA, SOFIA ELENA | No | **New inmate** |
| 7 | XR-77012 | BROWN, TYRELL J | Yes (prior BK-260715-018) | **Returning inmate** |
| 8 | XR-10008 | NGUYEN, LAN T | No | **New inmate** |

| Fixture metric | Count |
|---|---:|
| 08/10 rows | 8 |
| Fixture-expected **new** | **5** |
| Fixture-expected **returning** | **3** |
| Admin ground truth **new** | **67** |
| Gap | **62 unexplained** — **missing real roster files**, not an unexplained NIIS omission against those files |

Prior-only people (on 08/09 sample, absent from 08/10 sample): LOPEZ, DIEGO; SMITH, KAREN → fixture-relative **departures** (not “new”).

---

## 4. Account for every one of the 67 (required table)

| Expected New Inmate | NIIS Classification | Explanation |
|---|---|---|
| *(all 67 identities)* | **Unknown — not auditable** | No roster file or spreadsheet listing the 67 was present in the workspace or recoverable from a clean production ingest of real county exports. |

### Partial production “new inmates” list (date filter 2026-08-10) — **not** the 67

These are the **10** people production currently returns from `GET /api/admin/intelligence/new-inmates?date=2026-08-10`:

| Name | Booking # | priorArrestCount | totalArrestCount | Fixture-relative truth | Production label issue |
|---|---|---:|---:|---|---|
| NGUYEN, LAN | BK-260810-008 | 0 | 1828 | New | Listed new; identity later absorbed ~1.8k clone bookings |
| BROWN, TYRELL | BK-260810-007 | 1 | 1829 | **Returning** | Still appears on new-inmates API despite prior=1 |
| GARCIA, SOFIA | BK-260810-006 | 0 | 1828 | New | Listed new |
| PATEL, RAJ | BK-260810-005 | 0 | 1828 | New | Listed new |
| WILLIAMS, ANDREA | BK-260810-004 | 1 | 1829 | **Returning** | Still appears on new-inmates API despite prior=1 |
| JOHNSON, MARCUS | BK-260810-003 | 1 | 1829 | **Returning** | Still appears on new-inmates API despite prior=1 |
| CHEN, MEI | BK-260810-002 | 0 | 1828 | New | Listed new |
| RAMIREZ, JOSE | BK-260810-001 | 0 | 1828 | New | Listed new |
| SMITH, KAREN | BK-260728-022 | 0 | 1 | Prior-only (08/09) | Appears under 08/10 new-inmates query (date filter semantics) |
| LOPEZ, DIEGO | BK-260725-011 | 0 | 1 | Prior-only (08/09) | Same |

**Finding R-02 (new-inmate API vs presence):** People with `priorArrestCount ≥ 1` (returning by change-detection rules) still appear in the new-inmates list. Frozen “discoveredOn” / report membership is not equivalent to current presence classification.

**Finding R-03 (identity collapse under load test):** Acceptance clones mutated booking/X-Ref but kept the same name+DOB → identity resolution merged ~1,828 bookings onto each sample person → `totalArrestCount` exploded while `priorArrestCount` on the discovery record stayed 0 for first-seen people.

---

## 5. Processing stage audit

### 5.1 Required pipeline (directive)

```
PDF parsed → CSV parsed → Normalized → Identity candidates → Merged
  → Review queue → Change detection → Report generation
```

### 5.2 Counts — **real 08/09→08/10 county pair**

| Stage | Count | Disposition |
|---|---:|---|
| PDF parsed | — | **Not run** — real PDF absent |
| CSV parsed | — | **Not run** — real CSV absent |
| Normalized | — | — |
| Identity candidates | — | — |
| Merged | — | — |
| Review queue | — | — |
| Change detection | — | — |
| Report generation | — | — |

### 5.3 Counts — production morning snapshot (contaminated)

| Stage / signal | Count | Notes |
|---|---:|---|
| Documents / batches | 1,830 | Nearly all acceptance CSVs |
| Records read (dashboard) | 14,637 | Contaminated |
| People after identity merge | 10 | Collapse onto sample identities |
| Review queue | 0 | No human-review backlog |
| New (morning) | 10 | Not 67 |
| Returning (morning) | 14,619 | Acceptance artifact |
| Departures (dashboard) | 14,629 | Acceptance artifact |
| Daily report “Newly Booked” pill (frozen HTML sample) | 10 | Includes returning names when discovery frozen early |

### 5.4 Sample CSV stage walk (manual, file-level only)

| Stage | 08/09 prior | 08/10 current | Notes |
|---|---:|---:|---|
| Rows detected | 5 | 8 | Header + data lines |
| Rows imported (expected if clean ingest) | 5 | 8 | Profiles designed for these headers |
| Rows skipped / malformed / rejected | 0 | 0 | Clean samples |
| OCR failures | n/a | n/a (text PDF sample) | OCR path returns `ocr_not_available` for scanned PDFs in code |
| Missing required fields | 0 | 0 | Against Sacramento sample profile |
| Duplicate rows in file | 0 | 0 | — |

No unexplained row loss **within the sample files**. The loss of the **67** is unexplained because the **source population was never present**.

---

## 6. Parser audit

### CSV (`fixtures/sacramento/roster-2026-08-*.csv`)

| Metric | 08/09 | 08/10 |
|---|---:|---:|
| Rows detected | 5 | 8 |
| Rows imported (design / profile intent) | 5 | 8 |
| Rows skipped | 0 | 0 |
| Rows malformed | 0 | 0 |
| Rows rejected | 0 | 0 |
| Missing required fields | 0 | 0 |
| Duplicate rows | 0 | 0 |

**Caveat:** Profile headers are admitted guesses until a live export is inspected (`fixtures/sacramento/README.md`, Phase 2 docs). Sample success ≠ county-export success.

### PDF (`roster-2026-08-10.pdf`)

| Metric | Value |
|---|---|
| Text-layer parse (ops evidence) | Exercised in production ops screenshots (`reports/niis-ops/11-uploads-pdf-ok.png`) |
| OCR failures | Code path: OCR **not available** for scanned pages |
| Row parity vs CSV sample | Designed as companion sample, not independently audited row-for-row in this pass against 67 |

**Subsystem score (evidence-limited):** see §10.

---

## 7. Identity resolution audit (for “should be new but wasn’t”)

Against the **67**, every expected new inmate is in state **Unknown — source absent**.

Against the **sample fixture**, the three people who should **not** be “new” if 08/09 was ingested first:

| Inmate | Should be | Production new-inmates API | Evidence |
|---|---|---|---|
| JOHNSON, MARCUS | Returning | Listed (prior=1) | Same X-Ref on prior; new booking # |
| WILLIAMS, ANDREA | Returning | Listed (prior=1) | Same |
| BROWN, TYRELL | Returning | Listed (prior=1) | Same |

**Candidate / confidence / blocking keys for these three under acceptance pollution:**

| Inmate | Conf. | Booking count on person | Human review flag |
|---|---:|---:|---|
| JOHNSON, MARCUS | 95% | 1829 | Not flagged |
| WILLIAMS, ANDREA | 100% | 1829 | Not flagged |
| BROWN, TYRELL | 100% | 1829 | Not flagged |

**Policy observation (R-04):** Presence classification (`classifyPresence` in `changeDetection.ts`) distinguishes new / returning / known using prior booking count and whether the prior booking closed. The **new-inmates listing / daily report** appear to use a **frozen discovery** concept (“first appearance in repository”), which can disagree with returning classification once priors exist — and can disagree with administrator intuition of “newly booked on this roster day.”

Detailed per-candidate blocking-key dumps for all 67 require the real files + a clean ingest with debug instrumentation (recommended correction C-3). **Not fabricated here.**

---

## 8. Report generator audit

| Check | Result |
|---|---|
| Does every production “new” appear in frozen daily report HTML? | The frozen `reports/niis-ops/daily-2026-08-10.html` lists 10 newly booked including RAMIREZ…NGUYEN and also BROWN / WILLIAMS / JOHNSON |
| Do returning people appear as newly booked? | **Yes** in that frozen report when discovery was recorded as first repo appearance |
| Are SMITH / LOPEZ on the 08/10 newly-booked table in that HTML? | Present elsewhere in ops artifacts as prior-file discoveries; morning “10” mixes discovery dates |
| Exclusion of a true new inmate from report | **Cannot prove** for the 67 — files absent |

**Finding R-05:** Report copy states newly booked are “recorded at import time and never recalculated.” That design choice must be validated against the administrator definition of the 67 (roster-day new bookings vs first-ever repository appearance).

---

## 9. Metrics (against ground truth of 67)

| Metric | Value | Notes |
|---|---:|---|
| True positives | **Unknown** | Need list of 67 ∩ NIIS new |
| False positives | **Unknown** | — |
| False negatives (missed new) | **Unknown** | — |
| Incorrectly reported new | **≥3 on sample** (BROWN, WILLIAMS, JOHNSON) if prior ingested first | Observable on sample/prod semantics |
| Precision | **N/A** | Blocked |
| Recall | **N/A** | Blocked |
| NIIS reported new (prod) | 10 | ≠ 67 |
| Absolute gap vs 67 | **57** | Dominated by missing county data + pollution |

**No fabricated precision/recall.** Publishing numbers without the 67 identities would be false assurance.

---

## 10. Subsystem reliability scores

Scores are **evidence grades**, not production accuracy claims against the 67. Scale: **0–5** (5 = proven on real county ground truth).

| Subsystem | Score | Evidence |
|---|---:|---|
| CSV parser | **2** | Sample fixtures parse; profile verification script exists; **no real export freeze** |
| PDF parser | **2** | Text-layer sample worked in ops; OCR unavailable; no 67-row PDF audit |
| Normalization | **3** | Unit tests + Sacramento field rules; not scored on 67 |
| Identity resolution | **1** | Collapsed acceptance clones into 10 people with ~1.8k bookings each — high risk under repeated similar rows |
| Change detection | **2** | Pure `classifyPresence` is clear; API/report “new” diverges from returning |
| Report generation | **2** | Prints a list; includes returning people under frozen-discovery semantics |

**Overall Phase-1 mission readiness vs 67 ground truth: 0 / Not validated.**

---

## 11. Root cause analysis

| ID | Root cause | Effect on 67 audit |
|---|---|---|
| RC-1 | **Real 08/09 and 08/10 county rosters not in workspace** | Cannot enumerate 67 or attribute misses |
| RC-2 | **No administrator spreadsheet of the 67** attached to the run | Cannot build Expected→NIIS table |
| RC-3 | **Production DB polluted by bulk acceptance** | Morning counts (10 / 14,619) are meaningless for county validation |
| RC-4 | **“New inmate” product semantics vs “newly booked on roster day”** | Returning people can appear on new-inmate report/API |
| RC-5 | **Identity merge on name+DOB under synthetic clones** | Inflates booking histories; obscures clean presence tests |
| RC-6 | **Sample fixtures documented as non-final** | Success on samples does not prove county headers |

---

## 12. Recommended corrections (do not implement until approved)

1. **C-1 Provide ground-truth inputs**  
   - Real Sacramento CSV (and PDF if used) for **2026-08-09** and **2026-08-10**.  
   - Spreadsheet/list of the **67** expected newly booked (name, DOB, booking #, X-Ref if available).

2. **C-2 Isolate a clean validation environment**  
   - Fresh database **or** wipe Sacramento NIIS tables on a staging clone.  
   - Do **not** run acceptance clone jobs into the validation DB.

3. **C-3 Re-run the audit protocol**  
   - Ingest 08/09 → ingest 08/10 (CSV; then PDF if dual-source).  
   - Export stage counts after each pipeline stage.  
   - Classify every 08/10 inmate into exactly one category.  
   - Fill the 67-row Expected→NIIS table with zero unexplained blanks.  
   - Compute precision / recall / FP / FN.

4. **C-4 Resolve product definition of “new”**  
   - Administrator confirms: first-ever in repository **vs** newly booked on this roster day **vs** not on prior full roster.  
   - Align `classifyPresence`, new-inmates API, and daily report to that definition **after** the audit documents the mismatch (no silent fix before measurement).

5. **C-5 Only then implement code fixes**  
   - Targeting root causes measured in the completed 67-row table.

---

## 13. Deliverables checklist

| Deliverable | Status |
|---|---|
| Complete Reliability Assessment | **This document** (blocked sections explicit) |
| Processing Statistics | Partial (prod contaminated + sample file stats); county pair **N/A** |
| Missing Inmate Analysis | **All 67 missing as inputs** — see §4 |
| False Positive Analysis | Sample/prod semantic FPs noted (returning-as-new); full FP list **blocked** |
| False Negative Analysis | **Blocked** — need 67 list |
| Root Cause Analysis | §11 |
| Recommended Corrections | §12 — **no fixes implemented** |

---

## 14. Immediate ask to the administrator

PDFs are on production via Import Inspection. To un-block Phase 1 scoring:

1. **Confirm** `SACJAILSCAN08-10-2026.pdf` is the full 08/10 roster (inspection currently shows date **08/09/2026** and **1 page**). Re-upload the correct file if needed.  
2. Provide the authoritative list of the **67** newly booked names (booking # / DOB if available).  
3. Prefer a **Sacramento CSV export** for the same two dates if the Sheriff provides one — PDF multi-line layout is already failing profile match at 45% confidence.  
4. Confirm OK to use a **wiped/staging** NIIS database before any import of these files (production is still polluted by acceptance clones).  
5. Complete Import Jobs upload **only after** parser/profile fitness is accepted — inspection alone does not ingest.

Until the 67 list and a verified 08/10 file are in hand, **no NIIS feature development** should proceed under this directive.
