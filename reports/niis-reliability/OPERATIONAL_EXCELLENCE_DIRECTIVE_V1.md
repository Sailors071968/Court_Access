# CourtAccess NIIS – Operational Excellence Directive (Version 1.0)

**Effective immediately.** NIIS is no longer a feature-development project.  
NIIS is a **mission-critical operational system**.

## Primary mission

Identify every newly booked Sacramento County Jail inmate each morning before business operations begin.

Everything else is subordinate to that objective.

## Primary business objective

The daily **New Inmate Report** is the product. Everything else exists to support production of that report.

Revenue depends upon:

1. never missing a newly booked inmate;
2. never reporting a non-new inmate as new;
3. producing the report quickly enough to act on it.

## Development priority order

| Priority | Focus |
|---|---|
| 1 | Operational correctness |
| 2 | Operational reliability |
| 3 | Operational speed |
| 4 | Operator experience |
| 5 | Additional intelligence capabilities |

No new capabilities shall delay or compromise Priorities 1–3.

Architecture remains frozen for Phase-2 features (watch lists as product surfaces, external APIs, investigative tooling expansions) until production certification. The **Morning Operations Dashboard** is an approved Priority-4 exception because it accelerates the daily cycle without changing detection semantics.

## Daily operational cycle

Every operational day shall proceed as follows:

1. Upload yesterday's PDF (if not already present).
2. Upload today's PDF.
3. Generate the New Inmate Report immediately.
4. Preserve all evidence and audit information.
5. Present the report to the operator.
6. Operator performs manual verification.
7. Operator records discrepancies.
8. NIIS produces an Engineering Certification Report.

Every discrepancy becomes an engineering defect.  
The defect remains open until NIIS reproduces the operator's verified result.

## Daily operational metrics

### Business metrics

- Total inmates on previous roster
- Total inmates on current roster
- Newly booked inmates
- Returning inmates
- Existing inmates
- Potential new clients identified
- Potential new clients missed
- Time to completed report

### Engineering metrics

- Precision
- Recall
- False positives
- False negatives
- Parser accuracy
- Identity accuracy
- Report accuracy
- Total processing time
- Reconciliation status

## Engineering rule

No discrepancy is ever discarded. Every discrepancy becomes:

- a documented defect (Learning Queue);
- a reproducible test case;
- a permanent regression test.

NIIS shall continuously improve through operational feedback.

## Production certification

NIIS shall be considered operationally certified only after:

- 10 consecutive Sacramento County daily comparisons;
- 100% precision;
- 100% recall;
- zero unexplained reconciliation failures;
- zero silent processing failures.

Only then may NIIS become the primary operational system.

## Morning Operations Dashboard

When an operator logs in each morning, `/admin/intelligence` answers these questions at a glance (&lt;10 seconds):

1. Was today's PDF uploaded?
2. Has yesterday's roster been identified?
3. Has comparison completed?
4. How many new inmates were found?
5. How many require manual review?
6. Is today's report certified or provisional?
7. Can I print the report now?

API: `GET /api/admin/intelligence/morning-board`

## Long-term vision

NIIS is not a PDF comparison program.  
NIIS is not a CSV import utility.  
NIIS is not an OCR project.

NIIS is a **criminal booking intelligence platform** whose first responsibility is to identify every newly booked Sacramento County inmate each morning. Every future capability—historical booking intelligence, watch lists, investigative tools, notifications, and analytics—will be built upon a foundation that has already demonstrated sustained operational accuracy.

## Related artifacts

- [CONTINUOUS_OPERATIONAL_VALIDATION.md](./CONTINUOUS_OPERATIONAL_VALIDATION.md)
- [DAILY_PDF_PRIMARY_WORKFLOW.md](./DAILY_PDF_PRIMARY_WORKFLOW.md)
- [NIIS_ACCURACY_CERTIFICATION.md](./NIIS_ACCURACY_CERTIFICATION.md)
- [OPERATIONAL_VALIDATION_MODE.md](./OPERATIONAL_VALIDATION_MODE.md)
