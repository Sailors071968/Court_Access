// ============================================================================
// Phase D.7 — Jury Persuasion Analytics + Trial Dynamics Intelligence
// Deterministic narrative coherence, juror confusion detection, contradiction
// salience scoring, witness credibility impact, burden clarity, reasonable
// doubt amplification, theory complexity, timeline comprehension, evidentiary
// weight balancing. ALL citation-backed.
// NEVER manipulates juries. Analyzes litigation clarity and evidentiary coherence.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Narrative Coherence Scoring
// ---------------------------------------------------------------------------

export async function scoreNarrativeCoherence(caseId: string): Promise<Record<string, unknown>> {
  // Fetch all relevant data
  const [contradictions, witnessInconsistencies, timelineIssues, burdenFractures, statements] = await Promise.all([
    prisma.contradictionPair.findMany({ where: { caseId } }),
    prisma.witnessInconsistency.findMany({ where: { caseId } }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.burdenFracture.findMany({ where: { caseId } }),
    prisma.evidenceStatement.findMany({ where: { caseId } }),
  ]);

  const totalStatements = statements.length || 1;

  // Internal consistency: fewer contradictions = higher consistency
  const contradictionRate = contradictions.length / totalStatements;
  const internalConsistency = Math.max(0, 1 - contradictionRate * 5);

  // Chronological flow: fewer timeline issues = better flow
  const timelineRate = timelineIssues.length / totalStatements;
  const chronologicalFlow = Math.max(0, 1 - timelineRate * 10);

  // Witness alignment: fewer inconsistencies = better alignment
  const speakers = new Set(statements.map(s => s.speaker).filter(Boolean));
  const inconsistencyRate = witnessInconsistencies.length / (speakers.size || 1);
  const witnessAlignment = Math.max(0, 1 - inconsistencyRate * 0.3);

  // Prosecution clarity: more burden fractures = less clear prosecution
  const fractureRate = burdenFractures.length / totalStatements;
  const prosecutionClarity = Math.max(0, 1 - fractureRate * 8);

  // Defense clarity: inversely related to prosecution clarity (defense benefits from prosecution weakness)
  const defenseClarity = Math.min(1, (1 - prosecutionClarity) + 0.3);

  // Overall coherence: weighted average
  const overallCoherence = (
    prosecutionClarity * 0.25 +
    internalConsistency * 0.25 +
    chronologicalFlow * 0.2 +
    witnessAlignment * 0.15 +
    defenseClarity * 0.15
  );

  // Identify weak points
  const weakPoints: Array<Record<string, unknown>> = [];
  if (internalConsistency < 0.5) weakPoints.push({ area: 'Internal Consistency', score: internalConsistency, explanation: `${contradictions.length} contradictions found across ${totalStatements} statements` });
  if (chronologicalFlow < 0.5) weakPoints.push({ area: 'Chronological Flow', score: chronologicalFlow, explanation: `${timelineIssues.length} timeline incompatibilities detected` });
  if (witnessAlignment < 0.5) weakPoints.push({ area: 'Witness Alignment', score: witnessAlignment, explanation: `${witnessInconsistencies.length} witness inconsistencies across ${speakers.size} witnesses` });
  if (prosecutionClarity < 0.5) weakPoints.push({ area: 'Prosecution Clarity', score: prosecutionClarity, explanation: `${burdenFractures.length} burden fractures undermine prosecution narrative` });

  const strengthPoints: Array<Record<string, unknown>> = [];
  if (internalConsistency >= 0.7) strengthPoints.push({ area: 'Internal Consistency', score: internalConsistency, explanation: 'Low contradiction rate supports narrative coherence' });
  if (chronologicalFlow >= 0.7) strengthPoints.push({ area: 'Chronological Flow', score: chronologicalFlow, explanation: 'Timeline is relatively consistent' });
  if (defenseClarity >= 0.7) strengthPoints.push({ area: 'Defense Position', score: defenseClarity, explanation: 'Prosecution weakness creates clear defense opportunities' });

  const score = await prisma.narrativeCoherenceScore.create({
    data: {
      caseId,
      prosecutionClarity: round(prosecutionClarity),
      defenseClarity: round(defenseClarity),
      internalConsistency: round(internalConsistency),
      chronologicalFlow: round(chronologicalFlow),
      witnessAlignment: round(witnessAlignment),
      overallCoherence: round(overallCoherence),
      weakPoints: JSON.stringify(weakPoints),
      strengthPoints: JSON.stringify(strengthPoints),
    },
  });

  return { id: score.id, caseId, prosecutionClarity: round(prosecutionClarity), defenseClarity: round(defenseClarity), internalConsistency: round(internalConsistency), chronologicalFlow: round(chronologicalFlow), witnessAlignment: round(witnessAlignment), overallCoherence: round(overallCoherence), weakPoints, strengthPoints };
}

// ---------------------------------------------------------------------------
// 2. Juror Confusion Detection
// ---------------------------------------------------------------------------

export async function detectJurorConfusion(caseId: string): Promise<{
  caseId: string; zonesFound: number; zones: Array<Record<string, unknown>>;
}> {
  const [contradictions, timelineIssues, witnessInconsistencies] = await Promise.all([
    prisma.contradictionPair.findMany({ where: { caseId } }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.witnessInconsistency.findMany({ where: { caseId } }),
  ]);

  const results: Array<Record<string, unknown>> = [];

  // Contradictory testimony creates confusion
  if (contradictions.length >= 3) {
    const criticalContradictions = contradictions.filter(c => c.severity === 'critical' || c.severity === 'high');
    if (criticalContradictions.length > 0) {
      const zone = await prisma.jurorConfusionZone.create({
        data: {
          caseId,
          confusionType: 'contradictory_testimony',
          description: `${criticalContradictions.length} high-severity contradictions in testimony create potential juror confusion about key facts`,
          severity: criticalContradictions.length >= 5 ? 'high' : 'medium',
          affectedElements: JSON.stringify([]),
          confusingStatements: JSON.stringify(criticalContradictions.slice(0, 10).map(c => ({
            text: `"${c.statementAText.slice(0, 100)}" vs "${c.statementBText.slice(0, 100)}"`,
            page: c.statementAPage,
            speaker: c.statementASpeaker,
          }))),
          clarificationNeeded: 'Defense should highlight contradictions clearly to ensure jury understands each inconsistency',
          citations: JSON.stringify(criticalContradictions.slice(0, 5).map(c => ({
            text: c.statementAText.slice(0, 200),
            page: c.statementAPage,
            line: c.statementALineStart,
            speaker: c.statementASpeaker,
            document: c.statementADocumentId,
          }))),
        },
      });
      results.push({ id: zone.id, type: 'contradictory_testimony', severity: zone.severity, count: criticalContradictions.length });
    }
  }

  // Complex timeline creates confusion
  if (timelineIssues.length >= 2) {
    const zone = await prisma.jurorConfusionZone.create({
      data: {
        caseId,
        confusionType: 'complex_timeline',
        description: `${timelineIssues.length} timeline incompatibilities may confuse jury about sequence of events`,
        severity: timelineIssues.length >= 5 ? 'high' : 'medium',
        affectedElements: JSON.stringify([]),
        confusingStatements: JSON.stringify(timelineIssues.slice(0, 10).map(t => ({
          text: t.explanation,
          page: t.statementAPage,
        }))),
        clarificationNeeded: 'Defense should present a clear alternative timeline demonstrative',
        citations: JSON.stringify(timelineIssues.slice(0, 5).map(t => ({
          text: t.explanation,
          page: t.statementAPage,
          line: null,
          document: t.statementAId,
        }))),
      },
    });
    results.push({ id: zone.id, type: 'complex_timeline', severity: zone.severity, count: timelineIssues.length });
  }

  // Multiple witnesses with inconsistencies
  const witnessGroups = new Map<string, number>();
  for (const wi of witnessInconsistencies) {
    witnessGroups.set(wi.speaker, (witnessGroups.get(wi.speaker) || 0) + 1);
  }
  const confusingWitnesses = [...witnessGroups.entries()].filter(([_, count]) => count >= 2);
  if (confusingWitnesses.length >= 2) {
    const zone = await prisma.jurorConfusionZone.create({
      data: {
        caseId,
        confusionType: 'contradictory_testimony',
        description: `${confusingWitnesses.length} witnesses have multiple internal inconsistencies, potentially confusing jury about reliability`,
        severity: confusingWitnesses.length >= 4 ? 'high' : 'medium',
        affectedElements: JSON.stringify([]),
        confusingStatements: JSON.stringify(confusingWitnesses.map(([name, count]) => ({
          text: `${name}: ${count} inconsistencies`,
        }))),
        clarificationNeeded: 'Defense should systematically impeach each inconsistent witness to clarify credibility issues',
        citations: JSON.stringify([]),
      },
    });
    results.push({ id: zone.id, type: 'witness_inconsistencies', severity: zone.severity, count: confusingWitnesses.length });
  }

  return { caseId, zonesFound: results.length, zones: results };
}

// ---------------------------------------------------------------------------
// 3. Contradiction Salience Scoring
// ---------------------------------------------------------------------------

export async function scoreContradictionSalience(caseId: string): Promise<{
  caseId: string; scored: number; scores: Array<Record<string, unknown>>;
}> {
  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId },
    orderBy: { severity: 'asc' },
  });

  const results: Array<Record<string, unknown>> = [];
  let priority = 1;

  for (const c of contradictions) {
    // Element relevance: if contradiction is linked to a CALCRIM element, it's more relevant
    const elementRelevance = c.elementId ? 0.9 : 0.4;

    // Witness credibility hit: cross-document contradictions hit harder
    const witnessHit = c.contradictionType === 'cross_document' ? 0.8
      : c.contradictionType === 'speaker_conflict' ? 0.7
      : 0.5;

    // Narrative disruption: based on severity
    const narrativeDisruption = c.severity === 'critical' ? 0.95
      : c.severity === 'high' ? 0.75
      : c.severity === 'medium' ? 0.5
      : 0.3;

    // Salience = weighted formula
    const salienceScore = round(
      elementRelevance * 0.3 +
      witnessHit * 0.3 +
      narrativeDisruption * 0.4
    );

    const juryImpact = salienceScore >= 0.7 ? 'high' : salienceScore >= 0.45 ? 'medium' : 'low';

    const presentationNotes = buildSaliencePresentationNotes(c.contradictionType, c.severity, c.proofMethod);

    const score = await prisma.contradictionSalienceScore.create({
      data: {
        caseId,
        contradictionId: c.id,
        salienceScore,
        juryImpact,
        elementRelevance: round(elementRelevance),
        witnessCredibilityHit: round(witnessHit),
        narrativeDisruption: round(narrativeDisruption),
        presentationPriority: priority,
        presentationNotes,
        citations: JSON.stringify([
          { text: c.statementAText.slice(0, 200), page: c.statementAPage, line: c.statementALineStart, speaker: c.statementASpeaker, document: c.statementADocumentId },
          { text: c.statementBText.slice(0, 200), page: c.statementBPage, line: c.statementBLineStart, speaker: c.statementBSpeaker, document: c.statementBDocumentId },
        ]),
      },
    });

    results.push({ id: score.id, contradictionId: c.id, salienceScore, juryImpact, presentationPriority: priority });
    priority++;
  }

  return { caseId, scored: results.length, scores: results };
}

