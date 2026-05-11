# CourtAccess — Incremental Production Restoration Plan

**Starting baseline:** Minimal Express recovery bootstrap on port 3000, NGINX + HTTPS working, PM2 stable.

**Target:** Full Fastify backend (port 3001) + static frontend via NGINX, all subsystems restored.

---

## Architecture Overview

```
Client (Browser)
      │
https://courtaccess.net
      │
   NGINX (port 80 → 443)
    ├── /api/*  → proxy to Fastify backend (port 3001)
    └── /*      → static files from /var/www/courtaccess/dist/
```

**PM2 processes:** Only `courtaccess-api` (backend). Frontend is static files served by NGINX.

---

## Dependency Map

```
                    ┌──────────────┐
                    │  PostgreSQL   │  ← Required by ALL stages
                    │  (Prisma)     │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Auth/JWT  │ │  Cases &    │ │   Admin     │
    │   (Stage 2) │ │  Evidence   │ │   (Stage 3) │
    │             │ │  (Stage 3)  │ │             │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
    ┌──────▼──────┐ ┌──────▼──────────────┐
    │   Billing   │ │  Analysis Engines   │
    │   Stripe    │ │  Contradiction,     │
    │  (Stage 4)  │ │  Narrative, Timeline│
    │             │ │  (Stage 5)          │
    └─────────────┘ └──────┬──────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Redis +    │ │   CPRA      │ │  Ingestion  │
    │  BullMQ     │ │  Pipeline   │ │  OCR/Intel  │
    │  Workers    │ │  (Stage 7)  │ │  (Stage 8)  │
    │  (Stage 6)  │ │             │ │             │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Stage 0 — Frontend Rebuild & NGINX Static Serving

**Risk:** LOW  
**Dependencies:** None (frontend is independent)  
**What:** Build current frontend and serve via NGINX.

### Commands
```bash
# On EC2:
cd /var/www/courtaccess

# Pull latest code (after merging PR #96)
git pull origin dev

# Install frontend deps and build
npm install
npm run build

# Verify build output
ls dist/
# Must show: index.html, assets/

# Deploy to NGINX root
sudo mkdir -p /var/www/courtaccess/dist
# (build output is already in /var/www/courtaccess/dist if repo is at /var/www/courtaccess)

# Update NGINX to serve static files (use deploy/nginx.conf from PR #96)
sudo cp deploy/nginx.conf /etc/nginx/sites-available/courtaccess
sudo ln -sf /etc/nginx/sites-available/courtaccess /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Verification
```bash
# Frontend should load via NGINX
curl -s http://localhost | head -5
# Must show HTML with <div id="root">
```

### Important
- Frontend uses relative `/api` paths — no hardcoded localhost URLs
- NGINX `try_files` handles SPA routing (all non-file paths → index.html)
- The old Express recovery bootstrap can stay running on port 3000 during this stage

---

## Stage 1 — Core Fastify Server + Health Check (replaces Express bootstrap)

**Risk:** MEDIUM  
**Dependencies:** PostgreSQL (DATABASE_URL), Prisma  
**What:** Replace the Express recovery bootstrap with the Fastify backend, but with workers and Redis DISABLED.

### Environment Setup
```bash
cd /var/www/courtaccess/backend

# Create .env from template
cp .env.production.template .env

# Fill in REQUIRED values:
#   DATABASE_URL     — your PostgreSQL connection string
#   JWT_SECRET       — generate with: openssl rand -hex 64
#   JWT_REFRESH_SECRET — generate with: openssl rand -hex 64
#   COOKIE_SECRET    — generate with: openssl rand -hex 32
#   NODE_ENV=production
#   PORT=3001
#   HOST=0.0.0.0
#   FRONTEND_URL=https://courtaccess.net
#
# Leave all other vars (Stripe, AWS, Redis, R2, OpenAI) as placeholders for now.
# Add this to DISABLE workers and Redis-dependent features:
echo 'DISABLE_WORKERS=true' >> .env
```

### Install & Prisma Setup
```bash
cd /var/www/courtaccess/backend
npm install

# Generate Prisma client
npx prisma generate

# Check migration status (DO NOT run migrate deploy yet if unsure)
npx prisma migrate status

# If migrations are clean, run them:
npx prisma migrate deploy
```

### Bypass Schema Assertion (if needed)
The server runs `enforceSchemaOnBoot()` which hard-fails if migrations are pending or schema is drifted. If this blocks startup, set:
```bash
echo 'SKIP_SCHEMA_ASSERT=true' >> backend/.env
```
And add a check in `backend/src/database/schemaAssert.ts` (line 1):
```typescript
if (process.env.SKIP_SCHEMA_ASSERT === 'true') {
  console.warn('[SchemaAssert] Skipped via SKIP_SCHEMA_ASSERT env var');
  return;
}
```

