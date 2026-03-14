# CourtAccess — Full System Architecture Inventory

**Generated:** 2026-03-14
**Version:** 1.1.0
**Production URL:** https://courtaccess.net
**Infrastructure:** AWS EC2 (13.223.68.11)

---

## 1. Authentication System

| Field | Value |
|---|---|
| **Description** | JWT-based authentication with role-based access control, refresh token rotation, and security event logging |
| **Major Components** | authMiddleware.ts (JWT verify, RBAC hook), login/register/refresh/logout endpoints, role hierarchy (admin > attorney > investigator > staff > defendant), security event log |
| **Completion** | 90% |
| **Production Status** | Active — all auth routes functional, JWT tokens issued and verified |
| **Missing Capabilities** | Database-backed user store (currently in-memory Map), password reset flow, email verification, OAuth2/SSO integration, account lockout after failed attempts |

---

## 2. Subscription Billing System

| Field | Value |
|---|---|
| **Description** | Stripe-integrated subscription management with 6 tiers, checkout session creation, webhook-driven activation |
| **Major Components** | subscriptionService.ts (plan definitions, user subscription state), billingRoutes.ts (plan listing, subscription CRUD), stripeCheckoutRoutes.ts (Stripe Checkout sessions, webhook handler, ACU pack purchase) |
| **Completion** | 75% |
| **Production Status** | Active — plan definitions live, Stripe checkout endpoint ready (requires STRIPE_SECRET_KEY env var) |
| **Missing Capabilities** | Stripe Price ID configuration for each plan, subscription cancellation/downgrade flow, proration handling, invoice history, payment method management, database persistence for subscriptions |

### Subscription Plans

| Plan | Price/mo | Pages/mo | AI Credits |
|---|---|---|---|
| FREE | $0 | 10 | 0 |
| STARTER | $39 | 300 | 20 |
| PROFESSIONAL | $129 | 2,000 | 100 |
| ADVANCED INVESTIGATOR | $249 | 6,000 | 250 |
| LITIGATION PRO | $399 | 12,000 | 500 |
| ENTERPRISE FIRM | $699 | 25,000 | 1,500 |

---

## 3. ACU (Analysis Compute Unit) Credit System

| Field | Value |
|---|---|
| **Description** | Hybrid credit system with monthly allowances + purchasable packs, pre-processing validation, upload lockout on exhaustion |
| **Major Components** | aiCreditService.ts (balance tracking, deduction, purchase), acuEnforcementMiddleware.ts (validateACUBalance, upload lock hook, pipeline cost map), usageEnforcementService.ts (page limits, credit limits, usage dashboard) |
| **Completion** | 85% |
| **Production Status** | Active — credit balance tracking, deduction, enforcement hooks wired into server |
| **Missing Capabilities** | Database persistence (currently in-memory), credit expiration policy, usage analytics dashboard, automatic monthly reset cron job, purchased credit rollover enforcement (90-day window) |

### ACU Credit Packs (Stripe)

| Pack | Credits | Price |
|---|---|---|
| acu_100 | 100 | $49 |
| acu_500 | 500 | $199 |
| acu_1000 | 1,000 | $349 |

### ACU Pipeline Costs

| Pipeline | Credits | Analysis Type |
|---|---|---|
| timeline-reconstruction | 2 | CONTRADICTION_ENGINE |
| narrative-claim-extraction | 1 | DOCTRINE_ANALYSIS |
| narrative-normalization | 1 | DOCTRINE_ANALYSIS |
| narrative-validation | 1 | RELIABILITY_SCORING |
| contradiction-analysis | 2 | CONTRADICTION_ENGINE |
| video-segmentation | 3 | VIDEO_PROCESSING |
| evidence-processing | 1 | DOCTRINE_ANALYSIS |

---

## 4. Evidence Upload System

| Field | Value |
|---|---|
| **Description** | Presigned URL upload to Cloudflare R2, document metadata tracking, multi-format support (PDF, DOCX, images, video) |
| **Major Components** | evidenceRoutes.ts (upload-url, evidence CRUD), R2 presigned URL generation, evidence metadata store, file type validation |
| **Completion** | 80% |
| **Production Status** | Active — upload endpoint functional, R2 integration configured |
| **Missing Capabilities** | Virus/malware scanning, automatic OCR on upload, thumbnail generation, bulk upload support, upload progress tracking, storage quota enforcement |

---

## 5. Evidence Processing Pipeline

| Field | Value |
|---|---|
| **Description** | Multi-stage document processing: text extraction, OCR, PDF parsing, metadata enrichment |
| **Major Components** | evidenceProcessingWorker (BullMQ-style), pdf-parse integration, Tesseract.js OCR, document normalization |
| **Completion** | 60% |
| **Production Status** | Partial — processing pipeline defined, worker stubs in place |
| **Missing Capabilities** | Full OCR pipeline activation, document classification ML model, automatic page counting, batch processing, processing status webhooks |

