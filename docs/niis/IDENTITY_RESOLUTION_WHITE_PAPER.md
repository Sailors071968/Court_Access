# Identity resolution — white paper

How the New Inmate Intelligence System decides that two records describe the same
person, and why it decides that way.

The premise: **a missed match can be corrected later; an incorrect merge
contaminates a person's historical record and is much harder to unwind.** Every
rule below is derived from that asymmetry.

Versions, both stored on every decision: resolver **1.1.0**, merge policy
**1.1.0**, name keys **1.0.0**. Implementation in
`backend/src/intelligence/inmates/` — `candidateGeneration.ts`, `nameKeys.ts`,
`identityResolution.ts`, `mergePolicy.ts`.

Facts marked `[MEASURED]` were executed and observed.

---

## 1 · Three phases, and why they are three files

```
   ┌──────────────────────────┐   goal: RECALL
   │ 1. candidateGeneration   │   who could this possibly be?
   │                          │   eight blocking keys, unioned
   └────────────┬─────────────┘
                ▼
   ┌──────────────────────────┐   goal: PRECISION
   │ 2. identityResolution    │   how strong is the evidence for each?
   │    assess() → facts      │   weighted reasons, named conflicts, a tier
   └────────────┬─────────────┘
                ▼
   ┌──────────────────────────┐   goal: a DECISION
   │ 3. mergePolicy           │   merge · new_person · review
   │    decideMerge(facts)    │   rule-based, deterministic, no score
   └──────────────────────────┘
```

They are separate files because the boundary is a correctness property, not an
organisational preference:

- **Recall and precision are opposing goals.** A single function tuned for both
  will be tuned for neither. Generation is *supposed* to over-answer.
- **`PolicyInput` has no `confidence` field.** A score cannot reach the decision,
  so re-weighting a signal — routine maintenance — can never begin merging records
  that previously went to review. There is a test asserting the field's absence,
  because a future contributor adding it would silently undo the guarantee.
- **Each phase is testable alone.** The policy is tested against constructed facts
  with no database; the keys against strings; generation against a real schema.

## 2 · Phase 1 — candidate generation

### The failure this replaced

The original implementation was one query:

```sql
SELECT … FROM inmates WHERE canonicalLast = :last AND mergedIntoId IS NULL
```

The alias table — written on every booking, indexed on `(last, first, dateOfBirth)`
— was **never read**. So every surname variation was a missed match, and the alias
that would have connected two records was created only *after* the decision that
needed it. A split person appears as newly discovered every time the other spelling
arrives, which is the primary deliverable being wrong in the most expensive
direction.

### The eight blocking keys

| # | Key | Reaches | Index |
|---|---|---|---|
| 1 | `external_person_id` | The facility's own person number | `inmate_external_ids(facility, externalId)` unique |
| 2 | `canonical_surname` | Exact normalized surname | `inmates(canonicalLast, …)` |
| 3 | `alias_surname` | Any surname ever recorded for a person | `inmate_aliases(last, first, dateOfBirth)` |
| 4 | `surname_part` | Each part of a compound or hyphenated surname | both of the above |
| 5 | `phonetic_surname` | Sound-alike surnames | `inmates(phoneticLast)` |
| 6 | `phonetic_alias` | Sound-alike aliases | `inmate_aliases(phoneticLast)` |
| 7 | `collapsed_surname` | Shape-alike surnames, OCR and initial-sound folded | `inmates(collapsedLast)` |
| 8 | `collapsed_alias` | Shape-alike aliases | `inmate_aliases(collapsedLast)` |

Eight small indexed queries rather than one `OR` across eight predicates: each is a
single probe the planner cannot turn into a scan, each can be reasoned about alone,
and a slow one is identifiable.

### Why two spelling keys and not one

Neither reaches both classes of variation `[MEASURED]`:

| Pair | Soundex | Collapsed |
|---|---|---|
| SMITH / SMYTH | matches | matches |
| GONZALEZ / GONZALES | matches | matches |
| MCDONALD / MACDONALD | matches | matches |
| **CATHERINE / KATHERINE** | **no** — Soundex preserves the first letter | **matches** |
| **PHILLIPS / FILLIPS** | **no** | **matches** |
| **0BRIEN / OBRIEN** (OCR) | **no** — different initial letter | **matches** |

Soundex is used unmodified because it is a published algorithm and quietly
changing it would make the stored keys non-standard. The initial-sound folding that
Soundex cannot do lives in the collapsed key instead: `CH→K`, `PH→F`, `C→K`,
`KN→N`, `SCH→S`, and so on, applied only to the first sound.

