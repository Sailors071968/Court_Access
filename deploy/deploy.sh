#!/usr/bin/env bash
# ===========================================================================
# CourtAccess — Production Deployment Script
# Deploys backend API (port 3001) via PM2, builds frontend static files,
# and configures NGINX to serve static frontend + proxy /api to backend.
#
# Target architecture:
#   Client → https://courtaccess.net
#                ↓
#             NGINX
#          ├── /api/* → Backend API (Fastify, port 3001)
#          └── /*     → Static files (dist/)
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="/var/www/courtaccess"

echo "============================================"
echo " CourtAccess — Production Deployment"
echo " Project dir: $PROJECT_DIR"
echo " Deploy dir:  $DEPLOY_DIR"
echo "============================================"

# ------------------------------------------------------------------
# Step 1: Install backend dependencies
# ------------------------------------------------------------------
echo ""
echo "[1/6] Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --production=false
npx prisma generate
echo "  Done — backend dependencies installed"

# ------------------------------------------------------------------
# Step 2: Install frontend dependencies and build
# ------------------------------------------------------------------
echo ""
echo "[2/6] Building frontend..."
cd "$PROJECT_DIR"
npm install
npm run build
echo "  Done — frontend built to dist/"

# ------------------------------------------------------------------
# Step 3: Copy built frontend to deployment directory
# ------------------------------------------------------------------
echo ""
echo "[3/6] Deploying static frontend to $DEPLOY_DIR/dist..."
sudo mkdir -p "$DEPLOY_DIR"
sudo rsync -a --delete "$PROJECT_DIR/dist/" "$DEPLOY_DIR/dist/"
echo "  Done — static files deployed"

# ------------------------------------------------------------------
# Step 4: Stop and restart backend via PM2
# ------------------------------------------------------------------
echo ""
echo "[4/6] Starting backend via PM2..."
cd "$PROJECT_DIR"
pm2 delete courtaccess-api 2>/dev/null || true

PORT=3001 pm2 start npx \
  --name courtaccess-api \
  -- tsx backend/src/server.ts
echo "  Done — backend started on port 3001 (API only)"

pm2 save
echo "  Done — PM2 process list saved"

# ------------------------------------------------------------------
# Step 5: Configure NGINX (static frontend + API proxy)
# ------------------------------------------------------------------
echo ""
echo "[5/6] Configuring NGINX..."
sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/courtaccess
sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  echo "  Done — NGINX configured and reloaded"
else
  echo "  FAILED — NGINX config test failed, check /etc/nginx/sites-available/courtaccess"
  exit 1
fi

# ------------------------------------------------------------------
# Step 6: Verify deployment
# ------------------------------------------------------------------
echo ""
echo "[6/6] Verifying deployment..."
sleep 3

echo ""
echo "PM2 status:"
pm2 status

echo ""
echo "Backend health check:"
if curl -sf http://localhost:3001/api/health; then
  echo ""
  echo "  Backend API is healthy"
else
  echo "  WARNING: Backend health check failed"
fi

echo ""
echo "Frontend check (static files):"
if [ -f "$DEPLOY_DIR/dist/index.html" ]; then
  echo "  index.html exists at $DEPLOY_DIR/dist/index.html"
else
  echo "  WARNING: index.html not found at $DEPLOY_DIR/dist/index.html"
fi

echo ""
echo "============================================"
echo " Deployment complete!"
echo ""
echo " Architecture:"
echo "   NGINX serves static frontend from $DEPLOY_DIR/dist/"
echo "   NGINX proxies /api/* to backend on port 3001"
echo ""
echo " Backend API:  http://localhost:3001/api/health"
echo " External:     http://courtaccess.net"
echo " External API: http://courtaccess.net/api/health"
echo ""
echo " Next steps:"
echo "   1. Verify: curl http://courtaccess.net/api/health"
echo "   2. Verify: open http://courtaccess.net in browser"
echo "   3. Add SSL: sudo certbot --nginx -d courtaccess.net -d www.courtaccess.net"
echo "   4. Ensure AWS security group allows ports 22, 80, 443"
echo "============================================"
