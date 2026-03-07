// ============================================
// Court Access — Graph Service Layer
// Phase 117: Evidence Graph + Visualization System
//
// Provides graph database operations for the evidence graph.
// Uses an in-memory graph store with Neo4j-compatible interface.
// When Neo4j is available, operations are forwarded to Neo4j via Bolt.
// ============================================

// ---------------------------------------------------------------------------
// Graph Node Types
// ---------------------------------------------------------------------------

export const NODE_TYPES = {
  PERSON: 'Person',
  EVENT: 'Event',
  DOCUMENT: 'Document',
  STATEMENT: 'Statement',
  LOCATION: 'Location',
  EVIDENCE: 'Evidence',
  ORGANIZATION: 'Organization',
};

// ---------------------------------------------------------------------------
// Graph Relationship Types
// ---------------------------------------------------------------------------

export const RELATIONSHIP_TYPES = {
  PARTICIPATED_IN: 'PARTICIPATED_IN',
  MENTIONED_IN: 'MENTIONED_IN',
  REFERENCED_BY: 'REFERENCED_BY',
  TESTIFIED_ABOUT: 'TESTIFIED_ABOUT',
  COLLECTED_BY: 'COLLECTED_BY',
  OCCURRED_AT: 'OCCURRED_AT',
  RELATED_TO: 'RELATED_TO',
  CONTRADICTS: 'CONTRADICTS',
};

// ---------------------------------------------------------------------------
// In-Memory Graph Store (fallback when Neo4j is unavailable)
// ---------------------------------------------------------------------------

const graphStore = {
  nodes: new Map(),       // nodeId -> node
  edges: new Map(),       // edgeId -> edge
  caseIndex: new Map(),   // caseId -> Set<nodeId>
  typeIndex: new Map(),   // nodeType -> Set<nodeId>
};

// ---------------------------------------------------------------------------
// Neo4j Connection (optional)
// ---------------------------------------------------------------------------

let neo4jDriver = null;
let neo4jAvailable = false;

/**
 * Initialize Neo4j connection if available.
 */
export async function initGraphDatabase() {
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || '';

  try {
    const neo4j = await import('neo4j-driver').catch(() => null);
    if (neo4j) {
      neo4jDriver = neo4j.default.driver(neo4jUri, neo4j.default.auth.basic(neo4jUser, neo4jPassword));
      await neo4jDriver.verifyConnectivity();
      neo4jAvailable = true;
      console.log('[GraphService] Neo4j connected at', neo4jUri);

      // Create indexes for performance
      const session = neo4jDriver.session();
      try {
        await session.run('CREATE INDEX IF NOT EXISTS FOR (n:GraphNode) ON (n.id)');
        await session.run('CREATE INDEX IF NOT EXISTS FOR (n:GraphNode) ON (n.caseId)');
        await session.run('CREATE INDEX IF NOT EXISTS FOR (n:GraphNode) ON (n.type)');
      } finally {
        await session.close();
      }
    }
  } catch (err) {
    console.log('[GraphService] Neo4j not available, using in-memory graph store:', err.message);
    neo4jAvailable = false;
  }
}

/**
 * Close Neo4j connection.
 */
export async function closeGraphDatabase() {
  if (neo4jDriver) {
    await neo4jDriver.close();
    neo4jDriver = null;
    neo4jAvailable = false;
  }
}

// ---------------------------------------------------------------------------
// Node Operations
// ---------------------------------------------------------------------------

/**
 * Create a graph node.
 *
 * @param {object} node
 * @param {string} node.id - Unique node ID
 * @param {string} node.type - Node type (Person, Event, Document, etc.)
 * @param {string} node.caseId - Case this node belongs to
 * @param {string} node.label - Display label
 * @param {object} node.metadata - Additional metadata
 * @returns {Promise<object>} Created node
 */
export async function createNode(node) {
  const { id, type, caseId, label, metadata = {} } = node;

  const graphNode = {
    id,
    type,
    caseId,
    label,
    metadata,
    createdAt: new Date().toISOString(),
    connectionCount: 0,
  };

  if (neo4jAvailable && neo4jDriver) {
    const session = neo4jDriver.session();
    try {
      await session.run(
        `MERGE (n:GraphNode {id: $id})
         SET n.type = $type, n.caseId = $caseId, n.label = $label,
             n.metadata = $metadata, n.createdAt = $createdAt`,
        {
          id,
          type,
          caseId,
          label,
          metadata: JSON.stringify(metadata),
          createdAt: graphNode.createdAt,
        }
      );
    } finally {
      await session.close();
    }
  }

  // Always store in memory for fast access
  graphStore.nodes.set(id, graphNode);

  if (!graphStore.caseIndex.has(caseId)) {
    graphStore.caseIndex.set(caseId, new Set());
  }
  graphStore.caseIndex.get(caseId).add(id);

  if (!graphStore.typeIndex.has(type)) {
    graphStore.typeIndex.set(type, new Set());
  }
  graphStore.typeIndex.get(type).add(id);

  return graphNode;
}

