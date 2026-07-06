# Attorney Assistant Certification (Program 54)

**Vision:** an evidence-only litigation assistant that understands the entire case
(evidence, timeline, discovery, authorities, statutes, case law, CALCRIM, witnesses,
reports, knowledge graph, repository) and answers **only from evidence** — every answer
with evidence citations, authority citations, confidence, audit, and explicit unknowns;
never speculating, never fabricating.

**Result: NOT BUILT — the assistant does not exist.** Certification: **UNKNOWN /
DENIED**. Evidence only; no fabricated capability.

**Generated:** 2026-07-06.

---

## 1. Evidence

| Check | Finding |
|-------|---------|
| Conversational assistant / chat / Q&A module | **None** (`rg` for assistant/chat/RAG/askQuestion → no such module) |
| LLM SDK dependency (OpenAI/Anthropic/ai-sdk) | **None** in `package.json` |
| Retrieval-augmented generation over case data | **None** |
| Embedding-based similarity (partial building block) | ✅ `evidence/relationshipScorer.ts` uses embeddings for evidence↔text cosine similarity |
| Shared intelligence model to ground answers | ✅ `buildCaseIntelligence` / `AttorneyIntelligenceReport` (usable as retrieval source) |

**Conclusion:** there is no attorney assistant. The building blocks for a
**grounded, evidence-only** assistant exist (shared intelligence model + graph +
repository + embedding scorer), but no assistant consumes them.

---

## 2. Required contract (for when it is built)

The assistant MUST be **retrieval-only over the case intelligence model + graph +
repositories** — never a free-form generator. Every answer object:

```ts
interface AssistantAnswer {
  answer: string;                 // synthesized ONLY from retrieved records
  evidenceCitations: EvidenceRef[];   // ≥1 or the answer is refused
  authorityCitations: AuthorityRef[]; // statutes/CALCRIM/case law
  confidence: number | 'UNKNOWN';
  auditTrail: AuditRef[];
  unknowns: string[];             // what could not be supported
  refused?: boolean;              // true when no evidence supports an answer
}
```

**Invariants (mirroring the existing `NarrativeClaim.evidenceId` guarantee):**
- If retrieval returns no supporting evidence → **refuse** with `unknowns`, never guess.
- No claim in `answer` without a citation in `evidenceCitations`/`authorityCitations`.
- Confidence is measured from retrieval scores or **UNKNOWN** — never invented.

---

## 3. Verdict

**Attorney Assistant Certification: NOT BUILT (0%).**
No assistant, no LLM integration, no RAG. The evidence-governed contract above is the
required design; the shared intelligence model, graph, repositories, and embedding
scorer are the retrieval substrate. Nothing is fabricated; the assistant's capabilities
are UNKNOWN because it does not yet exist.

## 4. Recommended build (V2)
1. Retrieval index over: intelligence report, graph nodes/edges, evidence chunks,
   legislative repositories (PEN today), authorities.
2. Grounded synthesis with **hard citation enforcement** + refusal path.
3. Confidence from retrieval scores; audit every answer; surface unknowns.
4. Evaluation harness measuring citation coverage + refusal correctness (no hallucination).

## 5. Reproduce
```bash
cd backend
rg -rln -i "assistant|chatbot|RAG|retrieval|openai|anthropic" src | rg -iv test   # no assistant
rg -n "openai|anthropic|@ai-sdk" package.json                                       # no LLM SDK
```
