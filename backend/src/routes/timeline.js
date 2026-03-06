// ============================================
// Court Access — Phase A: Evidence Timeline API
// CRUD + query for timeline events extracted from evidence.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Phase 94: All timeline routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId — List timeline events for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { sourceType, startDate, endDate, eventType } = req.query;

    const where = { caseId };

    if (sourceType) where.sourceType = sourceType;
    if (eventType) where.eventType = eventType;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const events = await prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    });

    res.json({ events, count: events.length });
  } catch (err) {
    console.error('[Timeline] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/timeline/:caseId — Create a timeline event
// ---------------------------------------------------------------------------

router.post('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      timestamp,
      sourceEvidenceId,
      sourceType,
      eventType,
      eventDescription,
      confidenceScore,
      metadata,
    } = req.body;

    if (!timestamp || !eventDescription) {
      return res.status(400).json({ error: 'timestamp and eventDescription are required' });
    }

    const event = await prisma.timelineEvent.create({
      data: {
        caseId,
        timestamp: new Date(timestamp),
        sourceEvidenceId: sourceEvidenceId || null,
        sourceType: sourceType || 'manual',
        eventType: eventType || 'other',
        eventDescription,
        confidenceScore: confidenceScore ?? 1.0,
        metadata: metadata || {},
      },
    });

    res.status(201).json(event);
  } catch (err) {
    console.error('[Timeline] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create timeline event' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/timeline/:caseId/batch — Batch create timeline events
// ---------------------------------------------------------------------------

router.post('/:caseId/batch', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const created = await prisma.timelineEvent.createMany({
      data: events.map((e) => ({
        caseId,
        timestamp: new Date(e.timestamp),
        sourceEvidenceId: e.sourceEvidenceId || null,
        sourceType: e.sourceType || 'manual',
        eventType: e.eventType || 'other',
        eventDescription: e.eventDescription,
        confidenceScore: e.confidenceScore ?? 1.0,
        metadata: e.metadata || {},
      })),
    });

    res.status(201).json({ created: created.count });
  } catch (err) {
    console.error('[Timeline] Batch create error:', err.message);
    res.status(500).json({ error: 'Failed to batch create timeline events' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/timeline/:caseId/:eventId — Delete a timeline event
// ---------------------------------------------------------------------------

router.delete('/:caseId/:eventId', async (req, res) => {
  try {
    const { caseId, eventId } = req.params;

    await prisma.timelineEvent.delete({
      where: { id: eventId, caseId },
    });

    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Timeline event not found' });
    }
    console.error('[Timeline] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete timeline event' });
  }
});

export default router;
