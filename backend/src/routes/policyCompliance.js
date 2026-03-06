// ============================================
// Court Access — Phase 54: Policy Compliance API
// Upload policies, trigger analysis, view findings.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { indexPolicyDocument, analyzeCompliance } from '../services/policyComplianceAnalyzer.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Phase 94: All policy compliance routes require authentication
router.use(authenticate);

// Phase 60: Legal safeguard disclaimer for all AI-generated content
const AI_DISCLAIMER = 'This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.';

// ---------------------------------------------------------------------------
// GET /api/policy/:caseId/documents — List policy documents for a case
// ---------------------------------------------------------------------------

router.get('/:caseId/documents', async (req, res) => {
  try {
    const { caseId } = req.params;

    const documents = await prisma.policyDocument.findMany({
      where: { caseId, status: 'active' },
      include: { _count: { select: { findings: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ documents, count: documents.length });
  } catch (err) {
    console.error('[PolicyCompliance] List docs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch policy documents' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/policy/:caseId/documents/:docId — Get a specific policy document
// ---------------------------------------------------------------------------

router.get('/:caseId/documents/:docId', async (req, res) => {
  try {
    const { caseId, docId } = req.params;

    const document = await prisma.policyDocument.findFirst({
      where: { id: docId, caseId },
      include: { findings: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Policy document not found' });
    }

    res.json({ document });
  } catch (err) {
    console.error('[PolicyCompliance] Get doc error:', err.message);
    res.status(500).json({ error: 'Failed to fetch policy document' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/policy/:caseId/documents — Upload a policy document
// ---------------------------------------------------------------------------

router.post('/:caseId/documents', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { title, documentType, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const validTypes = ['police_policy', 'use_of_force', 'arrest_procedure', 'bodycam_rules', 'evidence_handling', 'other'];
    if (!validTypes.includes(documentType || 'other')) {
      return res.status(400).json({ error: `documentType must be one of: ${validTypes.join(', ')}` });
    }

    const document = await indexPolicyDocument({
      caseId,
      title,
      documentType: documentType || 'other',
      content,
      uploadedBy: req.user?.id,
    });

    res.status(201).json({ document });
  } catch (err) {
    console.error('[PolicyCompliance] Upload doc error:', err.message);
    res.status(500).json({ error: 'Failed to upload policy document' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/policy/:caseId/documents/:docId — Archive a policy document
// ---------------------------------------------------------------------------

router.delete('/:caseId/documents/:docId', async (req, res) => {
  try {
    const { caseId, docId } = req.params;

    const result = await prisma.policyDocument.updateMany({
      where: { id: docId, caseId },
      data: { status: 'archived' },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Policy document not found' });
    }

    res.json({ archived: true });
  } catch (err) {
    console.error('[PolicyCompliance] Delete doc error:', err.message);
    res.status(500).json({ error: 'Failed to archive policy document' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/policy/:caseId/findings — List compliance findings for a case
// ---------------------------------------------------------------------------

router.get('/:caseId/findings', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { severity, status, evidenceId } = req.query;

    const where = { caseId };
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (evidenceId) where.evidenceId = evidenceId;

    const findings = await prisma.policyComplianceFinding.findMany({
      where,
      include: {
        policyDocument: {
          select: { id: true, title: true, documentType: true },
        },
      },
      orderBy: [{ severity: 'desc' }, { confidenceScore: 'desc' }],
    });

    // Enrich with evidence metadata
    const evidenceIds = [...new Set(findings.map((f) => f.evidenceId))];
    const evidenceRecords = await prisma.evidenceRecord.findMany({
      where: { id: { in: evidenceIds } },
      select: { id: true, filename: true, evidenceType: true },
    });
    const evidenceMap = Object.fromEntries(evidenceRecords.map((e) => [e.id, e]));

    const enriched = findings.map((f) => ({
      ...f,
      evidence: evidenceMap[f.evidenceId] || null,
    }));

    res.json({ findings: enriched, count: enriched.length, disclaimer: AI_DISCLAIMER });
  } catch (err) {
    console.error('[PolicyCompliance] List findings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch compliance findings' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/policy/:caseId/findings/summary — Summary of compliance findings
// ---------------------------------------------------------------------------

router.get('/:caseId/findings/summary', async (req, res) => {
  try {
    const { caseId } = req.params;

    const findings = await prisma.policyComplianceFinding.findMany({
      where: { caseId },
    });

    const bySeverity = {};
    const byStatus = {};
    let avgConfidence = 0;

    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      avgConfidence += f.confidenceScore;
    }

    if (findings.length > 0) {
      avgConfidence = Math.round((avgConfidence / findings.length) * 100) / 100;
    }

    res.json({
      total: findings.length,
      bySeverity,
      byStatus,
      avgConfidence,
      disclaimer: AI_DISCLAIMER,
    });
  } catch (err) {
    console.error('[PolicyCompliance] Summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch findings summary' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/policy/:caseId/analyze — Run compliance analysis
// ---------------------------------------------------------------------------

router.post('/:caseId/analyze', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { evidenceId } = req.body;

    const result = await analyzeCompliance(caseId, evidenceId);

    res.status(201).json({
      message: `Analysis complete — ${result.count} potential policy deviation(s) detected`,
      findings: result.findings,
      count: result.count,
      disclaimer: AI_DISCLAIMER,
    });
  } catch (err) {
    console.error('[PolicyCompliance] Analyze error:', err.message);
    res.status(500).json({ error: 'Compliance analysis failed' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/policy/:caseId/findings/:findingId — Update finding status
// ---------------------------------------------------------------------------

router.patch('/:caseId/findings/:findingId', async (req, res) => {
  try {
    const { caseId, findingId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'dismissed', 'confirmed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: active, dismissed, confirmed, resolved' });
    }

    const updated = await prisma.policyComplianceFinding.updateMany({
      where: { id: findingId, caseId },
      data: { status },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    res.json({ updated: true, count: updated.count });
  } catch (err) {
    console.error('[PolicyCompliance] Update finding error:', err.message);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

export default router;
