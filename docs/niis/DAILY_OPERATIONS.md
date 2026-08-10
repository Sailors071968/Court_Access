# New Inmate Intelligence — Daily Operations

For the person who runs the Sacramento roster each morning. No engineering knowledge
assumed. If something here doesn't match what you see on screen, trust the screen and
tell whoever maintains the system.

---

## The morning, in short

1. Sign in. **Administration → New Inmate Intelligence** opens on **Morning
   Operations**.
2. Read the sentence at the top. It tells you what to do next.
3. **Upload Files** → drop in today's CSV and PDF → set the roster date → **Process
   Import**.
4. Watch **Processing Queue** until it says complete.
5. Back to **Morning Operations**. Check newly booked, returning, watch list matches.
6. **Reports** → generate → review → approve → print.
7. Clear anything in **Review Queue**.

Most mornings that's the whole job and it takes a few minutes.

---

## The sentence at the top

Morning Operations leads with one sentence because only one thing matters first: what
needs doing. The colour tells you how urgent it is.

| Colour | Means |
|---|---|
| Green | Nothing is waiting for you. |
| Amber | Something needs attention but nothing is broken. |
| Red | Do this before anything else. |

Common ones and what to do:

**"Today's Sacramento roster has not been imported yet."**
Upload it. This is the normal state first thing.

**"No roster has been imported for 31 hours."**
A day was missed. Import the missing file if you still have it, then today's. Importing
an older roster is safe — the system records what was known when, so it won't rewrite
yesterday's report.

**"2 import(s) failed today."**
Open **Import History**, click the failed row, read the reason. See *When an import
fails* below.

**"3 record(s) need a decision."**
Open **Review Queue**. This matters more than it sounds: see *Review Queue* below.

**"1 import(s) still processing."**
Wait. The numbers fill in as it finishes.

---

## Uploading

Both files at once is fine — drag them in together.

**Set the roster date to the day the roster describes**, not today's date. If you're
importing Friday's file on Monday, the roster date is Friday. It decides which parser
version reads the file, and it decides which day the intelligence belongs to.

The CSV is processed before the PDF automatically. That's deliberate and you don't need
to do anything about it.

### "1 of them has identical content to a file already uploaded"

You've uploaded the same file twice. Processing it again writes nothing.

This is usually a mistake worth catching: if you meant to upload *today's* roster and
got this message, you probably picked yesterday's file by accident. Check the filename
and the roster date before pressing Process Import.

---

## When you get a new or unfamiliar file

Use **Import Inspection** before importing. It reads the file, tells you what would
happen, and imports nothing at all.

Do this when:

- the file came from a new source
- the filename or format looks different
- an import failed and you don't know why
- someone tells you the county changed something

You'll get one of three answers:

**"This file would import."** Go ahead and import it normally.

**"This file would import, with warnings."** Read the reasons. Usually a column the
system doesn't recognise — the import will work but those values won't be captured.
Worth fixing, not worth stopping for.

**"This file would be refused."** Don't try to import it; it won't work. Read on.

### Fixing a file that would be refused

Inspection tells you which columns it couldn't recognise, and often what it thinks they
are. If it offers a button like **"Publish v3 with 11 mapping(s)"**:

1. Look at the **Columns** table first. For each suggestion, check the **sample values**
   actually look like what the system thinks the column is. It's usually right, but you
   are the check on it.
2. Press the publish button.
3. **Inspect the same file again.** The confidence should jump and the verdict should
   change to "would import".
4. Now import it normally.

If there's no button, or the suggestions look wrong, go to **Parser Mapping** and do it
by hand — see *Correcting parser mappings*.

---

## Reading warnings

Warnings appear on **Morning Operations**, on the import in **Import History**, and in
the report. They don't stop anything; they tell you something is drifting.

