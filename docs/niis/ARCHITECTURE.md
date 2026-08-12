# NIIS — architecture

The New Inmate Intelligence System: a permanent criminal intelligence repository
built from daily jail rosters, available only inside the administrative dashboard.

This is the design reference. Companions: `ERD.md` (structure),
`DATA_MODEL_VALIDATION.md` (scale), `IDENTITY_RESOLUTION.md` (matching),
`EVIDENCE_CONFLICTS_AND_CHANGES.md` (provenance and definitions),
`RISK_REGISTER.md`, `ARCHITECTURE_VALIDATION.md` (objectives and freeze).

Facts marked `[MEASURED]` were executed and observed against PostgreSQL 16.

---

## 1 · What it is for

One sentence, and every decision below is justified against it:

> **A printable list of newly found inmates, each linked to their historical
> arrests and the evidence behind them, produced from daily jail rosters, for
> internal use only.**

Two properties follow that shape everything else. It is **permanent** — a booking
recorded once is available in fifteen years. And it is **explainable** — every
fact cites the document, page, row, parser and confidence it came from, because an
intelligence product that cannot say where a fact came from is not usable in a
legal context.

## 2 · Shape

```
     administrator (role = admin, no other role)
          │  HTTPS
          ▼
     nginx ── /api/ ──▶ Fastify (:3100)
                          │
                          ├── /api/admin/intelligence/*   17 routes, admin-gated
                          │
                          ▼
                   ┌──────────────────────────────┐
                   │  ingestion engine            │  runIngestion(request)
                   │  ── the only ingestion path  │
                   └──────────────▲───────────────┘
                                  │ adapters
        manual upload · CLI · systemd timer · cron · queue · job
                                  │
                                  ▼
                          PostgreSQL — 19 tables
                                  │
                     source documents on the filesystem,
                     outside the release directory
```

No new service, no new port, no queue, no Redis. The subsystem is modules inside
the existing Fastify application and tables inside the existing database, which is
what keeps it from affecting the certified deployment.

## 3 · Import lifecycle

Thirteen stages. **Nothing bypasses a stage**, and each is named here so a partial
run can be described precisely.

```
  1  Upload          file arrives (manual, CLI, or a watched path)
  2  Validation      facility known? column map registered? file readable?
  3  Fingerprinting  SHA-256 of the bytes → InmateSourceDocument
  4  Deduplication   same sha256 already completed? → no-op, before parsing
  5  Parse           CSV streamed, or PDF text layer per page
  6  Normalization   both sources converge on NormalizedRecord
  7  Collapse        rows repeated per charge become one booking
  8  Identity        tiered resolution → MatchEvidence
  9  Evidence        import record, identity match, observation
 10  Change          presence + attribute changes → ChangeEvent
 11  Reconciliation  cross-source comparison → SourceConflict   (batch level)
 12  Departures      full-population absence → departed_roster   (batch level)
 13  Completion      counts, watch-list matches, notifications, resume cursor
```

Stages 1–10 run per row inside a transaction. Stages 11–13 run once per batch,
because a conflict needs both sides and the other source may have arrived hours
earlier.

**Where a run can stop, and what survives:**

| Fails at | State | Recovery |
|---|---|---|
| 2 · validation | Nothing written | Fix the facility or the column map |
| 4 · duplicate | Nothing written; reported as a no-op | None needed `[MEASURED]` |
| 5 · parse | Batch marked `failed` with issues; no rows | Fix the file or the map |
| 8–10 · per row | That row's transaction rolls back; batch marked `failed`; **earlier rows are committed** | `resumeCursor` records the last committed line |
| 11–13 · batch level | Rows are committed; batch-level findings absent | Re-run: idempotent by `contentHash`, and conflicts are deduplicated |

**Dry run** performs 1–8 and reports, writing nothing. It is the default for the
manual upload route, because an import that changes the repository should be
something an administrator asked for having read the preview.

## 4 · Ingestion flow — the pluggable boundary

```
              ┌───────────────────────────────────────┐
              │  runIngestion(request) → outcome      │
              │  ── parsing, normalization,           │
              │     resolution, persistence           │
              └───────────────────▲───────────────────┘
                                  │ build a request, call it
   ┌──────────────┬───────────────┼──────────────┬──────────────┬─────────────┐
   │ manual       │ CLI           │ systemd      │ cron         │ future      │
   │ (dashboard)  │               │ timer        │              │ queue / job │
   └──────────────┴───────────────┴──────────────┴──────────────┴─────────────┘
```