---

## 6. Timeline Reconstruction Engine

| Field | Value |
|---|---|
| **Description** | Automatic event extraction from evidence documents, temporal ordering, conflict detection between sources |
| **Major Components** | timelineRoutes.ts (API stubs), temporalExtractionWorker.ts, eventCorrelationWorker.ts, timelineProcessingRunner.ts (PM2 daemon) |
| **Completion** | 45% |
| **Production Status** | Stub — API routes return empty data, worker infrastructure rebuilt with proper main loops |
| **Missing Capabilities** | NLP temporal extraction engine, event correlation algorithm, timeline visualization data format, cross-document event merging, confidence scoring |

---

## 7. Narrative Deconstruction Engine

| Field | Value |
|---|---|
| **Description** | Extract claims from witness statements, normalize language, validate against evidence, detect impeachment opportunities |
| **Major Components** | narrativeRoutes.ts (API stubs), claim extraction pipeline, normalization pipeline, validation pipeline, narrativeProcessingRunner.ts (PM2 daemon) |
| **Completion** | 40% |
| **Production Status** | Stub — API routes return empty data, worker infrastructure rebuilt |
| **Missing Capabilities** | NLP claim extraction model, semantic normalization, evidence cross-reference validation, impeachment candidate scoring, narrative comparison |

---

## 8. Contradiction Detection Engine

| Field | Value |
|---|---|
| **Description** | 9-phase contradiction detection: ontology, extraction, analysis, graph building, recommendations |
| **Major Components** | contradiction/index.ts (route registration), contradictionWorker.ts, ontology definitions, extraction pipeline, analysis engine |
| **Completion** | 65% |
| **Production Status** | Active — routes registered, worker in ecosystem config, ontology and extraction endpoints functional |
| **Missing Capabilities** | Full NLP contradiction detection, severity scoring calibration, explainability layer, real-time contradiction alerts |

---

## 9. Evidence Graph System

| Field | Value |
|---|---|
| **Description** | Graph-based evidence relationship modeling with nodes (facts, documents, evidence) and edges (supports, contradicts, derived_from) |
| **Major Components** | graph/ directory (schema definitions, query builders), graphIntegrityCheck.ts (8 integrity validators), graphIntegrityRunner.ts (PM2 daemon) |
| **Completion** | 55% |
| **Production Status** | Active — integrity checks defined, graph schema canonical, runner daemon operational |
| **Missing Capabilities** | Neo4j connection activation, real-time graph updates on evidence upload, graph visualization API, relationship confidence scoring |

---

## 10. Neo4j Intelligence Layer

| Field | Value |
|---|---|
| **Description** | Knowledge graph storage for legal entities, relationships, and evidence chains using Neo4j |
| **Major Components** | neo4j-driver dependency, Cypher query definitions in integrity checks, entity extraction pipeline stubs |
| **Completion** | 30% |
| **Production Status** | Configured — driver installed, queries defined, Neo4j instance not yet provisioned |
| **Missing Capabilities** | Neo4j server provisioning, connection pool management, entity extraction pipeline, relationship inference engine, graph traversal API |

---

## 11. Forensic Reconstruction Engine

| Field | Value |
|---|---|
| **Description** | Computer vision analysis for bodycam/dashcam footage, trajectory analysis, visibility simulation, scene reconstruction |
| **Major Components** | forensicReconstructionRoutes.ts (vision analysis, trajectory, visibility, line-of-sight, camera sync, scene building), expert package generation, jury view generation |
| **Completion** | 50% |
| **Production Status** | Active — all forensic API endpoints registered and returning structured responses |
| **Missing Capabilities** | Computer vision ML model integration, 3D scene rendering, real video frame analysis, expert witness report generation, jury-ready visualization export |

---

## 12. Policy Intelligence System

| Field | Value |
|---|---|
| **Description** | CHP taxonomy-based policy classification, coverage analysis, intelligence dashboard |
| **Major Components** | policyIntelligenceRoutes.ts, CHP taxonomy (LD-15 through LD-30), doctrine intelligence, classification validator |
| **Completion** | 70% |
| **Production Status** | Active — taxonomy loaded, classification endpoints functional, dashboard populated |
| **Missing Capabilities** | Real-time policy update tracking, automated policy comparison, policy gap analysis reporting |

---

## 13. CPRA Acquisition System

