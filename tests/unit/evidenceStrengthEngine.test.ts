// ============================================
// Court Access — Evidence Strength Engine Unit Tests
// Phase 119: Production Hardening
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../backend/src/services/prismaClient.js', () => ({
  default: {
    evidenceScore: {
      upsert: vi.fn().mockRejectedValue(new Error('table not found')),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock graph service
const mockGetCaseGraph = vi.fn();
const mockGetGraphStats = vi.fn();

vi.mock('../../backend/src/services/graphService.js', () => ({
  getCaseGraph: (...args: unknown[]) => mockGetCaseGraph(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
}));

const {
  scoreAllEvidence,
  scoreEntity,
  getEvidenceScores,
} = await import('../../backend/src/engines/evidenceStrengthEngine.js');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createScoringGraph() {
  return {
    nodes: [
      { id: 'p1', label: 'Suspect A', type: 'Person', metadata: { confidence: 0.9 } },
      { id: 'p2', label: 'Witness B', type: 'Person', metadata: { confidence: 0.6 } },
      { id: 'd1', label: 'Police Report', type: 'Document', metadata: {} },
      { id: 'd2', label: 'Witness Statement', type: 'Document', metadata: {} },
      { id: 'd3', label: 'CCTV Footage', type: 'Document', metadata: {} },
      { id: 'e1', label: 'Arrest', type: 'Event', metadata: { confidence: 0.95 } },
    ],
    edges: [
      { id: 'r1', source: 'p1', target: 'd1', type: 'MENTIONED_IN', confidence: 0.9 },
      { id: 'r2', source: 'p1', target: 'd2', type: 'MENTIONED_IN', confidence: 0.8 },
      { id: 'r3', source: 'p1', target: 'd3', type: 'REFERENCED_BY', confidence: 0.85 },
      { id: 'r4', source: 'p2', target: 'd2', type: 'MENTIONED_IN', confidence: 0.7 },
      { id: 'r5', source: 'e1', target: 'd1', type: 'MENTIONED_IN', confidence: 0.9 },
      { id: 'r6', source: 'p1', target: 'p2', type: 'CONTRADICTS', confidence: 0.6 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Evidence Strength Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scoreAllEvidence', () => {
    it('should score all nodes in the graph', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      expect(scores).toBeInstanceOf(Array);
      expect(scores.length).toBe(6); // all nodes
    });

    it('should return scores between 0 and 1', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      for (const entry of scores) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
        expect(entry.score).toBeLessThanOrEqual(1);
      }
    });

    it('should include score factors', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      for (const entry of scores) {
        expect(entry).toHaveProperty('factors');
        expect(entry.factors).toHaveProperty('corroboration');
        expect(entry.factors).toHaveProperty('timelineConsistency');
        expect(entry.factors).toHaveProperty('entityConfidence');
        expect(entry.factors).toHaveProperty('documentReliability');
      }
    });

    it('should sort scores descending', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
      }
    });

    it('should score corroboration higher for more document references', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      // p1 has 3 document connections, p2 has 1
      const p1Score = scores.find(s => s.nodeId === 'p1');
      const p2Score = scores.find(s => s.nodeId === 'p2');

      expect(p1Score).toBeDefined();
      expect(p2Score).toBeDefined();
      expect(p1Score!.factors.corroboration).toBeGreaterThan(p2Score!.factors.corroboration);
    });

    it('should penalize contradictions in timeline consistency', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');

      // p1 has a CONTRADICTS edge, e1 does not
      const p1Score = scores.find(s => s.nodeId === 'p1');
      const e1Score = scores.find(s => s.nodeId === 'e1');

      expect(p1Score).toBeDefined();
      expect(e1Score).toBeDefined();
      expect(p1Score!.factors.timelineConsistency).toBeLessThan(e1Score!.factors.timelineConsistency);
    });

    it('should handle empty graph', async () => {
      mockGetCaseGraph.mockResolvedValue({ nodes: [], edges: [] });

      const scores = await scoreAllEvidence('case-1');
      expect(scores).toEqual([]);
    });
  });

  describe('scoreEntity', () => {
    it('should score a specific entity', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const result = await scoreEntity('case-1', 'p1');

      expect(result).toHaveProperty('nodeId', 'p1');
      expect(result).toHaveProperty('label', 'Suspect A');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('interpretation');
    });

    it('should return error for non-existent entity', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const result = await scoreEntity('case-1', 'nonexistent');

      expect(result).toHaveProperty('error', 'Entity not found');
    });

    it('should include score interpretation', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const result = await scoreEntity('case-1', 'p1');

      expect(result.interpretation).toHaveProperty('level');
      expect(result.interpretation).toHaveProperty('description');
      expect(['strong', 'moderate', 'weak', 'insufficient']).toContain(result.interpretation.level);
    });
  });

  describe('getEvidenceScores', () => {
    it('should return empty when table does not exist', async () => {
      const scores = await getEvidenceScores('case-1');
      expect(scores).toEqual([]);
    });
  });

  describe('Score Weights', () => {
    it('should use correct weight distribution (35/25/20/20)', async () => {
      mockGetCaseGraph.mockResolvedValue(createScoringGraph());

      const scores = await scoreAllEvidence('case-1');
      if (scores.length > 0) {
        const entry = scores[0];
        const expectedScore =
          entry.factors.corroboration * 0.35 +
          entry.factors.timelineConsistency * 0.25 +
          entry.factors.entityConfidence * 0.20 +
          entry.factors.documentReliability * 0.20;

        expect(entry.score).toBeCloseTo(expectedScore, 2);
      }
    });
  });
});
