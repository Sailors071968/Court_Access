# Reduce Human Review — Final Engineering Objective

> Architecture phase complete. Optimize the morning flow and shrink unnecessary review while preserving correctness.

## Morning workflow (effortless)

```
Morning Dashboard
    ↓
Upload Today's Sacramento PDF
    ↓
NIIS automatically compares with yesterday
    ↓
NIIS presents proposed NEW inmates
    ↓
Investigator Workspace (highest-uncertainty first)
    ↓
Review any exceptions
    ↓
Print Certified New Inmate Report
    ↓
Begin business
```

Nothing else should interrupt that flow.

## Progression (expectation)

| Horizon | NEW (example) | REVIEW | Time |
|---|---:|---:|---:|
| Week 1 | 67 | 12 | ~20 min |
| Month 2 | 71 | 4 | ~8 min |
| Month 6 | 64 | 0 | ~2 min |

Goal: eliminate **unnecessary** review, not oversight. Correctness is never sacrificed.

## Automatic Classification Rate

Prominently displayed on Morning Dashboard and Operational Health:

```
Automatic Classification Rate — Today  99.6%
Automatically Certified                1,486
Human Review                           6
Corrected                              1
```

That number measures how close NIIS is to a highly trusted operational assistant.

## Daily operational goals (at a glance)

1. Was today's PDF processed?  
2. How many inmates were extracted?  
3. How many are new?  
4. How many require review?  
5. Is the report certified?  
6. How long did it take?  
7. Are there any critical alerts?  

## Manual Compare Assistant

Instead of only “67 NEW”, NIIS also says:

> These are the 4 inmates I am least confident about. Please review these first.

Investigator Workspace ranks candidates by **uncertainty**. If the first few are correct, confidence in the remainder rises.

## Feature gate — after 30 consecutive certified days

Only after a sustained run of perfect agreement with investigator review may new feature work begin:

- Watch lists  
- SMS notifications  
- Court enrichment  
- Geographic intelligence  
- Cross-county expansion  
- Predictive analytics  

**Not before.** Env: `SAC_FEATURE_WORK_STREAK_REQUIRED` (default **30**).

## Daily cycle (trust path)

1. Upload today’s Sacramento County PDF  
2. Let NIIS produce proposed classifications  
3. Review highest-uncertainty cases first  
4. Certify the report  
5. Capture every discrepancy  
6. Add it to the certification corpus  
7. Repeat tomorrow  
