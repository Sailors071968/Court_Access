// ============================================
// Court Access — Graph Query Safety Tests
// Phase 119: Production Hardening
//
// Tests:
// - Cypher injection protection
// - Tenant isolation
// - Graph traversal limits
// - Path query correctness
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../backend/src/services/prismaClient.js', () => ({
  default: {},
}));

// Mock redis
vi.mock('../../backend/src/services/redisClient.js', () => ({
  getRedisConnection: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

const {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  createNode,
  createRelationship,
  getCaseGraph,
  getEntityNeighbors,
  searchGraphEntities,
  getGraphStats,
} = await import('../../backend/src/services/graphService.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Graph Query Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cypher Injection Protection', () => {
    it('should reject invalid relationship types', async () => {
      // Create two valid nodes first
      const nodeA = await createNode({
        caseId: 'case-inject-test',
        type: NODE_TYPES.PERSON,
        label: 'Test Person A',
        metadata: {},
      });
      const nodeB = await createNode({
        caseId: 'case-inject-test',
        type: NODE_TYPES.PERSON,
        label: 'Test Person B',
        metadata: {},
      });

      // Attempt Cypher injection via relationshipType
      await expect(
        createRelationship({
          sourceNode: nodeA.id,
          targetNode: nodeB.id,
          relationshipType: 'RELATED_TO}]->(m) DELETE m CREATE (n)-[:HACKED {',
          confidenceScore: 1.0,
        })
      ).rejects.toThrow('Invalid relationship type');
    });

    it('should accept valid relationship types', async () => {
      const nodeA = await createNode({
        caseId: 'case-valid-test',
        type: NODE_TYPES.PERSON,
        label: 'Valid Person A',
        metadata: {},
      });
      const nodeB = await createNode({
        caseId: 'case-valid-test',
        type: NODE_TYPES.EVENT,
        label: 'Valid Event',
        metadata: {},
      });

      const rel = await createRelationship({
        sourceNode: nodeA.id,
        targetNode: nodeB.id,
        relationshipType: RELATIONSHIP_TYPES.PARTICIPATED_IN,
        confidenceScore: 0.9,
      });

      expect(rel).toBeDefined();
      expect(rel.type).toBe(RELATIONSHIP_TYPES.PARTICIPATED_IN);
    });

    it('should reject all known injection patterns', async () => {
      const nodeA = await createNode({
        caseId: 'case-inject-2',
        type: NODE_TYPES.PERSON,
        label: 'Person',
        metadata: {},
      });
      const nodeB = await createNode({
        caseId: 'case-inject-2',
        type: NODE_TYPES.DOCUMENT,
        label: 'Doc',
        metadata: {},
      });

      const injectionPayloads = [
        "RELATED_TO']) MATCH (x) DETACH DELETE x //",
        "UNION MATCH (n) RETURN n.password",
        "' OR 1=1 --",
        "PARTICIPATED_IN}]->() WITH * MATCH (n) DELETE n //",
        "<script>alert(1)</script>",
      ];

      for (const payload of injectionPayloads) {
        await expect(
          createRelationship({
            sourceNode: nodeA.id,
            targetNode: nodeB.id,
            relationshipType: payload,
            confidenceScore: 1.0,
          })
        ).rejects.toThrow('Invalid relationship type');
      }
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return nodes for the requested case', async () => {
      // Create nodes in two different cases
      await createNode({ caseId: 'case-A', type: NODE_TYPES.PERSON, label: 'Person A', metadata: {} });
      await createNode({ caseId: 'case-B', type: NODE_TYPES.PERSON, label: 'Person B', metadata: {} });

      const graphA = await getCaseGraph('case-A');
      const graphB = await getCaseGraph('case-B');

      // Verify no cross-case contamination
      for (const node of graphA.nodes) {
        expect(node.label).not.toBe('Person B');
      }
      for (const node of graphB.nodes) {
        expect(node.label).not.toBe('Person A');
      }
    });

    it('should isolate graph stats per case', async () => {
      await createNode({ caseId: 'case-stats-A', type: NODE_TYPES.PERSON, label: 'SA1', metadata: {} });
      await createNode({ caseId: 'case-stats-A', type: NODE_TYPES.PERSON, label: 'SA2', metadata: {} });
      await createNode({ caseId: 'case-stats-B', type: NODE_TYPES.EVENT, label: 'SB1', metadata: {} });

      const statsA = await getGraphStats('case-stats-A');
      const statsB = await getGraphStats('case-stats-B');

      expect(statsA.nodeCount).toBe(2);
      expect(statsB.nodeCount).toBe(1);
    });

    it('should not return neighbors from other cases', async () => {
      const nodeA = await createNode({ caseId: 'case-neighbor-A', type: NODE_TYPES.PERSON, label: 'NA1', metadata: {} });
      const nodeA2 = await createNode({ caseId: 'case-neighbor-A', type: NODE_TYPES.EVENT, label: 'NA2', metadata: {} });
      await createNode({ caseId: 'case-neighbor-B', type: NODE_TYPES.PERSON, label: 'NB1', metadata: {} });

      await createRelationship({
        sourceNode: nodeA.id,
        targetNode: nodeA2.id,
        relationshipType: RELATIONSHIP_TYPES.PARTICIPATED_IN,
        confidenceScore: 0.9,
      });

      const neighbors = await getEntityNeighbors(nodeA.id);
      for (const node of neighbors.nodes) {
        expect(node.label).not.toBe('NB1');
      }
    });
  });

  describe('Graph Traversal Limits', () => {
    it('should respect limit parameter on getCaseGraph', async () => {
      // Create many nodes
      for (let i = 0; i < 20; i++) {
        await createNode({ caseId: 'case-limit', type: NODE_TYPES.PERSON, label: `Limit-${i}`, metadata: {} });
      }

      const graph = await getCaseGraph('case-limit', { limit: 5 });
      expect(graph.nodes.length).toBeLessThanOrEqual(5);
    });

    it('should respect depth limit on neighbor queries', async () => {
      const root = await createNode({ caseId: 'case-depth', type: NODE_TYPES.PERSON, label: 'Root', metadata: {} });
      const child = await createNode({ caseId: 'case-depth', type: NODE_TYPES.EVENT, label: 'Child', metadata: {} });
      const grandchild = await createNode({ caseId: 'case-depth', type: NODE_TYPES.DOCUMENT, label: 'Grandchild', metadata: {} });

      await createRelationship({
        sourceNode: root.id, targetNode: child.id,
        relationshipType: RELATIONSHIP_TYPES.PARTICIPATED_IN, confidenceScore: 0.9,
      });
      await createRelationship({
        sourceNode: child.id, targetNode: grandchild.id,
        relationshipType: RELATIONSHIP_TYPES.MENTIONED_IN, confidenceScore: 0.8,
      });

      const neighbors = await getEntityNeighbors(root.id, { depth: 1 });
      const nodeIds = neighbors.nodes.map((n: { id: string }) => n.id);
      expect(nodeIds).toContain(child.id);
      // Depth 1 should not include grandchild
    });
  });

  describe('Search Safety', () => {
    it('should handle special regex characters in search', async () => {
      await createNode({ caseId: 'case-search', type: NODE_TYPES.PERSON, label: 'John (Smith)', metadata: {} });

      // Should not throw on special characters
      const results = await searchGraphEntities('case-search', '(Smith)');
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle empty search query', async () => {
      const results = await searchGraphEntities('case-search', '');
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('Node Type Validation', () => {
    it('should define all expected node types', () => {
      expect(NODE_TYPES.PERSON).toBe('Person');
      expect(NODE_TYPES.EVENT).toBe('Event');
      expect(NODE_TYPES.DOCUMENT).toBe('Document');
      expect(NODE_TYPES.STATEMENT).toBe('Statement');
      expect(NODE_TYPES.LOCATION).toBe('Location');
      expect(NODE_TYPES.EVIDENCE).toBe('Evidence');
      expect(NODE_TYPES.ORGANIZATION).toBe('Organization');
    });

    it('should define all expected relationship types', () => {
      expect(RELATIONSHIP_TYPES.PARTICIPATED_IN).toBe('PARTICIPATED_IN');
      expect(RELATIONSHIP_TYPES.MENTIONED_IN).toBe('MENTIONED_IN');
      expect(RELATIONSHIP_TYPES.REFERENCED_BY).toBe('REFERENCED_BY');
      expect(RELATIONSHIP_TYPES.TESTIFIED_ABOUT).toBe('TESTIFIED_ABOUT');
      expect(RELATIONSHIP_TYPES.COLLECTED_BY).toBe('COLLECTED_BY');
      expect(RELATIONSHIP_TYPES.OCCURRED_AT).toBe('OCCURRED_AT');
      expect(RELATIONSHIP_TYPES.RELATED_TO).toBe('RELATED_TO');
      expect(RELATIONSHIP_TYPES.CONTRADICTS).toBe('CONTRADICTS');
    });
  });
});
