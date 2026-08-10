# NIIS — identity resolution design

The component where a mistake is silent and permanent. A false merge fuses two
people's arrest histories; a missed match splits one person and makes them look
newly arrested every time they appear. Neither raises an error.

This document specifies the engine as implemented, states what is deterministic
and what is not, and records **one gap serious enough to fix before production
ingestion** — §3.

Implementation: `backend/src/intelligence/inmates/identityResolution.ts`,
`normalization.ts`, `deduplication.ts`. Version: `RESOLVER_VERSION = 1.0.0`,
stored on every decision so old decisions stay interpretable after the rules
change.

---

## 1 · The two rules everything else follows from

**The tier decides; the confidence score only describes.** Whether a decision
applies automatically is determined by which tier matched, never by whether a
number crossed a threshold. If the gate were `confidence >= 80`, then re-weighting
a signal — a maintenance change — could silently begin merging records that
previously went to review. The tier is a statement about *what kind of evidence
exists*; the score is a summary for a human reading it.

**`near_dob` never merges automatically.** A transposed birth year and two
different people with a common surname produce identical evidence. No score
separates them, so no score is allowed to decide.

## 2 · Pipeline

```
  raw row
     │
     ▼
  normalization          deterministic, pure, no I/O
     │                   name → upper, punctuation stripped, honorifics dropped,
     │                   suffix separated; date parsed against the facility's
     │                   declared formats only; sex mapped to a closed vocabulary
     ▼
  booking key            contentHash: facility + external booking number,
     │                   or facility + booked date + normalized person
     ▼
  tier 1: same booking?  contentHash unique lookup ──── yes ──▶ duplicate (no write)
     │ no
     ▼
  candidate generation   blocking key: exact normalized surname
     │                   capped at 200 candidates
     ▼
  per-candidate scoring  weighted signals and conflicts
     ▼
  tier assignment        exact_identity | near_name | near_dob | none
     ▼
  ambiguity check        more than one candidate at an automatic tier ──▶ review
     ▼
  outcome                matched | new_inmate | needs_review
     │
     ▼
  MatchEvidence          confidence, tier, reasons, conflicts, source documents,
                         source record ids, rejected candidates, review flag,
                         rationale, resolver version, decided-at
```

## 3 · Candidate generation, blocking keys, and the gap

### As implemented

One blocking key: **exact normalized surname.**

```
SELECT … FROM inmates WHERE canonicalLast = :last AND mergedIntoId IS NULL LIMIT 200
```

Served by `inmates(canonicalLast, canonicalFirst, dateOfBirth)`, an index scan
`[MEASURED]`. The cap prevents a pathological surname from making resolution
quadratic; 200 is generous against ~100 expected rows for a common surname in a
400,000-person repository.

### The gap

> **Candidate generation never consults `inmate_aliases`.**
>
> The alias table is written on every booking, holds every spelling ever observed
> for a person, and is indexed on `(last, first, dateOfBirth)` — and the resolver
> never reads it. So a person recorded as `OBRIEN` on Monday and `O BRIEN` on
> Tuesday produces two people, and the alias that would have connected them is
> created only *after* the decision that needed it.

Consequence: **every surname variation is a missed match**, which is the failure
mode that quietly inflates the newly-discovered-inmate report — the primary
deliverable — with people who are already known.

The fix is small and the infrastructure is already present: generate candidates
from the union of `inmates.canonicalLast = :last` and
`inmate_aliases.last = :last`, deduplicated by `inmateId`. Both are indexed. This
is recommended as the **first change after the freeze**, and it is a behaviour
change inside one function, not a structural one.

### Not implemented, and deliberately

| Technique | Status | Reasoning |
|---|---|---|
| **Phonetic blocking** (Soundex, Metaphone, Double Metaphone) | Not implemented | Would catch `SMITH`/`SMYTH` and `NGUYEN`/`WIN`. PostgreSQL `fuzzystrmatch` provides it, which is an extension and therefore a migration and a database privilege — the same prerequisite as `pg_trgm`, and unverified on the production database. Recommended for Phase 2 as an **additional** blocking key, never as a replacement: phonetic keys are broad and would widen candidate sets substantially |
| **Trigram blocking** (`pg_trgm`) | Not implemented | Same prerequisite. Better suited to interactive search than to resolution, where a bounded candidate set matters |
| **Nickname expansion** (ROBERT/BOB, WILLIAM/BILL) | Not implemented | Requires a curated table. Deliberately absent rather than half-present: a partial nickname list is worse than none, because it makes matching non-uniform in a way nobody can predict. Note that `near_name` at edit distance 2 already catches spelling variants (`JON`/`JOHN` `[MEASURED]`) but will never catch `BOB`/`ROBERT`, which is a different phenomenon |
| **First-name-only blocking** | Not implemented, and should not be | Given names are far less selective than surnames. It would multiply candidate sets for no gain |
| **Date-of-birth-only blocking** | Not implemented | Would catch a completely misspelled surname with a correct DOB. Worth considering in Phase 2 with a `(dateOfBirth)` index that already exists — but every candidate it adds arrives with no name agreement, so it can only ever produce `near_dob`, which means review. Useful for finding splits, not for automatic matching |