### Start Fastify Backend
```bash
# Stop old Express bootstrap
pm2 delete all

# Start Fastify backend on port 3001
cd /var/www/courtaccess
PORT=3001 pm2 start npx \
  --name courtaccess-api \
  -- tsx backend/src/server.ts

pm2 save
```

### Update NGINX (switch /api proxy from 3000 → 3001)
The `deploy/nginx.conf` from PR #96 already points to port 3001. If you manually configured NGINX to proxy to 3000, update it:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/courtaccess
sudo nginx -t && sudo systemctl reload nginx
```

### Verification
```bash
# Direct backend health check
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"...","version":"1.1.0","service":"court-access-backend"}

# Through NGINX
curl https://courtaccess.net/api/health
# Expected: same JSON (NOT HTML)

# PM2 status
pm2 status
# Expected: courtaccess-api | online

# Check logs for errors
pm2 logs courtaccess-api --lines 50
```

### Rollback
If Fastify fails to start, restore the Express bootstrap:
```bash
pm2 delete courtaccess-api
# Re-start your original Express recovery server on port 3000
# Update NGINX to proxy to port 3000 again
```

---

## Stage 2 — Authentication (JWT + Auth Routes)

**Risk:** LOW (already wired in server.ts)  
**Dependencies:** PostgreSQL, JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET  
**What:** Auth routes are already registered in server.ts. Just verify they work.

### Files involved
- `backend/src/security/authMiddleware.ts` — JWT auth, login, register, refresh, logout
- `backend/src/security/csrfProtection.ts` — CSRF token endpoint
- `backend/src/security/rateLimiter.ts` — Rate limiting
- `backend/src/security/securityHeaders.ts` — Security headers
- `backend/src/security/securityLogger.ts` — Audit logging

### Verification
```bash
# Register a test user
curl -X POST https://courtaccess.net/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"TestPass123!","role":"attorney"}'

# Login
curl -X POST https://courtaccess.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
# Expected: {"token":"eyJ...","refreshToken":"...","user":{...}}

# Test authenticated endpoint
curl https://courtaccess.net/api/auth/me \
  -H 'Authorization: Bearer <TOKEN_FROM_LOGIN>'
```

### Notes
- Auth hook is currently commented out in server.ts (line 94: `// app.addHook('onRequest', authenticationHook)`) — routes work without global auth enforcement
- CSRF hook is also commented out (line 97) — enable later after frontend integration is confirmed

---

## Stage 3 — Case Management, Evidence, Admin Routes

**Risk:** LOW  
**Dependencies:** PostgreSQL, Auth (Stage 2)  
**What:** Already registered in server.ts. These provide core CRUD for cases, evidence upload, and admin.

### Route groups
| Module | Routes | Notes |
|--------|--------|-------|
| Cases | `POST/GET/PATCH/DELETE /api/cases` | Core case CRUD |
| Evidence | `POST /api/evidence/upload`, `GET /api/cases/:caseId/evidence` | File upload needs S3/R2 |
| Evidence Requests | `GET /api/cases/:caseId/evidence-requests` | AI gap detection |
| Admin | `GET /api/admin/stats`, `GET /api/admin/users` | System overview |
| Charges | `GET/POST /api/charges` | Charge management |
| CALCRIM | `GET /api/calcrim` | Jury instructions |

### Verification
```bash
# Create a case
curl -X POST https://courtaccess.net/api/cases \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"title":"Test Case","description":"Test"}'

# List cases
curl https://courtaccess.net/api/cases \
  -H 'Authorization: Bearer <TOKEN>'

# Admin stats
curl https://courtaccess.net/api/admin/stats \
  -H 'Authorization: Bearer <TOKEN>'
```

### Note on Evidence Upload
Evidence upload routes depend on S3/R2 storage. Upload will fail until Stage 4 configures cloud storage credentials. The routes will still register — they'll just return errors on actual upload attempts.

---

## Stage 4 — Billing (Stripe) + Cloud Storage

**Risk:** MEDIUM (requires real Stripe credentials)  
**Dependencies:** Stripe API keys, Cloudflare R2 keys  

### Environment Variables Needed
```bash
# Add to backend/.env:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2 (for evidence file storage)
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=courtaccess-cpra-attachments
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
```

