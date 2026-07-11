#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Greenfield Installation (parallel to production)
# Source of truth: origin/dev (cloned ONLY into /var/www/courtaccess-v1)
# Target:         /var/www/courtaccess-v1
# NEVER modifies: /var/www/courtaccess git state, files, or PM2/nginx for courtaccess.net
# ==============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/var/www/courtaccess-v1}"
PROTECTED_PROD_DIR="${PROTECTED_PROD_DIR:-/var/www/courtaccess}"
GIT_REMOTE="${GIT_REMOTE:-https://github.com/Sailors071968/Court_Access.git}"
GIT_BRANCH="${GIT_BRANCH:-dev}"
API_PORT="${API_PORT:-3101}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PM2_APP_NAME="${PM2_APP_NAME:-courtaccess-v1}"
V1_URL="${V1_URL:-http://127.0.0.1:${FRONTEND_PORT}}"
ENV_SOURCE="${ENV_SOURCE:-}"  # read-only: copy secrets from production .env (never writes to ENV_SOURCE)
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="/var/log/courtaccess-v1"
NGINX_SITE="/etc/nginx/sites-available/courtaccess-v1"
NGINX_ENABLED="/etc/nginx/sites-enabled/courtaccess-v1"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { echo "FATAL: $*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

# --- Guard: never install into or modify production repository path ---
resolve_path() { readlink -f "$1" 2>/dev/null || realpath "$1" 2>/dev/null || echo "$1"; }
INSTALL_RESOLVED="$(resolve_path "$INSTALL_DIR")"
PROD_RESOLVED="$(resolve_path "$PROTECTED_PROD_DIR")"
if [[ "$INSTALL_RESOLVED" == "$PROD_RESOLVED" ]]; then
  die "INSTALL_DIR must not be production path ${PROTECTED_PROD_DIR}. Greenfield installs only to /var/www/courtaccess-v1"
fi

require_cmd git
require_cmd node
require_cmd npm
require_cmd pm2
require_cmd curl
require_cmd sudo

log "CourtAccess V1 greenfield install"
log "  INSTALL_DIR:       ${INSTALL_DIR}"
log "  PROTECTED (frozen): ${PROTECTED_PROD_DIR}"
log "  GIT_REMOTE:        ${GIT_REMOTE}"
log "  GIT_BRANCH:        ${GIT_BRANCH}"
log "  API_PORT:          ${API_PORT}"
log "  FRONTEND_PORT:     ${FRONTEND_PORT}"
log "  V1_URL:            ${V1_URL}"

# Record production git HEAD (read-only) to prove we did not modify it
PROD_GIT_BEFORE=""
if [[ -d "${PROTECTED_PROD_DIR}/.git" ]]; then
  PROD_GIT_BEFORE="$(git -C "${PROTECTED_PROD_DIR}" rev-parse HEAD 2>/dev/null || true)"
  log "Production repo HEAD (read-only snapshot): ${PROD_GIT_BEFORE:-unknown}"
fi

# --- 1. Clone origin/dev into V1 path ONLY (never reuse /var/www/courtaccess) ---
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log "Existing V1 clone — syncing to origin/${GIT_BRANCH} (V1 path only)"
  cd "${INSTALL_DIR}"
  git remote set-url origin "${GIT_REMOTE}"
  git fetch origin --prune
  git checkout "${GIT_BRANCH}"
  git reset --hard "origin/${GIT_BRANCH}"
else
  log "Fresh clone: origin/${GIT_BRANCH} → ${INSTALL_DIR}"
  sudo mkdir -p "$(dirname "${INSTALL_DIR}")"
  if [[ -e "${INSTALL_DIR}" ]]; then
    sudo mv "${INSTALL_DIR}" "${INSTALL_DIR}.pre-clone.${TIMESTAMP}"
  fi
  git clone --branch "${GIT_BRANCH}" "${GIT_REMOTE}" "${INSTALL_DIR}"
  sudo chown -R "$(whoami):$(whoami)" "${INSTALL_DIR}" 2>/dev/null || true
  cd "${INSTALL_DIR}"
fi

DEPLOYED_SHA="$(git rev-parse HEAD)"
log "Repository at ${DEPLOYED_SHA}"

# --- 2. Directory layout ---
mkdir -p "${INSTALL_DIR}/uploads/evidence"
mkdir -p "${LOG_DIR}"
mkdir -p "${INSTALL_DIR}/dist"

# --- 3. Environment configuration ---
BACKEND_ENV="${INSTALL_DIR}/backend/.env"
if [[ ! -f "${BACKEND_ENV}" ]]; then
  if [[ -n "${ENV_SOURCE}" && -f "${ENV_SOURCE}" ]]; then
    log "Copying secrets from ENV_SOURCE: ${ENV_SOURCE}"
    cp "${ENV_SOURCE}" "${BACKEND_ENV}"
  else
    log "Creating .env from template — YOU MUST EDIT SECRETS"
    cp "${INSTALL_DIR}/backend/.env.production.template" "${BACKEND_ENV}"
  fi
fi

# Override v1-specific settings (idempotent)
upsert_env() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$file"
  else
    echo "${key}=\"${val}\"" >> "$file"
  fi
}

upsert_env "NODE_ENV" "production" "${BACKEND_ENV}"
upsert_env "PORT" "${API_PORT}" "${BACKEND_ENV}"
upsert_env "HOST" "0.0.0.0" "${BACKEND_ENV}"
upsert_env "FRONTEND_URL" "${V1_URL}" "${BACKEND_ENV}"
upsert_env "EVIDENCE_UPLOAD_DIR" "${INSTALL_DIR}/uploads/evidence" "${BACKEND_ENV}"

