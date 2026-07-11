# CourtAccess — Canonical Engineering Status

> Single source of truth for engineering state across Cursor conversations.
> Every value here is repository-verified. Anything unverifiable is marked **UNKNOWN**
> per the Engineering Constitution (UNKNOWN is preferred over speculation).

**Last updated:** 2026-07-11 (UTC)

---

## Environment Reconciliation (verified)

| Field | Value | Source |
|---|---|---|
| Canonical repository | `github.com/Sailors071968/Court_Access` | `git remote -v` |
| Canonical branch | `dev` (`origin/HEAD -> origin/dev`) | `git branch -a` |
| Repository root | `/workspace` | `git rev-parse --show-toplevel` |
| Node version | v22.14.0 | `node -v` |
| npm version | 10.9.7 | `npm -v` |
| Prisma version | 6.19.2 (client + CLI) | `prisma -v` |
| Server / hostname | `cursor` (ephemeral cloud-agent VM) | `hostname` |
| OS | Linux 6.12.94 x86_64 | `uname -a` |
| Production URL (intended) | `https://courtaccess.net` | `.github/workflows/verify-production.yml`, Stripe cert URLs |
| Staging URL | **UNKNOWN** — not reachable/provisioned from the agent VM | — |
| Database (Postgres) | **UNKNOWN** — no `DATABASE_URL` in this VM | `env` |
| Redis | **UNKNOWN** — no `REDIS_URL` in this VM | `env` |
| Neo4j | **UNKNOWN** — no `NEO4J_*` in this VM | `env` |
| Nginx / PM2 / Docker | Not installed in agent VM | `command -v` |
| Cloudflare | Referenced in docs; not verifiable here | docs |

**Canonical answers**
- **Canonical repository:** `Sailors071968/Court_Access`
- **Canonical branch:** `dev`
- **Canonical runtime:** Node 22 / Fastify (backend, `tsx`) + Vite/React 18 (frontend)
- **Canonical database:** PostgreSQL via Prisma 6.19.2 (schema **frozen** — see `SCHEMA_FREEZE.md`)
- **Canonical staging URL:** UNKNOWN (requires provisioning)

## Build / Test Status (verified this session)

- Frontend `tsc -b`: **PASS** (0 errors)
- Frontend `vite build`: **PASS**
- Backend `tsc --noEmit`: **PASS** (0 errors) — fixed on branch `cursor/backend-compile-gate-0bfc` (PR #120), previously 186 errors
- Backend CI tests (role-onboarding, universal-membership, resource-permissions): **PASS** (20/20)
- Backend server module graph: loads under `tsx`; full boot blocked only by missing DB/Redis in the VM
- Frontend `eslint`: **BROKEN CONFIG** — `eslint.config.js` imports `globals`, which is missing from `package.json` (pre-existing)

## Current Work

- **Active branch:** `cursor/frontend-code-splitting-0bfc`
- **Latest commit:** `4a9dd56` (perf: route-level code splitting + vendor chunking)
- **Open PRs authored by agents (newest first):**
  - PR #120 — backend TypeScript compile gate (0 tsc errors) — `cursor/backend-compile-gate-0bfc` (draft)
  - This branch — frontend code splitting (perf)

## Production Readiness (honest, evidence-based)

**Can CourtAccess accept paying customers today? NO.** Blockers below.

| Area | State | Note |
|---|---|---|
| Frontend build/types | Ready | builds; initial JS reduced 1.5 MB → ~264 KB this session |
| Backend type-safety | Ready | 0 tsc errors (PR #120) |
| Backend runtime | Blocked | needs provisioned Postgres/Redis/Neo4j |
| Stripe / billing | Blocked | live/test keys not configured; live checkout unverified |
| Providers (AWS/Resend/Twilio/Cloudflare) | Blocked | no credentials in environment |
| Lint quality gate | Broken | missing `globals` devDependency |

## Highest-Priority Next Task

**Provision the runtime environment** (Postgres + `prisma migrate deploy`, Redis, Neo4j) and inject provider/Stripe secrets, so that runtime, worker-queue, Stripe checkout, and browser/staging verification can actually be performed. This is the top blocker gating every "browser-verified on staging" requirement. Recommended: run an env-setup agent at cursor.com/onboard.

## Remaining Blockers

1. No provisioned DB/Redis/Neo4j or deploy target in agent environment → cannot boot backend, run workers, or browser-verify.
2. Stripe live/test keys absent → cannot accept payments or certify checkout.
3. `eslint` config references missing `globals` dep → lint gate non-functional (234 lint findings once fixable, dominated by `no-explicit-any`).
4. Several forensic-reconstruction route/service contracts were realigned to compile (PR #120) but still merit a dedicated contract reconciliation.

## Known Runtime Issues

- Backend refuses to start without `DATABASE_URL` (schema integrity check aborts) — expected/by-design safety gate.
- Frontend `three.js` (515 KB) now deferred to 3D-exhibit routes only (previously in initial bundle).

## Verification Boundaries (this environment)

Browser verification, public-staging deployment, Stripe verification, and provider verification are **UNKNOWN / not performed** — the agent VM has no reachable staging, database, or secrets. All "PASS" claims above are from local build/typecheck/test only.
