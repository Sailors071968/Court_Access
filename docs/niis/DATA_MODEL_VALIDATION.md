# NIIS — data model and scalability validation

Every table and every index, examined against fifteen years of growth. Figures
marked `[MEASURED]` come from `EXPLAIN (ANALYZE, BUFFERS)` against PostgreSQL 16
with real or synthetic data at the stated volume; everything else is arithmetic
from those measurements and is labelled as a projection.

**This review changed the schema.** Migration 33 adds three indexes and removes
two, each for a reason recorded below. It also identifies one growth problem
serious enough to need a decision before the system runs in production — §4.

---

## 1 · Growth model

The assumption everything is sized against. Replace with real numbers when the
facilities are known; the shape of the conclusion does not change.

| Input | Value |
|---|---|
| Facilities | 3 |
| Average population in custody, per facility | 2,000 |
| Rows per daily roster, per source | 6,000 |
| Sources per day | 2 (CSV + PDF) |
| **Roster rows ingested per day** | **12,000** |
| New bookings per day, all facilities | ~180 |
| Days in 15 years | 5,479 |

Two very different growth rates follow, and confusing them is the mistake this
section exists to prevent:

- **Repository tables** grow with *events*: ~986,000 bookings, ~2.5M charges,
  ~400,000 people over 15 years. Unremarkable.
- **Ingestion tables** grow with *roster rows*: 12,000 × 5,479 ≈ **65.7 million
  rows each**, because a full roster re-lists everyone in custody every single
  day whether anything changed or not.

Measured payload sizes, from live rows `[MEASURED]`:

| Column | Average |
|---|---|
| `InmateIngestionRecord.rawPayload` | 291 B |
| `InmateIngestionRecord.normalizedPayload` | 528 B |
| `InmateIdentityMatch` JSON columns combined | 811 B |

## 2 · Index validation

Each index with its query, selectivity, projected size and write cost. Sizes
assume ~40 B per btree entry including overhead.

### `inmates` — projected 400k rows

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `(canonicalLast, canonicalFirst, dateOfBirth)` | Candidate generation: `canonicalLast = ?` | ~1/4,000 surnames → ~100 rows | ~16 MB | **Keep.** The identity hot path, once per ingested row. `[MEASURED]` Index Scan, not seq |
| `(dateOfBirth)` | Search by date of birth alone | ~1/18,000 days → ~22 rows | ~16 MB | **Keep.** The composite cannot serve a DOB-only predicate |
| `(lastSeenAt)` | Recently-seen ordering | range | ~16 MB | **Keep.** Cheap on a 400k table |
| `(mergedIntoId)` | `mergedIntoId IS NULL` | ~99% null | ~16 MB | **Keep, with a note.** Almost every row is null, so it is unselective as a filter; it earns its place for finding *merged* rows during a reversal. A partial index `WHERE mergedIntoId IS NOT NULL` would be a tenth of the size — worth doing if this table ever surprises us |

### `inmate_bookings` — projected 986k rows

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `contentHash` UK | Idempotence check, once per ingested row | unique | ~40 MB | **Keep.** Non-negotiable: the whole re-run safety property rests on it |
| `(inmateId, bookedAt)` | Arrest timeline | ~2.5 bookings per person | ~40 MB | **Keep** |
| `(bookedAt)` | Date ranges | range | ~40 MB | **Keep.** `[MEASURED]` at 250k bookings the planner chose this for the population screen's `LIMIT 50` path — 288 buffers, 0.44 ms — because a backward date scan finds 50 unreleased rows quickly when the filter is unselective |
| `(facility, externalBookingId)` | Booking-number lookup | near-unique | ~40 MB | **Keep** |
| `(isFirstAppearance, bookedAt)` | The primary report | ~14% true | ~40 MB | **Keep.** Serves the deliverable |
| `(facility, releasedAt, departedRosterAt, bookedAt)` | Current population | ~32% of a facility's rows | ~55 MB | **Added, migration 33.** `[MEASURED]` at 250k bookings: the population **count** became an *Index Only Scan with `Heap Fetches: 0`*, 8.1 ms for 79,171 rows over 80 buffers. For a facility holding only 300 in-custody rows the same index gave 19 buffers and 0.23 ms, against a backward scan that would have read a large fraction of 250k rows |

Six indexes on the table with the highest write rate of the repository tier
(~180 inserts/day) is acceptable: the writes are trivial and the reads are the
two screens an operator uses constantly.

