# NIIS — evidence model, conflict resolution, change detection

Three specifications that together answer "how do you know that?" for every fact
in the repository. Each definition is intended to be the only one: where a term
appears in code, in a report or in a screen, it means what it means here.

---

# Part 1 · Evidence model

## 1.1 The nine questions

For every stored fact, where the answer lives.

| Question | Column | Status |
|---|---|---|
| Where did it originate? | `InmateSourceDocument.filename`, `.sha256`, `.storagePath` | **Complete** — the document is identified by its bytes |
| Who supplied it? | `InmateSourceDocument.receivedById`, `InmateIngestionBatch.ingestedById` | **Complete** for a manual upload; **null for a CLI or timer run**, which has no user. Recorded as `triggeredBy` instead |
| When was it imported? | `Batch.startedAt`, `.finishedAt`, `Observation.observedAt`, `IdentityMatch.decidedAt`, `ChangeEvent.detectedAt` | **Complete** |
| Which batch? | `batchId` on every row the pipeline writes | **Complete** |
| Which page? | `IngestionRecord.sourcePage`, `Observation.sourcePage` | **Column exists, always null.** See §1.3 |
| Which row? | `IngestionRecord.lineNumber`, `Observation.sourceRow` | **Complete** |
| Which parser? | `IngestionRecord.extractionMethod` — `csv` \| `text_layer` \| `ocr` | **Complete** |
| Which confidence? | `extractionConfidence` (the transcription) and `confidence` (the match) | **Complete, and kept apart** |
| Which extraction version? | `IdentityMatch.resolverVersion` | **Partial.** The resolver is versioned; the parsers are not. See §1.3 |

**Two confidences, deliberately separate.** `extractionConfidence` is trust in the
transcription: 100 for a CSV, 70 for OCR. `confidence` is trust in the identity
decision. A perfectly confident match on a badly transcribed row is still a badly
transcribed row, and collapsing them into one number would hide that.

## 1.2 The chain, end to end

Every fact reaches its source in at most four hops.

```
  a charge
     └─ InmateBookingCharge.bookingId
        └─ InmateBooking.sourceRecordId ──▶ InmateIngestionRecord
                                              ├─ lineNumber, sourcePage
                                              ├─ extractionMethod, extractionConfidence
                                              ├─ rawPayload      ← the row as the parser saw it
                                              ├─ normalizedPayload
                                              └─ batchId ──▶ InmateIngestionBatch
                                                              ├─ triggeredBy, ingestedById
                                                              ├─ startedAt
                                                              └─ documentId ──▶ InmateSourceDocument
                                                                                 ├─ filename
                                                                                 ├─ sha256   ← the bytes
                                                                                 └─ rosterDate

  an attribute (housing, bail, court date, release)
     └─ InmateBookingObservation      ← what one source said, at one time
        ├─ sourceType, sourcePage, sourceRow, observedAt, rosterDate
        └─ batchId, documentId

  an identity decision
     └─ InmateIdentityMatch
        ├─ reasons, conflicts, rejectedCandidates   ← why
        ├─ sourceDocuments (filename, sha256, line)
        ├─ resolverVersion
        └─ importRecordId ──▶ the raw row

  a change
     └─ InmateChangeEvent.observationId ──▶ the observation that revealed it
```

**Verified:** the printable report renders filename, source type, row, roster date
and hash for every person; `GET /bookings/:id` returns every observation with its
source and row `[MEASURED]`.

## 1.3 Two gaps, stated plainly

**Page numbers are never populated.** `sourcePage` exists on both tables and is
always null. The PDF parser flattens per-page text into one stream before
reconstructing rows, so the page a row came from is lost before the row exists.
For a 40-page roster PDF, "which page" currently cannot be answered — only "which
line of the extracted text". Fixing it means carrying a page index through
`rowsFromText`, which is a contained change to the parser and not a schema change.

**Parsers are not versioned.** `resolverVersion` pins identity decisions to the
rules that made them, but a change to the CSV or PDF parser leaves no trace on the
rows it produced. If charge parsing improves next year, there is no way to tell
which rows were parsed by which version. Recommended: an `extractorVersion` column
alongside `extractionMethod`, set from a constant in each parser.

Neither blocks the freeze. Both are recorded on the roadmap.

## 1.4 What may never be detached

Rules the pipeline enforces:

- A booking is never written without `sourceBatchId`, which is non-null in the
  schema.
- An observation is never written without `batchId` and `sourceType`.
- An identity decision is never applied without a `MatchEvidence`, written in the
  same transaction as the import record.
- A report is persisted with its parameters and rendered HTML, so a printed
  document survives later correction of the data behind it `[MEASURED]` — a
  retrieved copy was byte-identical.
- Observations are **append-only**. A booking row is the current understanding;
  the observations are what sources said. Updating one would destroy the only
  record of a disagreement.

