# NIIS Reliability Assessment — Phase 1 Validation Audit

**Status:** Ground-truth list received (67 names). **Mission score vs repository: 0/67 detected.** PDFs inspected only (not imported); PDF parser recognized 0 columns; 08/10 file integrity still suspect.  
**Date of audit:** 2026-08-10 (updated after SACJAILSCAN Import Inspection)  
**Directive:** Stop feature development until core new-inmate detection is validated against known ground truth. **No code fixes are implemented in this deliverable.**

---

## 1. Executive conclusion

| Question | Answer |
|---|---|
| Ground-truth list available? | **Yes** — 67 names in `ground-truth-67-new-inmates-2026-08-10.md` |
| How many of the 67 are in NIIS as new inmates today? | **0 / 67** |
| Were the SACJAILSCAN PDFs imported into the repository? | **No** — Import Inspection only |
| Can the PDF parser extract inmate rows from these files today? | **No** — 0 columns recognized; 45% confidence |
| Is the uploaded 08/10 PDF a complete daily roster? | **Doubtful** — 1 page, header date 08/09/2026; ALDANA sorts before ALFARO but is absent from sample |
| Production “new inmates” count | **10** (sample-fixture people only — not any of the 67) |
| Feature work status | **Stopped.** No fixes implemented. |

**Primary finding:** Against the administrator’s 67-name ground truth, NIIS currently has **zero true positives**. Failure is upstream of identity/change detection: real PDFs were never parsed into inmate rows, and the 08/10 upload does not look like a full same-format roster.

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

Source list: `reports/niis-reliability/ground-truth-67-new-inmates-2026-08-10.md` (administrator).

**Uniform NIIS outcome for all 67:** category = **Absent** (not New / Returning / Known / Duplicate / Review / Ignored / Parsing-failure-row / Merge / Conflict).
**Responsible stage:** **PDF parser / profile + non-ingest inspection path** (not identity resolution, not change detection, not report generation — those stages never received these people).

| # | Expected New Inmate | NIIS Classification | Explanation |
|---:|---|---|---|
| 1 | ALDANA, CARLOS JAMES | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 2 | ANDERSON, JAMES EARL | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 3 | ANDREWS, ANGELO L | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 4 | ATILES, CRYSTAL LYNN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 5 | BAKER, ERIC CHARLES | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 6 | BARNETT, SEAN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 7 | BASPED, LONNIE JOE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 8 | BENTON, DONTE JAMAR | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 9 | BETTI, FELONIZ | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 10 | BRAVO, JOHAN JARED | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 11 | BRITTON, KENNETH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 12 | BUCKNER, LATOYA MARIE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 13 | CARTER, ALVIN COLEMAN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 14 | CARTER, ZARIAH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 15 | CRUMBY, EBONY | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 16 | CUAORTIZ, DANIEL ISAI | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 17 | DELEON, ALEJANDRO BOBBY | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 18 | DELLACASA, JOSEPH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 19 | DENNIS, LATISHA MARIE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 20 | EICHELBERGER, WARREN PATRICK | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 21 | ENGLAND, JAMES THOMAS | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 22 | FAJARDO, ALLESSEANDRO | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 23 | FERRANTE, DOMINIC | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 24 | FREEMAN, JAMES EARL | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 25 | FUNARO, JAMES EDWIN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 26 | GOODINGBYRD, MORGAN HUNTER | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 27 | GOTELAERE, ROBERT TANNER | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 28 | HERNANDEZ, CESAR | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 29 | HIGGINS, NICHOLAS LEE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 30 | JOHNSON, CALAIS MARIE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 31 | JOHNSON, WILLIE JAMES | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 32 | KUBACH, KENT CHARLES | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 33 | LAPRELLE, MICHAEL ALLEN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 34 | LEE, MICHAEL | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 35 | LINGENFELTER, KATHERINE ALEXANDRIA | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 36 | LOPEZ, AURELIO | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 37 | LORENZO, RUBY | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 38 | MCALLEN, JEFFREY STEVEN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 39 | MCCORMICK, JAMES ROBERT | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 40 | MERKUSHEV, ANNA VIKTOROVNA | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 41 | METOUR, SVEN GOSTA | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 42 | MILTON, EUGENE ANDREW | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 43 | MONTIERO, ASHLEY ELIZABETH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 44 | MONTOYA, JUAN MANUEL | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 45 | MOORE, MITCHELL EDWARD | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 46 | MUCKELRATH, KENNETH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 47 | MUHAMMAD, AHMAD | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 48 | NGUYEN, CUONG HUY | **Absent** | Not in repository (surname collision only with sample fixture people). Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 49 | OLSON, AMBER NICOLE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 50 | RAHMANI, MOHAMMAD EKRAM | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 51 | REYES, SILVINO RIVAS | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 52 | ROBERTSON, ANITA | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 53 | RODRIGUEZ, RODOLFO R | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 54 | SALDANA, STUART SERGIO | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 55 | SEVIER, SANDRA PATRICE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 56 | SINGH, MANPREET | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 57 | STEVENS, LEE W | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 58 | STOLARZ, JOHN JOSEPH | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 59 | THURSTON, WILLIAM D | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 60 | TODD, VALERIE HELEN | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 61 | VAUGHN, CHRISTOPHER | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 62 | VELASQUEZ, ANGELA ROSE | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 63 | WEHNER, LANCE FREDRICK | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 64 | WILLIAMS, ARCHIE | **Absent** | Not in repository (surname collision only with sample fixture people). Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 65 | WILLIAMS, ISSAC | **Absent** | Not in repository (surname collision only with sample fixture people). Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 66 | XICIAYJUAREZ, RUDY MARCELINO | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |
| 67 | YANG, LA SHIA | **Absent** | Absent from repository. Files inspected only (not imported). PDF profile recognized 0 columns; 08/10 inspection sample shows ALFARO/ALLEN only (1 page, header date 08/09). Parser/import never produced a person row for this name. |

