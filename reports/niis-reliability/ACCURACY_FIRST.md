# Accuracy First — Phase B deferred

**Superseded in authority by** [PRIMARY_ENGINEERING_DIRECTIVE.md](./PRIMARY_ENGINEERING_DIRECTIVE.md). This note remains for the Phase B deferral rule.

**Binding rule:** every engineering hour is spent improving operational accuracy until NIIS consistently produces the **same new-inmate list** as manual investigator comparison.

## Definition of “new” (revenue path)

```
on today's Sacramento PDF  ∧  not on yesterday's Sacramento PDF
```

Historical repository bookings are **enrichment** (shown on the report), not the definition of newness. A person absent yesterday who has older Sacramento history is still on the Morning New Inmate Intelligence Report (disposition: `returning`).

Implemented by the **Roster Comparison Engine**:
`backend/src/intelligence/inmates/rosterComparison.ts`

Wired into:

- Daily Case PDF finalize → set-diff → initial report
- `buildNewInmateReport` / `getNewInmates` when a PDF pair exists
- Daily Difference Viewer colors

## Phase B — Operational Speed (NOT STARTED)

Only after sustained accuracy (manual list match):

Operator morning in under five minutes:

1. Upload today's PDF  
2. Wait for processing  
3. Review any exceptions  
4. Print the New Inmate Intelligence Report  

No speed/UX work may displace accuracy work until that bar is met.

## Current certification blocker

Durable 08/09 + 08/10 SACJAILSCAN PDFs are still required to close the historical 67-name benchmark. Continuous daily ground-truth recording remains the production path.