| Warning | What it means | What to do |
|---|---|---|
| Import ran without a published profile | The system used its built-in guess at the format. It worked, but the import can't be re-read later if the mapping turns out wrong. | Publish a profile in **Parser Mapping**. Not urgent. |
| Read at under 70% parser confidence | The system understood less than three-quarters of the columns. | Run **Import Inspection** on the next file. The county may have changed something. |
| N mapped column(s) are empty in every row | The column exists in the file but the county isn't filling it in. | Nothing, usually. Worth mentioning if it's bail or charges. |
| N row(s) have a different field count | Some rows were skipped rather than guessed at. | If it's a handful, fine. If it's most of the file, the format has changed. |
| Not valid UTF-8 / probably Windows-1252 | Accented names will be mangled. | Ask for the export as UTF-8 if you can. |

**Anything marked "error" stopped the import.** Nothing was written. Warnings did not.

---

## Review Queue

**This is the one thing that genuinely needs you.**

When the system isn't sure whether a person on the roster is someone it already knows,
it refuses to guess. It puts the record here and **does not create the booking**.

That's the part worth understanding: while a record sits in the review queue, that
person is not in the population figures, not on any report, and not findable in search.
Leaving the queue to grow means quietly losing people.

Each card shows the roster's version on the left and the person it might be on the
right, with that person's aliases, identifiers and recent bookings — so you can decide
without opening another screen.

Three buttons:

| Button | Use when | What happens |
|---|---|---|
| **Approve merge** | It's the same person. | The booking attaches to the existing person. |
| **Reject merge** | It's a different person from the one shown. | A separate person is created, and the record says the candidate was considered and ruled out. |
| **Create new person** | Nobody was suggested, or none of them apply. | A separate person is created. |

Reject and Create both make a new person, so the result looks the same. The difference is
what the record says afterwards — *"this is not Robert Smith"* versus *"I have no opinion
about Robert Smith"*. The next person reviewing similar evidence needs to know which you
meant, so use Reject when you actually ruled the candidate out.

**Rejecting needs a reason.** Approving doesn't — the evidence on the card is the reason.

### What to look at

- **Date of birth.** Same DOB and same surname is usually the same person. Different
  DOB usually isn't, however similar the name.
- **The X-Ref / SO number.** If both records have one and they match, it's the same
  person. This is the strongest evidence available.
- **Charges and dates.** Two bookings the same day in different facilities is worth a
  second look.
- **"The candidate search hit its limit"** — if you see this, a better match may exist
  that was never considered. Search for the name in **Historical Search** before
  deciding.

---

## Approving and printing reports

**Reports** → **Generate today's report**. It arrives as a **draft**.

Then: **Mark reviewed** → **Approve** → **Print**.

The states aren't bureaucracy. They record who was willing to act on what:

- **Draft** — generated; nobody has looked at it.
- **Reviewed** — you read it against the roster.
- **Approved** — you're willing to act on it. Stored with your name and the time.
- **Printed** — it left the building on paper.
- **Archived** — permanent record; it doesn't change again.

**Once a report is printed you cannot edit it.** If you find a mistake afterwards,
generate a new report — it will say what it replaces. That's on purpose: a printed
document someone acted on shouldn't be able to change quietly underneath them.

A draft can't skip to printed. Sending a report back to draft needs a reason and clears
the approval, because an approval that survived a rejection would claim you signed off
on something that was then sent back.

### What's in the report

Eight sections: import summary, newly booked, returning, watch list matches, significant
changes, review queue, statistics, and an evidence appendix.

The **evidence appendix** is the part that makes the rest defensible. Every claim traces
to a document, a page, a row and the reasoning applied to it. If someone questions a line
in the report, the answer is in section 8.

---

## Things that look wrong and aren't

**"No longer listed" instead of "Released."**
The jail stopped publishing that booking without publishing a release date. Those are
different facts and the system won't turn one into the other. The person may have been
released, transferred, or the roster may have just dropped them. If you need to know,
call.

