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

### 6.1 PM2 Ecosystem File
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'courtaccess-api',
      script: 'backend/dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'courtaccess-workers',
      script: 'backend/dist/policy/workers/startWorkers.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 6.2 Start Services
```bash
# Build TypeScript
cd backend && npx tsc

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 7. Nginx Configuration

### 7.1 Site Configuration
Create `/etc/nginx/sites-available/courtaccess`:

```nginx
server {
    listen 80;
    server_name your-domain.com api.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend (static files)
    root /opt/courtaccess/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Evidence file uploads
    client_max_body_size 500M;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API proxy
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running analysis
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    client_max_body_size 500M;
}
```

### 7.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.3 SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

---

## 8. Post-Deployment Verification

### 8.1 Health Check
```bash
curl https://api.your-domain.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 8.2 Database Verification
```bash
cd /opt/courtaccess/backend
npx prisma db seed  # If seed script exists
npx prisma studio   # Visual database browser (development only)
```

### 8.3 Frontend Verification
- Navigate to https://your-domain.com
- Verify login page loads
- Verify registration flow works
- Verify dashboard pages load after login

### 8.4 API Endpoint Verification
```bash
# Test key endpoints
curl https://api.your-domain.com/api/policy-pipeline/stats
curl https://api.your-domain.com/api/compliance/dashboard
curl https://api.your-domain.com/api/operations/dashboard
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
