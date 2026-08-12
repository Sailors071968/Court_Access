# NIIS — risk register

Technical risks to a permanent intelligence repository, ranked by exposure.

**Likelihood** — Certain (will happen), High (expect within a year), Medium
(plausible), Low (unlikely but possible).
**Impact** — Severe (wrong intelligence acted on, or data lost), High (significant
rework or an outage), Medium (operator time), Low (contained).

Risks marked **`[OBSERVED]`** have already occurred during development. Those are
not predictions.

---

## Ranked

| # | Risk | Likelihood | Impact | Exposure |
|---|---|---|---|---|
| 1 | Missed match splits one person into two | **Certain** | **Severe** | **Critical** |
| 2 | Ingestion tier outgrows its storage budget | **Certain** | High | **Critical** |
| 3 | Review queue accumulates with no way to act on it | **Certain** | High | **Critical** |
| 4 | False merge fuses two people's histories | Medium | **Severe** | **High** |
| 5 | Column map breaks silently on an export change | High | High | **High** |
| 6 | Booking-date disagreement creates a duplicate booking | Medium | High | **High** |
| 7 | OCR transcription errors enter the repository | High | Medium | Medium |
| 8 | Interrupted import leaves a partial roster | Medium | Medium | Medium |
| 9 | Report generation degrades at scale | High | Medium | Medium |
| 10 | Page-level provenance cannot be answered | **Certain** | Medium | Medium |
| 11 | Corrupted or truncated upload treated as a quiet day | Medium | **Severe** | Medium |
| 12 | Parser change makes old rows uninterpretable | Medium | Medium | Medium |
| 13 | Backup grows beyond a practical restore window | Medium | High | Medium |
| 14 | Personal data over-retained | Medium | High | Medium |
| 15 | Schema growth blocks a migration | Low | High | Low |
| 16 | Departure misread as release | Low | High | Low |
| 17 | Intelligence data reaches a non-administrator | Low | **Severe** | Low |

---

## 1 · Missed match splits one person into two — Critical

**Cause.** Candidate generation blocks on exact normalized surname only, and never
consults the alias table. Any surname variation — `OBRIEN` / `O BRIEN`, a
transposed letter, a missing accent — produces a new person.

**Impact.** Severe and self-concealing: the split person appears as *newly
discovered* on the primary report every time their surname is spelled the other
way, so the deliverable is wrong in the direction that costs an operator the most.

**Mitigation now.** `near_name` at edit distance 2 catches given-name variation
once the surname matches. Nothing catches surname variation.

**Mitigation required.** Include `inmate_aliases.last` in candidate generation.
Small, and the index already exists. First change after the freeze —
`IDENTITY_RESOLUTION.md` §3.

**Residual.** Surnames that differ beyond spelling (marriage, transliteration) will
still split. Phonetic blocking would help; a periodic split-detection report over
`(dateOfBirth, canonicalFirst)` would help more.

## 2 · Ingestion tier outgrows its storage budget — Critical

**Cause.** A full-population roster re-lists everyone in custody daily, and the
system writes an import record with raw and normalized payloads, an identity match,
and an observation for each — whether anything changed or not. ~97% are
re-statements.

**Impact.** Projected ~157 GB at 15 years, of which ~145 GB carries no information.
`[MEASURED]` payload sizes: 291 B raw, 528 B normalized, 811 B match evidence.
Secondary effect on backup: 190 GB is not a practical nightly `pg_dump`.

**Mitigation required.** Retain-on-change, specified in
`DATA_MODEL_VALIDATION.md` §4. Projected ~157 GB → under 10 GB. A behaviour change,
not a schema change, so it does not block the freeze — but it should land before
production ingestion, because storage is expensive to reclaim later.

**Residual.** Monthly partitioning past ~10M rows regardless.

## 3 · Review queue accumulates with no way to act on it — Critical

**Cause.** `near_dob` rows are queued, correctly, and the merge / reject /
new-person transitions are not implemented.

**Impact.** Every genuine date-of-birth typo becomes a permanent pending item. The
row writes nothing, so the repository stays correct — but the person is missing
from it, which is risk 1 by another route.

