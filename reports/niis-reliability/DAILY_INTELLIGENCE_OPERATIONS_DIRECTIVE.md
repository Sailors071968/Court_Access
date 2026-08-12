# CourtAccess NIIS – Daily Intelligence Operations Directive (Final)

The CourtAccess New Inmate Intelligence System is no longer a software development project.

It is a **daily intelligence operation** whose purpose is to identify every newly booked Sacramento County inmate each morning as quickly and accurately as possible.

The software exists to support that operation.

## Operational timeline

### Phase 1 – Morning Intake

1. Automatically identify the most recent certified Sacramento County roster.
2. Prompt the administrator to upload today's PDF.
3. Validate that the uploaded PDF is newer than the previous certified roster.
4. Preserve the uploaded PDF as immutable evidence.

### Phase 2 – Immediate Comparison

Within the shortest practical time:

1. Extract every inmate from today's roster.
2. Compare against yesterday's certified roster.
3. Identify:
   - New inmates
   - Existing inmates
   - Returning inmates
   - Review-required inmates

Every inmate must receive **exactly one** classification.  
No inmate may remain unclassified.

### Phase 3 – Revenue Report

Immediately generate the **Morning New Inmate Intelligence Report**.

This report is the primary operational output. It should be printable and include, for each newly identified inmate:

- Name
- Booking date and time (if available)
- Facility
- Prior Sacramento bookings
- Prior booking dates
- Charges (if available)
- Bail (if available)
- Housing (if available)
- Confidence
- Watch-list indicators
- Links to evidence

The report should be available **before** any optional enrichment.

### Phase 4 – Repository Update

After the report is generated:

- Persist new observations
- Update historical records
- Preserve all evidence
- Preserve every processing decision
- Preserve the audit trail

Nothing may overwrite original evidence.

### Phase 5 – Optional CSV Enrichment

When a Sacramento CSV becomes available:

- Match it to existing bookings
- Add richer information
- **Never** change whether someone was classified as "new" based solely on the CSV
- If the CSV introduces unexpected bookings, route them to review

## Daily certification

Every morning concludes with two independent outcomes.

| Outcome | Audience | Content |
|---|---|---|
| **Operational** | Staff | The New Inmate Report used for business |
| **Engineering** | Admin / developers | Roster reconciliation, precision, recall, potential clients identified/missed, review count, processing time, PASS / FAIL |

If the engineering outcome fails, the operational report must be clearly marked **Provisional** until reviewed.

## Continuous learning

Every discrepancy becomes:

1. a tracked defect (Learning Queue);
2. a reproducible regression test;
3. a permanent improvement to NIIS.

No discrepancy is ever discarded.

## Daily Difference Viewer

Operator verification surface (does not change classification semantics):

| Color | Meaning |
|---|---|
| Green | New inmate |
| Blue | Returning inmate |
| Yellow | Changed booking (bail, housing, charges, etc.) |
| Gray | No change |
| Red | Review required |

Clicking a highlighted inmate explains the classification and links to supporting PDF evidence.

- UI: `/admin/intelligence/daily-difference`
- API: `GET /api/admin/intelligence/daily-difference`
- Evidence bytes: `GET /api/admin/intelligence/uploads/:uploadId/file`

## Long-term operational goal

NIIS is operationally mature when, over an extended period of consecutive Sacramento County daily comparisons, it consistently:

- identifies every newly booked inmate;
- produces no false new inmates;
- reconciles every roster;
- preserves complete evidence;
- provides timely reports for business operations.

Only then should the system become the sole source for daily new-inmate intelligence.

## Related

- [OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md](./OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md)
- [DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)
- [CONTINUOUS_OPERATIONAL_VALIDATION.md](./CONTINUOUS_OPERATIONAL_VALIDATION.md)
