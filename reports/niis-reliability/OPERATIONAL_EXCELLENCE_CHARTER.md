# CourtAccess NIIS – Operational Excellence Charter

**Effective immediately.**  
NIIS enters **permanent operational service** for Sacramento County.

The engineering mission is no longer to build features.  
The engineering mission is to **improve measurable operational performance**.

Every code change shall answer one question:

> Will this help us identify every newly booked Sacramento County inmate faster, more accurately, or with less human effort?

If the answer is no, **do not build it**.

This charter is subordinate to [OPERATIONAL_LOCK.md](./OPERATIONAL_LOCK.md) (Architecture COMPLETE · V1.0 FROZEN).

---

## Operational Priorities (fixed)

| Rank | Priority |
|---|---|
| 1 | Never miss a new inmate |
| 2 | Never report a false new inmate |
| 3 | Reduce human review |
| 4 | Reduce processing time |
| 5 | Improve operator workflow |

Nothing else outranks these priorities.

---

## Morning SLA (Service Level Agreement)

Every morning NIIS should satisfy a measurable operational target:

1. PDF accepted without errors  
2. Canonical roster generated  
3. Comparison completed  
4. New Inmate Report available  
5. Investigator Workspace ready  
6. Certified report printable  

**Target latency:** calibrated from real operational testing on production hardware — not aspiration.  
Configure measured target via `SAC_MORNING_SLA_MS` once observed (example placeholder often discussed: ~2 minutes after upload). Until calibrated, the dashboard reports measured elapsed time and marks the SLA target as **UNKNOWN / not calibrated**.

Morning Operations surfaces SLA checklist + elapsed time vs target.

---

## Operational Metrics (always on Morning Operations)

| Metric |
|---|
| Today's roster size |
| Yesterday's roster size |
| New inmates |
| Existing inmates |
| Returning inmates |
| Review required |
| Processing time |
| Certification status |
| Automatic Classification Rate |
| Operational Trust Score |
| Consecutive Certified Days |
| Open Critical Defects |

If any metric regresses, engineering investigates **before** adding features.

---

## Business Metrics

Aligned with how Sailors Bail Bonds generates business:

| Metric | Meaning |
|---|---|
| Potential New Clients Identified Today | Reportable new (and returning where applicable) opportunities |
| Potential Clients Missed | False negatives vs investigator ground truth |
| False Opportunities | False new inmates vs investigator ground truth |

Until ground truth is sealed for the day, missed / false may show **UNKNOWN** — never invent zeros.

---

## Engineering Rule

Every engineering sprint must begin by reviewing:

1. Yesterday's discrepancies  
2. Unresolved defects  
3. Certification results  
4. Replay regressions  

**Not** feature requests. Operational truth comes first.

---

## Version 1.0 Success

Version 1.0 is successful when a trained investigator says:

> "I trust NIIS enough that my morning work consists primarily of reviewing the few uncertain cases rather than manually comparing every inmate."

That does not eliminate human judgment — it makes the best use of it.

---

## Trust over sophistication

Stop trying to make NIIS smarter. Make it more **trustworthy**.

A system that is 100% explainable, 100% reproducible, and 100% aligned with preserved evidence is more valuable than one that is merely more sophisticated.

---

## Next major conversation (production operations)

The next major engineering conversation should focus on **running NIIS in production**, not NIIS architecture:

- Morning operational procedures  
- Backup and disaster recovery  
- Monitoring and alerting  
- Performance tuning  
- Production logging  
- Operator training  
- Release management  
- Incident response  
- Data retention  
- Business continuity  

See [PRODUCTION_OPERATIONS_INDEX.md](./PRODUCTION_OPERATIONS_INDEX.md).
