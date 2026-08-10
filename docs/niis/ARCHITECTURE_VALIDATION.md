# NIIS — architecture validation and freeze decision

The Phase 1A review, its findings, and the verdict on freezing.

Verdict is in §5. Read §3 first — it is the reason the verdict is what it is.

---

## 1 · Administrative dashboard architecture

Defined, not implemented. Every screen has a working API; no frontend exists, by
instruction. Permission on every screen: **administrator only** — there is no
read-only intelligence role.

| Screen | Purpose | Inputs | Outputs | API | Future |
|---|---|---|---|---|---|
| **Overview** | Where an administrator lands: is anything waiting for me? | none | Recent batches, review backlog, new-inmate count, facilities | `overview` | Population trend; unacknowledged watch-list hits |
| **Upload Center** | Ingest a roster, safely | File, facility, roster date, roster kind, dry-run | Counts, issues, dry-run preview per row | `ingest` (POST) | Drag-and-drop; a watched directory; roster-size plausibility warning (risk 11) |
| **Processing Status** | Did the import work, and what did it complain about? | Batch id | Status, counts, per-row issues, resume cursor | `batches`, `batches/:id/issues` | Live progress for long imports |
| **Current Jail Population** | Who is in custody now | Facility, paging | Person, booking, housing, custody status, last observed | `population` | Housing-block grouping; length-of-stay |
| **New Inmates** | **The primary operational screen** | Date range, facility, min confidence | Person, booking, charges, priors, confidence, flags, provenance | `new-inmates` | Saved filters; charge-severity filter |
| **Changes** | What is different since last time | Batch, change type, include-immaterial | Typed events with before and after | `changes` | Grouping by person; a daily digest |
| **Conflicts** | Where two sources disagree | Resolution filter | Field, both values, both sources, resolution and reasoning | `conflicts` | **Resolve action** (not implemented) |
| **Historical Search** | Find a person by any spelling ever recorded | Name, DOB, facility, paging | Person summaries with alias and watch-list indicators | `search` | Fuzzy matching via `pg_trgm`; charge search |
| **Person Detail** | Everything known about one person | Person id | Identity, aliases, confidence, watch-list state | `inmates/:id` | Merge history; **merge / unmerge actions** |
| **Arrest Timeline** | Their complete history | Person id | Bookings newest first, charges, provenance per booking | `inmates/:id/timeline` | Visual timeline |
| **Booking Detail** | One arrest, and how we know it | Booking id | Booking, charges, **every observation**, changes, conflicts, provenance | `bookings/:id` | Link a charge to the statute engine |
| **Import History** | What has been ingested | Paging | Batches with source, counts, trigger, status | `batches` | Filter by facility and date |
| **Review Queue** | **Decisions a person must make** | Status, paging | Candidate, confidence, tier, full evidence, rationale | `review-queue` | **Merge / reject / new-person actions (not implemented — risk 3)** |
| **Reports** | Generate and retrieve printable intelligence | Date range, facility, min confidence | Print-ready HTML; persisted verbatim | `reports/*` | Population and changes report types |
| **Watch Lists** | People being watched, and their appearances | Person id, reason | Entries with recent matches | `watchlists` (GET, POST) | Deactivate; acknowledge a hit |
| **Notifications** | Things worth an administrator's attention | Unread filter | Watch-list hits, review required, ingestion failures | `notifications` | Mark read; digest |
| **System Statistics** | Is the repository healthy? | none | Repository, ingestion, attention and watch-list counts | `statistics` | Growth over time; storage projection |

Navigation: Overview is the root. Upload Center, New Inmates, Population, Changes,
Conflicts, Search and Reports are peers. Person Detail is reached from New Inmates,
Population, Search or a watch-list entry; Booking Detail from a timeline or a
change; Review Queue from Overview or Processing Status.

## 2 · Validation against the original objectives

