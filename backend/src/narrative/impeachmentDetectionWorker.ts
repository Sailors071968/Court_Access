// ============================================================================
// Narrative Deconstruction Engine — Worker 4: Impeachment Detection
// Detects claims contradicted by evidence and generates impeachment
// candidates with suggested cross-examination questions.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { ImpeachmentAnalysisJob } from './narrativeProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Impeachment Question Templates
// ---------------------------------------------------------------------------

const QUESTION_TEMPLATES: Record<string, string[]> = {
  WeaponRaised: [
    'You stated that the {subject} raised a weapon. Can you describe exactly what you observed?',
    'The bodycam footage from that time does not show any weapon being raised. How do you explain this discrepancy?',
    'At what exact time did you observe the weapon being raised?',
  ],
  WeaponPointed: [
    'You wrote that the {subject} pointed a weapon at {target}. Where exactly were you positioned when you observed this?',
    'Video evidence appears to show the {subject} facing away from {target} at that time. Can you explain?',
  ],
  SubjectFled: [
    'Your report states the {subject} fled on foot. Video evidence shows the {subject} was stationary. How do you reconcile this?',
    'At what point during the encounter did the {subject} begin to flee?',
  ],
  ForceUsed: [
    'You described using force against the {subject}. What specific resistance did the {subject} display that necessitated this force?',
    'Evidence suggests the {subject} was compliant at the time force was used. Can you explain why force was necessary?',
  ],
  OfficerArrival: [
    'Your report indicates you arrived at {time}. Dispatch records show a different arrival time. Which is correct?',
    'The timeline of events you described does not match the CAD log timestamps. Can you explain this difference?',
  ],
  Observation: [
    'You stated that you observed {action}. From your position, was it physically possible to see this?',
    'Other witnesses at the scene did not report seeing what you described. Why might that be?',
  ],
  VerbalCommand: [
    'You stated you gave verbal commands. The audio recording does not capture any commands at that time. Can you explain?',
    'Witnesses report that no verbal warnings were given. How do you respond to that?',
  ],
  Search: [
    'You indicated a search was conducted. What was the legal basis for this search?',
    'The evidence found during the search — where exactly was it located?',
  ],
  TaserDeployed: [
    'Your report states the taser was deployed because the {subject} was actively resisting. Video evidence shows the {subject} on the ground. Can you clarify?',
    'How many times was the taser deployed, and what was the {subject} doing each time?',
  ],
};

// ---------------------------------------------------------------------------
// Severity Classification
// ---------------------------------------------------------------------------

function classifySeverity(params: {
  validationStatus: string;
  confidence: number;
  contradictingCount: number;
}): 'high' | 'medium' | 'low' {
  if (params.validationStatus === 'contradicted' && params.confidence >= 0.7) {
    return 'high';
  }
  if (params.validationStatus === 'contradicted' && params.contradictingCount >= 2) {
    return 'high';
  }
  if (params.validationStatus === 'contradicted') {
    return 'medium';
  }
  return 'low';
}

// ---------------------------------------------------------------------------
// Question Generation
// ---------------------------------------------------------------------------

function generateImpeachmentQuestion(params: {
  eventType: string;
  subject: string;
  target: string | null;
  action: string;
  timestampReference: string | null;
}): string {
  const templates = QUESTION_TEMPLATES[params.eventType] || QUESTION_TEMPLATES.Observation || [];
  if (templates.length === 0) {
    return `Regarding your claim that ${params.subject} ${params.action.toLowerCase()} — evidence contradicts this account. Can you explain?`;
  }

  // Pick the most relevant template
  let question = templates[0];
  question = question.replace(/{subject}/g, params.subject);
  question = question.replace(/{target}/g, params.target || 'the individual');
  question = question.replace(/{action}/g, params.action.toLowerCase());
  question = question.replace(/{time}/g, params.timestampReference || 'the time in question');

  return question;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processImpeachmentAnalysis(job: ImpeachmentAnalysisJob): Promise<{
  impeachmentCandidates: number;
  highSeverity: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[NarrativeEngine] Impeachment analysis started` +
    ` caseId=${job.caseId}` +
    ` rebuild=${job.rebuild ?? false}`
  );

  // If rebuild requested, clear existing impeachment candidates
  if (job.rebuild) {
    await prisma.impeachmentCandidate.deleteMany({
      where: { caseId: job.caseId, tenantId: job.tenantId },
    });
  }

  // Fetch all validations that show contradictions
  const contradictedValidations = await prisma.claimValidation.findMany({
    where: {
      caseId: job.caseId,
      tenantId: job.tenantId,
      status: 'contradicted',
    },
  });

  if (contradictedValidations.length === 0) {
    console.log(`[NarrativeEngine] No contradictions found for impeachment caseId=${job.caseId}`);
    return { impeachmentCandidates: 0, highSeverity: 0, processingTimeMs: Date.now() - startTime };
  }

  // Check existing impeachment candidates
  const existingCandidates = await prisma.impeachmentCandidate.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
    select: { claimId: true },
  });
  const existingClaimIds = new Set(existingCandidates.map((c) => c.claimId));

  let created = 0;
  let highSeverity = 0;

  for (const validation of contradictedValidations) {
    if (existingClaimIds.has(validation.claimId)) {
      continue; // Already has impeachment candidate
    }

    // Fetch the original claim
    const claim = await prisma.narrativeClaim.findUnique({
      where: { claimId: validation.claimId },
    });

    if (!claim) continue;

    // Fetch the normalized event for context
    const normalizedEvent = await prisma.normalizedClaimEvent.findFirst({
      where: { claimId: validation.claimId },
    });

    const contradictingIds = validation.contradictingEvidenceIds as string[];
    const severity = classifySeverity({
      validationStatus: validation.status,
      confidence: validation.confidence,
      contradictingCount: contradictingIds.length,
    });

    if (severity === 'high') highSeverity++;

    // Generate suggested impeachment question
    const suggestedQuestion = generateImpeachmentQuestion({
      eventType: normalizedEvent?.eventType || 'Observation',
      subject: claim.subject,
      target: claim.target,
      action: claim.action,
      timestampReference: claim.timestampReference,
    });

    // Build contradicting evidence description
    let contradictingEvidence = validation.reasoning || 'Evidence contradicts this claim';
    if (contradictingIds.length > 0) {
      const evidenceRecords = await prisma.evidence.findMany({
        where: { evidenceId: { in: contradictingIds } },
        select: { fileName: true, evidenceType: true },
      });
      if (evidenceRecords.length > 0) {
        contradictingEvidence = evidenceRecords
          .map((e) => `${e.evidenceType}: ${e.fileName}`)
          .join(', ');
      }
    }

    await prisma.impeachmentCandidate.create({
      data: {
        claimId: claim.claimId,
        caseId: job.caseId,
        tenantId: job.tenantId,
        severity,
        contradictionType: normalizedEvent?.eventType || 'general',
        claimText: claim.claimText,
        contradictingEvidence,
        suggestedQuestion,
        confidence: validation.confidence,
      },
    });

    created++;
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[NarrativeEngine] Impeachment analysis completed` +
    ` caseId=${job.caseId}` +
    ` candidates=${created}` +
    ` highSeverity=${highSeverity}` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  return { impeachmentCandidates: created, highSeverity, processingTimeMs };
}
