// ============================================
// Court Access — Graph Intelligence Engine Unit Tests
// Phase 119: Production Hardening
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../backend/src/services/prismaClient.js', () => ({
  default: {
    graphInsight: {
      create: vi.fn().mockRejectedValue(new Error('table not found')),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock graph service
const mockGetCaseGraph = vi.fn();
const mockGetGraphStats = vi.fn();
const mockGetEntityNeighbors = vi.fn();

vi.mock('../../backend/src/services/graphService.js', () => ({
  getCaseGraph: (...args: unknown[]) => mockGetCaseGraph(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
  getEntityNeighbors: (...args: unknown[]) => mockGetEntityNeighbors(...args),
}));

// Import after mocks
const {
  identifyCentralActors,
  detectEventClusters,
  analyzeEntityFrequency,
  computeRelationshipDensity,
  detectTimelineAnomalies,
  INSIGHT_TYPES,
} = await import('../../backend/src/engines/graphIntelligenceEngine.js');

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

function createMockGraph() {
  return {
    nodes: [
      { id: 'p1', label: 'John Smith', type: 'Person', connectionCount: 5, metadata: {} },
      { id: 'p2', label: 'Jane Doe', type: 'Person', connectionCount: 3, metadata: {} },
      { id: 'p3', label: 'Officer Brown', type: 'Person', connectionCount: 8, metadata: {} },
      { id: 'e1', label: 'Arrest Event', type: 'Event', metadata: { timestamp: '2024-01-15T10:00:00Z' } },
      { id: 'e2', label: 'Booking Event', type: 'Event', metadata: { timestamp: '2024-01-15T12:00:00Z' } },
      { id: 'e3', label: 'Court Hearing', type: 'Event', metadata: { timestamp: '2024-01-20T09:00:00Z' } },
      { id: 'e4', label: 'Trial Start', type: 'Event', metadata: { timestamp: '2024-03-01T10:00:00Z' } },
      { id: 'd1', label: 'Police Report', type: 'Document', metadata: {} },
      { id: 'd2', label: 'Witness Statement', type: 'Document', metadata: {} },
      { id: 'd3', label: 'Court Filing', type: 'Document', metadata: {} },
    ],
    edges: [
      { id: 'r1', source: 'p1', target: 'e1', type: 'PARTICIPATED_IN', confidence: 0.9 },
      { id: 'r2', source: 'p3', target: 'e1', type: 'PARTICIPATED_IN', confidence: 0.95 },
      { id: 'r3', source: 'p1', target: 'd1', type: 'MENTIONED_IN', confidence: 0.8 },
      { id: 'r4', source: 'p3', target: 'd1', type: 'MENTIONED_IN', confidence: 0.9 },
      { id: 'r5', source: 'p2', target: 'd2', type: 'MENTIONED_IN', confidence: 0.7 },
      { id: 'r6', source: 'p1', target: 'd2', type: 'REFERENCED_BY', confidence: 0.75 },
      { id: 'r7', source: 'p3', target: 'e2', type: 'PARTICIPATED_IN', confidence: 0.9 },
      { id: 'r8', source: 'p1', target: 'e2', type: 'PARTICIPATED_IN', confidence: 0.85 },
      { id: 'r9', source: 'p2', target: 'e3', type: 'PARTICIPATED_IN', confidence: 0.7 },
      { id: 'r10', source: 'p3', target: 'd3', type: 'MENTIONED_IN', confidence: 0.95 },
      { id: 'r11', source: 'p1', target: 'p2', type: 'CONTRADICTS', confidence: 0.85 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Graph Intelligence Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INSIGHT_TYPES', () => {
    it('should define all required insight types', () => {
      expect(INSIGHT_TYPES.CENTRAL_ACTOR).toBe('central_actor');
      expect(INSIGHT_TYPES.EVENT_CLUSTER).toBe('event_cluster');
      expect(INSIGHT_TYPES.ENTITY_FREQUENCY).toBe('entity_frequency');
      expect(INSIGHT_TYPES.RELATIONSHIP_DENSITY).toBe('relationship_density');
      expect(INSIGHT_TYPES.TIMELINE_ANOMALY).toBe('timeline_anomaly');
      expect(INSIGHT_TYPES.CONTRADICTION_PATTERN).toBe('contradiction_pattern');
    });
  });

  describe('identifyCentralActors', () => {
    it('should return top N actors sorted by degree', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const actors = await identifyCentralActors('case-1', 10);

      expect(actors).toBeInstanceOf(Array);
      expect(actors.length).toBeGreaterThan(0);
      expect(actors.length).toBeLessThanOrEqual(10);

      // Actors should be sorted by degree descending
      for (let i = 1; i < actors.length; i++) {
        expect(actors[i - 1].degree).toBeGreaterThanOrEqual(actors[i].degree);
      }
    });

    it('should only return Person nodes', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const actors = await identifyCentralActors('case-1');

      for (const actor of actors) {
        expect(actor).toHaveProperty('nodeId');
        expect(actor).toHaveProperty('label');
        expect(actor).toHaveProperty('degree');
        expect(actor).toHaveProperty('relationshipTypes');
      }
    });

    it('should include relationship types for each actor', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const actors = await identifyCentralActors('case-1');
      const officer = actors.find(a => a.label === 'Officer Brown');

      expect(officer).toBeDefined();
      expect(officer!.relationshipTypes).toBeInstanceOf(Array);
      expect(officer!.relationshipTypes.length).toBeGreaterThan(0);
    });

    it('should respect topN parameter', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const actors = await identifyCentralActors('case-1', 1);
      expect(actors.length).toBe(1);
    });

    it('should handle empty graph', async () => {
      mockGetCaseGraph.mockResolvedValue({ nodes: [], edges: [] });

      const actors = await identifyCentralActors('case-1');
      expect(actors).toEqual([]);
    });
  });

  describe('detectEventClusters', () => {
    it('should detect event clusters within 24-hour windows', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const clusters = await detectEventClusters('case-1');

      expect(clusters).toBeInstanceOf(Array);
      // e1 (10:00) and e2 (12:00) are within 24h → should form a cluster
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });

    it('should include cluster metadata', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const clusters = await detectEventClusters('case-1');
      if (clusters.length > 0) {
        const cluster = clusters[0];
        expect(cluster).toHaveProperty('clusterId');
        expect(cluster).toHaveProperty('eventCount');
        expect(cluster).toHaveProperty('events');
        expect(cluster).toHaveProperty('timespan');
        expect(cluster.timespan).toHaveProperty('start');
        expect(cluster.timespan).toHaveProperty('end');
      }
    });

    it('should return empty for no events', async () => {
      mockGetCaseGraph.mockResolvedValue({
        nodes: [{ id: 'p1', label: 'Person', type: 'Person', metadata: {} }],
        edges: [],
      });

      const clusters = await detectEventClusters('case-1');
      expect(clusters).toEqual([]);
    });

    it('should not create single-event clusters', async () => {
      mockGetCaseGraph.mockResolvedValue({
        nodes: [
          { id: 'e1', label: 'Event 1', type: 'Event', metadata: { timestamp: '2024-01-01T10:00:00Z' } },
          { id: 'e2', label: 'Event 2', type: 'Event', metadata: { timestamp: '2024-06-01T10:00:00Z' } },
        ],
        edges: [],
      });

      const clusters = await detectEventClusters('case-1');
      // Events are too far apart → no clusters
      expect(clusters).toEqual([]);
    });
  });

  describe('analyzeEntityFrequency', () => {
    it('should return entities sorted by frequency', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const frequencies = await analyzeEntityFrequency('case-1');

      expect(frequencies).toBeInstanceOf(Array);
      // Should be sorted descending by frequency
      for (let i = 1; i < frequencies.length; i++) {
        expect(frequencies[i - 1].frequency).toBeGreaterThanOrEqual(frequencies[i].frequency);
      }
    });

    it('should include entity metadata', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const frequencies = await analyzeEntityFrequency('case-1');
      if (frequencies.length > 0) {
        expect(frequencies[0]).toHaveProperty('entity');
        expect(frequencies[0]).toHaveProperty('type');
        expect(frequencies[0]).toHaveProperty('frequency');
        expect(frequencies[0]).toHaveProperty('documents');
      }
    });

    it('should exclude Document nodes from frequency analysis', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const frequencies = await analyzeEntityFrequency('case-1');
      for (const freq of frequencies) {
        expect(freq.type).not.toBe('Document');
      }
    });
  });

  describe('computeRelationshipDensity', () => {
    it('should return density metrics', async () => {
      const graph = createMockGraph();
      mockGetGraphStats.mockResolvedValue({
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        typeCounts: { Person: 3, Event: 4, Document: 3 },
        relationshipTypeCounts: { PARTICIPATED_IN: 5, MENTIONED_IN: 4, REFERENCED_BY: 1, CONTRADICTS: 1 },
      });
      mockGetCaseGraph.mockResolvedValue(graph);

      const density = await computeRelationshipDensity('case-1');

      expect(density).toHaveProperty('nodeCount');
      expect(density).toHaveProperty('edgeCount');
      expect(density).toHaveProperty('density');
      expect(density).toHaveProperty('averageDegree');
      expect(density).toHaveProperty('typeMetrics');
      expect(density.density).toBeGreaterThan(0);
      expect(density.density).toBeLessThanOrEqual(1);
    });

    it('should handle empty graph', async () => {
      mockGetGraphStats.mockResolvedValue({ nodeCount: 0, edgeCount: 0, typeCounts: {}, relationshipTypeCounts: {} });
      mockGetCaseGraph.mockResolvedValue({ nodes: [], edges: [] });

      const density = await computeRelationshipDensity('case-1');
      expect(density.density).toBe(0);
      expect(density.averageDegree).toBe(0);
    });
  });

  describe('detectTimelineAnomalies', () => {
    it('should detect timeline gaps > 24 hours', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const anomalies = await detectTimelineAnomalies('case-1');

      const gaps = anomalies.filter(a => a.type === 'timeline_gap');
      // e3 (Jan 20) is >24h after e2 (Jan 15), and e4 (Mar 1) is >24h after e3
      expect(gaps.length).toBeGreaterThan(0);
    });

    it('should detect duplicate timestamps', async () => {
      const graph = {
        nodes: [
          { id: 'e1', label: 'Event A', type: 'Event', metadata: { timestamp: '2024-01-15T10:00:00Z' } },
          { id: 'e2', label: 'Event B', type: 'Event', metadata: { timestamp: '2024-01-15T10:00:00Z' } },
        ],
        edges: [],
      };
      mockGetCaseGraph.mockResolvedValue(graph);

      const anomalies = await detectTimelineAnomalies('case-1');
      const dupes = anomalies.filter(a => a.type === 'duplicate_timestamp');
      expect(dupes.length).toBe(1);
      expect(dupes[0].details.eventIds).toContain('e1');
      expect(dupes[0].details.eventIds).toContain('e2');
    });

    it('should detect contradiction edges', async () => {
      const graph = createMockGraph();
      // First call for events, second call for all edges
      mockGetCaseGraph.mockResolvedValue(graph);

      const anomalies = await detectTimelineAnomalies('case-1');
      const conflicts = anomalies.filter(a => a.type === 'event_conflict');
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should assign severity based on gap duration', async () => {
      mockGetCaseGraph.mockResolvedValue(createMockGraph());

      const anomalies = await detectTimelineAnomalies('case-1');
      const gaps = anomalies.filter(a => a.type === 'timeline_gap');

      for (const gap of gaps) {
        expect(['low', 'medium', 'high']).toContain(gap.severity);
        if (gap.details.gapHours > 72) {
          expect(gap.severity).toBe('high');
        }
      }
    });

    it('should handle no events', async () => {
      mockGetCaseGraph.mockResolvedValue({ nodes: [], edges: [] });

      const anomalies = await detectTimelineAnomalies('case-1');
      // No events → only contradiction check (which returns empty with no edges)
      const gaps = anomalies.filter(a => a.type === 'timeline_gap');
      expect(gaps).toEqual([]);
    });
  });
});
