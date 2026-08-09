# NIIS Phase 2 — Status

Sacramento County operational implementation. This records what is delivered, what is
not, and one thing that is blocked on something only you can provide.

## The blocker, first

**Deliverable 9 says: "Before adding another feature: validate against actual
Sacramento exports." I cannot. Sacramento County publishes no bulk export.**

What I established:

- The Sheriff's public source is a **search portal**
  (`sacsheriff.com/inmateinformation`), not a downloadable file. It answers queries by
  name or X-Ref number and has a "booked in the last 24 hours" view.
- There is **no CSV or PDF roster available for download**. The transparency page
  directs bulk requests to a California Public Records Act portal.
- I attempted to retrieve a live sample directly. The portal is an ASP.NET form whose
  results require a session and, apparently, a real browser; a scripted POST returns
  the page with no results. I stopped there, because scraping a sheriff's portal is a
  decision about terms of use that is yours to make, not mine — and because the
  artifact Phase 2 describes is a *file*, which no amount of scraping produces.

So a Sacramento CSV export or PDF roster reaches you one of three ways: a CPRA
request, a bail-industry data vendor, or an existing arrangement Sailors Bail Bonds
already has. **Whichever it is determines the file format**, and every header spelling
in the parser profile is a guess until one arrives.

### What I did instead

The Sheriff's office publishes what the roster *contains*, even though it does not
publish the roster. That field list is authoritative, and the profiles are now built
against it:

> inmate name, date of birth, booking date and time, X-reference number,
> booking/registry number, sex, height, weight, outstanding warrants, projected
> release date, charges, bail amount, arresting agency, type of arrest, holding
> facility, housing location, next court date, and the name of the court

Seven of those the parser could not read before: height, weight, outstanding warrants,
projected release date, type of arrest, next court date, court name.

### What to send me

Any **one** real file is worth more than another week of design:

1. A Sacramento CSV export — even one day, even redacted. The **header row alone**
   resolves most of the guessing.
2. A Sacramento PDF roster — one page is enough to know whether it has a text layer
   and how rows are laid out.
3. Failing both: a screenshot of the export dialog or a column list from whoever
   supplies the data.

The profiles are versioned precisely so this is cheap: a real file becomes profile v2
with an effective date, and v1 stays as the accurate description of anything already
imported under it.

## Delivered

### 1 · Sacramento data profiles — done

Two profiles, not one, because the CSV export and the PDF roster are different
documents that disagree about the spelling of the same column. Each carries the six
things Phase 2 requires: version, effective date, expected headers, field mappings,
normalization rules (as prose, for a reader years from now), and validation rules.

The booking number and the X-Ref are mapped as **different identifiers**. One
identifies a stay; the other identifies the person across every stay and is what makes
identity resolution reliable here. Conflating them is the worst single mistake
available in this map.

**Projected release date is separate from release date** everywhere — schema,
observation, report. One is a forecast the jail revises; the other is a fact. Merged, a
forecast reads as a release and puts a person at liberty on paper who is still in
custody.

Validation runs after normalizing and **before any write**, so a document of the wrong
shape fails the batch instead of half-filling the repository. That is the point: an
import of mostly-empty rows is indistinguishable from a quiet day at the jail.
Verified against three documents — the roster imports, a roster whose columns were all
renamed is refused with the reason, and a two-row file is refused as a truncated
download rather than accepted as the day's population.

Evidence: `backend/scripts/verify-sacramento-profiles.ts`, 40 checks.

### 3 · Daily intelligence report — done

Eight sections: import summary, newly booked, returning, watch list matches,
significant changes, human review queue, statistics, evidence appendix.

Server-rendered HTML with a print stylesheet rather than a PDF library. It prints
correctly from any browser, the on-screen view and the printed page are the same
markup, and Chrome's print path produces the PDF. A PDF library would add a second
rendering path that could disagree with the first.

The rendered document is stored **verbatim**, so this morning's report can be reprinted
unchanged after the data behind it has been corrected. A report that silently updates
is not a record of what was believed when it was printed.