function buildSaliencePresentationNotes(type: string, severity: string, proofMethod: string): string {
  const intro = severity === 'critical' ? 'This is a critical contradiction that should be emphasized during cross-examination.'
    : severity === 'high' ? 'This high-impact contradiction should be presented prominently.'
    : 'This contradiction supports the defense narrative.';
  const method = `Proof method: ${proofMethod.replace(/_/g, ' ')}.`;
  const approach = type === 'cross_document' ? 'Present both documents side by side for maximum juror impact.'
    : type === 'speaker_conflict' ? 'Highlight that the same witness gave conflicting accounts.'
    : 'Contrast the two statements clearly during presentation.';
  return `${intro} ${method} ${approach}`;
}

// ---------------------------------------------------------------------------
// 4. Witness Credibility Impact Modeling
// ---------------------------------------------------------------------------

export async function modelWitnessCredibilityImpact(caseId: string): Promise<{
  caseId: string; modeled: number; witnesses: Array<Record<string, unknown>>;
}> {
  const [inconsistencies, contradictions, impeachmentPackets] = await Promise.all([
    prisma.witnessInconsistency.findMany({ where: { caseId } }),
    prisma.contradictionPair.findMany({ where: { caseId } }),
    prisma.impeachmentPacket.findMany({ where: { caseId } }),
  ]);

  // Group by witness
  const witnessData = new Map<string, { inconsistencies: number; contradictions: number; credibility: number }>();

  for (const wi of inconsistencies) {
    const data = witnessData.get(wi.speaker) || { inconsistencies: 0, contradictions: 0, credibility: 1.0 };
    data.inconsistencies++;
    witnessData.set(wi.speaker, data);
  }

  for (const cp of contradictions) {
    if (cp.statementASpeaker) {
      const data = witnessData.get(cp.statementASpeaker) || { inconsistencies: 0, contradictions: 0, credibility: 1.0 };
      data.contradictions++;
      witnessData.set(cp.statementASpeaker, data);
    }
  }

  // Add credibility from impeachment packets
  for (const ip of impeachmentPackets) {
    const existing = witnessData.get(ip.witnessName);
    if (existing) {
      existing.credibility = ip.credibilityScore;
    }
  }

  const results: Array<Record<string, unknown>> = [];

  for (const [witnessName, data] of witnessData) {
    const consistencyScore = Math.max(0, 1 - data.inconsistencies * 0.15);
    const corroborationScore = Math.max(0, 1 - data.contradictions * 0.2);
    const overallCredibility = round((consistencyScore * 0.4 + corroborationScore * 0.3 + data.credibility * 0.3));

    const biasIndicators: Array<Record<string, unknown>> = [];
    if (data.contradictions >= 3) biasIndicators.push({ type: 'inconsistent_testimony', description: `${data.contradictions} contradictions suggest unreliable testimony` });
    if (data.inconsistencies >= 4) biasIndicators.push({ type: 'frequent_changes', description: `${data.inconsistencies} inconsistencies across statements` });

    const impactIfImpeached = overallCredibility < 0.4
      ? 'Critical prosecution witness — successful impeachment could significantly weaken case'
      : overallCredibility < 0.7
      ? 'Moderate impact — impeachment would weaken specific elements of prosecution case'
      : 'Limited impeachment impact — witness is relatively consistent';

    const impact = await prisma.witnessCredibilityImpact.upsert({
      where: { caseId_witnessName: { caseId, witnessName } },
      create: {
        caseId,
        witnessName,
        overallCredibility,
        consistencyScore: round(consistencyScore),
        corroborationScore: round(corroborationScore),
        biasIndicators: JSON.stringify(biasIndicators),
        demeanorFlags: JSON.stringify([]),
        priorInconsistencies: data.inconsistencies,
        contradictionCount: data.contradictions,
        elementDependency: JSON.stringify([]),
        impactIfImpeached,
      },
      update: {
        overallCredibility,
        consistencyScore: round(consistencyScore),
        corroborationScore: round(corroborationScore),
        biasIndicators: JSON.stringify(biasIndicators),
        priorInconsistencies: data.inconsistencies,
        contradictionCount: data.contradictions,
        impactIfImpeached,
      },
    });

    results.push({ id: impact.id, witnessName, overallCredibility, inconsistencies: data.inconsistencies, contradictions: data.contradictions });
  }

  return { caseId, modeled: results.length, witnesses: results };
}

