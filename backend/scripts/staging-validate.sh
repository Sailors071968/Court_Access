#!/usr/bin/env bash
# ============================================================================
# PR #65 — Staging Validation Script
#
# Run on staging server after:
#   git pull origin dev && npm install && npx prisma migrate deploy && pm2 restart all
#
# Produces a color-coded PASS/FAIL summary and saves a full report.
# Exit code: 0 = all automated checks pass, 1 = at least one failure.
#
# Usage:
#   chmod +x scripts/staging-validate.sh
#   ./scripts/staging-validate.sh [BASE_URL] [REPORT_DIR]
#
# Defaults:
#   BASE_URL   = http://localhost:3000
#   REPORT_DIR = ./reports
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL="${1:-http://localhost:3000}"
REPORT_DIR="${2:-./reports}"
REPORT_FILE="${REPORT_DIR}/staging-validation-report-$(date +%s).txt"
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

mkdir -p "$REPORT_DIR"
echo "============================================================================" | tee "$REPORT_FILE"
echo "Court Access — Staging Validation Report" | tee -a "$REPORT_FILE"
echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | tee -a "$REPORT_FILE"
echo "Base URL: $BASE_URL" | tee -a "$REPORT_FILE"
echo "============================================================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "${GREEN}  [PASS]${NC} $1" | tee -a "$REPORT_FILE"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "${RED}  [FAIL]${NC} $1" | tee -a "$REPORT_FILE"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "${YELLOW}  [WARN]${NC} $1" | tee -a "$REPORT_FILE"
}

info() {
  echo -e "${CYAN}  [INFO]${NC} $1" | tee -a "$REPORT_FILE"
}

section() {
  echo "" | tee -a "$REPORT_FILE"
  echo -e "${BOLD}--- $1 ---${NC}" | tee -a "$REPORT_FILE"
}

# ---------------------------------------------------------------------------
# Check 1: Boot & Schema Lock
# ---------------------------------------------------------------------------

section "1. Boot & Schema Lock"

