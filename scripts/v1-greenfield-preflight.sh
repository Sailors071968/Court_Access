#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Greenfield Preflight (Phase 0, read-only)
# Run on production EC2 from a /tmp origin/dev clone — NEVER git checkout/pull
# inside /var/www/courtaccess.
# Usage: bash scripts/v1-greenfield-preflight.sh [--json /path/report.json]
# ==============================================================================
set -uo pipefail

REPORT_JSON=""
[[ "${1:-}" == "--json" && -n "${2:-}" ]] && REPORT_JSON="$2"

PASS=0
WARN=0
FAIL=0
BLOCKERS=()
RESULTS=()

pass() { echo "PASS: $*"; PASS=$((PASS + 1)); RESULTS+=("PASS|$*"); }
warn() { echo "WARN: $*"; WARN=$((WARN + 1)); RESULTS+=("WARN|$*"); }
fail() { echo "FAIL: $*"; FAIL=$((FAIL + 1)); BLOCKERS+=("$*"); RESULTS+=("FAIL|$*"); }

PROTECTED_PROD_DIR="${PROTECTED_PROD_DIR:-/var/www/courtaccess}"
V1_DIR="${V1_DIR:-/var/www/courtaccess-v1}"
V1_DB_NAME="${V1_DB_NAME:-courtaccess_v1}"
V1_API_PORT="${V1_API_PORT:-3101}"
V1_FRONTEND_PORT="${V1_FRONTEND_PORT:-8080}"
LEGACY_API_PORT="${LEGACY_API_PORT:-3001}"
PRODUCTION_URL="${PRODUCTION_URL:-https://courtaccess.net}"
GIT_REMOTE="${GIT_REMOTE:-https://github.com/Sailors071968/Court_Access.git}"
GIT_BRANCH="${GIT_BRANCH:-dev}"

# Minimum versions (not exact pins — WARN if below)
MIN_NODE_MAJOR=20
MIN_NPM_MAJOR=9

# ── Dynamic discovery ─────────────────────────────────────────────────────────
discover_repos() {
  PROD_DIR=""
  LEGACY_REPO=""
  CANDIDATES=()
  for base in /var/www /opt; do
    [[ -d "$base" ]] || continue
    while IFS= read -r d; do
      CANDIDATES+=("$d")
    done < <(find "$base" -maxdepth 2 -type d -name '.git' 2>/dev/null | sed 's|/.git$||')
  done
  for d in "${CANDIDATES[@]}"; do
  case "$(basename "$d")" in
    courtaccess)
      [[ -z "$PROD_DIR" ]] && PROD_DIR="$d"
      ;;
    courtaccess_repo)
      LEGACY_REPO="$d"
      ;;
    courtaccess-v1)
      [[ "$d" != "$V1_DIR" ]] && V1_DIR="$d"
      ;;
  esac
  done
  PROD_DIR="${PROD_DIR:-/var/www/courtaccess}"
  LEGACY_REPO="${LEGACY_REPO:-/var/www/courtaccess_repo}"
}

verify_origin_scripts() {
  local tmp repo
  tmp="$(mktemp -d)"
  repo="${tmp}/courtaccess-scripts"
  if git clone --depth 1 --branch "$GIT_BRANCH" "$GIT_REMOTE" "$repo" >/dev/null 2>&1; then
    for f in scripts/v1-greenfield-install.sh scripts/v1-greenfield-verify.sh scripts/v1-greenfield-preflight.sh scripts/v1-production-cutover.sh; do
      [[ -f "${repo}/${f}" ]] && pass "origin/${GIT_BRANCH} contains ${f}" || fail "origin/${GIT_BRANCH} missing ${f}"
    done
    rm -rf "$tmp"
    return 0
  fi
  rm -rf "$tmp"
  fail "Cannot shallow-clone origin/${GIT_BRANCH} to verify deployment scripts"
}

discover_env_file() {
  ENV_FILE=""
  local candidates=(
    "${PROD_DIR}/backend/.env"
    "${PROD_DIR}/.env"
    "/var/www/courtaccess/backend/.env"
    "/opt/courtaccess/backend/.env"
  )
  for c in "${candidates[@]}"; do
    if [[ -f "$c" ]]; then
      ENV_FILE="$c"
      return 0
    fi
  done
  # Last resort: search one level under prod
  if [[ -d "$PROD_DIR" ]]; then
    local found
    found="$(find "$PROD_DIR" -maxdepth 3 -name '.env' -type f 2>/dev/null | head -1)"
    [[ -n "$found" ]] && ENV_FILE="$found"
  fi
}

