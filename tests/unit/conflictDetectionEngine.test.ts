// ============================================
// Court Access — Conflict Detection Engine Unit Tests
// Phase 119: Production Hardening
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockCreateMany = vi.fn().mockRejectedValue(new Error('table not found'));
const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock('../../backend/src/services/prismaClient.js', () => ({
  default: {
    caseEvent: { findMany: vi.fn().mockResolvedValue([]) },
    documentEntity: { findMany: vi.fn().mockResolvedValue([]) },
    transcriptStatement: { findMany: vi.fn().mockResolvedValue([]) },
    evidenceConflict: {
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const {
  detectConflicts,
  getCaseConflicts,
  getConflictSummary,
} = await import('../../backend/src/engines/conflictDetectionEngine.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Conflict Detection Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectConflicts', () => {
    it('should return conflict structure with summary', async () => {
      const result = await detectConflicts('case-1');

      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('timeline');
      expect(result.summary).toHaveProperty('entity');
      expect(result.summary).toHaveProperty('testimony');
    });

    it('should handle empty case gracefully', async () => {
      const result = await detectConflicts('case-empty');

      expect(result.conflicts).toEqual([]);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('getCaseConflicts', () => {
    it('should call prisma with correct caseId', async () => {
      mockFindMany.mockResolvedValue([]);
      await getCaseConflicts('case-1');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        orderBy: { detectedAt: 'desc' },
      });
    });
  });

  describe('getConflictSummary', () => {
    it('should categorize conflicts by type', async () => {
      mockFindMany.mockResolvedValue([
        { conflictType: 'timeline_mismatch', confidence: 0.9 },
        { conflictType: 'timeline_mismatch', confidence: 0.5 },
        { conflictType: 'entity_discrepancy', confidence: 0.3 },
        { conflictType: 'contradiction', confidence: 0.85 },
      ]);

      const summary = await getConflictSummary('case-1');

      expect(summary.total).toBe(4);
      expect(summary.byType).toEqual({
        timeline_mismatch: 2,
        entity_discrepancy: 1,
        contradiction: 1,
      });
      expect(summary.highConfidence).toBe(2); // 0.9 and 0.85
      expect(summary.mediumConfidence).toBe(1); // 0.5
      expect(summary.lowConfidence).toBe(1); // 0.3
    });

    it('should handle empty conflicts', async () => {
      mockFindMany.mockResolvedValue([]);

      const summary = await getConflictSummary('case-1');
      expect(summary.total).toBe(0);
      expect(summary.byType).toEqual({});
    });
  });
});
