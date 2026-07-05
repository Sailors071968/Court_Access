#!/usr/bin/env bash
# =============================================================================
# Priority Zero — Deploy current production website to courtaccess.net
# Run on the production server as a user with access to /opt/courtaccess
# =============================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/courtaccess}"
BRANCH="${DEPLOY_BRANCH:-dev}"
NGINX_ROOT="${NGINX_ROOT:-$DEPLOY_DIR/dist}"
PM2_FRONTEND="${PM2_FRONTEND:-courtaccess-frontend}"

echo "==> CourtAccess Production Website Deploy"
echo "    Directory: $DEPLOY_DIR"
echo "    Branch:    $BRANCH"
echo "    Nginx root: $NGINX_ROOT"

cd "$DEPLOY_DIR"

echo "==> Fetch latest"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Install dependencies"
npm ci
cd backend && npm ci && cd ..

echo "==> Build frontend (production)"
npm run build

echo "==> Verify build output"
test -f dist/index.html
grep -q "Criminal Case Intelligence Platform" dist/index.html || {
  echo "ERROR: dist/index.html missing Criminal Case Intelligence Platform branding"
  exit 1
}
! grep -q "Loading Court Access" dist/assets/*.js 2>/dev/null || {
  echo "ERROR: stale Loading Court Access bundle detected"
  exit 1
}

echo "==> Reload nginx (serves $NGINX_ROOT)"
sudo nginx -t
sudo systemctl reload nginx

if command -v pm2 >/dev/null 2>&1; then
  echo "==> Restart PM2 frontend (if used)"
  pm2 restart "$PM2_FRONTEND" 2>/dev/null || true
fi

echo "==> Purge Cloudflare cache (if CF_ZONE_ID and CF_API_TOKEN set)"
if [[ -n "${CF_ZONE_ID:-}" && -n "${CF_API_TOKEN:-}" ]]; then
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' | head -c 200
  echo
fi

echo "==> Smoke test"
curl -fsS https://courtaccess.net/ | grep -q "Criminal Case Intelligence Platform" && \
  echo "PASS: Production HTML title updated" || \
  echo "WARN: Title not yet visible — check Cloudflare cache or nginx root path"

echo "==> Deploy complete"
