// ============================================
// Court Access — Investigative Opportunity Engine
// Phase 133: Identify gaps in evidence and suggest
// investigative opportunities
// ============================================

import prisma from '../services/prismaClient.js';

const OPPORTUNITY_TYPES = {
  MISSING_WITNESS: { priority: 'high', description: 'Witness mentioned but no statement collected' },
  UNCORROBORATED_CLAIM: { priority: 'medium', description: 'Key claim with no supporting evidence' },
  SURVEILLANCE_GAP: { priority: 'high', description: 'Surveillance footage not yet obtained for critical timeframe' },
  FORENSIC_OPPORTUNITY: { priority: 'high', description: 'Physical evidence that could be forensically analyzed' },
  ALIBI_VERIFICATION: { priority: 'critical', description: 'Alibi claim that can be independently verified' },
  TIMELINE_GAP: { priority: 'medium', description: 'Unaccounted time period in timeline' },
  RECORD_REQUEST: { priority: 'medium', description: 'Records that should be subpoenaed' },
  EXPERT_CONSULTATION: { priority: 'low', description: 'Area where expert testimony may be beneficial' },
};

/**
 * Identify investigative opportunities for a case.
 * @param {string} caseId
 * @returns {{ opportunities: object[], summary: object }}
 */
export async function identifyOpportunities(caseId) {
  console.log(`[InvestigativeOpp] Scanning for opportunities in case ${caseId}`);

  const [facts, timeline, conflicts, witnesses, admissibility] = await Promise.all([
    prisma.extractedFact.findMany({ where: { caseId } }),
    prisma.courtTimelineEvent.findMany({ where: { caseId }, orderBy: { time: 'asc' } }),
    prisma.timelineConflict.findMany({ where: { caseId } }),
    prisma.witnessReliability.findMany({ where: { caseId } }),
    prisma.admissibilityIssue.findMany({ where: { caseId } }),
  ]);

  const opportunities = [];

  // Missing witnesses
  const mentionedPersons = facts.filter(f => f.factType === 'PERSON').map(f => f.normalizedValue);
  const interviewedWitnesses = new Set(witnesses.map(w => w.witnessName.toLowerCase()));
  const uniquePersons = [...new Set(mentionedPersons)];
  for (const person of uniquePersons) {
    if (!interviewedWitnesses.has(person.toLowerCase())) {
      opportunities.push({
        caseId,
        opportunityType: 'MISSING_WITNESS',
        priority: OPPORTUNITY_TYPES.MISSING_WITNESS.priority,
        description: `Person "${person}" is mentioned in evidence but no witness statement has been analyzed.`,
        suggestedAction: `Obtain and analyze statement from "${person}" or determine their relevance to the case.`,
        relatedEvidenceIds: facts.filter(f => f.normalizedValue === person).map(f => f.documentId),
        metadata: { personName: person },
      });
    }
  }

  // Timeline gaps
  for (let i = 1; i < timeline.length; i++) {
    const gap = new Date(timeline[i].time).getTime() - new Date(timeline[i - 1].time).getTime();
    const gapHours = gap / (1000 * 60 * 60);
    if (gapHours > 2 && gapHours < 48) {
      opportunities.push({
        caseId,
        opportunityType: 'TIMELINE_GAP',
        priority: OPPORTUNITY_TYPES.TIMELINE_GAP.priority,
        description: `${Math.round(gapHours)}-hour gap in timeline between "${timeline[i - 1].event.substring(0, 50)}" and "${timeline[i].event.substring(0, 50)}".`,
        suggestedAction: `Investigate activities during the ${Math.round(gapHours)}-hour unaccounted period. Check surveillance, phone records, or witnesses.`,
        relatedEvidenceIds: [timeline[i - 1].id, timeline[i].id],
        metadata: { gapHours: Math.round(gapHours) },
      });
    }
  }

  // Uncorroborated key claims
  const eventFacts = facts.filter(f => f.factType === 'EVENT' && f.confidenceScore < 0.7);
  for (const fact of eventFacts) {
    const hasCorrob = facts.some(f =>
      f.id !== fact.id && f.documentId !== fact.documentId && f.normalizedValue === fact.normalizedValue
    );
    if (!hasCorrob) {
      opportunities.push({
        caseId,
        opportunityType: 'UNCORROBORATED_CLAIM',
        priority: OPPORTUNITY_TYPES.UNCORROBORATED_CLAIM.priority,
        description: `Event claim "${fact.statementText.substring(0, 80)}" has no corroborating evidence from independent sources.`,
        suggestedAction: `Seek additional evidence or witnesses to corroborate or refute this claim.`,
        relatedEvidenceIds: [fact.documentId],
        metadata: { factId: fact.id },
      });
    }
  }

  // Alibi verification from conflicts
  for (const conflict of conflicts) {
    opportunities.push({
      caseId,
      opportunityType: 'ALIBI_VERIFICATION',
      priority: OPPORTUNITY_TYPES.ALIBI_VERIFICATION.priority,
      description: `Timeline conflict (${conflict.conflictType}): "${conflict.description.substring(0, 100)}". Alibi or location can potentially be verified.`,
      suggestedAction: `Obtain GPS data, surveillance footage, or third-party records to resolve this conflict.`,
      relatedEvidenceIds: [conflict.eventAId, conflict.eventBId],
      metadata: { conflictId: conflict.id, conflictType: conflict.conflictType },
    });
  }

  // Record requests from admissibility issues
  for (const issue of admissibility) {
    if (issue.issueType === 'chain_of_custody_break') {
      opportunities.push({
        caseId,
        opportunityType: 'RECORD_REQUEST',
        priority: OPPORTUNITY_TYPES.RECORD_REQUEST.priority,
        description: `Chain of custody issue for evidence "${issue.evidenceId}": ${issue.description.substring(0, 100)}`,
        suggestedAction: `Subpoena complete chain of custody records and evidence handling logs.`,
        relatedEvidenceIds: [issue.evidenceId],
        metadata: { issueId: issue.id },
      });
    }
  }

  // Store opportunities
  const stored = [];
  for (const opp of opportunities) {
    try {
      const record = await prisma.investigativeOpportunity.create({ data: opp });
      stored.push(record);
    } catch (err) {
      console.warn(`[InvestigativeOpp] Store error: ${err.message}`);
    }
  }

  console.log(`[InvestigativeOpp] Found ${stored.length} opportunities for case ${caseId}`);

  return {
    opportunities: stored,
    summary: {
      total: stored.length,
      byType: Object.fromEntries(
        Object.keys(OPPORTUNITY_TYPES).map(t => [t, stored.filter(o => o.opportunityType === t).length])
      ),
      byPriority: {
        critical: stored.filter(o => o.priority === 'critical').length,
        high: stored.filter(o => o.priority === 'high').length,
        medium: stored.filter(o => o.priority === 'medium').length,
        low: stored.filter(o => o.priority === 'low').length,
      },
    },
  };
}

export async function getCaseOpportunities(caseId, priority = null) {
  const where = { caseId };
  if (priority) where.priority = priority;
  return prisma.investigativeOpportunity.findMany({ where, orderBy: { createdAt: 'desc' } });
}
