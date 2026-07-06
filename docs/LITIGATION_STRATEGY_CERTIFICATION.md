# Litigation Strategy Certification (Program 47)

**Method:** static audit of the litigation/recommendation engines. Runtime output
requires a case + processed evidence + DB → **UNKNOWN** where not observable. No
speculation; UNKNOWN where unsupported.

**Generated:** 2026-07-06.

---

## 1. What exists (evidence)

| Engine | File | Emits |
|--------|------|-------|
| Motion recommendation | `services/motionRecommendationEngine.ts` | motion opportunities + `confidenceScore` |
| Litigation recommendation generator | `services/litigationRecommendationGenerator.ts` | merges **5 engines** with **evidence citations**, dedup by confidence |
| Litigation strategy service | `services/litigationStrategyService.ts` | strategy assembly |
| Trial prep | `workbench/trialPrepService.ts` | witness list, exhibit list, cross-exam topics, impeachment, opening/closing outlines |
| Case intelligence orchestrator | `intelligence/caseIntelligenceOrchestrator.ts` | aggregates intelligence |

Every recommendation record carries a **`confidenceScore`**; the generator merges
with **evidence citations** (Phase 291.3). Trial-prep items carry `citations: CitationRef[]`.

## 2. Coverage vs required

| Required | Status |
|----------|--------|
| Defense theories | ⚠️ via recommendations (no dedicated theory model) |
| Prosecution theories | ❌ not modeled |
| Missing elements / evidence | ✅ element matrices + evidence gaps (`workbenchService`) |
| Contradictions / weaknesses | ✅ `ClaimValidation`, contradiction analysis |
| Discovery deficiencies | ✅ `investigation.discoveryRequests`, recommendedDiscovery |
| Witness credibility / impeachment | ✅ `impeachmentDetectionWorker`, cross-exam topics |
| Chain of custody | ✅ evidence custody (Program 28) |
| Suppression issues | ✅ motion engine (suppression patterns) |
| Motion recommendations | ✅ (see Program 49) |
| Trial strategy / cross-exam / closing prep | ✅ `trialPrepService` (outlines, topics) |
| Voir dire preparation | ❌ not implemented |

## 3. Constitutional requirement (authorities/evidence/confidence/audit; UNKNOWN when unsupported)

| Field | Status |
|-------|--------|
| Authorities | ⚠️ present in intelligence/authority repo; not attached to every motion rec |
| Evidence citations | ✅ generator merges citations; trial-prep `CitationRef` |
| Confidence | ✅ `confidenceScore` on every recommendation |
| Audit trail | ⚠️ intelligence `auditTrail` in workbench bundle; per-recommendation audit not persisted |
| UNKNOWN where unsupported | ✅ claims default to `Unknown`/`unverified` |

**Key caveat:** motion confidence values are **heuristic constants** (0.75–0.90 per
matched pattern), not evidence-derived probabilities — flagged (same class of issue as
the OCR pdf-confidence heuristic).

## 4. Verdict

**Litigation Strategy Certification: PARTIAL — DENIED complete.**
A real, multi-engine recommendation system exists with evidence citations and
confidence, covering suppression/discovery/impeachment/weakness/trial-prep. **Gaps:**
prosecution theories and voir dire absent; motion confidence is heuristic; per-record
authority + audit not universally attached; runtime output UNKNOWN (no live stack).
