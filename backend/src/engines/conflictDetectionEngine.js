// ============================================
// Court Access — Conflict Detection Engine
// Phase 116: Evidence Intelligence Engine v1
//
// Identifies contradictions across evidence:
// - Timeline mismatches (different times for same event)
// - Entity discrepancies (conflicting descriptions)
// - Testimony contradictions (witnesses disagree)
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Conflict Detection Patterns
// ---------------------------------------------------------------------------

const TIME_PATTERNS = [
  /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/g,
  /\b(\d{1,2}\s*(?:AM|PM|am|pm))\b/g,
];

const DATE_PATTERNS = [
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
  /\b(\d{4}-\d{2}-\d{2})\b/g,
  /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
];

// ---------------------------------------------------------------------------
// Core Conflict Detection
// ---------------------------------------------------------------------------

/**
 * Detect conflicts across all documents in a case.
 *
 * @param {string} caseId
 * @returns {object} { conflicts: [...], summary: {...} }
 */
export async function detectConflicts(caseId) {
  console.log(`[ConflictEngine] Detecting conflicts for case ${caseId}`);

  const conflicts = [];

  // 1. Timeline conflicts — find events at similar times with different descriptions
  const timelineConflicts = await detectTimelineConflicts(caseId);
  conflicts.push(...timelineConflicts);

  // 2. Entity conflicts — find same entity described differently across documents
  const entityConflicts = await detectEntityConflicts(caseId);
  conflicts.push(...entityConflicts);

  // 3. Testimony conflicts — find contradicting statements from different speakers
  const testimonyConflicts = await detectTestimonyConflicts(caseId);
  conflicts.push(...testimonyConflicts);

  // Store detected conflicts
  if (conflicts.length > 0) {
    try {
      await prisma.evidenceConflict.createMany({
        data: conflicts.map(c => ({
          caseId,
          entity: c.entity,
          documentA: c.documentA,
          documentB: c.documentB,
          description: c.description,
          conflictType: c.conflictType,
          confidence: c.confidence,
          metadata: c.metadata || {},
        })),
        skipDuplicates: true,
      });
      console.log(`[ConflictEngine] Stored ${conflicts.length} conflicts for case ${caseId}`);
    } catch (err) {
      console.error(`[ConflictEngine] Failed to store conflicts: ${err.message}`);
    }
  }

  return {
    conflicts,
    summary: {
      total: conflicts.length,
      timeline: timelineConflicts.length,
      entity: entityConflicts.length,
      testimony: testimonyConflicts.length,
    },
  };
}

/**
 * Detect timeline-based conflicts.
 * Finds events at similar timestamps with contradictory information.
 */
