// ============================================================================
// Phase F.2 — Real-Time Case Intelligence + Live Litigation Monitoring
// Analyzes uploaded/live-authorized litigation materials.
// NEVER operates as a surveillance system.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Real-Time Transcript Ingestion (uploaded-source only)
// ---------------------------------------------------------------------------

export async function processRealTimeTranscript(caseId: string): Promise<{
  caseId: string; eventsCreated: number; events: Array<Record<string, unknown>>;
}> {
  const recentStatements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of recentStatements) {
    const existing = await prisma.realTimeTranscriptEvent.findFirst({
      where: { caseId, content: stmt.rawText.slice(0, 200) },
    });
    if (existing) continue;

    const event = await prisma.realTimeTranscriptEvent.create({
      data: {
        caseId,
        documentId: stmt.documentId,
        eventType: 'statement_extracted',
        sourceType: 'uploaded_document',
        content: stmt.rawText.slice(0, 500),
        speaker: stmt.speaker,
        pageNumber: stmt.page,
        lineNumber: stmt.lineStart,
        processingStatus: 'completed',
        metadata: JSON.stringify({
          statementId: stmt.id,
          statementType: stmt.statementType,
          document: stmt.document?.fileName,
        }),
      },
    });
    results.push({ id: event.id, speaker: stmt.speaker, eventType: 'statement_extracted' });
  }

  return { caseId, eventsCreated: results.length, events: results };
}

// ---------------------------------------------------------------------------
// 2. Live Contradiction Emergence Tracking (deterministic)
// ---------------------------------------------------------------------------

export async function trackLiveContradictionEmergence(caseId: string): Promise<{
  caseId: string; emergencesDetected: number; emergences: Array<Record<string, unknown>>;
}> {
  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const transcriptEvents = await prisma.realTimeTranscriptEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const triggerEventId = transcriptEvents[0]?.id || 'initial_analysis';
  const results: Array<Record<string, unknown>> = [];

  for (const c of contradictions) {
    const existing = await prisma.liveContradictionEmergence.findFirst({
      where: { caseId, contradictionPairId: c.id },
    });
    if (existing) continue;

    const emergence = await prisma.liveContradictionEmergence.create({
      data: {
        caseId,
        contradictionPairId: c.id,
        triggerEventId,
        emergenceType: 'new_contradiction',
        severity: c.severity,
        statementAText: c.statementAText.slice(0, 300),
        statementBText: c.statementBText.slice(0, 300),
        speaker: null,
        citations: JSON.stringify([{
          statementA: c.statementAText.slice(0, 100),
          statementB: c.statementBText.slice(0, 100),
        }]),
      },
    });
    results.push({ id: emergence.id, severity: c.severity, emergenceType: 'new_contradiction' });
  }

  return { caseId, emergencesDetected: results.length, emergences: results };
}

// ---------------------------------------------------------------------------
// 3. Dynamic Burden-Shift Monitoring (CALCRIM-aware)
// ---------------------------------------------------------------------------

export async function monitorDynamicBurdenShifts(caseId: string): Promise<{
  caseId: string; shiftsDetected: number; shifts: Array<Record<string, unknown>>;
}> {
  const burdenCollapses = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId, severity: { in: ['critical', 'high'] } },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const bc of burdenCollapses) {
    let shiftType: string;
    let magnitude: number;

    if (bc.collapseScore >= 0.8) {
      shiftType = 'collapsed';
      magnitude = bc.collapseScore;
    } else if (bc.collapseScore >= 0.5) {
      shiftType = 'weakened';
      magnitude = bc.collapseScore;
    } else if (bc.collapseScore >= 0.3) {
      shiftType = 'strengthened';
      magnitude = 1.0 - bc.collapseScore;
    } else {
      shiftType = 'restored';
      magnitude = 1.0 - bc.collapseScore;
    }

    const relatedContradictions = contradictions.filter(c =>
      c.elementId === bc.instructionId
    );

    const existing = await prisma.dynamicBurdenShift.findFirst({
      where: { caseId, elementId: bc.instructionId, shiftType },
    });
    if (existing) continue;

    const shift = await prisma.dynamicBurdenShift.create({
      data: {
        caseId,
        elementId: bc.instructionId,
        instructionId: bc.instructionId,
        shiftType,
        previousState: 'initial',
        newState: `collapse_score: ${bc.collapseScore.toFixed(2)}`,
        triggerDescription: `${relatedContradictions.length} critical/high contradictions affecting this element. Collapse score: ${bc.collapseScore.toFixed(2)}.`,
        magnitude,
        citations: JSON.stringify([{
          instructionId: bc.instructionId,
          collapseScore: bc.collapseScore,
          contradictionCount: relatedContradictions.length,
        }]),
      },
    });
    results.push({ id: shift.id, elementId: bc.instructionId, shiftType, magnitude });
  }

  return { caseId, shiftsDetected: results.length, shifts: results };
}