**Mitigation required.** Implement the transitions. `ARCHITECTURE.md` §13.

## 4 · False merge fuses two people's histories — High

**Cause.** Two different people with the same surname, same given name and the same
date of birth reach `exact_identity` and merge automatically.

**Impact.** Severe: one arrest history contains two people's arrests, and the
report shows prior bookings that are not theirs. In a legal context that is a
serious error.

**Mitigation now.** Three, and this is the risk the design spends the most on.
`near_dob` never auto-merges. Two candidates at an automatic tier force review.
Every merge carries `MatchEvidence` and is reversible via `mergedIntoId`,
`mergedById`, `mergeEvidence`.

**Residual.** Genuine same-name-same-DOB collisions cannot be distinguished from a
roster alone. A middle-name conflict is recorded but non-blocking — deliberately,
because rosters omit middle names inconsistently. Detection is retrospective: an
audit over `inmate_identity_matches WHERE tier = 'exact_identity'` grouped by
suspicious patterns, which the `(outcome, tier)` index exists to serve.

## 5 · Column map breaks silently on an export change — High

**Cause.** Jail exports change without notice.

**Impact.** Without protection, a renamed column imports nulls and the day looks
quiet.

**Mitigation now.** A header set missing a required field **fails the batch** and
names the unmapped columns rather than importing nulls `[MEASURED]`. A row whose
field count disagrees with the header is skipped and reported, not realigned,
because importing shifted data is worse than importing none.

**Residual.** A *renamed but still mapped* column — two columns swapping meaning
with compatible types — would pass. Mitigated operationally by `--dry-run` before
every ingestion, which is why the manual route defaults to it.

## 6 · Booking-date disagreement creates a duplicate booking — High

**Cause.** Where a facility supplies no booking number, `bookedAt` is part of
`contentHash`. Two sources disagreeing about the date produce two bookings for one
arrest.

**Impact.** A duplicated arrest, and an inflated new-inmate count.

**Mitigation now.** Only that a facility's own booking number is the normal case
and takes precedence when present.

**Mitigation required.** Detection: the same person with two bookings within a day
at the same facility. Recorded in
`EVIDENCE_CONFLICTS_AND_CHANGES.md` §2.3 rather than left to be discovered.

## 7 · OCR transcription errors enter the repository — Medium

**Cause.** OCR misreads characters: `A-l` for `A-1`, `0` for `O`.

**Mitigation now.** `extractionConfidence` 70 for OCR against 100 for CSV, kept
separate from match confidence. Where OCR disagrees with a machine-written source,
the CSV wins **and the conflict is still recorded** `[MEASURED]`. OCR transcription
raises an intelligence flag on the printable report, so an operator is told to
verify against the source.

**Residual.** An OCR error in a name feeds identity resolution directly. Since OCR
is not currently operable, this risk is latent rather than active.

## 8 · Interrupted import leaves a partial roster — Medium

**Cause.** A crash, a restart, or a failure mid-batch.

**Mitigation now.** One transaction per row, so no half-written booking. The batch
is marked `failed` with the reason. `resumeCursor` records the last committed line.
Re-running is safe: `contentHash` makes committed rows no-ops, and conflicts are
deduplicated by observation pair.

**Residual.** The engine does not read `resumeCursor`, so recovery re-processes
from the beginning — correct, but wasteful on a large file. `ARCHITECTURE.md` §14.

## 9 · Report generation degrades at scale — Medium

**Cause.** `buildNewInmateReport` issues three queries per row: prior bookings, the
import record, the conflict count. A 500-row report is ~1,500 round trips.

**Mitigation now.** `(bookingId)` index added in migration 33 — `[MEASURED]` it was
a **seq scan** on a table heading for 65.7M rows, the worst plan in the system.
Reports are bounded by date range and paginated.

**Mitigation required.** Batch the three lookups into `WHERE … IN (…)`.

## 10 · Page-level provenance cannot be answered — Medium

**Cause.** The PDF parser flattens per-page text before reconstructing rows, so the
page is lost before the row exists. `sourcePage` exists on two tables and is always
null.

**Impact.** For a 40-page roster, "which page did this come from" is unanswerable —
only "which line of the extracted text". Directly contradicts a stated evidence
requirement.