### `inmate_ingestion_records` — projected 65.7M rows

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `(batchId, resolution)` | Batch outcome breakdown | ~12,000 rows per batch | ~2.6 GB | **Keep** |
| `(resolvedInmateId)` | Every row that resolved to a person | ~165 rows per person | ~2.6 GB | **Keep** |
| `(bookingId)` | Report provenance lookup | near-unique | ~2.6 GB | **Added, migration 33.** `[MEASURED]` it was a **Seq Scan** before — on a table heading for 65.7M rows, once per row of every report. The single worst plan in the system |

### `inmate_identity_matches` — projected 65.7M rows

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `(outcome, tier)` | "Every automatic merge that rested on a DOB typo" | skewed: ~97% will be `duplicate`/`exact_booking` | ~2.6 GB | **Keep.** This is the question the table exists to answer, and it is asked about the *rare* tiers, where the index is highly selective |
| `(inmateId)` | Every decision about a person | ~165 rows | ~2.6 GB | **Keep** |
| `(importRecordId)` | The decision for a row | unique in practice | ~2.6 GB | **Keep** |
| `(humanReviewRequired, decidedAt)` | Review backlog | ~0.1% true | ~2.6 GB | **Keep**, and a candidate for a partial index `WHERE humanReviewRequired` — a thousandth of the size for the same answer |

### `inmate_booking_observations` — projected 65.7M rows

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `(bookingId, observedAt)` | Previous observation; reconciliation | ~66 per booking | ~2.6 GB | **Keep.** Every change detection needs it |
| `(batchId)` | Everything one run observed | ~12,000 | ~2.6 GB | **Keep** |

### `inmate_change_events` — projected 3–5M rows

Bounded by actual changes, not roster size, because an unchanged row produces no
event.

| Index | Query | Selectivity | 15-yr size | Verdict |
|---|---|---|---|---|
| `(batchId, changeType)` | What one run changed | ~60 per batch | ~200 MB | **Keep** |
| `(inmateId, detectedAt)` | A person's change history | ~10 | ~200 MB | **Keep** |
| `(changeType, rosterDate)` | "All releases in August" | ~1/11 types | ~200 MB | **Keep** |
| `(material, detectedAt)` | The default changes view | ~90% true | ~200 MB | **Added, migration 33.** `[MEASURED]` it was a **Seq Scan plus a Sort**; now an Index Scan Backward, no sort |

### Smaller tables

`inmate_booking_charges` (~2.5M), `inmate_source_conflicts` (~500k),
`inmate_review_queue` (~65k), `inmate_ingestion_batches` (~11k),
`inmate_source_documents` (~11k), `inmate_ingestion_issues` (~1M),
`inmate_notifications`, `inmate_watch_list_*`, `inmate_intelligence_reports`,
`inmate_facilities`, `inmate_aliases` (~500k), `inmate_access_logs` (~5M).
All indexes on these are single-purpose and small; none is a concern.

### Removed, migration 33

| Index | Why |
|---|---|
| `inmate_source_conflicts(field)` | Six distinct values, and **no query filters on it alone** — the conflicts view filters by `resolution`. An index at 1/6 selectivity is never chosen and costs a write on every insert |
| `inmate_watch_list_entries(active)` | A boolean on a table that will hold hundreds of rows. The planner will always prefer a scan |

### One index the system needs and does not have

`inmate_aliases(last, first, dateOfBirth)` **exists and is never queried.**
Candidate generation reads only `inmates.canonicalLast`. The index is correct; the
resolver does not use it. That is a correctness gap, not an index problem, and it
is the most important finding of this review — see `IDENTITY_RESOLUTION.md` §3.

## 3 · Table-by-table validation

The four questions the directive asks, for every table. "Could it be merged?" is
answered against the risk of a merge, not its convenience.