| Field | Value |
|---|---|
| **Description** | Autonomous California Public Records Act request system with agency directory, campaign engine, email monitoring, follow-up automation |
| **Major Components** | autonomousCpraRoutes.ts, policyMatrixRoutes.ts, cpraEmailMonitorWorker.ts, cpraFollowUpWorker.ts, cpraIngestionWorker.ts, agency directory |
| **Completion** | 65% |
| **Production Status** | Active — agency directory populated, campaign routes functional, 3 CPRA workers in PM2 |
| **Missing Capabilities** | AWS SES email integration activation, real agency email sending, response parsing ML, compliance deadline tracking, appeal generation |

---

## 14. Admin Dashboard

| Field | Value |
|---|---|
| **Description** | Administrative interface for user management, case oversight, system statistics, discount code management |
| **Major Components** | adminRoutes.ts (stats, users, cases, delete endpoints), AdminPage.tsx (frontend), discount code CRUD |
| **Completion** | 75% |
| **Production Status** | Active — admin routes functional, frontend dashboard rendering |
| **Missing Capabilities** | Bulk user operations, audit trail export, system configuration UI, user impersonation, billing override |

---

## 15. Operations Console

| Field | Value |
|---|---|
| **Description** | Operational monitoring dashboard for pipeline status, deadlines, topic tracking |
| **Major Components** | operationsConsoleRoutes.ts (dashboard, deadlines, topics, report generation), populate endpoint |
| **Completion** | 60% |
| **Production Status** | Active — operations routes registered, dashboard data available |
| **Missing Capabilities** | Real-time WebSocket updates, alerting integration, SLA monitoring, operational playbooks |

---

## 16. Queue Monitoring System

| Field | Value |
|---|---|
| **Description** | BullMQ-style queue visibility with metrics, alerts, and worker status tracking |
| **Major Components** | queueMonitor.ts (metrics collection, alert thresholds), queueMonitorRoutes.ts (admin API), queueMonitorRunner.ts (PM2 daemon polling every 30s) |
| **Completion** | 70% |
| **Production Status** | Active — queue dashboard data collection running, alerts defined, PM2 daemon operational |
| **Missing Capabilities** | Redis/BullMQ actual queue integration, job retry UI, dead letter queue management, historical metrics storage |

---

## 17. System Health Monitoring

| Field | Value |
|---|---|
| **Description** | Comprehensive health checks for workers, queues, databases, and memory with degradation detection |
| **Major Components** | systemHealth.ts (health report assembly, memory metrics, DB ping stubs), systemHealthRunner.ts (PM2 daemon polling every 60s) |
| **Completion** | 65% |
| **Production Status** | Active — health endpoint functional, memory monitoring running |
| **Missing Capabilities** | Database ping activation (PostgreSQL, Neo4j), external health check integration, uptime monitoring, PagerDuty/Slack alerting |

---

## 18. Tenant Isolation Layer

| Field | Value |
|---|---|
| **Description** | Multi-tenant data isolation ensuring users can only access their own organization's data |
| **Major Components** | tenantId in JWT tokens, tenant_id on all graph nodes, cross-tenant edge integrity check, RBAC route permissions |
| **Completion** | 60% |
| **Production Status** | Active — tenant IDs assigned at registration, RBAC enforced on all API routes |
| **Missing Capabilities** | Database-level row security policies, tenant-scoped API keys, organization management UI, data export per tenant |

---

## 19. Security Logging System

| Field | Value |
|---|---|
| **Description** | Security event tracking for authentication, authorization, and suspicious activity |
| **Major Components** | securityLogger.ts (response tracking), authMiddleware.ts (event logging), security event types (LOGIN_SUCCESS, UNAUTHORIZED_ACCESS, FORBIDDEN_ACCESS, etc.) |
| **Completion** | 70% |
| **Production Status** | Active — all auth events logged, admin can query security log |
| **Missing Capabilities** | Log persistence (currently in-memory, max 10k events), SIEM integration, anomaly detection, IP reputation scoring, geolocation tracking |

---

## 20. Frontend Application

| Field | Value |
|---|---|
| **Description** | React 18 + TypeScript SPA with Tailwind CSS, Zustand state management, React Router |
| **Major Components** | LandingPage.tsx (marketing funnel), DashboardPage.tsx, AdminPage.tsx, auth pages (login/register), case management pages, evidence management, settings |
| **Completion** | 75% |
| **Production Status** | Active — all pages rendering, auth flow functional, dashboard populated |
| **Missing Capabilities** | Progressive Web App (PWA), offline support, accessibility audit (WCAG 2.1), mobile responsive optimization, dark mode, internationalization |

---

## 21. API Layer