async function detectTimelineConflicts(caseId) {
  const conflicts = [];

  try {
    const events = await prisma.caseEvent.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
    });

    // Compare events within a 10-minute window
    const WINDOW_MS = 10 * 60 * 1000;

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const timeDiff = Math.abs(
          new Date(events[j].timestamp).getTime() - new Date(events[i].timestamp).getTime()
        );

        if (timeDiff <= WINDOW_MS && events[i].sourceDocumentId !== events[j].sourceDocumentId) {
          // Check if descriptions contradict each other
          const descA = events[i].description.toLowerCase();
          const descB = events[j].description.toLowerCase();

          // Simple contradiction detection: same subject, different action/location
          if (hasContradiction(descA, descB)) {
            conflicts.push({
              entity: `Timeline: ${events[i].description.substring(0, 50)}`,
              documentA: events[i].sourceDocumentId || 'unknown',
              documentB: events[j].sourceDocumentId || 'unknown',
              description: `Timeline mismatch: "${events[i].description}" vs "${events[j].description}" (${Math.round(timeDiff / 60000)} min apart)`,
              conflictType: 'timeline_mismatch',
              confidence: 0.7,
              metadata: {
                eventA: events[i].id,
                eventB: events[j].id,
                timeDiffMs: timeDiff,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[ConflictEngine] Timeline conflict detection failed: ${err.message}`);
  }

  return conflicts;
}

/**
 * Detect entity-based conflicts.
 * Finds the same entity with conflicting information across documents.
 */
async function detectEntityConflicts(caseId) {
  const conflicts = [];

  try {
    // Find entities that appear in multiple documents with different values
    const entities = await prisma.documentEntity.findMany({
      where: { caseId },
      orderBy: { entityType: 'asc' },
    });

    // Group by entity type + similar value
    const entityGroups = new Map();
    for (const entity of entities) {
      const key = `${entity.entityType}:${entity.entityValue.toLowerCase().trim()}`;
      if (!entityGroups.has(key)) {
        entityGroups.set(key, []);
      }
      entityGroups.get(key).push(entity);
    }

    // Check for conflicting dates/times for the same entity
    for (const [key, group] of entityGroups) {
      if (group.length < 2) continue;

      // Get unique documents
      const docs = [...new Set(group.map(e => e.documentId))];
      if (docs.length < 2) continue;

      // For dates: check if same event referenced with different dates
      if (group[0].entityType === 'date') {
        const contexts = group.map(e => e.sourceContext.toLowerCase());
        for (let i = 0; i < contexts.length; i++) {
          for (let j = i + 1; j < contexts.length; j++) {
            if (group[i].documentId !== group[j].documentId && hasContradiction(contexts[i], contexts[j])) {
              conflicts.push({
                entity: group[i].entityValue,
                documentA: group[i].documentId,
                documentB: group[j].documentId,
                description: `Date conflict: "${group[i].entityValue}" in different contexts across documents`,
                conflictType: 'entity_discrepancy',
                confidence: 0.6,
                metadata: { entityType: group[i].entityType },
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[ConflictEngine] Entity conflict detection failed: ${err.message}`);
  }

  return conflicts;
}

/**
 * Detect testimony-based conflicts.
 * Finds contradicting statements from different speakers about the same subject.
 */
async function detectTestimonyConflicts(caseId) {
  const conflicts = [];

  try {
    const statements = await prisma.transcriptStatement.findMany({
      where: {
        caseId,
        statementType: { in: ['contradiction', 'timeline_ref', 'key_testimony'] },
      },
      orderBy: { extractedAt: 'asc' },
    });

    // Compare statements from different speakers
    for (let i = 0; i < statements.length; i++) {
      for (let j = i + 1; j < statements.length; j++) {
        if (statements[i].speaker === statements[j].speaker) continue;
        if (statements[i].transcriptId === statements[j].transcriptId &&
            statements[i].speaker === statements[j].speaker) continue;

        const textA = statements[i].statementText.toLowerCase();
        const textB = statements[j].statementText.toLowerCase();

        if (hasContradiction(textA, textB)) {
          conflicts.push({
            entity: `Testimony: ${statements[i].speaker} vs ${statements[j].speaker}`,
            documentA: statements[i].transcriptId,
            documentB: statements[j].transcriptId,
            description: `Contradicting testimony: ${statements[i].speaker} says "${statements[i].statementText.substring(0, 80)}" but ${statements[j].speaker} says "${statements[j].statementText.substring(0, 80)}"`,
            conflictType: 'contradiction',
            confidence: 0.65,
            metadata: {
              speakerA: statements[i].speaker,
              speakerB: statements[j].speaker,
              statementA: statements[i].id,
              statementB: statements[j].id,
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[ConflictEngine] Testimony conflict detection failed: ${err.message}`);
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Contradiction Heuristics
// ---------------------------------------------------------------------------

/**
 * Simple heuristic to detect potential contradictions between two text segments.
 * Looks for opposing terms, negations, or conflicting time/location references.
 */
function hasContradiction(textA, textB) {
  const OPPOSING_PAIRS = [
    ['left', 'entered'],
    ['inside', 'outside'],
    ['before', 'after'],
    ['arrived', 'departed'],
    ['present', 'absent'],
    ['yes', 'no'],
    ['confirmed', 'denied'],
    ['admitted', 'denied'],
    ['saw', 'did not see'],
    ['heard', 'did not hear'],
    ['armed', 'unarmed'],
    ['conscious', 'unconscious'],
    ['cooperated', 'resisted'],
  ];

  for (const [termA, termB] of OPPOSING_PAIRS) {
    if ((textA.includes(termA) && textB.includes(termB)) ||
        (textA.includes(termB) && textB.includes(termA))) {
      return true;
    }
  }

  // Check for negation patterns
  const negationPattern = /\b(?:not|never|no|didn't|did not|wasn't|was not|weren't|couldn't|cannot)\b/;
  const hasNegA = negationPattern.test(textA);
  const hasNegB = negationPattern.test(textB);

  // If one has negation and other doesn't, and they share significant words
  if (hasNegA !== hasNegB) {
    const wordsA = new Set(textA.split(/\s+/).filter(w => w.length > 4));
    const wordsB = new Set(textB.split(/\s+/).filter(w => w.length > 4));
    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }
    if (overlap >= 3) return true;
  }

  return false;
}

/**
 * Get all conflicts for a case.
 */
export async function getCaseConflicts(caseId) {
  return prisma.evidenceConflict.findMany({
    where: { caseId },
    orderBy: { detectedAt: 'desc' },
  });
}

/**
 * Get conflict summary statistics for a case.
 */
export async function getConflictSummary(caseId) {
  const conflicts = await prisma.evidenceConflict.findMany({
    where: { caseId },
  });

  const byType = {};
  for (const c of conflicts) {
    byType[c.conflictType] = (byType[c.conflictType] || 0) + 1;
  }

  return {
    total: conflicts.length,
    byType,
    highConfidence: conflicts.filter(c => c.confidence >= 0.8).length,
    mediumConfidence: conflicts.filter(c => c.confidence >= 0.5 && c.confidence < 0.8).length,
    lowConfidence: conflicts.filter(c => c.confidence < 0.5).length,
  };
}