| Table | Why it exists / what it solves | Merge? | Bottleneck? | Archive | Queried by |
|---|---|---|---|---|---|
| `inmate_facilities` | Owns the column map and the full-population rule. Was a bare string, which meant the rule lived in code | No — it is referenced by documents | No, ~10 rows | Never | Code lookup |
| `inmate_source_documents` | The file, by its bytes, separate from the runs over it. A resumed import must know it is the same document | **No.** Merging into batch would make re-processing impossible to represent | No | Purge the blob under retention; keep the row | `sha256`, `(facilityCode, rosterDate)` |
| `inmate_ingestion_batches` | One processing run, with its counts and cursor | No | No, ~11k rows | Keep — it is the audit spine | `(facility, rosterDate)`, `(status, startedAt)` |
| `inmate_ingestion_records` | The parsed row, raw and normalized, so a decision can be re-examined without the source | No | **Yes — §4** | **Partition by month; drop payloads on old partitions** | `(batchId, resolution)`, `(bookingId)`, `(resolvedInmateId)` |
| `inmate_ingestion_issues` | Per-row problems that did not stop the batch | Could fold into records as JSON — **rejected**: an issue with no row (a bad header) would have nowhere to live | No | With the batch | `(batchId, severity)` |
| `inmates` | The person. What an arrest history hangs from | No | No, 400k | Never — permanent by requirement | Candidate generation, search |
| `inmate_aliases` | Every spelling ever seen, so a search by any of them finds the person | **No.** Folding into an array on `inmates` would lose the per-alias source batch and occurrence count, and cannot be indexed for candidate generation | No, ~500k | Never | `(last, first, dateOfBirth)` |
| `inmate_bookings` | The arrest event. Permanent | No | No, 986k | Never — permanent by requirement | Six indexes, §2 |
| `inmate_booking_charges` | Charges, as free text and parsed | **No.** A JSON array on the booking cannot be joined to the statute engine or indexed by statute | No, 2.5M | Never | `(bookingId)`, `(statuteCode, statuteSection)` |
| `inmate_booking_observations` | What one source said about one booking at one time. The unit of cross-source comparison | **No.** Merging into booking is exactly the mistake this design avoids: one source would overwrite another | **Yes — §4** | **Partition by month; retain-on-change** | `(bookingId, observedAt)`, `(batchId)` |
| `inmate_identity_matches` | The confidence analysis, queryable | Kept as JSON on the record *as well*; the row exists because a JSON column cannot answer "every automatic merge on a DOB typo" | **Yes — §4** | **Partition by month; skip trivial outcomes** | `(outcome, tier)`, `(inmateId)` |
| `inmate_review_queue` | Decisions a person must make before the repository changes | Could be `resolution='needs_review'` on the record — **rejected**: the queue carries its own lifecycle (who resolved it, when, why) that does not belong on an import row | No, ~65k | Keep resolved items | `(status, createdAt)` |
| `inmate_source_conflicts` | Two authoritative sources disagreeing | No | No, ~500k | Keep | `(resolution, detectedAt)`, `(bookingId)` |
| `inmate_change_events` | What is materially different from last time | No | No, 3–5M | Partition by year if it surprises us | Four indexes, §2 |
| `inmate_watch_list_entries` / `_matches` | Watched people, and their appearances | No | No | Keep | `(entryId, detectedAt)` |
| `inmate_notifications` | Something an administrator should see | No | No | Delete read items after 90 days | `(kind, createdAt)`, `(readAt)` |
| `inmate_intelligence_reports` | The printed document, verbatim | No | Moderate — `renderedHtml` is unbounded | Move HTML to object storage after a year | `(reportType, generatedAt)` |
| `inmate_access_logs` | Who saw whose record, who printed what | No | No, ~5M | Partition by year; retain per policy | `(userId, createdAt)`, `(inmateId)` |

## 4 · The one finding that needs a decision

**Three tables grow with roster size rather than with events, and almost every row
they will contain carries no information.**

| Table | Projected rows | Projected size |
|---|---|---|
| `inmate_ingestion_records` | 65.7M | ~72 GB (819 B of JSON per row `[MEASURED]`, plus fixed columns and three indexes) |
| `inmate_identity_matches` | 65.7M | ~72 GB (811 B of JSON per row `[MEASURED]`, plus four indexes) |
| `inmate_booking_observations` | 65.7M | ~13 GB |
| | | **~157 GB, of which ~145 GB is the first two** |

The reason is structural. A full-population roster re-lists all 2,000 people in
custody every day. For each of them the system writes:

- an import record with the raw and normalized payload — **identical to
  yesterday's**;
- an identity match whose content is always `tier=exact_booking, confidence=100,
  outcome=duplicate` — **the same nine fields every time**;
- an observation whose attributes are usually **unchanged**.

Roughly 3% of rows on a given day are new or different. The other 97% are
re-statements. So ~145 GB of the projection is the same handful of facts written
5,479 times.

**Recommended: retain-on-change.** Three rules, none of which loses evidence that
answers a question:

