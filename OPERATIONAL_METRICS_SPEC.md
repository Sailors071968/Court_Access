# CourtAccess — Operational Metrics Specification

## Overview

Every metric tracked by CourtAccess observability, including collection source, thresholds, alert conditions, and dashboard recommendations.

---

## Infrastructure KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `NODE_ENV` | `/api/health` | Every request | Must be `production` | `!= production` | System Overview |
| `process_uptime_seconds` | `/api/health` | 60s poll | N/A | Resets (indicates restart) | System Overview |
| `heap_used_mb` | `/api/health`, `/api/health/deep` | 60s poll | < 400MB | > 400MB warn, > 480MB critical | Memory Panel |
| `rss_mb` | `/api/health/deep` | 60s poll | < 1000MB | > 1000MB warn, > 1500MB critical | Memory Panel |
| `heap_percent` | `/api/health/deep` | 60s poll | < 75% | > 75% warn, > 90% critical | Memory Panel |
| `cpu_load_1m` | `/api/health` | 60s poll | < 2.0 (per core) | > 2.0 warn, > 4.0 critical | CPU Panel |
| `disk_use_percent` | `/api/health/deep` | 300s poll | < 85% | > 85% warn, > 95% critical | Disk Panel |
| `disk_available_mb` | `/api/health/deep` | 300s poll | > 2000MB | < 2000MB warn, < 500MB critical | Disk Panel |
| `pm2_restart_count` | `/api/health`, `pm2 show` | 60s poll | 0 change in 10min | Any increase | PM2 Panel |
| `pm2_status` | `pm2 status` | 60s poll | `online` | != `online` | PM2 Panel |

## Database KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `postgres_connectivity` | `/api/health/deep` | 60s poll | `healthy` | `unhealthy` or `degraded` | Database Panel |
| `postgres_query_latency_ms` | `/api/health/deep` | 60s poll | < 100ms | > 100ms warn, > 500ms critical | Database Panel |
| `postgres_connection_pool_active` | `/api/health/deep` | 60s poll | < pool_size | = pool_size (exhausted) | Database Panel |
| `prisma_errors_total` | Structured logs | Per event | 0 | Any non-zero | Database Panel |
| `prisma_reconnect_count` | Structured logs | Per event | 0 | > 0 in 10min window | Database Panel |

## Redis KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `redis_connectivity` | `/api/health/deep` | 60s poll | `healthy` or `disabled` | `unhealthy` (when expected) | Redis Panel |
| `redis_ping_latency_ms` | `/api/health/deep` | 60s poll | < 10ms | > 10ms warn, > 100ms critical | Redis Panel |
| `redis_used_memory_mb` | `/api/health/deep`, Redis INFO | 30s poll | < 80% of maxmemory | > 80% warn, > 95% critical | Redis Panel |
| `redis_connected_clients` | `/api/health/deep` | 60s poll | < 100 | > 100 warn | Redis Panel |
| `redis_tls_enabled` | `/api/health/deep` | On startup | `true` in production | `false` in production | Redis Panel |
| `redis_reconnect_count` | Structured logs | Per event | 0 | > 3 in 10min | Redis Panel |

## Security KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `auth_login_success_total` | `courtaccess_http_requests_total{path="/api/auth/login",status="200"}` | Per event | N/A | Spike detection | Security Panel |
| `auth_login_failure_total` | `courtaccess_http_requests_total{path="/api/auth/login",status="401"}` | Per event | < 10/min | > 10/min (brute force) | Security Panel |
| `auth_401_total` | `courtaccess_errors_total{category="auth_401"}` | Per event | Low/stable | Spike = token expiry wave or attack | Security Panel |
| `csrf_403_total` | `courtaccess_errors_total{category="csrf_403"}` | Per event | 0 (normal) | > 0 = CSRF attack attempt or misconfiguration | Security Panel |
| `rate_limit_429_total` | `courtaccess_errors_total{category="rate_limit"}` | Per event | Low/stable | Spike = DDoS or abuse | Security Panel |
| `csp_violations` | Report-URI or browser console | Per event | 0 | Any = CSP misconfiguration | Security Panel |
| `cors_rejected_total` | Structured logs (security) | Per event | Low/stable | Spike = attack or misconfiguration | Security Panel |

## Ingestion KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `ingestion_runs_total` | `/api/metrics/failures` | Per event | N/A | Informational | Ingestion Panel |
| `ingestion_failed_runs` | `/api/metrics/failures` | Per event | 0 | > 0 | Ingestion Panel |
| `ingestion_duration_ms` | `/api/metrics/failures` | Per event | < 30000ms | > 60000ms warn | Ingestion Panel |
| `ingestion_duplicates_detected` | `/api/metrics/failures` | Per event | Low/stable | Spike = data quality issue | Ingestion Panel |
| `ingestion_unmatched_rows` | `/api/metrics/failures` | Per event | 0 | > 0 per run = schema mismatch | Ingestion Panel |
| `ingestion_records_processed` | `/api/metrics/failures` | Per event | Consistent | Drop = source issue | Ingestion Panel |

