// ============================================================================
// Phase 4 — Narrative Deconstruction Service
// Orchestrates the full narrative deconstruction pipeline:
//   1. Fetch narrative-relevant evidence for a case
//   2. Extract text from evidence via R2 content retrieval
//   3. Extract atomic factual claims from text
//   4. Normalize claims into structured ontology events
//   5. Validate claims against available evidence
//   6. Detect impeachment candidates from contradicted claims
//   7. Build narrative graph integration
//
// Safety: Enforces 5-minute pipeline timeout, 100 evidence cap,
// and per-evidence extraction timeouts (delegated to extractEvidenceText).
// ============================================================================

import prisma from '../lib/prisma.js';
import { extractEvidenceText } from '../services/evidenceTextExtractionService.js';
import { normalizeDocumentText } from '../services/documentNormalizationService.js';
import { extractClaims } from './claimExtractionWorker.js';
import { processClaimNormalization } from './claimNormalizationWorker.js';
import { processEvidenceValidation } from './evidenceValidationWorker.js';
import { processImpeachmentAnalysis } from './impeachmentDetectionWorker.js';
import { buildNarrativeGraph } from './narrativeGraphIntegration.js';

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface NarrativeDeconstructionResult {
  caseId: string;
  tenantId: string;
  /** Total evidence documents processed */
  evidenceProcessed: number;
  /** Total atomic claims extracted */
  claimsExtracted: number;
  /** Total claims normalized into structured events */
  claimsNormalized: number;
  /** Total claim validations created */
  validationsCreated: number;
  /** Number of contradicted claims */
  contradictions: number;
  /** Impeachment candidates generated */
  impeachmentCandidates: number;
  /** High-severity impeachment candidates */
  highSeverity: number;
  /** Processing duration in ms */
  durationMs: number;
  /** Non-fatal errors encountered during processing */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Safety Limits
// ---------------------------------------------------------------------------

/** Maximum total pipeline duration (5 minutes) */
const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;

/** Maximum number of evidence items to process per pipeline run */
const MAX_EVIDENCE_PER_RUN = 100;

/** Evidence types relevant to narrative deconstruction */
const NARRATIVE_EVIDENCE_TYPES = [
  'police_report',
  'probable_cause',
  'arrest_affidavit',
  'supplemental_report',
  'incident_report',
  'other_document',
  'forensic_report',
  'transcript',
  'dispatch_log',
];

// ---------------------------------------------------------------------------
// Core Reconstruction Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full narrative deconstruction pipeline for a case.
 * Called by NarrativeProcessingWorker when a narrative analysis job runs.
 *
 * Pipeline:
 *   1. Fetch narrative-relevant evidence
 *   2. For each: R2 retrieval → text extraction → document normalization → claim extraction
 *   3. Normalize all claims into structured events
 *   4. Validate claims against evidence sources
 *   5. Detect impeachment candidates from contradictions
 *   6. Return results (graph integration available via separate API)
 */
export async function deconstructNarrative(
  caseId: string,
  tenantId: string,
): Promise<NarrativeDeconstructionResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Fetch narrative-relevant evidence for the case
  // -------------------------------------------------------------------------
  console.info('[NarrativeDeconstruction] Starting pipeline', { caseId, tenantId });

  const evidence = await prisma.evidence.findMany({
    where: {
      caseId,
      tenantId,
      evidenceType: { in: NARRATIVE_EVIDENCE_TYPES },
    },
    select: {
      evidenceId: true,
      evidenceType: true,
      fileName: true,
      mimeType: true,
      s3Key: true,
    },
  });

  console.info('[NarrativeDeconstruction] Evidence fetched', {
    caseId,
    evidenceCount: evidence.length,
  });

  if (evidence.length === 0) {
    return {
      caseId,
      tenantId,
      evidenceProcessed: 0,
      claimsExtracted: 0,
      claimsNormalized: 0,
      validationsCreated: 0,
      contradictions: 0,
      impeachmentCandidates: 0,
      highSeverity: 0,
      durationMs: Date.now() - startTime,
      warnings: ['No narrative-relevant evidence found for this case'],
    };
  }

  // Enforce evidence cap
  const evidenceToProcess = evidence.slice(0, MAX_EVIDENCE_PER_RUN);
  if (evidence.length > MAX_EVIDENCE_PER_RUN) {
    warnings.push(
      `Evidence capped at ${MAX_EVIDENCE_PER_RUN} items (${evidence.length} total). ` +
      `Remaining evidence will be processed on next pipeline run.`,
    );
  }

  // Pipeline-level timeout
  const pipelineDeadline = startTime + PIPELINE_TIMEOUT_MS;

  // -------------------------------------------------------------------------
  // Step 2: Extract text and claims from each evidence item
  // -------------------------------------------------------------------------
  let totalClaimsExtracted = 0;
  let evidenceActuallyProcessed = 0;

  for (const ev of evidenceToProcess) {
    // Check pipeline timeout before each evidence item
    if (Date.now() >= pipelineDeadline) {
      warnings.push(
        `Pipeline timeout reached (${PIPELINE_TIMEOUT_MS / 1000}s). ` +
        `Skipping remaining evidence items.`,
      );
      console.warn('[NarrativeDeconstruction] Pipeline timeout reached', {
        caseId,
        elapsedMs: Date.now() - startTime,
      });
      break;
    }

    try {
      // Step 2a: Retrieve and extract text from R2
      const extraction = await extractEvidenceText({
        evidenceId: ev.evidenceId,
        fileName: ev.fileName,
        mimeType: ev.mimeType,
        s3Key: ev.s3Key,
        evidenceType: ev.evidenceType,
      });

      if (!extraction.text) {
        if (extraction.error) {
          warnings.push(`Skipped evidence ${ev.evidenceId} (${ev.fileName}): ${extraction.error}`);
        }
        continue;
      }

      // Step 2b: Normalize document text
      const normalizedText = normalizeDocumentText(extraction.text);

      console.info('[NarrativeDeconstruction] Text extracted', {
        evidenceId: ev.evidenceId,
        method: extraction.method,
        rawChars: extraction.charCount,
        normalizedChars: normalizedText.length,
      });

      // Step 2c: Clean up previous claims and associated records for this
      // evidence to ensure no orphaned data on rebuild.
      const oldClaimIds = (
        await prisma.narrativeClaim.findMany({
          where: { caseId, evidenceId: ev.evidenceId },
          select: { claimId: true },
        })
      ).map((c) => c.claimId);

      if (oldClaimIds.length > 0) {
        // Delete dependent records first (no cascade in schema)
        await Promise.all([
          prisma.claimValidation.deleteMany({ where: { claimId: { in: oldClaimIds } } }),
          prisma.normalizedClaimEvent.deleteMany({ where: { claimId: { in: oldClaimIds } } }),
          prisma.impeachmentCandidate.deleteMany({ where: { claimId: { in: oldClaimIds } } }),
        ]);
        await prisma.narrativeClaim.deleteMany({
          where: { caseId, evidenceId: ev.evidenceId },
        });
      }

      // Step 2d: Extract atomic factual claims from the normalized text
      const claims = extractClaims(normalizedText, ev.evidenceType);

      if (claims.length > 0) {
        // Store claims in NarrativeClaim table
        await prisma.narrativeClaim.createMany({
          data: claims.map((claim) => ({
            caseId,
            tenantId,
            evidenceId: ev.evidenceId,
            claimText: claim.claimText,
            subject: claim.subject,
            action: claim.action,
            object: claim.object,
            target: claim.target,
            timestampReference: claim.timestampReference,
            confidence: claim.confidence,
            sentenceIndex: claim.sentenceIndex,
          })),
        });

        totalClaimsExtracted += claims.length;

        console.info('[NarrativeDeconstruction] Claims extracted', {
          evidenceId: ev.evidenceId,
          claimsCount: claims.length,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Claim extraction failed for evidence ${ev.evidenceId}: ${msg}`);
      console.warn('[NarrativeDeconstruction] Evidence processing failed', {
        evidenceId: ev.evidenceId,
        error: msg,
      });
    } finally {
      // Count each evidence item we attempted to process (even if skipped/errored)
      evidenceActuallyProcessed++;
    }
  }

  console.info('[NarrativeDeconstruction] Stage 1 complete: claim extraction', {
    caseId,
    evidenceProcessed: evidenceActuallyProcessed,
    claimsExtracted: totalClaimsExtracted,
  });

  // Cleanup: remove orphaned dependent records from prior runs.
  // (Schema has no cascade relations; reruns can leave stale rows behind.)
  try {
    const currentClaimIds = (
      await prisma.narrativeClaim.findMany({
        where: { caseId, tenantId },
        select: { claimId: true },
      })
    ).map((c) => c.claimId);

    if (currentClaimIds.length === 0) {
      await Promise.all([
        prisma.claimValidation.deleteMany({ where: { caseId, tenantId } }),
        prisma.normalizedClaimEvent.deleteMany({ where: { caseId, tenantId } }),
        prisma.impeachmentCandidate.deleteMany({ where: { caseId, tenantId } }),
      ]);
    } else {
      await Promise.all([
        prisma.claimValidation.deleteMany({
          where: { caseId, tenantId, claimId: { notIn: currentClaimIds } },
        }),
        prisma.normalizedClaimEvent.deleteMany({
          where: { caseId, tenantId, claimId: { notIn: currentClaimIds } },
        }),
        prisma.impeachmentCandidate.deleteMany({
          where: { caseId, tenantId, claimId: { notIn: currentClaimIds } },
        }),
      ]);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Orphan cleanup failed: ${msg}`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Normalize claims into structured ontology events
  // -------------------------------------------------------------------------
  let claimsNormalized = 0;

  if (totalClaimsExtracted > 0 && Date.now() < pipelineDeadline) {
    try {
      const normResult = await processClaimNormalization(
        {
          caseId,
          tenantId,
          triggerEvidenceId: 'pipeline',
        },
        { enqueueDownstream: false },
      );
      claimsNormalized = normResult.eventsNormalized;

      console.info('[NarrativeDeconstruction] Stage 2 complete: normalization', {
        caseId,
        eventsNormalized: claimsNormalized,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Claim normalization failed: ${msg}`);
      console.warn('[NarrativeDeconstruction] Normalization failed', { caseId, error: msg });
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Validate claims against evidence sources
  // -------------------------------------------------------------------------
  let validationsCreated = 0;
  let contradictions = 0;

  if (totalClaimsExtracted > 0 && Date.now() < pipelineDeadline) {
    try {
      const valResult = await processEvidenceValidation(
        {
          caseId,
          tenantId,
        },
        { enqueueDownstream: false },
      );
      validationsCreated = valResult.validationsCreated;
      // `valResult.contradictions` only counts newly created validations in this run.
      // We want the total number of contradicted validations for this case/tenant.
      contradictions = await prisma.claimValidation.count({
        where: { caseId, tenantId, status: 'contradicted' },
      });

      console.info('[NarrativeDeconstruction] Stage 3 complete: validation', {
        caseId,
        validationsCreated,
        contradictions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Evidence validation failed: ${msg}`);
      console.warn('[NarrativeDeconstruction] Validation failed', { caseId, error: msg });
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Detect impeachment candidates from contradictions
  // -------------------------------------------------------------------------
  let impeachmentCandidates = 0;
  let highSeverity = 0;

  if (contradictions > 0 && Date.now() < pipelineDeadline) {
    try {
      const impResult = await processImpeachmentAnalysis({
        caseId,
        tenantId,
        rebuild: true,
      });
      impeachmentCandidates = impResult.impeachmentCandidates;
      highSeverity = impResult.highSeverity;

      console.info('[NarrativeDeconstruction] Stage 4 complete: impeachment detection', {
        caseId,
        impeachmentCandidates,
        highSeverity,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Impeachment analysis failed: ${msg}`);
      console.warn('[NarrativeDeconstruction] Impeachment analysis failed', { caseId, error: msg });
    }
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------
  const durationMs = Date.now() - startTime;

  console.info('[NarrativeDeconstruction] Pipeline complete', {
    caseId,
    evidenceProcessed: evidenceActuallyProcessed,
    claimsExtracted: totalClaimsExtracted,
    claimsNormalized,
    validationsCreated,
    contradictions,
    impeachmentCandidates,
    highSeverity,
    durationMs,
    warningCount: warnings.length,
  });

  return {
    caseId,
    tenantId,
    evidenceProcessed: evidenceActuallyProcessed,
    claimsExtracted: totalClaimsExtracted,
    claimsNormalized,
    validationsCreated,
    contradictions,
    impeachmentCandidates,
    highSeverity,
    durationMs,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Query Functions (used by API routes)
// ---------------------------------------------------------------------------

/**
 * Get all narrative claims for a case with optional graph data.
 */
export async function getNarrativeClaims(
  caseId: string,
  tenantId: string,
  options?: { limit?: number; offset?: number },
) {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const [claims, total] = await Promise.all([
    prisma.narrativeClaim.findMany({
      where: { caseId, tenantId },
      orderBy: { confidence: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.narrativeClaim.count({
      where: { caseId, tenantId },
    }),
  ]);

  // Build graph data for the claims
  const validations = await prisma.claimValidation.findMany({
    where: { caseId, tenantId },
  });
  const validationMap = new Map(validations.map((v) => [v.claimId, v]));

  const claimsWithValidation = claims.map((claim) => {
    const validation = validationMap.get(claim.claimId);
    return {
      ...claim,
      validationStatus: validation?.status ?? 'pending',
      supportingEvidenceIds: validation?.supportingEvidenceIds ?? [],
      contradictingEvidenceIds: validation?.contradictingEvidenceIds ?? [],
      validationConfidence: validation?.confidence ?? null,
      validationReasoning: validation?.reasoning ?? null,
    };
  });

  // Build narrative graph
  const graph = buildNarrativeGraph({
    caseId,
    claims: claimsWithValidation.map((c) => ({
      claimId: c.claimId,
      claimText: c.claimText,
      subject: c.subject,
      action: c.action,
      confidence: c.confidence,
      evidenceId: c.evidenceId,
      validationStatus: c.validationStatus,
      supportingEvidenceIds: Array.isArray(c.supportingEvidenceIds)
        ? (c.supportingEvidenceIds as string[])
        : [],
      contradictingEvidenceIds: Array.isArray(c.contradictingEvidenceIds)
        ? (c.contradictingEvidenceIds as string[])
        : [],
    })),
  });

  // Back-compat: previous stub used `graph.edges`; new graph uses `relationships`.
  const graphCompat = {
    nodes: graph.nodes,
    edges: graph.relationships,
    relationships: graph.relationships,
  };

  return {
    claims: claimsWithValidation,
    total,
    limit,
    offset,
    graph: graphCompat,
  };
}

/**
 * Get contradicted claims for a case.
 */
export async function getNarrativeContradictions(
  caseId: string,
  tenantId: string,
) {
  const contradictions = await prisma.claimValidation.findMany({
    where: { caseId, tenantId, status: 'contradicted' },
    orderBy: { confidence: 'desc' },
  });

  // Enrich with claim text
  const claimIds = contradictions.map((c) => c.claimId);
  const claims = await prisma.narrativeClaim.findMany({
    where: { claimId: { in: claimIds } },
  });
  const claimMap = new Map(claims.map((c) => [c.claimId, c]));

  return {
    contradictions: contradictions.map((v) => {
      const claim = claimMap.get(v.claimId);
      return {
        ...v,
        claimText: claim?.claimText ?? null,
        subject: claim?.subject ?? null,
        action: claim?.action ?? null,
      };
    }),
    count: contradictions.length,
  };
}

/**
 * Get impeachment candidates for a case.
 */
export async function getNarrativeImpeachment(
  caseId: string,
  tenantId: string,
) {
  const candidates = await prisma.impeachmentCandidate.findMany({
    where: { caseId, tenantId },
  });

  // Sort by severity (high → medium → low) then by confidence descending
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  candidates.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    return sevDiff !== 0 ? sevDiff : b.confidence - a.confidence;
  });

  const severityCounts = { high: 0, medium: 0, low: 0 };
  for (const c of candidates) {
    if (c.severity === 'high') severityCounts.high++;
    else if (c.severity === 'medium') severityCounts.medium++;
    else severityCounts.low++;
  }

  return {
    candidates,
    total: candidates.length,
    severityCounts,
  };
}
