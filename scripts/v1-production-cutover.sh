#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Production Cutover
# Replaces live courtaccess.net with verified /var/www/courtaccess-v1 install
# Legacy installations become rollback backups — NOT reused
# PREREQUISITE: v1-greenfield-verify.sh must PASS
# ==============================================================================
set -euo pipefail

V1_DIR="${V1_DIR:-/var/www/courtaccess-v1}"
PROD_DIR="${PROD_DIR:-/var/www/courtaccess}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="/root/courtaccess-cutover/${TIMESTAMP}"
ROLLBACK_SCRIPT="${BACKUP_ROOT}/rollback-to-legacy.sh"
PRODUCTION_URL="${PRODUCTION_URL:-https://courtaccess.net}"
NGINX_PROD_SITE="${NGINX_PROD_SITE:-/etc/nginx/sites-enabled/courtaccess}"
PM2_V1_APP="${PM2_V1_APP:-courtaccess-v1}"
PM2_PROD_APP="${PM2_PROD_APP:-courtaccess}"
PROD_API_PORT=3001
V1_API_PORT="${V1_API_PORT:-3101}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { echo "FATAL: $*" >&2; exit 1; }

PASS=0
FAIL=0
verify() {
  local name="$1"; shift
  if "$@"; then echo "PASS: ${name}"; PASS=$((PASS+1)); else echo "FAIL: ${name}"; FAIL=$((FAIL+1)); fi
}

# --- Preflight ---
[[ -d "${V1_DIR}" ]] || die "V1 install not found: ${V1_DIR}"
[[ -f "${V1_DIR}/V1_INSTALL_MANIFEST.json" ]] || die "Run v1-greenfield-install.sh first"
[[ -f "${V1_DIR}/scripts/v1-greenfield-verify.sh" ]] || die "Missing verify script in V1 install"

log "Running pre-cutover verification"
if ! bash "${V1_DIR}/scripts/v1-greenfield-verify.sh"; then
  die "V1 verification failed — aborting cutover"
fi

mkdir -p "${BACKUP_ROOT}"

# --- Write rollback script ---
cat > "${ROLLBACK_SCRIPT}" <<ROLLBACK_EOF
#!/usr/bin/env bash
set -euo pipefail
echo "==> Rolling back to legacy production state"
PROD_DIR="${BACKUP_ROOT}/courtaccess-legacy"
V1_DIR="${BACKUP_ROOT}/courtaccess-v1-snapshot"
NGINX_BACKUP="${BACKUP_ROOT}/nginx"

if [[ -d "\${PROD_DIR}" ]]; then
  rm -rf /var/www/courtaccess
  cp -a "\${PROD_DIR}" /var/www/courtaccess
fi
if [[ -d "\${V1_DIR}" ]]; then
  rm -rf /var/www/courtaccess-v1
  cp -a "\${V1_DIR}" /var/www/courtaccess-v1
fi
if [[ -d "\${NGINX_BACKUP}" ]]; then
  cp -a "\${NGINX_BACKUP}/." /etc/nginx/sites-enabled/
fi
pm2 resurrect "${BACKUP_ROOT}/pm2.dump" 2>/dev/null || true
sudo nginx -t && sudo systemctl reload nginx
echo "==> Rollback complete"
ROLLBACK_EOF
chmod +x "${ROLLBACK_SCRIPT}"

log "Backing up legacy installations"
[[ -d "${PROD_DIR}" ]] && cp -a "${PROD_DIR}" "${BACKUP_ROOT}/courtaccess-legacy"
[[ -d "${V1_DIR}" ]] && cp -a "${V1_DIR}" "${BACKUP_ROOT}/courtaccess-v1-snapshot"
mkdir -p "${BACKUP_ROOT}/nginx"
cp -a /etc/nginx/sites-enabled/. "${BACKUP_ROOT}/nginx/" 2>/dev/null || true
pm2 save --force 2>/dev/null || true
[[ -f "${HOME}/.pm2/dump.pm2" ]] && cp -a "${HOME}/.pm2/dump.pm2" "${BACKUP_ROOT}/pm2.dump"
curl -fsS "${PRODUCTION_URL}/" > "${BACKUP_ROOT}/pre-cutover.html" 2>/dev/null || true

log "Stopping V1 parallel services"
pm2 delete "${PM2_V1_APP}" 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/courtaccess-v1 2>/dev/null || true

log "Retiring legacy production directory"
if [[ -d "${PROD_DIR}" ]]; then
  mv "${PROD_DIR}" "/var/www/courtaccess-rollback-${TIMESTAMP}"
fi

log "Promoting V1 to production path"
cp -a "${V1_DIR}" "${PROD_DIR}"

log "Reconfiguring V1 for production ports"
PROD_ECOSYSTEM="${PROD_DIR}/ecosystem.production.config.cjs"
cat > "${PROD_ECOSYSTEM}" <<EOF
require("dotenv").config({ path: "${PROD_DIR}/backend/.env" });

