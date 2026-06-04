# CourtAccess Deployment Runbook

## Phase 188 — Production Deployment Checklist

Generated: 2026-03-10

---

## 1. Prerequisites

### 1.1 Server Requirements
- **OS**: Ubuntu 22.04 LTS or later
- **CPU**: 4 vCPU minimum (8 vCPU recommended for production)
- **RAM**: 8 GB minimum (16 GB recommended)
- **Storage**: 100 GB SSD minimum
- **Node.js**: v18.x or v20.x LTS
- **npm**: v9.x or later

### 1.2 External Services
- **PostgreSQL**: v15+ (AWS RDS recommended for production)
- **Redis**: v7+ (for queue management — optional for initial launch)
- **S3-compatible storage**: For evidence files and policy documents (AWS S3 or Cloudflare R2)
- **SMTP service**: For CPRA email campaigns (SendGrid, AWS SES, or Postmark)
- **Domain & SSL**: TLS certificate for HTTPS (Let's Encrypt or AWS ACM)

---

## 2. Server Setup

### 2.1 System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git nginx certbot python3-certbot-nginx
```

### 2.2 Node.js Installation
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify v20.x
npm --version   # Verify v9.x+
```

### 2.3 PM2 Process Manager
```bash
sudo npm install -g pm2
pm2 startup systemd
```

---

## 3. Database Setup

### 3.1 PostgreSQL Configuration
```bash
# For AWS RDS: Create db.t3.medium instance with PostgreSQL 15
# For local: Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE courtaccess;
CREATE USER courtaccess_user WITH ENCRYPTED PASSWORD '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON DATABASE courtaccess TO courtaccess_user;
\q
```

### 3.2 Database URL Format
```
DATABASE_URL="postgresql://courtaccess_user:<PASSWORD>@<HOST>:5432/courtaccess?schema=public"
```

---

## 4. Application Deployment

### 4.1 Clone Repository
```bash
cd /opt
git clone https://github.com/Sailors071968/Court_Access.git courtaccess
cd courtaccess
```

### 4.2 Backend Setup
```bash
cd backend
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### 4.3 Frontend Build
```bash
cd /opt/courtaccess
npm install
npm run build
```

---

## 5. Environment Variables

### 5.1 Backend Environment (.env)
Create `backend/.env` with the following variables:

```env
# Database
DATABASE_URL="postgresql://courtaccess_user:<PASSWORD>@<HOST>:5432/courtaccess?schema=public"

# Server
PORT=3001
NODE_ENV=production
HOST=0.0.0.0

# CORS
CORS_ORIGIN=https://your-domain.com

# JWT Authentication (generate strong secret)
JWT_SECRET=<GENERATE_WITH: openssl rand -hex 64>
JWT_EXPIRY=24h

# S3 Storage (for evidence files)
S3_BUCKET=courtaccess-evidence
S3_REGION=us-west-2
S3_ACCESS_KEY=<AWS_ACCESS_KEY>
S3_SECRET_KEY=<AWS_SECRET_KEY>

# SMTP (for CPRA emails)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<SENDGRID_API_KEY>
SMTP_FROM=cpra@your-domain.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### 5.2 Frontend Environment
Create `.env.production` in the project root:

```env
VITE_API_URL=https://api.your-domain.com
VITE_APP_NAME=CourtAccess
```

---

## 6. Worker Startup

### 6.1 Quick Deploy (Recommended)
Use the automated deployment script:
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```
This handles backend install, frontend build, PM2 setup, and NGINX configuration.

### 6.2 Manual PM2 Setup
The PM2 ecosystem file is at `ecosystem.config.cjs`. Only the backend runs under PM2:

```bash
# Start backend (API only, port 3001)
PORT=3001 pm2 start npx --name courtaccess-api -- tsx backend/src/server.ts
pm2 save
```

The frontend is served as **static files by NGINX** (no PM2 process needed):
```bash
# Build frontend
npm install && npm run build

# Copy to deployment directory
sudo rsync -a --delete dist/ /var/www/courtaccess/dist/
```

### 6.3 Expected PM2 State
```bash
pm2 status
```
| Name | Port | Purpose |
|------|------|---------|
| courtaccess-api | 3001 | Fastify backend (API only) |

---

## 7. Nginx Configuration

### 7.1 Architecture
```
Client (Browser)
      |
https://courtaccess.net
      |
   NGINX (port 80/443)
    ├── /api/* → proxy to Backend (port 3001, Fastify)
    └── /*     → static files from /var/www/courtaccess/dist/
```

**Critical rules:**
- Backend must NOT serve frontend static files
- `/api` must never return HTML
- All API routes go through NGINX proxy to port 3001
- All other routes served as static files by NGINX (with SPA fallback to index.html)
- No frontend process (no Vite preview, no Node server for frontend)

### 7.2 Install Config
A ready-to-use NGINX config is at `deploy/nginx.conf`. Install it:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/courtaccess
sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7.3 SSL Certificate
```bash
sudo certbot --nginx -d courtaccess.net -d www.courtaccess.net
```

### 7.4 AWS Security Group
Ensure the following ports are open:

| Port | Purpose |
|------|---------|
| 22   | SSH     |
| 80   | HTTP    |
| 443  | HTTPS   |

---

## 8. Post-Deployment Verification

### 8.1 Health Check
```bash
# Internal (direct)
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"...","version":"1.1.0","service":"court-access-backend"}

# External (through NGINX)
curl http://courtaccess.net/api/health
```

### 8.2 Database Verification
```bash
cd backend
npx prisma db seed  # If seed script exists
npx prisma studio   # Visual database browser (development only)
```

### 8.3 Frontend Verification
- Navigate to http://courtaccess.net
- Verify login page loads
- Verify registration flow works
- Verify dashboard pages load after login

### 8.4 API Endpoint Verification
```bash
# Test key endpoints (through NGINX)
curl http://courtaccess.net/api/policy-pipeline/stats
curl http://courtaccess.net/api/compliance/dashboard
curl http://courtaccess.net/api/operations/dashboard
```

### 8.5 Worker Verification
```bash
pm2 status
pm2 logs courtaccess-workers --lines 50
```

---

## 9. Monitoring Setup

### 9.1 PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
```

### 9.2 Application Logs
```bash
# View API logs
pm2 logs courtaccess-api

# View worker logs
pm2 logs courtaccess-workers
```

### 9.3 System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop

# Check resource usage
pm2 monit
```

---

## 10. Deployment Checklist

- [ ] Server provisioned with required specs
- [ ] PostgreSQL database created and accessible
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Backend dependencies installed
- [ ] Prisma client generated
- [ ] Database migrations run
- [ ] Frontend built for production
- [ ] PM2 processes started (API + workers)
- [ ] Nginx configured and running
- [ ] Health check endpoint responding
- [ ] Frontend loads in browser
- [ ] Dashboard pages accessible after login
- [ ] API endpoints returning data
- [ ] Workers processing jobs
- [ ] Log rotation configured
- [ ] Firewall rules set (ports 80, 443 only)
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured

---

## 11. Rollback Procedure

If deployment fails:

```bash
# 1. Stop current deployment
pm2 stop all

# 2. Revert to previous version
cd /opt/courtaccess
git checkout <previous-commit-hash>

# 3. Rebuild
cd backend && npm install && npx prisma generate && npx tsc
cd .. && npm install && npm run build

# 4. Restart
pm2 start ecosystem.config.js --env production

# 5. Verify
curl https://api.your-domain.com/api/health
```

---

## 12. Maintenance Windows

- **Database migrations**: Schedule during off-hours (2-4 AM local time)
- **Version updates**: Deploy to staging first, verify, then promote to production
- **Policy ingestion**: Large crawl jobs should run during low-traffic periods
- **Backups**: Daily automated backups at 3 AM UTC
