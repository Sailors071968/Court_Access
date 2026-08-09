# New Inmate Intelligence System — engineering plan

**Plan only. No implementation.** Nothing here has been built, and no schema
change, route or migration described below exists yet.

The deliverable the system exists to produce: **a printable list of newly found
inmates, each linked to their historical arrests and supporting information,
available only from the administrative dashboard.** Every decision below is
justified against that sentence. Where a capability is interesting but does not
serve it, it is listed in §12 as out of scope rather than built.

Prerequisite: deployment certification. This plan assumes the platform is a
trusted base; §11 explains how to build on it without spending that trust.

---

## 1 · What the platform already provides

The plan reuses these rather than introducing parallel machinery.

| Need | Already present |
|---|---|
| PDF text extraction | `pdf-parse` ^2.4.5 |
| OCR for scanned rosters | `tesseract.js` ^7.0.0, with `eng.traineddata` committed |
| OCR fallback for hard scans | `@aws-sdk/client-textract` ^3.1004.0 (needs credentials) |
| Streaming large files | `stream-json`, `pg-copy-streams` |
| CLI entry points | `commander` ^13.1.0, and an established `src/*/cli.ts` pattern |
| Administrator gating | `requireAdministrator(request, reply)` — a per-module second gate on `user.role !== 'admin'`, as in `certification/certificationRoutes.ts:21` |
| Document classification precedent | `certification/documentClassifier.ts` |
| Schema conventions | Prisma, 115 models, `uuid` primary keys, `@@map` to snake_case tables |
| Migration convention | `prisma/migrations/YYYYMMDDHHMMSS_snake_case/` |

**The most consequential constraint is not in that table.** The certified
configuration runs with `DISABLE_WORKERS=true` and **no Redis**, so the five
BullMQ workers do not run. An ingestion pipeline built on BullMQ would not
execute on the production host, and enabling Redis changes the certified
configuration and re-opens certification.

So ingestion is a **CLI command invoked by a systemd timer**, not a queue. It
needs no Redis, no new runtime dependency, and no change to the deployment
architecture. §5 covers the scheduling; §11 covers why this matters.

## 2 · Domain model

Six new tables. Names are `snake_case` via `@@map`, primary keys are `uuid`,
matching the existing schema.

```
ingestion_batch ──┬─▶ ingestion_record ──▶ (resolves to) inmate
                  └─▶ ingestion_issue

inmate ──┬─▶ inmate_alias
         ├─▶ booking ──▶ booking_charge
         └─▶ watch_list_entry
```

**`inmate`** — one row per *person*, not per booking. This is the identity that
survives across rosters and the thing a historical arrest list hangs from.
`id`, `canonical_first`, `canonical_last`, `canonical_middle`, `date_of_birth`,
`sex`, `race`, `first_seen_at`, `last_seen_at`, `booking_count`,
`identity_confidence`, `identity_method`, `merged_into_id` (nullable, for
reversible merges), timestamps.

**`inmate_alias`** — every name/DOB spelling ever observed, with the batch it
came from. Rosters spell names inconsistently and this is what makes matching
auditable: `inmate_id`, `first`, `last`, `middle`, `date_of_birth`,
`source_batch_id`, `occurrence_count`.

**`booking`** — one arrest/booking event. This is the arrest timeline.
`inmate_id`, `facility`, `external_booking_id`, `booked_at`, `released_at`,
`arresting_agency`, `bail_amount`, `housing_location`, `source_batch_id`,
`source_record_id`, `content_hash`, timestamps.

**`booking_charge`** — charges on a booking, kept separate because a booking has
many and they arrive as free text: `booking_id`, `statute_code`,
`statute_section`, `description`, `severity`, `counts`, `bail_amount`,
`raw_text`. `statute_section` is the join to the existing California law engine.