env_key_found() {
  local key="$1" required="${2:-yes}"
  [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]] || { fail "${key}: .env not located"; return 1; }
  local line val
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 || true)"
  if [[ -z "$line" ]]; then
    [[ "$required" == "yes" ]] && fail "${key}: NOT FOUND" || warn "${key}: NOT FOUND"
    return 1
  fi
  val="$(echo "$line" | sed -E 's/^[^=]+=//; s/^["'\'']//; s/["'\'']$//')"
  if [[ -z "$val" || "$val" == *"REPLACE"* || "$val" == *"CHANGE_ME"* ]]; then
    [[ "$required" == "yes" ]] && fail "${key}: placeholder or empty" || warn "${key}: placeholder or empty"
    return 1
  fi
  pass "${key}: FOUND"
  return 0
}

port_check() {
  local port="$1" label="$2" expect="${3:-any}"
  local line proc=""
  if command -v ss >/dev/null 2>&1; then
    line="$(ss -tlnp 2>/dev/null | grep -E ":${port} " || true)"
  elif command -v netstat >/dev/null 2>&1; then
    line="$(netstat -tlnp 2>/dev/null | grep -E ":${port} " || true)"
  fi
  if [[ -n "$line" ]]; then
    proc="$(echo "$line" | sed -n 's/.*users:((\"\([^\"]*\)\".*/\1/p' | head -1)"
    [[ -z "$proc" ]] && proc="$(echo "$line" | awk '{print $NF}' | head -1)"
    if [[ "$expect" == "free" ]]; then
      fail "Port ${port} (${label}): IN USE — ${proc:-unknown}"
    else
      pass "Port ${port} (${label}): IN USE — ${proc:-unknown}"
    fi
  else
    if [[ "$expect" == "inuse" ]]; then
      fail "Port ${port} (${label}): FREE (expected in use)"
    else
      pass "Port ${port} (${label}): FREE"
    fi
  fi
}

write_json_report() {
  [[ -z "$REPORT_JSON" ]] && return 0
  local ts blockers_json="" i=0
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  blockers_json="["
  for b in "${BLOCKERS[@]}"; do
    [[ $i -gt 0 ]] && blockers_json+=","
    blockers_json+="\"$(echo "$b" | sed 's/"/\\"/g')\""
    i=$((i + 1))
  done
  blockers_json+="]"
  local readiness="FAIL"
  [[ "$FAIL" -eq 0 ]] && readiness="PASS"
  [[ "$FAIL" -eq 0 && "$WARN" -gt 0 ]] && readiness="WARN"
  cat >"$REPORT_JSON" <<EOF
{
  "program": "GREENFIELD-PREFLIGHT",
  "generatedAt": "${ts}",
  "host": "$(hostname 2>/dev/null || echo unknown)",
  "user": "$(whoami 2>/dev/null || echo unknown)",
  "prodDir": "${PROD_DIR}",
  "legacyRepo": "${LEGACY_REPO}",
  "v1Dir": "${V1_DIR}",
  "envFile": "${ENV_FILE:-}",
  "originDevSha": "${REMOTE_DEV_SHA:-}",
  "pass": ${PASS},
  "warn": ${WARN},
  "fail": ${FAIL},
  "readiness": "${readiness}",
  "blockers": ${blockers_json}
}
EOF
  echo "Report written: ${REPORT_JSON}"
}

# ==============================================================================
discover_repos
discover_env_file

echo "=============================================================================="
echo " CourtAccess V1 Greenfield Preflight (read-only)"
echo " Time:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo " User:     $(whoami)  CWD: $(pwd)"
echo " PROD:     ${PROD_DIR}"
echo " LEGACY:   ${LEGACY_REPO}"
echo " V1:       ${V1_DIR}"
echo " ENV:      ${ENV_FILE:-NOT FOUND}"
echo "=============================================================================="
echo ""

# ── 0.1 Runtime ───────────────────────────────────────────────────────────────
echo "── Runtime ──"
[[ -r /etc/os-release ]] && pass "OS: $(. /etc/os-release && echo "${PRETTY_NAME}")" || warn "OS release file unreadable"

