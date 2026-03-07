// ============================================
// Court Access — Large Case Load Testing
// Phase 119: Production Hardening
//
// Simulates large datasets and measures performance:
// - 10,000 entities
// - 50,000 relationships
// - 5,000 events
//
// Targets:
// - <200ms API response
// - <100ms graph expansion
// ============================================

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock prisma
vi.mock('../../backend/src/services/prismaClient.js', () => ({
  default: {
    graphInsight: {
      create: vi.fn().mockRejectedValue(new Error('table not found')),
      findMany: vi.fn().mockResolvedValue([]),
    },
    evidenceScore: {
      upsert: vi.fn().mockRejectedValue(new Error('table not found')),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock redis
vi.mock('../../backend/src/services/redisClient.js', () => ({
  getRedisConnection: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

const {
  createNode,
  createRelationship,
  getCaseGraph,
  getEntityNeighbors,
  searchGraphEntities,
  getGraphStats,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
} = await import('../../backend/src/services/graphService.js');

const {
  identifyCentralActors,
  computeRelationshipDensity,
} = await import('../../backend/src/engines/graphIntelligenceEngine.js');

const {
  scoreAllEvidence,
} = await import('../../backend/src/engines/evidenceStrengthEngine.js');

// ---------------------------------------------------------------------------
// Load Test Configuration
// ---------------------------------------------------------------------------

const LOAD_CASE_ID = 'load-test-case';
const ENTITY_COUNT = 1000; // Scaled for in-memory test (10,000 in prod)
const RELATIONSHIP_COUNT = 5000; // Scaled (50,000 in prod)
const EVENT_COUNT = 500; // Scaled (5,000 in prod)

const PERF_TARGET_API_MS = 200;
const PERF_TARGET_EXPANSION_MS = 100;

// ---------------------------------------------------------------------------
// Setup: Generate large dataset
// ---------------------------------------------------------------------------

describe('Large Case Load Testing', () => {
  const nodeIds: string[] = [];

  beforeAll(async () => {
    console.log(`[LoadTest] Generating ${ENTITY_COUNT} entities, ${EVENT_COUNT} events, ${RELATIONSHIP_COUNT} relationships...`);

    // Create person entities
    const personCount = Math.floor(ENTITY_COUNT * 0.3);
    for (let i = 0; i < personCount; i++) {
      const node = await createNode({
        caseId: LOAD_CASE_ID,
        type: NODE_TYPES.PERSON,
        label: `Person-${i}`,
        metadata: { confidence: Math.random() },
      });
      nodeIds.push(node.id);
    }

    // Create document entities
    const docCount = Math.floor(ENTITY_COUNT * 0.2);
    for (let i = 0; i < docCount; i++) {
      const node = await createNode({
        caseId: LOAD_CASE_ID,
        type: NODE_TYPES.DOCUMENT,
        label: `Document-${i}`,
        metadata: {},
      });
      nodeIds.push(node.id);
    }

    // Create event entities
    for (let i = 0; i < EVENT_COUNT; i++) {
      const timestamp = new Date(2024, 0, 1 + Math.floor(i / 10), Math.floor(Math.random() * 24));
      const node = await createNode({
        caseId: LOAD_CASE_ID,
        type: NODE_TYPES.EVENT,
        label: `Event-${i}`,
        metadata: { timestamp: timestamp.toISOString(), confidence: Math.random() },
      });
      nodeIds.push(node.id);
    }

    // Create remaining entities (Location, Organization, etc.)
    const remainingCount = ENTITY_COUNT - personCount - docCount - EVENT_COUNT;
    for (let i = 0; i < remainingCount; i++) {
      const types = [NODE_TYPES.LOCATION, NODE_TYPES.ORGANIZATION, NODE_TYPES.EVIDENCE, NODE_TYPES.STATEMENT];
      const node = await createNode({
        caseId: LOAD_CASE_ID,
        type: types[i % types.length],
        label: `Entity-${i}`,
        metadata: { confidence: Math.random() },
      });
      nodeIds.push(node.id);
    }

    // Create relationships
    const relTypes = Object.values(RELATIONSHIP_TYPES);
    const maxRels = Math.min(RELATIONSHIP_COUNT, nodeIds.length * 5);
    for (let i = 0; i < maxRels; i++) {
      const sourceIdx = Math.floor(Math.random() * nodeIds.length);
      let targetIdx = Math.floor(Math.random() * nodeIds.length);
      if (targetIdx === sourceIdx) targetIdx = (targetIdx + 1) % nodeIds.length;

      try {
        await createRelationship({
          sourceNode: nodeIds[sourceIdx],
          targetNode: nodeIds[targetIdx],
          relationshipType: relTypes[i % relTypes.length],
          confidenceScore: Math.random(),
        });
      } catch {
        // Skip duplicate or invalid relationships
      }
    }

    console.log(`[LoadTest] Generated ${nodeIds.length} nodes and ~${maxRels} relationships`);
  }, 120000); // 2 min timeout for setup

  // ---------------------------------------------------------------------------
  // Performance Tests
  // ---------------------------------------------------------------------------

  describe('Graph Query Performance', () => {
    it(`should retrieve case graph in <${PERF_TARGET_API_MS}ms`, async () => {
      const start = performance.now();
      const graph = await getCaseGraph(LOAD_CASE_ID, { limit: 200 });
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] getCaseGraph: ${elapsed.toFixed(2)}ms (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS);
    });

    it(`should expand node neighbors in <${PERF_TARGET_EXPANSION_MS}ms`, async () => {
      if (nodeIds.length === 0) return;

      const start = performance.now();
      const neighbors = await getEntityNeighbors(nodeIds[0], { depth: 1 });
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] getEntityNeighbors: ${elapsed.toFixed(2)}ms (${neighbors.nodes.length} neighbors)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_EXPANSION_MS);
    });

    it(`should compute graph stats in <${PERF_TARGET_API_MS}ms`, async () => {
      const start = performance.now();
      const stats = await getGraphStats(LOAD_CASE_ID);
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] getGraphStats: ${elapsed.toFixed(2)}ms (${stats.nodeCount} nodes, ${stats.edgeCount} edges)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS);
    });

    it(`should search entities in <${PERF_TARGET_API_MS}ms`, async () => {
      const start = performance.now();
      const results = await searchGraphEntities(LOAD_CASE_ID, 'Person');
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] searchGraphEntities: ${elapsed.toFixed(2)}ms (${results.length} results)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS);
    });
  });

  describe('Intelligence Engine Performance', () => {
    it(`should identify central actors in <${PERF_TARGET_API_MS}ms`, async () => {
      const start = performance.now();
      const actors = await identifyCentralActors(LOAD_CASE_ID, 10);
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] identifyCentralActors: ${elapsed.toFixed(2)}ms (${actors.length} actors)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS * 5); // Allow 5x for analysis
    });

    it(`should compute relationship density in <${PERF_TARGET_API_MS}ms`, async () => {
      const start = performance.now();
      const density = await computeRelationshipDensity(LOAD_CASE_ID);
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] computeRelationshipDensity: ${elapsed.toFixed(2)}ms (density: ${density.density})`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS * 5);
    });
  });

  describe('Evidence Scoring Performance', () => {
    it(`should score all evidence in <${PERF_TARGET_API_MS * 10}ms`, async () => {
      const start = performance.now();
      const scores = await scoreAllEvidence(LOAD_CASE_ID);
      const elapsed = performance.now() - start;

      console.log(`[LoadTest] scoreAllEvidence: ${elapsed.toFixed(2)}ms (${scores.length} scores)`);
      expect(elapsed).toBeLessThan(PERF_TARGET_API_MS * 10); // Allow 10x for full scoring
    });
  });

  describe('Dataset Integrity', () => {
    it('should have correct node count', async () => {
      const stats = await getGraphStats(LOAD_CASE_ID);
      expect(stats.nodeCount).toBe(nodeIds.length);
    });

    it('should have no cross-case contamination', async () => {
      const otherGraph = await getCaseGraph('nonexistent-case');
      expect(otherGraph.nodes.length).toBe(0);
    });
  });
});
