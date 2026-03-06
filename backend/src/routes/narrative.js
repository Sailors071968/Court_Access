// ============================================
// Court Access — Phase C: AI Case Narrative API
// Generate and retrieve structured case narratives.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { config } from '../config/index.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId — Get latest narrative for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    const narrative = await prisma.caseNarrative.findFirst({
      where: { caseId },
      orderBy: { generatedTimestamp: 'desc' },
    });

    if (!narrative) {
      return res.json({ narrative: null, message: 'No narrative generated yet' });
    }

    res.json({ narrative });
  } catch (err) {
    console.error('[Narrative] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch narrative' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/history — Get all narratives for a case
// ---------------------------------------------------------------------------

router.get('/:caseId/history', async (req, res) => {
  try {
    const { caseId } = req.params;

    const narratives = await prisma.caseNarrative.findMany({
      where: { caseId },
      orderBy: { generatedTimestamp: 'desc' },
      take: 10,
    });

    res.json({ narratives, count: narratives.length });
  } catch (err) {
    console.error('[Narrative] History error:', err.message);
    res.status(500).json({ error: 'Failed to fetch narrative history' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/narrative/:caseId/generate — Generate a new narrative
// ---------------------------------------------------------------------------

router.post('/:caseId/generate', async (req, res) => {
  try {
    const { caseId } = req.params;

    // Gather timeline events for the case
    const timelineEvents = await prisma.timelineEvent.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    // Gather entities for the case
    const entities = await prisma.entity.findMany({
      where: { caseId },
      include: { links: true },
    });

    // Build context for narrative generation
    const timelineSummary = timelineEvents.map((e) =>
      `[${e.timestamp.toISOString().split('T')[0]}] ${e.eventDescription} (${e.sourceType}, confidence: ${e.confidenceScore})`
    ).join('\n');

    const entitySummary = entities.map((e) =>
      `${e.entityType}: ${e.entityValue} (linked to ${e.links.length} evidence items)`
    ).join('\n');

    // Generate narrative using OpenAI if available, otherwise deterministic
    let summaryText = '';
    let keyEvents = [];
    let conflictsDetected = [];
    let participants = [];
    let modelVersion = 'deterministic-v1';

    if (config.openaiApiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: config.openaiApiKey });

        const prompt = `You are a legal case analyst. Generate a structured case narrative from the following evidence data.

Timeline Events:
${timelineSummary || 'No timeline events recorded yet.'}

Detected Entities:
${entitySummary || 'No entities detected yet.'}

Generate a JSON response with:
1. "summary": A concise narrative overview of the case (2-4 paragraphs)
2. "keyEvents": Array of the 5 most significant events with date and description
3. "conflicts": Array of any detected contradictions or conflicts between evidence
4. "participants": Array of key people/organizations involved with their roles`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        });

        const parsed = JSON.parse(completion.choices[0].message.content);
        summaryText = parsed.summary || '';
        keyEvents = parsed.keyEvents || [];
        conflictsDetected = parsed.conflicts || [];
        participants = parsed.participants || [];
        modelVersion = 'gpt-4';
      } catch (aiErr) {
        console.warn('[Narrative] OpenAI generation failed, using deterministic fallback:', aiErr.message);
      }
    }

    // Deterministic fallback
    if (!summaryText) {
      const eventCount = timelineEvents.length;
      const entityCount = entities.length;
      const personEntities = entities.filter((e) => e.entityType === 'person');
      const locationEntities = entities.filter((e) => e.entityType === 'location');

      summaryText = `Case analysis based on ${eventCount} timeline events and ${entityCount} detected entities. `;

      if (personEntities.length > 0) {
        summaryText += `Key individuals identified: ${personEntities.map((e) => e.entityValue).join(', ')}. `;
      }

      if (locationEntities.length > 0) {
        summaryText += `Relevant locations: ${locationEntities.map((e) => e.entityValue).join(', ')}. `;
      }

      if (eventCount > 0) {
        const first = timelineEvents[0];
        const last = timelineEvents[eventCount - 1];
        summaryText += `Events span from ${first.timestamp.toISOString().split('T')[0]} to ${last.timestamp.toISOString().split('T')[0]}.`;
      }

      keyEvents = timelineEvents.slice(0, 5).map((e) => ({
        date: e.timestamp.toISOString().split('T')[0],
        description: e.eventDescription,
        type: e.eventType,
      }));

      participants = personEntities.map((e) => ({
        name: e.entityValue,
        role: 'mentioned in evidence',
        evidenceCount: e.links.length,
      }));

      modelVersion = 'deterministic-v1';
    }

    const narrative = await prisma.caseNarrative.create({
      data: {
        caseId,
        summaryText,
        keyEvents,
        conflictsDetected,
        participants,
        modelVersion,
      },
    });

    console.log(JSON.stringify({
      event: 'narrative_generated',
      caseId,
      modelVersion,
      timelineEventsUsed: timelineEvents.length,
      entitiesUsed: entities.length,
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json({ narrative });
  } catch (err) {
    console.error('[Narrative] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate narrative' });
  }
});

export default router;
