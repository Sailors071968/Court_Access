# NIIS V1.1 — Immediate Engineering Posture

**Sealed with:** `NIIS_V1_1_CONTINUOUS_INTELLIGENCE_DIRECTIVE.md`  
**Superseded by:** `NIIS_MASTER_ENGINEERING_DIRECTIVE_V2.md` (governing) — sequencing below still applies  
**Date:** 2026-08-14  

## What changed

Product mission expands from morning roster comparison alone to:

1. **Mode 1** — Daily Certification (permanent record)  
2. **Mode 2** — Continuous Booking Intelligence (live discoveries)  
3. Plus: Event Repository, Daily Intelligence Case, dual classification, Opportunity Timeline, etc.

## What did not change

| Rule | Still binding |
|---|---|
| Zero Fabrication | Yes |
| Release requires production verification | Yes |
| PDF Level-1 authority for NEW | Yes |
| Do not mix open production incidents | Yes |

## What we will not do today

- Implement Mode 2, Event Engine, Opportunity Timeline, or charge BI while **INC-001A** is open  
- Debug `uploadedBytes=0` on commit `b52e9aad` (wrong build)  
- Treat this directive as permission to skip deployment verification  

## Ordered work

```text
INC-001A  Prove production runs fix SHA (host/API deploy; existing GH website workflow cannot)
    ↓
INC-001   Real Sacramento PDF · closure Tests · evidence package · RESOLVED
    ↓
INC-002   CSV queue drain
    ↓
V1.1 Mode 1 metrics on live certified path
    ↓
V1.1 Mode 2 + Daily Intelligence Case + Opportunity Timeline
```

Until Section 3 of a Deployment Verification Report shows the expected API commit, **Release Engineering remains the active discipline.**