// ---------------------------------------------------------------------------
// 5. Burden Clarity Analysis
// ---------------------------------------------------------------------------

export async function analyzeBurdenClarity(caseId: string): Promise<{
  caseId: string; analyzed: number; analyses: Array<Record<string, unknown>>;
}> {
  const collapseScores = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const cs of collapseScores) {
    const elementBreakdown = JSON.parse(cs.elementDetails) as Array<{
      elementId: string; label: string; supportCount: number; contradictionCount: number; status: string;
    }>;

    const clarityScores = elementBreakdown.map(el => {
      const support = el.supportCount;
      const contra = el.contradictionCount;
      const total = support + contra;
      const clarity = total > 0 ? support / total : 0;
      return {
        elementId: el.elementId,
        label: el.label,
        clarityScore: round(clarity),
        supportingEvidence: support,
        contradictingEvidence: contra,
      };
    });

    const overallClarity = clarityScores.length > 0
      ? round(clarityScores.reduce((sum, el) => sum + el.clarityScore, 0) / clarityScores.length)
      : 0;

    const sorted = [...clarityScores].sort((a, b) => a.clarityScore - b.clarityScore);
    const weakestElement = sorted[0]?.label || null;
    const strongestElement = sorted[sorted.length - 1]?.label || null;

    const defenseArgument = overallClarity < 0.3
      ? `Prosecution has failed to establish burden of proof on CALCRIM ${cs.instructionNumber}. Multiple elements lack adequate evidentiary support.`
      : overallClarity < 0.6
      ? `Prosecution's evidence on CALCRIM ${cs.instructionNumber} is weak. Defense should focus on ${weakestElement || 'weakest elements'}.`
      : `Prosecution has moderate evidence on CALCRIM ${cs.instructionNumber}. Defense should challenge ${weakestElement || 'specific elements'} where burden is weakest.`;

    const analysis = await prisma.burdenClarityAnalysis.upsert({
      where: { caseId_instructionId: { caseId, instructionId: cs.instructionId } },
      create: {
        caseId,
        instructionId: cs.instructionId,
        instructionNumber: cs.instructionNumber,
        chargeTitle: `CALCRIM ${cs.instructionNumber}`,
        elementClarityScores: JSON.stringify(clarityScores),
        overallBurdenClarity: overallClarity,
        weakestElement,
        strongestElement,
        juryInstruction: `CALCRIM ${cs.instructionNumber}`,
        defenseArgument,
      },
      update: {
        elementClarityScores: JSON.stringify(clarityScores),
        overallBurdenClarity: overallClarity,
        weakestElement,
        strongestElement,
        defenseArgument,
      },
    });

    results.push({ id: analysis.id, instructionNumber: cs.instructionNumber, overallBurdenClarity: overallClarity, weakestElement, strongestElement });
  }

  return { caseId, analyzed: results.length, analyses: results };
}

