# CourtAccess V1 — Staging Integration & Runtime Deliverables

**A fully integrated CourtAccess build is deployed and running** at `/var/www/courtaccess-v1/app` on this VM. The existing `/var/www/courtaccess` was NOT touched (it did not exist; only `/var/www/courtaccess-v1` was created). This document contains the 10 required deliverables. No PASS result is fabricated — every status below was produced by executing the running application.

---

## 1. Integration Report

- **Source deployed:** the fully-integrated branch `cursor/criminal-liability-discovery-engine-48a3` (dev + all completed programs: unified search, litigation assistant, AI safety envelope, criminal-liability discovery engine, and the Gate-1 repository cleanup). Cloned to `/var/www/courtaccess-v1/app`.
- **Consolidation (Phase 1):** the Gate-1 cleanup already removed 75 dead files (54 unwired frontend service "engines", orphan pages/components, `mockData.ts` demo data, the `frontend/` stub app, an unwired 1,030-line dashboard, 2 dead backend routes). See `docs/GATE_1_REPOSITORY_CLEANUP_REPORT.md`.
- **Datastores provisioned:** PostgreSQL 16 (`courtaccess` DB, 104 tables) and Redis 7 — both running locally on the VM.
- **Schema (Phase 5):** `prisma migrate deploy` applied all 20 migrations (migration history intact) + `prisma db push` added the model-only tables → 104 tables, boot-time schema-integrity assertion **PASS** (20/20 migrations). One real drift bug fixed: `SchemaVersion` model fields now `@map` to their snake_case columns (committed to canonical repo).
- **Build:** frontend `vite build` succeeds (1675 modules); backend boots clean via `tsx`.

## 2. Feature Integration Matrix

Backend endpoints executed live (authenticated attorney token) — see Runtime Verification for HTTP codes.

| Feature | Backend | Reachable in UI (route) | Runtime status |
|---------|---------|-------------------------|----------------|
| Authentication (register/login/JWT) | `/api/auth/*` | `/login`, `/register` | ✅ verified (register+login return JWT) |
| Role onboarding | `/api/membership/onboarding` | `/onboarding` | ✅ 200 |
| Case management | `/api/cases` | `/cases`, `/cases/:id/*` | ✅ create+list+detail 200 |
| Client management | `/api/clients` | client pages | ✅ create+list 200 |
| Attorney workbench | `/api/cases/:id/workbench*` | `/cases/:id/attorney-workbench` | ✅ 200 (bundle, trial-prep, command-center) |
| Case intelligence | `/api/cases/:id/intelligence` | overview/reports | ✅ 200 |
| Evidence | `/api/cases/:id/evidence` | `/cases/:id/evidence` | ✅ 200 (list) |
| **Unified search (Prog 115)** | `/api/search`, `/api/cases/:id/search` | `/search` + Cmd/Ctrl-K | ✅ 200, returns real created case |
| **Litigation assistant (Prog 108)** | `POST /api/cases/:id/assistant` | (API; UI chat pending) | ✅ 200, valid AI-safety envelope, UNKNOWN when unsupported |
| Timeline | `/api/timeline/:id/events` | `/cases/:id/activity` | ✅ 200 |
| Billing/subscription | `/api/billing/*` | `/account`, portal | ✅ 200 (Stripe keys not set → live charges disabled) |
| Legislative/repository | `/api/legislative/*` | research/repository | ✅ 200 |
| Doctrine/constitutional | `/api/doctrine/*` | doctrine pages | ✅ 200 |
| Investigator workbench | `/api/cases/:id/investigator-workbench` | `/cases/:id/investigator-workbench` | present (account created) |
| Client portal | `/client-portal/*` | defendant role | present (account created) |
| Frontend routes total | — | **59 routes** in `src/App.tsx` | build passes |
| Backend endpoints total | **364** across 42 route files | — | core set verified |

> UI pages are reachable via the router and the production build compiles; individual per-page screenshot/visual verification (Gate 4) was **not** performed — no headless browser in this environment.

## 3. Runtime Verification Report

Executed against the live server (attorney JWT):

```
/api/health                          HTTP 200
/api/cases                           HTTP 200
/api/clients                         HTTP 200
/api/cases/:id                       HTTP 200
/api/cases/:id/workbench             HTTP 200
/api/cases/:id/workbench/trial-prep  HTTP 200
/api/cases/:id/workbench/command-center HTTP 200
/api/cases/:id/intelligence          HTTP 200
/api/cases/:id/evidence              HTTP 200
/api/search?q=people                 HTTP 200   (returned the real seeded case)
/api/cases/:id/search?q=defendant    HTTP 200
/api/membership/onboarding           HTTP 200
/api/billing/subscription            HTTP 200
/api/legislative/coverage            HTTP 200
/api/doctrine/search?q=miranda       HTTP 200
/api/timeline/:id/events             HTTP 200
/api/cases (NO token)                HTTP 401   (auth isolation enforced)
POST /api/cases/:id/assistant        HTTP 200   (envelopeValid=true, status=UNKNOWN, humanReviewRequired=true)
```

