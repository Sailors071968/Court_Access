# COURTACCESS NIIS — Primary Engineering Directive

> CourtAccess NIIS is an evidence-governed criminal intelligence system. It does not guess. It does not fabricate. It does not infer facts without evidence. Every conclusion must be traceable to preserved evidence and reproducible by independent verification. The only acceptable measure of success is sustained agreement with verified investigator ground truth.

**This document supersedes every previous architectural directive** for *what* NIIS must discover.  
How claims are proven: [ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md](./ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md).

The entire purpose of NIIS is to accurately discover every newly booked inmate appearing on today's Sacramento County jail roster.

Nothing has greater engineering priority. Not UI. Not APIs. Not reports. Not dashboards. Not watchlists.

Everything exists only to support accurate daily new inmate discovery.

## Business objective

> The value of NIIS is measured solely by its ability to identify every newly arrested Sacramento County inmate each morning before anyone else. Every engineering decision shall improve the accuracy, explainability, reliability, or speed of that mission. Any feature that does not directly support that mission has lower priority.

## Success criteria

Every morning the software shall answer one question:

**Who is on today's jail roster that was not on yesterday's roster?**

The answer must be identical to what an experienced investigator would determine by manually comparing the two rosters.

**The investigator is always the gold standard.**  
Whenever the software disagrees with the investigator, the software is wrong until proven otherwise.

The gold standard is the investigator’s **full verified classification** for that day
(NEW / EXISTING / RETURNING / REVIEW) — not a historical NEW count. NIIS certifies
**evidence**, not software. See [EVIDENCE_CERTIFICATION_DIRECTIVE.md](./EVIDENCE_CERTIFICATION_DIRECTIVE.md).

## Processing pipeline (never varies)

```
Yesterday PDF
    ↓
Today's PDF
    ↓
Extract every inmate          ← parser only; no comparison while parsing
    ↓
Normalize
    ↓
Identity Resolution
    ↓
Roster Comparison             ← against yesterday's CERTIFIED SNAPSHOT
    ↓
Exception Review
    ↓
Certification
    ↓
New Inmate Report
    ↓
Repository Update
    ↓
Optional CSV Enrichment
```

No other workflow should exist.

Treat the Sheriff's PDF as a **deterministic dataset** (sorted Active Inmate Basic Roster), not a free-form document:

1. Build a **canonical roster object** first  
2. Only then compare, certify, and report  

## Classification (exactly one)

| Class | Rule |
|---|---|
| **NEW** | Present today · Absent yesterday · No prior active-roster match · No unresolved conflicts · Confidence above threshold |
| **RETURNING** | Historically known · Not active yesterday · Active today · Prior booking exists |
| **EXISTING** | Present yesterday · Present today · Identity confirmed |
| **REVIEW** | Uncertain only (unreadable name, duplicate XREF, missing DOB, low OCR confidence, conflicting identity). Never silently guess. |

Reconciliation (mandatory):

```
NEW + EXISTING + RETURNING + REVIEW = TOTAL EXTRACTED
```

## Certified snapshot baseline

Never compare against raw PDFs for the prior day.  
Compare against yesterday's **immutable certified roster snapshot**.

## Production readiness

NIIS is production-ready only after:

- 10 consecutive daily roster comparisons  
- 0 missed new inmates  
- 0 false new inmates  
- 0 reconciliation failures  
- 100% agreement with the investigator's manual comparison  

## Speed targets (after accuracy)

Accuracy always takes precedence. Once accuracy is achieved: entire morning workflow under 2 minutes.

## Implementation map

| Step | Code |
|---|---|
| Canonical roster | `backend/src/intelligence/inmates/canonicalRoster.ts` |
| Parse validation | `backend/src/intelligence/inmates/parseValidation.ts` |
| Certified snapshots | `backend/src/intelligence/inmates/rosterSnapshot.ts` + Prisma `InmateRosterSnapshot` |
| Comparison | `backend/src/intelligence/inmates/rosterComparison.ts` |
| Learning Queue | `backend/src/intelligence/inmates/learningQueue.ts` |

| Sacramento Certification Corpus | `fixtures/sacramento/certification-corpus/` |
| Release certification | `backend/scripts/release-certification.ts` (`npm run cert:release`) |
| Evidence ledger | `backend/src/intelligence/inmates/evidenceLedger.ts` |
| Defect categories | `backend/src/intelligence/inmates/defectCategories.ts` |

| Daily Evidence Packages | `fixtures/sacramento/evidence-packages/` + `evidencePackage.ts` |
| Forensic Mode | `forensicMode.ts` (`NIIS_FORENSIC_MODE=1`) |
| Rebuild from evidence | `npm run cert:rebuild` |

Related (subordinate): `IMMUTABLE_EVIDENCE_OPERATIONAL_TRUTH_DIRECTIVE.md`, `EVIDENCE_CERTIFICATION_DIRECTIVE.md`, `ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md`, `ACCURACY_FIRST.md`, `DAILY_INTELLIGENCE_OPERATIONS_DIRECTIVE.md`, `OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md`.
