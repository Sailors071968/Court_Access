# Master Program 9 — AI Litigation Assistant Certification

> Every assistant answer is wrapped in the AI Safety Envelope and now carries **all nine required fields**. The assistant is deterministic (no LLM/free-form generation): answers are assembled only from real case records + repositories, and **UNKNOWN is returned whenever nothing supports the answer**.

## Required fields → envelope

| Required | Envelope field | Verified |
|----------|----------------|----------|
| Evidence | `evidence[]` (`{evidenceId, role, label, excerpt}`) | ✅ |
| Authorities | `authorities[]` (`{code, section, calcrimId, authorityId, label}`) | ✅ |
| Confidence | `confidence` (HIGH/MEDIUM/LOW/UNKNOWN) | ✅ |
| Provenance | `provenance{repositorySources, providers, contentHash, retrievalTimestamp, envelopeVersion, pipelineVersion}` — **added this pass** | ✅ |
| Repository Source | `provenance.repositorySources` / `audit.repositorySources` | ✅ |
| Hash | `contentHash` (deterministic SHA-256) | ✅ |
| Citation | `citations[]` — normalized strings for every evidence + authority ref — **added this pass** | ✅ |
| Retrieval Timestamp | `retrievalTimestamp` — **added this pass** | ✅ |
| Audit Trail | `audit{generatedAt, envelopeVersion, pipelineVersion, reasoning, repositorySources}` | ✅ |

`validateEnvelope()` now fails closed if any of these are missing, if a SUPPORTED answer has zero citations, or if the recomputed hash doesn't match (tamper detection).

## Runtime verification (live)

Executed against the running server for a real charged case:

```
POST /api/cases/:id/assistant  {"question":"What authority applies?"}
→ HTTP 200 · status SUPPORTED · envelopeValid true
  ALL 9 FIELDS PRESENT: true
  authorities: 26 · citations: 26 · confidence: MEDIUM
  provenance.repositorySources: [AuthorityMatrix, CALCRIM, CaliforniaCodes]
  contentHash: 762f37bb9568… · retrievalTimestamp: 2026-07-07T16:46:32Z
  audit.reasoning: "Assembled from authority matrix, CALCRIM analysis, …"

POST … {"question":"What authority applies to zzz nonexistent topic qqq?"}
→ status UNKNOWN · humanReviewRequired true · citations 0 · envelopeValid true
```

The second call proves **UNKNOWN is preferred over an unsupported conclusion**: with no matching support, the assistant returns UNKNOWN + human-review rather than inventing an answer. Sample: `docs/api-registry/assistant-envelope-sample.json`.

## Supported intents (all envelope-wrapped)

supporting evidence · contradicting evidence · unsupported elements · applicable authority · missing evidence · witnesses · documents. Each assembles from the attorney intelligence bundle + unified search; unrecognized questions return UNKNOWN with the list of answerable questions.

## Honest notes

- Deterministic by design — no LLM. This guarantees reproducibility (same inputs → same `contentHash`) and eliminates hallucination, at the cost of only answering the fixed intent set.
- `providers[]` in provenance is populated when an answer draws on an external provider (e.g. CourtListener); intelligence-bundle answers list repository sources.

## Verdict

**PASS** — every answer carries Evidence, Authorities, Confidence, Provenance, Repository Source, Hash, Citation, Retrieval Timestamp, and Audit Trail, verified live; UNKNOWN is returned for unsupported questions; the envelope validator enforces all of this and detects tampering. Implementation: `backend/src/ai/aiSafetyEnvelope.ts`, `backend/src/assistant/litigationAssistantService.ts`.
