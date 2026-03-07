// ============================================
// Court Access — Case Intelligence Dashboard API
// Phase 116: Evidence Intelligence Engine v1
//
// Endpoints:
// GET /api/cases/:id/entities    — Extracted entities for a case
// GET /api/cases/:id/timeline    — Enriched timeline events
// GET /api/cases/:id/conflicts   — Detected conflicts
// GET /api/cases/:id/statements  — Key testimony statements
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { verifyCaseOwnership } from '../middleware/tenantIsolation.js';
import { searchEntityIndex, findDocumentsByEntity } from '../engines/documentIntelligenceEngine.js';
import { getEnrichedTimeline } from '../engines/timelineEnrichmentEngine.js';
import { getCaseConflicts, getConflictSummary } from '../engines/conflictDetectionEngine.js';
import { getCaseStatements, getStatementSummary } from '../engines/transcriptIntelligenceEngine.js';
import prisma from '../services/prismaClient.js';

const router = Router();

// All case intelligence routes require authentication
router.use(authenticate);

// Map :id param to :caseId for tenant isolation middleware
router.param('id', (req, _res, next, val) => {
  req.params.caseId = val;
  next();
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/entities
// Returns all extracted entities for a case, grouped by type.
// Query params: ?type=person&value=Smith&documentId=xxx
// ---------------------------------------------------------------------------

router.get('/:id/entities', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { type, value, documentId } = req.query;

    // Get entities from the entity index
    const entities = await searchEntityIndex(caseId, {
      entityType: type || undefined,
      entityValue: value || undefined,
      documentId: documentId || undefined,
    });

    // Group by entity type
    const grouped = {};
    for (const entity of entities) {
      if (!grouped[entity.entityType]) {
        grouped[entity.entityType] = [];
      }
      grouped[entity.entityType].push({
        id: entity.id,
        value: entity.entityValue,
        documentId: entity.documentId,
        firstSeen: entity.firstSeenTimestamp,
      });
    }

    // Deduplicate values within each group
    const summary = {};
    for (const [entityType, items] of Object.entries(grouped)) {
      const uniqueValues = [...new Set(items.map(i => i.value))];
      summary[entityType] = {
        count: uniqueValues.length,
        values: uniqueValues.slice(0, 50),
        documents: [...new Set(items.map(i => i.documentId))].length,
      };
    }

    res.json({
      caseId,
      entities: grouped,
      summary,
      totalEntities: entities.length,
    });
  } catch (err) {
    console.error(`[CaseIntel] Entities error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch case entities' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/timeline
// Returns the enriched chronological timeline for a case.
// Query params: ?eventType=arrest&limit=100
// ---------------------------------------------------------------------------

router.get('/:id/timeline', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { eventType, limit } = req.query;

    const timeline = await getEnrichedTimeline(caseId);

    // Apply filters
    let events = timeline.events;
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }
    if (limit) {
      events = events.slice(0, parseInt(limit, 10));
    }

    // Format for display
    const formatted = events.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      eventType: e.eventType,
      description: e.description,
      sourceDocumentId: e.sourceDocumentId,
      confidence: e.confidence,
      displayTime: formatEventTime(e.timestamp),
    }));

    res.json({
      caseId,
      timeline: formatted,
      count: formatted.length,
      dateRange: timeline.dateRange,
    });
  } catch (err) {
    console.error(`[CaseIntel] Timeline error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch case timeline' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/conflicts
// Returns detected evidence conflicts for a case.
// Query params: ?type=contradiction&minConfidence=0.7
// ---------------------------------------------------------------------------

router.get('/:id/conflicts', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { type, minConfidence } = req.query;

    let conflicts = await getCaseConflicts(caseId);

    // Apply filters
    if (type) {
      conflicts = conflicts.filter(c => c.conflictType === type);
    }
    if (minConfidence) {
      const threshold = parseFloat(minConfidence);
      conflicts = conflicts.filter(c => c.confidence >= threshold);
    }

    const summary = await getConflictSummary(caseId);

    res.json({
      caseId,
      conflicts,
      count: conflicts.length,
      summary,
    });
  } catch (err) {
    console.error(`[CaseIntel] Conflicts error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch case conflicts' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/statements
// Returns key testimony statements for a case.
// Query params: ?speaker=Officer+Smith&type=confession&limit=50
// ---------------------------------------------------------------------------

router.get('/:id/statements', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { speaker, type, transcriptId, limit } = req.query;

    const statements = await getCaseStatements(caseId, {
      speaker: speaker || undefined,
      statementType: type || undefined,
      transcriptId: transcriptId || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    const summary = await getStatementSummary(caseId);

    res.json({
      caseId,
      statements,
      count: statements.length,
      summary,
    });
  } catch (err) {
    console.error(`[CaseIntel] Statements error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch case statements' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/entity-search
// Search for a specific entity across all case documents.
// Query params: ?value=Officer+Smith
// ---------------------------------------------------------------------------

router.get('/:id/entity-search', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { value } = req.query;

    if (!value) {
      return res.status(400).json({ error: 'value query parameter is required' });
    }

    const documents = await findDocumentsByEntity(value, caseId);

    res.json({
      caseId,
      searchValue: value,
      documents,
      documentCount: documents.length,
    });
  } catch (err) {
    console.error(`[CaseIntel] Entity search error: ${err.message}`);
    res.status(500).json({ error: 'Failed to search entities' });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(timestamp);
  }
}

export default router;