The collapsed key also folds characters OCR confuses — `0/O`, `1/I/L`, `5/S`,
`8/B`, `M/N` — then drops vowels after the first character and collapses doubles.
It is lossy on purpose. `SMITH` collapses to `SNTH`, which also catches `SNITH`;
that breadth is correct for a blocking key and irrelevant to the decision.

### Compound and hyphenated surnames

`surnameParts` yields every searchable form, because a marriage changes which part
appears and Spanish compound surnames are recorded either way `[MEASURED]`:

| Input | Parts |
|---|---|
| `SMITH-JONES` | `SMITH`, `JONES`, `SMITHJONES` |
| `GARCIA LOPEZ` | `GARCIA`, `LOPEZ`, `GARCIALOPEZ` |
| `DE LA CRUZ` | `CRUZ`, `DELACRUZ`, `LACRUZ` — **not** `DE` or `LA` |

Particles are excluded as standalone parts. Blocking on `DE` would return a
substantial fraction of the county.

### Caps, and why they are per key

`PER_KEY_LIMIT = 100`, `TOTAL_CANDIDATE_LIMIT = 400`. The cap is applied **per
key, not to the union**, so a broad key cannot crowd out a precise one — an exact
surname match must never be lost because a phonetic key filled the budget first.

When any key hits its cap, `candidateSetTruncated` is recorded on the decision. A
truncated candidate set means a missed match is possible, and that fact travels
with the evidence rather than being lost.

### Determinism

Every query has an explicit `ORDER BY` (`inmateId` or `aliasId`), and the union is
sorted by `inmateId` before ranking. The original single query had no `ORDER BY`
under its cap, so *which* candidates were considered depended on the planner.
Identical inputs now produce identical candidate sets.

## 3 · Phase 2 — ranking

Every candidate is scored against the incoming row. Scoring produces two things: a
confidence number for a human to read, and a set of **named facts** for the policy
to act on.

### Weights

| Signal | Weight |
|---|---|
| The facility's own person identifier matched | +50 |
| Date of birth exact | +40 |
| Surname exact | +30 |
| Given name exact | +25 |
| Given name a known nickname form | +20 |
| Given name within edit distance 2 | +15 |
| Date of birth differs as a typing error would | +18 |
| Middle name exact | +5 |
| Suffix matches | +3 |
| Middle initial only | +2 |

Confidence is the sum, clamped to 0–100. **It summarises; it does not gate.**
`[MEASURED]` an exact identity match without a middle name scores 95; a
transposed-DOB match scores 70–75; a surname variant with an exact date of birth
scores 65–70.

### Conflicts carry no negative weight

They are recorded separately with a `blocking` flag, because "the score went down"
is not an explanation and "the surnames are different" is.

| Conflict | Blocking |
|---|---|
| Surname differs | yes |
| Given name differs beyond distance 2 and is not a nickname | yes |
| Date of birth differs beyond a typing error | yes |
| **Generational suffix differs** | **yes** |
| More than one strong candidate | yes |
| Date of birth not identical (typo case) | no |
| Date of birth unknown on either side | no |
| Sex differs | no |
| Middle name differs | no |

Sex and middle name are non-blocking because rosters record them inconsistently;
treating either as decisive would split people constantly.

### Nicknames

A curated table of ~50 groups — `ROBERT/BOB/BOBBY`, `MARGARET/PEGGY`,
`FRANCISCO/PACO`, `GUADALUPE/LUPE`. Used **in ranking only, never in blocking**: a
nickname is evidence that two given names refer to one person, not a reason to
widen a search by given name, which is far less selective than a surname.

Deliberately not comprehensive. A guessed entry makes matching non-uniform in a way
nobody can predict; an absent name simply scores on edit distance instead. Short
forms belonging to two full names (`PAT` → `PATRICK` and `PATRICIA`) match both
`[MEASURED]`.

### Suffixes

`JR`, `SR`, `I`–`VI`, and ordinal forms. The rule that matters:

- An **absent** suffix is compatible with any suffix. Rosters omit them
  constantly, and treating absence as a mismatch would split every junior from
  himself.
- Two **different** suffixes are **not** compatible, and this is blocking. `JR`
  and `SR` are frequently father and son with the same name at the same address —
  the false merge that matters most. A suffix conflict outranks even a matching
  person identifier, because JR and SR sharing an SO number is a data problem, not
  a merge `[MEASURED]`.

### Tiers