## OCR KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `ocr_pages_processed` | `/api/metrics/failures` | Per event | N/A | Informational | OCR Panel |
| `ocr_failed_pages` | `/api/metrics/failures` | Per event | 0 | > 0 | OCR Panel |
| `ocr_average_confidence` | `/api/metrics/failures` | Per event | > 0.7 | < 0.7 warn, < 0.5 critical | OCR Panel |
| `ocr_low_confidence_count` | `/api/metrics/failures` | Per event | 0 | > 10% of total | OCR Panel |
| `ocr_duration_ms` | `/api/metrics/failures` | Per event | < 5000ms/page | > 10000ms/page warn | OCR Panel |
| `ocr_temp_storage_failures` | `/api/metrics/failures` | Per event | 0 | > 0 = critical | OCR Panel |
| `pdftoppm_installed` | `/api/health/deep` | On startup | `true` | `false` | OCR Panel |
| `imagemagick_installed` | `/api/health/deep` | On startup | `true` | `false` | OCR Panel |
| `tesseract_installed` | `/api/health/deep` | On startup | `true` | `false` | OCR Panel |

## Queue KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `queue_depth` | `courtaccess_queue_depth` | 30s poll | < 100 | > 100 warn, > 1000 critical | Queue Panel |
| `queue_active_jobs` | `courtaccess_queue_active` | 30s poll | < 10 | > 50 warn | Queue Panel |
| `queue_completed_total` | `courtaccess_queue_completed_total` | Per event | Increasing | Stalled = worker issue | Queue Panel |
| `queue_failed_total` | `courtaccess_queue_failed_total` | Per event | 0 | > 0 | Queue Panel |
| `queue_retry_storms` | `/api/metrics/failures` | Per event | 0 | > 0 = critical | Queue Panel |
| `queue_stuck_jobs` | `/api/metrics/failures` | Per event | 0 | > 0 | Queue Panel |
| `queue_dead_letter_count` | `/api/metrics/failures` | Per event | 0 | > 0 | Queue Panel |
| `worker_job_duration_ms` | `courtaccess_worker_job_duration_ms` | Per event | p95 < 30000ms | p95 > 60000ms warn | Queue Panel |

## Inmate Intelligence KPIs

| Metric | Source | Collection | Threshold | Alert Condition | Dashboard |
|--------|--------|------------|-----------|----------------|-----------|
| `identity_duplicates_suppressed` | `/api/metrics/failures` | Per event | Low/stable | Spike = data quality issue | Identity Panel |
| `identity_linkage_failures` | `/api/metrics/failures` | Per event | 0 | > 0 | Identity Panel |
| `identity_orphan_bookings` | `/api/metrics/failures` | Per event | 0 | > 0 | Identity Panel |
| `identity_match_attempts` | `/api/metrics/failures` | Per event | N/A | Informational | Identity Panel |

---

## Dashboard Recommendations

### System Overview Dashboard
- Panels: NODE_ENV, uptime, health status, PM2 restart count, CPU load, memory
- Refresh: 30s
- Alert: Any health degradation

### Database Dashboard
- Panels: Postgres connectivity, query latency (p50/p95/p99), connection pool, Prisma errors
- Refresh: 60s
- Alert: Connectivity loss, latency > 500ms

### Security Dashboard
- Panels: Login success/failure rates, 401/403/429 counts, CORS rejections, CSP violations
- Refresh: 30s
- Alert: Brute force detection (> 10 login failures/min), CSRF 403 spike

### Queue Dashboard
- Panels: Queue depths, active jobs, completed/failed rates, retry storms, dead-letter count
- Refresh: 30s
- Alert: Queue depth > 1000, retry storm, dead-letter entry

### Ingestion Dashboard
- Panels: Run history, success/failure rates, duration, duplicates, unmatched rows
- Refresh: 300s
- Alert: Failed run, unmatched rows > 0

### OCR Dashboard
- Panels: Pages processed, failure rate, confidence distribution, duration, tool availability
- Refresh: 300s
- Alert: Failure rate > 5%, confidence < 0.5, temp storage failure

### Identity Dashboard
- Panels: Match attempts, duplicates suppressed, linkage failures, orphan bookings
- Refresh: 300s
- Alert: Linkage failure, orphan booking

---

## Collection Endpoints Summary

| Endpoint | Data Type | Auth Required | Polling Interval |
|----------|-----------|---------------|-----------------|
| `GET /api/health` | Basic health + infra | No | 30-60s |
| `GET /api/health/deep` | Full dependency check | No | 60-300s |
| `GET /api/metrics` | Prometheus text format | No | 15-30s |
| `GET /api/metrics/json` | JSON metrics summary | No | 30-60s |
| `GET /api/metrics/failures` | Failure visibility report | No | 60-300s |