### Route groups
| Module | Routes | Notes |
|--------|--------|-------|
| Billing | `/api/billing/*` | Subscription management |
| Stripe Webhooks | `POST /api/billing/webhook` | Stripe event handler |
| Discounts | `GET /api/discount-codes/*` | Promo codes |
| AI Credits | Integrated in billing | Usage tracking |

### Verification
```bash
# Check billing routes respond
curl https://courtaccess.net/api/billing/plans \
  -H 'Authorization: Bearer <TOKEN>'

# Validate discount code
curl 'https://courtaccess.net/api/discount-codes/validate?code=HUNT100' \
  -H 'Authorization: Bearer <TOKEN>'
```

### Stripe Webhook Setup
Ensure the Stripe webhook endpoint is configured in the Stripe dashboard:
- URL: `https://courtaccess.net/api/billing/webhook`
- Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`

---

## Stage 5 — Analysis Engines (No Redis needed)

**Risk:** LOW  
**Dependencies:** PostgreSQL, Auth  
**What:** These route handlers do synchronous analysis — they don't need Redis/BullMQ.

### Route groups
| Module | Routes | Notes |
|--------|--------|-------|
| Compliance | `GET /api/compliance/dashboard`, `POST /api/compliance/analyze` | Policy compliance |
| Forensic | `POST /api/forensic/vision/analyze`, etc. | Scene reconstruction |
| Contradiction | `POST /api/contradiction/analyze/:caseId` | Inconsistency detection |
| Narrative | `POST /api/narrative/analyze/:caseId` | Narrative deconstruction |
| Timeline | `GET /api/timeline/:caseId` | Event timeline |
| Policy Pipeline | `GET /api/policy-pipeline/stats` | Pipeline dashboard |
| Operations | `GET /api/operations/dashboard` | Ops console |

### Verification
```bash
curl https://courtaccess.net/api/compliance/dashboard \
  -H 'Authorization: Bearer <TOKEN>'

curl https://courtaccess.net/api/contradiction/status

curl https://courtaccess.net/api/policy-pipeline/stats
```

---

## Stage 6 — Redis + BullMQ Workers

**Risk:** HIGH  
**Dependencies:** Redis server running, all previous stages  
**What:** Enable background job processing for heavy workloads.

### Prerequisites
```bash
# Install Redis if not already running
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping
# Expected: PONG
```

### Environment Variables
```bash
# Add to backend/.env:
REDIS_URL=redis://localhost:6379

# Remove the DISABLE_WORKERS flag:
# Delete the line: DISABLE_WORKERS=true
```

### Restart Backend
```bash
pm2 restart courtaccess-api
pm2 logs courtaccess-api --lines 20
# Should see: [Redis] Connected to redis://localhost:6379
# Should see: [PipelineWorkers] Started 5 workers
```

### Workers Started
| Worker | Queue | Purpose |
|--------|-------|---------|
| `timelineProcessingWorker` | timeline | Event timeline reconstruction |
| `narrativeProcessingWorker` | narrative | Narrative analysis |
| `contradictionAnalysisWorker` | contradiction | Inconsistency detection |
| `videoProcessingWorker` | video | Video evidence processing |
| `doctrineAnalysisWorker` | doctrine | Legal doctrine analysis |

### Verification
```bash
# Check Redis connection
redis-cli info clients | head -5

# Check queue monitor
curl https://courtaccess.net/api/admin/queues \
  -H 'Authorization: Bearer <TOKEN>'
```

### PM2 Standalone Workers (Optional)
The ecosystem.config.cjs defines additional standalone workers. Only start these if needed:
```bash
# These are OPTIONAL — only start if the corresponding subsystem is active
pm2 start ecosystem.config.cjs --only cpra-email-monitor-worker
pm2 start ecosystem.config.cjs --only contradiction-worker
pm2 start ecosystem.config.cjs --only doctrine-worker
```

---

## Stage 7 — CPRA Pipeline (Email + Policy Acquisition)

**Risk:** MEDIUM  
**Dependencies:** Redis, AWS SES, Cloudflare R2  

### Environment Variables
```bash
# Add to backend/.env:
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=cpra@courtaccess.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
CPRA_SIMULATION_MODE=true   # Start in simulation mode!
CPRA_MAX_EMAILS_PER_DAY=50
CPRA_MAX_EMAILS_PER_MINUTE=5
```

### Route groups
| Module | Routes | Notes |
|--------|--------|-------|
| Policy Matrix | `GET /api/cpra/policy-matrix` | Agency coverage map |
| Autonomous CPRA | `POST /api/cpra/campaigns` | Email campaign management |
| CPRA Workers | Background | Email monitor, follow-up, ingestion |

### Verification
```bash
curl https://courtaccess.net/api/cpra/policy-matrix/stats \
  -H 'Authorization: Bearer <TOKEN>'