---

# Part 2 · Conflict resolution

A conflict is **two different authoritative sources describing the same booking on
the same roster date and disagreeing**. Not: the same source changing its mind over
time (that is Part 3), and not one source omitting a field (that is silence).

## 2.1 The resolution rule

Resolution starts at **`unknown`** and stays there unless a rule genuinely applies.
Exactly one rule does:

> **OCR loses to a machine-written source.** OCR transcribes an image and can
> misread characters, so a CSV export is the better witness for the same field. The
> conflict is still recorded, with the reason.

Everything else — CSV against text-layer PDF, CSV against CSV — has no basis for a
preference and is left for a person. Preferring the CSV because it is easier to
parse would produce a repository that looks consistent and is wrong, with nothing
recorded to show it.

Resolutions: `unknown` · `source_a` · `source_b` · `resolved_manually`.

**Verified:** ingesting a PDF for the same roster date as a CSV produced three
conflicts, all `unknown`, each carrying the reason on the row `[MEASURED]`.

## 2.2 Every conflict type

| # | Type | Field | Detected by comparing | Handling |
|---|---|---|---|---|
| 1 | **Different bail amounts** | `bail` | `bailAmountCents`, formatted as money | Recorded. `unknown` unless one side is OCR. The booking row keeps its existing value; `bestKnownValue` returns UNKNOWN rather than picking |
| 2 | **Different housing** | `housing` | `housingLocation` strings | Recorded. `unknown` unless OCR. `[MEASURED]` — `C-POD-11` vs `C-POD-99` |
| 3 | **Different release dates** | `release_date` | `releasedAt`, by day | Recorded. **Never auto-resolved even against OCR**, because a release date is the difference between in custody and not, and being wrong has consequences beyond data quality |
| 4 | **Different court dates** | `court_date` | `courtDate`, by day | Recorded. `unknown` unless OCR |
| 5 | **Different charges** | `charges` | `chargeSetHash`; reported by count | Recorded with both counts. The charges themselves stay on the booking; the finding is "the two sources list different charges" `[MEASURED]` |
| 6 | **Different custody status** | `custody_status` | `custodyStatus` | Recorded. Only meaningful when both sources state it — see §2.4 |
| 7 | **Different booking dates** | — | — | **Not a conflict — a different booking.** `bookedAt` is part of `contentHash` in the fallback, so two sources disagreeing about the date produce two bookings, not one with a disputed date. See §2.3 |
| 8 | **Different date of birth** | — | — | **Not a booking conflict — an identity question.** Handled by the resolver as `dob_typo` or `dob_differs`, in `MatchEvidence.conflicts`, and routed to review if it reaches `near_dob`. Recording it as a source conflict would put an identity decision in the wrong place |
| 9 | **Different spelling** | — | — | **Not a conflict — an alias.** Both spellings are recorded in `inmate_aliases` with the batch that supplied each. A conflict implies one is wrong; a name spelled two ways is two observations of the same person |

Types 7, 8 and 9 are the ones worth arguing about, so the reasoning is explicit
rather than implied by their absence.

## 2.3 Booking-date disagreement — the honest limitation

When a facility supplies a booking number, `contentHash` uses it and the date is
irrelevant: both sources resolve to the same booking and any date disagreement
would surface as an attribute difference.

When it does not, the date is part of the key. Two sources disagreeing about the
date therefore produce **two bookings for one arrest**, and the system does not
currently detect that. It is a real duplicate-creation path, mitigated by the fact
that a facility's own booking number is the normal case, and detectable after the
fact: the same person with two bookings a day apart at the same facility is a
strong signal. **Not implemented.** Recorded here rather than left to be
discovered.

## 2.4 Silence is not disagreement

A field one source does not mention is never a conflict. Verified in both
directions `[MEASURED]`: a PDF with no housing column produced no housing
conflict, and observations from different roster dates were not compared.

This principle was arrived at by getting it wrong. Observation `custodyStatus` was
originally derived as `in_custody` whenever no release date was present — so a PDF
with no release column contradicted a CSV that had one, over a claim the PDF never
made. It now records null: **the source did not say.** That is the difference
between an observation and an inference, and it is the same discipline as
reporting UNKNOWN rather than a guess.

## 2.5 Resolution lifecycle

```
  detected ──▶ unknown ──┬──▶ resolved_manually   (a person decides; note recorded)
                         └──▶ source_a / source_b (the OCR rule, at detection)
```

A conflict is never deleted. `resolvedById`, `resolvedAt` and `resolutionNote` are
set when a person decides.

**Not implemented:** the endpoint to resolve one. Conflicts are detected, recorded
and readable at `GET /conflicts`; acting on one is on the roadmap. Unresolved
conflicts about a booking appear as an intelligence flag on the printable report,
so an operator is not asked to act on a disputed fact unknowingly `[MEASURED]`.

