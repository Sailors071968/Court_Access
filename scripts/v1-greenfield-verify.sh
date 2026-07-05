#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Greenfield Verification (parallel install)
# Verifies /var/www/courtaccess-v1 without affecting production
# ==============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/var/www/courtaccess-v1}"
API_PORT="${API_PORT:-3101}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
V1_URL="${V1_URL:-http://127.0.0.1:${FRONTEND_PORT}}"
PM2_APP_NAME="${PM2_APP_NAME:-courtaccess-v1}"
PRODUCTION_URL="${PRODUCTION_URL:-https://courtaccess.net}"

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS: ${name}"
    PASS=$((PASS + 1))
  else
    echo "FAIL: ${name}"
    FAIL=$((FAIL + 1))
  fi
}

skip() {
  echo "SKIP: $1"
  SKIP=$((SKIP + 1))
}

echo "================================================================"
echo " CourtAccess V1 Greenfield Verification"
echo " INSTALL_DIR: ${INSTALL_DIR}"
echo " V1_URL:      ${V1_URL}"
echo " PRODUCTION:  ${PRODUCTION_URL} (must remain untouched)"
echo "================================================================"
echo ""

# --- Production isolation ---
PROD_HTML="$(curl -fsS "${PRODUCTION_URL}/" 2>/dev/null || true)"
if echo "${PROD_HTML}" | grep -q "Court Access System"; then
  skip "production still on legacy build (expected during parallel test)"
elif echo "${PROD_HTML}" | grep -q "Criminal Case Intelligence Platform"; then
  check "production already on new build" true
else
  skip "production landing unclassified"
fi

# --- Git / install manifest ---
check "install directory exists" test -d "${INSTALL_DIR}"
check "git repository present" test -d "${INSTALL_DIR}/.git"
check "on dev branch" test "$(cd "${INSTALL_DIR}" && git branch --show-current)" = "dev"
check "ecosystem.v1.config.cjs exists" test -f "${INSTALL_DIR}/ecosystem.v1.config.cjs"
check "V1 manifest exists" test -f "${INSTALL_DIR}/V1_INSTALL_MANIFEST.json"
check "backend .env exists" test -f "${INSTALL_DIR}/backend/.env"

DEPLOYED_SHA="$(cd "${INSTALL_DIR}" && git rev-parse HEAD)"
DEPLOYED_SHORT="$(cd "${INSTALL_DIR}" && git rev-parse --short HEAD)"
echo "INFO: git commit ${DEPLOYED_SHA}"

# --- Frontend ---
HTML="$(curl -fsS "${V1_URL}/" 2>/dev/null || true)"
check "v1 frontend HTTP 200" curl -fsS -o /dev/null "${V1_URL}/"
check "v1 landing title branding" grep -q "Criminal Case Intelligence Platform" <<< "${HTML}"
check "v1 build stamp present" grep -q "CourtAccess build:" <<< "${HTML}"
check "v1 stale title absent" ! grep -q "Court Access System" <<< "${HTML}"
check "dist/index.html on disk" test -f "${INSTALL_DIR}/dist/index.html"
check "dist branding on disk" grep -q "Criminal Case Intelligence Platform" "${INSTALL_DIR}/dist/index.html"

# --- Public routes (SPA shell) ---
for ROUTE in / /login /register /pricing /features /onboarding; do
  CODE="$(curl -o /dev/null -s -w '%{http_code}' "${V1_URL}${ROUTE}")"
  check "route ${ROUTE} → ${CODE}" test "${CODE}" = "200"
done

# --- Dashboard routes (SPA shell — auth required for data) ---
for ROUTE in /dashboard /client-portal /admin /admin/operations; do
  CODE="$(curl -o /dev/null -s -w '%{http_code}' "${V1_URL}${ROUTE}")"
  check "dashboard route ${ROUTE} → ${CODE}" test "${CODE}" = "200"
done

# Verify route files exist in repository build
check "AttorneyWorkbenchPage in repo" test -f "${INSTALL_DIR}/src/pages/case/AttorneyWorkbenchPage.tsx"
check "InvestigatorWorkbenchPage in repo" test -f "${INSTALL_DIR}/src/pages/case/InvestigatorWorkbenchPage.tsx"
check "ClientPortalPages in repo" test -f "${INSTALL_DIR}/src/pages/client-portal/ClientPortalPages.tsx"
check "OperationsCommandCenter in repo" test -f "${INSTALL_DIR}/src/pages/admin/OperationsCommandCenter.tsx"
check "StaffDashboard in repo" test -f "${INSTALL_DIR}/src/pages/dashboard/StaffDashboard.tsx"