**`ingestion_batch`** — one row per file processed. Without this there is no way
to answer "where did this record come from" or to undo a bad import:
`id`, `source_type` (`csv` | `pdf` | `pdf_ocr`), `source_filename`,
`source_sha256`, `facility`, `roster_date`, `started_at`, `finished_at`,
`status`, `records_total`, `records_new`, `records_matched`, `records_failed`,
`ingested_by`, `notes`.

**`ingestion_record`** — the raw parsed row before resolution, retained so a
matching decision can be re-examined without re-reading the source:
`batch_id`, `line_number`, `raw_payload` (jsonb), `normalized_payload` (jsonb),
`resolution` (`new_inmate` | `matched` | `duplicate` | `unresolved`),
`resolved_inmate_id`, `match_score`, `match_reason`.

**`ingestion_issue`** — per-record problems that do not stop the batch:
`batch_id`, `line_number`, `severity`, `code`, `message`.

**`watch_list_entry`** — `inmate_id`, `created_by`, `reason`, `active`,
`notify_on_rebooking`, timestamps.

Indexes that the queries in §7 and §8 need, and no others initially:
`inmate (canonical_last, canonical_first, date_of_birth)`,
`inmate_alias (last, first, date_of_birth)`,
`booking (inmate_id, booked_at DESC)`,
`booking (booked_at DESC)`,
`booking (content_hash)` unique,
`booking (facility, external_booking_id)` unique where both present,
plus a trigram index on names for fuzzy search (§7).

`content_hash` is the idempotence key: re-ingesting the same roster must not
create second copies of the same booking. It is a hash of the normalized booking
identity — facility, external booking id, booked-at, and normalized name/DOB —
not of the raw line, because whitespace and column order change between exports.

## 3 · Phase 1 — Ingestion, normalization, deduplication

The phase everything else depends on, and the one where being wrong is most
expensive: a bad match silently merges two people, and a missed match splits one.

**CSV ingestion.** Jail exports differ per facility and change without notice, so
the parser is driven by a per-facility **column map** (a small committed
descriptor: source header → canonical field, plus date format and name-order
rules) rather than by hardcoded indices. An unrecognised header set fails the
batch with the unmapped columns named, instead of silently importing nulls.
Streamed, so a 200 MB export does not have to fit in memory.

**PDF ingestion.** Two paths, tried in order:

1. `pdf-parse` for text-layer PDFs. Most county roster PDFs are generated and
   have one.
2. `tesseract.js` when the text layer is absent or yields implausibly little text
   for the page count. Textract is a later option and needs credentials.

Roster PDFs are tabular, and the hard part is reconstructing rows from
positioned text. The extractor produces line-oriented records and defers to the
same normalizer as CSV, so both sources converge on one representation before
any matching happens.

**A blank OCR page is indistinguishable from a genuinely blank page.** The
existing deployment checks record that jsDelivr must be reachable or every OCR
page reports empty. Ingestion therefore records per-page character counts on the
batch and raises an `ingestion_issue` when a page yields nothing, rather than
importing an empty roster as a successful one with zero new inmates — which
would look exactly like a quiet day at the jail.

**Normalization**, applied identically to both sources: case folding; punctuation
and honorific stripping; `LAST, FIRST MIDDLE` vs `FIRST MIDDLE LAST` detection;
suffix separation (`JR`, `III`); date parsing against the facility's declared
format with a plausibility window; sex/race code mapping to a documented
vocabulary; charge text split into statute and description.

**Identity resolution**, tiered, with the tier recorded on the row so a decision
is always explainable:

| Tier | Rule | Treatment |
|---|---|---|
| 1 | Same facility + same `external_booking_id` | Same booking. Idempotent re-ingest |
| 2 | Exact normalized last + first + DOB | Same person, high confidence |
| 3 | Exact DOB + last, first within edit distance ≤ 2 | Same person, recorded confidence |
| 4 | Exact last + first, DOB within a documented tolerance (transposed digits, off-by-one year) | **Queued for review**, not auto-merged |
| 5 | Anything weaker | New inmate, flagged `low_confidence` |

