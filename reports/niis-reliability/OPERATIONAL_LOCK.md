# CourtAccess NIIS – Operational Lock

**Architecture Phase: COMPLETE**  
**Version 1.0 Design: FROZEN**

No additional architectural directives will be accepted unless required to correct a **verified operational defect**.

Beginning immediately, engineering success shall be measured **only by operational performance**.

---

## Primary Objective

Every morning, identify **100%** of the newly booked Sacramento County inmates by comparing today's official jail roster against yesterday's certified roster.

Nothing else has higher priority.

## Operational Success Criteria

The only metrics that matter are:

| Metric | Target |
|---|---|
| Recall | 100% |
| Precision | 100% |
| Reconciliation | 100% |
| Silent failures | Zero |
| Human review | Minimal (unnecessary review eliminated) |
| Speed | Fast enough to support morning business operations |

## Daily Engineering Loop

Repeat every operational day:

1. Upload today's Sacramento County PDF  
2. Generate the proposed New Inmate Report  
3. Review only exceptions (highest-uncertainty first)  
4. Compare against investigator ground truth  
5. Fix every discrepancy  
6. Add the discrepancy to the permanent certification corpus  
7. Seal the evidence package  
8. Repeat tomorrow  

## Engineering Priority

Engineering time shall be allocated according to **measured defects** — not speculation.

- Fix the largest source of operational error first  
- Do not redesign working components  

## Release Policy

- No release shall be approved because it compiles  
- No release shall be approved because unit tests pass  
- A release is approved **only** after replaying the entire Sacramento certification corpus with:  
  - Zero missed new inmates  
  - Zero false new inmates  
  - Zero regressions  

```bash
cd backend && npm run cert:release -- --version X.Y.Z --changelog ../reports/niis-reliability/INTENTIONAL_CHANGES.md
```

## Expansion Policy

No expansion beyond Sacramento County until Version 1.0 demonstrates **sustained operational success**.

Future expansion shall be driven by demonstrated reliability, not feature completeness.

Feature work (watch lists, SMS, court enrichment, geographic intelligence, cross-county, predictive analytics) remains gated until **30 consecutive certified days** — see [REDUCE_HUMAN_REVIEW.md](./REDUCE_HUMAN_REVIEW.md).

## Operator mode

At this point, the primary role is **operator**, not architect:

- Upload the PDF each morning  
- Compare results in Investigator Workspace  
- Let the evidence show where NIIS needs improvement  

## Milestone

NIIS evolved from a roster parser into an evidence-governed operational intelligence system with deterministic processing, provenance, certification, replay, and a structured path for continuous improvement.

The remaining challenge is **operational excellence**: proving, day after day, that NIIS can match or exceed the investigator’s manual process for finding every newly booked Sacramento County inmate each morning.

---

**Related (frozen / subordinate):**  
[ENGINEERING_LAW_0.md](./ENGINEERING_LAW_0.md) · [NIIS_V1_ENGINEERING_CONTRACT.md](./NIIS_V1_ENGINEERING_CONTRACT.md) · [REDUCE_HUMAN_REVIEW.md](./REDUCE_HUMAN_REVIEW.md) · [DAILY_OPERATIONAL_LOOP.md](./DAILY_OPERATIONAL_LOOP.md)