# --- Backend / API ---
HEALTH="$(curl -fsS "${V1_URL}/api/health" 2>/dev/null || true)"
check "v1 API health reachable" test -n "${HEALTH}"
check "v1 API status ok" grep -q '"status":"ok"' <<< "${HEALTH}"
check "v1 API version 1.1.0" grep -q '"version":"1.1.0"' <<< "${HEALTH}"
check "v1 API service field" grep -q '"service":"court-access-backend"' <<< "${HEALTH}"
check "v1 /api/health/deep" curl -fsS "${V1_URL}/api/health/deep" >/dev/null 2>&1

DIRECT_HEALTH="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || true)"
check "direct API port ${API_PORT}" grep -q '"status":"ok"' <<< "${DIRECT_HEALTH}"

# --- Authentication endpoints exist ---
AUTH_CODE="$(curl -o /dev/null -s -w '%{http_code}' -X POST "${V1_URL}/api/auth/login" -H 'Content-Type: application/json' -d '{}')"
check "auth login endpoint responds" test "${AUTH_CODE}" = "400" -o "${AUTH_CODE}" = "401" -o "${AUTH_CODE}" = "422"

REG_CODE="$(curl -o /dev/null -s -w '%{http_code}' -X POST "${V1_URL}/api/auth/register" -H 'Content-Type: application/json' -d '{}')"
check "auth register endpoint responds" test "${REG_CODE}" = "400" -o "${REG_CODE}" = "422"

# --- Database ---
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
  cd "${INSTALL_DIR}/backend"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  MIGRATE_OUT="$(npm run db:migrate:status 2>&1 || true)"
  if echo "${MIGRATE_OUT}" | grep -qiE 'Database schema is up to date|No pending migrations'; then
    check "database migrations current" true
  else
    check "database migrations current" false
    echo "       ${MIGRATE_OUT}" | head -5
  fi
else
  skip "database migration check (.env missing)"
fi

# --- Stripe ---
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${INSTALL_DIR}/backend/.env"
  set +a
  if [[ -n "${STRIPE_SECRET_KEY:-}" && "${STRIPE_SECRET_KEY}" != *"REPLACE"* ]]; then
    if (cd "${INSTALL_DIR}/backend" && npm run billing:readiness >/dev/null 2>&1); then
      check "stripe billing:readiness" true
    else
      check "stripe billing:readiness" false
    fi
  else
    skip "stripe billing:readiness (STRIPE_SECRET_KEY not configured)"
  fi
else
  skip "stripe check (.env missing)"
fi

# --- PM2 ---
check "pm2 app exists" pm2 jlist | grep -q "\"name\":\"${PM2_APP_NAME}\""
check "pm2 app online" pm2 describe "${PM2_APP_NAME}" 2>/dev/null | grep -q online

# --- Nginx ---
check "nginx config valid" sudo nginx -t >/dev/null 2>&1
check "nginx listening on ${FRONTEND_PORT}" ss -tlnp 2>/dev/null | grep -q ":${FRONTEND_PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${FRONTEND_PORT} "

# --- Port isolation (production API should remain on 3001 if running) ---
if ss -tlnp 2>/dev/null | grep -q ':3001 '; then
  skip "port 3001 in use (legacy API may still be running — expected)"
fi
check "v1 API on port ${API_PORT}" ss -tlnp 2>/dev/null | grep -q ":${API_PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${API_PORT} "

echo ""
echo "================================================================"
echo " VERIFICATION SUMMARY"
echo "================================================================"
echo "Git commit:  ${DEPLOYED_SHA}"
echo "Git short:   ${DEPLOYED_SHORT}"
echo "V1 URL:      ${V1_URL}"
echo "PASS:        ${PASS}"
echo "FAIL:        ${FAIL}"
echo "SKIP:        ${SKIP}"
echo "================================================================"

if [[ "${FAIL}" -gt 0 ]]; then
  echo "RESULT: FAIL"
  exit 1
fi

echo "RESULT: PASS — ready for cutover planning"
exit 0
