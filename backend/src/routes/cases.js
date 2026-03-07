// ============================================
// Court Access — Case Management Routes
// Phase 36: Full system integration — CRUD for cases
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, auditLog } from '../middleware/auth.js';

const router = Router();

// All case routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/cases — List user's cases (tenant-isolated)
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { userId: req.user.id };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { caseName: { contains: search, mode: 'insensitive' } },
        { caseNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { evidenceRecords: true } },
        },
      }),
      prisma.case.count({ where }),
    ]);

    res.json({
      cases: cases.map((c) => ({
        ...c,
        evidenceCount: c._count.evidenceRecords,
        _count: undefined,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('[Cases] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cases — Create a new case
// ---------------------------------------------------------------------------

router.post('/', auditLog('case_create'), async (req, res) => {
  try {
    const { caseName, caseNumber, description } = req.body;

    if (!caseName) {
      return res.status(400).json({ error: 'Case name is required' });
    }

    const newCase = await prisma.case.create({
      data: {
        userId: req.user.id,
        caseName,
        caseNumber: caseNumber || '',
        description: description || '',
      },
    });

    res.status(201).json({ case: newCase });
  } catch (err) {
    console.error('[Cases] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:caseId — Get case details (tenant-isolated)
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: req.params.caseId, userId: req.user.id },
      include: {
        _count: { select: { evidenceRecords: true } },
      },
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({
      case: {
        ...caseRecord,
        evidenceCount: caseRecord._count.evidenceRecords,
        _count: undefined,
      },
    });
  } catch (err) {
    console.error('[Cases] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/cases/:caseId — Update case
// ---------------------------------------------------------------------------

router.put('/:caseId', async (req, res) => {
  try {
    // Verify ownership
    const existing = await prisma.case.findFirst({
      where: { id: req.params.caseId, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const { caseName, caseNumber, description, status } = req.body;

    const updated = await prisma.case.update({
      where: { id: req.params.caseId },
      data: {
        ...(caseName !== undefined && { caseName }),
        ...(caseNumber !== undefined && { caseNumber }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({ case: updated });
  } catch (err) {
    console.error('[Cases] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/cases/:caseId — Delete case (cascades to evidence)
// ---------------------------------------------------------------------------

router.delete('/:caseId', auditLog('case_delete'), async (req, res) => {
  try {
    const existing = await prisma.case.findFirst({
      where: { id: req.params.caseId, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    await prisma.case.delete({ where: { id: req.params.caseId } });

    res.json({ success: true });
  } catch (err) {
    console.error('[Cases] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:caseId/evidence — List evidence for a case (tenant-isolated)
// ---------------------------------------------------------------------------

router.get('/:caseId/evidence', async (req, res) => {
  try {
    // Verify case ownership
    const caseRecord = await prisma.case.findFirst({
      where: { id: req.params.caseId, userId: req.user.id },
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const { status, type } = req.query;
    const where = { caseId: req.params.caseId };
    if (status) where.status = status;
    if (type) where.evidenceType = type;

    const evidence = await prisma.evidenceRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ evidence });
  } catch (err) {
    console.error('[Cases] Evidence list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

export default router;
