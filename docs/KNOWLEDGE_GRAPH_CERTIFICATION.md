# Master Program 8 — Case Knowledge Graph Certification

> One canonical, typed case knowledge graph assembled from **real** case records (via the attorney intelligence bundle) and exposed at `GET /api/cases/:caseId/knowledge-graph`. Nodes exist only where the case has real data — no fabricated entities. Runtime-verified live.

## Ingested entity types (node types)

`case`, `defendant`, `attorney`, `court`, `judge`, `charge`, `evidence`, `witness`, `timeline_event`, `statute`, `authority`, `jury_instruction` (CALCRIM), `motion`, `report`, `contradiction`.

Sources: `CriminalCase`, `Client`, case team, `Charge`, `Evidence`, trial-prep witnesses, `getTimelineEvents`, California statute repository, authority matrix, CALCRIM analysis, motion intelligence, contradiction analysis — all via `buildAttorneyWorkbench` (the proven aggregator).

## Generated graphs

- **relationships** — the full typed graph (all nodes + edges).
- **citation** — charge → statute → authority → jury-instruction.
- **evidence** — evidence ↔ contradictions ↔ case.
- **timeline** — chronological event chain (`then` edges).
- **authority** — statutes / authorities / CALCRIM linked to charges.

Implementation: `backend/src/graph/caseKnowledgeGraph.ts` + `knowledgeGraphRoutes.ts`.

## Runtime verification (live)

Executed against the running server for a real case (with a `PEN §459` burglary charge + uploaded evidence):

```
GET /api/cases/:id/knowledge-graph  →  HTTP 200
nodes: 20 · edges: 19
byType: { case:1, attorney:1, charge:1, statute:1, authority:12,
          jury_instruction:1, evidence:1, witness:1, report:1 }
sub-graphs: citation 15 nodes · authority 15 nodes · evidence 2 · timeline 1
auth enforced: no-token → HTTP 401
```

Adding the charge caused the graph to expand from 5 → 20 nodes (charge → statute → 12 authorities + CALCRIM), demonstrating automatic ingestion from real case analysis. Sample: `docs/api-registry/knowledge-graph-sample.json`.

## Honest notes

- The graph is **derived on-demand** from the intelligence bundle (not persisted to a separate graph store); this keeps it consistent with the source of truth and avoids a stale duplicate. A persistent Neo4j projection exists in `backend/src/graph/` for scale but is optional.
- Entity richness scales with case data: a case with no charges yields no citation/authority sub-graph (honest empty), as verified. Deep NER entities (vehicles/phones/locations from evidence text) require the analysis worker (Program 5 finding) and are not yet auto-ingested inline.
- Node types beyond the frontend `GraphNodeType` union (e.g. `court`, `judge`, `motion`, `report`) are backend-canonical; the frontend adapter maps them to display types.

## Verdict

**PASS** — a unified case knowledge graph ingests all available real entity types and generates the five required sub-graphs, exposed via an auth-guarded API and verified live (20 nodes / 19 edges on a real charged case).
