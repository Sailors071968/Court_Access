# Daily Workflow — PDF Primary, CSV Enrichment

**Status:** Binding architecture for Sacramento daily operations.  
**Supersedes:** CSV-first / dual-authoritative discovery framing.

## Gold-standard principle

Manual investigator comparison is the gold standard — not the software. The PDF pair is what operators use each morning to find newly booked inmates; NIIS must match that workflow.

## Daily pipeline (revenue path)

```
Yesterday PDF
        │
Today's PDF
        │
        ▼
Roster Comparison Engine
        │
        ▼
New Inmate Detection
        │
        ▼
Historical Lookup
        │
        ▼
New Inmate Intelligence Report   ← produced immediately (before CSV)
        │
        ▼
Save into Repository
        │
        ▼
(Optional) CSV arrives
        │
        ▼
Booking Enrichment
        │
        ▼
Update Existing Records
```

### Step 1 — Upload today’s Sacramento Jail Roster PDF (primary)

Each morning:

1. Today’s PDF  
2. Compare against yesterday’s PDF  
3. Determine **all** newly booked inmates  
4. Generate the New Inmate Report  

At this point staff can begin contacting prospective clients. **This is the primary revenue-producing operation.**

### Step 2 — Optional CSV enrichment

When the Sacramento CSV becomes available later:

1. Locate matching bookings (XREF / identity)  
2. Enrich existing booking records (booking #, bail, housing, charges, court, demographics, etc.)  

**The CSV never determines whether someone is new.**

If the CSV contains a booking the PDF did not, NIIS flags it as an **exception requiring review** — it does not silently create a new inmate.

## Inverted ingestion priority

| Old framing | New framing |
|---|---|
| CSV + PDF → repository | **PDF → daily comparison → new detection → report → repository → CSV enrichment** |

## Daily Case

Each ops day is one operational event:

| Field | Example |
|---|---|
| Date | 08/11/2026 |
| Yesterday PDF | attached batch/upload |
| Today PDF | attached batch/upload |
| Optional CSV | attached when present |
| Results | New / Returning / Existing / Exceptions |
| Report | Initial (PDF) + optional Enriched (post-CSV) |
| Audit log | append-only |

API:

- `GET /api/admin/intelligence/daily-cases`
- `GET /api/admin/intelligence/daily-cases/:caseId`
- `GET /api/admin/intelligence/daily-cases/by-date/:facility/:opsDate`

Model: `InmateDailyCase` (`inmate_daily_cases`).

## Immediate report, then enrichment

Example initial report (right after PDF compare):

```
08/11/2026 — 67 New Inmates
──────────────
JOHN SMITH
  Booking time / Facility / Prior bookings
MARY JONES
  …
```

After CSV:

```
JOHN SMITH
  Bail: $50,000 · Housing: B-4 · Court: Dept. 61 · Charges…
```

Retain **initial** and optional **enriched** report ids on the Daily Case for audit.

## Accuracy certification

The Sacramento Validation Suite certifies Step 1 (PDF pair → 67). CSV enrichment must not change who is classified new for that certification pair.

See `NIIS_ACCURACY_CERTIFICATION.md`.