### Cross-checks performed

| Check | Result |
|---|---|
| Surname present in 08/10 inspection `sampleLines` | **0 / 67** |
| Surname present in 08/09 inspection `sampleLines` | **0 / 67** |
| Repository search exact person match | **0 / 67** |
| Surname-only search collisions | NGUYEN→LAN (fixture); WILLIAMS→ANDREA (fixture) — **not** ground-truth people |
| Alphabetical integrity of 08/10 file | Roster sorted by name would list **ALDANA** before **ALFARO**; inspection sample starts at ALFARO → ALDANA not on that 1-page extract |

**Finding R-09:** All 67 expected new inmates are **false negatives at the system boundary** (never entered the pipeline as person records). This is not an unexplained mid-pipeline disappearance.

### Contaminated production “new inmates” (not the 67)

Production still lists **10** sample-fixture people under new-inmates — **none** of the administrator’s 67. See earlier R-02 / R-03.


## 5. Processing stage audit

### 5.1 Required pipeline (directive)

```
PDF parsed → CSV parsed → Normalized → Identity candidates → Merged
  → Review queue → Change detection → Report generation
```

### 5.2 Counts — **real 08/09→08/10 county pair**

| Stage | 08/09 PDF | 08/10 PDF | Disposition |
|---|---:|---:|---|
| File received (Import Inspection) | yes (87 pp) | yes (1 pp) | Bytes stored for inspection |
| PDF text layer present | yes | yes | OCR not used |
| Columns recognized | **0** | **0** | Profile mismatch |
| Inmate rows extracted | **0** | **0** | Multi-line layout not mapped |
| Normalized | 0 | 0 | No rows |
| Identity candidates | 0 | 0 | No rows |
| Merged | 0 | 0 | No rows |
| Review queue | 0 | 0 | No rows |
| Change detection (these files) | 0 | 0 | Never imported |
| Report generation (these 67) | 0 | 0 | Never classified as new |
| **Disappearances** | — | — | All 67 lost at **parser/profile** (and 08/10 file may be incomplete) |

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
| Ground-truth new inmates | **67** | Administrator list |
| True positives (NIIS new ∩ 67) | **0** | Repository search + new-inmates API |
| False negatives (missed of 67) | **67** | None entered pipeline as people |
| False positives among the 67 | **0** | None of the 67 were reported |
| Incorrectly reported new (prod, not in 67) | **10** | Sample-fixture people only |
| Precision (vs 67 mission) | **n/a (0 TP)** | No correct detections |
| Recall (vs 67) | **0%** | 0 / 67 |
| Missed new inmates | **67 / 67** | See §4 table |

**Interpretation:** Recall is zero because parsing/import never produced rows — not because change detection mis-labeled extracted people.

---

## 10. Subsystem reliability scores

Scores are **evidence grades**, not production accuracy claims against the 67. Scale: **0–5** (5 = proven on real county ground truth).

| Subsystem | Score | Evidence |
|---|---:|---|
| CSV parser | **2** | Sample fixtures parse; profile verification script exists; **no real export freeze** |
| PDF parser | **1** | Real SACJAILSCAN: 45% confidence, **0 columns**, 0 rows for 67; layout mismatch confirmed |
| Normalization | **3** | Unit tests + Sacramento field rules; not scored on 67 |
| Identity resolution | **1** | Collapsed acceptance clones into 10 people with ~1.8k bookings each — high risk under repeated similar rows |
| Change detection | **2** | Pure `classifyPresence` is clear; API/report “new” diverges from returning |
| Report generation | **2** | Prints a list; includes returning people under frozen-discovery semantics |

**Overall Phase-1 mission readiness vs 67 ground truth: Fail (recall 0%).** Root cause documented; fixes not implemented per directive.

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
| RC-7 | **Sacramento PDF profile expects wrong layout** | Real roster is multi-line Name/XREF/Housing; v1 profile expects single-line BOOKING/NAME… → 0 columns |
| RC-8 | **Import Inspection ≠ Import** | Analysis path did not ingest; stuck Import Jobs never received bytes |
| RC-9 | **08/10 PDF likely incomplete / wrong date** | 1 page, header 08/09/2026, ALDANA absent while ALFARO present |

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

Ground-truth **67 names are in hand**. Remaining unblocks before any fix work:

1. **Re-provide / confirm** a complete `SACJAILSCAN08-10-2026.pdf` (multi-page Active Inmate Basic Roster dated **08/10/2026**). Current file fails basic integrity checks.  
2. If available, Sacramento **CSV** exports for both dates.  
3. Confirm OK to wipe/use a **clean validation DB** before any ingest attempt.  
4. After a correct 08/10 file exists, re-run Import Inspection; only then consider a controlled import — **still no feature/parser code changes until you approve the root-cause package**.

**No NIIS feature development** under this directive until corrections are approved.
