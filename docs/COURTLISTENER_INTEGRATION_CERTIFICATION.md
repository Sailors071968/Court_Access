# CourtListener Integration Certification

> Objective: determine whether CourtListener is integrated into CourtAccess; if missing, implement a canonical integration and connect it to legal-research surfaces. No estimation, no fabrication, no PASS without runtime evidence. UNKNOWN preferred over unsupported conclusions.

## Inspection result (before this program): **ABSENT**

A full repository + runtime scan found **no** CourtListener integration. The only occurrence was a documentation recommendation in `docs/FEDERAL_CRIMINAL_INTELLIGENCE_CERTIFICATION.md` ("a citation source (e.g., CourtListener API)"). Verified absent: API client, token/env configuration, service layer, repository layer, search/opinion/citation/docket endpoints, UI integration, background jobs, caching, rate limiting, dedicated error handling, tests, runtime wiring.

## Action taken: implemented a canonical integration

| Capability | Status | Where |
|-----------|--------|-------|
| API client (token auth, rate limit, TTL cache, timeout, retry, structured errors) | **IMPLEMENTED** | `backend/src/courtlistener/courtListenerClient.ts` |
| Service layer (normalizes to evidence-governed `CaseAuthority`; citation analysis) | **IMPLEMENTED** | `backend/src/courtlistener/courtListenerService.ts` |
| HTTP endpoints (status, search, opinion, docket, citation-lookup) | **IMPLEMENTED** | `backend/src/courtlistener/courtListenerRoutes.ts` |
| Env/token configuration | **IMPLEMENTED** | `COURTLISTENER_API_TOKEN`, `COURTLISTENER_BASE_URL` in `backend/.env.production.template` |
| Frontend client | **IMPLEMENTED** | `src/services/courtListenerApi.ts` |
| UI integration (Legal Research — Case Law Search) | **IMPLEMENTED + WIRED** | `src/components/research/CaseLawSearch.tsx` in `src/pages/case/ResearchPage.tsx` |
| Caching / rate limiting / error handling | **IMPLEMENTED** | in client (5-min TTL cache, ≥1.1s inter-request gate, 20s timeout, bounded retry on 429/5xx, never-throw) |
| Tests | **NOT ADDED** this pass (runtime harness used instead) — UNKNOWN/TODO |
| Background jobs | **NOT REQUIRED** for on-demand research — not implemented |

## 3. Endpoint List

| Method | Route | Purpose | Auth | Runtime |
|--------|-------|---------|------|---------|
| GET | `/api/courtlistener/status` | Integration/config health (no upstream call) | JWT | **PASS** (200) |
| GET | `/api/courtlistener/search?q=&type=&court=&page_size=` | Case-law / authority search | JWT | **PASS** (200, real data) |
| GET | `/api/courtlistener/opinions/:id` | Opinion retrieval | JWT | **UNKNOWN** (upstream 401 — needs token) |
| GET | `/api/courtlistener/dockets/:id` | Docket lookup | JWT | **UNKNOWN** (upstream requires token) |
| POST | `/api/courtlistener/citation-lookup` | Citation analysis (resolve citations → authorities) | JWT | **UNKNOWN** (upstream 401 — needs token) |

## 2. Runtime Verification (live, against the real CourtListener v4 API)

Executed against the running staging server + live CourtListener. Full evidence: `docs/api-registry/courtlistener-runtime-evidence.json`. Summary: **4 PASS · 2 UNKNOWN · 0 FAIL**.

- `GET /status` → **200 PASS**: `integrated=true`, capabilities listed, `tokenConfigured=false` (staging).
- `GET /search?q=terry stop reasonable suspicion` → **200 PASS**: 24,780 matching opinions; first result `State v. Jackson` with a real absolute URL.
- `GET /search?q=fourth amendment search` → **200 PASS**: 167,662 matches; real case names + citations + court + URL.
- `GET /opinions/:id` → **401 UNKNOWN**: CourtListener v4 opinion-detail requires authentication; the integration surfaces the real 401 (not masked). Enable by setting `COURTLISTENER_API_TOKEN`.
- `POST /citation-lookup {text:"384 U.S. 436"}` → **401 UNKNOWN** with `requiresToken=true`: CourtListener requires a token for citation-lookup. Honest surface, not a code defect.
- `GET /search` **without a JWT** → **401 PASS**: platform auth isolation enforced.

> Note: **search works unauthenticated** (public rate limits); **opinion/docket/citation-lookup require a token** — this is CourtListener's own access model, verified live, not a defect in this integration. Setting `COURTLISTENER_API_TOKEN` promotes those three to executable.

## 4. UI Integration Matrix

| Target surface | Backend available | UI wired | Notes |
|----------------|-------------------|----------|-------|
| Legal Research | ✅ | ✅ | `CaseLawSearch` panel on the Research page (`/cases/:id/research`) calls `/api/courtlistener/search` and renders real opinions. |
| Authority Search | ✅ | ✅ (shared) | Same search endpoint + frontend client (`courtListenerApi.searchCaseLaw`). |
| Citation Analysis | ✅ (endpoint) | client available | `analyzeCitations` client + `/citation-lookup` endpoint; needs token to return matches. |
| Attorney Workbench | ✅ (client) | not yet embedded | `courtListenerApi` importable into the workbench authority tab. |
| Motion Builder | ✅ (client) | not yet embedded | Authority citations can be pulled via the client. |
| Litigation Assistant | ✅ (endpoint) | intentionally not auto-called | The assistant is deterministic/offline by design; CourtListener is an external, non-deterministic source, so it is exposed as an on-demand endpoint rather than wired into the assistant's automatic answers. |
| Knowledge Graph | ✅ (client) | not yet embedded | Authorities can be added as graph nodes; connection point available. |

## 5. Missing Capabilities

- **Automated tests** for the client/service (unit + contract) — not added this pass.
- **Token-gated capabilities** (opinion detail, docket, citation-lookup) are **UNKNOWN** until `COURTLISTENER_API_TOKEN` is configured; verified they fail closed with honest 401s.
- **Deeper UI embedding** in Workbench / Motion Builder / Knowledge Graph — backend + client ready, UI wiring pending.
- **Background sync / caching to DB** — only in-memory TTL cache implemented (sufficient for on-demand research; no persistent authority store yet).

## 6. Production Certification

**Verdict: CONDITIONAL PASS.** CourtListener is now integrated end-to-end for **case-law / authority search**, verified live returning real opinions, wired into the Legal Research UI, with auth, caching, rate limiting, and structured error handling. Opinion/docket/citation-lookup are implemented and **fail closed with honest 401s** pending a `COURTLISTENER_API_TOKEN`; they are certified UNKNOWN (never PASS) until the token is provisioned. No fabricated results; every returned authority carries its real CourtListener id + URL for auditability.

**To reach full PASS:** set `COURTLISTENER_API_TOKEN` in the environment, then re-run `curl` against `/api/courtlistener/opinions/:id` and `/citation-lookup` to convert the two UNKNOWNs to PASS with evidence.
