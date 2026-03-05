// ============================================
// Court Access — Court Hearings CRUD API
// In-memory store for hearing data with
// max 5 hearings per case constraint.
// ============================================

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} hearingId -> hearing */
const hearingsStore = new Map();

/** @type {Map<string, object>} logId -> reminder log */
const reminderLogsStore = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHearingsForCase(caseId) {
  const results = [];
  for (const hearing of hearingsStore.values()) {
    if (hearing.caseId === caseId) {
      results.push(hearing);
    }
  }
  // Sort by hearing datetime ascending
  results.sort((a, b) => new Date(a.hearingDatetime).getTime() - new Date(b.hearingDatetime).getTime());
  return results;
}

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

router.get('/:caseId', (req, res) => {
  const { caseId } = req.params;
  const hearings = getHearingsForCase(caseId);
  res.json({ hearings });
});

// ---------------------------------------------------------------------------
// POST /api/hearings/:caseId — Create a new hearing for a case
// ---------------------------------------------------------------------------

router.post('/:caseId', (req, res) => {
  const { caseId } = req.params;

  // Enforce max 5 hearings per case
  const existing = getHearingsForCase(caseId);
  if (existing.length >= 5) {
    return res.status(400).json({ error: 'Maximum 5 hearings per case. Remove a hearing before adding a new one.' });
  }

  const errors = validateHearingInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const hearing = {
    id: crypto.randomUUID(),
    caseId,
    courthouseName: req.body.courthouseName.trim(),
    courthouseAddress: req.body.courthouseAddress.trim(),
    hearingName: req.body.hearingName.trim(),
    hearingDatetime: new Date(req.body.hearingDatetime).toISOString(),
    department: (req.body.department || '').trim(),
    reminder1Enabled: req.body.reminder1Enabled !== false,
    reminder2Enabled: req.body.reminder2Enabled !== false,
    reminder3Enabled: req.body.reminder3Enabled !== false,
    reminder1DaysBefore: Number.isInteger(req.body.reminder1DaysBefore) && req.body.reminder1DaysBefore > 0
      ? req.body.reminder1DaysBefore : 7,
    reminder2DaysBefore: Number.isInteger(req.body.reminder2DaysBefore) && req.body.reminder2DaysBefore > 0
      ? req.body.reminder2DaysBefore : 3,
    reminder3DaysBefore: Number.isInteger(req.body.reminder3DaysBefore) && req.body.reminder3DaysBefore > 0
      ? req.body.reminder3DaysBefore : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  hearingsStore.set(hearing.id, hearing);
  console.log(`[Hearings] Created hearing ${hearing.id} for case ${caseId}: ${hearing.hearingName}`);

  res.status(201).json({ hearing });
});

// ---------------------------------------------------------------------------
// PUT /api/hearings/:caseId/:hearingId — Update a hearing
// ---------------------------------------------------------------------------

router.put('/:caseId/:hearingId', (req, res) => {
  const { caseId, hearingId } = req.params;
  const hearing = hearingsStore.get(hearingId);

  if (!hearing || hearing.caseId !== caseId) {
    return res.status(404).json({ error: 'Hearing not found' });
  }

  // Validate only changed fields that need validation
  if (req.body.hearingDatetime) {
    const dt = new Date(req.body.hearingDatetime);
    if (isNaN(dt.getTime())) {
      return res.status(400).json({ error: 'hearingDatetime must be a valid date' });
    }
    if (dt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'hearingDatetime must be in the future' });
    }
  }

  // Update fields (null-safe: coerce to string before .trim())
  if (req.body.courthouseName !== undefined) hearing.courthouseName = String(req.body.courthouseName ?? '').trim();
  if (req.body.courthouseAddress !== undefined) hearing.courthouseAddress = String(req.body.courthouseAddress ?? '').trim();
  if (req.body.hearingName !== undefined) hearing.hearingName = String(req.body.hearingName ?? '').trim();
  if (req.body.hearingDatetime !== undefined) hearing.hearingDatetime = new Date(req.body.hearingDatetime).toISOString();
  if (req.body.department !== undefined) hearing.department = String(req.body.department ?? '').trim();

  // Reminder configuration
  if (req.body.reminder1Enabled !== undefined) hearing.reminder1Enabled = !!req.body.reminder1Enabled;
  if (req.body.reminder2Enabled !== undefined) hearing.reminder2Enabled = !!req.body.reminder2Enabled;
  if (req.body.reminder3Enabled !== undefined) hearing.reminder3Enabled = !!req.body.reminder3Enabled;
  if (Number.isInteger(req.body.reminder1DaysBefore) && req.body.reminder1DaysBefore > 0) {
    hearing.reminder1DaysBefore = req.body.reminder1DaysBefore;
  }
  if (Number.isInteger(req.body.reminder2DaysBefore) && req.body.reminder2DaysBefore > 0) {
    hearing.reminder2DaysBefore = req.body.reminder2DaysBefore;
  }
  if (Number.isInteger(req.body.reminder3DaysBefore) && req.body.reminder3DaysBefore > 0) {
    hearing.reminder3DaysBefore = req.body.reminder3DaysBefore;
  }

  hearing.updatedAt = new Date().toISOString();
  hearingsStore.set(hearingId, hearing);

  console.log(`[Hearings] Updated hearing ${hearingId}: ${hearing.hearingName}`);
  res.json({ hearing });
});

// ---------------------------------------------------------------------------
// DELETE /api/hearings/:caseId/:hearingId — Remove a hearing
// ---------------------------------------------------------------------------

router.delete('/:caseId/:hearingId', (req, res) => {
  const { caseId, hearingId } = req.params;
  const hearing = hearingsStore.get(hearingId);

  if (!hearing || hearing.caseId !== caseId) {
    return res.status(404).json({ error: 'Hearing not found' });
  }

  hearingsStore.delete(hearingId);

  // Clean up reminder logs for this hearing
  for (const [logId, log] of reminderLogsStore.entries()) {
    if (log.hearingId === hearingId) {
      reminderLogsStore.delete(logId);
    }
  }

  console.log(`[Hearings] Deleted hearing ${hearingId}: ${hearing.hearingName}`);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/hearings/:caseId/:hearingId/reminders — Get reminder logs
// ---------------------------------------------------------------------------

router.get('/:caseId/:hearingId/reminders', (req, res) => {
  const { hearingId } = req.params;
  const logs = [];
  for (const log of reminderLogsStore.values()) {
    if (log.hearingId === hearingId) {
      logs.push(log);
    }
  }
  logs.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  res.json({ reminders: logs });
});

// ---------------------------------------------------------------------------
// Exports for scheduler access
// ---------------------------------------------------------------------------

export { hearingsStore, reminderLogsStore };
export default router;
