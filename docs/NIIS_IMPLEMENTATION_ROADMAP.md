# New Inmate Intelligence System — implementation roadmap

Status of the Phase 1 directive, item by item. Marks are only used where the
behaviour has been executed and observed:

- **Done** — implemented and verified by running it against PostgreSQL 16 with
  the real schema, not only by unit test.
- **Partial** — the mechanism exists and works; a named limitation remains.
- **Not started** — no code.

Plan: `NEW_INMATE_INTELLIGENCE_SYSTEM_PLAN.md`.

---

## 1 · Administrative module — Done

Twelve routes under `/api/admin/intelligence/*`, every one behind
`requireAdministrator` inside the module — a second gate, independent of any
shared hook, following `certification/certificationRoutes.ts`.

| Route | Serves |
|---|---|
| `overview` | landing counts and facilities |
| `population` | current jail population |
| `new-inmates` | newly discovered — the primary list |
| `changes` | what is different since last time |
| `conflicts` | cross-source disagreements |
| `search` | historical search |
| `inmates/:id`, `inmates/:id/timeline` | person detail and arrest timeline |
| `bookings/:id` | booking detail with every observation |
| `batches`, `batches/:id/issues` | import history |
| `review-queue` | decisions awaiting a person |
| `reports/new-inmates`, `reports/:id`, `reports` | printable report, retrieval, history |
| `watchlists` (GET, POST) | watch lists |
| `notifications`, `statistics` | notifications and system statistics |
| `ingest` (POST) | manual upload trigger |

**Verified:** every route returns 200 with an administrator token, 403 with a
non-administrator token, and 401 with none.

**Not started:** the frontend pages. The directive says not to begin UI
refinement, so the API is the surface for now.

## 2 · Database foundation — Done

Two additive migrations, 116 → 135 tables, no `DROP` of any existing object.

| Directive entity | Table |
|---|---|
| Person | `inmates` (+ `inmate_aliases` for every spelling seen) |
| Booking | `inmate_bookings` |
| Charge | `inmate_booking_charges` |
| Facility | `inmate_facilities` |
| Arrest Event | `inmate_bookings` — a booking *is* the arrest event; a separate table would duplicate it with nothing to add |
| Source Document | `inmate_source_documents` |
| Source Record | `inmate_ingestion_records` (raw + normalized payload, page, row, extraction method and confidence) |
| Booking Timeline | derived from `inmate_bookings` ordered by `bookedAt`, plus `inmate_booking_observations` for within-booking history |
| Identity Match | `inmate_identity_matches` |
| Confidence Analysis | the same row — the analysis *is* the match record, and splitting them would let one exist without the other |
| Audit Event | `inmate_access_logs` |
| Import Batch | `inmate_ingestion_batches` |
| Import Record | `inmate_ingestion_records` |
| Review Queue | `inmate_review_queue` |
| Watch List | `inmate_watch_list_entries` |
| Watch List Match | `inmate_watch_list_matches` |
| Notification | `inmate_notifications` |

Two entities were deliberately not given their own tables, noted above rather
than quietly dropped: Arrest Event and Confidence Analysis. Both would have been
one-to-one with an existing row and able to go missing independently of it.

Beyond the list, three tables carry the operational objective:
`inmate_booking_observations`, `inmate_source_conflicts`,
`inmate_change_events`.

## 3 · Import pipeline — Done

One function, `runIngestion(request)`, and it does not know how it was started.
Adapters build a request and call it; none contains parsing, normalization,
resolution or persistence, and the engine may not branch on `trigger` — that is
recorded on the batch so a run's origin is known, not so behaviour can differ.

| Adapter | Status |
|---|---|
| Manual upload | **Done** — `POST /api/admin/intelligence/ingest`, `dryRun` defaults to true |
| CLI | **Done** — `src/intelligence/inmates/cli.ts` |
| Scheduled / systemd timer / cron | **Not started** — each is a unit or crontab line calling the CLI; no engine change |
| Redis queue | **Not started** — a worker calling `runIngestion`. Blocked by choice: the certified deployment runs `DISABLE_WORKERS=true` with no Redis |
| Kubernetes job | **Not started** — a job calling the CLI |

The unimplemented adapters need no change to any file under
`src/intelligence/inmates/` except a new file in an adapter directory. That is
the point of the boundary.

## 4 · Source types — Done

Both parsed, both authoritative, compared against each other.

- **CSV** — streamed line by line; RFC 4180 quoting including embedded commas,
  newlines and doubled quotes. A row whose field count disagrees with the header
  is skipped and reported rather than realigned, because importing shifted data
  is worse than importing none.
