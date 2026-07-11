# Case Intelligence Architecture Report — CourtAccess V2 (Program 54)

**Vision:** CourtAccess becomes the operating system for criminal litigation —
every subsystem revolves around one **Case Workspace** and communicates through one
**shared Case Intelligence model** backed by one **Criminal Intelligence Graph**.

This report separates **BUILT** (verified in code, Programs 18–53) from **PROPOSED**
(V2 design). No unbuilt subsystem is claimed complete. Engineering Constitution applies.

**Generated:** 2026-07-06.

---

## 1. The shared Case Intelligence model — already exists (foundation)

| Element | Status | Evidence |
|---------|--------|----------|
| `buildCaseIntelligence(caseId, tenantId)` orchestrator | ✅ BUILT | `intelligence/caseIntelligenceOrchestrator.ts` |
| `AttorneyIntelligenceReport` shared model | ✅ BUILT | `intelligence/types.ts` |
| Intelligence routes | ✅ BUILT | `intelligence/intelligenceRoutes.ts` |
| Unknown registry (from report) | ✅ BUILT | `intelligence/unknownManagement.ts` |
| Workbench bundle (case → charges → evidence → authority → trial-prep → graph) | ✅ BUILT | `workbench/workbenchService.ts` |

**V2 principle:** every workspace panel (evidence, timeline, charges, authorities,
motions, reports, collaboration) must read from `buildCaseIntelligence` / the graph —
not re-query independently. Today several pages call `caseApi` directly; V2 routes them
through the shared model to eliminate duplicated logic.

---

## 2. Unified Criminal Intelligence Graph

### 2.1 Current state (BUILT, partial)
- Graph engine + 16 node types (frontend): `components/graph/types.ts` (Program 27).
- Persistence models: `evidence_graphs`, `evidence_links`, `NarrativeClaim` (required `evidenceId`).
- Extraction produces claims/timeline/contradictions with citations (Program 46).

### 2.2 Required node schema (V2 — every object is a node)
Node types: Person, Witness, Victim, Officer, Attorney, Judge, Court, Case, Evidence,
Charge, Statute, CALCRIM, Authority, Vehicle, Address, Phone, Email, Organization,
Timeline Event, Financial Transaction, Interview, Document, Media.

**Every node MUST carry (proposed canonical schema):**
```ts
interface GraphNodeV2 {
  id: string; type: NodeType; label: string;
  evidenceCitations: EvidenceRef[];   // ≥1 required — no node without traceable evidence
  authorities: AuthorityRef[];         // statute/CALCRIM/case-law citations
  relationships: EdgeRef[];            // typed, weighted
  confidence: number | 'UNKNOWN';      // measured or UNKNOWN — never estimated
  auditTrail: AuditRef[];              // who/what/when created/modified
  repositorySource: string;            // originating repository
  unknowns: string[];                  // explicitly enumerated gaps
}
```
This extends the existing `GraphNode` (which already has `evidenceCitations`,
`confidence`, `repositorySource`, `auditHistory`) with **required** citation + authorities
+ explicit unknowns. **Gap:** current nodes make these optional; V2 makes them required
and enforced at write time (the same invariant `NarrativeClaim.evidenceId` already
demonstrates).

### 2.3 "Every page reads from the graph"
Migration: introduce a `useCaseGraph(caseId)` data hook that hydrates from
`buildCaseIntelligence` + graph repositories; refactor workspace panels to consume it.
**Status: PROPOSED** (today pages read from mixed sources — API Wiring Report, Program 35).

---

## 3. Subsystem wiring (one model, no isolated features)

| Subsystem | Connects via | Status |
|-----------|--------------|--------|
| Evidence / Discovery | evidence repos → graph nodes + claims | BUILT (ingest) / PROPOSED (auto-graph) |
| Timeline | `TimelineEngine` ← `NormalizedClaimEvent` | BUILT |
| Witnesses / Charges / Authorities | intelligence model + PEN repos | BUILT (PEN) |
| Knowledge Graph | `evidence_graphs` / `evidence_links` | BUILT (partial) |
| Attorney Notes / Investigation / Tasks | workbench service | BUILT |
| Messaging / Client Collaboration | membership + permission engine | BUILT (Program 32) |
| Reports / Presentation | report engine + presentation deck | BUILT (Programs 30, 33) |
| Calendar / Deadlines | case `nextHearing` (thin) | PARTIAL |
| Research / Motion Intelligence / Trial Prep | recommendation engines + trial-prep service | PARTIAL (Programs 47, 49) |

---

## 4. Duplicated-logic elimination (from audits)

- Frontend already unified on one component library + one timeline engine + one graph
  engine + one report engine + one search (Programs 18–30) — **no duplicated UI logic**.
- **Backend gap:** pages/services query data through mixed paths (API Wiring, Program 35).
  V2 mandates the shared intelligence model + graph as the single read path.

---

## 5. Verdict

**Case Intelligence Architecture: foundation BUILT, full OS PROPOSED.**
The shared intelligence model (`buildCaseIntelligence` / `AttorneyIntelligenceReport`),
the graph engine, and the workspace shells exist and are real. Becoming a true
"litigation OS" requires: (a) making graph-node citation/authority/audit **required**,
(b) routing **every** page through the shared model/graph, and (c) auto-updating the
graph on every ingestion. These are specified here as V2 work — none is claimed done.