// ---------------------------------------------------------------------------
// 4. Active Witness Credibility Updates (citation-backed)
// ---------------------------------------------------------------------------

export async function updateActiveWitnessCredibility(caseId: string): Promise<{
  caseId: string; updatesGenerated: number; updates: Array<Record<string, unknown>>;
}> {
  const credibilityImpacts = await prisma.witnessCredibilityImpact.findMany({ where: { caseId } });
  const inconsistencies = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const ci of credibilityImpacts) {
    const witnessInconsistencies = inconsistencies.filter(i => i.speaker === ci.witnessName);
    const previousScore = 1.0;
    const newScore = Math.max(0, ci.consistencyScore);

    let updateType: string;
    if (newScore < 0.3) updateType = 'impeachment';
    else if (newScore < previousScore - 0.2) updateType = 'credibility_decrease';
    else if (newScore > previousScore) updateType = 'credibility_increase';
    else updateType = 'new_inconsistency';

    const existing = await prisma.activeWitnessCredibilityUpdate.findFirst({
      where: { caseId, witnessName: ci.witnessName, updateType },
    });
    if (existing) continue;

    const update = await prisma.activeWitnessCredibilityUpdate.create({
      data: {
        caseId,
        witnessName: ci.witnessName,
        updateType,
        previousScore,
        newScore,
        triggerDescription: `${witnessInconsistencies.length} inconsistencies detected. Consistency score: ${ci.consistencyScore.toFixed(2)}. Impact if impeached: ${ci.impactIfImpeached}.`,
        citations: JSON.stringify([{
          witness: ci.witnessName,
          consistencyScore: ci.consistencyScore,
          inconsistencies: witnessInconsistencies.length,
        }]),
      },
    });
    results.push({ id: update.id, witnessName: ci.witnessName, updateType, newScore });
  }

  return { caseId, updatesGenerated: results.length, updates: results };
}

// ---------------------------------------------------------------------------
// 5. Real-Time Timeline Updates (evidence-linked)
// ---------------------------------------------------------------------------

export async function trackRealTimeTimelineUpdates(caseId: string): Promise<{
  caseId: string; updatesCreated: number; updates: Array<Record<string, unknown>>;
}> {
  const timelineEntries = await prisma.timelineComprehensionModel.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const te of timelineEntries) {
    let updateType: string;
    if (te.conflictCount > 0) updateType = 'conflict_detected';
    else if (te.gapCount > 0) updateType = 'gap_detected';
    else updateType = 'new_event';

    const existing = await prisma.realTimeTimelineUpdate.findFirst({
      where: { caseId, eventDescription: te.juryPresentation.slice(0, 100) },
    });
    if (existing) continue;

    const update = await prisma.realTimeTimelineUpdate.create({
      data: {
        caseId,
        updateType,
        eventDescription: te.juryPresentation.slice(0, 300),
        newState: JSON.stringify({
          totalEvents: te.totalEvents,
          conflictCount: te.conflictCount,
          gapCount: te.gapCount,
          clarityScore: te.clarityScore,
        }),
        citations: JSON.stringify([{
          totalEvents: te.totalEvents,
          conflicts: te.conflictCount,
          gaps: te.gapCount,
        }]),
      },
    });
    results.push({ id: update.id, updateType, totalEvents: te.totalEvents });
  }

  return { caseId, updatesCreated: results.length, updates: results };
}

// ---------------------------------------------------------------------------
// 6. Live Objection Consequence Tracking (deterministic)
// ---------------------------------------------------------------------------

export async function trackLiveObjectionConsequences(caseId: string): Promise<{
  caseId: string; consequencesTracked: number; consequences: Array<Record<string, unknown>>;
}> {
  const objections = await prisma.objectionHistoryEntry.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const obj of objections) {
    let consequenceType: string;
    if (obj.ruling === 'sustained') {
      consequenceType = 'evidence_excluded';
    } else if (obj.ruling === 'overruled') {
      consequenceType = 'evidence_admitted';
    } else {
      consequenceType = 'limiting_instruction';
    }

    const existing = await prisma.liveObjectionConsequence.findFirst({
      where: { caseId, objectionType: obj.objectionType, ruling: obj.ruling, impactDescription: obj.objectionType },
    });
    if (existing) continue;

    const consequence = await prisma.liveObjectionConsequence.create({
      data: {
        caseId,
        objectionType: obj.objectionType,
        ruling: obj.ruling,
        consequenceType,
        impactDescription: `${obj.objectionType} objection ${obj.ruling}: ${consequenceType.replace(/_/g, ' ')}. ${obj.preservedForAppeal ? 'Preserved for appeal.' : 'Not preserved.'}`,
        affectedEvidenceIds: JSON.stringify([]),
        appellatePreservation: obj.preservedForAppeal,
        citations: JSON.stringify([{
          objectionType: obj.objectionType,
          ruling: obj.ruling,
          evidenceCode: obj.evidenceCodeSection,
        }]),
      },
    });
    results.push({ id: consequence.id, objectionType: obj.objectionType, ruling: obj.ruling, consequenceType });
  }

  return { caseId, consequencesTracked: results.length, consequences: results };
}