/**
 * Create a relationship between two nodes.
 *
 * @param {object} relationship
 * @param {string} relationship.sourceNode - Source node ID
 * @param {string} relationship.targetNode - Target node ID
 * @param {string} relationship.relationshipType - Relationship type
 * @param {number} relationship.confidenceScore - Confidence (0-1)
 * @param {string} relationship.sourceDocument - Source document ID
 * @param {object} relationship.metadata - Additional metadata
 * @returns {Promise<object>} Created relationship
 */
export async function createRelationship(relationship) {
  const {
    sourceNode,
    targetNode,
    relationshipType,
    confidenceScore = 1.0,
    sourceDocument = null,
    metadata = {},
  } = relationship;

  // Validate relationshipType to prevent Cypher injection
  const validTypes = new Set(Object.values(RELATIONSHIP_TYPES));
  if (!validTypes.has(relationshipType)) {
    throw new Error(`Invalid relationship type: ${relationshipType}`);
  }

  const edgeId = `${sourceNode}-${relationshipType}-${targetNode}`;

  const edge = {
    id: edgeId,
    source: sourceNode,
    target: targetNode,
    type: relationshipType,
    confidence: confidenceScore,
    sourceDocument,
    metadata,
    createdAt: new Date().toISOString(),
  };

  if (neo4jAvailable && neo4jDriver) {
    const session = neo4jDriver.session();
    try {
      await session.run(
        `MATCH (a:GraphNode {id: $source}), (b:GraphNode {id: $target})
         MERGE (a)-[r:${relationshipType} {id: $edgeId}]->(b)
         SET r.confidence = $confidence, r.sourceDocument = $sourceDocument,
             r.metadata = $metadata, r.createdAt = $createdAt`,
        {
          source: sourceNode,
          target: targetNode,
          edgeId,
          confidence: confidenceScore,
          sourceDocument: sourceDocument || '',
          metadata: JSON.stringify(metadata),
          createdAt: edge.createdAt,
        }
      );
    } finally {
      await session.close();
    }
  }

  // Update in-memory store
  graphStore.edges.set(edgeId, edge);

  // Update connection counts
  const srcNode = graphStore.nodes.get(sourceNode);
  if (srcNode) srcNode.connectionCount = (srcNode.connectionCount || 0) + 1;

  const tgtNode = graphStore.nodes.get(targetNode);
  if (tgtNode) tgtNode.connectionCount = (tgtNode.connectionCount || 0) + 1;

  return edge;
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Get the full graph for a case.
 *
 * @param {string} caseId
 * @param {object} options
 * @param {string[]} options.nodeTypes - Filter by node types
 * @param {string[]} options.relationshipTypes - Filter by relationship types
 * @param {number} options.limit - Max nodes to return
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function getCaseGraph(caseId, options = {}) {
  const { nodeTypes, relationshipTypes, limit = 500 } = options;

  const nodeIds = graphStore.caseIndex.get(caseId) || new Set();

  let nodes = [];
  for (const nodeId of nodeIds) {
    const node = graphStore.nodes.get(nodeId);
    if (!node) continue;
    if (nodeTypes && nodeTypes.length > 0 && !nodeTypes.includes(node.type)) continue;
    nodes.push(formatNodeForResponse(node));
  }

  // Sort by connection count (most connected first) and apply limit
  nodes.sort((a, b) => (b.connectionCount || 0) - (a.connectionCount || 0));
  if (limit && nodes.length > limit) {
    nodes = nodes.slice(0, limit);
  }

  const nodeIdSet = new Set(nodes.map(n => n.id));

  // Get edges between visible nodes
  const edges = [];
  for (const [, edge] of graphStore.edges) {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    if (relationshipTypes && relationshipTypes.length > 0 && !relationshipTypes.includes(edge.type)) continue;
    edges.push(formatEdgeForResponse(edge));
  }

  return { nodes, edges };
}

/**
 * Get neighbors of a specific entity.
 *
 * @param {string} entityId - Node ID
 * @param {object} options
 * @param {number} options.depth - How many hops (default: 1)
 * @param {string[]} options.relationshipTypes - Filter by relationship types
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function getEntityNeighbors(entityId, options = {}) {
  const { depth = 1, relationshipTypes } = options;

  const visited = new Set([entityId]);
  const resultNodes = [];
  const resultEdges = [];

  const centerNode = graphStore.nodes.get(entityId);
  if (centerNode) {
    resultNodes.push(formatNodeForResponse(centerNode));
  }

  let frontier = [entityId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier = [];

    for (const [, edge] of graphStore.edges) {
      if (relationshipTypes && relationshipTypes.length > 0 && !relationshipTypes.includes(edge.type)) continue;

      let neighborId = null;
      if (frontier.includes(edge.source) && !visited.has(edge.target)) {
        neighborId = edge.target;
      } else if (frontier.includes(edge.target) && !visited.has(edge.source)) {
        neighborId = edge.source;
      }

      if (neighborId) {
        visited.add(neighborId);
        nextFrontier.push(neighborId);
        const neighborNode = graphStore.nodes.get(neighborId);
        if (neighborNode) {
          resultNodes.push(formatNodeForResponse(neighborNode));
        }
        resultEdges.push(formatEdgeForResponse(edge));
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return { nodes: resultNodes, edges: resultEdges };
}

/**
 * Search graph entities.
 *
 * @param {string} query - Search query
 * @param {object} options
 * @param {string} options.caseId - Filter by case
 * @param {string} options.type - Filter by node type
 * @param {number} options.limit - Max results
 * @returns {Promise<Array>}
 */
export async function searchGraphEntities(query, options = {}) {
  const { caseId, type, limit = 50 } = options;
  const normalizedQuery = query.toLowerCase().trim();

  const results = [];

  for (const [, node] of graphStore.nodes) {
    if (caseId && node.caseId !== caseId) continue;
    if (type && node.type !== type) continue;

    const label = (node.label || '').toLowerCase();
    if (label.includes(normalizedQuery)) {
      results.push(formatNodeForResponse(node));
    }

    if (results.length >= limit) break;
  }

  // Sort by relevance (exact match first, then by connection count)
  results.sort((a, b) => {
    const aExact = a.label.toLowerCase() === normalizedQuery ? 1 : 0;
    const bExact = b.label.toLowerCase() === normalizedQuery ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return (b.connectionCount || 0) - (a.connectionCount || 0);
  });

  return results;
}

/**
 * Expand a node to load its relationships lazily.
 *
 * @param {string} caseId
 * @param {string} nodeId
 * @param {object} options
 * @param {string[]} options.nodeTypes - Filter neighbor types
 * @param {string[]} options.relationshipTypes - Filter relationship types
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function expandNode(caseId, nodeId, options = {}) {
  const { nodeTypes, relationshipTypes } = options;

  const neighbors = await getEntityNeighbors(nodeId, { depth: 1, relationshipTypes });

  // Filter by node types if specified
  if (nodeTypes && nodeTypes.length > 0) {
    neighbors.nodes = neighbors.nodes.filter(n => nodeTypes.includes(n.type));
    const nodeIdSet = new Set(neighbors.nodes.map(n => n.id));
    nodeIdSet.add(nodeId);
    neighbors.edges = neighbors.edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));
  }

  // Filter by case
  neighbors.nodes = neighbors.nodes.filter(n => n.caseId === caseId || n.id === nodeId);

  return neighbors;
}

/**
 * Get graph statistics for a case.
 *
 * @param {string} caseId
 * @returns {Promise<object>}
 */
export async function getGraphStats(caseId) {
  const nodeIds = graphStore.caseIndex.get(caseId) || new Set();

  const typeCounts = {};
  for (const nodeId of nodeIds) {
    const node = graphStore.nodes.get(nodeId);
    if (node) {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }
  }

  let edgeCount = 0;
  const relTypeCounts = {};
  for (const [, edge] of graphStore.edges) {
    if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
      edgeCount++;
      relTypeCounts[edge.type] = (relTypeCounts[edge.type] || 0) + 1;
    }
  }

  return {
    nodeCount: nodeIds.size,
    edgeCount,
    typeCounts,
    relationshipTypeCounts: relTypeCounts,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNodeForResponse(node) {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    caseId: node.caseId,
    metadata: node.metadata,
    connectionCount: node.connectionCount || 0,
    createdAt: node.createdAt,
  };
}

function formatEdgeForResponse(edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    confidence: edge.confidence,
    sourceDocument: edge.sourceDocument,
    metadata: edge.metadata,
    createdAt: edge.createdAt,
  };
}

export function isGraphAvailable() {
  return neo4jAvailable;
}