## 4 · Normalization — deterministic by construction

Every function in `normalization.ts` is pure. Same input, same output, no clock,
no database, no locale.

| Step | Rule | Why it is stated this way |
|---|---|---|
| Case | Upper | |
| Punctuation | `'` `’` `-` removed, not replaced with a space | `O'Brien` and `OBrien` — the same person, two clerks — normalize identically |
| Honorifics | MR, MRS, MS, MISS, DR, SIR, REV, FR, HON dropped | |
| Suffix | JR, SR, I–VI separated into their own field | A suffix on one roster and not another must not defeat a match |
| Name order | A comma is authoritative; otherwise the facility's declared `nameOrder` | Guessing from word count breaks on `DE LA CRUZ` `[MEASURED]` |
| Dates | Parsed **only** against the facility's declared formats, in order | `03/04/2020` is a different day under `mm/dd` and `dd/mm`. The facility says which; the parser never guesses `[MEASURED]` |
| Two-digit years | The century that is not in the future | `68` → 1968, `05` → 2005 `[MEASURED]` |
| Impossible dates | Rejected, not rolled forward | 31 February becomes `undefined`, not 2 March `[MEASURED]` |
| Plausibility | Year must be ≥ 1900 and ≤ next year | |
| Sex | Closed vocabulary; anything unrecognised is `unknown` | Never guessed `[MEASURED]` |
| Race | Cleaned and kept as written | Facility vocabularies differ; collapsing them would invent information |
| Money | Integer cents | No total is ever a float |

**Non-determinism check.** The only clock-dependent behaviour is the two-digit
year pivot, which shifts by one year annually. It affects a date already recorded
ambiguously by the source, and the `MatchEvidence` records the resolved date, so a
past decision remains explainable. Recorded as a known, bounded non-determinism
rather than claimed absent.

## 5 · Booking number matching — tier 1

The only tier that is certain, and checked first.

`contentHash` = SHA-256 of:

- **when the facility supplies a booking number:** `facility ‖ "ext" ‖ number`
- **otherwise:** `facility ‖ "identity" ‖ booked-date (day) ‖ last ‖ first ‖ middle ‖ dob`

Three consequences, each deliberate:

1. **The person is excluded when a booking number exists.** A roster that
   corrects a misspelled name on an existing booking must *update* it, not create
   a second one `[MEASURED]`.
2. **The date is truncated to the day in the fallback.** The same booking exported
   twice often carries different times, and treating those as separate arrests
   would inflate the new-inmate report — an error in the direction that matters
   most `[MEASURED]`.
3. **The hash is over normalized values, never the raw line.** Column order,
   whitespace and case change between exports of the same roster; hashing the line
   would make every re-export look like new arrests `[MEASURED]`.

## 6 · Scoring — every weight, and what it is for

Weights are constants in source. They summarise; they do not gate.

| Signal | Weight | Recorded as |
|---|---|---|
| Surname exact | +30 | reason `last_name_exact` |
| Given name exact | +25 | reason `first_name_exact` |
| Given name within edit distance 2 | +15 | reason `first_name_near`, with the distance |
| Date of birth exact | +40 | reason `dob_exact` |
| Date of birth differs as a typing error would | +18 | reason `dob_typo`, **and** a non-blocking conflict |
| Middle name exact | +5 | reason `middle_name_exact` |
| Middle initial only | +2 | reason `middle_initial_match` |

Conflicts carry no negative weight; they are recorded separately with a `blocking`
flag, because "the score went down" is not an explanation and "the surnames are
different" is.

