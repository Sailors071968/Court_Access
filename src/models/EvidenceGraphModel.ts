// ============================================
// Court Access — Evidence Graph Model (AI Evidence Intelligence Phase 7)
// Relationship graph between evidence items, persons, and cases.
//
// Graph structure:
//   Person → Evidence
//   Evidence → Evidence
//   Evidence → Case
//
// Deterministic — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Graph Node Types
// ---------------------------------------------------------------------------

export type GraphNodeType = 'person' | 'evidence' | 'case' | 'location' | 'organization' | 'date';

// ---------------------------------------------------------------------------
// Graph Relationship Types
// ---------------------------------------------------------------------------

export type GraphRelationshipType =
  | 'mentions'
  | 'references'
  | 'depicts'
  | 'recorded_by'
  | 'authored_by'
  | 'present_at'
  | 'related_to'
  | 'contradicts'
  | 'corroborates'
  | 'same_person'
  | 'same_event'
  | 'same_location';

// ---------------------------------------------------------------------------
// Graph Node
// ---------------------------------------------------------------------------

/**
 * A node in the evidence relationship graph.
 */
export interface EvidenceGraphNode {
  nodeId: string;
  nodeType: GraphNodeType;
  label: string;                        // Display label (e.g. person name, evidence title)
  entityId: string;                     // Reference to the actual entity (evidence_id, case_id, etc.)
  caseId: string;
  tenantId: string;
  metadata: Record<string, string>;     // Additional context
  createdAt: string;                    // ISO 8601
}

// ---------------------------------------------------------------------------
// Graph Edge
// ---------------------------------------------------------------------------

/**
 * An edge (relationship) between two graph nodes.
 */
export interface EvidenceGraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: GraphRelationshipType;
  confidence: number;                   // 0–1 confidence in the relationship
  sourceEvidenceId: string | null;      // Evidence that established this relationship
  description: string;                  // Human-readable description
  createdAt: string;                    // ISO 8601
}

// ---------------------------------------------------------------------------
// Evidence Graph
// ---------------------------------------------------------------------------

/**
 * Complete evidence relationship graph for a case.
 */
export interface EvidenceGraph {
  caseId: string;
  tenantId: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  lastUpdated: string;                  // ISO 8601
}

// ---------------------------------------------------------------------------
// Graph Builder Input/Result
// ---------------------------------------------------------------------------

export interface GraphBuilderInput {
  caseId: string;
  tenantId: string;
  evidenceId: string;
  extractedEntities: ExtractedEntity[];
  extractedRelationships: ExtractedRelationship[];
}

export interface ExtractedEntity {
  label: string;
  type: GraphNodeType;
  metadata?: Record<string, string>;
}

export interface ExtractedRelationship {
  sourceLabel: string;
  targetLabel: string;
  relationshipType: GraphRelationshipType;
  confidence: number;
  description: string;
}

export interface GraphBuilderResult {
  success: boolean;
  nodesCreated: number;
  edgesCreated: number;
  error: string | null;
}
