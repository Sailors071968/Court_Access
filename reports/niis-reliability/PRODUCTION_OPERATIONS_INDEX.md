# NIIS — Production Operations (next major conversation)

Architecture and Version 1.0 design are frozen ([OPERATIONAL_LOCK.md](./OPERATIONAL_LOCK.md)).  
Operational priorities are fixed ([OPERATIONAL_EXCELLENCE_CHARTER.md](./OPERATIONAL_EXCELLENCE_CHARTER.md)).

The next major conversation should not redesign NIIS. It should define how NIIS is **run in production**.

## Agenda (operator + infrastructure)

| Topic | Outcome needed |
|---|---|
| Morning operational procedures | Step-by-step runbook from PDF upload → certified print |
| Backup and disaster recovery | RPO/RTO, restore drill evidence, evidence-package recovery |
| Monitoring and alerting | Page on silent-failure risk, SLA miss, cert fail — not vanity infra |
| Performance tuning | Measure Morning SLA on production hardware; set `SAC_MORNING_SLA_MS` |
| Production logging | Provenance-preserving logs; no PII leakage; replay support |
| Operator training | Investigator Workspace + exception-only review |
| Release management | `cert:release` corpus replay gate only |
| Incident response | Missed new / false new / reconcile fail playbooks |
| Data retention | Roster PDFs, evidence packages, certifications, learning queue |
| Business continuity | How Sailors Bail Bonds runs the morning if NIIS is down |

## Related existing material

- Program 21 production operations tests / dashboard (infra) — complementary, not a substitute for Sacramento operational truth  
- [DAILY_OPERATIONAL_LOOP.md](./DAILY_OPERATIONAL_LOOP.md)  
- [REDUCE_HUMAN_REVIEW.md](./REDUCE_HUMAN_REVIEW.md)  
- Release: `cd backend && npm run cert:release`

## Rule

Production-ops work that does not improve Priority 1–5 (miss / false / review / time / workflow) waits behind measured operational defects.
