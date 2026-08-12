# The Intelligence Platform

Phase 1C. What NIIS became when identity resolution stopped being the centre of it.

## The chain

```
Source Document → Source Record → Observation → Evidence → Intelligence
                                                               ↓
                                              Person / Booking / Charge
                                                               ↓
                                                            Reports
```

One direction, no shortcuts. Observations state what a source said and never
conclude. Engines conclude and never invent observations. Reports read intelligence
and never create facts.

The chain was already implicit in the code before this phase. What changed is that
it is now enforced by structure: an engine cannot write to the repository, because
`analyse()` returns findings and has no access to persistence; a finding cannot omit
its evidence, because `evidenceObservationIds` is required; and a conclusion cannot
be applied without a record saying which rule authorised it, because the disposition
field distinguishes `auto_applied` from `proposed`.

## The four tables

Migration 35 is additive: 140 tables, zero destructive statements.

| Table | What it holds |
| --- | --- |
| `inmate_intelligence_items` | One conclusion by one engine from named evidence |
| `inmate_intelligence_events` | How each conclusion's disposition got where it is |
| `inmate_intelligence_runs` | One replay of evidence through one engine version |
| `inmate_parser_profiles` | How one source's documents were read, versioned |

Four tables for a platform meant to host engines nobody has designed yet. The
constraint that produced this shape was requirement 12: a future engine must need
almost no schema change. So `type` is an open string rather than an enum, the subject
is polymorphic (`subjectKind` plus `subjectId`, with a second optional pair for
findings that relate two things), and `payload` is free JSON.

### Why an intelligence item is not the finding itself

Conflicts, changes and identity matches already had typed tables, and duplicating
them into a generic store would mean two rows that could disagree. Instead an item
points at its typed detail through `detailTable` and `detailId`.

That leaves a real question: what is the item *for*, if the detail lives elsewhere?

The item is the governance record. The typed tables answer "what happened". The item
answers a different set of questions the typed tables cannot: which engine version
concluded this, from which observations, under which rule, at what confidence, with
what disposition, reviewed by whom, superseded by what. Those are properties of the
conclusion rather than of the fact, and they change on a different schedule — a
conflict's two values never change, but its disposition may change three times.

An engine with no typed table carries its finding in `payload`. `repeat_offender`
does exactly this, and its existence is the proof that the extensibility claim is
real rather than aspirational: it concludes something the schema knows nothing about,
with no columns and no migration.

## The five engines

| Engine | Version | Concludes | Reads |
| --- | --- | --- | --- |
| `identity` | 1.1.0 | `identity_candidate` | Observations |
| `conflict` | 1.0.0 | `source_conflict` | Observations of one booking |
| `change_detection` | 1.0.0 | `change` | Consecutive observations |
| `watch_list` | 2.0.0 | `watch_list_hit` | **Intelligence** |
| `repeat_offender` | 1.0.0 | `repeat_offender` | Bookings |

Publication runs them in dependency order: identity, conflicts, changes, watch
lists, patterns. Watch lists run fourth because their input is what the first three
produced.

Adding a sixth is a file that implements `IntelligenceEngine` and one
`registerEngine` call. The engines named in the directive as future work — gang
intelligence, facility movement, booking patterns, release prediction, bail
intelligence, court intelligence — need no schema change to exist. What they need is
a definition of what each concludes and what evidence supports it, which is analysis
rather than plumbing.

## Conflicts the platform can now hold

The example from the directive, working:

```
Observation: PDF reports Bail = $50,000   (page 3)
Observation: CSV reports Bail = $75,000   (row 12)
Intelligence: Bail conflict
Current Truth: UNKNOWN
Human Review Required
```

Both stated values survive side by side in the payload. Neither is overwritten,
because the losing value is evidence rather than an error. The finding's confidence
is 100 — the disagreement is certain, even though its resolution is not. Confidence
describes the conclusion, not the operator's certainty about which source is right,
and conflating those two would make every unresolved conflict look like weak
intelligence.

Severity and confidence are separate axes throughout. A clean automatic identity
match at 100% confidence is `info`, because it needs no attention. An unresolved bail
conflict is `significant` at the same confidence, because money and liberty outrank
housing.

## Identity resolution as a consumer

Its input is an observation set. Its output is one of four recommendations — `merge`,
`review`, `new_person`, `no_action` — never a merge instruction.

