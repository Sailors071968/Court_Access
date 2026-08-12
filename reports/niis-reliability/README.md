# NIIS — Continuous Operational Validation

> **Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.**  
> Everything else is secondary.

**OPERATIONAL LOCK — Architecture COMPLETE · V1.0 Design FROZEN**  
→ [OPERATIONAL_LOCK.md](./OPERATIONAL_LOCK.md) — success = operational performance only; no new architecture unless fixing a verified defect.

**Supreme law:** [ENGINEERING_LAW_0.md](./ENGINEERING_LAW_0.md) — The System Must Never Lie.  
**V1.0 contract:** [NIIS_V1_ENGINEERING_CONTRACT.md](./NIIS_V1_ENGINEERING_CONTRACT.md).  
**Reduce human review:** [REDUCE_HUMAN_REVIEW.md](./REDUCE_HUMAN_REVIEW.md).  
**Daily loop:** [DAILY_OPERATIONAL_LOOP.md](./DAILY_OPERATIONAL_LOOP.md).  
**Surfaces:** Investigator Workspace · Operational Health · Morning Operations

**One job:** the exact list of every newly booked Sacramento inmate, every morning.  
**Architecture mature.** Grow the certification corpus through daily operational agreement — not more design.

→ **[ENGINEERING_LAW_0.md](./ENGINEERING_LAW_0.md)** — supersedes every directive  
→ **[PRIMARY_ENGINEERING_DIRECTIVE.md](./PRIMARY_ENGINEERING_DIRECTIVE.md)** — **what** NIIS must discover  
→ **[ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md](./ZERO_ASSUMPTION_ENGINEERING_DIRECTIVE.md)** — **how** claims are proven  
→ **[EVIDENCE_CERTIFICATION_DIRECTIVE.md](./EVIDENCE_CERTIFICATION_DIRECTIVE.md)** / **[IMMUTABLE_EVIDENCE_OPERATIONAL_TRUTH_DIRECTIVE.md](./IMMUTABLE_EVIDENCE_OPERATIONAL_TRUTH_DIRECTIVE.md)**  
→ **[ACCURACY_FIRST.md](./ACCURACY_FIRST.md)** — Phase B deferred until manual-list match  
→ **[DAILY_INTELLIGENCE_OPERATIONS_DIRECTIVE.md](./DAILY_INTELLIGENCE_OPERATIONS_DIRECTIVE.md)** — subordinate  
→ **[OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md](./OPERATIONAL_EXCELLENCE_DIRECTIVE_V1.md)** — subordinate  

**Morning command center:** `/admin/intelligence` → `GET /api/admin/intelligence/morning-board`  
**Daily Difference Viewer:** `/admin/intelligence/daily-difference`

## Gold standard

Investigator verified classification for **each** roster date (NEW / EXISTING / RETURNING / REVIEW).  
A historical NEW count (e.g. 67 on 2026-08-10) is a consequence of that day’s evidence — not a permanent target.

## Two morning reports

| Report | Audience | Artifact |
|---|---|---|
| **Operational** (revenue) | Staff | New Inmate Intelligence Report |
| **Engineering Certification** | Admin / developers | [ENGINEERING_CERTIFICATION_REPORT.md](./ENGINEERING_CERTIFICATION_REPORT.md) |

Plus [DAILY_CERTIFICATION_SUMMARY.md](./DAILY_CERTIFICATION_SUMMARY.md) and Learning Queue (`GET /api/admin/intelligence/learning-queue`).

### Business metrics (required)

- **Potential New Clients Found**  
- **Potential New Clients Missed**

## Every morning after manual compare

```bash
cd backend
npx tsx scripts/record-daily-ground-truth.ts --date YYYY-MM-DD --gold /path/to/manual-list.md
```

## Historical suite (when PDFs available)

```bash
cd backend
SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
```

## Production readiness

**10 consecutive PASS days** (zero misses, zero false news, zero reconcile failures) — not a single benchmark day.

## Continuous regression

Verified days accumulate under `fixtures/sacramento/validation/days/`.