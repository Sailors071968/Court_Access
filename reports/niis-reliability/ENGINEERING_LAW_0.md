# CourtAccess NIIS — Engineering Law #0

# The System Must Never Lie

**This supersedes every engineering directive.**

> **Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.**
>
> Everything else is secondary.

CourtAccess NIIS shall never knowingly present information as fact unless it can prove that fact from preserved evidence.

The software shall never optimize for **appearing** correct.  
It shall optimize for **being truthful**.

## Truth categories

Every statement produced by NIIS must belong to exactly one of four categories:

| Category | Meaning | Operator cue |
|---|---|---|
| **VERIFIED FACT** | Supported directly by preserved evidence (PDF, page, row, extraction, confidence) | Fact |
| **VERIFIED CONCLUSION** | Deterministic rules on verified facts (e.g. NEW = present today ∧ absent yesterday) | Conclusion |
| **ANALYTICAL INTELLIGENCE** | Derived interpretation — never presented as fact; confidence + evidence listed | Intelligence · Not Fact |
| **UNKNOWN** | Evidence insufficient — never estimate, never infer | UNKNOWN |

## Every screen must display truth

Operators must never confuse Facts, Conclusions, Intelligence, and Unknowns. UI surfaces use truth badges from `truthCategories.ts`.

## The report must be explainable

Every line on the New Inmate Report must answer **Why am I here?** in one sentence a bail agent understands immediately.

Examples:

- Appears on today's roster but not yesterday's certified roster.
- Manual review required because DOB differs while XREF matches.

## Business rule

The New Inmate Report exists to help Sailors Bail Bonds identify new booking opportunities.  
Every inmate on that report must be explainable in one sentence. Nothing more complicated is required for operational use.

## No silent failure

Any condition that could change the report must be visible on the Morning Operations Dashboard — never buried in logs:

- OCR confidence dropped  
- Parser profile changed  
- Identity rule updated  
- PDF page skipped  
- Unknown columns  
- Reconciliation failed  

## Confidence is never hidden

If NIIS is only 70% confident, the operator knows immediately. Confidence is operational information.

## Human review is a feature

Routing an uncertain case to review is **success**.  
Silently making the wrong decision is **failure**.

## Every mistake makes NIIS better

Every discrepancy permanently improves the system. The same discrepancy must never surprise NIIS twice — if it does, the certification corpus / regression suite is incomplete.

## Daily operational discipline (preferred over new architecture)

The architecture is mature. Prefer this loop every day:

1. Upload yesterday's certified PDF (if needed)  
2. Upload today's PDF  
3. Let NIIS generate the report  
4. Perform the manual comparison  
5. Compare NIIS to manual results  
6. Fix every discrepancy  
7. Add every resolved discrepancy to the certification corpus  
8. Repeat tomorrow  

That discipline will improve NIIS more than additional architectural changes. Over time the certification corpus becomes the strongest evidence the system can be trusted — demonstrated agreement with real Sacramento County jail roster comparisons, not design intentions alone.

## Implementation map

| Concern | Location |
|---|---|
| Truth categories | `backend/src/intelligence/inmates/truthCategories.ts` |
| One-sentence report why | `reportGenerator.ts` + `rosterComparison.ts` |
| Silent-failure alerts | `getMorningOperationsBoard` → `alerts[]` |
| Morning board UI | `MorningOperationsDashboard.tsx` |
| Daily loop | `DAILY_OPERATIONAL_LOOP.md` |