| Field | Value |
|---|---|
| **Description** | Fastify 5 REST API with CORS, CSRF protection, rate limiting, security headers, cookie support |
| **Major Components** | server.ts (route registration, middleware chain), 20+ route modules, security middleware stack (auth, rate limit, CSRF, headers, upload protection, ACU lock) |
| **Completion** | 85% |
| **Production Status** | Active — 60+ API endpoints registered, security middleware chain active |
| **Missing Capabilities** | API versioning (v1/v2), OpenAPI/Swagger documentation, request validation schemas (Zod/Ajv), GraphQL layer, WebSocket support |

---

## 22. Worker Infrastructure

| Field | Value |
|---|---|
| **Description** | PM2-managed background worker processes with proper main loops and graceful shutdown |
| **Major Components** | ecosystem.config.cjs (12 PM2 apps), 5 worker runners (queueMonitor, graphIntegrity, systemHealth, timelineProcessing, narrativeProcessing), 3 CPRA workers, contradiction worker, video processing worker, doctrine worker |
| **Completion** | 75% |
| **Production Status** | Active — all workers have proper main loops with SIGTERM/SIGINT handling, no crash-looping |
| **Missing Capabilities** | Redis-backed BullMQ queues (currently in-memory), worker scaling, job prioritization, dead letter queue, worker metrics dashboard |

---

## 23. Storage Infrastructure

| Field | Value |
|---|---|
| **Description** | Cloudflare R2 object storage for evidence files, in-memory Maps for application state |
| **Major Components** | @aws-sdk/client-s3 (R2 compatible), presigned URL generation, evidence metadata store |
| **Completion** | 55% |
| **Production Status** | Active — R2 configured, presigned URLs generated for uploads |
| **Missing Capabilities** | PostgreSQL persistence (Prisma schema defined but not migrated), Redis for session/queue data, backup automation, data retention policies, storage cost optimization |

---

## 24. Deployment Infrastructure

| Field | Value |
|---|---|
| **Description** | AWS EC2 single-instance deployment with PM2 process management, Nginx reverse proxy, Let's Encrypt TLS |
| **Major Components** | EC2 instance (13.223.68.11), PM2 ecosystem config, Nginx config, TLS certificate (courtaccess.net), Cloudflare DNS |
| **Completion** | 80% |
| **Production Status** | Active — server running, TLS active, PM2 managing all processes |
| **Missing Capabilities** | CI/CD pipeline (GitHub Actions), Docker containerization, auto-scaling, staging environment, blue-green deployment, database migration automation, infrastructure-as-code (Terraform/CDK) |

---

## Summary Matrix

| # | System | Completion | Status |
|---|---|---|---|
| 1 | Authentication | 90% | Active |
| 2 | Subscription Billing | 75% | Active |
| 3 | ACU Credit System | 85% | Active |
| 4 | Evidence Upload | 80% | Active |
| 5 | Evidence Processing | 60% | Partial |
| 6 | Timeline Reconstruction | 45% | Stub |
| 7 | Narrative Deconstruction | 40% | Stub |
| 8 | Contradiction Detection | 65% | Active |
| 9 | Evidence Graph | 55% | Active |
| 10 | Neo4j Intelligence | 30% | Configured |
| 11 | Forensic Reconstruction | 50% | Active |
| 12 | Policy Intelligence | 70% | Active |
| 13 | CPRA Acquisition | 65% | Active |
| 14 | Admin Dashboard | 75% | Active |
| 15 | Operations Console | 60% | Active |
| 16 | Queue Monitoring | 70% | Active |
| 17 | System Health | 65% | Active |
| 18 | Tenant Isolation | 60% | Active |
| 19 | Security Logging | 70% | Active |
| 20 | Frontend Application | 75% | Active |
| 21 | API Layer | 85% | Active |
| 22 | Worker Infrastructure | 75% | Active |
| 23 | Storage Infrastructure | 55% | Active |
| 24 | Deployment Infrastructure | 80% | Active |

**Overall System Completion: ~66%**

---

## Critical Path to Full-Scale Marketing

### Must-Have Before Launch
1. **Database Persistence** — Migrate from in-memory Maps to PostgreSQL (Prisma migrations)
2. **Stripe Activation** — Configure STRIPE_SECRET_KEY, create products/prices in Stripe Dashboard, set STRIPE_WEBHOOK_SECRET
3. **Redis/BullMQ** — Provision Redis for job queue persistence across restarts
4. **Timeline & Narrative NLP** — Implement actual text analysis (currently stubs)
5. **Neo4j Provisioning** — Spin up Neo4j instance for knowledge graph storage

### Should-Have Before Launch
6. Email verification on registration
7. Password reset flow
8. CI/CD pipeline (GitHub Actions)
9. Staging environment
10. API documentation (OpenAPI/Swagger)

### Nice-to-Have
11. Docker containerization
12. Auto-scaling infrastructure
13. PWA / offline support
14. Dark mode
15. Mobile optimization