if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v | sed 's/^v//')"
  NODE_MAJOR="${NODE_V%%.*}"
  if [[ "$NODE_MAJOR" -ge "$MIN_NODE_MAJOR" ]]; then
    pass "Node.js v${NODE_V}"
  else
    fail "Node.js v${NODE_V} (minimum major ${MIN_NODE_MAJOR})"
  fi
else
  fail "Node.js not installed"
fi

if command -v npm >/dev/null 2>&1; then
  NPM_V="$(npm -v)"
  NPM_MAJOR="${NPM_V%%.*}"
  [[ "$NPM_MAJOR" -ge "$MIN_NPM_MAJOR" ]] && pass "npm ${NPM_V}" || warn "npm ${NPM_V} (recommended >= ${MIN_NPM_MAJOR})"
else
  fail "npm not installed"
fi

command -v pm2 >/dev/null 2>&1 && pass "PM2 $(pm2 -v 2>/dev/null | head -1)" || fail "PM2 not installed"
command -v nginx >/dev/null 2>&1 && pass "Nginx $(nginx -v 2>&1 | sed -n 's/.*nginx\/\([^ ]*\).*/\1/p')" || fail "nginx not installed"
command -v git >/dev/null 2>&1 && pass "Git $(git --version | awk '{print $3}')" || fail "git not installed"
command -v curl >/dev/null 2>&1 && pass "curl available" || warn "curl not found"
command -v psql >/dev/null 2>&1 && pass "psql client available" || fail "psql client not found"
echo ""

# ── 0.2 Repository layout ─────────────────────────────────────────────────────
echo "── Repository Layout ──"
[[ -d "$PROD_DIR" ]] && pass "Production dir: ${PROD_DIR}" || fail "Production dir missing: ${PROD_DIR}"
[[ -d "${PROD_DIR}/.git" ]] && pass "Production is git repo" || fail "Production is not a git repo"
[[ -d "$LEGACY_REPO" ]] && pass "Legacy recovery repo: ${LEGACY_REPO}" || warn "Legacy recovery repo missing: ${LEGACY_REPO}"

if [[ -e "$V1_DIR" ]]; then
  warn "V1 path exists: ${V1_DIR}"
else
  pass "V1 path available (not yet created): ${V1_DIR}"
fi

if [[ -d "${PROD_DIR}/.git" ]]; then
  PROD_BRANCH="$(git -C "$PROD_DIR" branch --show-current 2>/dev/null || echo unknown)"
  PROD_SHA="$(git -C "$PROD_DIR" rev-parse HEAD 2>/dev/null || true)"
  pass "Production branch (frozen): ${PROD_BRANCH}"
  pass "Production commit (frozen): ${PROD_SHA:-unknown}"
  pass "Production repo git state recorded — preflight does not modify it"
  if [[ "$PROD_BRANCH" == "$GIT_BRANCH" ]]; then
    warn "Production repo is on ${GIT_BRANCH} — greenfield still must not run git pull/checkout on ${PROD_DIR}"
  else
    pass "Production repo is not on ${GIT_BRANCH} (expected for frozen production)"
  fi
fi

# Scripts are verified from origin/dev clone — NOT required in production checkout
verify_origin_scripts
echo ""

# ── 0.8 GitHub ───────────────────────────────────────────────────────────────
echo "── GitHub / origin/dev ──"
REMOTE_DEV_SHA="$(git ls-remote "$GIT_REMOTE" "refs/heads/${GIT_BRANCH}" 2>/dev/null | awk '{print $1}')"
[[ -n "$REMOTE_DEV_SHA" ]] && pass "origin/${GIT_BRANCH} reachable: ${REMOTE_DEV_SHA}" || fail "Cannot reach origin/${GIT_BRANCH}"
echo ""
echo "── Environment ──"
[[ -n "$ENV_FILE" && -f "$ENV_FILE" ]] && pass ".env located: ${ENV_FILE}" || fail ".env not found"

env_key_found DATABASE_URL yes
env_key_found JWT_SECRET yes
env_key_found JWT_REFRESH_SECRET yes
env_key_found COOKIE_SECRET yes
env_key_found OPENAI_API_KEY yes
env_key_found STRIPE_SECRET_KEY no
env_key_found REDIS_URL no