Tiers 1–3 resolve automatically. **Tier 4 never merges without a human**, because
DOB typos and genuinely different people with common names are the same shape of
evidence. Unreviewed tier-4 candidates appear in the dashboard as a queue, and
merges are reversible through `merged_into_id`.

**Deduplication** operates at two levels: bookings by `content_hash` (a re-ingest
is a no-op), and people by the tiers above. A batch reports
`records_new / records_matched / records_failed`, and those numbers are the first
thing the dashboard shows, because a batch that matched nothing usually means a
column map broke rather than a jail emptying.

**Deliverable:** `courtaccess-ingest` CLI — `ingest --file <path> --facility <id>
[--dry-run]`. `--dry-run` parses, normalizes and resolves without writing,
printing the counts and the first N issues. Every ingestion during Phase 1 is run
this way first.

## 4 · Phase 2 — Historical repository and arrest timeline

With identity resolved, this phase is mostly query design and one hard rule.

- **`GET /api/admin/inmates/:id`** — canonical identity, aliases, booking count,
  first and last seen, watch-list status.
- **`GET /api/admin/inmates/:id/timeline`** — bookings descending by `booked_at`,
  each with charges, facility, agency, bail, release, and the batch it came from.
- **Charge enrichment** — `booking_charge.statute_section` joins the existing
  California law engine, so a charge links to the statute text already in the
  platform rather than a new corpus.
- **Provenance is not optional.** Every booking renders with its
  `ingestion_batch` — source filename, sha256, roster date. An intelligence
  product that cannot say where a fact came from is not usable in a legal
  context, and this is the same discipline the deployment work applied to itself.

**Deliverable:** the repository and timeline are readable and correct before
anything is built on top. Correctness is checked by re-ingesting a known roster
and asserting the timeline is unchanged.

## 5 · Phase 3 — New inmate detection and printable reports

The primary output.

**Detection.** "New" needs a definition that does not drift. A booking is *newly
discovered* when its `inmate` had no prior `booking` in the repository at the
moment the batch was processed — a property of ingestion, recorded then, not
recomputed later from a moving baseline. Recomputing would change historical
reports every time older data was backfilled.

So `ingestion_record.resolution = 'new_inmate'` is the record of the decision,
and a detection run is a query over batches, not a re-derivation:

```
GET /api/admin/intelligence/new-inmates?from=&to=&facility=&minCharges=
```

Returned per inmate: canonical identity, the booking that introduced them, its
charges with statute links, prior-arrest count (zero by definition at discovery,
non-zero if they have been booked since), match confidence and tier, and the
source batch.

**Printable report.** Server-rendered HTML with a print stylesheet, not a PDF
library — it prints correctly from the browser, needs no new dependency, and the
same HTML is the on-screen view. One page per inmate or a compact table,
selectable. Every page carries the report parameters, the generating batch, and a
generation timestamp, so two printings are distinguishable.

`GET /api/admin/intelligence/new-inmates/report?...&format=html|csv`

**Report runs are recorded** — parameters, row count, who generated it, when — so
"the list I printed on Tuesday" is retrievable exactly, including if the
underlying data has since been corrected.

**Deliverable:** an administrator can pick a date range and a facility and print a
list of newly found inmates, each linked to their history. That is the sentence in
the header, satisfied.

## 6 · Phase 4 — Administrative dashboard

All of it behind `requireAdministrator`, following
`certification/certificationRoutes.ts:21`: a per-module gate on `user.role`,
independent of the route map, returning 403 with a message naming the module.

Five views, no more:

1. **Overview** — recent batches with counts, unreviewed tier-4 candidates,
   new-inmate count for the current window, watch-list hits.
2. **New inmates** — the primary list, filterable by date, facility, charge
   severity, and confidence, with the print action.
3. **Inmate detail** — identity, aliases, arrest timeline, charges with statute
   links, provenance, watch-list toggle.
4. **Search** — §7.
5. **Ingestion** — batch history, per-batch issues, upload, dry-run results, and
   the tier-4 review queue.