| Tier | Condition |
|---|---|
| `exact_booking` | The booking is already recorded |
| `external_person_id` | The facility's own person identifier matched |
| `exact_identity` | Surname, given name and date of birth all exact |
| `near_name` | Surname and date of birth exact; given name near or a nickname |
| `near_dob` | Requires a human — see below |
| `none` | Nothing reached the policy |

**A naming wart, recorded rather than hidden:** `near_dob` has become the
"a person must look at this" bucket and no longer means only that the date of birth
is near. It also holds an exact surname and date of birth with an unrelated given
name, and a surname variant with an exact date of birth. Renaming it would
invalidate the tier recorded on every existing decision, so it stays, and
`policyRule` on the decision says which rule actually fired.

## 4 · Phase 3 — the merge policy

Rules evaluated in order; the first match wins. **The ordering is the policy.**

| # | Rule | Condition | Action |
|---|---|---|---|
| 1 | `suffix_conflict` | Suffixes incompatible | **review** |
| 2 | `ambiguous_candidates` | >1 candidate at an actionable tier | **review** |
| 3 | `external_id_with_two_conflicts` | Identifier matched, but surname **and** date of birth both disagree | **review** |
| 4 | `external_person_id` | The facility's own person identifier matched | **merge** |
| 5 | `surname_variant_probable_split` | Inexact surname via a variant key, exact date of birth, given name agrees | **review** |
| 6 | `surname_variant_exact_dob` | Inexact surname via a variant key, exact date of birth | **review** |
| 7 | `surname_differs` | No surname match and no corroborated variant | **new person** |
| 8 | `exact_identity` | Surname, given name and date of birth exact | **merge** |
| 9 | `near_name_with_middle_conflict` | Exact date of birth, near given name, middle names disagree | **review** |
| 10 | `near_name` / `nickname_with_exact_dob` | Exact date of birth, near or nickname given name | **merge** |
| 11 | `exact_dob_unrelated_given_name` | Exact surname and date of birth, unrelated given name | **review** |
| 12 | `dob_typo_supporting_only` | Date of birth differs as a typo would | **review** |
| 13 | `dob_conflict_no_unique_identifier` | Date of birth differs beyond a typo | **new person** |
| 14 | `names_match_no_dob` | Names agree, no date of birth anywhere | **review** |
| 15 | `weak_name_no_dob` | Surname only, no date of birth | **new person** |

Only **four** rules merge, and three of them require an exact date of birth. The
fourth requires the jail's own identifier.

### The date-of-birth policy, as set by the operator

> Exact match: strongest evidence. Minor discrepancies: never auto-merge on
> tolerance alone; supporting evidence only if multiple other identifiers align.
> Conflicting: human review unless there is overwhelming corroborating evidence
> such as a stable booking number or other unique identifier.

Implemented literally:

- **Exact** — merges, with an exact or near given name (rules 8, 10).
- **A typing-error discrepancy** — **always** review (rule 12), *even when several
  other identifiers align*. The rationale names how many did, so a reviewer sees
  the strength: `[MEASURED]` "3 other identifiers do align (surname exact; given
  name exact; middle name or initial agrees)". No amount of name evidence is
  treated as overwhelming corroboration.
- **Conflicting** — a new person (rule 13), unless the person identifier matched
  (rule 4). `[MEASURED]` a record whose given name **and birth year both differed**
  merged on the SO number alone.

What "overwhelming corroborating evidence" means is therefore exactly one thing:
**a stable unique identifier assigned by the facility.** Name evidence never
qualifies. That is the operator's asymmetry encoded as a rule rather than a
threshold.

### False merge prevention

1. Only four rules merge; three need an exact date of birth.
2. An inexact surname is **never** merged, whatever else agrees `[MEASURED]`.
3. A suffix conflict blocks everything, including a matching identifier.
4. Ambiguity — two candidates at an actionable tier — always stops.
5. A middle-name conflict on top of an inexact given name stops.
6. Every merge is reversible and attributed: `mergedIntoId`, `mergedById`,
   `mergeEvidence`.
7. Every merge records the rule that caused it, so a systematic error is
   scopeable: `inmate_identity_matches` is indexed on `(outcome, tier)`.

### False split prevention

This is the half the original design lacked entirely, and getting it wrong is what
made the phonetic keys pointless before they were fixed.

1. Eight blocking keys instead of one.
2. Aliases searched, so any spelling ever recorded reaches the person.
3. Compound surname parts searched individually.
4. **A surname variant with corroboration goes to review, not to a new person**
   (rules 5, 6). Recording it as someone new would create the duplicate silently.
5. An exact surname and date of birth with an unrelated given name goes to review
   (rule 11) — an anglicised given name is a real phenomenon.