There is one structural limitation, and it is recorded rather than papered over.

During live ingestion a booking must attach to a person row. Identity therefore
cannot be deferred to a reviewer without leaving the booking parentless, so
resolution still happens inline during import and the finding says `auto_applied`.

What the platform guarantees is not that no merge precedes review. It is that:

- no merge happens without a finding naming the rule that authorised it and the
  observations it rested on;
- that finding is reviewable, rejectable and reversible afterwards;
- a replay has no such constraint — the bookings already have parents, so
  reprocessing produces recommendations and applies nothing.

Stating this plainly matters more than the architecture diagram. A reader who assumes
"identity resolution never merges" would be wrong about how imports behave, and would
be surprised by the first `auto_applied` identity finding they saw.

One further honesty point in the replay path: re-deriving a person from evidence is
the only meaningful way to replay identity. Reading the stored person would make the
engine agree with itself by construction, which is the failure this whole layer
exists to prevent. Where the evidence no longer survives — a booking with no
normalized import record — the engine reports that as a finding rather than skipping
it, because an un-replayable booking is exactly the sort of gap a reprocessing run
should surface.

## Watch lists changed shape

Before:

```
Booking → Watch List → Notification
```

After:

```
New Booking Intelligence → Watch List Engine → Notification
```

`recordWatchListMatches` left the ingestion path. The consequences are concrete
rather than aesthetic: a watch list created today can be evaluated against findings
already in the repository; the engine's version can change without touching the
import path; and a notification carries the intelligence item id, so a 3am alert
traces back through the finding to the observation to the page of the PDF it came
from.

## Reprocessing

```
New algorithm → replay observations → improved intelligence
              → compare → approve → promote
```

A run writes into its own generation, tagged with `runId`. Items tagged with a run
are not in force; promotion clears the tag. That single mechanism is what makes the
whole thing non-destructive:

- A dry run persists nothing and cannot be promoted.
- A completed run produces a comparison — new, changed, unchanged, withdrawn —
  before anything is in force.
- Promotion supersedes the items it replaces. The superseded item keeps its own
  confidence, explanation and version bundle, which is what makes "what did we
  believe in March" answerable.
- A superseded conclusion cannot be re-accepted. It is history, not a decision
  waiting to be made.
- A withdrawn finding — one the live repository holds that the new algorithm no
  longer draws — is reported, not deleted. It may have been acted on, and retracting
  it silently would leave that action unexplained.

The comparison is bounded at 500 differences with a `truncated` flag. A diff of ten
thousand rows is not reviewable, and the counts are what tell an operator whether to
look closer.

## The version bundle

Every item carries all of it:

| Field | Bumped when |
| --- | --- |
| `engineVersion` | The engine's conclusions could change |
| `ruleVersion` | The merge policy changes |
| `confidenceVersion` | Scoring changes |
| `parserProfileId` / `parserVersion` | A source's layout changes |
| `normalizationVersion` | A date format, name split or code mapping changes |
| `nameKeyVersion` | A blocking key function changes |

Recorded separately because they change independently. A parser fix and a scoring
change are different reprocessing scopes, and a comparison that could only say
"these differ" without attributing the difference to a component would not be worth
running.

## Parser profiles

A profile is a row with a version, never an edit. A county's layout change is a new
version with an effective window; the old version stays exactly as it was, because it
is the only accurate description of how last year's documents were read.

Resolution is by roster date, not by "latest". A March document is read with March's
profile even if the layout changed in June. When two windows overlap — a configuration
mistake — the highest version wins, so the outcome is deterministic rather than
dependent on insertion order.

There is deliberately no route that edits a profile. An edited profile would
misdescribe how already-imported documents were read, which is the one thing the
versioning exists to prevent.

Two things fell out of this that were not the original goal:

**Onboarding a facility no longer requires code.** A facility with no compiled-in
column map works with a published profile alone — no deploy. The verification
exercises this path specifically.

**An import under no profile is a recorded warning.** Its provenance is weaker than
one parsed under a profile, and it cannot be reprocessed against a corrected mapping.
That is worth knowing about later, so it is an issue on the batch rather than a
silent fallback.

## Human review

A reviewer reviews intelligence, not raw records. `buildReviewPacket` resolves the
stored observation ids into what each source actually stated, with the document,
page, and row it came from, plus the reasoning, the conflicts, the confidence, the
version bundle, the item's own history, and a recommendation in plain language.

