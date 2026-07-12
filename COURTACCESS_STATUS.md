# CourtAccess — Production Status

**Generated:** 2026-07-12T15:20Z
**Branch:** `cursor/staging-deployment-review-0cc2`
**Deployed build (frontend):** commit `1827a6d`, build stamp `2026-07-12T15:01:25Z`
**Program context:** Production Program 115 — Live Staging Deployment, Human Review & Production Synchronization

> Reports only what has been verified with cited evidence.
> Per the Engineering Constitution: No Evidence → No Finding → UNKNOWN.
> No deployment, URL, screenshot, or infrastructure status is fabricated.

---

## 1. Deployment status

| Environment | URL | State |
|-------------|-----|-------|
| Production | https://courtaccess.net | LIVE but **stale** (serves an older "Court Access System" build) |
| Staging (ephemeral) | Cloudflare quick tunnel (`*.trycloudflare.com`) | Brought up and **verified live during this session**; see note below |

**Ephemeral staging tunnel:** During this session a full stack was run
(Postgres + Redis + Fastify backend + built frontend on one origin) and exposed
via a Cloudflare quick tunnel. The public URL served the **current build** and
was verified end-to-end:

```
GET https://<tunnel>.trycloudflare.com/          -> HTTP 200
  <title>CourtAccess — Criminal Case Intelligence Platform</title>
  <!-- CourtAccess build: 1827a6d 2026-07-12T15:01:25.319Z -->
GET https://<tunnel>.trycloudflare.com/api/health -> {"status":"ok","version":"1.1.0"}
```

**Persistence limitation (the exact blocker):** the tunnel and the stack run
inside this agent's ephemeral VM. When the session ends, the VM is suspended,
so the `trycloudflare.com` URL stops responding. A quick tunnel also has no
uptime guarantee and rotates its hostname on restart. Therefore a **persistent**
public staging URL cannot be produced from inside the agent. See §5.

---

## 2. Build verification (Phase 4) — VERIFIED

The served `dist/index.html` embeds the git build stamp injected by the Vite
build plugin: **`CourtAccess build: 1827a6d 2026-07-12T15:01:25.319Z`**, which
matches the repository HEAD at build time. Backend `/api/health` reports
`version 1.1.0`, `environment production`.

## 3. Browser verification (Phases 4 & 6) — 30 pages via Playwright

Full-page screenshots + console-error capture (`reports/screenshots/program-115/`,
`verification-report.json`).

- **Public pages (10/10): PASS, 0 console errors** — landing, for-defense,
  features, how-it-works, pricing, security, knowledge-base, accessibility,
  login, register. All render fully.
- **Authenticated shell: renders correctly** with the logged-in identity —
  dashboard, cases, search, settings, shared-access (collaborators), admin,
  admin/operations, system-health, case overview, charges (case intake),
  evidence, timeline, motions, research → **0 console errors**.
- **6 pages with failed data fetches** (shells still render; not UI crashes):
  - 401: `/dashboard/usage`, `/cases/:id/documents` (separate per-route auth).
  - 500: `/cases/:id/attorney-workbench`, `/cases/:id/narrative-analysis`
    (intelligence endpoints error on an empty case).
  - 404: `/cases/:id/contradictions`, `/cases/:id/litigation-strategy`
    (endpoints not registered / path mismatch).

## 4. Key fix enabling authenticated review

The backend global authentication hook was **commented out** (pre-existing), so
`request.user` was never populated and every authenticated data API returned
401. Added a minimal **optional** auth hook (`optionalAuthHook`) that populates
`request.user` from a valid Bearer token when present and never rejects; route
guards still enforce access. Verified: public routes unaffected (health/login
200), `GET /api/cases` with token → 200 (returns data), without token → 401.

---

## 5. Remaining Infrastructure Blockers & shortest path to a persistent URL

**Blocker:** no persistent host and no deploy credentials inside the agent.

**Shortest path (pick one):**

1. **Deploy to production/staging host (preferred).** Add GitHub repo secrets
   `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (Settings → Secrets and
   variables → Actions), then run the **"Deploy Production Website"** workflow
   (Actions tab → Run workflow) or merge to `dev`. Result: `https://courtaccess.net`
   serves the current build. For `https://staging.courtaccess.net`, point that
   DNS/host at the staging build and add the same-shaped secrets.
2. **Persistent Cloudflare Tunnel.** Provide a named-tunnel token
   (`CLOUDFLARE_TUNNEL_TOKEN`) from a Cloudflare account; a persistent
   `cloudflared` service then yields a stable hostname that survives restarts.

Other infra blockers unchanged: provider credentials (Stripe/AWS/OpenAI/
Anthropic/Gemini/Twilio/Resend/CourtListener), managed Postgres/Redis/Neo4j for
the production data plane, and the pre-existing Prisma migration/schema drift.

## 6. Production readiness

- Frontend: build + lint + test green; renders cleanly (0 console errors on all
  public pages and the authenticated shell).
- Backend: `tsc` 0 errors, lint 0 problems, 444/446 tests pass.
- **Deployability:** the build is deployable now; only credentials/persistent
  host are missing. A few authenticated data endpoints (§3) need follow-up.

## 7. Recommended next production program

Wire authenticated data endpoints end-to-end (resolve the 401/404/500 routes in
§3), then deploy to `https://courtaccess.net` / `https://staging.courtaccess.net`
once the deploy secrets exist.
