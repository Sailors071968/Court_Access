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