**Mitigation required.** Carry a page index through `rowsFromText`. Contained to
the parser; no schema change.

## 11 · Corrupted or truncated upload treated as a quiet day — Medium

**Cause.** A truncated export, a failed OCR run, or a roster that genuinely lists
nobody are indistinguishable by row count alone.

**Impact.** Severe if acted on: a full-population roster with missing rows marks
everyone absent as `departed_roster`, so a truncated file can appear to empty the
jail.

**Mitigation now.** Per-page character counts recorded; a page yielding no text
raises an issue, escalated to `error` under OCR. No text at all fails the batch
explicitly: *"the batch produced no records; this is not an empty roster."*
Departures are recorded as UNKNOWN-reason, never as releases.

**Mitigation required.** A plausibility gate: a full-population roster whose row
count differs from the previous one by more than a threshold should require
confirmation. Not implemented — the highest-value cheap addition on this register.

## 12 · Parser change makes old rows uninterpretable — Medium

**Cause.** `resolverVersion` pins identity decisions; parsers are unversioned.

**Impact.** After a charge-parsing improvement there is no way to tell which rows
were parsed by which version, so a systematic error cannot be scoped.

**Mitigation required.** An `extractorVersion` column set from a constant in each
parser. `EVIDENCE_CONFLICTS_AND_CHANGES.md` §1.3.

## 13 · Backup grows beyond a practical restore window — Medium

**Cause.** Risk 2.

**Mitigation now.** `pg_dump -Fc` nightly; the drill was executed and restored all
tables into a scratch database `[MEASURED]`. Recovery is restore-then-replay, and
replay is idempotent by `contentHash`.

**Residual.** No restore timed at production volume. Fixing risk 2 keeps the
database around 21 GB, where a nightly dump stays practical.

## 14 · Personal data over-retained — Medium

**Cause.** No retention policy exists. This is data about people who have not been
convicted of anything.

**Mitigation now.** Access is logged per person and per report, so disclosure is
reconstructible.

**Mitigation required.** A retention decision — an open question that cannot be
answered from the repository. Partitioning by month makes enforcement a partition
drop rather than a mass delete, which is why §5 of the validation recommends it
before it is needed.

## 15 · Schema growth blocks a migration — Low

**Cause.** `ALTER TABLE` on a 65M-row table can hold a lock.

**Mitigation now.** Both migrations so far are purely additive — no `DROP` of any
existing object — and adding a nullable column is metadata-only in PostgreSQL 11+.

**Residual.** A future index build on a large table needs `CREATE INDEX
CONCURRENTLY`, which Prisma migrations do not generate. Recorded so it is not
discovered during a maintenance window.

## 16 · Departure misread as release — Low

**Cause.** An operator or a future query treating `departed_roster` as a release.

**Mitigation now.** They are separate change types with separate definitions, and
the event's own text says the reason is UNKNOWN and that release, transfer and a
truncated export are indistinguishable. An incremental roster can never produce a
departure `[MEASURED]`.

## 17 · Intelligence data reaches a non-administrator — Low

**Cause.** A routing mistake, or a change to shared middleware.

**Mitigation now.** A second gate inside the module, independent of any shared
hook. `[MEASURED]` every route: 401 without a token, 403 with a non-administrator
token, 200 with an administrator token. Access logged. Frontend concealment is not
treated as access control.

---

## Actions, by priority

| Priority | Action | Risk |
|---|---|---|
| 1 | Include aliases in candidate generation | 1 |
| 2 | Implement retain-on-change | 2, 13 |
| 3 | Implement review queue transitions | 3 |
| 4 | Roster-size plausibility gate | 11 |
| 5 | Carry page numbers through the PDF parser | 10 |
| 6 | Batch the report's per-row lookups | 9 |
| 7 | Version the parsers | 12 |
| 8 | Duplicate-booking detection | 6 |
| 9 | Retention policy decision | 14 |
| 10 | Monthly partitioning, past ~10M rows | 2, 14, 15 |

Items 1–3 are **Critical** and none is structural: all three are behaviour inside
existing tables, which is why the architecture can be frozen while they are
outstanding.