Three rules keep the boundary real:

1. An adapter parses its own arguments, builds an `IngestionRequest`, calls
   `runIngestion`. Nothing else.
2. No adapter contains parsing, normalization, resolution or persistence.
3. **The engine may not branch on `trigger`.** It is recorded on the batch so the
   origin of a run is known, not so behaviour can differ by caller.

Why it matters here specifically: the certified deployment runs
`DISABLE_WORKERS=true` with **no Redis**, so a BullMQ-based pipeline would not
execute on the production host at all, and enabling Redis re-opens deployment
certification. Keeping scheduling outside the engine means that decision can be
deferred and reversed without touching intelligence code.

Implemented: manual upload, CLI. Not implemented: timer, cron, queue, job — each a
new file in an adapter directory, no engine change.

## 5 · Normalization flow

Both parsers converge on one representation before anything is matched, so a CSV
row and a PDF row are compared on the same footing.

```
  CSV ──▶ column map ──┐
                       ├──▶ RawRecord ──▶ normalizeRecord ──▶ NormalizedRecord
  PDF ──▶ text layer ──┘                        │
          (per page)                            └─ issues (warning | error)
```

Pure functions throughout: no clock, no database, no locale. The rule is **never
invent information** — a field that cannot be read confidently becomes `undefined`
and the caller raises an issue, because guessing at a date of birth is worse than
not having one. Full rules in `IDENTITY_RESOLUTION.md` §4.

A row is rejected only when it lacks something a booking cannot exist without: a
surname and a booking date. Everything else degrades to a warning, because a
roster row missing a middle name is still a real arrest.

## 6 · Identity resolution

Five tiers, exact-surname blocking, and one rule that governs the design: **the
tier decides, the confidence score only describes.** `near_dob` never merges
automatically, because a transposed birth year and two different people with a
common surname are the same evidence.

Specified in full in `IDENTITY_RESOLUTION.md`, including the one significant gap:
candidate generation does not yet consult the alias table.

## 7 · Evidence preservation

Nine questions, answered by columns, in `EVIDENCE_CONFLICTS_AND_CHANGES.md` Part 1.
Two confidences are kept separate — trust in the transcription and trust in the
match — because a confident match on a badly transcribed row is still a badly
transcribed row.

Two known gaps, both recorded: page numbers are never populated, and parsers are
not versioned.

## 8 · Change detection

Eleven types with one definition each, in `EVIDENCE_CONFLICTS_AND_CHANGES.md`
Part 3. The two distinctions that carry the most weight:

- **`returning_inmate` versus `known_inmate`** — released and re-booked is an
  event; in custody since yesterday is not.
- **`departed_roster` versus `released`** — absence says the jail stopped listing
  them, not why.

## 9 · Report generation

```
  GET /reports/new-inmates?from=&to=&facility=&minConfidence=
        │
        ├─ query bookings WHERE isFirstAppearance    ← recorded, never derived
        ├─ per row: priors, import record, conflict count
        ├─ compute intelligence flags
        ├─ persist InmateIntelligenceReport (parameters + rendered HTML)
        └─ render print HTML
```

Server-rendered HTML with a print stylesheet, not a PDF library: it prints from a
browser, adds no dependency to an artifact that is fingerprinted and frozen, and
the same markup is the on-screen view — so what is reviewed is what is printed. A
page break never splits a person.

**Every report is persisted verbatim.** "The list I printed on Tuesday" is asked
after the data behind it has been corrected, and re-running the query would answer
a different question. `[MEASURED]` a retrieved copy was byte-identical.

Flags are computed, never typed: identity confidence below 90, no date of birth on
record, OCR transcription, felony charge, no charges recorded, prior bookings, and
unresolved cross-source disagreements about the booking.

## 10 · Administrative routing

Seventeen routes under `/api/admin/intelligence/`. Read paths log access; write
paths log the action.