LEGACY_DB_URL=""
LEGACY_DBNAME=""
if [[ -f "${ENV_FILE:-/nonexistent}" ]]; then
  LEGACY_DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed -E 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')"
  LEGACY_DBNAME="$(echo "$LEGACY_DB_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
  [[ -n "$LEGACY_DBNAME" ]] && pass "Legacy DB name: ${LEGACY_DBNAME}"
  [[ "$LEGACY_DBNAME" == "$V1_DB_NAME" ]] && fail "Legacy .env targets ${V1_DB_NAME} — must use separate DB"
fi

UPLOAD_DIR="$(grep -E '^EVIDENCE_UPLOAD_DIR=' "$ENV_FILE" 2>/dev/null | head -1 | sed -E 's/^EVIDENCE_UPLOAD_DIR=//; s/^["'\'']//; s/["'\'']$//' || true)"
[[ -z "$UPLOAD_DIR" ]] && UPLOAD_DIR="${PROD_DIR}/uploads/evidence"
echo ""
echo "── Upload Directories ──"
for ud in "$UPLOAD_DIR" "${PROD_DIR}/uploads/evidence" "/home/$(whoami)/uploads" "/home/ec2-user/uploads"; do
  [[ -d "$ud" ]] && pass "Upload dir exists: ${ud}" || warn "Upload dir missing: ${ud}"
  [[ -d "$ud" && -w "$ud" ]] && pass "Upload dir writable: ${ud}" || [[ -d "$ud" ]] && warn "Upload dir not writable: ${ud}"
done
echo ""

# ── OCR dependencies ──────────────────────────────────────────────────────────
echo "── OCR Dependencies ──"
if [[ -d "${PROD_DIR}/backend/node_modules/tesseract.js" ]]; then
  pass "tesseract.js npm package installed in production backend"
elif [[ -d "${PROD_DIR}/backend" ]]; then
  warn "tesseract.js not in production backend node_modules (npm ci will install at V1 deploy)"
else
  warn "Cannot check tesseract.js (production backend path missing)"
fi
command -v tesseract >/dev/null 2>&1 && pass "tesseract binary: $(tesseract --version 2>&1 | head -1)" || warn "tesseract system binary not installed (tesseract.js WASM fallback may apply)"
command -v pdftotext >/dev/null 2>&1 && pass "pdftotext (poppler) available" || warn "pdftotext not installed (pdf-parse npm fallback may apply)"
command -v convert >/dev/null 2>&1 && pass "ImageMagick convert available" || warn "ImageMagick not installed (optional)"
echo ""

# ── Redis ─────────────────────────────────────────────────────────────────────
echo "── Redis ──"
if [[ -f "${ENV_FILE:-}" ]] && grep -qE '^REDIS_URL=' "$ENV_FILE" && ! grep -E '^REDIS_URL=.*REPLACE' "$ENV_FILE" >/dev/null 2>&1; then
  pass "REDIS_URL configured in .env"
  REDIS_URL_VAL="$(grep -E '^REDIS_URL=' "$ENV_FILE" | sed -E 's/^REDIS_URL=//; s/^["'\'']//; s/["'\'']$//')"
  if command -v redis-cli >/dev/null 2>&1; then
  REDIS_HOST="$(echo "$REDIS_URL_VAL" | sed -E 's|redis://([^:/]+).*|\1|')"
  REDIS_PORT="$(echo "$REDIS_URL_VAL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')"
  [[ "$REDIS_PORT" == "$REDIS_URL_VAL" ]] && REDIS_PORT=6379
    redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" ping 2>/dev/null | grep -q PONG && pass "Redis PING ok" || warn "Redis not reachable via redis-cli"
  else
    port_check 6379 "Redis default" any
  fi
else
  warn "REDIS_URL not configured — queues may use in-process fallback"
  port_check 6379 "Redis default" any
fi
echo ""

# ── 0.4 PostgreSQL ───────────────────────────────────────────────────────────
echo "── PostgreSQL ──"
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet postgresql 2>/dev/null || systemctl is-active --quiet 'postgresql@*' 2>/dev/null \
    && pass "PostgreSQL service active" || warn "PostgreSQL service status unknown via systemctl"
fi

if [[ -n "$LEGACY_DB_URL" ]]; then
  psql "$LEGACY_DB_URL" -c 'SELECT 1' >/dev/null 2>&1 && pass "Legacy DB connection ok" || fail "Cannot connect to legacy database"
fi