The recommendation distinguishes the two cases a reviewer is actually in:

- `proposed` with review required: *the engine did not change the repository and is
  asking for a decision.*
- `auto_applied`: *the engine applied this under its own rules. You are auditing a
  decision that has already taken effect; rejecting it requires a reversal, not a
  refusal.*

Rejecting a conclusion requires a note. A conclusion overturned without a stated
reason is a decision nobody can audit later, and the reviewer who made it will not
remember either.

## Audit trail

Every item has at least one event, written in the same transaction as the item — an
item whose history does not begin with its own creation is not auditable, and a
partial write would produce exactly that. Actions recorded: `created`, `auto_applied`,
`modified`, `reviewed`, `accepted`, `rejected`, `deferred`, `superseded`,
`algorithm_upgrade`, `reverted`. A supersession writes an event on both items, so the
upgrade is visible from either end.

Platform actions join the existing access log: `intelligence_query`,
`intelligence_view`, `intelligence_disposition`, `intelligence_reprocess`,
`intelligence_promote`, `parser_profile_published`. A reviewer's decision and an
algorithm promotion are audited for the same reason a merge is — they change what
the system asserts.

## Routes

All administrator-only, under `/api/admin/intelligence`.

| Route | Purpose |
| --- | --- |
| `GET /items` | The searchable repository, filterable by engine, type, severity, disposition, subject, run, confidence |
| `GET /items/:itemId` | The review packet, evidence resolved |
| `GET /subject/:kind/:id` | Every conclusion ever drawn about one subject, superseded included |
| `GET /review` | The queue: proposed and review-required |
| `POST /items/:itemId/disposition` | Accept, reject or defer, with a reason |
| `GET /engines` | Which engines exist, and what each has produced |
| `POST /reprocess` | Replay observations; **dry run by default** |
| `GET /runs`, `GET /runs/:runId` | Run history and comparisons |
| `POST /runs/:runId/promote` | Put a run's findings in force |
| `POST /runs/:runId/discard` | Abandon a run, keeping its record |
| `GET /parser-profiles` | Profile version history |
| `GET /parser-profiles/:id/batches` | Which imports one version read — the reprocessing scope |
| `POST /parser-profiles` | Publish a new version |

Reprocessing is a dry run unless `persist: true`. A route that persisted by default
would make it easy to fill the repository with findings from an algorithm nobody has
evaluated.

## Verification

`backend/scripts/verify-intelligence-platform.ts` — 48 checks against a real
database, printing evidence rather than assertions so a failure is diagnosable from
the output alone. It runs against a fresh facility each time, because version numbers
and counts that depend on how many times the script has been run before prove
nothing.

`backend/tests/intelligencePlatform.test.ts` — 26 unit tests over the pure logic:
finding shape, the confidence-versus-severity distinction, the recommendation
vocabulary, and the registry's refusal to let two implementations share a name.

Two defects the verification found, both in behaviour that looked correct:

**The duplicate-file guard ignored the facility.** It matched on content hash alone,
so identical bytes filed under a second facility imported nothing and reported the
first facility's batch. A shared regional export, or a mis-filed import being re-filed
correctly, would have silently dropped a whole roster. Now scoped to the facility, so
a true re-run is still a no-op.

**An engine given no observation scope must conclude nothing.** Reading a missing
scope as "all evidence" would have been catastrophic on a dry run. There is a test
for it because the correct behaviour and the dangerous one differ by a single
fallback.

## What is not done

- **Reprocessing at scale.** The replay is bounded at 100,000 observations per run
  and loads observation ids into memory. A repository with years of history needs
  cursor-based chunking. The bound is deliberate rather than accidental, but it is a
  bound.
- **Identity replay is a stub.** It reports un-replayable bookings but does not yet
  re-run candidate generation and the merge policy over historical evidence. The
  contract is in place; the replay body is not.
- **Reversal.** A reviewer can reject an `auto_applied` identity finding, and the
  rejection is recorded, but the merge it authorised is not undone. Unmerging is a
  separate operation with its own evidence requirements.
- **Real-world parser profiles.** Every profile in the system is synthetic. The
  versioning machinery is exercised; the actual county layouts are not, because no
  real export has been obtained.