| Conflict | Blocking | Effect |
|---|---|---|
| Surname differs | **Yes** | Tier `none` |
| Given name differs by more than 2 | **Yes** | Tier `none` |
| Date of birth differs beyond a typo | **Yes** | Tier `none` |
| Date of birth not identical (typo case) | No | Recorded; tier `near_dob` |
| Date of birth unknown on either side | No | Recorded |
| Sex differs | No | Recorded on an otherwise exact match `[MEASURED]` |
| Middle name differs | No | Recorded |
| More than one strong candidate | **Yes** | Forces review |

Confidence is the sum of reason weights, clamped to 0–100. Maximum 100 (30+25+40+5).
`[MEASURED]` an exact identity match scores 95 without a middle name; a `near_dob`
match with a middle name scores 68; a transposed-DOB match scores 73.

### Date-of-birth tolerance — the exact definition

`compareDob` returns `exact`, `typo`, `different`, or `unknown`. `typo` requires
one of:

1. Month and day transposed, same year — two systems disagreeing about `mm/dd`
   versus `dd/mm`.
2. Same month and day; year differs by **one substituted digit or one adjacent
   transposition**.
3. Same year; month and day differ by one substituted digit in exactly one of them.

Everything else is `different`. There is no day-count window: `±1 year` would
admit siblings and would not admit `1980`/`1908`, which is the error that actually
occurs. The rule is about *typing*, not about proximity.

## 7 · Tier assignment — one definition each

Requires exact surname throughout; a surname mismatch is always tier `none`.

| Tier | Condition | Automatic |
|---|---|---|
| `exact_booking` | The booking is already recorded (tier 1) | Yes — no write |
| `exact_identity` | DOB exact **and** given name exact | **Yes** |
| `near_name` | DOB exact **and** given name within edit distance 2 | **Yes** |
| `near_dob` | DOB is a typo **and** given name exact or within 2 | **Never** |
| `near_dob` | DOB unknown on both sides **and** given name exact | **Never** |
| `none` | Anything else | New person |

The second `near_dob` case is worth stating explicitly: **names matching with no
date of birth anywhere goes to review, not to a new person.** Common names are
common, and creating a duplicate silently is as bad as merging incorrectly — so a
human sees the collision `[MEASURED]`.

Ordering when several candidates match: by tier rank first, then by confidence
descending. Ties are impossible to resolve deterministically, which is why the
ambiguity rule exists rather than a tiebreak.

## 8 · Human review thresholds

Review is required when, and only when:

1. The best tier is `near_dob`; **or**
2. More than one candidate reached an automatic tier.

Not when confidence is low. A tier-`none` outcome with confidence 100 creates a
new person without review, because "nothing matched" is a confident conclusion.

A row sent to review **writes no person and no booking** — verified: the
transposed-DOB case created neither, and the ingestion record retained the full
evidence `[MEASURED]`. The repository does not change on a decision a human has
not made.

## 9 · What is deterministic, and what is not

**Deterministic**, given the same repository state and the same input row: every
normalization function, `compareDob`, `editDistance`, `chargeSetHash`,
`bookingContentHash`, scoring, tier assignment, the ambiguity rule, and the review
decision.

**Not deterministic**, and recorded rather than claimed otherwise:

1. **Candidate ordering under the 200-row cap.** The query has no `ORDER BY`, so
   for a surname with more than 200 people, *which* 200 are considered is at the
   planner's discretion. In a 400,000-person repository with ~4,000 surnames the
   expected count is ~100, so the cap is not expected to bind — but it is a
   latent non-determinism, and the fix is an explicit `ORDER BY inmateId` so the
   set is stable.
2. **Repository state.** The same row ingested before and after another roster can
   legitimately resolve differently, because the candidates differ. This is
   correct behaviour, and it is why `MatchEvidence` records the decision rather
   than expecting it to be reproducible from the row alone.
3. **The two-digit year pivot** — §4.

## 10 · Recommendations, in priority order

1. **Include aliases in candidate generation.** §3. The largest correctness gap;
   small, and the index exists.
2. **Add `ORDER BY inmateId` to the candidate query.** Removes the only
   non-determinism that is not inherent.
3. **Consider a partial index** `WHERE humanReviewRequired` on
   `inmate_identity_matches` — a thousandth of the size for the same answer.
4. **Phonetic blocking as an additional key**, once `fuzzystrmatch` availability
   on the production database is confirmed. Never as a replacement.
5. **Merge and reject actions** for the review queue. The queue is populated and
   readable; resolving an item is not implemented, so `near_dob` rows currently
   accumulate.
6. **A nickname table**, only if a curated source exists. Not a guess list.
