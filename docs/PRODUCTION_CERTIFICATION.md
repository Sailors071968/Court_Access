# Master Program 14 — Production Certification

> Consolidated production certification for CourtAccess V1. Every claim is backed by a live-verified detailed report (linked). Prepared under the Engineering Constitution — measured, not fabricated; UNKNOWN preferred over unsupported conclusions. Staging live at `/var/www/courtaccess-v1`.

## Certification index (16 deliverables)

| # | Deliverable | Status | Source |
|---|-------------|--------|--------|
| 1 | Integration Report | ✅ | `MASTER_PROGRAM_V1_COMPLETION_CERTIFICATION.md`, `PRODUCTION_STAGING_DEPLOYMENT.md` |
| 2 | API Registry | ✅ 374 endpoints, 0 dup | `api-registry/CANONICAL_API_REGISTRY.md` |
| 3 | Repository Statistics | ✅ 9 codes / 569 sections / 140 offenses | `CALIFORNIA_REPOSITORY_CERTIFICATION.md` |
| 4 | Provider Registry | ✅ 16 providers (3 active) | `LEGAL_INTELLIGENCE_PROVIDER_PLATFORM.md` |
| 5 | Coverage Dashboard | ✅ 100% hash | `backend/data/legislative/repositories/criminal-liability-dashboard.md` |
| 6 | Runtime Verification | ✅ 20 PASS / 0 FAIL / 4 UNKNOWN | `COMPLETE_RUNTIME_VERIFICATION.md` |
| 7 | Security Certification | ✅ live-probed, OWASP-mapped | `SECURITY_CERTIFICATION.md` |
| 8 | Performance Certification | ✅ measured + optimized | `PERFORMANCE_CERTIFICATION.md` |
| 9 | Database Certification | ✅ (below) | this doc + `DATABASE_CERTIFICATION_REPORT.md` |
| 10 | Production Readiness | ✅ (below) | this doc |
| 11 | Known Issues Register | ✅ (below) | this doc |
| 12 | Test Accounts | ✅ (below) | this doc |
| 13 | Startup Guide | ✅ (below) | this doc + `PRODUCTION_STAGING_DEPLOYMENT.md` |
| 14 | Deployment Guide | ✅ | `DEPLOYMENT_RUNBOOK.md`, `PRODUCTION_STAGING_DEPLOYMENT.md` |
| 15 | Rollback Guide | ✅ (below) | this doc + `DISASTER_RECOVERY.md` |
| 16 | Release Notes | ✅ (below) | this doc |

---

## 9. Database Certification (live)

Measured against the running `courtaccess` PostgreSQL 16 database:

- **Tables:** 104 (103 Prisma models + `_prisma_migrations`) — schema in sync.
- **Migrations:** **20/20 applied** (`_prisma_migrations`, all `finished_at` set); boot schema-integrity assertion **PASS**.
- **Indexes:** 442. **Foreign keys:** 48.
- **Schema drift:** resolved — `migrate deploy` (migration history) + `db push` (model-only tables) reconcile to 104 tables; the `SchemaVersion` `@map` mismatch that previously broke `db push` is fixed.
- **Query plans:** hot query (`criminal_cases` by tenant) uses an **Index Scan** (0.016ms). `evidence_chunks` substring search is a Seq Scan (recommend `pg_trgm` GIN index at scale).
- **Repository integrity:** legislative repositories 100% SHA-256 hash-verified (569/569 statute sections).

## 10. Production Readiness Assessment

**Status: STAGING-READY / CONDITIONAL for production.**

Ready: auth (JWT + isolation), case/client/evidence/OCR/timeline/search/workbench/knowledge-graph/assistant workflows (live-verified 20 PASS/0 FAIL), provider layer, criminal repository (hash-verified), security controls (live-probed), performance (low latency, optimized bundle), clean git-reproducible staging.

Before production cutover: (a) set real secrets (JWT, Stripe, OpenAI, AWS/R2 — enforced for JWT at boot); (b) close migration drift into migration files (so `migrate deploy` alone yields full schema without `db push`); (c) run `npm audit`/dependency scan in CI; (d) provision object storage for evidence + a browser-driven UI/UX audit.

## 11. Known Issues Register