Services listening: backend `:3001`, frontend `:8080`, PostgreSQL `:5432`, Redis `:6379`. Boot schema assertion: **PASS (20/20 migrations, version 1.0.0)**.

## 4. Startup Instructions

Datastores (once per VM boot):
```bash
sudo pg_ctlcluster 16 main start
sudo service redis-server start
```
Backend (from `/var/www/courtaccess-v1/app/backend`, `.env` already written):
```bash
npm start            # tsx src/server.ts → http://0.0.0.0:3001
```
Frontend (from `/var/www/courtaccess-v1/app`):
```bash
npm run dev -- --port 8080 --host   # Vite dev server, proxies /api → :3001
```
Both currently run in tmux sessions `ca-backend` and `ca-frontend`:
```bash
tmux -f /exec-daemon/tmux.portal.conf attach -t ca-backend    # or ca-frontend
tail -f /tmp/backend.log /tmp/frontend.log
```
Restart backend: `tmux kill-session -t ca-backend` then re-run `npm start` in that dir.

## 5. Login Credentials (test accounts)

All created via the real registration API. Password for all: **`TestPass123!`**

| Role | Email | Platform role |
|------|-------|---------------|
| Attorney | `attorney@courtaccess.test` | attorney |
| Investigator | `investigator@courtaccess.test` | investigator |
| Defendant | `defendant@courtaccess.test` | defendant |
| Paralegal | `paralegal@courtaccess.test` | staff |

> Each account created its own tenant/organization on registration. To collaborate within one firm, invite the others from the attorney's organization settings.

## 6. Test Data

- **Case:** `People v. Test Defendant` (CR-2026-0001), Los Angeles County, felony — owned by the attorney account.
- **Client:** Jordan Rivera.
- Additional evidence/timeline/charges can be added through the UI to exercise OCR, evidence extraction, and the assistant's evidence-backed answers.

## 7. Known Issues Register

1. **External integrations not configured (by design in staging):** `OPENAI_API_KEY`, Stripe keys, AWS SES, Cloudflare R2 are placeholders. Effects: AI extraction/classification that calls OpenAI, live Stripe charges, CPRA email, and R2-backed uploads are inert or degraded. Core app, auth, DB, search, workbench, and the deterministic litigation assistant work without them.
2. **Textract OCR** requires AWS; local PDF text extraction (pdf-parse) and Tesseract image OCR work offline. Audio/video transcription remains stubbed.
3. **`SchemaVersion` mapping bug** — fixed this session (`@map` to snake_case). Committed.
4. **~4 model-only tables** existed only in the Prisma schema (historical migration drift); added via `db push` so the running DB is complete. Migration files still lag the schema (see Blockers).
5. **Real-time collaboration** (WebSocket/SSE) is not implemented; collaboration is REST/DB-based.
6. **Frontend design consistency**: some legacy light-theme pages remain alongside the newer dark design system (Gate 6/UI migration is partial).

## 8. Remaining Blockers (to production cutover)

- **Secrets:** production Stripe, OpenAI, AWS SES, R2 credentials.
- **Migration drift closure:** generate migration files for the model-only tables (`prisma migrate diff` with a shadow DB) so `migrate deploy` alone yields the full schema without `db push`.
- **Full UI/UX + security/perf runtime audits** (Gates 4/5/6/9) and per-page visual verification require a browser-driving harness.
- **External reachability:** the app runs on the VM's `localhost`. Reaching it from your machine requires port-forwarding/tunneling to VM ports 8080 (UI) and 3001 (API).

## 9. Production Readiness Assessment

The application is **integrated and runnable end-to-end** in staging: registration, login, case/client creation, attorney workbench, case intelligence, unified search, and the evidence-governed litigation assistant all execute successfully against a real PostgreSQL database, with auth isolation enforced and the boot schema-integrity gate passing. It is **not yet production-ready** pending: external secrets, migration-drift closure, real-time collaboration, and the browser-driven UI/UX/security/performance audits. No production cutover was performed (per instruction).

## 10. Staging URL

- **Frontend (UI):** `http://localhost:8080/` (on this VM)
- **Backend (API):** `http://localhost:3001/api/health`
- Reachable externally only via port-forwarding to the VM (ports 8080 + 3001).
