// ============================================
// Court Access — Evidence Graph Service (AI Evidence Intelligence Phase 7)
// Relationship graph between evidence items, persons, and cases.
//
// Graph operations:
//   - Add nodes (persons, evidence, locations, etc.)
//   - Add edges (relationships between nodes)
//   - Query graph for connections
//   - Merge duplicate entities
//
// Deterministic — same input always produces same output.
// ============================================

import type {
  EvidenceGraph,
  EvidenceGraphNode,
  EvidenceGraphEdge,
  GraphNodeType,
  GraphRelationshipType,
  GraphBuilderInput,
  GraphBuilderResult,
} from '../models/EvidenceGraphModel';

// ---------------------------------------------------------------------------
// Graph Builder
// ---------------------------------------------------------------------------

/**
 * Build graph nodes and edges from extracted entities and relationships.
 * Deduplicates nodes by label + type combination.
 */
export function buildEvidenceGraph(
  input: GraphBuilderInput,
  existingGraph?: EvidenceGraph
): GraphBuilderResult {
  try {
    const now = new Date().toISOString();
    const existingNodes = existingGraph?.nodes ?? [];
    const existingEdges = existingGraph?.edges ?? [];

    // Build a lookup map for existing nodes (label + type → node)
    const nodeLookup = new Map<string, EvidenceGraphNode>();
    for (const node of existingNodes) {
      nodeLookup.set(`${node.nodeType}:${node.label.toLowerCase()}`, node);
    }

    let nodesCreated = 0;
    let edgesCreated = 0;

    // Add new nodes (deduplicate by label + type)
    for (const entity of input.extractedEntities) {
      const key = `${entity.type}:${entity.label.toLowerCase()}`;
      if (!nodeLookup.has(key)) {
        const nodeId = `gn-${input.caseId.slice(0, 8)}-${String(existingNodes.length + nodesCreated).padStart(4, '0')}`;
        const node: EvidenceGraphNode = {
          nodeId,
          nodeType: entity.type,
          label: entity.label,
          entityId: input.evidenceId,
          caseId: input.caseId,
          tenantId: input.tenantId,
          metadata: entity.metadata ?? {},
          createdAt: now,
        };
        nodeLookup.set(key, node);
        nodesCreated++;
      }
    }

    // Add new edges
    const newEdges: EvidenceGraphEdge[] = [];
    for (const rel of input.extractedRelationships) {
      const sourceKey = findNodeKey(nodeLookup, rel.sourceLabel);
      const targetKey = findNodeKey(nodeLookup, rel.targetLabel);

      if (sourceKey && targetKey) {
        const sourceNode = nodeLookup.get(sourceKey);
        const targetNode = nodeLookup.get(targetKey);

        if (sourceNode && targetNode) {
          // Check for duplicate edge
          const edgeExists = existingEdges.some(
            (e) =>
              e.sourceNodeId === sourceNode.nodeId &&
              e.targetNodeId === targetNode.nodeId &&
              e.relationshipType === rel.relationshipType
          ) || newEdges.some(
            (e) =>
              e.sourceNodeId === sourceNode.nodeId &&
              e.targetNodeId === targetNode.nodeId &&
              e.relationshipType === rel.relationshipType
          );

          if (!edgeExists) {
            const edgeId = `ge-${input.caseId.slice(0, 8)}-${String(existingEdges.length + edgesCreated).padStart(4, '0')}`;
            newEdges.push({
              edgeId,
              sourceNodeId: sourceNode.nodeId,
              targetNodeId: targetNode.nodeId,
              relationshipType: rel.relationshipType,
              confidence: rel.confidence,
              sourceEvidenceId: input.evidenceId,
              description: rel.description,
              createdAt: now,
            });
            edgesCreated++;
          }
        }
      }
    }

    return {
      success: true,
      nodesCreated,
      edgesCreated,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      nodesCreated: 0,
      edgesCreated: 0,
      error: err instanceof Error ? err.message : 'Graph building failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Node Lookup Helper
// ---------------------------------------------------------------------------

function findNodeKey(
  nodeLookup: Map<string, EvidenceGraphNode>,
  label: string
): string | null {
  const normalizedLabel = label.toLowerCase();
  for (const [key] of nodeLookup) {
    if (key.endsWith(`:${normalizedLabel}`)) {
      return key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Graph Queries
// ---------------------------------------------------------------------------

/**
 * Find all nodes connected to a given node.
 */
export function findConnectedNodes(
  graph: EvidenceGraph,
  nodeId: string
): { node: EvidenceGraphNode; edge: EvidenceGraphEdge; direction: 'outgoing' | 'incoming' }[] {
  const connections: { node: EvidenceGraphNode; edge: EvidenceGraphEdge; direction: 'outgoing' | 'incoming' }[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.nodeId, n]));

  for (const edge of graph.edges) {
    if (edge.sourceNodeId === nodeId) {
      const target = nodeMap.get(edge.targetNodeId);
      if (target) {
        connections.push({ node: target, edge, direction: 'outgoing' });
      }
    }
    if (edge.targetNodeId === nodeId) {
      const source = nodeMap.get(edge.sourceNodeId);
      if (source) {
        connections.push({ node: source, edge, direction: 'incoming' });
      }
    }
  }

  return connections;
}

/**
 * Find all nodes of a specific type.
 */
export function findNodesByType(
  graph: EvidenceGraph,
  nodeType: GraphNodeType
): EvidenceGraphNode[] {
  return graph.nodes.filter((n) => n.nodeType === nodeType);
}

/**
 * Find all edges of a specific relationship type.
 */
export function findEdgesByType(
  graph: EvidenceGraph,
  relationshipType: GraphRelationshipType
): EvidenceGraphEdge[] {
  return graph.edges.filter((e) => e.relationshipType === relationshipType);
}

/**
 * Get graph statistics.
 */
export function getGraphStats(graph: EvidenceGraph): {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
} {
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};

  for (const node of graph.nodes) {
    nodesByType[node.nodeType] = (nodesByType[node.nodeType] || 0) + 1;
  }
  for (const edge of graph.edges) {
    edgesByType[edge.relationshipType] = (edgesByType[edge.relationshipType] || 0) + 1;
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodesByType,
    edgesByType,
  };
}
