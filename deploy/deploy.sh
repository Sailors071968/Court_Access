#!/usr/bin/env bash
# ===========================================================================
# CourtAccess — Production Deployment Script
# Deploys backend (API on port 3001) and frontend (port 3000) via PM2,
# then configures NGINX as the reverse proxy.
#
# Target architecture:
#   Client → https://courtaccess.net
#                ↓
#             NGINX
#          ├── /api → Backend (port 3001)
#          └── /    → Frontend (port 3000)
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo " CourtAccess — Production Deployment"
echo " Project dir: $PROJECT_DIR"
echo "============================================"

# ------------------------------------------------------------------
# Step 1: Install backend dependencies
# ------------------------------------------------------------------
echo ""
echo "[1/6] Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --production=false
npx prisma generate
echo "  ✔ Backend dependencies installed"

# ------------------------------------------------------------------
# Step 2: Install frontend dependencies and build
# ------------------------------------------------------------------
echo ""
echo "[2/6] Building frontend..."
cd "$PROJECT_DIR"
npm install
npm run build
echo "  ✔ Frontend built to dist/"

# ------------------------------------------------------------------
# Step 3: Stop existing PM2 processes (ignore errors)
# ------------------------------------------------------------------
echo ""
echo "[3/6] Stopping existing PM2 processes..."
pm2 delete courtaccess-api 2>/dev/null || true
pm2 delete courtaccess-frontend 2>/dev/null || true
echo "  ✔ Old processes stopped"

# ------------------------------------------------------------------
# Step 4: Start backend and frontend via PM2
# ------------------------------------------------------------------
echo ""
echo "[4/6] Starting services via PM2..."
cd "$PROJECT_DIR"

# Start backend (API only, port 3001)
PORT=3001 pm2 start npx \
  --name courtaccess-api \
  -- tsx backend/src/server.ts
echo "  ✔ Backend started on port 3001"

# Start frontend (Vite preview, port 3000)
pm2 start npx \
  --name courtaccess-frontend \
  -- vite preview --port 3000
echo "  ✔ Frontend started on port 3000"

pm2 save
echo "  ✔ PM2 process list saved"

# ------------------------------------------------------------------
# Step 5: Configure NGINX
# ------------------------------------------------------------------
echo ""
echo "[5/6] Configuring NGINX..."
sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/courtaccess
sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  echo "  ✔ NGINX configured and reloaded"
else
  echo "  ✘ NGINX config test failed — check /etc/nginx/sites-available/courtaccess"
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
  echo "  ✔ Backend API is healthy"
else
  echo "  ✘ Backend health check failed"
fi

echo ""
echo "Frontend check:"
if curl -sf -o /dev/null http://localhost:3000; then
  echo "  ✔ Frontend is serving"
else
  echo "  ✘ Frontend not responding on port 3000"
fi

echo ""
echo "============================================"
echo " Deployment complete!"
echo ""
echo " Backend API:  http://localhost:3001/api/health"
echo " Frontend:     http://localhost:3000"
echo " External:     http://courtaccess.net"
echo " External API: http://courtaccess.net/api/health"
echo ""
echo " Next steps:"
echo "   1. Verify: curl http://courtaccess.net/api/health"
echo "   2. Verify: open http://courtaccess.net in browser"
echo "   3. Add SSL: sudo certbot --nginx -d courtaccess.net -d www.courtaccess.net"
echo "   4. Ensure AWS security group allows ports 22, 80, 443"
echo "============================================"