// ---------------------------------------------------------------------------
// 7. Ongoing Appellate Preservation Tracking (citation-backed)
// ---------------------------------------------------------------------------

export async function trackOngoingAppellatePreservation(caseId: string): Promise<{
  caseId: string; issuesTracked: number; issues: Array<Record<string, unknown>>;
}> {
  const errorPreservations = await prisma.errorPreservationRecord.findMany({ where: { caseId } });
  const constitutionalClaims = await prisma.constitutionalClaimPreservation.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const ep of errorPreservations) {
    const existing = await prisma.ongoingAppellatePreservation.findFirst({
      where: { caseId, issueType: ep.errorType, issueDescription: ep.errorDescription.slice(0, 100) },
    });
    if (existing) continue;

    const issue = await prisma.ongoingAppellatePreservation.create({
      data: {
        caseId,
        issueType: ep.errorType,
        issueDescription: ep.errorDescription.slice(0, 500),
        preservationStatus: ep.preservationStatus,
        lastAction: ep.preservedBy,
        requiredFollowUp: ep.preservationStatus === 'at_risk' ? 'Renew objection or file written motion to preserve' : null,
        citations: JSON.stringify([{
          errorType: ep.errorType,
          legalBasis: ep.legalBasis,
          trialPhase: ep.trialPhase,
        }]),
      },
    });
    results.push({ id: issue.id, issueType: ep.errorType, preservationStatus: ep.preservationStatus });
  }

  for (const cc of constitutionalClaims) {
    const existing = await prisma.ongoingAppellatePreservation.findFirst({
      where: { caseId, issueType: 'constitutional', issueDescription: cc.claimType.slice(0, 100) },
    });
    if (existing) continue;

    const issue = await prisma.ongoingAppellatePreservation.create({
      data: {
        caseId,
        issueType: 'constitutional',
        issueDescription: `${cc.amendment} Amendment — ${cc.claimType}`,
        preservationStatus: cc.preservationStatus,
        lastAction: cc.preservationMethod || 'filed',
        requiredFollowUp: cc.preservationStatus === 'partially_preserved' ? 'File supplemental motion to fully preserve' : null,
        citations: cc.citations,
      },
    });
    results.push({ id: issue.id, issueType: 'constitutional', amendment: cc.amendment });
  }

  return { caseId, issuesTracked: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 8. Courtroom Event Stream (uploaded-source only)
// ---------------------------------------------------------------------------

export async function buildCourtroomEventStream(caseId: string): Promise<{
  caseId: string; eventsCreated: number; events: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    orderBy: [{ page: 'asc' }, { lineStart: 'asc' }],
    include: { document: true },
  });

  const objections = await prisma.objectionHistoryEntry.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];
  let sequence = 0;

  // Build testimony events from statements
  const speakers = new Set<string>();
  for (const stmt of statements) {
    if (!stmt.speaker || speakers.has(stmt.speaker)) continue;
    speakers.add(stmt.speaker);

    const event = await prisma.courtroomEventStream.create({
      data: {
        caseId,
        eventType: 'testimony_start',
        eventDescription: `${stmt.speaker} testimony begins (${stmt.document?.fileName || 'unknown document'})`,
        speaker: stmt.speaker,
        trialPhase: stmt.statementType === 'testimony' ? 'prosecution_case' : 'pretrial',
        sourceType: 'uploaded_document',
        sequenceNumber: sequence++,
        metadata: JSON.stringify({
          documentId: stmt.documentId,
          page: stmt.page,
          lineStart: stmt.lineStart,
        }),
      },
    });
    results.push({ id: event.id, eventType: 'testimony_start', speaker: stmt.speaker, sequence: event.sequenceNumber });
  }

  // Build objection events
  for (const obj of objections) {
    const event = await prisma.courtroomEventStream.create({
      data: {
        caseId,
        eventType: 'objection',
        eventDescription: `${obj.objectionType} objection — ${obj.ruling}`,
        trialPhase: obj.trialPhase,
        sourceType: 'uploaded_document',
        sequenceNumber: sequence++,
        metadata: JSON.stringify({
          objectionType: obj.objectionType,
          ruling: obj.ruling,
          evidenceCode: obj.evidenceCodeSection,
        }),
      },
    });
    results.push({ id: event.id, eventType: 'objection', sequence: event.sequenceNumber });
  }

  return { caseId, eventsCreated: results.length, events: results };
}