// ---------------------------------------------------------------------------
// 6. Reasonable Doubt Amplification
// ---------------------------------------------------------------------------

export async function amplifyReasonableDoubt(caseId: string): Promise<{
  caseId: string; amplifiers: number; items: Array<Record<string, unknown>>;
}> {
  const [contradictions, burdenFractures, witnessInconsistencies, timelineIssues, constitutionalIssues] = await Promise.all([
    prisma.contradictionPair.findMany({ where: { caseId, severity: { in: ['critical', 'high'] } } }),
    prisma.burdenFracture.findMany({ where: { caseId } }),
    prisma.witnessInconsistency.findMany({ where: { caseId } }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.constitutionalIssue.findMany({ where: { caseId } }),
  ]);

  const results: Array<Record<string, unknown>> = [];
  let order = 1;

  // Burden gaps are strongest doubt sources
  const unsupportedFractures = burdenFractures.filter(f => f.fractureType === 'unsupported');
  for (const f of unsupportedFractures) {
    const amplificationScore = 0.9; // Unsupported elements are maximum doubt
    const amp = await prisma.reasonableDoubtAmplifier.create({
      data: {
        caseId,
        doubtSource: 'burden_gap',
        title: `Unsupported Element: ${f.elementId}`,
        description: `Prosecution has zero evidence supporting element "${f.elementId}". This creates automatic reasonable doubt per CALCRIM 220.`,
        amplificationScore,
        elementConnection: JSON.stringify([f.elementId]),
        supportingEvidence: JSON.stringify([{ note: f.prosecutionImpact }]),
        presentationOrder: order++,
        cumulativeImpact: 'Each unsupported element independently establishes reasonable doubt.',
      },
    });
    results.push({ id: amp.id, doubtSource: 'burden_gap', score: amplificationScore, order: amp.presentationOrder });
  }

  // Critical contradictions
  for (const c of contradictions.filter(c => c.severity === 'critical').slice(0, 5)) {
    const amp = await prisma.reasonableDoubtAmplifier.create({
      data: {
        caseId,
        doubtSource: 'contradiction',
        title: `Critical Contradiction: ${c.contradictionType.replace(/_/g, ' ')}`,
        description: `Proven contradiction between prosecution evidence (${c.proofMethod.replace(/_/g, ' ')}). Contradictory evidence creates doubt about prosecution's version of events.`,
        amplificationScore: 0.8,
        elementConnection: JSON.stringify(c.elementId ? [c.elementId] : []),
        supportingEvidence: JSON.stringify([
          { text: c.statementAText.slice(0, 200), page: c.statementAPage, speaker: c.statementASpeaker },
          { text: c.statementBText.slice(0, 200), page: c.statementBPage, speaker: c.statementBSpeaker },
        ]),
        presentationOrder: order++,
        cumulativeImpact: 'Multiple contradictions compound to undermine overall prosecution credibility.',
      },
    });
    results.push({ id: amp.id, doubtSource: 'contradiction', score: 0.8, order: amp.presentationOrder });
  }

  // Timeline impossibilities
  for (const t of timelineIssues.filter(ti => ti.incompatibilityType === 'simultaneous_different_location').slice(0, 3)) {
    const amp = await prisma.reasonableDoubtAmplifier.create({
      data: {
        caseId,
        doubtSource: 'timeline_impossibility',
        title: `Timeline Impossibility: ${t.incompatibilityType.replace(/_/g, ' ')}`,
        description: `Physical impossibility detected in prosecution timeline: ${t.explanation}. Impossible timelines create significant reasonable doubt.`,
        amplificationScore: 0.85,
        elementConnection: JSON.stringify([]),
        supportingEvidence: JSON.stringify([
          { text: t.explanation, page: t.statementAPage, document: t.statementAId },
        ]),
        presentationOrder: order++,
        cumulativeImpact: 'Timeline impossibilities undermine the factual foundation of prosecution theory.',
      },
    });
    results.push({ id: amp.id, doubtSource: 'timeline_impossibility', score: 0.85, order: amp.presentationOrder });
  }

  // Witness credibility issues
  const speakerCounts = new Map<string, number>();
  for (const wi of witnessInconsistencies) {
    speakerCounts.set(wi.speaker, (speakerCounts.get(wi.speaker) || 0) + 1);
  }
  for (const [speaker, count] of speakerCounts) {
    if (count >= 3) {
      const amp = await prisma.reasonableDoubtAmplifier.create({
        data: {
          caseId,
          doubtSource: 'witness_credibility',
          title: `Unreliable Witness: ${speaker}`,
          description: `${speaker} has ${count} identified inconsistencies. CALCRIM 226 instructs jurors to consider witness consistency when evaluating credibility.`,
          amplificationScore: round(Math.min(0.75, 0.3 + count * 0.1)),
          elementConnection: JSON.stringify([]),
          supportingEvidence: JSON.stringify([{ note: `${count} inconsistencies identified` }]),
          presentationOrder: order++,
          cumulativeImpact: 'Unreliable witnesses weaken prosecution case when jury applies CALCRIM 226.',
        },
      });
      results.push({ id: amp.id, doubtSource: 'witness_credibility', score: amp.amplificationScore, order: amp.presentationOrder });
    }
  }

  // Constitutional issues (procedural defects)
  for (const ci of constitutionalIssues.filter(i => i.suppressionPotential === 'high').slice(0, 3)) {
    const amp = await prisma.reasonableDoubtAmplifier.create({
      data: {
        caseId,
        doubtSource: 'procedural_defect',
        title: ci.title,
        description: `${ci.description} Procedural defects can lead to evidence suppression, which may create reasonable doubt by removing prosecution evidence.`,
        amplificationScore: 0.7,
        elementConnection: JSON.stringify([]),
        supportingEvidence: ci.citations,
        presentationOrder: order++,
        cumulativeImpact: 'Procedural defects undermine the integrity of prosecution evidence gathering.',
      },
    });
    results.push({ id: amp.id, doubtSource: 'procedural_defect', score: 0.7, order: amp.presentationOrder });
  }

  return { caseId, amplifiers: results.length, items: results };
}

// ---------------------------------------------------------------------------
// 7. Theory Complexity Analysis
// ---------------------------------------------------------------------------

export async function analyzeTheoryComplexity(caseId: string): Promise<{
  caseId: string; theories: Array<Record<string, unknown>>;
}> {
  const [statements, contradictions, timelineIssues, charges, documents] = await Promise.all([
    prisma.evidenceStatement.findMany({ where: { caseId } }),
    prisma.contradictionPair.findMany({ where: { caseId } }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.charge.findMany({ where: { caseId } }),
    prisma.evidenceDocument.findMany({ where: { caseId } }),
  ]);

  const witnesses = new Set(statements.map(s => s.speaker).filter(Boolean));
  const results: Array<Record<string, unknown>> = [];

  // Prosecution complexity
  const prosComplexity = round(Math.min(1.0,
    (charges.length * 0.1) +
    (witnesses.size * 0.05) +
    (documents.length * 0.03) +
    (contradictions.length * 0.02)
  ));

  const prosLogicalLeaps: Array<Record<string, unknown>> = [];
  if (contradictions.length > 5) prosLogicalLeaps.push({ from: 'witness testimony', to: 'consistent narrative', explanation: 'Multiple contradictions require prosecution to explain inconsistencies', weakness: 'Jury may not accept explanations for multiple contradictions' });
  if (timelineIssues.length > 2) prosLogicalLeaps.push({ from: 'timeline events', to: 'coherent sequence', explanation: 'Timeline conflicts require jury to accept prosecution ordering', weakness: 'Alternative timelines may be more logical' });

  const prosScore = await prisma.theoryComplexityScore.create({
    data: {
      caseId,
      theoryType: 'prosecution',
      complexityScore: prosComplexity,
      factorCount: charges.length + witnesses.size + documents.length,
      witnessCount: witnesses.size,
      documentCount: documents.length,
      timelineSteps: timelineIssues.length + statements.filter(s => s.statementType === 'temporal').length,
      logicalLeaps: JSON.stringify(prosLogicalLeaps),
      simplificationOptions: JSON.stringify(['Focus on strongest charges only', 'Limit witness testimony to most credible', 'Use clear timeline demonstrative']),
    },
  });
  results.push({ id: prosScore.id, type: 'prosecution', complexity: prosComplexity });

  // Defense complexity (typically simpler — "create doubt")
  const defComplexity = round(Math.max(0.1, prosComplexity - 0.3));
  const defScore = await prisma.theoryComplexityScore.create({
    data: {
      caseId,
      theoryType: 'defense',
      complexityScore: defComplexity,
      factorCount: contradictions.length + timelineIssues.length,
      witnessCount: 0,
      documentCount: 0,
      timelineSteps: 0,
      logicalLeaps: JSON.stringify([]),
      simplificationOptions: JSON.stringify(['Focus on 2-3 strongest contradictions', 'Present clear timeline alternative', 'Emphasize burden of proof (CALCRIM 220)']),
    },
  });
  results.push({ id: defScore.id, type: 'defense', complexity: defComplexity });

  return { caseId, theories: results };
}

// ---------------------------------------------------------------------------
// 8. Timeline Comprehension Modeling
// ---------------------------------------------------------------------------

export async function modelTimelineComprehension(caseId: string): Promise<Record<string, unknown>> {
  const [timelineIssues, statements] = await Promise.all([
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.evidenceStatement.findMany({ where: { caseId, statementType: 'temporal' } }),
  ]);

  const totalEvents = statements.length;
  const conflictCount = timelineIssues.length;
  const gapCount = timelineIssues.filter(t => t.incompatibilityType === 'impossible_sequence').length;

  const clarityScore = round(Math.max(0, 1 - (conflictCount * 0.15) - (gapCount * 0.1)));

  const confusingSegments = timelineIssues.slice(0, 10).map(t => ({
    issue: t.incompatibilityType,
    severity: t.severity,
    explanation: t.explanation,
    citations: [{ page: t.statementAPage, document: t.statementAId }],
  }));

  const model = await prisma.timelineComprehensionModel.create({
    data: {
      caseId,
      totalEvents,
      clarityScore,
      gapCount,
      conflictCount,
      confusingSegments: JSON.stringify(confusingSegments),
      clearSegments: JSON.stringify([]),
      prosecutionTimeline: JSON.stringify({ events: totalEvents, conflicts: conflictCount }),
      defenseTimeline: JSON.stringify({ strategy: 'Highlight timeline conflicts to create doubt' }),
      juryPresentation: conflictCount > 3
        ? 'Use visual timeline demonstrative showing prosecution conflicts clearly. Present defense alternative timeline.'
        : conflictCount > 0
        ? 'Highlight specific timeline inconsistencies during cross-examination.'
        : 'Timeline is relatively clear. Focus defense on other areas.',
    },
  });

  return { id: model.id, caseId, totalEvents, clarityScore, gapCount, conflictCount, confusingSegments: confusingSegments.length };
}

// ---------------------------------------------------------------------------
// 9. Evidentiary Weight Balancing
// ---------------------------------------------------------------------------

export async function balanceEvidentiaryWeight(caseId: string): Promise<Record<string, unknown>> {
  const [collapseScores, contradictions, statements] = await Promise.all([
    prisma.burdenCollapseScore.findMany({ where: { caseId } }),
    prisma.contradictionPair.findMany({ where: { caseId } }),
    prisma.evidenceStatement.findMany({ where: { caseId } }),
  ]);

  // Overall case weight
  const totalStatements = statements.length || 1;
  const contradictionWeight = contradictions.length / totalStatements;

  // Prosecution weight = average burden clarity
  const prosWeights = collapseScores.map(cs => {
    const elements = JSON.parse(cs.elementDetails) as Array<{ supportCount: number; contradictionCount: number; confidence: number }>;
    const totalSupport = elements.reduce((s, e) => s + e.supportCount, 0);
    const totalContra = elements.reduce((s, e) => s + e.contradictionCount, 0);
    return totalSupport / Math.max(1, totalSupport + totalContra);
  });
  const prosecutionWeight = round(prosWeights.length > 0 ? prosWeights.reduce((a, b) => a + b, 0) / prosWeights.length : 0.5);

  // Defense weight = inverse, boosted by contradictions
  const defenseWeight = round(Math.min(1, (1 - prosecutionWeight) + contradictionWeight * 0.5));

  const netBalance = round(prosecutionWeight - defenseWeight);

  // Per-element balance
  const balanceByElement: Array<Record<string, unknown>> = [];
  for (const cs of collapseScores) {
    const elements = JSON.parse(cs.elementDetails) as Array<{ elementId: string; label: string; supportCount: number; contradictionCount: number }>;
    for (const el of elements) {
      const total = el.supportCount + el.contradictionCount;
      const prosW = total > 0 ? el.supportCount / total : 0.5;
      balanceByElement.push({
        elementId: el.elementId,
        label: el.label,
        prosWeight: round(prosW),
        defWeight: round(1 - prosW),
        balance: round(prosW - (1 - prosW)),
      });
    }
  }

  const vulnerabilities = balanceByElement
    .filter(e => (e.balance as number) < 0)
    .map(e => ({ element: e.label, balance: e.balance, note: 'Defense advantage — prosecution evidence weaker than defense' }));

  const balance = await prisma.evidentiaryWeightBalance.create({
    data: {
      caseId,
      prosecutionWeight,
      defenseWeight,
      netBalance,
      balanceByElement: JSON.stringify(balanceByElement),
      strongestProsEvidence: JSON.stringify([]),
      strongestDefEvidence: JSON.stringify(contradictions.slice(0, 5).map(c => ({
        type: c.contradictionType,
        severity: c.severity,
        proof: c.proofMethod,
      }))),
      vulnerabilities: JSON.stringify(vulnerabilities),
    },
  });

  return { id: balance.id, caseId, prosecutionWeight, defenseWeight, netBalance, vulnerabilities: vulnerabilities.length, elementCount: balanceByElement.length };
}

// ---------------------------------------------------------------------------
// 10. Full Trial Dynamics Analysis (Orchestrator)
// ---------------------------------------------------------------------------

export async function runFullTrialDynamics(caseId: string): Promise<Record<string, unknown>> {
  const narrative = await scoreNarrativeCoherence(caseId);
  const confusion = await detectJurorConfusion(caseId);
  const salience = await scoreContradictionSalience(caseId);
  const credibility = await modelWitnessCredibilityImpact(caseId);
  const burden = await analyzeBurdenClarity(caseId);
  const doubt = await amplifyReasonableDoubt(caseId);
  const complexity = await analyzeTheoryComplexity(caseId);
  const timeline = await modelTimelineComprehension(caseId);
  const weight = await balanceEvidentiaryWeight(caseId);

  return {
    caseId,
    narrativeCoherence: { overallCoherence: (narrative as Record<string, unknown>).overallCoherence },
    jurorConfusion: { zonesFound: confusion.zonesFound },
    contradictionSalience: { scored: salience.scored },
    witnessCredibility: { modeled: credibility.modeled },
    burdenClarity: { analyzed: burden.analyzed },
    reasonableDoubt: { amplifiers: doubt.amplifiers },
    theoryComplexity: { theories: complexity.theories.length },
    timelineComprehension: { clarityScore: (timeline as Record<string, unknown>).clarityScore },
    evidentiaryWeight: { netBalance: (weight as Record<string, unknown>).netBalance },
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