V1_DB_EXISTS=no
if command -v sudo >/dev/null 2>&1 && sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${V1_DB_NAME}'" 2>/dev/null | grep -q 1; then
  V1_DB_EXISTS=yes
  pass "Database ${V1_DB_NAME} exists"
else
  fail "Database ${V1_DB_NAME} does NOT exist (create before install — read-only audit will not create)"
fi

if [[ "$V1_DB_EXISTS" == "yes" && -n "$LEGACY_DB_URL" ]]; then
  V1_DB_URL="$(echo "$LEGACY_DB_URL" | sed -E "s|/[^/?]+(\\?|$)|/${V1_DB_NAME}\\1|")"
  psql "$V1_DB_URL" -c 'SELECT 1' >/dev/null 2>&1 && pass "Connection to ${V1_DB_NAME} ok" || fail "Cannot connect to ${V1_DB_NAME}"
fi

if [[ -d "${PROD_DIR}/backend" && -f "$ENV_FILE" ]]; then
  MIGRATE_OUT="$(cd "${PROD_DIR}/backend" && set -a && source "$ENV_FILE" && set +a && npm run db:migrate:status 2>&1 || true)"
  echo "$MIGRATE_OUT" | grep -qiE 'up to date|No pending' && pass "Legacy migration status: current" \
    || echo "$MIGRATE_OUT" | grep -qi pending && warn "Legacy DB has pending migrations" \
    || echo "$MIGRATE_OUT" | grep -qi failed && fail "Legacy DB has failed migrations" \
    || warn "Legacy migration status inconclusive"
fi
echo ""

# ── 0.5 PM2 ───────────────────────────────────────────────────────────────────
echo "── PM2 ──"
if command -v pm2 >/dev/null 2>&1; then
  PM2_JSON="$(pm2 jlist 2>/dev/null || true)"
  if [[ -n "$PM2_JSON" ]]; then
    pass "PM2 process list retrieved"
    echo "$PM2_JSON" | grep -oE '"name":"[^"]+"' | sed 's/"name":"/       • /; s/"$//' || true
    for APP in courtaccess courtaccess-api courtaccess-frontend courtaccess-v1; do
      echo "$PM2_JSON" | grep -q "\"name\":\"${APP}\"" && pm2 describe "$APP" 2>/dev/null | grep -q online && pass "PM2 ${APP} online" || true
    done
    echo "$PM2_JSON" | grep -q '"name":"courtaccess"' && pass "CourtAccess PM2: courtaccess" \
      || echo "$PM2_JSON" | grep -q '"name":"courtaccess-api"' && pass "CourtAccess PM2: courtaccess-api" \
      || warn "CourtAccess PM2 app not identified"
    FAA="$(echo "$PM2_JSON" | grep -oiE '"name":"[^"]*faa[^"]*"' || true)"
    [[ -n "$FAA" ]] && pass "FAA PM2 process(es) detected" || warn "No FAA PM2 process name detected"
    echo "$PM2_JSON" | grep -q '"name":"courtaccess-v1"' && warn "courtaccess-v1 PM2 already exists" || pass "courtaccess-v1 PM2 not present (pre-install)"
  else
    fail "PM2 jlist empty"
  fi
fi
echo ""

# ── 0.6 Nginx + SSL ───────────────────────────────────────────────────────────
echo "── Nginx + SSL ──"
sudo nginx -t >/dev/null 2>&1 && pass "nginx -t valid" || fail "nginx -t failed"
NGINX_DUMP="$(sudo nginx -T 2>/dev/null || true)"
echo "$NGINX_DUMP" | grep -q 'server_name courtaccess.net' && pass "courtaccess.net server block" || fail "courtaccess.net block missing"
DOCROOT="$(echo "$NGINX_DUMP" | awk '/server_name courtaccess.net/{f=1} f&&/root /{print; exit}' | sed -E 's/.*root[[:space:]]+([^;]+);.*/\1/' | tr -d ' ')"
[[ -n "$DOCROOT" ]] && pass "Document root: ${DOCROOT}" || warn "Document root not determined"
echo "$NGINX_DUMP" | grep -q 'proxy_pass' && pass "API proxy_pass configured" || warn "proxy_pass not found"
echo "$NGINX_DUMP" | grep -q 'courtaccess-v1' && warn "courtaccess-v1 nginx site already present" || pass "No courtaccess-v1 nginx site (pre-install)"
for cert in /etc/letsencrypt/live/courtaccess.net/fullchain.pem /etc/ssl/certs/courtaccess.net.pem; do
  [[ -f "$cert" ]] && pass "SSL cert: ${cert}" && break