Absent values print as *"not stated"* rather than blank. A blank cell reads as zero or
as an oversight; the jail not publishing a bail figure is a fact about the source.

Evidence: `backend/scripts/verify-daily-report.ts`, 66 checks over a two-day scenario
built from an empty database. Rendered sample: `reports/daily-report.png`.

## Defects this phase found

All six were in code that looked correct, and four were silent.

| Defect | Consequence |
| --- | --- |
| A height written `5'11"` contains a bare double quote in an unquoted CSV field. The splitter treated it as opening a quoted field and the file reader counted quotes and agreed. | One inches mark swallowed every following line and rejected the whole roster. |
| A restated booking updated only `lastObservedAt`. | The booking row — which every screen and the printed report read — held the first roster's values forever. A bail raised to $75,000 kept printing as $50,000. |
| The watch list engine matched `bail_changed`; the change engine emits `bail_change`. | A watched person's bail doubled, the change was recorded, and no notification was raised. Nothing failed and nothing was logged. |
| The report's Significant Changes section had the same guessed names. | It listed nothing but departures while bail and housing changes sat unreported. The section looked like it worked. |
| A booking listed again after being marked as having left the roster kept `departedRosterAt`. | A person restored to the roster stayed missing from the population screen. |
| A CLI import named no operator, because operators were read from upload rows. | The report said nobody ran an import that plainly ran. |

The pattern is worth stating: **four of six were string mismatches or stale writes
that produced a plausible-looking empty result.** Nothing threw. The only reason they
surfaced is that the verification asserted each section *contained* something specific
rather than that it rendered.

## Not delivered

Stated plainly, in the order I would do them.

| Deliverable | Status |
| --- | --- |
| **2 · Restartable staged pipeline** | Partial. The pipeline runs all fourteen stages and reports six of them for progress; `resumeCursor` records the last committed row. It is not restartable *per stage* — a failure mid-import restarts the file. |
| **6 · Watch lists** | Backend partial. Priority, label, expiration and disable-with-reason exist in the schema and the engine honours them. No create/edit/disable/delete UI, and no notification-history screen. |
| **7 · Review queue** | Backend partial. Assignment, priority, evidence requests, override reasons and algorithm versions are in the schema. Approve, reject and create-new work end to end; assign and request-more-evidence have no route or UI yet. |
| **8 · Daily dashboard** | The existing dashboard covers today's import, status, new, returning, reviews waiting and recent imports. Missing: watch list hits, system health, parser versions surfaced on it. Not yet the home screen. |
| **4 · Historical repository** | Court history and review history are the two gaps. The fields now exist (`courtDate`, `courtName` per observation), so court history is derivable the way bail and housing history already are. |
| **5 · Search** | Name, alias, DOB, booking number and SO number work. Housing, charge and facility are not searchable. No latency measurement. |
| **10 · Performance** | Not started. No benchmark at 15 years / 1M people / 10M bookings / 100M observations. |
| **9 · Real validation** | Blocked. See above. |

## The acceptance demonstration

Of the twelve steps, nine are exercised by the verification scripts today: empty
database, upload, process, compare two sources, identify new and returning and
conflicts and reviews, generate the report, persist evidence, restart, verify the
repository unchanged, import the next day and see only changes, open a record with the
timeline.

Three are not yet demonstrated end to end **in the browser** with a real PDF alongside
the CSV: simultaneous processing of both files, the watch list section populated from a
UI-created list, and the evidence-backed explanations read from the person page rather
than from the report.

That demonstration is worth doing once, on real files, rather than twice on synthetic
ones.

---

# Phase 2A — Sacramento County Operational Readiness

## What was built

**Import Inspection Mode** (your additional directive), the **parser validation
framework** (Priority 2) and the **mapping review tool** (Priority 3) turned out to be
one feature seen from three angles, so they were built together.

### Inspection

Upload any Sacramento file; the system describes it and imports nothing. No batch, no
observation, no person, no booking — the only write is the inspection record, kept
because it is the description of a file's structure at the moment it arrived, which is
what you want when a mapping later turns out to have been wrong. The uploaded bytes are
deleted after reading: an inspected file has not been accepted as evidence of anything.