6. Names agreeing with no date of birth goes to review (rule 14). Common names are
   common, and a silent duplicate is as damaging as a wrong merge.
7. `candidateSetTruncated` records when recall may have been incomplete.

`[MEASURED]` — three variations the previous engine recorded as new people, all
now queued with distinct rationales and nothing written:

| Row | Against | Outcome |
|---|---|---|
| `O BRIEN, MARY` | `OBRIEN, MARY` | review — `surname_variant_probable_split` |
| `SMYTH, JOHN` | `SMITH, JOHN` | review — `surname_variant_probable_split` |
| `NGUYEN, BOBBY` | `NGUYEN, BINH` | review — `exact_dob_unrelated_given_name` |

### Human review thresholds

Review is required when a **rule** says so, never when a number is low. Eight of
the fifteen rules route to review. A `none`-tier outcome with confidence 100
creates a new person without review, because "nothing matched" is a confident
conclusion.

**A row sent to review writes no person and no booking** `[MEASURED]`. The
repository does not change on a decision a human has not made.

### Deterministic tie-breaking

`breakTie` orders by tier rank, then confidence descending, then `inmateId`
ascending. The last term is the guarantee: two candidates that are otherwise
indistinguishable are ordered stably rather than by arrival or by the planner.
Tested for order-independence and for not mutating its input.

## 5 · Every merge is explainable

A decision carries: confidence, tier, weighted reasons with detail text, conflicts
with blocking flags, source documents with hashes and rows, ingestion record ids,
rejected candidates with the keys that found them, the review flag, a rationale in
plain language, the resolver version, **the merge policy version**, **the named
policy rule**, the blocking keys that found the chosen candidate, and whether the
candidate set was truncated.

Stored twice, on purpose: as JSON on the import record, which is what a reviewer
reads, and as a row in `inmate_identity_matches`, which is what makes "every
automatic merge that rested on a date-of-birth typo" answerable — a question a JSON
column cannot answer.

## 6 · Determinism

**Deterministic**: every name key, every normalization function, `compareDob`,
`editDistance`, nickname lookup, suffix compatibility, scoring, tier assignment,
tie-breaking, and the entire policy. All pure.

**Not deterministic**, and recorded rather than claimed otherwise:

1. **Repository state.** The same row ingested before and after another roster can
   legitimately resolve differently, because the candidates differ. That is correct
   behaviour, and it is why the evidence records the decision rather than expecting
   it to be recomputable from the row alone.
2. **The two-digit year pivot** shifts by one year annually. It affects a date the
   source already recorded ambiguously, and the resolved date is stored.
3. **Truncation.** If a blocking key hits its cap the *set* is bounded but
   deterministic (explicit `ORDER BY`); which candidates were excluded depends on
   how many share the key. Flagged on the decision.

## 7 · Known limitations

| Limitation | Consequence | Status |
|---|---|---|
| Review queue transitions are not implemented | Queued rows accumulate; the person stays out of the repository | **Highest priority** |
| No transliteration matching | `NGUYEN`/`WIN`, `MOHAMMED`/`MUHAMMAD` may not share a key | Phonetic keys catch some; not measured |
| Nickname table is small | An absent name scores on edit distance only | Deliberate |
| No cross-facility person identifier | The same person at two counties needs name matching | By design — schemes are unrelated |
| Backfill required after any `nameKeys.ts` change | A stale key matches nothing, silently | `NAME_KEY_VERSION` + `backfillNameKeys.ts --check` |
| `near_dob` tier name is now inaccurate | Cosmetic; `policyRule` says what fired | Recorded, not renamed |
| Review noise from rule 11 | Same surname and birthday with different given names queues every time | Acceptable; rare in practice |

## 8 · Operating the engine

**After changing `nameKeys.ts`:**

```bash
node --env-file=.env --import tsx src/intelligence/inmates/backfillNameKeys.ts --check
node --env-file=.env --import tsx src/intelligence/inmates/backfillNameKeys.ts
```

`--check` reports how many rows hold stale keys and writes nothing. Rows with a
stale or null key are invisible to phonetic and collapsed generation, and that
failure is silent — which is why the check exists.

**Auditing recall.** `foundBy` on each decision records which keys found the
chosen candidate. Grouping decisions by key shows which keys are earning their
cost; a key that never contributes to a merge or a review is a candidate for
removal.

**Auditing precision.** `inmate_identity_matches` grouped by `(outcome, tier)` and
`policyRule` shows the distribution of decisions. A rule firing far more than
expected is the first sign of a data problem or a bad column map.