- **PDF text layer** — `pdf-parse` v2, per page.
- **Comparison** — `sourceReconciliation.ts`. Verified: ingesting a PDF for the
  same roster date as a CSV produced three conflicts, all recorded UNKNOWN.

**Partial — OCR.** `tesseract.js` ships but rasterising PDF pages needs a
renderer this release does not include. The path returns an explicit, actionable
error rather than an empty roster: a blank OCR page and a genuinely blank page are
identical in output, and a silent failure would report zero arrests as fact.
Per-page character counts are recorded so that state is always detectable.

**Partial — PDF layout.** Delimited and column-aligned text is handled. Anything
else fails the batch naming the problem instead of guessing, because a mis-split
row attaches one person's charges to another.

## 5 · Identity resolution — Done

Five tiers. Every decision carries confidence, tier, weighted reasons, conflicts,
source documents with hashes and rows, ingestion record ids, rejected candidates
with why they lost, a human-review flag and a rationale in a sentence.

**The tier decides; the score only describes.** Deriving the gate from the score
would mean tuning a weight could silently start merging records.

| Tier | Automatic? |
|---|---|
| `exact_booking` — same facility and booking number | yes — a no-op re-ingest |
| `exact_identity` — surname, given name and date of birth all exact | yes |
| `near_name` — date of birth exact, given name within edit distance 2 | yes |
| `near_dob` — names match, date of birth differs as a typing error would | **never** |
| `none` | new person |

`near_dob` never merges because a transposed birth year and two different people
with a common surname are the same shape of evidence, and no score separates
them. Two candidates both reaching an automatic tier also stop the decision.

**Verified:** `NGUYEN`/`NGUYEN BIN` with an identical date of birth auto-matched;
`WASHINGTON` with `09/07` against `07/09` went to the review queue at 73% and
wrote no person and no booking.

## 6 · Historical repository — Done

`Person → Bookings → Charges`, with the timeline ordered by booking date and every
booking retained. Nothing deletes a booking; a merge sets `mergedIntoId` and is
reversible and attributed.

## 7 · Newly discovered inmate detection — Done

| Required | Implemented as |
|---|---|
| New inmates | `new_inmate`, and `isFirstAppearance` recorded on the booking at ingestion |
| Returning inmates | `returning_inmate` — prior bookings, most recent already ended |
| Previously known | `known_inmate` — prior bookings, still in custody. Marked immaterial |
| Released inmates | `released`, from a release date appearing |
| Booking changes | `custody_status_change` |
| Charge changes | `charge_added` / `charge_removed`, via an order-independent charge-set hash |
| Housing changes | `housing_change` |
| Bail changes | `bail_change`, compared as money |
| Court changes | `court_date_change` |
| Anything materially different | every event carries `material`; immaterial ones are recorded and excluded from the default view |

Plus `departed_roster`, for a full-population roster that stopped listing someone.
Recorded as departure and **never** as release: absence says the jail stopped
listing them, not why, and release, transfer and a truncated export are
indistinguishable from outside. An incremental roster can never support the
inference at all.

**Verified:** a day-4 roster produced exactly six changes — bail 50000 → 75000,
housing B-POD-07 → D-POD-01, charges 2 → 1, a release, a custody status change and
a departure.

**Known limitation:** change detection compares observations, so it can only
report changes for bookings observed at least twice. Rows ingested before the
observation mechanism existed have nothing to compare against.

## 8 · Printable intelligence report — Done

`GET /api/admin/intelligence/reports/new-inmates` renders print-ready HTML with a
print stylesheet — no PDF dependency added to an artifact that is fingerprinted
and frozen, and the same markup is the on-screen view, so what is reviewed is what
is printed. A page break never splits a person.

Each entry carries the new inmate, booking date, facility, charges with statute
references and severity, prior booking count **and dates**, identity confidence
and tier, watch-list indicator and reason, intelligence flags, and the document,
row and hash behind it.

Flags are computed, not typed: identity confidence below 90, no date of birth on
record, OCR transcription, felony charge, no charges recorded, prior bookings, and
unresolved cross-source disagreements about the booking.

Generation persists the report verbatim with its parameters. **Verified:**
retrieving by id returned a byte-identical copy, so "the list I printed on
Tuesday" survives a later correction to the data.

## 9 · Evidence preservation — Done

