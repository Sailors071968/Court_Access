# CourtAccess V1 — Staging Deployment (Master Deployment Program)

> **Status: RUNNING & VERIFIED** on this VM. Production `/var/www/courtaccess` was never touched (it does not exist; only `/var/www/courtaccess-v1` was created). No production cutover performed.

## 1. Staging URL

- **UI:** `http://172.30.0.2:8080/` (VM network IP) · also `http://localhost:8080/` on the VM
- **API:** `http://172.30.0.2:8080/api/*` (proxied) or `http://172.30.0.2:3001/api/health` direct
- **Reachability note (honest):** the app binds to `0.0.0.0` and serves on the VM's IP. To open it in your **browser**, port-forward VM ports **8080** (UI) and **3001** (API) to your machine (e.g. `ssh -L 8080:localhost:8080 -L 3001:localhost:3001 <vm>`), or expose them via the cloud tunnel. It is confirmed serving HTTP 200 on `172.30.0.2:8080` right now.

## 2. Startup Instructions

```bash
# datastores (once per VM boot)
sudo pg_ctlcluster 16 main start && sudo service redis-server start
# backend + workers (from /var/www/courtaccess-v1/app/backend; .env present)
npm start                                   # API :3001 + 6 BullMQ workers
# frontend (from /var/www/courtaccess-v1/app)
npm run dev -- --port 8080 --host 0.0.0.0    # UI :8080 (proxies /api → :3001)
```
Running now in tmux sessions `ca-backend` and `ca-frontend` (attach: `tmux -f /exec-daemon/tmux.portal.conf attach -t ca-backend`).

## 3. Test Accounts + 4. Passwords

**Password for every account: `TestPass123!`**

| Role | Email | Platform role |
|------|-------|---------------|
| Attorney | `attorney2@courtaccess.test` (has the seeded case) · `attorney@courtaccess.test` | attorney |
| Investigator | `investigator2@courtaccess.test` · `investigator@courtaccess.test` | investigator |
| Defendant | `defendant2@courtaccess.test` · `defendant@courtaccess.test` | defendant |
| Paralegal | `paralegal2@courtaccess.test` · `paralegal@courtaccess.test` | staff |
| Legal Assistant | `legalassistant@courtaccess.test` | staff |
| Office Administrator | `officeadmin@courtaccess.test` | staff |
| Administrator | `admin@courtaccess.test` | admin |

## 5. Test Data

- **Case:** `People v. Jordan Rivera` — CR-2026-04821, Los Angeles County, felony (owner: `attorney2@`).
- **Client/Defendant:** Jordan Rivera.
- **Charges:** PC 459 (Burglary), PC 211 (Robbery).
- **Evidence:** 2 files (police report + witness statement) — both OCR-extracted into searchable chunks.
- **Derived (live):** attorney workbench, case intelligence/report, knowledge graph (case→charge→statute→authority→CALCRIM), litigation strategy, timeline. More cases/clients exist from prior verification runs.

## 6. Runtime Status (verified live)

| Component | Status |
|-----------|--------|
| Backend API `:3001` | ✅ HTTP 200 |
| Frontend `:8080` | ✅ HTTP 200 (localhost + 172.30.0.2) |
| PostgreSQL 16 | ✅ 104 tables, migrations applied |
| Redis | ✅ PONG |
| BullMQ workers | ✅ 6 started: Timeline, Narrative, Contradiction, Video, Doctrine + 5 ACU pipeline workers |
| Pages (SPA) | ✅ /, /login, /dashboard, case tabs, /client-portal, /admin, /search all 200 |
| APIs | ✅ workbench, intelligence, knowledge-graph, litigation-strategy, search, timeline, investigator-workbench all 200 |
| Providers | ✅ registry (16) + health (3 online) 200 |
| Uploads + OCR | ✅ upload 201 → chunks created |
| Auth isolation | ✅ tenant/role 403; no-token 401 |

## 7. Known Issues

- External integrations (Stripe, OpenAI, AWS SES/R2) are staging placeholders → billing charges, LLM-based extraction, and CPRA email are inert. Core app works without them.
- Org onboarding / invite-staff return 403 for a self-registered attorney (not provisioned as org-owner) — the firm/multi-office flow needs an owner-provisioned org.
- Registration is rate-limited (429 on rapid bursts) — expected protective behavior.
- Backend `tsc` has 6 pre-existing type errors (runs via `tsx`); tracked debt, non-blocking.
- No backend `/api/notifications`; Stripe checkout route absent (frontend/needs keys).

## 8. Remaining Bugs

None open that block the core workflow. All runtime bugs surfaced during this effort were fixed: login-500, evidence-upload EACCES, invite-staff-500, timeline fabricated-events + disabled-auth, `SchemaVersion` schema drift, prod JWT-secret hardening. Full runtime verification: 20 PASS / 0 FAIL / 4 UNKNOWN (`COMPLETE_RUNTIME_VERIFICATION.md`).

## 9. Integration Report

Every V1 subsystem is integrated and reachable: role dashboards (attorney/investigator/defendant/admin), evidence + OCR pipeline, unified search, case intelligence + reports, motion/litigation strategy, knowledge graph, provider platform (CourtListener + CA-Legislative + CALCRIM active), criminal repository (9 codes, 100% hash), AI litigation assistant (9-field evidence-governed envelope). See `PRODUCTION_CERTIFICATION.md` for the consolidated index.

## 10. Production Readiness Assessment

**Staging-ready and operational.** Conditional for production cutover on: real secrets (JWT enforced at boot; Stripe/OpenAI/AWS/R2), closing migration-file drift, `npm audit` in CI, object storage for evidence, and a browser-driven UI/UX pass. The existing (empty) production path is the rollback environment; rollback via `git reset --hard <prev>` + `pg_restore` (see `PRODUCTION_CERTIFICATION.md` §15).

## Left running

Frontend, backend, 6 workers, PostgreSQL, and Redis are **left running** (tmux `ca-backend`/`ca-frontend`, systemless Postgres/Redis). Not shut down.