Frontend routes live under `/admin/intelligence/*`, consistent with the existing
`/admin/operations` pattern. **Authorization is enforced server-side only.**
Hiding a route in the SPA is not access control; the frontend merely avoids
showing what the API would refuse.

## 7 · Search

Two different needs, deliberately not merged:

- **Exact/structured** — name, DOB, booking id, facility, date range, statute.
  Indexed columns, predictable.
- **Fuzzy** — misspelled and partial names, which is the realistic case.
  PostgreSQL `pg_trgm` with a GIN index on the normalized name columns of both
  `inmate` and `inmate_alias`, so a search finds people by any spelling ever
  recorded for them.

`pg_trgm` is a PostgreSQL extension and needs `CREATE EXTENSION`, which is a
migration and a privilege on the production database — called out here because it
is exactly the kind of prerequisite that turns into a failed deployment when it is
discovered late.

No external search engine. One more service to deploy, monitor and back up is not
justified by this dataset, and it would breach the deployment freeze.

## 8 · Watch lists

`watch_list_entry` per inmate, with a reason and who added it. On ingestion, any
booking resolving to a watched inmate raises a watch-list hit, surfaced on the
overview and included in the report as a distinct section.

Notification is **in-application only** at first. Email requires SES credentials,
which the certified configuration does not have, and a watch list that silently
fails to send is worse than one that does not claim to.

## 9 · Performance

Sizing assumption, to be replaced by a real measurement before Phase 1 ships: a
county roster is thousands of rows daily, so hundreds of thousands to low millions
of bookings over years. Unremarkable for PostgreSQL, provided:

- **Ingestion streams.** No whole-file reads. `pg-copy-streams` for the staging
  insert, then resolution in batches inside a transaction per batch, so a failure
  leaves no half-imported roster.
- **Resolution does not go quadratic.** Candidate lookup is an index probe on
  `(last, DOB)`, not a scan. Batch-level dedup happens in memory first.
- **OCR is the bottleneck, and it is CPU-bound.** `tesseract.js` on a scanned
  multi-page roster is measured in minutes, on the same host that serves
  requests. This is the one place ingestion can degrade the application, which is
  why it runs from a timer at a quiet hour and not in a request handler.
- **The new-inmate query is bounded** by `booked_at` range and paginated. The
  print view is capped, with an explicit "narrow the range" response rather than
  an unbounded render.
- **Report generation is not real-time.** A large printable report is generated
  then fetched, not streamed from a live query.

Every number here is an assumption until measured. The first Phase 1 deliverable
should include timings for a real roster.

## 10 · Security

- **Administrator-only, enforced server-side**, at the module gate.
- **This is personal data about people who have not been convicted of anything.**
  Access is logged: who viewed which inmate, and who generated which report,
  through the existing security logger. A report is a disclosure event.
- **Source documents are evidence.** They go outside the release directory, on
  the `EVIDENCE_UPLOAD_DIR` pattern, because a deployment replaces the release
  directory — the failure mode already recorded in
  `DEPLOYMENT_FAILURE_MODES.md` §15.
- **Uploads are untrusted input.** Size caps, declared-type verification, and the
  existing upload protections. A malformed roster must fail its batch, not the
  process.
- **No new secrets.** If Textract is adopted later, its credentials are new
  required environment variables, which means `env.release.example`, the startup
  validator and the audit all change together — the three places that must agree.
- **Merges are reversible** and attributed. A wrong merge conflates two people's
  arrest histories, which in this domain is a serious error.

## 11 · Deployment strategy

The platform is trusted because it is certified. This section exists so building
on it does not quietly decertify it.

**What does not change:** no Redis, `DISABLE_WORKERS=true` stays. No new service.
No new port. No change to `deploy/`, the stages, PM2's definition, or nginx
routing. The freeze in `DEPLOYMENT_CERTIFICATION.md` §12 holds.

**What does change, and how it reaches production:**

