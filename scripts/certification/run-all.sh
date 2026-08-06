#!/usr/bin/env bash
# Full certification run against a freshly migrated database.
#
# Provisions a clean database, boots the API and the SPA, executes every suite
# in order, and produces the master report. Intended to be reproducible: the
# only inputs are the repository and a local PostgreSQL and Redis.

set -uo pipefail

ROOT=/workspace
BACKEND="$ROOT/backend"
DB=${CERT_DB:-courtaccess_cert}
TMUX="tmux -f /exec-daemon/tmux.portal.conf"

echo "=== provisioning a clean database: $DB ==="
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB;" >/dev/null
sudo -u postgres psql -c "CREATE DATABASE $DB OWNER courtaccess;" >/dev/null

export DATABASE_URL="postgresql://courtaccess:courtaccess@127.0.0.1:5432/$DB?schema=public"
cd "$BACKEND"
npx prisma migrate deploy 2>&1 | tail -2

echo
echo "=== drift check: migrations vs schema.prisma ==="
DRIFT=$(npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script 2>&1)
if echo "$DRIFT" | grep -q "empty migration"; then
  echo "no drift"
else
  echo "DRIFT DETECTED:"
  echo "$DRIFT" | head -30
fi

echo
echo "=== starting the API ==="
$TMUX kill-session -t courtaccess-api 2>/dev/null
$TMUX new-session -d -s courtaccess-api -c "$BACKEND" -- bash -lc \
  "set -a; . ./.env.certification; set +a; \
   export DATABASE_URL='$DATABASE_URL'; \
   export RATE_LIMIT_REGISTER_PER_MINUTE=5000 RATE_LIMIT_GENERAL_PER_MINUTE=100000 \
          RATE_LIMIT_LOGIN_PER_MINUTE=5000 RATE_LIMIT_UPLOAD_PER_MINUTE=100000 \
          RATE_LIMIT_COMPLIANCE_PER_MINUTE=10000; \
   npx tsx src/server.ts 2>&1 | tee /tmp/backend-run.log"

for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://127.0.0.1:3001/api/health && break
  sleep 1
done
curl -sf -o /dev/null http://127.0.0.1:3001/api/health || { echo "API did not start"; exit 1; }
echo "API healthy"

echo
echo "=== building and serving the SPA ==="
cd "$ROOT"
npm run build >/tmp/fe-build.log 2>&1 || { echo "frontend build failed"; tail -20 /tmp/fe-build.log; }
$TMUX kill-session -t cert-web 2>/dev/null
$TMUX new-session -d -s cert-web -c "$ROOT" -- bash -lc \
  "node scripts/certification/lib/staticServer.mjs 2>&1 | tee /tmp/cert-web.log"
sleep 3
curl -sf -o /dev/null http://127.0.0.1:4180/ && echo "SPA healthy"

echo
echo "=== generating fixtures ==="
python3 scripts/certification/fixtures/generate_fixtures.py
python3 scripts/certification/fixtures/generate_failure_fixtures.py

run() {
  echo
  echo "=============================================================="
  echo "  $1"
  echo "=============================================================="
  node "scripts/certification/$2" 2>&1 | tail -"${3:-20}"
}

run "Phase 1 — feature inventory"                01-feature-inventory.mjs 8
run "Phase 7 — unauthenticated exposure sweep"   02-auth-exposure-sweep.mjs 12
run "Phase 3/4/5 — ingestion and failure modes"  03-ingestion-certification.mjs 8
run "Phase 2 — authenticated read surface"       10-read-surface-certification.mjs 12
run "P144 — anti-fabrication audit"              11-fabrication-audit.mjs 10
run "P144 — case-scoped tenant isolation"        12-case-scoped-isolation.mjs 10
run "P144 — evidence traceability"               13-traceability-certification.mjs 14
run "P144 — CALCRIM / mens rea / investigation"  14-intelligence-certification.mjs 18
run "P144 — defendant and family access"         15-portal-permissions-certification.mjs 16
run "Phase 2/8 — litigation workflow"            05-workflow-certification.mjs 8

# Security runs against product-default login and general limits so that the
# throttling result means something. Only registration and upload are raised.
echo
echo "=============================================================="
echo "  Phase 7 — security (product-default rate limits)"
echo "=============================================================="
$TMUX kill-session -t courtaccess-api 2>/dev/null
$TMUX new-session -d -s courtaccess-api -c "$BACKEND" -- bash -lc \
  "set -a; . ./.env.certification; set +a; \
   export DATABASE_URL='$DATABASE_URL'; \
   export RATE_LIMIT_REGISTER_PER_MINUTE=500 RATE_LIMIT_UPLOAD_PER_MINUTE=500; \
   npx tsx src/server.ts 2>&1 | tee /tmp/backend-run.log"
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3001/api/health && break; sleep 1; done
node scripts/certification/04-security-certification.mjs 2>&1 | tail -8

# Back to raised limits for the load-oriented suites.
$TMUX kill-session -t courtaccess-api 2>/dev/null
$TMUX new-session -d -s courtaccess-api -c "$BACKEND" -- bash -lc \
  "set -a; . ./.env.certification; set +a; \
   export DATABASE_URL='$DATABASE_URL'; \
   export RATE_LIMIT_REGISTER_PER_MINUTE=5000 RATE_LIMIT_GENERAL_PER_MINUTE=100000 \
          RATE_LIMIT_LOGIN_PER_MINUTE=5000 RATE_LIMIT_UPLOAD_PER_MINUTE=100000 \
          RATE_LIMIT_COMPLIANCE_PER_MINUTE=10000; \
   npx tsx src/server.ts 2>&1 | tee /tmp/backend-run.log"
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3001/api/health && break; sleep 1; done

run "Phase 6/11 — stress and performance"        06-stress-certification.mjs 18
run "Phase 9 — browser verification"             08-browser-certification.mjs 8
run "Phase 10 — recovery"                        07-recovery-certification.mjs 18

echo
echo "=============================================================="
echo "  Phase 12 — master certification report"
echo "=============================================================="
node scripts/certification/09-master-report.mjs 2>&1 | tail -40