| Route | Method | Purpose |
|---|---|---|
| `overview` | GET | Landing counts, recent batches, facilities |
| `population` | GET | Current jail population |
| `new-inmates` | GET | Newly discovered — the primary list |
| `changes` | GET | What is different since last time |
| `conflicts` | GET | Cross-source disagreements |
| `search` | GET | Historical search by name, DOB, facility |
| `inmates/:id` | GET | Person detail with aliases |
| `inmates/:id/timeline` | GET | Arrest timeline with provenance |
| `bookings/:id` | GET | Booking detail with every observation |
| `batches` | GET | Import history |
| `batches/:id/issues` | GET | Per-row problems |
| `review-queue` | GET | Decisions awaiting a person |
| `ingest` | POST | Manual upload; `dryRun` defaults to true |
| `reports/new-inmates` | GET | Generate, persist, render |
| `reports/:id` | GET | A previous report, exactly as printed |
| `reports` | GET | Report history |
| `watchlists` | GET, POST | Watched people |
| `notifications` | GET | Alerts |
| `statistics` | GET | System statistics |

## 11 · Security and permissions

**One permission: administrator.** There is no read-only intelligence role, no
attorney access, no client access. The subsystem holds personal data about people
who have not been convicted of anything.

```
  request ──▶ authentication (JWT, platform-wide)
                  │
                  ▼
          requireAdministrator()   ← inside the module, on every route
                  │
             role === 'admin' ?
              no ──▶ 403, naming the module
             yes ──▶ handler ──▶ recordAccess(...)
```

**A second gate, inside the module.** The pattern follows
`certification/certificationRoutes.ts`: independent of any shared hook, so a change
to platform middleware cannot expose this data. `[MEASURED]` every route returns
401 without a token, 403 with a non-administrator token, 200 with an administrator
token.

Hiding routes in the SPA is not access control and is not treated as any part of
it.

Other boundaries:

- **Source documents live outside the release directory**, on the
  `EVIDENCE_UPLOAD_DIR` pattern, because a deployment replaces that directory —
  the one recorded deployment failure mode that destroys data.
- **Uploads are untrusted input.** A malformed roster fails its batch, not the
  process.
- **No new secrets.** If Textract is ever adopted, its credentials become new
  required environment variables, which means `env.release.example`, the startup
  validator and the deployment audit all change together.
- **Merges are reversible and attributed** — `mergedIntoId`, `mergedById`,
  `mergeEvidence`.

## 12 · Audit logging

`InmateAccessLog` records who did what: `view_inmate`, `view_timeline`, `search`,
`list_new_inmates`, `generate_report`, `view_review_queue`, `merge`, `unmerge`,
`ingest`, `watch_list_add`, `watch_list_remove` — with the parameters, the result
count and the IP.

Two design points:

- **A report is a disclosure event.** Its parameters and row count are logged, so
  what was disclosed can be reconstructed.
- **Logging never fails a request.** A failure to record an access is worth a
  warning in the process log; it is not worth denying an administrator a record
  they are entitled to see, and it must not turn a read into a 500.

Separately, `InmateIdentityMatch` is the audit trail for decisions rather than for
access — a queryable row per identity decision, not only JSON.

## 13 · Review queue lifecycle

```
  ingestion: outcome = needs_review
        │
        ├── InmateIdentityMatch          (the evidence, always written)
        ├── InmateReviewQueueItem        (status = pending)
        └── NO person, NO booking written      ← the repository does not change
                │
                ▼
        administrator reviews the evidence
                │
   ┌────────────┼────────────┬─────────────┐
   ▼            ▼            ▼             ▼
 merged     new_person    rejected     dismissed
 (attach    (create a     (not this    (not a real
  to the     separate      person)      person)
  candidate) person)
```

`[MEASURED]` a transposed date of birth produced a queue item at 73% confidence and
wrote no person and no booking.

**Not implemented:** the transitions. The queue is populated and readable; acting
on an item is not built, so `near_dob` rows accumulate. This is the highest-priority
functional gap after the alias fix.

## 14 · What this architecture does not do

Each a deliberate boundary, so its absence is not mistaken for an oversight.

- **No OCR in practice.** `tesseract.js` ships; rasterising PDF pages needs a
  renderer this release does not include. The path returns an actionable error
  rather than an empty roster, because a blank OCR page and a blank page are
  identical in output and a silent failure would report zero arrests as fact.
- **No resumption.** `resumeCursor` is written after every committed row; the
  engine does not read it.
- **No fuzzy search.** Needs `pg_trgm` — an extension, therefore a migration and a
  database privilege, unverified on the production database.
- **No outbound notification.** In-application only: the certified configuration
  has no mail credentials, and a watch list that silently fails to send is worse
  than one that does not claim to.
- **No queue.** By deployment constraint, and by design — §4.
- **No frontend.** By instruction.
- **No predictive scoring of individuals.** The system reports what happened. It
  does not estimate what someone will do.