The report gives, per column: the header as written, the inferred type with a
confidence and a rationale, sample values, how many rows carried a value, whether every
value is distinct, what the active profile maps it to, and — when it maps to nothing —
what it probably is and why.

Columns are described **from their values, not their headers**, because the header is
exactly what cannot be trusted when a county renames a column. Suggestions score header
text and value shape separately and add them, so a column whose name means nothing can
still be identified from its values, and neither signal alone reaches the threshold the
profile update uses.

For a PDF the questions are different — there are no columns yet — so it reports page
count, whether a text layer exists, whether OCR would be used, whether any line carries
both a date and a name, and the first forty lines of extracted text.

### The loop, verified end to end

A Sacramento export with every column renamed:

| Step | Result |
| --- | --- |
| Inspect | 32% parser confidence, **would be refused** — names the missing required column |
| Publish the suggestion | Profile v2. v1 untouched, its window closed |
| Re-inspect the same file | 79% parser confidence, **would import** |
| Import | Completes; the renamed surname, bail and date-of-birth columns all read correctly |

No code change, no deployment.

### Validation framework

Every import now carries a validation report on its batch: recognised, unknown,
duplicate and empty-though-mapped columns; missing required columns; field coverage;
profile version; parser confidence; every warning and every error. Stored rather than
logged, because "why did this import produce so few records" arrives weeks later and a
log line is gone. Warnings are recorded even on an import that completed — nothing
silently succeeds.

### Mapping editor

Every canonical field with its header aliases, editable. Removing every alias from a
field disables it, which is how an obsolete mapping is retired. Publishing requires a
change note, because years from now it is the only answer to "why does this profile read
the bail column from there". There is deliberately no route that edits a published
version.

## Defects Phase 2A found

| Defect | Consequence |
| --- | --- |
| **A profile published mid-day left that day uncovered.** Publishing floored the old window to the previous day and started the new one at the current instant; a roster dated today parses to midnight and matched neither. | No profile applied, the import fell back silently to the compiled-in map, and failed on the very columns just mapped — on exactly the day an operator publishes. Windows are now day-granular throughout. |
| A bare integer is a valid currency amount | A weight of 180 inferred as money. Three-digit bare integers are quantities now, stated as the heuristic it is. |
| The packed height form matched any three digits | 205 became two feet five inches — in the inference *and* in the parser. Now constrained to four to seven feet. |
| The verdict counted suggestions as already applied | A file that would be refused today reported "would import with warnings" — the one thing this mode exists to get right. |
| Version history counted a ColumnMap's own keys | Every version reported six mapped fields regardless of its mapping, making the history useless for seeing what changed. |

The first was found only by demonstrating the loop in a browser rather than by script,
because the demo did the realistic thing: published a profile, then imported that same
day's roster.

## Priorities 4–10

These require real Sacramento data, and inspection is what makes them safe to attempt
the moment a file arrives — which was the point of building it first.

| Priority | Status |
| --- | --- |
| 4 · Operational workflow verification | The workflow runs end to end through the dashboard with no CLI. Not yet run on a real export. |
| 5 · Intelligence verification | Evidence, observations, confidence, candidates considered and merge rationale are all recorded and shown. Not yet checked against real people. |
| 6 · Historical timeline validation | Timeline, charges, bail, housing, evidence and intelligence reconstruct from observations. Court history is derivable now that the fields exist; not yet surfaced. |
| 7 · Report certification | All eight sections render and print; the document is stored verbatim. Not yet frozen as a versioned specification. |
| 8 · Watch list validation | Matching, notifications and priority work from intelligence rather than bookings. Release and return-to-custody paths are wired but only exercised synthetically. |
| 9 · Performance baseline | Not started. No measurement at projected scale. |
| 10 · Acceptance demonstration | Recorded for the inspection loop. Cannot be recorded for real data without real data. |

## Still the one thing that would unblock the rest

A single real file. Inspection means it is now **safe** to hand the system an unknown
Sacramento export: the worst case is a report saying it would be refused and why, rather
than a repository quietly full of nulls.
