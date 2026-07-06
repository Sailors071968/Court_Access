// =============================================================================
// CourtAccess — Knowledge Graph engine types (Program 27)
// One node/edge model for every graph across the platform.
// =============================================================================

import type { IconName } from '../icons/registry';

export type GraphNodeType =
  | 'evidence'
  | 'witness'
  | 'person'
  | 'charge'
  | 'statute'
  | 'authority'
  | 'calcrim'
  | 'document'
  | 'location'
  | 'vehicle'
  | 'phone'
  | 'financial'
  | 'organization'
  | 'timeline_event'
  | 'contradiction'
  | 'unknown';

export interface GraphAuditEntry {
  at: string;
  event: string;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  confidence?: number; // 0–100
  repositorySource?: string;
  evidenceCitations?: string[];
  auditHistory?: GraphAuditEntry[];
  timestamp?: string | null;
  pinned?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  /** 0–1 relationship strength (controls line weight). */
  strength?: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeTypeMeta {
  label: string;
  icon: IconName;
  color: string; // hex, used for node accent + edges
}

export const NODE_META: Record<GraphNodeType, NodeTypeMeta> = {
  evidence: { label: 'Evidence', icon: 'evidence', color: '#eab360' },
  witness: { label: 'Witness', icon: 'witness', color: '#a78bfa' },
  person: { label: 'Person', icon: 'defendant', color: '#60a5fa' },
  charge: { label: 'Charge', icon: 'statutes', color: '#f87171' },
  statute: { label: 'Statute', icon: 'statutes', color: '#34d399' },
  authority: { label: 'Authority', icon: 'authorities', color: '#34d399' },
  calcrim: { label: 'CALCRIM', icon: 'caseLaw', color: '#2dd4bf' },
  document: { label: 'Document', icon: 'documents', color: '#93c5fd' },
  location: { label: 'Location', icon: 'court', color: '#fbbf24' },
  vehicle: { label: 'Vehicle', icon: 'search', color: '#38bdf8' },
  phone: { label: 'Phone', icon: 'messages', color: '#c084fc' },
  financial: { label: 'Financial', icon: 'audit', color: '#4ade80' },
  organization: { label: 'Organization', icon: 'lawFirm', color: '#fb923c' },
  timeline_event: { label: 'Timeline Event', icon: 'timeline', color: '#818cf8' },
  contradiction: { label: 'Contradiction', icon: 'contradiction', color: '#ef4444' },
  unknown: { label: 'Unknown', icon: 'unknown', color: '#94a3b8' },
};

/** Cluster ring palette (assigned by connected-component detection). */
export const CLUSTER_COLORS = ['#eab360', '#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fb923c', '#2dd4bf'];
