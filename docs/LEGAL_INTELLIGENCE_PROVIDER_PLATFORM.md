# Legal Intelligence Provider Platform — Certification

## Master Program 6 update — full provider roster (16 providers, one interface)

Every requested source is now registered on the canonical `LegalIntelligenceProvider` interface. **3 active + runtime-verified**, 13 declared (framework-registered, honest non-active status). Health score 19% reflects that only the 3 data-backed providers are online — declared adapters are intentionally not.

| Provider | Interface | Active caps | Runtime |
|----------|-----------|-------------|---------|
| CourtListener | ✅ | 6 | **online** (opinion/docket search live) |
| California Legislative (leginfo) | ✅ | 4 | **online** (379 hash-verified statutes) |
| CALCRIM | ✅ | 2 | **online** — federated jury-instruction search returns real records w/ provenance (`CALCRIM — burglary`, hash `e5807fce…`) |
| Caselaw Access Project (CAP) | ✅ | 0 | declared (REST API sunset 2024) |
| OpenLaws | ✅ | 0 | declared (needs `OPENLAWS_API_KEY`) |
| California Judicial Council | ✅ | 0 | declared (forms/rules acquisition pending) |
| California Rules of Court | ✅ | 0 | declared (acquisition pending) |
| California Constitution | ✅ | 0 | declared (leginfo constitution code pending) |
| United States Constitution | ✅ | 0 | declared (congress.gov/govinfo pending) |
| California Code of Regulations (CCR) | ✅ | 0 | declared (acquisition pending) |
| Federal Rules (Evidence/Crim Pro) | ✅ | 0 | declared (uscourts.gov/govinfo pending) |
| Local Court Rules | ✅ | 0 | declared (per-county acquisition pending) |
| PACER | ✅ | 0 | declared (credentials + billing controls) |
| RECAP | ✅ | 0 | declared (via CourtListener token) |
| Westlaw / Lexis (optional) | ✅ | 0 | declared (optional commercial, no hard dependency) |

Runtime-verified live: `GET /api/providers` → 16; `GET /api/providers/health` → 3 online; `GET /api/providers/search/searchJuryInstructions?q=burglary` → CALCRIM real record with provenance. New active provider code: `backend/src/providers/calcrimProvider.ts`. Declared adapters return UNKNOWN for every capability (never fabricated) until their data/credentials are provisioned.

---


> A canonical, evidence-governed provider architecture: every external legal knowledge source implements ONE interface, registers in ONE registry, and stamps every record with provenance (provider + original id/URL + SHA-256 + retrieval time). No fabricated integrations; no PASS without live runtime evidence; capabilities a provider cannot serve return UNKNOWN, never faked.

## What was built (this program)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Canonical `LegalIntelligenceProvider` interface (20 methods) | **IMPLEMENTED** — `backend/src/providers/types.ts`, `baseProvider.ts` |
| 2 | Provider Registry (single source of truth) | **IMPLEMENTED + LIVE** — `backend/src/providers/registry.ts` |
| 3 | CourtListener provider | **IMPLEMENTED + RUNTIME-VERIFIED** (search/opinions/dockets live) — `courtListenerProvider.ts` |
| 8 | California Legislative provider (statutes) | **IMPLEMENTED + RUNTIME-VERIFIED** (379 local hash-verified records) — `californiaLegislativeProvider.ts` |
| 13 | Evidence Provenance Engine (SHA-256 stamping) | **IMPLEMENTED** — `provenance.ts` |
| 14 | Provider Health Dashboard (API) | **IMPLEMENTED + LIVE** — `GET /api/providers/health` |
| 16 | Federated capability search across providers | **IMPLEMENTED + LIVE** — `GET /api/providers/search/:capability` |
| 4,5,6,7,9,10,11 | CAP, OpenLaws, PACER, RECAP, Judicial Council, commercial | **DECLARED** (registered, 0 active capabilities, honest reason — not fabricated) |

## 1. Legal Intelligence Provider Registry

9 providers registered (`docs/api-registry/provider-registry.json`). Framework v1.0.0.

| Provider | Active caps | Auth | Status |
|----------|-------------|------|--------|
| courtlistener | 6 | api_token (optional) | **ACTIVE** — search unauthenticated; retrieval token-gated |
| ca-leginfo | 4 | none | **ACTIVE** — local hash-verified repository |
| cap | 0 | CAP_API_TOKEN | DECLARED — CAP REST API sunset 2024 |
| openlaws | 0 | OPENLAWS_API_KEY | DECLARED — needs key |
| pacer | 0 | credentials | DECLARED — needs PACER credentials |
| recap | 0 | COURTLISTENER_API_TOKEN | DECLARED — token-gated |
| ca-judicial-council | 0 | none | DECLARED — pending CALCRIM/forms/rules acquisition |
| westlaw / lexis | 0 | credentials | DECLARED — optional commercial, no hard dependency |

## 2. Provider Capability Matrix

Each provider reports `capabilities()` (booleans) across: searchAuthorities, searchOpinions, searchStatutes, searchRegulations, searchDockets, searchRules, searchForms, searchJuryInstructions, retrieveDocument, retrieveOpinion, retrieveStatute, retrieveRegulation, retrieveMetadata.

- **courtlistener:** searchAuthorities, searchOpinions, searchDockets, retrieveDocument, retrieveOpinion, retrieveMetadata.
- **ca-leginfo:** searchAuthorities, searchStatutes, retrieveDocument, retrieveStatute.
- **declared providers:** all false (0 active) until implemented/credentialed.

