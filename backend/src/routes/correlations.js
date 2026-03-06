// ============================================
// Court Access — Phase 53: Evidence Correlation API
// CRUD + correlation analysis trigger.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { runCorrelationAnalysis } from '../services/correlationEngine.js';
import { authenticate } from '../middleware/auth.js';
import { verifyCaseOwnership } from '../middleware/tenantIsolation.js';

const router = express.Router();

// Phase 94: All correlation routes require authentication + case ownership
router.use(authenticate);

// Phase 60: Legal safeguard disclaimer for all AI-generated content
const AI_DISCLAIMER = 'This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.';

// ---------------------------------------------------------------------------
// GET /api/correlations/:caseId — List all correlations for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { type, status, minConfidence } = req.query;

    const where = { caseId };
    if (type) where.correlationType = type;
    if (status) where.status = status;
    if (minConfidence) where.confidenceScore = { gte: parseFloat(minConfidence) };

    const correlations = await prisma.evidenceCorrelation.findMany({
      where,
      orderBy: { confidenceScore: 'desc' },
    });

    // Enrich with evidence metadata
    const evidenceIds = new Set();
    for (const c of correlations) {
      evidenceIds.add(c.sourceEvidenceId);
      evidenceIds.add(c.relatedEvidenceId);
    }

    const evidenceRecords = await prisma.evidenceRecord.findMany({
      where: { id: { in: Array.from(evidenceIds) } },
      select: { id: true, filename: true, evidenceType: true },
    });

    const evidenceMap = Object.fromEntries(evidenceRecords.map((e) => [e.id, e]));

    const enriched = correlations.map((c) => ({
      ...c,
      sourceEvidence: evidenceMap[c.sourceEvidenceId] || null,
      relatedEvidence: evidenceMap[c.relatedEvidenceId] || null,
    }));

    res.json({ correlations: enriched, count: enriched.length, disclaimer: AI_DISCLAIMER });
  } catch (err) {
    console.error('[Correlations] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch correlations' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/correlations/:caseId/summary — Get correlation summary/stats
// ---------------------------------------------------------------------------

router.get('/:caseId/summary', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId } = req.params;

    const correlations = await prisma.evidenceCorrelation.findMany({
      where: { caseId },
    });

    const byType = {};
    const byStatus = {};
    let avgConfidence = 0;

    for (const c of correlations) {
      byType[c.correlationType] = (byType[c.correlationType] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      avgConfidence += c.confidenceScore;
    }

    if (correlations.length > 0) {
      avgConfidence = Math.round((avgConfidence / correlations.length) * 100) / 100;
    }

    res.json({
      total: correlations.length,
      byType,
      byStatus,
      avgConfidence,
      disclaimer: AI_DISCLAIMER,
    });
  } catch (err) {
    console.error('[Correlations] Summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/correlations/:caseId/analyze — Run correlation analysis
// ---------------------------------------------------------------------------

router.post('/:caseId/analyze', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId } = req.params;

    const result = await runCorrelationAnalysis(caseId);

    res.status(201).json({
      message: `Analysis complete — ${result.count} possible correlations detected`,
      correlations: result.correlations,
      count: result.count,
      disclaimer: AI_DISCLAIMER,
    });
  } catch (err) {
    console.error('[Correlations] Analyze error:', err.message);
    res.status(500).json({ error: 'Correlation analysis failed' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/correlations/:caseId/:correlationId — Update correlation status
// ---------------------------------------------------------------------------

router.patch('/:caseId/:correlationId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId, correlationId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'dismissed', 'confirmed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: active, dismissed, confirmed' });
    }

    const updated = await prisma.evidenceCorrelation.updateMany({
      where: { id: correlationId, caseId },
      data: { status },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Correlation not found' });
    }

    res.json({ updated: true, count: updated.count });
  } catch (err) {
    console.error('[Correlations] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update correlation' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/correlations/:caseId/:correlationId — Delete a correlation
// ---------------------------------------------------------------------------

router.delete('/:caseId/:correlationId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId, correlationId } = req.params;

    const result = await prisma.evidenceCorrelation.deleteMany({
      where: { id: correlationId, caseId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Correlation not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('[Correlations] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete correlation' });
  }
});

export default router;