| Required | Where |
|---|---|
| Source document | `inmate_source_documents`, by sha256, separate from the runs that process it |
| Source page | `inmate_ingestion_records.sourcePage`, `inmate_booking_observations.sourcePage` |
| Source row | `lineNumber`, `sourceRow` |
| Extraction method | `extractionMethod` — `csv` / `text_layer` / `ocr` |
| Confidence | `extractionConfidence` (trust in the transcription) and `confidence` (trust in the match) — kept apart, because a confident match on a badly transcribed row is still a badly transcribed row |
| Import batch | `batchId` on every row written |
| Timestamp | `observedAt`, `decidedAt`, `createdAt`, `detectedAt` |
| Operator | `ingestedById`, `receivedById`, `generatedById`, and `inmate_access_logs` |

Every booking rendered in the report or returned by the API cites its filename,
source type, row and hash.

## 10 · Administrative dashboard — Partial

Every page has its API. **No frontend exists**, by instruction.

| Page | API |
|---|---|
| Upload Center | `POST ingest` |
| Processing Status | `batches`, `batches/:id/issues` |
| Current Jail Population | `population` |
| New Inmates | `new-inmates` |
| Historical Search | `search` |
| Person Detail | `inmates/:id`, `inmates/:id/timeline` |
| Booking Detail | `bookings/:id` |
| Import History | `batches` |
| Review Queue | `review-queue` |
| Reports | `reports/*` |
| Watch Lists | `watchlists` |
| System Statistics | `statistics` |

## Performance requirements

| Required | Status |
|---|---|
| CSV imports stream | **Done** — line by line; a quoted field spanning newlines is accumulated, never the whole file |
| Identity matching incremental | **Done** — candidates by indexed surname probe, capped at 200 so a common surname cannot go quadratic |
| Duplicate work avoided | **Done** — an identical file is a no-op before parsing; a booking already held is a no-op via content hash; a conflict already recorded is not written twice |
| Everything auditable | **Done** — see §9 |
| Large PDF imports resumable | **Partial** — `resumeCursor` is written after every committed row, so the restart point is known. **Resuming from it is not implemented**: the engine always starts at the beginning |

## Verified end to end

Six rosters into PostgreSQL 16 with the full 135-table schema, including a PDF
with a real text layer generated for the purpose:

| Run | Result |
|---|---|
| day 1 CSV | 3 new |
| day 2 CSV | 1 new, 1 matched across a spelling difference, 1 duplicate, 1 to review |
| day 1 again | no-op |
| day 1 re-export, text changed | 3 duplicates, 0 new |
| day 3 CSV | 1 new, 3 duplicates, 1 departure |
| day 4 CSV | 6 change events, all correct |
| day 4 PDF, same roster date | 3 cross-source conflicts, all UNKNOWN |
| day 5 CSV | near-name auto-matched |
| day 6 CSV | transposed date of birth → review queue, nothing written |

57 unit tests pass. `tsc` error count unchanged from the branch base at 223.
Health, readiness and deep health all still 200 with the module registered.

## Defects found by executing rather than reading

Recorded because each was invisible to review:

1. **`pdf-parse` v2 has a different API.** It exports a `PDFParse` class, not a
   default function. The original code type-checked because the import was cast
   through `unknown`, and would have failed on the first PDF ingested.
2. **A derived field invented a conclusion.** Observation `custodyStatus` was
   `in_custody` whenever no release date was present — so a PDF with no release
   column contradicted a CSV that had one, over a claim the PDF never made. Now
   null: the source did not say.
3. **A compound unique key over nullable columns never fires in PostgreSQL.** Two
   NULLs are distinct, so the alias upsert would have inserted a new row on every
   roster for anyone without a middle name.

## Next, in order

1. **Resume from `resumeCursor`** — the cursor is written; the engine ignores it.
2. **Real column maps** from sample files. The two registered maps are starting
   points, and an unrecognised header set fails the batch by design.
3. **Review queue actions** — merge, reject, create-new. The queue is populated
   and readable; resolving an item is not yet implemented.
4. **Conflict resolution actions** — same: recorded and readable, not resolvable.
5. **OCR** — needs a rasteriser decision before `tesseract.js` is usable.
6. **`pg_trgm` fuzzy search** — needs the extension, which is a migration and a
   database privilege.
7. **Scheduled adapter** — a systemd timer calling the CLI, plus the one-line
   change to `build-release.sh` that ships `dist/inmate-cli.js`, deferred while
   the deployment scripts are being frozen.
8. **Frontend**, when UI work is in scope.

## Open questions still blocking

Unchanged from the plan, and none answerable from the repository:

1. Which facilities, and what do their exports actually look like? Column maps
   cannot be written from a description.
2. CSV, PDF, or both per facility? Determines whether OCR is on the critical path.
3. What date-of-birth tolerance is acceptable for `near_dob`? A policy question
   about the cost of a false merge against a missed match.
4. Is `pg_trgm` available on the production database with the deployment's role?
5. Retention: how long are source documents and raw records kept?
