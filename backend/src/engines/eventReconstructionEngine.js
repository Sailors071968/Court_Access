// ============================================
// Court Access — Event Reconstruction Engine
// Phase 126: Convert correlated facts into events
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Reconstruct events from extracted facts and correlations.
 * @param {string} caseId
 * @returns {{ events: object[], summary: object }}
 */
export async function reconstructEvents(caseId) {
  console.log(`[EventReconstruction] Reconstructing events for case ${caseId}`);

  const facts = await prisma.extractedFact.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  const eventFacts = facts.filter(f => f.factType === 'EVENT');
  const timeFacts = facts.filter(f => f.factType === 'TIME' || f.factType === 'DATE');
  const locationFacts = facts.filter(f => f.factType === 'LOCATION');
  const personFacts = facts.filter(f => f.factType === 'PERSON');

  const events = [];

  for (const eventFact of eventFacts) {
    const timeRef = timeFacts.find(t => t.documentId === eventFact.documentId && Math.abs((t.line || 0) - (eventFact.line || 0)) < 10);
    const locRef = locationFacts.find(l => l.documentId === eventFact.documentId && Math.abs((l.line || 0) - (eventFact.line || 0)) < 15);
    const relatedPersons = personFacts
      .filter(p => p.documentId === eventFact.documentId && Math.abs((p.line || 0) - (eventFact.line || 0)) < 20)
      .map(p => ({ name: p.statementText, role: 'participant' }));

    const timestamp = timeRef && eventFact.timestamp ? eventFact.timestamp : null;

    events.push({
      caseId,
      timestamp,
      location: locRef ? locRef.statementText : '',
      actors: relatedPersons,
      evidenceSources: [{ evidenceId: eventFact.documentId, page: eventFact.page, line: eventFact.line }],
      description: eventFact.statementText,
      confidenceScore: eventFact.confidenceScore,
      metadata: {
        sourceFactId: eventFact.id,
        timeReference: timeRef ? timeRef.statementText : null,
        locationReference: locRef ? locRef.statementText : null,
      },
    });
  }

  const stored = [];
  for (const event of events) {
    try {
      const record = await prisma.reconstructedEvent.create({ data: event });
      stored.push(record);
    } catch (err) {
      console.warn(`[EventReconstruction] Store error: ${err.message}`);
    }
  }

  console.log(`[EventReconstruction] Reconstructed ${stored.length} events for case ${caseId}`);

  return {
    events: stored,
    summary: {
      total: stored.length,
      withTimestamp: stored.filter(e => e.timestamp).length,
      withLocation: stored.filter(e => e.location).length,
      withActors: stored.filter(e => Array.isArray(e.actors) && e.actors.length > 0).length,
    },
  };
}

export async function getCaseReconstructedEvents(caseId) {
  return prisma.reconstructedEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });
}
