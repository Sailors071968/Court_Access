# New Inmate Intelligence — Operator Guide

Version 1. Sacramento County, manual upload, manual processing.

## The daily routine

1. **Administration → New Inmate Intelligence → Upload Files.**
2. Set the **roster date** to the day the roster describes — not today's date if you are
   importing yesterday's file. The date decides which parser profile reads the
   document.
3. Drop today's CSV and PDF in together, or choose them. Both can go in one upload.
4. Press **Process Import**. You land on the Processing Queue and can watch it run.
5. When it finishes, open the **Dashboard** for the day's numbers, then **Today's New
   Inmates** for the people.
6. Press **Print report** to produce the printable intelligence report.
7. If anything is in the **Review Queue**, decide it. Those bookings do not exist until
   you do.

## What the dashboard numbers mean

| Tile | Means |
| --- | --- |
| New inmates | Never seen in this repository before. The primary output. |
| Returning inmates | Booked again after a prior stay we already had. |
| Known inmates | Rows restating a booking we already held — a second source, or the same roster again. |
| Review required | The resolver would not decide. Someone must. |
| Conflicts | Two sources disagreed about the same booking. |
| Processing time | Wall time across the day's imports. |
| Files processed | How many documents were read. |

"New inmates" is recorded when a person is first imported and never recalculated.
Importing an older roster next week will not change last week's number, which is why a
printed report stays true to what was known when it was printed.

## Things that look like problems and are not

**"Processing will report no new records."** You uploaded a file whose contents are
byte-identical to one already uploaded. Re-processing it writes nothing. This is worth
checking rather than ignoring: if you meant to upload today's roster and got this
warning, you probably picked yesterday's file.

**A booking that says "no longer listed" rather than "released".** The jail stopped
publishing that booking without publishing a release date. Those are different facts
and the system will not turn one into the other. The person may have been released,
transferred, or the roster may have simply dropped them.

**A person's name spelled two ways.** The system matches on a punctuation-free form —
so `O'BRIEN` and `OBRIEN` are one person — but shows and prints the spelling the jail
actually wrote. The alias list is the record of every spelling seen.

**Review Queue empty.** The merge policy decided everything on its own. That is the
normal case.

## The review queue

Each card shows what the roster said on the left and who the resolver thinks it might
be on the right, with that person's aliases, facility identifiers and recent bookings.
Below that: why the record is in the queue, what evidence supported the match, and what
disagreed with it.

Three buttons:

| Button | Means | Writes |
| --- | --- | --- |
| **Approve merge** | This is the same person. | Attaches the booking to the existing person. |
| **Reject merge** | This is a different person from the candidate. | Creates a separate person, and records that the candidate was considered and ruled out. |
| **Create new person** | No candidate applies. | Creates a separate person. |

Rejecting requires a reason. Approving does not — the evidence on the card is already
the reason.

Reject and Create both produce a new person, so the outcome looks the same. The
difference is what the record says afterwards: "this is not Robert Smith" versus "I
have no opinion about Robert Smith". The next reviewer looking at similar evidence
needs to know which you meant.

**A decision is a write, not a note.** A record awaiting review has no booking in the
repository. Leaving the queue to grow means leaving bookings unrecorded.

## Historical search

Every criterion must match — they are ANDed. A date of birth the jail never published
will exclude everyone.

Name fields search aliases as well as the current spelling. Searching `BRIEN` finds
someone recorded as `O'BRIEN` last year and `OBRIEN` this year, as one person.

Search by **SO / X-Ref number** when you have it. It is the jail's own identifier for
the person and the most reliable way to find them.

## Import history

One row per processing run: when it started, how long it took, who ran it, which file,
and what it concluded. Click a row for the Import ID, the file's content hash, the
parser profile version that read it, and every issue the run reported.

A **warning** is worth reading. An **error** stopped something.

If you see `no_parser_profile`, the document was read with the compiled-in column map
because no versioned profile applied. It imported, but its provenance is weaker and it
cannot later be re-read against a corrected mapping.

## What version 1 does not do

Stated so you do not go looking for it:

- No scheduler. Rosters are uploaded by hand.
- No watch list notifications. Matches are recorded and visible; nothing is sent.
- No OCR tuning. A text-layer PDF is read directly; a scanned one falls back to
  unoptimised OCR.
- One county. Sacramento only.

## Deleting an upload

You can remove a file that has not been processed. You cannot remove one that has: it
is the evidence behind every conclusion drawn from it, and deleting it would leave
those conclusions unverifiable.

## When a county changes its format

Sacramento will eventually reorder or rename a column. When that happens the import
will fail or report unmapped headers rather than quietly importing a roster full of
blanks.

The fix is a **new parser profile version** with an effective date, not an edit to the
existing one. The old version stays because it is the only accurate description of how
last year's documents were read. Settings shows the version history.

## Running it for the first time

```bash
# Register Sacramento County and publish its parser profiles. Idempotent.
cd backend && npx tsx scripts/seed-sacramento.ts
```

Uploaded files are stored outside the release directory so a deployment does not delete
them. Override the location with `NIIS_UPLOAD_DIR`; it defaults to
`/var/lib/courtaccess/niis-uploads`.

## Verifying it works

```bash
# 42 checks over the whole path, against a real database.
cd backend && npx tsx scripts/verify-sprint-acceptance.ts
```

Run it against an empty database. On one with existing data the counts it asserts are
not meaningful, which is how two real defects hid during development: contamination
made every wrong number look explainable.