1. **Schema.** New migrations, applied by the documented path —
   `prisma migrate deploy` from the release, never by the application. Each phase
   is one migration, additive, with no destructive change to an existing table.
   The boot-time schema guard will report the new count, and
   `REFERENCE_MIGRATIONS` in `_common.sh` is updated in the same commit so the
   audit's comparison stays meaningful.
2. **Application code.** New modules under `backend/src/intelligence/inmates/`,
   registered in `server.ts` like every other module. This is an ordinary release
   through the existing staged procedure. `audit-deployment.sh` must still report
   `PRODUCTION READY` afterwards, and the artifact fingerprint changes — expected,
   and the reason the reference sha is recorded rather than gated.
3. **Scheduled ingestion.** A systemd timer invoking the CLI, not cron and not
   BullMQ: it has the same ownership and logging model as the `pm2` unit the
   deployment already depends on, and it needs no Redis. The timer unit is new
   deployment infrastructure, so it is documented in the playbook and checked by
   the audit before it is relied on.

**Per-phase gate.** Each phase ships behind the administrator gate and is not
announced until: migrations applied and the schema guard reporting the new count;
`audit-deployment.sh` PRODUCTION READY; a dry-run ingestion of a real roster
reviewed by a human; and the 17-check smoke test still passing. A phase that
cannot clear those is not finished.

**Rollback.** Additive migrations mean application rollback does not require a
schema rollback. `ingestion_batch` makes a bad import undoable at the data level —
delete the batch's records and re-resolve — which is a different and more likely
need than rolling back code.

## 12 · Explicitly out of scope

Each of these is plausible and none serves the sentence in the header. Recorded so
their absence is a decision:

- Real-time roster scraping or jail-website polling.
- Facial recognition, or any biometric matching.
- Predictive scoring of individuals. The system reports what happened; it does not
  estimate what someone will do.
- Public or client-facing access of any kind.
- Cross-county identity resolution, until single-county resolution is measured.
- Automated outbound notification, until SES exists in the certified
  configuration.
- A dedicated search service.

## 13 · Sequence and dependencies

```
Phase 1  ingestion, normalization, dedup        ── nothing depends on this being
         (CLI, dry-run, column maps)               perfect except everything
                    │
Phase 2  repository + arrest timeline           ── needs resolved identity
                    │
Phase 3  new-inmate detection + printable       ── needs the timeline. THE DELIVERABLE
                    │
Phase 4  dashboard, search, detail views        ── needs 2 and 3 to be correct
                    │
Phase 5  scheduling, auditing, enhancements     ── needs the rest to be trusted
```

Phase 3 is the deliverable, and Phase 1 is where the risk is. The most valuable
early artifact is not a screen: it is the `--dry-run` output on a real roster,
reviewed by someone who knows what the data should look like. If identity
resolution is wrong, every phase after it presents wrong answers confidently —
the same failure shape as a health check that returns `ok` while nothing works.

## 14 · What must be answered before Phase 1 begins

Open questions, each blocking a decision rather than a nicety:

1. **Which facilities, and what do their exports actually look like?** Column maps
   cannot be written from a description. Sample files are needed.
2. **CSV, PDF, or both, per facility?** Determines whether OCR is on the critical
   path for the first release.
3. **How are files delivered?** Manual upload, a watched directory, or a fetch.
   Manual upload is assumed above; a fetch is a new outbound dependency.
4. **What DOB tolerance is acceptable for tier 4?** A policy question about the
   cost of a false merge versus a missed match, and it is not the engineer's to
   decide.
5. **How far back does the historical repository need to go?** Drives the
   backfill, which is the largest single ingestion.
6. **Is `pg_trgm` available, and can the migration create it** on the production
   database with the role the deployment uses?
7. **Retention.** How long are source documents and raw records kept? This is
   personal data about unconvicted people.

Questions 1, 2 and 6 block Phase 1. Question 4 blocks the resolution tiers. The
rest can be answered during Phase 1 but not later.
