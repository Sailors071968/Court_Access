# Release Certification — 0.0.0-immutable

> NIIS certifies evidence, not software. Gold standard = investigator classification per day — not a fixed number.
> Promotion requires: replay every certified package, 0 missed, 0 false new, 0 unexplained regressions, and documented intentional changes.

```
Release Certification — Sacramento Certification Corpus replay

Test Dataset:        3 corpus entries (0 runnable)
Roster Date:         0.0.0-immutable

Manual Ground Truth: UNKNOWN New Inmates
NIIS Result:         UNKNOWN New Inmates
False Positives:     UNKNOWN
False Negatives:     UNKNOWN
Precision:           UNKNOWN
Recall:              UNKNOWN

Status:              UNKNOWN
```

## Promotion gate

| Requirement | Result |
|---|---|
| Corpus replay CERTIFIED | NO |
| Missed new inmates = 0 | UNKNOWN |
| False new = 0 | UNKNOWN |
| Unexplained regressions = 0 | YES |
| Intentional changes documented (--changelog) | YES |
| **Promotion allowed** | **NO** |

## Intentional behavioral changes

```
# Intentional Behavioral Changes — Release X.Y.Z

> Required for release promotion (`npm run cert:release -- --changelog …`).
> Document every deliberate behavior delta. Unexplained regressions fail the release.

## Summary

- (none | list intentional changes)

## Changes

| Area | Before | After | Why | Evidence package / day affected |
|---|---|---|---|---|
| | | | | |

## Confirmations

- [ ] Every certified evidence package was replayed
- [ ] Missed new inmates = 0
- [ ] False new = 0
- [ ] Unexplained regressions = 0
- [ ] This document lists every intentional behavioral change

## Author

- Name:
- Date:

```

## Replay summary

| Metric | Value |
|---|---:|
| Corpus entries | 3 |
| Runnable (verified+) | 0 |
| Certified | 0 |
| Failed | 0 |
| Blocked | 0 |
| Skipped (pending) | 3 |
| Missed inmates | UNKNOWN |
| False new | UNKNOWN |
| Regression | 0 |
| **Status** | **BLOCKED** |

## Per-pair results

| Pair | Status | Manual NEW | NIIS NEW | Missed | False new | Detail |
|---|---|---:|---:|---:|---:|---|
| 2026-08-09__2026-08-10 | SKIPPED | — | — | 0 | 0 | status=pending_pdfs — not yet verified; skipped for release gate |
| 2026-08-10__2026-08-11 | SKIPPED | — | — | 0 | 0 | status=pending_pdfs — not yet verified; skipped for release gate |
| 2026-08-11__2026-08-12 | SKIPPED | — | — | 0 | 0 | status=pending_pdfs — not yet verified; skipped for release gate |

## Why BLOCKED

No verified corpus pairs have durable PDFs + investigator classification available in this environment.
Preserve Sacramento County roster PDFs and record full manual classifications before a release can be CERTIFIED.
Also seal Daily Evidence Packages (`fixtures/sacramento/evidence-packages/`) for rebuildability.

Generated: 2026-08-12T15:37:45.469Z