# Check pm2 process status
if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null || echo "[]")
  PM2_ONLINE=$(echo "$PM2_STATUS" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log(d.filter(p => p.pm2_env.status === 'online').length);
  " 2>/dev/null || echo "0")

  if [ "$PM2_ONLINE" -gt 0 ]; then
    pass "pm2: $PM2_ONLINE process(es) online"
  else
    fail "pm2: no processes online"
  fi

  # Check for schema lock message in recent logs
  PM2_LOGS=$(pm2 logs --nostream --lines 200 2>/dev/null || echo "")
  if echo "$PM2_LOGS" | grep -q "Schema locked and matching"; then
    pass "Schema lock: confirmed in pm2 logs"
  else
    warn "Schema lock: 'Schema locked and matching' not found in recent pm2 logs (may have scrolled past)"
  fi

  # Check for drift or pending migration errors
  if echo "$PM2_LOGS" | grep -qi "drift\|pending migration"; then
    fail "Schema drift or pending migrations detected in pm2 logs"
  else
    pass "No schema drift or pending migration errors"
  fi
else
  warn "pm2 not installed — skipping process checks"
fi

# ---------------------------------------------------------------------------
# Check 2: Health Endpoints
# ---------------------------------------------------------------------------

section "2. Health & Observability Endpoints"

# Basic health
HEALTH_RESPONSE=$(curl -s -o /tmp/health.json -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
  pass "GET /api/health -> 200 OK"
  info "Response: $(cat /tmp/health.json 2>/dev/null | head -c 200)"
else
  fail "GET /api/health -> $HEALTH_RESPONSE (expected 200)"
fi

# Deep health
DEEP_RESPONSE=$(curl -s -o /tmp/health_deep.json -w "%{http_code}" "$BASE_URL/api/health/deep" 2>/dev/null || echo "000")
if [ "$DEEP_RESPONSE" = "200" ] || [ "$DEEP_RESPONSE" = "503" ]; then
  DEEP_STATUS=$(node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/health_deep.json','utf8')); console.log(d.status);" 2>/dev/null || echo "unknown")
  if [ "$DEEP_STATUS" = "healthy" ]; then
    pass "GET /api/health/deep -> healthy"
  elif [ "$DEEP_STATUS" = "degraded" ]; then
    warn "GET /api/health/deep -> degraded (acceptable for staging)"
  else
    fail "GET /api/health/deep -> $DEEP_STATUS"
  fi
  info "Full deep health: $(cat /tmp/health_deep.json 2>/dev/null | head -c 500)"
else
  fail "GET /api/health/deep -> $DEEP_RESPONSE (expected 200 or 503)"
fi

# Prometheus metrics
METRICS_RESPONSE=$(curl -s -o /tmp/metrics.txt -w "%{http_code}" "$BASE_URL/api/metrics" 2>/dev/null || echo "000")
if [ "$METRICS_RESPONSE" = "200" ]; then
  pass "GET /api/metrics -> 200 OK"

  # Check for new PR #65 counters
  if grep -q "courtaccess_worker_timeouts_total" /tmp/metrics.txt 2>/dev/null; then
    pass "Metrics: courtaccess_worker_timeouts_total counter registered"
  else
    fail "Metrics: courtaccess_worker_timeouts_total counter MISSING"
  fi

  if grep -q "courtaccess_worker_stalled_total" /tmp/metrics.txt 2>/dev/null; then
    pass "Metrics: courtaccess_worker_stalled_total counter registered"
  else
    fail "Metrics: courtaccess_worker_stalled_total counter MISSING"
  fi
else
  fail "GET /api/metrics -> $METRICS_RESPONSE (expected 200)"
fi

# JSON metrics
METRICS_JSON_RESPONSE=$(curl -s -o /tmp/metrics.json -w "%{http_code}" "$BASE_URL/api/metrics/json" 2>/dev/null || echo "000")
if [ "$METRICS_JSON_RESPONSE" = "200" ]; then
  pass "GET /api/metrics/json -> 200 OK"
  info "Metrics JSON snapshot saved to report"
  echo "--- metrics/json snapshot ---" >> "$REPORT_FILE"
  cat /tmp/metrics.json >> "$REPORT_FILE" 2>/dev/null
  echo "" >> "$REPORT_FILE"
  echo "--- end metrics ---" >> "$REPORT_FILE"
else
  fail "GET /api/metrics/json -> $METRICS_JSON_RESPONSE (expected 200)"
fi

# ---------------------------------------------------------------------------
# Check 3: Redis & Queue Health
# ---------------------------------------------------------------------------

section "3. Redis & Queue Health"

if command -v redis-cli &>/dev/null; then
  # Ping
  REDIS_PING=$(redis-cli ping 2>/dev/null || echo "FAIL")
  if [ "$REDIS_PING" = "PONG" ]; then
    pass "redis-cli ping -> PONG"
  else
    fail "redis-cli ping -> $REDIS_PING (expected PONG)"
  fi

  # Memory
  REDIS_MEM=$(redis-cli INFO memory 2>/dev/null || echo "")
  USED_MEMORY_HUMAN=$(echo "$REDIS_MEM" | grep "used_memory_human:" | cut -d: -f2 | tr -d '[:space:]' || echo "unknown")
  MAXMEMORY=$(echo "$REDIS_MEM" | grep "maxmemory:" | cut -d: -f2 | tr -d '[:space:]' || echo "0")
  USED_MEMORY=$(echo "$REDIS_MEM" | grep "used_memory:" | head -1 | cut -d: -f2 | tr -d '[:space:]' || echo "0")

  info "Redis memory: used=$USED_MEMORY_HUMAN"

  if [ "$MAXMEMORY" != "0" ] && [ "$MAXMEMORY" != "" ]; then
    # Calculate percentage
    MEM_PERCENT=$(node -e "console.log(Math.round(($USED_MEMORY / $MAXMEMORY) * 100))" 2>/dev/null || echo "0")
    if [ "$MEM_PERCENT" -gt 95 ]; then
      fail "Redis memory usage: ${MEM_PERCENT}% (>95% CRITICAL)"
    elif [ "$MEM_PERCENT" -gt 80 ]; then
      warn "Redis memory usage: ${MEM_PERCENT}% (>80% WARNING)"
    else
      pass "Redis memory usage: ${MEM_PERCENT}% (<80%)"
    fi
  else
    info "Redis maxmemory not set — cannot calculate percentage"
  fi

  # Queue depths (waiting)
  QUEUE_KEYS=$(redis-cli KEYS "bull:*:wait" 2>/dev/null || echo "")
  TOTAL_WAITING=0
  if [ -n "$QUEUE_KEYS" ]; then
    while IFS= read -r key; do
      if [ -n "$key" ]; then
        DEPTH=$(redis-cli LLEN "$key" 2>/dev/null || echo "0")
        TOTAL_WAITING=$((TOTAL_WAITING + DEPTH))
        if [ "$DEPTH" -gt 0 ]; then
          info "Queue $key: $DEPTH waiting"
        fi
      fi
    done <<< "$QUEUE_KEYS"
  fi

  if [ "$TOTAL_WAITING" -lt 100 ]; then
    pass "Queue backlog: $TOTAL_WAITING total waiting jobs (<100 threshold)"
  else
    warn "Queue backlog: $TOTAL_WAITING total waiting jobs (>=100)"
  fi

  # Failed jobs
  FAILED_KEYS=$(redis-cli KEYS "bull:*:failed" 2>/dev/null || echo "")
  TOTAL_FAILED=0
  if [ -n "$FAILED_KEYS" ]; then
    while IFS= read -r key; do
      if [ -n "$key" ]; then
        FCOUNT=$(redis-cli LLEN "$key" 2>/dev/null || echo "0")
        TOTAL_FAILED=$((TOTAL_FAILED + FCOUNT))
        if [ "$FCOUNT" -gt 0 ]; then
          warn "Failed queue $key: $FCOUNT jobs"
        fi
      fi
    done <<< "$FAILED_KEYS"
  fi

  if [ "$TOTAL_FAILED" -eq 0 ]; then
    pass "No failed jobs in queues"
  else
    warn "Total failed jobs across queues: $TOTAL_FAILED (inspect with redis-cli)"
  fi

  # DLQ
  DLQ_DEPTH=$(redis-cli LLEN "bull:court-access:dead-letter:waiting" 2>/dev/null || echo "0")
  if [ "$DLQ_DEPTH" -eq 0 ]; then
    pass "Dead Letter Queue: empty"
  else
    warn "Dead Letter Queue: $DLQ_DEPTH entries — inspect for payload/context"
    info "Sample DLQ entry: $(redis-cli LRANGE 'bull:court-access:dead-letter:waiting' 0 0 2>/dev/null | head -c 500)"
  fi
else
  warn "redis-cli not found — skipping Redis checks"
fi

# ---------------------------------------------------------------------------
# Check 4: Neo4j Integrity Audit (PR 62)
# ---------------------------------------------------------------------------

section "4. Neo4j Graph Integrity Audit"

# Try running via the companion Node script
if [ -f "scripts/staging-checks.js" ] || [ -f "scripts/staging-checks.mjs" ]; then
  NEO4J_RESULT=$(node --import tsx scripts/staging-checks.mjs neo4j-audit 2>/dev/null || echo "SKIP")
  if [ "$NEO4J_RESULT" = "SKIP" ]; then
    warn "Neo4j audit script failed — check NEO4J_URI env var"
  else
    echo "$NEO4J_RESULT" | tee -a "$REPORT_FILE"
    if echo "$NEO4J_RESULT" | grep -q "FAIL"; then
      fail "Neo4j integrity audit reported failures"
    else
      pass "Neo4j integrity audit passed"
    fi
  fi
else
  # Fallback: try cypher-shell if available
  if command -v cypher-shell &>/dev/null && [ -n "${NEO4J_URI:-}" ]; then
    ORPHANS=$(cypher-shell -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-}" \
      "MATCH (n) WHERE NOT (n)--() AND n.tenantId IS NOT NULL RETURN count(n) AS total" 2>/dev/null | tail -1 || echo "-1")
    CROSS_TENANT=$(cypher-shell -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-}" \
      "MATCH (s)-[r]->(t) WHERE s.tenantId IS NOT NULL AND t.tenantId IS NOT NULL AND s.tenantId <> t.tenantId RETURN count(r) AS total" 2>/dev/null | tail -1 || echo "-1")
    MISSING_TID=$(cypher-shell -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-}" \
      "MATCH (n) WHERE n.tenantId IS NULL RETURN count(n) AS total" 2>/dev/null | tail -1 || echo "-1")

    if [ "$ORPHANS" = "0" ] && [ "$CROSS_TENANT" = "0" ] && [ "$MISSING_TID" = "0" ]; then
      pass "Neo4j: orphans=0, crossTenant=0, missingTenantId=0"
    else
      fail "Neo4j: orphans=$ORPHANS, crossTenant=$CROSS_TENANT, missingTenantId=$MISSING_TID"
    fi
  else
    warn "Neo4j audit skipped — neither cypher-shell nor staging-checks.mjs available"
    info "To run manually: node --import tsx scripts/staging-checks.mjs neo4j-audit"
  fi
fi

# ---------------------------------------------------------------------------
# Check 5: Database Counts (ProcessingJob, Evidence, TimelineEvent)
# ---------------------------------------------------------------------------

section "5. Database Counts Snapshot"

if command -v npx &>/dev/null; then
  # Use Prisma to get counts
  DB_COUNTS=$(node --import tsx -e "
    import prisma from './src/lib/prisma.js';
    async function main() {
      const [pjTotal, pjActive, pjCompleted, pjFailed, evCount, teCount] = await Promise.all([
        prisma.processingJob.count(),
        prisma.processingJob.count({ where: { status: 'active' } }),
        prisma.processingJob.count({ where: { status: 'completed' } }),
        prisma.processingJob.count({ where: { status: 'failed' } }),
        prisma.evidence.count(),
        prisma.timelineEvent.count(),
      ]);
      console.log(JSON.stringify({ pjTotal, pjActive, pjCompleted, pjFailed, evCount, teCount }));
      await prisma.\$disconnect();
    }
    main().catch(e => { console.log(JSON.stringify({ error: e.message })); process.exit(0); });
  " 2>/dev/null || echo '{"error":"prisma query failed"}')

  if echo "$DB_COUNTS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(d.error) process.exit(1);" 2>/dev/null; then
    info "DB Counts: $DB_COUNTS"

    # Check for stuck active jobs
    ACTIVE_COUNT=$(echo "$DB_COUNTS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.pjActive);" 2>/dev/null || echo "0")
    if [ "$ACTIVE_COUNT" -gt 10 ]; then
      warn "ProcessingJobs stuck in 'active': $ACTIVE_COUNT (may indicate stalled workers)"
    else
      pass "No excessive active ProcessingJobs ($ACTIVE_COUNT)"
    fi

    # Check for duplicate ProcessingJobs with JOB_TIMEOUT
    TIMEOUT_JOBS=$(node --import tsx -e "
      import prisma from './src/lib/prisma.js';
      const count = await prisma.processingJob.count({ where: { failureCode: 'JOB_TIMEOUT' } });
      console.log(count);
      await prisma.\$disconnect();
    " 2>/dev/null || echo "0")
    info "ProcessingJobs with JOB_TIMEOUT failureCode: $TIMEOUT_JOBS"
  else
    warn "Database count query failed — check DATABASE_URL"
  fi
else
  warn "npx not found — skipping database counts"
fi

# ---------------------------------------------------------------------------
# Check 6: Stall Rate & Timeout Metrics
# ---------------------------------------------------------------------------

section "6. Stall Rate & Timeout Metrics (PR #65)"

if [ -f /tmp/metrics.json ]; then
  # Parse stall and timeout counts from JSON metrics
  STALL_TOTAL=$(node -e "
    const d = JSON.parse(require('fs').readFileSync('/tmp/metrics.json','utf8'));
    const m = d['courtaccess_worker_stalled_total'];
    if (!m || !m.values) { console.log(0); process.exit(0); }
    const total = Object.values(m.values).reduce((a,b) => a+b, 0);
    console.log(total);
  " 2>/dev/null || echo "0")

  TIMEOUT_TOTAL=$(node -e "
    const d = JSON.parse(require('fs').readFileSync('/tmp/metrics.json','utf8'));
    const m = d['courtaccess_worker_timeouts_total'];
    if (!m || !m.values) { console.log(0); process.exit(0); }
    const total = Object.values(m.values).reduce((a,b) => a+b, 0);
    console.log(total);
  " 2>/dev/null || echo "0")

  info "Stalled jobs total: $STALL_TOTAL"
  info "Timed out jobs total: $TIMEOUT_TOTAL"

  if [ "$STALL_TOTAL" -gt 0 ]; then
    warn "Stalled jobs detected ($STALL_TOTAL) — check worker health"
  else
    pass "No stalled jobs"
  fi

  if [ "$TIMEOUT_TOTAL" -gt 0 ]; then
    info "Timeout count: $TIMEOUT_TOTAL (expected 0 on normal cases, >0 only during timeout simulation)"
  else
    pass "No job timeouts"
  fi
else
  warn "Metrics JSON not available — skipping stall/timeout analysis"
fi

# ---------------------------------------------------------------------------
# Manual Test Steps (Printed for Human)
# ---------------------------------------------------------------------------

section "7. MANUAL TEST STEPS (Human Required)"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BOLD}The following steps require manual execution:${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

cat <<'MANUAL' | tee -a "$REPORT_FILE"
  Step A: Upload Small Case (1-3 PDFs)
  ─────────────────────────────────────
  1. Upload via browser or API
  2. Monitor: pm2 monit → no OOM, memory stable
  3. Monitor: pm2 logs | grep -E "timeout|stalled|DLQ|UnrecoverableError|duplicate|orphaned"
  4. After completion: verify DB counts (facts/chunks/nodes match expected)
  5. Run graph audit: curl localhost:3000/api/health/deep

  Step B: Upload Medium Case (10-20 docs)
  ────────────────────────────────────────
  1. Upload via browser or API
  2. Same monitoring as Step A
  3. Verify queues drain: redis-cli LLEN bull:*:waiting → <100

  Step C: Upload Large Proxy Case (20GB homicide equivalent)
  ───────────────────────────────────────────────────────────
  1. Upload via API (staggered if multiple attorneys)
  2. Monitor sustained: pm2 monit → CPU/memory no spikes >80%
  3. redis-cli monitor | grep -E "add|completed|failed|stalled|timeout"
  4. After completion: full DB + graph audit
  5. Metrics snapshot: curl localhost:3000/api/metrics/json > post-large-case-metrics.json

  Step D: Force Timeout Simulation
  ─────────────────────────────────
  1. Temporarily add artificial delay in one worker (e.g., await new Promise(r => setTimeout(r, 600000)))
  2. Enqueue a job for that worker
  3. Verify after 5 min:
     - Job fails with UnrecoverableError (no retry)
     - ProcessingJob.failureCode = 'JOB_TIMEOUT'
     - No duplicate facts/graph entries created
     - DLQ entry has full snapshot (userId, caseId, memory state)
  4. Remove artificial delay, restart workers

  Step E: Stalled Job Simulation
  ──────────────────────────────
  1. Set stalledInterval: 5000 temporarily
  2. Pause Redis briefly during job execution (redis-cli DEBUG SLEEP 10)
  3. Verify:
     - Stalled event fires (pm2 logs | grep "stalled")
     - Job retried up to maxStalledCount (2)
     - If still stalled → failed → moved to DLQ
     - courtaccess_worker_stalled_total counter incremented

MANUAL

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

section "SUMMARY"

TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo "" | tee -a "$REPORT_FILE"
echo -e "${GREEN}  PASS: $PASS_COUNT${NC}" | tee -a "$REPORT_FILE"
echo -e "${RED}  FAIL: $FAIL_COUNT${NC}" | tee -a "$REPORT_FILE"
echo -e "${YELLOW}  WARN: $WARN_COUNT${NC}" | tee -a "$REPORT_FILE"
echo "  Total checks: $TOTAL" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}${BOLD}  VERDICT: FAIL — $FAIL_COUNT check(s) failed. Do NOT proceed to S3 migration.${NC}" | tee -a "$REPORT_FILE"
  echo "" | tee -a "$REPORT_FILE"
  echo "Full report saved to: $REPORT_FILE"
  exit 1
else
  echo -e "${GREEN}${BOLD}  VERDICT: AUTOMATED CHECKS PASS — Proceed to manual steps (A-E) above.${NC}" | tee -a "$REPORT_FILE"
  echo "" | tee -a "$REPORT_FILE"
  echo "After manual steps pass → Phase 1 PASS → Ready for S3 PR" | tee -a "$REPORT_FILE"
  echo "" | tee -a "$REPORT_FILE"
  echo "Full report saved to: $REPORT_FILE"
  exit 0
fi