// ---------------------------------------------------------------------------
// 9. Litigation State Snapshots (immutable)
// ---------------------------------------------------------------------------

export async function captureLitigationStateSnapshot(caseId: string): Promise<{
  caseId: string; snapshotId: string; snapshot: Record<string, unknown>;
}> {
  const burdenCollapses = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId } });
  const credibilityImpacts = await prisma.witnessCredibilityImpact.findMany({ where: { caseId } });
  const errorPreservations = await prisma.errorPreservationRecord.findMany({ where: { caseId } });
  const timelineModels = await prisma.timelineComprehensionModel.findMany({ where: { caseId } });

  // Determine litigation phase
  const hasVerdictEvents = await prisma.courtroomEventStream.findFirst({
    where: { caseId, eventType: 'verdict' },
  });
  const litigationPhase = hasVerdictEvents ? 'post_trial' : 'trial';

  const burdenState = JSON.stringify(burdenCollapses.map(bc => ({
    instructionId: bc.instructionId,
    collapseScore: bc.collapseScore,
  })));

  const contradictionState = JSON.stringify({
    total: contradictions.length,
    critical: contradictions.filter(c => c.severity === 'critical').length,
    high: contradictions.filter(c => c.severity === 'high').length,
    medium: contradictions.filter(c => c.severity === 'medium').length,
    low: contradictions.filter(c => c.severity === 'low').length,
  });

  const witnessCredibility = JSON.stringify(credibilityImpacts.map(ci => ({
    witness: ci.witnessName,
    consistencyScore: ci.consistencyScore,
    impactIfImpeached: ci.impactIfImpeached,
  })));

  const appellateState = JSON.stringify({
    totalPreserved: errorPreservations.filter(ep => ep.preservationStatus === 'preserved').length,
    totalForfeited: errorPreservations.filter(ep => ep.preservationStatus === 'forfeited').length,
    totalAtRisk: errorPreservations.filter(ep => ep.preservationStatus === 'at_risk' || ep.preservationStatus === 'partially_preserved').length,
  });

  const timelineState = JSON.stringify(timelineModels.map(tm => ({
    totalEvents: tm.totalEvents,
    conflictCount: tm.conflictCount,
    gapCount: tm.gapCount,
    clarityScore: tm.clarityScore,
  })));

  const snapshot = await prisma.litigationStateSnapshot.create({
    data: {
      caseId,
      snapshotType: 'event_triggered',
      litigationPhase,
      burdenState,
      contradictionState,
      witnessCredibility,
      appellateState,
      timelineState,
      metadata: JSON.stringify({ capturedAt: new Date().toISOString(), totalBurdenElements: burdenCollapses.length }),
    },
  });

  return {
    caseId,
    snapshotId: snapshot.id,
    snapshot: {
      id: snapshot.id,
      litigationPhase,
      burdenElements: burdenCollapses.length,
      contradictions: contradictions.length,
      witnessesTracked: credibilityImpacts.length,
      preservedErrors: errorPreservations.filter(ep => ep.preservationStatus === 'preserved').length,
    },
  };
}

// ---------------------------------------------------------------------------
// 10. Full Live Litigation Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullLiveLitigationAnalysis(caseId: string): Promise<Record<string, unknown>> {
  const transcript = await processRealTimeTranscript(caseId);
  const contradictions = await trackLiveContradictionEmergence(caseId);
  const burdenShifts = await monitorDynamicBurdenShifts(caseId);
  const credibility = await updateActiveWitnessCredibility(caseId);
  const timeline = await trackRealTimeTimelineUpdates(caseId);
  const objections = await trackLiveObjectionConsequences(caseId);
  const appellate = await trackOngoingAppellatePreservation(caseId);
  const events = await buildCourtroomEventStream(caseId);
  const snapshot = await captureLitigationStateSnapshot(caseId);

  return {
    caseId,
    summary: {
      transcriptEvents: transcript.eventsCreated,
      liveContradictions: contradictions.emergencesDetected,
      burdenShifts: burdenShifts.shiftsDetected,
      credibilityUpdates: credibility.updatesGenerated,
      timelineUpdates: timeline.updatesCreated,
      objectionConsequences: objections.consequencesTracked,
      appellatePreservation: appellate.issuesTracked,
      courtroomEvents: events.eventsCreated,
      snapshotId: snapshot.snapshotId,
    },
    principle: 'CourtAccess analyzes uploaded/live-authorized litigation materials. It does NOT operate as a surveillance system.',
  };
}
