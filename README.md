# Court Access

AI-powered legal case management platform for evidence analysis, conflict detection, and courtroom preparation.

**Live:** [https://beta.courtaccess.net](https://beta.courtaccess.net)

---

## System Architecture

```
Client (React + Vite + TailwindCSS)
  |
  |--- REST API (Express.js on Node 20)
  |       |
  |       |--- PostgreSQL (Prisma ORM) ---- Case data, users, evidence records
  |       |--- Redis (BullMQ) ------------- Job queues, caching, rate limiting
  |       |--- Neo4j ---------------------- Evidence graph (nodes + relationships)
  |       |--- Cloudflare R2 -------------- Evidence file storage
  |       |--- OpenAI API ----------------- AI analysis (entity extraction, conflict detection)
  |       |--- Stripe --------------------- Subscription billing
  |       |--- Sentry --------------------- Error monitoring
  |
  |--- GitHub Actions CI/CD
          |--- Lint + Typecheck
          |--- Unit Tests (Vitest)
          |--- Integration Tests
          |--- Build
          |--- Deploy (EC2 via SSH)
```

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS + shadcn/ui components
- **State:** Zustand (auth store, case store)
- **Routing:** React Router v6 (role-based protected routes)
- **Charts:** Recharts (evidence dashboard, analytics)

### Backend
- **Runtime:** Node.js 20 + Express.js
- **Database:** PostgreSQL via Prisma ORM
- **Cache/Queues:** Redis + BullMQ (5 worker queues)
- **Graph DB:** Neo4j (evidence relationship graph)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Auth:** JWT (access + refresh tokens)
- **Payments:** Stripe (checkout sessions + webhooks)

---

## Graph Intelligence Pipeline

The evidence graph engine processes uploaded documents through 5 sequential engines:

```
Document Upload
  |
  v
[1] Entity Extraction Engine
    - Extracts people, events, locations, organizations
    - NLP-powered with OpenAI fallback
    - Output: GraphNode[] with typed entities
  |
  v
[2] Timeline Engine
    - Orders events chronologically
    - Detects temporal gaps and overlaps
    - Output: TimelineEvent[] with confidence scores
  |
  v
[3] Conflict Detection Engine
    - Cross-references statements against timeline
    - Identifies contradictions between witnesses
    - Output: Conflict[] with severity ratings
  |
  v
[4] Graph Intelligence Engine
    - Builds relationship graph (Neo4j)
    - Computes centrality, clustering, path analysis
    - BFS traversal with depth limits
    - Output: GraphAnalysis with community detection
  |
  v
[5] Evidence Strength Engine
    - Scores evidence items (0-100)
    - Weights: corroboration, source reliability, recency
    - Output: EvidenceScore[] with factor breakdown
```

### Graph Safety
- **Cypher injection protection:** All relationship types validated against enum before query execution
- **Tenant isolation:** Every graph query filtered by `caseId` -- no cross-case data leakage
- **Traversal depth limits:** BFS capped at configurable max depth (default: 10)
- **Cache invalidation:** Redis SCAN-based (non-blocking) pattern matching

---

## AI Analysis Workflow

```
User Request
  |
  v
[AI Safety Layer] -----> Rate limit check (per-user + per-case)
  |                       Prompt sanitization (strip injection attempts)
  |                       Token budget enforcement (max 4096 tokens)
  |                       Timeout protection (30s max)
  |
  v
[OpenAI API Call] -----> Structured response validation
  |                       JSON schema enforcement
  |                       Hallucination detection (confidence thresholds)
  |
  v
[Response Processing] -> Cache result in Redis (TTL: 1 hour)
                         Log metrics (tokens used, latency, model)
                         Return typed result to client
```

### Safety Guardrails
- **Rate limiting:** 10 AI requests/minute per user, 50/hour per case
- **Token budget:** Max 4096 tokens per request, tracked per-user
- **Prompt sanitization:** Strips system prompt overrides, injection patterns
- **No raw document access:** AI receives extracted text only, never file buffers
- **Structured validation:** All AI responses validated against expected JSON schema
- **Timeout protection:** 30-second hard timeout on all AI calls

---

## BullMQ Worker Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `document-processing` | Parse uploaded documents (PDF, DOCX, images) | 3 |
| `entity-indexing` | Extract and index entities from parsed text | 2 |
| `timeline-generation` | Build chronological event timelines | 2 |
| `conflict-detection` | Cross-reference statements for contradictions | 2 |
| `graph-builder` | Build/update Neo4j evidence graph | 1 |

Queue monitoring available at `/admin/system-health` (Queue Monitor tab) and via Bull Board integration.

---

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Neo4j 5+ (optional -- falls back to in-memory graph)

### Install and Run

```bash
# Clone
git clone https://github.com/Sailors071968/Court_Access.git
cd Court_Access

# Install dependencies
npm install

# Environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Database setup
npx prisma migrate deploy
npx prisma generate

# Start development
npm run dev          # Frontend (Vite on :5173)
node backend/src/server.js  # Backend (Express on :3001)
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (min 32 chars) |
| `REDIS_URL` | Yes | Redis connection URL |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `OPENAI_API_KEY` | No | OpenAI API key (for AI analysis) |
| `NEO4J_URI` | No | Neo4j Bolt URI (default: bolt://localhost:7687) |
| `NEO4J_USER` | No | Neo4j username |
| `NEO4J_PASSWORD` | No | Neo4j password |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | No | R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 secret key |
| `R2_BUCKET_NAME` | No | R2 bucket name |
| `SENTRY_DSN` | No | Sentry error tracking DSN |

---

## Testing

### Unit Tests
```bash
npx vitest run                    # Run all unit tests
npx vitest run --coverage         # With coverage report
```

Coverage targets >80% on all 5 backend engines.

### Integration Tests
```bash
npx vitest run --config vitest.integration.config.ts
```

### Load Tests
```bash
npx tsx tests/load/largeCaseLoadTest.ts
```

Simulates 1000 entities, 5000 relationships, 500 events. Performance targets: <200ms graph queries, <100ms neighbor expansion.

### Graph Query Safety Tests
```bash
npx vitest run tests/unit/graphQuerySafety.test.ts
```

Validates Cypher injection protection, tenant isolation, traversal depth limits.

---

## CI/CD Pipeline

### Continuous Integration (`.github/workflows/ci.yml`)

Triggers on PR and push to `dev`:

```
[1] lint-and-typecheck
    - ESLint + TypeScript noEmit
    |
[2] unit-tests (parallel)
    - Vitest with coverage
    |
[3] integration-tests (parallel)
    - API endpoint tests
    |
[4] build (depends on 1,2,3)
    - Vite production build
```

### Deployment Pipeline (`.github/workflows/deploy.yml`)

Triggers on push to `main` or manual dispatch:

```
[1] build-and-test
    - Full lint, typecheck, test, build
    - Upload build artifact
    |
[2] deploy
    - Download artifact
    - rsync frontend to EC2
    - rsync backend to EC2
    - Run Prisma migrations
    - Restart PM2 processes
    - Health check (curl /api/health)
```

---

## Production Hardening (Phase 119)

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/verifyGraphIntegrity.ts` | Nightly graph integrity checks (duplicates, orphans, cross-case contamination) |
| `scripts/securityAudit.ts` | Automated security audit (JWT, CORS, Helmet, upload limits, injection protection) |

### Monitoring

| Component | Location |
|-----------|----------|
| Performance Profiler | `backend/src/services/performanceProfiler.js` |
| Queue Monitor | `backend/src/services/queueMonitor.js` |
| AI Safety Layer | `backend/src/middleware/aiSafetyLayer.js` |
| System Health Dashboard | `/admin/system-health` |
| Error Monitoring | Sentry (via `@sentry/node`) |

### Performance Thresholds

| Operation | Threshold | Alert |
|-----------|-----------|-------|
| Graph query | 200ms | Logged as slow |
| Timeline query | 200ms | Logged as slow |
| Entity extraction | 5000ms | Logged as slow |
| API endpoint | 500ms | Logged as slow |
| AI analysis | 10000ms | Logged as slow |

---

## Project Structure

```
court-access-frontend/
  src/
    pages/           # React pages (case, admin, auth, landing)
    components/      # Shared UI components
    stores/          # Zustand state stores
    lib/             # Utilities, API client, types
  backend/
    src/
      config/        # Centralized configuration
      middleware/     # Auth, rate limiting, AI safety, upload limits
      routes/        # Express route handlers
      services/      # Business logic (graph, cache, R2, profiler)
      workers/       # BullMQ job processors
  tests/
    unit/            # Vitest unit tests
    integration/     # API integration tests
    load/            # Performance/load test scripts
  scripts/           # Maintenance scripts (integrity checks, security audit)
  .github/workflows/ # CI/CD pipelines
  prisma/            # Database schema + migrations
```

---

## License

Proprietary. All rights reserved.
