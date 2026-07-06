#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Greenfield Installation (parallel to production)
# Source of truth: origin/dev @ github.com/Sailors071968/Court_Access
# Target:         /var/www/courtaccess-v1
# Does NOT modify: /var/www/courtaccess or any legacy repository
# ==============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/var/www/courtaccess-v1}"
GIT_REMOTE="${GIT_REMOTE:-git@github.com:Sailors071968/Court_Access.git}"
GIT_BRANCH="${GIT_BRANCH:-dev}"
API_PORT="${API_PORT:-3101}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PM2_APP_NAME="${PM2_APP_NAME:-courtaccess-v1}"
V1_URL="${V1_URL:-http://127.0.0.1:${FRONTEND_PORT}}"
ENV_SOURCE="${ENV_SOURCE:-}"  # optional: path to existing .env to copy secrets from
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="/var/log/courtaccess-v1"
NGINX_SITE="/etc/nginx/sites-available/courtaccess-v1"
NGINX_ENABLED="/etc/nginx/sites-enabled/courtaccess-v1"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { echo "FATAL: $*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

require_cmd git
require_cmd node
require_cmd npm
require_cmd pm2
require_cmd curl
require_cmd sudo

log "CourtAccess V1 greenfield install"
log "  INSTALL_DIR:    ${INSTALL_DIR}"
log "  GIT_BRANCH:     ${GIT_BRANCH}"
log "  API_PORT:       ${API_PORT}"
log "  FRONTEND_PORT:  ${FRONTEND_PORT}"
log "  V1_URL:         ${V1_URL}"

# --- 1. Fresh clone (never reuse legacy repo) ---
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log "Existing install found — fetching latest ${GIT_BRANCH}"
  cd "${INSTALL_DIR}"
  git remote set-url origin "${GIT_REMOTE}"
  git fetch origin --prune
  git checkout "${GIT_BRANCH}"
  git reset --hard "origin/${GIT_BRANCH}"
else
  log "Cloning fresh repository"
  sudo mkdir -p "$(dirname "${INSTALL_DIR}")"
  if [[ -d "${INSTALL_DIR}" ]]; then
  sudo mv "${INSTALL_DIR}" "${INSTALL_DIR}.pre-clone.${TIMESTAMP}"
  fi
  sudo git clone --branch "${GIT_BRANCH}" "${GIT_REMOTE}" "${INSTALL_DIR}"
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

# Use separate database if not already set
if ! grep -q '^DATABASE_URL=' "${BACKEND_ENV}" || grep -q 'REPLACE_WITH' "${BACKEND_ENV}"; then
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
  "legacyUntouched": ["/var/www/courtaccess"]
}
EOF

log "Install complete"
log "  Commit:  ${DEPLOYED_SHA}"
log "  URL:     ${V1_URL}"
log "  API:     http://127.0.0.1:${API_PORT}/api/health"
log "  Verify:  bash ${INSTALL_DIR}/scripts/v1-greenfield-verify.sh"
