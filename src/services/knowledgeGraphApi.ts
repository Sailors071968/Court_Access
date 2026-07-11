// Case Knowledge Graph — fetches the real backend graph and maps it to the
// frontend graph engine model. No fabrication: nodes/edges come from the
// evidence-governed backend builder.
import type { KnowledgeGraphData, GraphNode, GraphNodeType } from '../components/graph/types';

const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface KgBackendNode {
  id: string;
  type: string;
  label: string;
  repositorySource?: string;
  citations?: string[];
  timestamp?: string | null;
}
export interface KgBackendEdge { from: string; to: string; relation: string; strength?: number }
export interface CaseKnowledgeGraphResponse {
  caseId: string;
  generatedAt: string;
  nodes: KgBackendNode[];
  edges: KgBackendEdge[];
  counts: { nodes: number; edges: number; byType: Record<string, number> };
}

// Backend node type → frontend engine node type (unmapped → 'unknown').
const TYPE_MAP: Record<string, GraphNodeType> = {
  case: 'organization',
  defendant: 'person',
  attorney: 'person',
  judge: 'person',
  court: 'location',
  charge: 'charge',
  evidence: 'evidence',
  witness: 'witness',
  timeline_event: 'timeline_event',
  statute: 'statute',
  authority: 'authority',
  jury_instruction: 'calcrim',
  motion: 'document',
  report: 'document',
  contradiction: 'contradiction',
};

export function mapToGraphData(g: CaseKnowledgeGraphResponse): KnowledgeGraphData {
  const nodes: GraphNode[] = g.nodes.map((n) => ({
    id: n.id,
    type: TYPE_MAP[n.type] ?? 'unknown',
    label: n.label,
    repositorySource: n.repositorySource,
    evidenceCitations: n.citations,
    timestamp: n.timestamp ?? null,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = g.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ from: e.from, to: e.to, relation: e.relation, strength: e.strength }));
  return { nodes, edges };
}

export async function fetchCaseKnowledgeGraph(caseId: string): Promise<CaseKnowledgeGraphResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/knowledge-graph`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load knowledge graph');
  const data = await res.json();
  // Endpoint may return the graph directly or wrapped in { graph }.
  return (data.graph ?? data) as CaseKnowledgeGraphResponse;
}