**A name spelled two ways.**
The system matches `O'BRIEN` and `OBRIEN` as one person but shows and prints the spelling
the jail actually used. The alias list on the person's page is every spelling ever seen.

**Bail shown as "not stated" rather than $0.**
The jail didn't publish a figure. That's different from bail being zero, and the report
won't pretend otherwise. Same for "NO BAIL", which means no bail was set — also not zero.

**A "projected release date" that comes and goes.**
It's the jail's forecast and they revise it. It is never treated as an actual release.

**Review Queue empty.**
Normal. It means the system decided everything on its own.

**Zeros on a fresh morning.**
Check the sentence at the top. If it says today's roster hasn't been imported, the zeros
are correct — there's nothing to count yet.

---

## When an import fails

Nothing was written. The repository is exactly as it was. You can fix the problem and
import again without cleaning anything up.

**Open Import History and click the failed row.** The reason is there, along with which
stage it failed at.

| Reason | What to do |
|---|---|
| "does not supply bookedAt" / "required column absent" | The format changed. Run **Import Inspection**. |
| "roster too small" | The download was truncated. Get the file again. |
| "too many unparseable rows" | The layout changed. Run **Import Inspection**. |
| "did not match the parser profile" | Same — inspect, then publish a mapping. |
| PDF: "could not be read" | The file may be corrupt or password-protected. Ask for it again. |

If an import is stuck — **Processing Queue** shows it running for a long time with no
progress — you can **cancel** it from Import History. Cancelling needs a reason. Then
upload again.

### If your browser closes or the page reloads mid-import

Nothing is lost. Processing happens on the server, not in your browser. Reopen
**Processing Queue** and it will still be there, at whatever stage it reached.

If the application itself restarts mid-import, the batch will show as failed or stuck at
the stage it reached. Nothing partial is left behind — import the file again.

---

## Correcting parser mappings

Use **Parser Mapping** when the county renames or moves a column and you want to fix it
by hand rather than from an inspection suggestion.

Each row is one piece of information the system wants (Booking number, Bail, Housing) and
the column names in the file that mean it. Add the county's new name; remove one that no
longer exists.

Then fill in **why this version exists** and press Publish.

Three things worth knowing:

**It always creates a new version. It never edits the current one.** The current version
is the accurate description of how everything already imported was read — editing it
would make all those imports misdescribed. That's why you write a change note: years from
now it is the only answer to "why does this read the bail column from there".

**Effective from** decides which files use it. Files with a roster date from that day
onwards get the new version; earlier files keep the old one. Leave it as today unless you
are fixing something retrospectively.

**Removing every name from a field disables it.** That's how you retire a column the
county stopped sending. Already-imported data keeps its values.

After publishing, **inspect the file again** to confirm it now reads before importing.

---

## Watch lists

A watch list is a person you want to know about. When they appear in new intelligence —
a new booking, a release, a transfer, a bail change — a match is recorded and shows on
Morning Operations and in the report.

Priorities: **urgent**, **elevated**, **routine**. This changes how prominently a match
is shown, not whether it's recorded. Everything is recorded.

An entry can be given an expiry date. After it, the entry stops matching but is not
deleted — it still explains a notification sent last month.

Matches come from intelligence, not from the roster directly. Practically, that means a
watch list you add today can be checked against what the system already knows, not only
against tomorrow's roster.

---

## Who to ask

| Situation | Who |
|---|---|
| Format changed, inspection suggestions look wrong | Whoever maintains the system |
| Unsure whether two records are the same person | Use your judgement; that's why the queue exists |
| Import failed and the reason means nothing to you | Whoever maintains the system, with the batch ID from Import History |
| A report has gone out with a mistake | Generate a corrected report; don't try to edit the printed one |
| A person's record looks wrong | Their page shows every observation and where it came from — start there |

Always quote the **batch ID** from Import History. It's the one identifier that ties
together everything about a single import.
