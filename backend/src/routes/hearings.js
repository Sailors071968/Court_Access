// ============================================
// Court Access — Court Hearings CRUD API
// Persistent storage via Prisma/PostgreSQL with
// max 5 hearings per case constraint.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateHearingInput(body) {
  const errors = [];

  if (!body.courthouseName || typeof body.courthouseName !== 'string' || body.courthouseName.trim().length === 0) {
    errors.push('courthouseName is required');
  }
  if (!body.courthouseAddress || typeof body.courthouseAddress !== 'string' || body.courthouseAddress.trim().length === 0) {
    errors.push('courthouseAddress is required');
  }
  if (!body.hearingName || typeof body.hearingName !== 'string' || body.hearingName.trim().length === 0) {
    errors.push('hearingName is required');
  }
  if (!body.hearingDatetime) {
    errors.push('hearingDatetime is required');
  } else {
    const dt = new Date(body.hearingDatetime);
    if (isNaN(dt.getTime())) {
      errors.push('hearingDatetime must be a valid date');
    } else if (dt.getTime() <= Date.now()) {
      errors.push('hearingDatetime must be in the future');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// GET /api/hearings/:caseId — List all hearings for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const hearings = await prisma.hearing.findMany({
      where: { caseId },
      orderBy: { hearingDatetime: 'asc' },
    });
    res.json({ hearings });
  } catch (err) {
    console.error('[Hearings] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch hearings' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/hearings/:caseId — Create a new hearing for a case
// ---------------------------------------------------------------------------

router.post('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    // Enforce max 5 hearings per case
    const count = await prisma.hearing.count({ where: { caseId } });
    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 hearings per case. Remove a hearing before adding a new one.' });
    }

    const errors = validateHearingInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const hearing = await prisma.hearing.create({
      data: {
        caseId,
        courthouseName: req.body.courthouseName.trim(),
        courthouseAddress: req.body.courthouseAddress.trim(),
        hearingName: req.body.hearingName.trim(),
        hearingDatetime: new Date(req.body.hearingDatetime),
        department: (req.body.department || '').trim(),
        caseName: req.body.caseName ? String(req.body.caseName).trim() : null,
        clientPhone: req.body.clientPhone ? String(req.body.clientPhone).trim() : null,
        reminder1Enabled: req.body.reminder1Enabled !== false,
        reminder2Enabled: req.body.reminder2Enabled !== false,
        reminder3Enabled: req.body.reminder3Enabled !== false,
        reminder1DaysBefore: Number.isInteger(req.body.reminder1DaysBefore) && req.body.reminder1DaysBefore > 0
          ? req.body.reminder1DaysBefore : 7,
        reminder2DaysBefore: Number.isInteger(req.body.reminder2DaysBefore) && req.body.reminder2DaysBefore > 0
          ? req.body.reminder2DaysBefore : 3,
        reminder3DaysBefore: Number.isInteger(req.body.reminder3DaysBefore) && req.body.reminder3DaysBefore > 0
          ? req.body.reminder3DaysBefore : 1,
      },
    });

    console.log(`[Hearings] Created hearing ${hearing.id} for case ${caseId}: ${hearing.hearingName}`);
    res.status(201).json({ hearing });
  } catch (err) {
    console.error('[Hearings] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create hearing' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/hearings/:caseId/:hearingId — Update a hearing
// ---------------------------------------------------------------------------

router.put('/:caseId/:hearingId', async (req, res) => {
  try {
    const { caseId, hearingId } = req.params;
    const existing = await prisma.hearing.findUnique({ where: { id: hearingId } });

    if (!existing || existing.caseId !== caseId) {
      return res.status(404).json({ error: 'Hearing not found' });
    }

    // Validate only changed fields that need validation
    if (req.body.hearingDatetime !== undefined) {
      const dt = new Date(req.body.hearingDatetime);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ error: 'hearingDatetime must be a valid date' });
      }
      if (dt.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'hearingDatetime must be in the future' });
      }
    }

    // Validate required fields are not cleared to empty strings
    if (req.body.courthouseName !== undefined && String(req.body.courthouseName ?? '').trim().length === 0) {
      return res.status(400).json({ error: 'courthouseName cannot be empty' });
    }
    if (req.body.courthouseAddress !== undefined && String(req.body.courthouseAddress ?? '').trim().length === 0) {
      return res.status(400).json({ error: 'courthouseAddress cannot be empty' });
    }
    if (req.body.hearingName !== undefined && String(req.body.hearingName ?? '').trim().length === 0) {
      return res.status(400).json({ error: 'hearingName cannot be empty' });
    }

    // Build update data object — only include fields that were sent
    const updateData = {};

    if (req.body.courthouseName !== undefined) updateData.courthouseName = String(req.body.courthouseName ?? '').trim();
    if (req.body.courthouseAddress !== undefined) updateData.courthouseAddress = String(req.body.courthouseAddress ?? '').trim();
    if (req.body.hearingName !== undefined) updateData.hearingName = String(req.body.hearingName ?? '').trim();
    if (req.body.hearingDatetime !== undefined) updateData.hearingDatetime = new Date(req.body.hearingDatetime);
    if (req.body.department !== undefined) updateData.department = String(req.body.department ?? '').trim();
    if (req.body.caseName !== undefined) updateData.caseName = req.body.caseName ? String(req.body.caseName).trim() : null;
    if (req.body.clientPhone !== undefined) updateData.clientPhone = req.body.clientPhone ? String(req.body.clientPhone).trim() : null;

    // Reminder configuration
    if (req.body.reminder1Enabled !== undefined) updateData.reminder1Enabled = !!req.body.reminder1Enabled;
    if (req.body.reminder2Enabled !== undefined) updateData.reminder2Enabled = !!req.body.reminder2Enabled;
    if (req.body.reminder3Enabled !== undefined) updateData.reminder3Enabled = !!req.body.reminder3Enabled;
    if (Number.isInteger(req.body.reminder1DaysBefore) && req.body.reminder1DaysBefore > 0) {
      updateData.reminder1DaysBefore = req.body.reminder1DaysBefore;
    }
    if (Number.isInteger(req.body.reminder2DaysBefore) && req.body.reminder2DaysBefore > 0) {
      updateData.reminder2DaysBefore = req.body.reminder2DaysBefore;
    }
    if (Number.isInteger(req.body.reminder3DaysBefore) && req.body.reminder3DaysBefore > 0) {
      updateData.reminder3DaysBefore = req.body.reminder3DaysBefore;
    }

    const hearing = await prisma.hearing.update({
      where: { id: hearingId },
      data: updateData,
    });

    console.log(`[Hearings] Updated hearing ${hearingId}: ${hearing.hearingName}`);
    res.json({ hearing });
  } catch (err) {
    console.error('[Hearings] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update hearing' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/hearings/:caseId/:hearingId — Remove a hearing
// ---------------------------------------------------------------------------

router.delete('/:caseId/:hearingId', async (req, res) => {
  try {
    const { caseId, hearingId } = req.params;
    const existing = await prisma.hearing.findUnique({ where: { id: hearingId } });

    if (!existing || existing.caseId !== caseId) {
      return res.status(404).json({ error: 'Hearing not found' });
    }

    // Cascade delete handles reminder logs (onDelete: Cascade in schema)
    await prisma.hearing.delete({ where: { id: hearingId } });

    console.log(`[Hearings] Deleted hearing ${hearingId}: ${existing.hearingName}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Hearings] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete hearing' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/hearings/:caseId/:hearingId/reminders — Get reminder logs
// ---------------------------------------------------------------------------

router.get('/:caseId/:hearingId/reminders', async (req, res) => {
  try {
    const { caseId, hearingId } = req.params;
    const existing = await prisma.hearing.findUnique({ where: { id: hearingId } });

    if (!existing || existing.caseId !== caseId) {
      return res.status(404).json({ error: 'Hearing not found' });
    }

    const logs = await prisma.hearingReminderLog.findMany({
      where: { hearingId },
      orderBy: { sentAt: 'asc' },
    });
    res.json({ reminders: logs });
  } catch (err) {
    console.error('[Hearings] GET reminders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reminder logs' });
  }
});

export default router;
