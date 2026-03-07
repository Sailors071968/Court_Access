// ============================================
// Court Access — Narrative Reconstruction Engine
// Phase 137: Build coherent case narratives from
// timeline, facts, and evidence
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Reconstruct a case narrative from available evidence.
 * @param {string} caseId
 * @param {string} [perspective='defense'] - 'defense' or 'prosecution'
 * @returns {object} CaseNarrative record
 */
export async function reconstructNarrative(caseId, perspective = 'defense') {
  console.log(`[Narrative] Reconstructing ${perspective} narrative for case ${caseId}`);

  const [timeline, facts, conflicts, witnesses, impacts] = await Promise.all([
    prisma.courtTimelineEvent.findMany({ where: { caseId }, orderBy: { time: 'asc' } }),
    prisma.extractedFact.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } }),
    prisma.timelineConflict.findMany({ where: { caseId } }),
    prisma.witnessReliability.findMany({ where: { caseId } }),
    prisma.evidenceImpactScore.findMany({ where: { caseId }, orderBy: { overallImpactScore: 'desc' } }),
  ]);

  const sections = [];

  // Section 1: Background / Setting
  const locationFacts = facts.filter(f => f.factType === 'LOCATION');
  const dateFacts = facts.filter(f => f.factType === 'DATE');
  sections.push({
    title: 'Background',
    content: buildBackgroundSection(locationFacts, dateFacts, timeline),
    supportingEvidence: locationFacts.map(f => f.documentId).slice(0, 5),
  });

  // Section 2: Chronological Events
  sections.push({
    title: 'Chronological Events',
    content: buildChronologySection(timeline),
    supportingEvidence: timeline.map(t => t.sourceEvidence?.[0]?.evidenceId).filter(Boolean),
  });

  // Section 3: Key Evidence
  const topEvidence = impacts.slice(0, 10);
  sections.push({
    title: 'Key Evidence',
    content: buildEvidenceSection(topEvidence, perspective),
    supportingEvidence: topEvidence.map(e => e.evidenceId),
  });

  // Section 4: Witness Accounts
  sections.push({
    title: 'Witness Accounts',
    content: buildWitnessSection(witnesses, perspective),
    supportingEvidence: [],
  });

  // Section 5: Conflicts / Inconsistencies
  sections.push({
    title: 'Conflicts and Inconsistencies',
    content: buildConflictSection(conflicts, perspective),
    supportingEvidence: conflicts.map(c => c.eventAId),
  });

  const narrative = await prisma.caseNarrative.create({
    data: {
      caseId,
      perspective,
      sections,
      evidenceIds: [...new Set(sections.flatMap(s => s.supportingEvidence))],
      confidenceScore: calculateNarrativeConfidence(timeline, facts, conflicts),
      metadata: {
        timelineEventCount: timeline.length,
        factCount: facts.length,
        conflictCount: conflicts.length,
        witnessCount: witnesses.length,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`[Narrative] Generated ${perspective} narrative with ${sections.length} sections for case ${caseId}`);
  return narrative;
}

function buildBackgroundSection(locations, dates, timeline) {
  const lines = [];
  if (dates.length > 0) lines.push(`Key dates: ${dates.map(d => d.statementText).slice(0, 5).join('; ')}`);
  if (locations.length > 0) lines.push(`Key locations: ${locations.map(l => l.statementText).slice(0, 5).join('; ')}`);
  if (timeline.length > 0) {
    lines.push(`Timeline spans from ${timeline[0].time} to ${timeline[timeline.length - 1].time}`);
  }
  return lines.join('\n') || 'No background information available.';
}

function buildChronologySection(timeline) {
  if (timeline.length === 0) return 'No timeline events available.';
  return timeline.map((e, i) => `${i + 1}. [${new Date(e.time).toISOString()}] ${e.event}`).join('\n');
}

function buildEvidenceSection(impacts, perspective) {
  if (impacts.length === 0) return 'No scored evidence available.';
  return impacts.map(e => {
    const label = perspective === 'defense' ? 'Defense relevance' : 'Prosecution relevance';
    return `• Evidence ${e.evidenceId}: Impact ${e.impactLevel} (${e.overallImpactScore}) — ${label}: ${e.reliabilityScore >= 0.7 ? 'Strong' : 'Questionable'} reliability`;
  }).join('\n');
}

function buildWitnessSection(witnesses, perspective) {
  if (witnesses.length === 0) return 'No witness reliability data available.';
  const sorted = [...witnesses].sort((a, b) => b.credibilityScore - a.credibilityScore);
  return sorted.map(w => {
    const credLevel = w.credibilityScore >= 0.7 ? 'High' : w.credibilityScore >= 0.4 ? 'Moderate' : 'Low';
    return `• ${w.witnessName}: Credibility ${credLevel} (${w.credibilityScore}) — Consistency: ${w.consistencyScore}, Corroboration: ${w.corroborationScore}`;
  }).join('\n');
}

function buildConflictSection(conflicts, perspective) {
  if (conflicts.length === 0) return 'No timeline conflicts detected.';
  return conflicts.map(c => {
    return `• [${c.severity.toUpperCase()}] ${c.conflictType}: ${c.description}`;
  }).join('\n');
}

function calculateNarrativeConfidence(timeline, facts, conflicts) {
  const base = 0.5;
  const timelineBonus = Math.min(timeline.length * 0.02, 0.2);
  const factBonus = Math.min(facts.length * 0.005, 0.15);
  const conflictPenalty = Math.min(conflicts.length * 0.05, 0.2);
  return Math.round(Math.max(0.1, Math.min(1, base + timelineBonus + factBonus - conflictPenalty)) * 100) / 100;
}

export async function getCaseNarratives(caseId) {
  return prisma.caseNarrative.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
}