Full matrix: `docs/api-registry/provider-registry.json`.

## 3. Runtime Verification Report (live, executed)

`docs/api-registry/provider-runtime-evidence.json` — **4 PASS · 4 UNKNOWN · 0 FAIL**:

- `GET /api/providers` → **200 PASS** — 9 providers.
- `GET /api/providers/health` → **200 PASS** — courtlistener **online (1195ms, live)**, ca-leginfo **online (8ms, 379 records)**; declared providers honestly degraded/unknown.
- `GET /api/providers/search/searchStatutes?q=burglary` → **200 PASS** — real `PEN § 459` with SHA-256 + original leginfo URL provenance.
- `GET /api/providers/search/searchOpinions?q=miranda` → **200 PASS** — 20 real CourtListener opinions (`Miranda v. Kennedy`, `People v. Miranda`) each with provenance.
- CourtListener opinion/citation retrieval, PACER, CAP, OpenLaws → **UNKNOWN** (token/credentials required or upstream sunset — never marked PASS).

## 4. Provider Health Dashboard

`GET /api/providers/health` returns per-provider status/latency/detail + an aggregate health score. Snapshot: `docs/api-registry/provider-health.json` (2/9 online; the 7 declared adapters are intentionally not online).

## 5. API Authentication Guide

| Provider | Env var | Required for |
|----------|---------|--------------|
| CourtListener | `COURTLISTENER_API_TOKEN` | opinion/docket/citation retrieval (search works without) |
| CAP | `CAP_API_TOKEN` | (API sunset; bulk sync planned) |
| OpenLaws | `OPENLAWS_API_KEY` | all capabilities |
| PACER | `PACER_USERNAME`/password | all capabilities (fee-based) |
| Westlaw/Lexis | `WESTLAW_API_KEY`/`LEXIS_API_KEY` | optional commercial |

`ca-leginfo` needs no auth (local repository).

## 6. Synchronization Guide

- **ca-leginfo:** `npm run leginfo:discover-criminal -- --code <CODE> --acquire --process` then `leginfo:dashboard` (see `docs/CRIMINAL_LIABILITY_DISCOVERY_ENGINE.md`). Incremental/amendment detection + scheduled background sync (Phase 15) are **NOT yet implemented** — MISSING.
- **CourtListener:** on-demand (no local sync yet); bulk/RECAP sync is DECLARED.

## 7. Coverage Dashboard

- **ca-leginfo:** 379 statute records (PEN/VEH/HSC/BPC), hash-verified (see `criminal-liability-dashboard.md`).
- **courtlistener:** millions of federal/state opinions (on-demand).
- Others: declared, no coverage yet.

## 8. Repository Certification

Provenance engine (`provenance.ts`) stamps SHA-256 on every record; `ca-leginfo` preserves the repository's authoritative `contentHash`. `verifyProvenance()` re-hashes for continuous validation. Local legislative repository integrity is certified in `docs/CRIMINAL_LIABILITY_DISCOVERY_ENGINE.md` (100% hash verification).

## 9. Integration Report

- **Search (Phase 16):** federated `/api/providers/search/:capability` — LIVE across active providers.
- **Legal Research / Authority Search (Phase 17):** CourtListener already wired into the Research page (`CaseLawSearch`); the provider layer generalizes this.
- **Litigation Assistant / Workbench / Knowledge Graph (Phases 17–19):** the provider layer + provenance are the connection substrate; deeper per-UI wiring is **partially done** (CourtListener in Legal Research) and otherwise available-not-yet-embedded (honest — not fabricated).

## 10. Provider Dependency Graph

`Registry → [CourtListenerProvider → courtListenerService → courtListenerClient → CourtListener v4 API]`, `[CaliforniaLegislativeProvider → local statutes repository]`, `[DeclaredProvider × 7 → (credentials/upstream pending)]`. All providers depend only on the canonical interface + provenance engine.

## 11. Knowledge Graph Integration Report

Canonical records carry a stable `id`, `citations`, `jurisdiction`, and provenance suitable for graph ingestion. Automatic KG ingestion of provider records (Phase 19) is **NOT yet implemented** — MISSING/planned. The data contract is ready.

## 12. Provider Health Report

2 active providers online; 7 declared providers report honest non-online status with reasons. No provider is fabricated as healthy.

## 13. Missing Capability Report

- Background scheduled synchronization (Phase 15) — not implemented.
- Automatic Knowledge Graph ingestion of provider records (Phase 19) — not implemented.
- CAP bulk sync, OpenLaws/PACER/commercial adapters — declared, need credentials/implementation.
- CourtListener token-gated retrieval (opinion/docket/citation) — UNKNOWN pending token.
- Judicial Council (CALCRIM/forms/rules) acquisition — pending.
- Provider unit/contract tests — not added this pass.

## 14. Runtime Certification Report

Executed live (not static): registry, health, and federated search across both active providers PASS with real data + provenance; token/credential-gated capabilities are UNKNOWN and fail closed. Evidence: `docs/api-registry/provider-runtime-evidence.json`.

## 15. Production Readiness Assessment

**The canonical Legal Intelligence Layer is established and live** for two providers (CourtListener case law, California statutes) with a uniform interface, registry, health dashboard, federated search, and provenance on every record. This is the canonical gateway; new sources plug in by implementing the same interface. **Not production-complete:** background sync, KG auto-ingestion, and the credential/commercial adapters remain (documented above). Verdict: **CONDITIONAL PASS** — framework + 2 active providers certified by live runtime evidence; remaining providers/phases are honestly DECLARED/MISSING, never fabricated.