# Always point V1 at separate database (never reuse legacy courtaccess DB)
if [[ -n "${ENV_SOURCE}" && -f "${ENV_SOURCE}" ]]; then
  SRC_DB="$(grep -E '^DATABASE_URL=' "${ENV_SOURCE}" | head -1 | sed -E 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')"
  if [[ -n "$SRC_DB" ]]; then
    V1_DB_URL="$(echo "$SRC_DB" | sed -E 's|/[^/?]+(\?|$)|/courtaccess_v1\1|')"
    upsert_env "DATABASE_URL" "${V1_DB_URL}" "${BACKEND_ENV}"
    log "DATABASE_URL set to courtaccess_v1 (derived from ENV_SOURCE)"
  fi
elif ! grep -q '^DATABASE_URL=' "${BACKEND_ENV}" || grep -q 'REPLACE_WITH' "${BACKEND_ENV}"; then
  upsert_env "DATABASE_URL" "postgresql://courtaccess:CHANGE_ME@localhost:5432/courtaccess_v1?schema=public" "${BACKEND_ENV}"
  log "WARN: DATABASE_URL needs real credentials for courtaccess_v1"
fi

# --- 4. PM2 ecosystem (v1-specific, not legacy backend/ecosystem.config.cjs) ---
PM2_ECOSYSTEM="${INSTALL_DIR}/ecosystem.v1.config.cjs"
cat > "${PM2_ECOSYSTEM}" <<EOF
require("dotenv").config({ path: "${INSTALL_DIR}/backend/.env" });

module.exports = {
  apps: [
    {
      name: "${PM2_APP_NAME}",
      script: "src/server.ts",
      cwd: "${INSTALL_DIR}/backend",
      interpreter: "npx",
      interpreter_args: "tsx -r dotenv/config",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "${API_PORT}",
        DOTENV_CONFIG_PATH: "${INSTALL_DIR}/backend/.env",
        REDIS_URL: process.env.REDIS_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        FRONTEND_URL: process.env.FRONTEND_URL,
        EVIDENCE_UPLOAD_DIR: "${INSTALL_DIR}/uploads/evidence",
      },
      max_memory_restart: "500M",
      restart_delay: 5000,
      autorestart: true,
      watch: false,
      error_file: "${LOG_DIR}/api-error.log",
      out_file: "${LOG_DIR}/api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
EOF

# --- 5. Install dependencies ---
log "Installing frontend dependencies"
cd "${INSTALL_DIR}"
npm ci

log "Installing backend dependencies"
cd "${INSTALL_DIR}/backend"
npm ci

# --- 6. Database migrations ---
log "Running database migrations"
set -a
# shellcheck disable=SC1091
source "${BACKEND_ENV}"
set +a
npx prisma generate
npm run db:migrate:status || true
npm run db:migrate:deploy

# --- 7. Build frontend ---
log "Building frontend"
cd "${INSTALL_DIR}"
npm run build
test -f "${INSTALL_DIR}/dist/index.html"
grep -q "Criminal Case Intelligence Platform" "${INSTALL_DIR}/dist/index.html"

# --- 8. Build backend ---
log "Building backend"
cd "${INSTALL_DIR}/backend"
npm run build

# --- 9. Nginx v1 site (alternate port — does not touch courtaccess.net) ---
sudo tee "${NGINX_SITE}" > /dev/null <<EOF
server {
    listen ${FRONTEND_PORT};
    server_name _;

    root ${INSTALL_DIR}/dist;
    index index.html;

    client_max_body_size 500M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

sudo ln -sf "${NGINX_SITE}" "${NGINX_ENABLED}"
sudo nginx -t
sudo systemctl reload nginx

# --- 10. Start PM2 ---
log "Starting PM2 ${PM2_APP_NAME}"
cd "${INSTALL_DIR}"
pm2 delete "${PM2_APP_NAME}" 2>/dev/null || true
pm2 start "${PM2_ECOSYSTEM}"
pm2 save

sleep 3

# --- 11. Write install manifest ---
cat > "${INSTALL_DIR}/V1_INSTALL_MANIFEST.json" <<EOF
{
  "installedAt": "${TIMESTAMP}",
  "installDir": "${INSTALL_DIR}",
  "gitBranch": "${GIT_BRANCH}",
  "gitCommit": "${DEPLOYED_SHA}",
  "apiPort": ${API_PORT},
  "frontendPort": ${FRONTEND_PORT},
  "v1Url": "${V1_URL}",
  "pm2App": "${PM2_APP_NAME}",
  "pm2Ecosystem": "${PM2_ECOSYSTEM}",
  "nginxSite": "${NGINX_SITE}",
  "legacyUntouched": ["${PROTECTED_PROD_DIR}"],
  "productionGitHeadBefore": "${PROD_GIT_BEFORE}",
  "architecture": "origin/dev cloned only into courtaccess-v1; production repo frozen until cutover"
}
EOF

# Verify production git HEAD unchanged
if [[ -n "$PROD_GIT_BEFORE" && -d "${PROTECTED_PROD_DIR}/.git" ]]; then
  PROD_GIT_AFTER="$(git -C "${PROTECTED_PROD_DIR}" rev-parse HEAD 2>/dev/null || true)"
  if [[ "$PROD_GIT_BEFORE" != "$PROD_GIT_AFTER" ]]; then
    die "Production repo git HEAD changed during install — aborting (${PROD_GIT_BEFORE} → ${PROD_GIT_AFTER})"
  fi
  log "Production repo git HEAD unchanged: ${PROD_GIT_AFTER}"
fi

log "Install complete"
log "  Commit:  ${DEPLOYED_SHA}"
log "  URL:     ${V1_URL}"
log "  API:     http://127.0.0.1:${API_PORT}/api/health"
log "  Verify:  bash ${INSTALL_DIR}/scripts/v1-greenfield-verify.sh"