---

# Part 3 · Change detection

A change is a difference between what a source says now and what the previously
known state was. Ten types, each with exactly one definition.

## 3.1 Presence — the person

Computed only when a **new booking** is created. Mutually exclusive by
construction: the three depend on prior booking count and whether the most recent
prior booking had ended.

| Type | Definition | Material |
|---|---|---|
| **`new_inmate`** | The person has **zero** prior bookings in the repository | Yes |
| **`returning_inmate`** | The person has ≥1 prior booking **and** the most recent has `releasedAt` or `departedRosterAt` set | Yes |
| **`known_inmate`** | The person has ≥1 prior booking **and** the most recent is still open | **No** |

`known_inmate` is immaterial on purpose: someone in custody since yesterday is not
an event, and someone released and booked again is. Both have prior bookings, and
they are indistinguishable if only the count is consulted.

**`isFirstAppearance`** is recorded on the booking at ingestion and never
recomputed. "Newly discovered" is a property of the moment, not of current data —
recomputing it would change last week's report whenever an older roster was
backfilled.

## 3.2 Departure and release — the distinction that matters most

| Type | Definition | Material |
|---|---|---|
| **`released`** | A release date **appeared**: the previous observation had none, this one does | Yes |
| **`departed_roster`** | A **full-population** roster no longer lists a booking that was previously open | Yes |

**`departed_roster` is never reported as `released`.** Absence says the jail stopped
listing them; it does not say why. A release, a transfer to state prison and a
truncated export are indistinguishable from outside, so the event records what was
observed and the reason is UNKNOWN — stated in the event's own `newValue` text.

**An incremental roster can never produce a departure.** Absence from a partial
list says nothing `[MEASURED]`.

**Transferred inmate** — the directive asks for this. It is **not implemented as
its own type**, because no source consulted so far states a transfer. It is
currently a `departed_roster` with an unknown reason. Implementing it honestly
requires either a facility that reports transfers, or a cross-facility appearance
within a short window — the latter is a real Phase 2 opportunity, and inferring it
from absence alone would be exactly the unsupported conclusion this system avoids.

## 3.3 Attribute changes

Compared against the **most recent prior observation of the same booking**, from
any source.

| Type | Field | Comparison | Material |
|---|---|---|---|
| **`housing_change`** | `housingLocation` | String equality | Yes |
| **`bail_change`** | `bailAmountCents` | Formatted as money, so 2500000 vs 2500000 never differs by representation | Yes |
| **`court_date_change`** | `courtDate` | By day | Yes |
| **`custody_status_change`** | `custodyStatus` | String equality | Yes |
| **`charge_added`** | charges | `chargeSetHash` differs **and** count increased or equal | Yes |
| **`charge_removed`** | charges | `chargeSetHash` differs **and** count decreased | Yes |

**The rule that governs all six: a change is only reported when both sides are
known.** If the previous observation recorded a housing location and this one does
not mention housing, that is a gap in the source, not a transfer. Verified in both
directions `[MEASURED]`.

`chargeSetHash` is order-independent, so a reordered export is not a change
`[MEASURED]`.

## 3.4 Corrections — the two the directive names

**`booking correction`** and **`administrative correction`** are **not implemented
as change types**, and this is a design decision rather than an omission.

The system cannot distinguish, from a roster alone, between:

- the jail correcting a typo it previously published, and
- a genuine change in the underlying fact.

Both arrive identically: yesterday's value differed from today's. So a corrected
bail amount and a re-set bail amount both produce `bail_change`, which is the
honest report of what was observed.

Distinguishing them requires a source that says so — a correction flag, an
amendment record, or an operator marking it. When one exists, the distinction is
one field on `InmateChangeEvent` and no structural change. Until then, inventing
the distinction would attribute an intent to the jail that nothing in evidence
supports.

## 3.5 The complete set

Eleven types. Every one has exactly one definition above, and every one is
recorded with the observation that revealed it.

```
  presence     new_inmate · returning_inmate · known_inmate
  departure    released · departed_roster
  attributes   housing_change · bail_change · court_date_change ·
               custody_status_change · charge_added · charge_removed
```

**Verified end to end:** a day-4 roster produced exactly six events — bail
50000 → 75000, housing B-POD-07 → D-POD-01, charges 2 → 1, a release, a custody
status change, and a departure of a booking no longer listed `[MEASURED]`.

## 3.6 Known limitation

Change detection compares observations, so a booking observed only once has
nothing to compare against and produces no attribute changes. This is correct, and
it means the first roster after the observation mechanism was introduced reports
no changes — not because nothing changed, but because there is no earlier
observation. Verified: days 1–3 predated the mechanism and produced no attribute
events; day 4 produced all six `[MEASURED]`.