| Sev | Issue | Status |
|-----|-------|--------|
| Med | External integrations (Stripe, OpenAI, AWS SES, R2) are staging placeholders → billing/AI-extraction/CPRA-email inert | Provision prod secrets |
| Med | Deep analysis (contradiction/event extraction, verified_facts) is BullMQ worker-driven; not triggered by inline upload | Wire worker into pipeline |
| Med | Migration files lag schema for model-only tables (added via `db push`) | `prisma migrate diff` w/ shadow DB |
| Low | `evidence_chunks` search is Seq Scan (substring) | Add `pg_trgm` GIN index |
| Low | Org onboarding / invite-staff require org-owner permission a self-registered user lacks (authz edge) | Provision owner on org creation |
| Low | No backend notifications API (frontend-managed); Stripe checkout route absent | Implement if needed |
| Low | Pre-existing `resourceAuthMiddleware.ts` tsc type-predicate issue (runs fine via tsx) | Fix return type |
| Low | 248 API endpoints have no static UI caller (candidate; dynamic callers possible) | Confirm + retire |
| Info | OAuth not implemented (JWT-only); `npm audit` (OWASP A06) not run this pass | Optional / add to CI |

Fixed this effort: login-500, evidence-upload EACCES, invite-staff-500, timeline fabricated-events+disabled-auth, schema `@map` drift, prod JWT-secret hardening, 141 dead files removed, bundle −48%.

## 12. Test Accounts

Password for all: **`TestPass123!`**

| Role | Email |
|------|-------|
| Attorney | `attorney@courtaccess.test` |
| Investigator | `investigator@courtaccess.test` |
| Defendant | `defendant@courtaccess.test` |
| Paralegal | `paralegal@courtaccess.test` |

## 13. Startup Guide

```bash
sudo pg_ctlcluster 16 main start && sudo service redis-server start   # datastores
cd /var/www/courtaccess-v1/app/backend && npm start                    # API :3001
cd /var/www/courtaccess-v1/app && npm run dev -- --port 8080 --host     # UI :8080 (proxies /api)
```
UI: `http://localhost:8080/` · API health: `http://localhost:3001/api/health`. (VM localhost — port-forward 8080+3001 to reach externally.)

## 14. Deployment Guide

See `DEPLOYMENT_RUNBOOK.md` + `PRODUCTION_STAGING_DEPLOYMENT.md`. Summary: clean checkout → `npm install` (backend+root) → `prisma generate` + `migrate deploy` + `db push` → `npm start` + Vite. Backend requires `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`; optional `REDIS_URL`, `COURTLISTENER_API_TOKEN`, Stripe/OpenAI/AWS/R2.

## 15. Rollback Guide

- **Code:** revert to the prior release tag/commit (`git checkout <prev> && npm install && npm start`); backend + frontend are stateless processes — restart to roll back.
- **Database:** migrations are additive; to roll back a migration, restore from the pre-deploy DB backup (`pg_restore`) — see `DISASTER_RECOVERY.md`. Do **not** hand-drop tables. Take a `pg_dump` before every deploy.
- **Staging:** `git reset --hard <prev-commit>` in `/var/www/courtaccess-v1/app`, reinstall, restart. Production `/var/www/courtaccess` is never touched by staging operations.
- **Config:** secrets live in `.env` (not in git); roll back by restoring the prior `.env`.

## 16. Release Notes — V1 (this branch)

**Added:** Criminal Liability Discovery Engine (targeted CA acquisition, 9 codes / 140 offenses, 100% hash); Legal Intelligence Provider Platform (canonical interface, 16 providers, CourtListener + CA-Legislative + CALCRIM active); Unified Case Search API; AI Safety Envelope + evidence-governed Litigation Assistant (9-field provenance, UNKNOWN-preferring); Case Knowledge Graph; CourtListener integration; unified design-system Error state.

**Fixed:** login 500, evidence-upload path (EACCES), invite-staff 500, timeline fabricated-events + disabled-auth, `SchemaVersion` drift; prod JWT-secret enforcement.

**Improved:** repository consolidation (141 dead files removed + graphs); canonical API registry (374 endpoints, 0 duplicates); UI reachability (89 pages, 0 orphaned); bundle −48% via code-splitting; performance + security certifications.

**Known gaps:** see Known Issues Register (external secrets, worker-driven deep analysis, migration-file drift).

## Verdict

**CONDITIONAL PASS — staging-certified.** Core platform is integrated, live-verified, secured, performance-measured, and running on a clean reproducible staging environment with production untouched. Production cutover is gated on external secrets, migration-drift closure, dependency scanning, and object storage — all documented, none fabricated.
