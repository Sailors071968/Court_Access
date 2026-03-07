// ============================================
// Court Access — Alert Management Routes
// Phase 116: Monitoring & Alerting System
// ============================================

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getAlertEvents,
  acknowledgeAlert,
  getAlertRules,
  updateAlertRule,
  fireAlert,
} from '../services/alertService.js';

const router = Router();

// All alert routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// GET /api/admin/alerts/events — List alert events
// ---------------------------------------------------------------------------

router.get('/events', async (req, res) => {
  try {
    const { acknowledged, alertType, severity, page = 1, limit = 50 } = req.query;

    const result = await getAlertEvents({
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      alertType,
      severity,
      page: Number(page),
      limit: Number(limit),
    });

    res.json(result);
  } catch (err) {
    console.error('[Alerts] Events list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alert events' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/alerts/events/:id/acknowledge — Acknowledge an alert
// ---------------------------------------------------------------------------

router.post('/events/:id/acknowledge', async (req, res) => {
  try {
    const event = await acknowledgeAlert(req.params.id, req.user.id);
    res.json({ event });
  } catch (err) {
    console.error('[Alerts] Acknowledge error:', err.message);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/alerts/rules — List alert rules
// ---------------------------------------------------------------------------

router.get('/rules', async (_req, res) => {
  try {
    const rules = await getAlertRules();
    res.json({ rules });
  } catch (err) {
    console.error('[Alerts] Rules list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/alerts/rules/:alertType — Update an alert rule
// ---------------------------------------------------------------------------

router.put('/rules/:alertType', async (req, res) => {
  try {
    const { threshold, windowMinutes, enabled, notifyEmail, notifyMethod } = req.body;
    const updates = {};

    if (threshold !== undefined) updates.threshold = Number(threshold);
    if (windowMinutes !== undefined) updates.windowMinutes = Number(windowMinutes);
    if (enabled !== undefined) updates.enabled = Boolean(enabled);
    if (notifyEmail !== undefined) updates.notifyEmail = notifyEmail;
    if (notifyMethod !== undefined) updates.notifyMethod = notifyMethod;

    const rule = await updateAlertRule(req.params.alertType, updates);
    res.json({ rule });
  } catch (err) {
    console.error('[Alerts] Update rule error:', err.message);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/alerts/test — Fire a test alert
// ---------------------------------------------------------------------------

router.post('/test', async (req, res) => {
  try {
    const event = await fireAlert(
      'high_error_rate',
      'low',
      'Test alert — verifying alerting system is operational',
      { test: true, triggeredBy: req.user.id },
    );
    res.json({ success: true, event });
  } catch (err) {
    console.error('[Alerts] Test alert error:', err.message);
    res.status(500).json({ error: 'Failed to fire test alert' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/alerts/summary — Alert summary for dashboard
// ---------------------------------------------------------------------------

router.get('/summary', async (_req, res) => {
  try {
    const [
      totalUnacknowledged,
      criticalCount,
      highCount,
      recentEvents,
    ] = await Promise.all([
      getAlertEvents({ acknowledged: false, limit: 1 }).then(r => r.total),
      getAlertEvents({ acknowledged: false, severity: 'critical', limit: 1 }).then(r => r.total),
      getAlertEvents({ acknowledged: false, severity: 'high', limit: 1 }).then(r => r.total),
      getAlertEvents({ limit: 10 }),
    ]);

    res.json({
      totalUnacknowledged,
      criticalCount,
      highCount,
      recentEvents: recentEvents.events,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Alerts] Summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alert summary' });
  }
});

export default router;