```

### Caution
- Start with `CPRA_SIMULATION_MODE=true` to prevent sending real emails
- Only switch to `false` after verifying the pipeline end-to-end

---

## Stage 8 — Ingestion & Intelligence Services (OCR, Crawling)

**Risk:** HIGH  
**Dependencies:** Redis, Tesseract.js, Selenium/ChromeDriver, OpenAI  

### Prerequisites
```bash
# Tesseract.js uses WASM — no system install needed
# ChromeDriver for web crawling (already in package.json deps)

# OpenAI for AI classification
echo 'OPENAI_API_KEY=sk-...' >> backend/.env
```

### Subsystems
| System | Files | Purpose |
|--------|-------|---------|
| Corpus Ingestion | `backend/src/ingestion/` | Document parsing + chunking |
| OCR Pipeline | `backend/src/policy/workers/ocrWorker.ts` | PDF text extraction |
| Web Crawling | `backend/src/policy/workers/siteCrawlWorker.ts` | Agency policy crawling |
| Classification | `backend/src/policy/workers/classificationWorker.ts` | AI document classification |

### Start Incrementally
```bash
# Start OCR worker only first
pm2 start ecosystem.config.cjs --only cpra-ingestion-worker

# Monitor
pm2 logs cpra-ingestion-worker --lines 20
```

---

## Stage 9 — Observability & Monitoring

**Risk:** LOW  
**Dependencies:** Redis (for deep health checks)  

### Routes
```bash
# Deep health check (tests DB + Redis + queue connectivity)
curl https://courtaccess.net/api/health/deep

# Prometheus-style metrics
curl https://courtaccess.net/api/metrics

# JSON metrics
curl https://courtaccess.net/api/metrics/json
```

### PM2 Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
```

---

## Quick Reference — Environment Variables by Stage

| Stage | Required Variables |
|-------|-------------------|
| 0 (Frontend) | None |
| 1 (Core Server) | `DATABASE_URL`, `PORT=3001`, `HOST=0.0.0.0`, `NODE_ENV=production`, `FRONTEND_URL`, `DISABLE_WORKERS=true` |
| 2 (Auth) | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` |
| 3 (Cases/Evidence) | Same as Stage 2 |
| 4 (Billing) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `R2_*` |
| 5 (Analysis) | Same as Stage 2 |
| 6 (Redis/Workers) | `REDIS_URL`, remove `DISABLE_WORKERS` |
| 7 (CPRA) | `AWS_SES_*`, `AWS_ACCESS_KEY_*`, `CPRA_*` |
| 8 (Ingestion) | `OPENAI_API_KEY` |

---

## PM2 Final State (All Stages Complete)

```bash
pm2 status
```

| Name | Port | Purpose |
|------|------|---------|
| courtaccess-api | 3001 | Fastify backend (all routes) |

Optional standalone workers (only if needed):
| Name | Purpose |
|------|---------|
| cpra-email-monitor-worker | CPRA inbox polling |
| cpra-followup-worker | CPRA deadline follow-ups |
| cpra-ingestion-worker | CPRA document processing |
| contradiction-worker | Background contradiction analysis |
| doctrine-worker | Legal doctrine analysis |
| video-processing-worker | Video evidence processing |

---

## NGINX Final Config

See `deploy/nginx.conf` in PR #96. Key points:
- `root /var/www/courtaccess/dist;` — static frontend
- `location /api/` — proxy to `127.0.0.1:3001`
- `try_files $uri $uri/ /index.html` — SPA fallback
- `client_max_body_size 500M` — evidence uploads
- SSL via Let's Encrypt: `sudo certbot --nginx -d courtaccess.net -d www.courtaccess.net`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/api` returns HTML | NGINX not proxying correctly | Check `proxy_pass` points to 3001 |
| Site times out | Frontend PM2 process not running | Frontend is static — check NGINX root path |
| `enforceSchemaOnBoot` fails | DB migrations pending | Run `npx prisma migrate deploy` or set `SKIP_SCHEMA_ASSERT=true` |
| Redis connection refused | Redis not installed/running | `sudo systemctl start redis-server` |
| Workers not starting | `DISABLE_WORKERS=true` still set | Remove from `.env` |
| Stripe webhook 400 | Wrong webhook secret | Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard |
| CORS errors | Frontend URL not in allowed origins | Check `FRONTEND_URL` in `.env` and `CORS_ORIGINS` in server.ts |