1. **Import records** — always write the row (the audit spine needs "row 412 of
   this file was processed"), but store `rawPayload` and `normalizedPayload` only
   when the outcome is not `duplicate`, or when the observation differed from its
   predecessor. A duplicate whose payload matches the previous one is already
   fully described by the booking it points at.
2. **Identity matches** — skip the row entirely for `exact_booking` duplicates.
   The tier, confidence and outcome are implied by the resolution recorded on the
   import record, and the interesting questions are all about the rare tiers.
3. **Observations** — always write the *latest* observation per
   (booking, source), and additionally retain any observation that differed from
   its predecessor. Departure detection needs only current presence; change
   detection needs only the previous differing value.

Projected effect: the two 72 GB tables fall to roughly **2–4 GB each**, and the
observation table to about **1 GB**. Total from ~157 GB to under 10 GB.

**This is a behaviour change, not a schema change**, so it does not block the
architecture freeze — but it should be implemented before the system ingests
daily rosters in production, because the cost is paid in storage that is
expensive to reclaim later.

**Deliberately not recommended:** dropping the raw payload for everything. The
raw row is what makes a parsing bug diagnosable a year later, and it is cheap for
the 3% of rows that carry information.

## 5 · Partitioning

Not needed at Phase 1 volumes and needed well before 15 years. Recommended, in
order of when it starts to matter:

| Table | Key | When | Why |
|---|---|---|---|
| `inmate_ingestion_records` | `RANGE (createdAt)`, monthly | Past ~10M rows | Detaching a month is how payloads get purged without a 65M-row `UPDATE` |
| `inmate_booking_observations` | `RANGE (observedAt)`, monthly | Past ~10M rows | Same |
| `inmate_identity_matches` | `RANGE (decidedAt)`, monthly | Past ~10M rows | Same |
| `inmate_access_logs` | `RANGE (createdAt)`, yearly | Past ~5M rows | Retention policy is expressed as dropping a partition |
| `inmate_bookings` | **Do not partition** | — | Under 1M rows in 15 years, and queried by every dimension. Partitioning would make the timeline and idempotence lookups worse |

All four candidates are append-only and queried by recency, which is the case
partitioning suits. Applying it to `inmate_bookings` — the table an operator hits
most — would be a mistake.

## 6 · Query performance

The queries that matter, with measured or projected cost.

| Query | Plan | Cost |
|---|---|---|
| Candidate generation (once per ingested row) | Index Scan on `(canonicalLast, …)` | `[MEASURED]` index scan; ~100 candidates for a common surname, capped at 200 |
| Idempotence check (once per ingested row) | Index Scan on `contentHash` UK | Unique probe |
| Current population count | **Index Only Scan, `Heap Fetches: 0`** | `[MEASURED]` 8.1 ms / 79,171 rows / 80 buffers at 250k bookings |
| Current population page | Index Scan Backward on `(bookedAt)` | `[MEASURED]` 0.44 ms, 288 buffers |
| Current population, selective facility | Index Scan on the new composite | `[MEASURED]` 0.23 ms, 19 buffers |
| Newly discovered inmates | Index Scan on `(isFirstAppearance, bookedAt)` | Bounded by date range |
| Arrest timeline | Index Scan on `(inmateId, bookedAt)` | ~2.5 rows |
| Material changes | Index Scan Backward on `(material, detectedAt)` | `[MEASURED]` seq scan eliminated |
| Report provenance | Index Scan on `(bookingId)` | `[MEASURED]` seq scan eliminated |

### Two N+1 patterns, recorded not fixed

Both are in read paths and both matter only at report scale.

1. **`reportGenerator.buildNewInmateReport`** issues three queries per row —
   prior bookings, the import record, the conflict count. A 500-row report is
   ~1,500 round trips. Correct, and slow. Fixable by batching the three into
   `WHERE inmateId IN (…)` lookups, which is why the row cap exists in the
   meantime.
2. **`repository.getNewInmates`** counts prior bookings per row inside a
   `Promise.all`. Same shape.

Neither is a schema problem, so neither blocks the freeze. Both are on the
roadmap.

## 7 · Storage, backup and restore

**Storage projection at 15 years**, with retain-on-change from §4 applied:

| | Without §4 | With §4 |
|---|---|---|
| Repository (bookings, charges, people, aliases) | ~1.5 GB | ~1.5 GB |
| Ingestion tier | ~157 GB | ~8 GB |
| Change events, conflicts, logs | ~6 GB | ~6 GB |
| Indexes | ~25 GB | ~5 GB |
| **Total** | **~190 GB** | **~21 GB** |

Source documents are separate: a daily CSV and PDF for three facilities is
roughly 1–5 MB/day, ~10–25 GB over 15 years, and belongs on a filesystem or in
object storage outside the database and outside the release directory.

**Backup.** `pg_dump -Fc` of the whole database, nightly, copied off the host. At
21 GB that is practical throughout; at 190 GB it is not, which is the second
reason §4 matters. The drill in `OPERATIONS_PLAYBOOK.md` §9 was executed and
restored all tables into a scratch database `[MEASURED]`.

**Restore.** Into a scratch database first, never over a live one. Two properties
make a restore safe here that are worth stating: the schema guard refuses to boot
against a database with pending migrations, and `contentHash` means re-ingesting
the rosters that arrived after the backup is idempotent — so recovery is restore,
then replay the intervening files, with no risk of duplicate bookings.

**Untested and stated as such:** no restore has been timed at production volume,
and no backup taken from the production host has been restored.
