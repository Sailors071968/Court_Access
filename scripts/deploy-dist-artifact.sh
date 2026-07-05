#!/usr/bin/env bash
# Fast frontend-only deploy from CI artifact tarball
# Usage: bash scripts/deploy-dist-artifact.sh /path/to/courtaccess-dist.tar.gz
set -euo pipefail

ARTIFACT="${1:?Usage: deploy-dist-artifact.sh <courtaccess-dist.tar.gz>}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/courtaccess}"
DIST_DIR="${DIST_DIR:-$DEPLOY_DIR/dist}"

echo "==> Deploy dist artifact to $DIST_DIR"
mkdir -p "$DIST_DIR"
BACKUP="${DIST_DIR}.bak.$(date +%Y%m%d%H%M%S)"
if [[ -d "$DIST_DIR" && "$(ls -A "$DIST_DIR" 2>/dev/null)" ]]; then
  cp -a "$DIST_DIR" "$BACKUP"
  echo "    Backed up to $BACKUP"
fi

rm -rf "${DIST_DIR:?}"/*
tar -xzf "$ARTIFACT" -C "$DIST_DIR"

grep -q "Criminal Case Intelligence Platform" "$DIST_DIR/index.html" || {
  echo "ERROR: Invalid dist — missing branding"
  exit 1
}

sudo nginx -t
sudo systemctl reload nginx

if [[ -n "${CF_ZONE_ID:-}" && -n "${CF_API_TOKEN:-}" ]]; then
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' | head -c 200
  echo
fi

curl -fsS https://courtaccess.net/ | grep -q "Criminal Case Intelligence Platform" && \
  echo "PASS: Production updated" || echo "WARN: Verify Cloudflare cache"