| Objective | Status | Evidence |
|---|---|---|
| Daily jail roster ingestion | **Supported** | Six rosters ingested; re-ingesting an identical file is a no-op |
| CSV ingestion | **Supported** | Streamed; RFC 4180 quoting; header validation fails a changed export by name |
| PDF ingestion | **Supported for a text layer** | A generated PDF with a real text layer parsed and ingested. **OCR is not operable** — needs a rasteriser |
| Comparison of both sources | **Supported** | A PDF ingested for the same roster date as a CSV produced three conflicts, all UNKNOWN with reasoning |
| Newly discovered inmates | **Supported** | `isFirstAppearance` recorded at ingestion, never derived; the primary list and report both query it |
| Historical inmate repository | **Supported** | Person → bookings → charges; nothing deletes a booking; a merge is reversible |
| Prior arrest timeline | **Supported** | Newest first, with charges and per-booking provenance |
| Printable intelligence report | **Supported** | Print HTML with prior booking dates, confidence, tier, watch-list indicators, flags and provenance; persisted verbatim and retrieved byte-identically |
| Administrative-only access | **Supported** | Second gate inside the module; 401 / 403 / 200 verified on every route |
| Complete evidence preservation | **Partial** | Seven of nine questions fully answered. **Page numbers are never populated; parsers are unversioned** |
| Explainable identity matching | **Supported** | Every decision carries confidence, tier, weighted reasons, conflicts, sources, rejected candidates, review flag, rationale, resolver version |
| Human review | **Partial** | Rows are queued correctly and write nothing. **The transitions to act on an item are not implemented** |

### Still missing

Nothing structural. Five functional gaps, all recorded with priority in
`RISK_REGISTER.md`:

1. Aliases are not used in candidate generation — the most consequential.
2. Review queue transitions.
3. Conflict resolution action.
4. Page-level provenance.
5. OCR.

## 3 · Findings — what this review actually changed

The review was not a description of what existed. Six findings, four of them
material, and one schema change.

### 3.1 Two sequential scans on tables heading for 65 million rows — fixed

`[MEASURED]` with `EXPLAIN`:

- `inmate_ingestion_records WHERE bookingId = ?` was a **Seq Scan**. The printable
  report runs it once per row rendered. The worst plan in the system.
- `inmate_change_events WHERE material ORDER BY detectedAt DESC` was a **Seq Scan
  plus a Sort** — the default changes view.

Both fixed in migration 33.

### 3.2 The current-population screen had no index — fixed

The most-used screen filtered on two nulls and sorted, served only by a facility
index it then had to filter and sort on top of.

Validated at realistic scale by loading **250,000 bookings** rather than reasoning
about six rows `[MEASURED]`:

| Query | Before | After |
|---|---|---|
| Population **count**, 79,171 in custody | heap access for every row | **Index Only Scan, `Heap Fetches: 0`**, 8.1 ms, 80 buffers |
| Population page, selective facility (300 rows) | backward scan over a large fraction of 250k | **19 buffers, 0.23 ms** |
| Population page, unselective facility | 288 buffers, 0.44 ms via `(bookedAt)` | unchanged — the planner correctly prefers the date index under `LIMIT` |

The last row is why both indexes are kept: they serve different shapes of the same
screen.

### 3.3 Two indexes removed

- `inmate_source_conflicts(field)` — six distinct values and **no query filters on
  it alone**; the conflicts view filters by `resolution`.
- `inmate_watch_list_entries(active)` — a boolean on a table that will hold
  hundreds of rows.

Removed on evidence, not suspicion.

### 3.4 The ingestion tier will store ~145 GB of nothing — needs a decision

`[MEASURED]` payload sizes: 291 B raw, 528 B normalized, 811 B match evidence. A
full roster re-lists everyone daily, so at 15 years three tables reach ~65.7M rows
each and ~157 GB total — of which roughly 97% of rows are re-statements of
yesterday.

Retain-on-change reduces it to under 10 GB. **A behaviour change, not a schema
change**, which is why it does not block the freeze. Specified in
`DATA_MODEL_VALIDATION.md` §4.

### 3.5 Candidate generation ignores the alias table — the most important finding

The alias table is written on every booking, indexed on `(last, first, dateOfBirth)`,
and **never read during resolution.** Candidate generation blocks on
`inmates.canonicalLast` alone.

