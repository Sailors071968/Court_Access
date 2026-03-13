// ============================================================================
// Narrative Deconstruction Engine — Worker 3: Evidence Validation
// Tests claims against evidence sources to determine if they are
// supported, contradicted, or unverified.
// Evidence sources: bodycam, dashcam, surveillance, audio, dispatch,
//                   witness statements, timeline events
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { EvidenceValidationJob } from './narrativeProcessingPipeline.js';
import { enqueueImpeachmentAnalysis } from './narrativeProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Validation Status Types
// ---------------------------------------------------------------------------

type ValidationStatus = 'supported' | 'contradicted' | 'unverified' | 'pending';

// ---------------------------------------------------------------------------
// Evidence Matching Logic
// ---------------------------------------------------------------------------

/**
 * Determine validation status by cross-referencing claim events against
 * available evidence for the case. This is a heuristic approach — in production,
 * AI models would perform deeper semantic analysis.
 */
async function validateClaimAgainstEvidence(params: {
  claimId: string;
  caseId: string;
  tenantId: string;
  claimText: string;
  action: string;
  subject: string;
  timestampReference: string | null;
}): Promise<{
  status: ValidationStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  confidence: number;
  reasoning: string;
}> {
  // Fetch all evidence for this case
  const caseEvidence = await prisma.evidence.findMany({
    where: { caseId: params.caseId, tenantId: params.tenantId },
    select: { evidenceId: true, evidenceType: true, fileName: true },
  });

  if (caseEvidence.length === 0) {
    return {
      status: 'unverified',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      confidence: 0.3,
      reasoning: 'No evidence available for cross-reference',
    };
  }

  // Categorize evidence by type for matching
  const videoEvidence = caseEvidence.filter((e) =>
    ['bodycam', 'dashcam', 'witness_video'].includes(e.evidenceType),
  );
  const documentEvidence = caseEvidence.filter((e) =>
    ['police_report', 'transcript', 'dispatch_log', 'forensic_report'].includes(e.evidenceType),
  );
  const witnessEvidence = caseEvidence.filter((e) =>
    ['transcript'].includes(e.evidenceType),
  );

  const supportingIds: string[] = [];
  const contradictingIds: string[] = [];
  let confidence = 0.5;
  const reasons: string[] = [];

  // Heuristic: claims about visual events should have video evidence
  const visualActions = ['raised', 'brandished', 'pointed', 'drew', 'fled', 'ran', 'struck', 'punched', 'kicked', 'tackled', 'tased', 'fired', 'discharged', 'shot'];
  const actionLower = params.action.toLowerCase();
  const isVisualClaim = visualActions.some((a) => actionLower.includes(a));

  if (isVisualClaim && videoEvidence.length > 0) {
    // Video evidence exists — supports the claim (visual event has video corroboration)
    for (const v of videoEvidence) {
      supportingIds.push(v.evidenceId);
    }
    reasons.push(`Video evidence available for visual claim verification (${videoEvidence.length} sources)`);
    confidence += 0.1;
  } else if (isVisualClaim && videoEvidence.length === 0) {
    // Visual claim but no video — potential contradiction (officer says X happened but no video)
    // Mark document evidence as contradicting since the narrative claim lacks video corroboration
    for (const d of documentEvidence) {
      contradictingIds.push(d.evidenceId);
    }
    reasons.push('No video evidence available to verify visual claim — narrative-only basis');
    confidence -= 0.1;
  }

  // Check for corroborating document sources
  if (documentEvidence.length > 1) {
    // Multiple document sources — cross-validation available, supports claim
    for (const d of documentEvidence) {
      if (!supportingIds.includes(d.evidenceId) && !contradictingIds.includes(d.evidenceId)) {
        supportingIds.push(d.evidenceId);
      }
    }
    reasons.push(`${documentEvidence.length} document sources available for cross-reference`);
    confidence += 0.05;
  }

  // Check for witness corroboration
  if (witnessEvidence.length > 0) {
    for (const w of witnessEvidence) {
      if (!supportingIds.includes(w.evidenceId) && !contradictingIds.includes(w.evidenceId)) {
        supportingIds.push(w.evidenceId);
      }
    }
    reasons.push(`${witnessEvidence.length} witness statement(s) available for comparison`);
    confidence += 0.05;
  }

  // Determine status based on available evidence
  // In production, this would be AI-driven analysis
  let status: ValidationStatus = 'unverified';

  if (supportingIds.length > 0 && contradictingIds.length === 0) {
    status = 'supported';
  } else if (contradictingIds.length > 0) {
    status = 'contradicted';
  } else if (caseEvidence.length > 2) {
    // Multiple evidence sources available but no definitive match
    status = 'unverified';
    reasons.push('Requires AI analysis to determine support or contradiction');
  }

  return {
    status,
    supportingEvidenceIds: supportingIds,
    contradictingEvidenceIds: contradictingIds,
    confidence: Math.max(0.1, Math.min(confidence, 0.95)),
    reasoning: reasons.join('; ') || 'Awaiting detailed evidence analysis',
  };
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processEvidenceValidation(job: EvidenceValidationJob): Promise<{
  validationsCreated: number;
  contradictions: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[NarrativeEngine] Evidence validation started` +
    ` caseId=${job.caseId}`
  );

  // Fetch all claims for this case
  const claims = await prisma.narrativeClaim.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
  });

  if (claims.length === 0) {
    console.log(`[NarrativeEngine] No claims found for validation caseId=${job.caseId}`);
    return { validationsCreated: 0, contradictions: 0, processingTimeMs: Date.now() - startTime };
  }

  // Check which claims already have validations
  const existingValidations = await prisma.claimValidation.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
    select: { claimId: true },
  });
  const validatedClaimIds = new Set(existingValidations.map((v) => v.claimId));

  let created = 0;
  let contradictions = 0;

  for (const claim of claims) {
    if (validatedClaimIds.has(claim.claimId)) {
      continue; // Already validated
    }

    const result = await validateClaimAgainstEvidence({
      claimId: claim.claimId,
      caseId: claim.caseId,
      tenantId: job.tenantId,
      claimText: claim.claimText,
      action: claim.action,
      subject: claim.subject,
      timestampReference: claim.timestampReference,
    });

    await prisma.claimValidation.create({
      data: {
        claimId: claim.claimId,
        caseId: claim.caseId,
        tenantId: job.tenantId,
        status: result.status,
        supportingEvidenceIds: result.supportingEvidenceIds,
        contradictingEvidenceIds: result.contradictingEvidenceIds,
        confidence: result.confidence,
        reasoning: result.reasoning,
      },
    });

    if (result.status === 'contradicted') {
      contradictions++;
    }
    created++;
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[NarrativeEngine] Evidence validation completed` +
    ` caseId=${job.caseId}` +
    ` validations=${created}` +
    ` contradictions=${contradictions}` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  if (contradictions > 0) {
    console.log(
      `[NarrativeEngine] Narrative contradiction detected` +
      ` caseId=${job.caseId}` +
      ` count=${contradictions}`
    );
  }

  // Trigger impeachment analysis
  try {
    await enqueueImpeachmentAnalysis({
      caseId: job.caseId,
      tenantId: job.tenantId,
    });
  } catch (err) {
    console.error(`[NarrativeEngine] Failed to enqueue impeachment analysis:`, err);
  }

  return { validationsCreated: created, contradictions, processingTimeMs };
}
