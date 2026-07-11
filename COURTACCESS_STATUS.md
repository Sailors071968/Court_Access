# CourtAccess — Production Status

**Generated:** 2026-07-11T18:38Z
**Branch:** `cursor/lint-fix-and-status-certification-0cc2`
**Commit:** `b48c3eb` (see `git log` for full history)
**Program context:** Production Program 113 — Litigation Intelligence Platform & Attorney Workflow Certification

> This document reports only what has been verified with cited evidence.
> Per the Engineering Constitution: No Evidence → No Finding → UNKNOWN.
> No runtime, deployment, or provider connectivity is fabricated here.

---

## 1. Deployment / Live URL

**Primary URL:** https://courtaccess.net

| Check | Evidence | Result |
|-------|----------|--------|
| Frontend reachable | `curl https://courtaccess.net/` → HTTP 200 | LIVE |
| Backend health | `curl https://courtaccess.net/api/health` → `{"status":"ok",...}` | LIVE |
| DNS | `courtaccess.net` → `44.209.225.79` | RESOLVES |
| Build freshness | Served `<title>Court Access System</title>` + a leftover `TO BE DELETED` comment block; current repo `index.html` is `CourtAccess — Criminal Case Intelligence Platform` | **STALE BUILD** |
| `beta.courtaccess.net` | TLS cert does not cover host (`curl (60)`) | NOT SERVED |

**Interpretation:** CourtAccess is deployed and reachable at
**https://courtaccess.net**, but the server is serving an **older build** than
the current `dev` branch. The site does *not* auto-update from this repository
because the deploy workflow requires infrastructure-owned secrets.

**There is no separate "updated" URL.** The same domain
(`https://courtaccess.net`) will reflect the latest application code once a
deploy is triggered. Triggering a deploy is an infrastructure-owned action
(see Human Actions below) — it cannot be performed from application code.

---

## 2. Application (Frontend Package) — CERTIFIED

The frontend package (`court-access-frontend`, the deployed web application)
is verified green:

| Gate | Command | Result |
|------|---------|--------|
| Build | `npm run build` (`tsc -b && vite build`) | PASS — 1617 modules, exit 0 |
| Lint | `npm run lint` (`eslint .`) | PASS — **0 errors, 0 warnings** |
| Test | `npm test` (determinism replay) | PASS — 1/1 |

### What was fixed this program

- **ESLint was completely broken** and had never run: `eslint.config.js`
  imported `globals`, which was not a declared dependency, so `eslint .`
  crashed with `ERR_MODULE_NOT_FOUND`. CI never invoked lint, so this went
  unnoticed. Added the dependency and repaired the flat config.
- Aligned `@typescript-eslint/no-unused-vars` with the repo's `_`-prefix
  convention (matching `tsconfig` `noUnusedLocals`/`noUnusedParameters`).
- Eliminated **every** frontend lint finding: removed `any` usages
  (typed `CaseOption`), removed unnecessary regex escapes, made React hook
  dependency arrays exhaustive without introducing refetch loops, hoisted a
  constant array to module scope, and split a utility + shared types out of a
  component module for a clean Fast Refresh boundary.
- Added a runnable `test` script + `tsx` devDependency; the package-level
  determinism test previously could not execute.

---

## 3. Backend Package — OUTSTANDING DEBT (evidence-backed finding)

The backend (`backend/`) is a **separate npm package** with its own toolchain.
It runs at runtime via `tsx` (which strips types without type-checking), so the
following debt does not crash the running server but is real and unresolved:

| Finding | Evidence | Status |
|---------|----------|--------|
| Backend does not type-check | `cd backend && npx tsc --noEmit` → **186 errors**, exit 2 | NEEDS ATTENTION |
| Invalid type predicate | `resourceAuthMiddleware.ts`: `Promise<user is AuthUser>` is not valid TS (async functions cannot be type predicates) | ROOT CAUSE of the parse failure |
| Backend never linted | ~195 findings surface once the frontend config crash is fixed (unused vars, `no-explicit-any`, `no-useless-escape`) | NEEDS ATTENTION |
| Backend CI tests | `role-onboarding`, `universal-membership`, `resource-permissions` | PASS — 20/20 |

The backend type errors include genuine logic bugs (e.g. wrong argument counts
in `forensicReconstructionRoutes.ts`) that require careful, individually
verified fixes and a dedicated backend lint/type-check pipeline. They were
**not** changed in this program to avoid committing unverified partial edits to
a running service. This is the top recommended next engineering program.

---

## 4. Production Completion

Frontend application layer: **certified green** (build + lint + test).
Backend type-safety/lint hardening: **outstanding**.

Because the deployed artifact and full quality certification span both packages,
and the backend still carries 186 type errors + ~195 lint findings, the honest
whole-platform completion is reported as **UNKNOWN-with-caveats** rather than a
fabricated percentage. Application-side (frontend) certification is complete;
backend certification is the remaining engineering blocker.

---

## 5. Remaining Infrastructure Blockers (owner-only)

These require external ownership and cannot be completed from the repository:

- Deploy secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`) to publish
  the current build to `https://courtaccess.net`.
- Provider credentials (Stripe, AWS, OpenAI/Anthropic/Gemini, Twilio, Resend,
  CourtListener, etc.) for live provider connectivity.
- Database / Redis / Neo4j ownership for live data-plane certification.

---

## 6. Next Recommended Production Program

1. **Backend type-check & lint certification** — make `cd backend && npx tsc
   --noEmit` exit 0 and add a backend ESLint config + CI job. Fix the
   `guardAuth` predicate and its ~15 caller narrowing sites, then the remaining
   forensic/evidence route type errors, each verified against backend tests.
2. Deploy the current `dev` build to `https://courtaccess.net` (infra).

---

## 7. Human Actions (exact)

See the turn summary "Remaining Human Actions" for the precise page/button/value
steps required to publish the current build and configure providers.