module.exports = {
  apps: [
    {
      name: "${PM2_PROD_APP}",
      script: "src/server.ts",
      cwd: "${PROD_DIR}/backend",
      interpreter: "npx",
      interpreter_args: "tsx -r dotenv/config",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "${PROD_API_PORT}",
        DOTENV_CONFIG_PATH: "${PROD_DIR}/backend/.env",
        REDIS_URL: process.env.REDIS_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        FRONTEND_URL: "https://courtaccess.net",
        EVIDENCE_UPLOAD_DIR: "${PROD_DIR}/uploads/evidence",
      },
      max_memory_restart: "500M",
      restart_delay: 5000,
      autorestart: true,
      watch: false,
      error_file: "/var/log/pm2/courtaccess-api-error.log",
      out_file: "/var/log/pm2/courtaccess-api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
EOF

# Update .env for production
upsert_env() {
  local key="$1" val="$2" file="${PROD_DIR}/backend/.env"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$file"
  else
    echo "${key}=\"${val}\"" >> "$file"
  fi
}
upsert_env "PORT" "${PROD_API_PORT}"
upsert_env "FRONTEND_URL" "https://courtaccess.net"
upsert_env "EVIDENCE_UPLOAD_DIR" "${PROD_DIR}/uploads/evidence"

log "Rebuilding at production path"
cd "${PROD_DIR}"
npm ci
cd "${PROD_DIR}/backend" && npm ci && cd "${PROD_DIR}"
npm run build
cd "${PROD_DIR}/backend"
npx prisma generate
npm run build
set -a && source .env && set +a
npm run db:migrate:deploy
cd "${PROD_DIR}"

log "Verifying frontend build at production path"
test -f "${PROD_DIR}/dist/index.html"
grep -q "Criminal Case Intelligence Platform" "${PROD_DIR}/dist/index.html"

log "Updating production nginx"
if [[ -f "${NGINX_PROD_SITE}" ]]; then
  cp -a "${NGINX_PROD_SITE}" "${BACKUP_ROOT}/courtaccess.nginx.bak"
fi

sudo tee /etc/nginx/sites-available/courtaccess > /dev/null <<'NGINX_EOF'
server {
    listen 80;
    server_name courtaccess.net www.courtaccess.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name courtaccess.net www.courtaccess.net;

    ssl_certificate     /etc/letsencrypt/live/courtaccess.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/courtaccess.net/privkey.pem;

    root /var/www/courtaccess/dist;
    index index.html;

    client_max_body_size 500M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX_EOF

sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/courtaccess
sudo nginx -t
sudo systemctl reload nginx

log "Starting production PM2"
pm2 delete "${PM2_PROD_APP}" 2>/dev/null || true
pm2 start "${PROD_ECOSYSTEM}"
pm2 save

sleep 5

log "Post-cutover verification"
HTML="$(curl -fsS "${PRODUCTION_URL}/" 2>/dev/null || true)"
HEALTH="$(curl -fsS "${PRODUCTION_URL}/api/health" 2>/dev/null || true)"
DEPLOYED_SHA="$(cd "${PROD_DIR}" && git rev-parse HEAD)"

verify "production landing branding" grep -q "Criminal Case Intelligence Platform" <<< "${HTML}"
verify "production stale title absent" ! grep -q "Court Access System" <<< "${HTML}"
verify "production build stamp" grep -q "CourtAccess build:" <<< "${HTML}"
verify "production API health" grep -q '"status":"ok"' <<< "${HEALTH}"
verify "production API version" grep -q '"version":"1.1.0"' <<< "${HEALTH}"
verify "production /api/health/deep" curl -fsS "${PRODUCTION_URL}/api/health/deep" >/dev/null 2>&1
verify "pm2 courtaccess online" pm2 describe "${PM2_PROD_APP}" 2>/dev/null | grep -q online
verify "login route" test "$(curl -o /dev/null -s -w '%{http_code}' "${PRODUCTION_URL}/login")" = "200"
verify "dashboard route" test "$(curl -o /dev/null -s -w '%{http_code}' "${PRODUCTION_URL}/dashboard")" = "200"
verify "admin route" test "$(curl -o /dev/null -s -w '%{http_code}' "${PRODUCTION_URL}/admin/operations")" = "200"
verify "client portal route" test "$(curl -o /dev/null -s -w '%{http_code}' "${PRODUCTION_URL}/client-portal")" = "200"

echo ""
echo "================================================================"
echo " CUTOVER SUMMARY"
echo "================================================================"
echo "Production path:  ${PROD_DIR}"
echo "Git commit:       ${DEPLOYED_SHA}"
echo "Legacy backup:    /var/www/courtaccess-rollback-${TIMESTAMP}"
echo "Full backup:      ${BACKUP_ROOT}"
echo "Rollback:         bash ${ROLLBACK_SCRIPT}"
echo "PASS:             ${PASS}"
echo "FAIL:             ${FAIL}"
echo "================================================================"

if [[ "${FAIL}" -gt 0 ]]; then
  echo "CUTOVER FAIL — consider: bash ${ROLLBACK_SCRIPT}"
  exit 1
fi

echo "CUTOVER PASS — courtaccess.net is now running origin/dev"
