// =============================================================================
// CourtAccess — Knowledge Graph adapters + sample corpus (Program 27)
// =============================================================================

import type { GraphNodeType, KnowledgeGraphData } from './types';

/** Adapt the workbench graph shape ({nodes:{id,type,label}, edges:{from,to,relation}}). */
export function fromWorkbenchGraph(graph: {
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ from: string; to: string; relation: string }>;
}): KnowledgeGraphData {
  const validTypes = new Set<string>([
    'evidence', 'witness', 'person', 'charge', 'statute', 'authority', 'calcrim',
    'document', 'location', 'vehicle', 'phone', 'financial', 'organization',
    'timeline_event', 'contradiction', 'unknown',
  ]);
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: (validTypes.has(n.type) ? n.type : 'unknown') as GraphNodeType,
      label: n.label,
    })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, relation: e.relation })),
  };
}

/** Representative case graph for demonstration when live graph data is absent. */
export const SAMPLE_GRAPH: KnowledgeGraphData = {
  nodes: [
    { id: 'def', type: 'person', label: 'Defendant — J. Smith', confidence: 95, repositorySource: 'Case Repository', evidenceCitations: ['DOC-001'], auditHistory: [{ at: '2026-01-04T10:00:00Z', event: 'Node created from intake' }] },
    { id: 'chg1', type: 'charge', label: 'PC 459 — Burglary', confidence: 95, repositorySource: 'Charge Analysis', evidenceCitations: ['DOC-002'] },
    { id: 'stat1', type: 'statute', label: 'PC 459', confidence: 99, repositorySource: 'California Codes' },
    { id: 'cal1', type: 'calcrim', label: 'CALCRIM 1700', confidence: 96, repositorySource: 'Authorities' },
    { id: 'wit1', type: 'witness', label: 'Maria Alvarez', confidence: 72, repositorySource: 'Witness Registry', evidenceCitations: ['DOC-004'] },
    { id: 'ev1', type: 'evidence', label: 'Body-cam footage', confidence: 88, repositorySource: 'Evidence Vault', evidenceCitations: ['EV-101'], auditHistory: [{ at: '2026-01-05T14:22:00Z', event: 'Accessed by user #4821' }] },
    { id: 'loc1', type: 'location', label: '4th & Main St', confidence: 80, repositorySource: 'Knowledge Graph' },
    { id: 'veh1', type: 'vehicle', label: 'Plate 7ABC123', confidence: 80, repositorySource: 'DMV Record' },
    { id: 'phone1', type: 'phone', label: '(555) 010-2233', confidence: 65 },
    { id: 'doc1', type: 'document', label: 'Police Report #4471', confidence: 90, repositorySource: 'OCR Index', evidenceCitations: ['DOC-001'] },
    { id: 'tl1', type: 'timeline_event', label: 'Arrest 21:40', confidence: 65, timestamp: '2026-01-03T21:40:00Z' },
    { id: 'con1', type: 'contradiction', label: 'Time conflict: cam vs dispatch', confidence: 70 },
    { id: 'org1', type: 'organization', label: 'LAPD — Central', confidence: 92 },
  ],
  edges: [
    { from: 'def', to: 'chg1', relation: 'charged with', strength: 0.9 },
    { from: 'chg1', to: 'stat1', relation: 'under', strength: 1 },
    { from: 'chg1', to: 'cal1', relation: 'instruction', strength: 0.8 },
    { from: 'def', to: 'veh1', relation: 'owns', strength: 0.7 },
    { from: 'veh1', to: 'loc1', relation: 'seen at', strength: 0.5 },
    { from: 'wit1', to: 'ev1', relation: 'appears in', strength: 0.6 },
    { from: 'ev1', to: 'loc1', relation: 'recorded at', strength: 0.7 },
    { from: 'ev1', to: 'tl1', relation: 'timestamped', strength: 0.8 },
    { from: 'tl1', to: 'con1', relation: 'conflicts', strength: 0.9 },
    { from: 'doc1', to: 'org1', relation: 'authored by', strength: 0.6 },
    { from: 'doc1', to: 'def', relation: 'references', strength: 0.5 },
    { from: 'def', to: 'phone1', relation: 'uses', strength: 0.4 },
    { from: 'wit1', to: 'def', relation: 'identifies', strength: 0.5 },
  ],
};
