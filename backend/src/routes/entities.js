// ============================================
// Court Access — Phase B: Entity Linking API
// CRUD + query for entities and cross-evidence links.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Phase 94: All entity routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/entities/:caseId — List all entities for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { entityType } = req.query;

    const where = { caseId };
    if (entityType) where.entityType = entityType;

    const entities = await prisma.entity.findMany({
      where,
      include: {
        links: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ entities, count: entities.length });
  } catch (err) {
    console.error('[Entities] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/entities/:caseId/:entityId — Get entity with all evidence links
// ---------------------------------------------------------------------------

router.get('/:caseId/:entityId', async (req, res) => {
  try {
    const { caseId, entityId } = req.params;

    const entity = await prisma.entity.findFirst({
      where: { id: entityId, caseId },
      include: {
        links: {
          orderBy: { detectionConfidence: 'desc' },
        },
      },
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json(entity);
  } catch (err) {
    console.error('[Entities] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch entity' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/entities/:caseId — Create or upsert an entity
// ---------------------------------------------------------------------------

router.post('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { entityType, entityValue, firstDetectedEvidenceId } = req.body;

    if (!entityType || !entityValue) {
      return res.status(400).json({ error: 'entityType and entityValue are required' });
    }

    const entity = await prisma.entity.upsert({
      where: {
        caseId_entityType_entityValue: {
          caseId,
          entityType,
          entityValue,
        },
      },
      update: {},
      create: {
        caseId,
        entityType,
        entityValue,
        firstDetectedEvidenceId: firstDetectedEvidenceId || null,
      },
    });

    res.status(201).json(entity);
  } catch (err) {
    console.error('[Entities] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/entities/:caseId/batch — Batch upsert entities with links
// ---------------------------------------------------------------------------

router.post('/:caseId/batch', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { entities } = req.body;

    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ error: 'entities array is required' });
    }

    let created = 0;
    let linked = 0;

    for (const item of entities) {
      const entity = await prisma.entity.upsert({
        where: {
          caseId_entityType_entityValue: {
            caseId,
            entityType: item.entityType,
            entityValue: item.entityValue,
          },
        },
        update: {},
        create: {
          caseId,
          entityType: item.entityType,
          entityValue: item.entityValue,
          firstDetectedEvidenceId: item.evidenceId || null,
        },
      });
      created++;

      if (item.evidenceId) {
        await prisma.evidenceEntityLink.upsert({
          where: {
            entityId_evidenceId: {
              entityId: entity.id,
              evidenceId: item.evidenceId,
            },
          },
          update: {
            detectionConfidence: item.detectionConfidence ?? 1.0,
            contextSnippet: item.contextSnippet || '',
          },
          create: {
            entityId: entity.id,
            evidenceId: item.evidenceId,
            detectionConfidence: item.detectionConfidence ?? 1.0,
            contextSnippet: item.contextSnippet || '',
          },
        });
        linked++;
      }
    }

    res.status(201).json({ entitiesProcessed: created, linksCreated: linked });
  } catch (err) {
    console.error('[Entities] Batch error:', err.message);
    res.status(500).json({ error: 'Failed to batch process entities' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/entities/:caseId/:entityId/link — Link entity to evidence
// ---------------------------------------------------------------------------

router.post('/:caseId/:entityId/link', async (req, res) => {
  try {
    const { entityId } = req.params;
    const { evidenceId, detectionConfidence, contextSnippet } = req.body;

    if (!evidenceId) {
      return res.status(400).json({ error: 'evidenceId is required' });
    }

    const link = await prisma.evidenceEntityLink.upsert({
      where: {
        entityId_evidenceId: { entityId, evidenceId },
      },
      update: {
        detectionConfidence: detectionConfidence ?? 1.0,
        contextSnippet: contextSnippet || '',
      },
      create: {
        entityId,
        evidenceId,
        detectionConfidence: detectionConfidence ?? 1.0,
        contextSnippet: contextSnippet || '',
      },
    });

    res.status(201).json(link);
  } catch (err) {
    console.error('[Entities] Link error:', err.message);
    res.status(500).json({ error: 'Failed to link entity to evidence' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/entities/:caseId/:entityId — Delete entity and all links
// ---------------------------------------------------------------------------

router.delete('/:caseId/:entityId', async (req, res) => {
  try {
    const { caseId, entityId } = req.params;

    await prisma.entity.delete({
      where: { id: entityId, caseId },
    });

    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Entity not found' });
    }
    console.error('[Entities] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

export default router;
