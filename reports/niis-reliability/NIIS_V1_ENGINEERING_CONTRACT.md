# CourtAccess NIIS Version 1.0 Engineering Contract

> **Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.**  
> Supreme law: [ENGINEERING_LAW_0.md](./ENGINEERING_LAW_0.md).

## Mission Statement

The mission of NIIS is singular and non-negotiable:

**Every morning, accurately identify every inmate who appears on today's Sacramento County Active Inmate Roster but did not appear on yesterday's certified roster.**

Every engineering decision shall improve one or more of:

1. Accuracy  
2. Explainability  
3. Determinism  
4. Reliability  
5. Speed  

No engineering effort shall reduce any of those qualities.

## Definition of Done (Version 1.0)

NIIS Version 1.0 is complete only when all of the following are true:

### Accuracy

- 100% Recall (no missed new inmates)  
- 100% Precision (no false new inmates)  
- 100% Roster Reconciliation  
- Zero silent failures  

### Evidence

Every report entry traces back to: Original PDF · Page · Record · Parser version · Identity rule · Classification rule.

### Determinism

Given identical PDFs, identical software version, and identical configuration, NIIS shall produce identical output.

## Subsystem contracts

| Contract | Guarantee |
|---|---|
| **Parser** | PDF → canonical roster. Every inmate once. Every page processed. Validation completed. **No comparison.** |
| **Canonical Roster** | Single source of truth for that day’s list. Downstream never reads the PDF directly. |
| **Identity / Classification** | Exactly one of: NEW · EXISTING · RETURNING · REVIEW. No other class. |
| **Comparison** | NEW + EXISTING + RETURNING + REVIEW = TOTAL TODAY. Fail → stop certification. |
| **Certification** | PASS only when reconciliation succeeds, evidence exists, no silent failures, all mandatory stages succeeded. Else PROVISIONAL or FAIL. |
| **Release** | No promotion unless every certified evidence package, regression case, replay, and reconciliation passes. One regression = failed release. |

## Permanent Regression Rule

Every defect fixed becomes:

1. one regression test  
2. one replay case  
3. one certification case  

The system becomes stronger every morning.

## Operational Health (heartbeat)

Not CPU / RAM / Redis / PM2 — **operational** health:

Today’s roster · Yesterday · New · Existing · Returning · Review · Reconciliation · Precision · Recall · Certification · Processing time · Potential clients.

Surface: `/admin/intelligence/operational-health`

## Investigator Review Workspace (V1.0 feature)

Distinct from the identity Review Queue. Built around morning manual comparison:

| Area | Content |
|---|---|
| Left | Yesterday’s roster entry |
| Right | Today’s roster entry |
| Bottom | Historical bookings |
| Panel | Why NIIS reached its conclusion |
| Actions | Confirm NEW / EXISTING / RETURNING · Send to REVIEW · Mark Parser / Identity / OCR / Comparison Error |

One click. No typing. Every click feeds the learning / certification corpus.

Surface: `/admin/intelligence/investigator-workspace`

## Path to trust

Architecture is complete enough that new architectural directives have diminishing returns.

Next improvements come from: real Sacramento PDFs each morning → compare to manual results → fix discrepancies → grow the certification corpus day by day.

That is when NIIS becomes a trusted business asset — backed by verified evidence, not design intentions.
