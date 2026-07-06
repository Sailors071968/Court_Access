# Program 21 — Production Operations Dashboard

**Generated:** 2026-07-04T22:00:20.683Z
**Overall Status:** unhealthy
**Deployment Blocked:** YES

## Component Health

| Component | Status | Message |
|-----------|--------|---------|
| System | healthy | uptime=0s env=development |
| API | healthy | errorRate=0.00% p95=0ms |
| Database | healthy |  |
| Redis | healthy | memory 2MB / ∞MB (0%) |
| Queues | healthy | 0 waiting, 0 failed |
| OCR Workers | healthy | EVIDENCE_INGEST waiting=0 failed=0 |
| AI Workers | healthy | AI_ANALYSIS waiting=0 failed=0 |
| Legislative Pipeline | healthy | parsed=4 offenses=2 |
| Knowledge Graph | healthy | offenses=2 elements=4 |
| Repository Integrity | healthy | integrity=PASS |
| Stripe | unhealthy | integrity=FAIL webhooks24h=0 |
| Email | degraded | emailSync=NOT_IMPLEMENTED |
| Storage | degraded | R2 not configured |

## Active Alerts

- **[critical]** stripe: Stripe billing integrity FAIL
- **[warning]** email: Billing email delivery not fully configured

## Observability

- Production gates coverage: 93%
- Legislative coverage: 3%
- Attorney workflow coverage: 77%