done
[[ -f /etc/letsencrypt/live/courtaccess.net/fullchain.pem ]] || warn "Let's Encrypt cert not at default path"
echo ""

# ── 0.7 Ports ─────────────────────────────────────────────────────────────────
echo "── Ports ──"
port_check 80 "HTTP" inuse
port_check 443 "HTTPS" inuse
port_check "$LEGACY_API_PORT" "Legacy API" inuse
port_check "$V1_API_PORT" "V1 API" free
port_check "$V1_FRONTEND_PORT" "V1 frontend" free
echo ""

# ── 0.9 Production health (read-only) ─────────────────────────────────────────
echo "── Production Health ──"
if command -v curl >/dev/null 2>&1; then
  CODE="$(curl -o /dev/null -s -w '%{http_code}' "${PRODUCTION_URL}/")"
  [[ "$CODE" == "200" ]] && pass "${PRODUCTION_URL} HTTP ${CODE}" || fail "${PRODUCTION_URL} HTTP ${CODE}"
  HTML="$(curl -fsS "${PRODUCTION_URL}/" 2>/dev/null || true)"
  echo "$HTML" | grep -q "Criminal Case Intelligence Platform" && pass "Production V1 branding" || warn "Production missing V1 branding (expected pre-cutover)"
  LM="$(curl -sI "${PRODUCTION_URL}/" | grep -i '^Last-Modified:' | tr -d '\r' || true)"
  [[ -n "$LM" ]] && pass "Frontend ${LM}" || warn "No Last-Modified header"
  HEALTH="$(curl -fsS "${PRODUCTION_URL}/api/health" 2>/dev/null || true)"
  echo "$HEALTH" | grep -q '"status":"ok"' && pass "/api/health ok" || fail "/api/health failed"
  echo "$HEALTH" | grep -q '"version":"1.1.0"' && pass "API version 1.1.0" || warn "API version field absent (legacy)"
fi
echo ""

# ── Greenfield readiness ──────────────────────────────────────────────────────
echo "── Greenfield Readiness ──"
READY=yes
[[ "$V1_DB_EXISTS" != "yes" ]] && READY=no
[[ "$FAIL" -gt 0 ]] && READY=no
ss -tlnp 2>/dev/null | grep -qE ":${V1_API_PORT} |:${V1_FRONTEND_PORT} " && { fail "V1 ports occupied"; READY=no; } || pass "V1 ports ${V1_API_PORT}/${V1_FRONTEND_PORT} free"
[[ -n "$REMOTE_DEV_SHA" ]] && pass "Greenfield scripts available on origin/${GIT_BRANCH}" || READY=no

echo ""
echo "=============================================================================="
echo " PREFLIGHT SUMMARY"
echo "=============================================================================="
echo "PASS: ${PASS}   WARN: ${WARN}   FAIL: ${FAIL}"
echo ""
if [[ ${#BLOCKERS[@]} -gt 0 ]]; then
  echo "Blockers:"
  n=1
  for b in "${BLOCKERS[@]}"; do echo "  ${n}. ${b}"; n=$((n + 1)); done
  echo ""
fi

if [[ "$READY" == "yes" && "$FAIL" -eq 0 ]]; then
  echo "READINESS: PASS — proceed to Phase 1 (clone origin/dev → ${V1_DIR})"
  echo "  TMPDIR=\$(mktemp -d)"
  echo "  git clone --depth 1 --branch dev ${GIT_REMOTE} \"\${TMPDIR}/courtaccess-install\""
  echo "  export ENV_SOURCE=${ENV_FILE:-/var/www/courtaccess/backend/.env}"
  echo "  bash \"\${TMPDIR}/courtaccess-install/scripts/v1-greenfield-install.sh\""
  EXIT=0
elif [[ "$FAIL" -eq 0 ]]; then
  echo "READINESS: WARN — review warnings; Phase 1 may proceed with caution"
  EXIT=0
else
  echo "READINESS: FAIL — resolve blockers before Phase 1"
  EXIT=1
fi
echo "Production path ${PROD_DIR} git state was NOT modified by this audit."
echo "=============================================================================="

write_json_report
exit "$EXIT"
