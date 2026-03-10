// ============================================================================
// Phase 135 — Policy Compliance Analysis Engine
// Phase 136 — Evidence Linking
// Phase 137 — Investigator Review Layer
// Phase 145 — AI Explanation Engine
// Phase 146 — Confidence Scoring
// Phase 150 — Safety Guardrails
//
// Evaluates detected events against policy rules, generates findings with
// evidence links, queues for human review, and applies safety guardrails.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Safety Guardrails (Phase 150)
// ---------------------------------------------------------------------------

const FORBIDDEN_LANGUAGE = [
  'policy violation occurred',
  'officer violated',
  'illegal conduct',
  'committed a violation',
  'broke the law',
  'guilty of',
  'violated the policy',
  'in violation of',
];

const SAFE_LANGUAGE_MAP: Record<string, string> = {
  violation: 'potential policy inconsistency',
  violated: 'may be inconsistent with',
  illegal: 'potentially inconsistent with policy',
  guilty: 'identified for review',
  broke: 'potentially inconsistent with',
};

/**
 * Phase 150: Apply safety guardrails to any output text
 */
export function applySafetyGuardrails(text: string): string {
  let safe = text;

  // Replace forbidden phrases
  for (const forbidden of FORBIDDEN_LANGUAGE) {
    const regex = new RegExp(forbidden, 'gi');
    safe = safe.replace(regex, 'potential policy inconsistency identified');
  }

  // Replace individual unsafe words
  for (const [unsafe, replacement] of Object.entries(SAFE_LANGUAGE_MAP)) {
    const regex = new RegExp(`\\b${unsafe}\\b`, 'gi');
    safe = safe.replace(regex, replacement);
  }

  return safe;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceAnalysisResult {
  caseId: string;
  agencyId: string;
  totalFindings: number;
  findings: FindingOutput[];
  durationMs: number;
}

export interface FindingOutput {
  findingId: string;
  findingType: string;
  policyReference: string;
  evidenceTimestamp: string;
  detectedAction: string;
  ruleDescription: string;
  confidence: number;
  evidenceConfidence: number;
  ruleConfidence: number;
  analysisConfidence: number;
  explanation: string;
  safetyLanguage: string;
  evidenceLinks: EvidenceLinkOutput[];
}

export interface EvidenceLinkOutput {
  linkType: string;
  sourceReference: string;
  sourceContent?: string;
}

// ---------------------------------------------------------------------------
// Phase 146 — Confidence Scoring
// ---------------------------------------------------------------------------

export interface ConfidenceBreakdown {
  evidenceConfidence: number;
  ruleConfidence: number;
  analysisConfidence: number;
  overallConfidence: number;
}

/**
 * Calculate composite confidence score
 */
export function calculateConfidence(
  evidenceConfidence: number,
  ruleMatchConfidence: number,
  contextFactors: {
    multipleSourcesCorroborate: boolean;
    highResolutionEvidence: boolean;
    ruleIsExplicit: boolean;
    exceptionsApply: boolean;
  },
): ConfidenceBreakdown {
  // Weight factors
  const evidenceWeight = 0.40;
  const ruleWeight = 0.35;
  const analysisWeight = 0.25;

  // Analysis confidence based on context
  let analysisConfidence = 0.50;
  if (contextFactors.multipleSourcesCorroborate) analysisConfidence += 0.15;
  if (contextFactors.highResolutionEvidence) analysisConfidence += 0.10;
  if (contextFactors.ruleIsExplicit) analysisConfidence += 0.15;
  if (contextFactors.exceptionsApply) analysisConfidence -= 0.20;
  analysisConfidence = Math.max(0.10, Math.min(0.95, analysisConfidence));

  const overallConfidence =
    evidenceConfidence * evidenceWeight +
    ruleMatchConfidence * ruleWeight +
    analysisConfidence * analysisWeight;

  return {
    evidenceConfidence,
    ruleConfidence: ruleMatchConfidence,
    analysisConfidence,
    overallConfidence: Math.min(0.95, overallConfidence),
  };
}

// ---------------------------------------------------------------------------
// Phase 145 — AI Explanation Engine
// ---------------------------------------------------------------------------

/**
 * Generate plain-language explanation for attorneys
 */
export function generateExplanation(
  detectedAction: string,
  ruleText: string,
  ruleType: string,
  confidence: ConfidenceBreakdown,
  exceptions?: string[],
): string {
  const actionText = detectedAction.replace(/_/g, ' ');

  let explanation = '';

  if (ruleType === 'prohibition') {
    explanation = `This event may be inconsistent with the department's policy because the detected action (${actionText}) appears to involve conduct that the policy ${applySafetyGuardrails('prohibits')}. `;
    explanation += `The relevant policy states: "${ruleText.substring(0, 200)}". `;
  } else if (ruleType === 'requirement') {
    explanation = `The analysis identified that a required procedural step may not have been followed. `;
    explanation += `The policy requires: "${ruleText.substring(0, 200)}". `;
  } else if (ruleType === 'conditional') {
    explanation = `The detected action (${actionText}) may be subject to specific conditions outlined in the policy. `;
    explanation += `The policy states: "${ruleText.substring(0, 200)}". `;
  } else if (ruleType === 'escalation') {
    explanation = `The force escalation sequence may not align with the department's force continuum policy. `;
    explanation += `The policy states: "${ruleText.substring(0, 200)}". `;
  } else {
    explanation = `The detected action (${actionText}) has been flagged for review against applicable policy. `;
    explanation += `Relevant policy: "${ruleText.substring(0, 200)}". `;
  }

  // Add exception note if applicable
  if (exceptions && exceptions.length > 0) {
    explanation += `Note: The policy includes exception(s): ${exceptions[0].substring(0, 150)}. `;
    explanation += `An investigator should determine whether any exception applies to this situation. `;
  }

  // Add confidence note
  if (confidence.overallConfidence >= 0.80) {
    explanation += `The analysis confidence is high (${(confidence.overallConfidence * 100).toFixed(0)}%).`;
  } else if (confidence.overallConfidence >= 0.60) {
    explanation += `The analysis confidence is moderate (${(confidence.overallConfidence * 100).toFixed(0)}%). Additional review is recommended.`;
  } else {
    explanation += `The analysis confidence is low (${(confidence.overallConfidence * 100).toFixed(0)}%). This finding requires thorough human review before any conclusions.`;
  }

  return applySafetyGuardrails(explanation);
}

// ---------------------------------------------------------------------------
// Core Compliance Analysis (Phase 135)
// ---------------------------------------------------------------------------

/**
 * Run compliance analysis for a case against an agency's policies
 */
export async function analyzeCompliance(
  caseId: string,
  agencyId: string,
): Promise<ComplianceAnalysisResult> {
  const startTime = Date.now();
  const findings: FindingOutput[] = [];

  // Get all evidence events for the case
  const events = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Get all action-to-rule mappings
  const mappings = await prisma.policyActionMapping.findMany();

  // Get all rules for the agency
  const rules = await prisma.policyRule.findMany({
    where: { agencyId },
  });

  // Create rule lookup
  const ruleLookup = new Map(rules.map(r => [r.ruleId, r]));

  // For each evidence event, find applicable rules and analyze
  for (const event of events) {
    const applicableMappings = mappings.filter(m => m.eventType === event.eventType);

    for (const mapping of applicableMappings) {
      const rule = ruleLookup.get(mapping.ruleId);
      if (!rule) continue;

      // Check if this is a meaningful match (prohibition or requirement + detected action)
      if (rule.ruleType !== 'prohibition' && rule.ruleType !== 'requirement' && rule.ruleType !== 'escalation') {
        continue; // Only flag prohibitions, requirements, and escalation issues
      }

      // Calculate confidence
      const exceptions = rule.exceptions ? JSON.parse(rule.exceptions) as string[] : [];
      const confidence = calculateConfidence(
        event.confidence,
        mapping.relevanceScore,
        {
          multipleSourcesCorroborate: false, // Would check other sources
          highResolutionEvidence: event.sourceType === 'bodycam',
          ruleIsExplicit: rule.ruleType === 'prohibition',
          exceptionsApply: exceptions.length > 0,
        },
      );

      // Skip low-confidence findings
      if (confidence.overallConfidence < 0.40) continue;

      // Determine finding type
      let findingType = 'potential_inconsistency';
      if (confidence.overallConfidence < 0.50) findingType = 'requires_review';
      if (exceptions.length > 0 && confidence.overallConfidence < 0.60) {
        findingType = 'insufficient_evidence';
      }

      // Generate explanation (Phase 145)
      const explanation = generateExplanation(
        event.eventType,
        rule.ruleText,
        rule.ruleType,
        confidence,
        exceptions,
      );

      // Create finding
      const finding = await prisma.complianceFinding.create({
        data: {
          caseId,
          agencyId,
          findingType,
          policyReference: `${rule.category} — ${rule.ruleName}`,
          ruleId: rule.ruleId,
          evidenceTimestamp: event.timestamp,
          evidenceEventId: event.eventId,
          detectedAction: event.eventType,
          ruleDescription: rule.ruleText.substring(0, 500),
          confidence: confidence.overallConfidence,
          evidenceConfidence: confidence.evidenceConfidence,
          ruleConfidence: confidence.ruleConfidence,
          analysisConfidence: confidence.analysisConfidence,
          explanation,
          safetyLanguage: 'potential_policy_inconsistency',
        },
      });

      // Phase 136 — Create evidence links
      const evidenceLinks: EvidenceLinkOutput[] = [];

      // Link to video timestamp
      await prisma.evidenceLink.create({
        data: {
          findingId: finding.findingId,
          linkType: 'video_timestamp',
          sourceReference: event.timestamp,
          sourceContent: `${event.sourceType} at ${event.timestamp}`,
        },
      });
      evidenceLinks.push({
        linkType: 'video_timestamp',
        sourceReference: event.timestamp,
        sourceContent: `${event.sourceType} at ${event.timestamp}`,
      });

      // Link to policy section
      await prisma.evidenceLink.create({
        data: {
          findingId: finding.findingId,
          linkType: 'policy_section',
          sourceReference: rule.ruleName,
          sourceContent: rule.ruleText.substring(0, 300),
        },
      });
      evidenceLinks.push({
        linkType: 'policy_section',
        sourceReference: rule.ruleName,
        sourceContent: rule.ruleText.substring(0, 300),
      });

      // Link to transcript if available
      if (event.rawText) {
        await prisma.evidenceLink.create({
          data: {
            findingId: finding.findingId,
            linkType: 'transcript_excerpt',
            sourceReference: event.timestamp,
            sourceContent: event.rawText.substring(0, 300),
          },
        });
        evidenceLinks.push({
          linkType: 'transcript_excerpt',
          sourceReference: event.timestamp,
          sourceContent: event.rawText.substring(0, 300),
        });
      }

      // Phase 137 — Queue for human review
      const priority = rule.severity === 'critical' ? 2
        : rule.severity === 'high' ? 1 : 0;

      await prisma.complianceReviewQueue.create({
        data: {
          findingId: finding.findingId,
          reviewStatus: 'pending',
          priority,
          approvedForReport: false,
        },
      });

      findings.push({
        findingId: finding.findingId,
        findingType,
        policyReference: `${rule.category} — ${rule.ruleName}`,
        evidenceTimestamp: event.timestamp,
        detectedAction: event.eventType,
        ruleDescription: rule.ruleText.substring(0, 500),
        confidence: confidence.overallConfidence,
        evidenceConfidence: confidence.evidenceConfidence,
        ruleConfidence: confidence.ruleConfidence,
        analysisConfidence: confidence.analysisConfidence,
        explanation,
        safetyLanguage: 'potential_policy_inconsistency',
        evidenceLinks,
      });
    }
  }

  return {
    caseId,
    agencyId,
    totalFindings: findings.length,
    findings,
    durationMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Review Queue Operations (Phase 137)
// ---------------------------------------------------------------------------

/**
 * Get all findings pending review
 */
export async function getPendingReviews(limit = 50) {
  return prisma.complianceReviewQueue.findMany({
    where: { reviewStatus: 'pending' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  });
}

/**
 * Update review status
 */
export async function updateReviewStatus(
  reviewId: string,
  status: string,
  reviewerId: string,
  notes?: string,
  approvedForReport = false,
) {
  return prisma.complianceReviewQueue.update({
    where: { reviewId },
    data: {
      reviewStatus: status,
      reviewerId,
      reviewerNotes: notes,
      approvedForReport,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Get review statistics
 */
export async function getReviewStats() {
  const [pending, inReview, approved, rejected] = await Promise.all([
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'pending' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'in_review' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'approved' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'rejected' } }),
  ]);

  return { pending, inReview, approved, rejected, total: pending + inReview + approved + rejected };
}

// ---------------------------------------------------------------------------
// Finding queries
// ---------------------------------------------------------------------------

/**
 * Get findings for a case
 */
export async function getCaseFindings(caseId: string) {
  const findings = await prisma.complianceFinding.findMany({
    where: { caseId },
    orderBy: { confidence: 'desc' },
  });

  // Enrich with evidence links
  const enriched = await Promise.all(findings.map(async (f) => {
    const links = await prisma.evidenceLink.findMany({
      where: { findingId: f.findingId },
    });
    const review = await prisma.complianceReviewQueue.findUnique({
      where: { findingId: f.findingId },
    });
    return {
      ...f,
      evidenceLinks: links,
      reviewStatus: review?.reviewStatus ?? 'pending',
      approvedForReport: review?.approvedForReport ?? false,
    };
  }));

  return enriched;
}

/**
 * Get findings for an agency across all cases
 */
export async function getAgencyFindings(agencyId: string) {
  return prisma.complianceFinding.findMany({
    where: { agencyId },
    orderBy: { confidence: 'desc' },
  });
}