So every surname variation is a missed match — and a missed match puts an
already-known person on the newly-discovered report, which is the deliverable. The
alias that would have connected them is created only *after* the decision that
needed it.

The fix is a union of two indexed queries inside one function. **Not structural**,
which is the only reason the architecture can be frozen with it outstanding.

### 3.6 One latent non-determinism

The candidate query has no `ORDER BY` under its 200-row cap, so for a surname with
more than 200 people *which* 200 are considered is at the planner's discretion. Not
expected to bind at the projected 400,000 people across ~4,000 surnames, but the
directive requires every scoring decision to be deterministic, so it is recorded
and the fix is one clause.

## 4 · Structural soundness

The question the freeze turns on: does anything require a **table, relationship or
key** to change?

| Area | Sound? | Reasoning |
|---|---|---|
| Identity | **Yes** | The alias fix reads an existing table via an existing index. No schema change |
| Evidence | **Yes** | Page numbers use an existing column that is never populated. Parser versioning adds one nullable column — additive |
| Conflicts | **Yes** | Both authoritative sources retained as observations; conflicts are their own rows with a lifecycle. Resolution is an update to existing columns |
| Change detection | **Yes** | Eleven types on one table with a `material` flag. Corrections need one nullable column if a source ever states them |
| Growth | **Yes** | Retain-on-change writes fewer rows into the same tables. Partitioning is a physical change to append-only tables, not a model change |
| Permissions | **Yes** | One role, one gate, verified |
| Reporting | **Yes** | Reports persist parameters and rendered output |
| Scheduling | **Yes** | Adapters are outside the engine; a queue is a new file |

**The idempotence boundary is the load-bearing structure**, and it holds: the
`contentHash` unique constraint on `inmate_bookings` is what makes every re-run,
recovery and replay safe. Nothing in this review found a path around it.

One structural weakness, recorded and accepted: **where a facility supplies no
booking number, `bookedAt` is part of `contentHash`**, so two sources disagreeing
about the date create two bookings. Changing the key would break idempotence for
every existing row, so the mitigation is detection rather than redefinition —
`EVIDENCE_CONFLICTS_AND_CHANGES.md` §2.3.

## 5 · Verdict

**Architecture frozen as Version 1.0 Foundation.**

Nineteen tables, thirty indexes after review, three migrations — all additive, with
no `DROP` of any existing object. No table needs to be added, merged or split. No
relationship needs to change. No key needs to be redefined.

Every material finding in §3 is a **behaviour change inside the existing
structure**: read one more indexed table during candidate generation, write fewer
redundant rows, populate a column that already exists, add an `ORDER BY`. That is
the test for a freeze, and it passes.

Three things this freeze does **not** claim:

1. **It is not a claim that the system is complete.** Three Critical items are
   outstanding — aliases, retain-on-change, review queue transitions. The freeze
   says the foundation can carry them, not that they are done.
2. **It is not a claim that OCR works.** It does not, and the path says so rather
   than returning an empty roster.
3. **It is not validated against real jail exports.** The two column maps are
   starting points. A changed export fails the batch by name rather than importing
   nulls, which is the protection — but the maps themselves are unproven, and the
   first real file may well require map changes. That is data, not architecture.

### What the freeze means in practice

- Build on these tables. Do not redesign them.
- A schema change now needs a written reason and a migration that is additive.
- The next work is `RISK_REGISTER.md` actions 1–3, in order.
- When the schema changes, `ERD.md` changes in the same commit.

### Open questions that block progress, not architecture

Unchanged, and none answerable from the repository:

1. Which facilities, and what do their exports actually look like?
2. CSV, PDF, or both per facility — is OCR on the critical path?
3. What date-of-birth tolerance is acceptable for `near_dob`? A policy question
   about the cost of a false merge against a missed match.
4. Are `pg_trgm` and `fuzzystrmatch` available on the production database with the
   deployment's role?
5. Retention: how long are source documents and raw records kept?

Question 3 is the one that most deserves an answer from outside engineering: it is
a judgement about which error is worse, and the current design chose the
conservative option — never merge automatically — without being told to.
