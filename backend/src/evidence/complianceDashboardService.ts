// ============================================================================
// Phase 138 — Compliance Dashboard Service
// Phase 139 — Policy Violation Heatmap (agency frequency analysis)
// Phase 140 — Case Compliance Report Generator
// Phase 141 — Trial Exhibit Integration
// Phase 142 — Cross-Agency Comparison
// Phase 143 — Training Standard Analysis
// Phase 144 — Policy Evolution Tracking
// Phase 147 — Audit Trail
// Phase 148 — Expert Witness Mode
// Phase 149 — Jury Visualization
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { applySafetyGuardrails } from './policyComplianceAnalyzer.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Phase 138 — Compliance Dashboard Data
// ---------------------------------------------------------------------------

export interface ComplianceDashboardData {
  totalCasesAnalyzed: number;
  totalFindings: number;
  findingsByType: Record<string, number>;
  findingsByAgency: Array<{ agencyId: string; agencyName: string; count: number }>;
  reviewStats: {
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
  recentFindings: Array<{
    findingId: string;
    caseId: string;
    agencyId: string;
    findingType: string;
    confidence: number;
    detectedAction: string;
    policyReference: string;
    createdAt: Date;
  }>;
  confidenceDistribution: {
    high: number;   // >= 0.80
    medium: number; // >= 0.60
    low: number;    // < 0.60
  };
  topPolicyCategories: Array<{ category: string; count: number }>;
}

/**
 * Get comprehensive compliance dashboard data
 */
export async function getComplianceDashboardData(): Promise<ComplianceDashboardData> {
  // Total cases analyzed (unique caseIds in findings)
  const allFindings = await prisma.complianceFinding.findMany();
  const uniqueCases = new Set(allFindings.map(f => f.caseId));

  // Findings by type
  const findingsByType: Record<string, number> = {};
  for (const f of allFindings) {
    findingsByType[f.findingType] = (findingsByType[f.findingType] || 0) + 1;
  }

  // Findings by agency
  const agencyCountMap = new Map<string, number>();
  for (const f of allFindings) {
    agencyCountMap.set(f.agencyId, (agencyCountMap.get(f.agencyId) || 0) + 1);
  }

  const agencyIds = Array.from(agencyCountMap.keys());
  const agencies = await prisma.agency.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, agencyName: true },
  });
  const agencyNameMap = new Map(agencies.map(a => [a.agencyId, a.agencyName]));

  const findingsByAgency = Array.from(agencyCountMap.entries())
    .map(([agencyId, count]) => ({
      agencyId,
      agencyName: agencyNameMap.get(agencyId) || 'Unknown Agency',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Review stats
  const [pending, inReview, approved, rejected] = await Promise.all([
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'pending' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'in_review' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'approved' } }),
    prisma.complianceReviewQueue.count({ where: { reviewStatus: 'rejected' } }),
  ]);

  // Recent findings
  const recentFindings = await prisma.complianceFinding.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      findingId: true,
      caseId: true,
      agencyId: true,
      findingType: true,
      confidence: true,
      detectedAction: true,
      policyReference: true,
      createdAt: true,
    },
  });

  // Confidence distribution
  let high = 0, medium = 0, low = 0;
  for (const f of allFindings) {
    if (f.confidence >= 0.80) high++;
    else if (f.confidence >= 0.60) medium++;
    else low++;
  }

  // Top policy categories (from rules referenced in findings)
  const categoryCount = new Map<string, number>();
  for (const f of allFindings) {
    const category = f.policyReference.split(' — ')[0] || 'Unknown';
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  }
  const topPolicyCategories = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCasesAnalyzed: uniqueCases.size,
    totalFindings: allFindings.length,
    findingsByType,
    findingsByAgency,
    reviewStats: { pending, inReview, approved, rejected },
    recentFindings,
    confidenceDistribution: { high, medium, low },
    topPolicyCategories,
  };
}

// ---------------------------------------------------------------------------
// Phase 139 — Policy Inconsistency Heatmap (agency frequency)
// ---------------------------------------------------------------------------

export interface AgencyHeatmapEntry {
  agencyId: string;
  agencyName: string;
  county: string;
  potentialInconsistencies: number;
  casesAnalyzed: number;
  topCategory: string;
  averageConfidence: number;
}

/**
 * Generate heatmap showing which agencies most frequently generate findings
 */
export async function getInconsistencyHeatmap(): Promise<AgencyHeatmapEntry[]> {
  const findings = await prisma.complianceFinding.findMany({
    where: { findingType: 'potential_inconsistency' },
  });

  const agencyMap = new Map<string, {
    count: number;
    cases: Set<string>;
    categories: Map<string, number>;
    totalConfidence: number;
  }>();

  for (const f of findings) {
    if (!agencyMap.has(f.agencyId)) {
      agencyMap.set(f.agencyId, {
        count: 0,
        cases: new Set(),
        categories: new Map(),
        totalConfidence: 0,
      });
    }
    const entry = agencyMap.get(f.agencyId)!;
    entry.count++;
    entry.cases.add(f.caseId);
    const cat = f.policyReference.split(' — ')[0] || 'Unknown';
    entry.categories.set(cat, (entry.categories.get(cat) || 0) + 1);
    entry.totalConfidence += f.confidence;
  }

  const agencyIds = Array.from(agencyMap.keys());
  const agencies = await prisma.agency.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, agencyName: true, county: true },
  });
  const agencyInfo = new Map(agencies.map(a => [a.agencyId, a]));

  const heatmap: AgencyHeatmapEntry[] = [];
  for (const [agencyId, data] of agencyMap) {
    const info = agencyInfo.get(agencyId);
    let topCategory = 'Unknown';
    let maxCatCount = 0;
    for (const [cat, count] of data.categories) {
      if (count > maxCatCount) {
        topCategory = cat;
        maxCatCount = count;
      }
    }

    heatmap.push({
      agencyId,
      agencyName: info?.agencyName || 'Unknown',
      county: info?.county || 'Unknown',
      potentialInconsistencies: data.count,
      casesAnalyzed: data.cases.size,
      topCategory,
      averageConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
    });
  }

  return heatmap.sort((a, b) => b.potentialInconsistencies - a.potentialInconsistencies);
}

// ---------------------------------------------------------------------------
// Phase 140 — Case Compliance Report Generator
// ---------------------------------------------------------------------------

export interface ComplianceReport {
  title: string;
  generatedAt: string;
  caseId: string;
  agencyName: string;
  findings: Array<{
    number: number;
    findingType: string;
    policyReference: string;
    evidenceTimestamp: string;
    detectedAction: string;
    confidence: string;
    explanation: string;
    evidenceLinks: Array<{ type: string; reference: string; content: string }>;
    reviewStatus: string;
  }>;
  summary: {
    totalFindings: number;
    potentialInconsistencies: number;
    consistentFindings: number;
    averageConfidence: number;
    topPolicyAreas: string[];
  };
}

/**
 * Generate a professional compliance report for a case
 */
export async function generateComplianceReport(
  caseId: string,
  caseName?: string,
): Promise<ComplianceReport> {
  const findings = await prisma.complianceFinding.findMany({
    where: { caseId },
    orderBy: { confidence: 'desc' },
  });

  if (findings.length === 0) {
    return {
      title: `Policy Compliance Analysis Report`,
      generatedAt: new Date().toISOString(),
      caseId,
      agencyName: 'N/A',
      findings: [],
      summary: {
        totalFindings: 0,
        potentialInconsistencies: 0,
        consistentFindings: 0,
        averageConfidence: 0,
        topPolicyAreas: [],
      },
    };
  }

  // Get agency info
  const agencyId = findings[0].agencyId;
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
    select: { agencyName: true },
  });

  // Build report findings
  const reportFindings = await Promise.all(findings.map(async (f, idx) => {
    const links = await prisma.evidenceLink.findMany({
      where: { findingId: f.findingId },
    });
    const review = await prisma.complianceReviewQueue.findUnique({
      where: { findingId: f.findingId },
    });

    return {
      number: idx + 1,
      findingType: applySafetyGuardrails(f.findingType.replace(/_/g, ' ')),
      policyReference: f.policyReference,
      evidenceTimestamp: f.evidenceTimestamp,
      detectedAction: f.detectedAction.replace(/_/g, ' '),
      confidence: `${(f.confidence * 100).toFixed(0)}%`,
      explanation: applySafetyGuardrails(f.explanation || ''),
      evidenceLinks: links.map(l => ({
        type: l.linkType,
        reference: l.sourceReference,
        content: l.sourceContent || '',
      })),
      reviewStatus: review?.reviewStatus || 'pending',
    };
  }));

  // Build summary
  const potentialInconsistencies = findings.filter(f => f.findingType === 'potential_inconsistency').length;
  const consistentFindings = findings.filter(f => f.findingType === 'consistent').length;
  const totalConfidence = findings.reduce((sum, f) => sum + f.confidence, 0);

  const categoryCount = new Map<string, number>();
  for (const f of findings) {
    const cat = f.policyReference.split(' — ')[0] || 'Unknown';
    categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
  }
  const topPolicyAreas = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  const title = caseName
    ? `Policy Compliance Analysis Report — ${caseName}`
    : `Policy Compliance Analysis Report`;

  return {
    title: applySafetyGuardrails(title),
    generatedAt: new Date().toISOString(),
    caseId,
    agencyName: agency?.agencyName || 'Unknown Agency',
    findings: reportFindings,
    summary: {
      totalFindings: findings.length,
      potentialInconsistencies,
      consistentFindings,
      averageConfidence: findings.length > 0 ? totalConfidence / findings.length : 0,
      topPolicyAreas,
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 141 — Trial Exhibit Integration
// ---------------------------------------------------------------------------

export interface TrialExhibitPackage {
  findingId: string;
  exhibitType: 'timeline_visualization' | 'bodycam_playback' | 'scene_reconstruction' | 'policy_comparison';
  title: string;
  description: string;
  evidenceLinks: Array<{ type: string; reference: string }>;
  metadata: Record<string, unknown>;
}

/**
 * Generate trial exhibit packages for approved findings
 */
export async function generateTrialExhibits(caseId: string): Promise<TrialExhibitPackage[]> {
  const approvedReviews = await prisma.complianceReviewQueue.findMany({
    where: { approvedForReport: true },
  });

  const findingIds = approvedReviews.map(r => r.findingId);
  const findings = await prisma.complianceFinding.findMany({
    where: {
      findingId: { in: findingIds },
      caseId,
    },
  });

  const exhibits: TrialExhibitPackage[] = [];

  for (const finding of findings) {
    const links = await prisma.evidenceLink.findMany({
      where: { findingId: finding.findingId },
    });

    // Timeline visualization exhibit
    exhibits.push({
      findingId: finding.findingId,
      exhibitType: 'timeline_visualization',
      title: applySafetyGuardrails(`Timeline: ${finding.detectedAction.replace(/_/g, ' ')} at ${finding.evidenceTimestamp}`),
      description: applySafetyGuardrails(finding.explanation || ''),
      evidenceLinks: links.map(l => ({ type: l.linkType, reference: l.sourceReference })),
      metadata: {
        confidence: finding.confidence,
        policyReference: finding.policyReference,
      },
    });

    // Bodycam playback exhibit if video source exists
    const videoLink = links.find(l => l.linkType === 'video_timestamp');
    if (videoLink) {
      exhibits.push({
        findingId: finding.findingId,
        exhibitType: 'bodycam_playback',
        title: `Bodycam Footage at ${videoLink.sourceReference}`,
        description: `Evidence segment showing ${finding.detectedAction.replace(/_/g, ' ')}`,
        evidenceLinks: [{ type: 'video_timestamp', reference: videoLink.sourceReference }],
        metadata: {
          timestamp: videoLink.sourceReference,
          detectedAction: finding.detectedAction,
        },
      });
    }

    // Policy comparison exhibit
    exhibits.push({
      findingId: finding.findingId,
      exhibitType: 'policy_comparison',
      title: `Policy Reference: ${finding.policyReference}`,
      description: applySafetyGuardrails(finding.ruleDescription),
      evidenceLinks: links
        .filter(l => l.linkType === 'policy_section')
        .map(l => ({ type: l.linkType, reference: l.sourceReference })),
      metadata: {
        ruleId: finding.ruleId,
        agencyId: finding.agencyId,
      },
    });
  }

  return exhibits;
}

// ---------------------------------------------------------------------------
// Phase 142 — Cross-Agency Comparison
// ---------------------------------------------------------------------------

/**
 * Compare policies between two agencies on a specific topic
 */
export async function comparePolicies(
  agencyAId: string,
  agencyBId: string,
  topic: string,
): Promise<{
  comparison: {
    topic: string;
    agencyA: { id: string; name: string; policy: string; ruleType: string };
    agencyB: { id: string; name: string; policy: string; ruleType: string };
    differenceType: string;
    summary: string;
  };
}> {
  const [agencyA, agencyB] = await Promise.all([
    prisma.agency.findUnique({ where: { agencyId: agencyAId }, select: { agencyName: true } }),
    prisma.agency.findUnique({ where: { agencyId: agencyBId }, select: { agencyName: true } }),
  ]);

  const [rulesA, rulesB] = await Promise.all([
    prisma.policyRule.findMany({ where: { agencyId: agencyAId, category: topic } }),
    prisma.policyRule.findMany({ where: { agencyId: agencyBId, category: topic } }),
  ]);

  const agencyAName = agencyA?.agencyName || 'Agency A';
  const agencyBName = agencyB?.agencyName || 'Agency B';

  // Determine difference type
  const aProhibitions = rulesA.filter(r => r.ruleType === 'prohibition');
  const bProhibitions = rulesB.filter(r => r.ruleType === 'prohibition');
  const aPermissions = rulesA.filter(r => r.ruleType === 'permission');
  const bPermissions = rulesB.filter(r => r.ruleType === 'permission');

  let differenceType = 'same';
  let summary = '';

  if (rulesA.length === 0 && rulesB.length === 0) {
    differenceType = 'no_policy';
    summary = `Neither ${agencyAName} nor ${agencyBName} has a documented policy on ${topic}.`;
  } else if (rulesA.length === 0) {
    differenceType = 'no_policy';
    summary = `${agencyAName} has no documented policy on ${topic}, while ${agencyBName} has ${rulesB.length} rule(s).`;
  } else if (rulesB.length === 0) {
    differenceType = 'no_policy';
    summary = `${agencyBName} has no documented policy on ${topic}, while ${agencyAName} has ${rulesA.length} rule(s).`;
  } else if (aProhibitions.length > bProhibitions.length) {
    differenceType = 'stricter';
    summary = `${agencyAName} has stricter policy on ${topic} with ${aProhibitions.length} prohibition(s) vs ${bProhibitions.length} for ${agencyBName}.`;
  } else if (bProhibitions.length > aProhibitions.length) {
    differenceType = 'less_strict';
    summary = `${agencyBName} has stricter policy on ${topic} with ${bProhibitions.length} prohibition(s) vs ${aProhibitions.length} for ${agencyAName}.`;
  } else if (aPermissions.length > bPermissions.length) {
    differenceType = 'prohibits_vs_allows';
    summary = `${agencyAName} allows more flexibility on ${topic} with ${aPermissions.length} permission(s) vs ${bPermissions.length} for ${agencyBName}.`;
  } else {
    differenceType = 'same';
    summary = `Both agencies have similar policy stances on ${topic}.`;
  }

  // Store comparison
  await prisma.crossAgencyComparison.create({
    data: {
      topic,
      agencyAId,
      agencyAName,
      agencyAPolicy: rulesA.map(r => r.ruleText).join('; ').substring(0, 1000) || 'No policy',
      agencyBId,
      agencyBName,
      agencyBPolicy: rulesB.map(r => r.ruleText).join('; ').substring(0, 1000) || 'No policy',
      differenceType,
      summary: applySafetyGuardrails(summary),
    },
  });

  return {
    comparison: {
      topic,
      agencyA: {
        id: agencyAId,
        name: agencyAName,
        policy: rulesA.map(r => `[${r.ruleType}] ${r.ruleText}`).join('\n').substring(0, 500) || 'No policy documented',
        ruleType: aProhibitions.length > 0 ? 'prohibition' : aPermissions.length > 0 ? 'permission' : 'requirement',
      },
      agencyB: {
        id: agencyBId,
        name: agencyBName,
        policy: rulesB.map(r => `[${r.ruleType}] ${r.ruleText}`).join('\n').substring(0, 500) || 'No policy documented',
        ruleType: bProhibitions.length > 0 ? 'prohibition' : bPermissions.length > 0 ? 'permission' : 'requirement',
      },
      differenceType,
      summary: applySafetyGuardrails(summary),
    },
  };
}

/**
 * Get all stored cross-agency comparisons
 */
export async function getStoredComparisons(topic?: string) {
  return prisma.crossAgencyComparison.findMany({
    where: topic ? { topic } : {},
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Phase 143 — Training Standard Analysis
// ---------------------------------------------------------------------------

export interface TrainingAnalysisResult {
  caseId: string;
  agencyId: string;
  conductAlignedWithTraining: boolean;
  trainingGaps: string[];
  recommendations: string[];
}

/**
 * Analyze whether officer conduct aligns with training standards
 */
export async function analyzeTrainingAlignment(
  caseId: string,
  agencyId: string,
): Promise<TrainingAnalysisResult> {
  const events = await prisma.evidenceEvent.findMany({ where: { caseId } });
  const rules = await prisma.policyRule.findMany({
    where: { agencyId, category: { in: ['Use_of_Force', 'Officer_Conduct', 'Arrest'] } },
  });

  const trainingGaps: string[] = [];
  const recommendations: string[] = [];

  // Check for de-escalation attempts before force
  const forceEvents = events.filter(e =>
    ['taser_deployed', 'physical_strike', 'neck_restraint', 'pepper_spray', 'baton_strike'].includes(e.eventType),
  );
  const deEscalation = events.filter(e => e.eventType === 'de_escalation_attempt');

  if (forceEvents.length > 0 && deEscalation.length === 0) {
    trainingGaps.push('No de-escalation attempts detected before use of force');
    recommendations.push('Review de-escalation training requirements per POST standards');
  }

  // Check for Miranda compliance
  const arrests = events.filter(e => e.eventType === 'handcuffing');
  const miranda = events.filter(e => e.eventType === 'miranda_warning');
  if (arrests.length > 0 && miranda.length === 0) {
    trainingGaps.push('Miranda warning not detected following custodial action');
    recommendations.push('Ensure Miranda training is current for all arresting officers');
  }

  // Check force continuum compliance
  const hasRequirement = rules.some(r =>
    r.ruleType === 'requirement' && /continuum|escalat|proportional/i.test(r.ruleText),
  );
  if (hasRequirement && forceEvents.length > 1) {
    const timestamps = forceEvents.map(e => e.timestamp).sort();
    trainingGaps.push(`Multiple force applications detected (${timestamps.join(', ')}) — review force continuum training`);
    recommendations.push('Evaluate whether force escalation followed department training protocols');
  }

  // Check UoF warning before deployment
  const uofWarnings = events.filter(e => e.eventType === 'uof_warning');
  if (forceEvents.length > 0 && uofWarnings.length === 0) {
    trainingGaps.push('No use-of-force warning detected before force application');
    recommendations.push('Review training on verbal warning requirements prior to force deployment');
  }

  return {
    caseId,
    agencyId,
    conductAlignedWithTraining: trainingGaps.length === 0,
    trainingGaps: trainingGaps.map(g => applySafetyGuardrails(g)),
    recommendations: recommendations.map(r => applySafetyGuardrails(r)),
  };
}

// ---------------------------------------------------------------------------
// Phase 144 — Policy Evolution Tracking
// ---------------------------------------------------------------------------

/**
 * Track a policy change
 */
export async function trackPolicyChange(
  agencyId: string,
  policyTopic: string,
  previousVersion: string | null,
  currentVersion: string,
  changeType: 'added' | 'modified' | 'removed' | 'strengthened' | 'weakened',
  changeSummary: string,
  effectiveDate?: Date,
) {
  return prisma.policyEvolution.create({
    data: {
      agencyId,
      policyTopic,
      previousVersion,
      currentVersion,
      changeType,
      changeSummary: applySafetyGuardrails(changeSummary),
      effectiveDate,
    },
  });
}

/**
 * Get policy evolution history for an agency
 */
export async function getPolicyEvolutionHistory(agencyId: string, policyTopic?: string) {
  return prisma.policyEvolution.findMany({
    where: {
      agencyId,
      ...(policyTopic ? { policyTopic } : {}),
    },
    orderBy: { detectedAt: 'desc' },
  });
}

/**
 * Detect policy changes by comparing current rules to previous versions
 */
export async function detectPolicyChanges(agencyId: string): Promise<number> {
  const rules = await prisma.policyRule.findMany({ where: { agencyId } });
  const existingEvolution = await prisma.policyEvolution.findMany({ where: { agencyId } });
  const trackedTopics = new Set(existingEvolution.map(e => `${e.policyTopic}:${e.currentVersion.substring(0, 50)}`));

  let changesDetected = 0;

  for (const rule of rules) {
    const key = `${rule.category}:${rule.ruleText.substring(0, 50)}`;
    if (trackedTopics.has(key)) continue;

    // Check if this is a new rule (no previous evolution record for this topic)
    const previousEvolution = existingEvolution.find(e => e.policyTopic === rule.category);

    if (!previousEvolution) {
      await trackPolicyChange(
        agencyId,
        rule.category,
        null,
        rule.ruleText.substring(0, 500),
        'added',
        `New ${rule.ruleType} rule added: ${rule.ruleName}`,
        rule.effectiveDate || undefined,
      );
      changesDetected++;
    }
  }

  return changesDetected;
}

// ---------------------------------------------------------------------------
// Phase 147 — Audit Trail
// ---------------------------------------------------------------------------

/**
 * Log an analysis step to the audit trail
 */
export async function logAuditStep(
  caseId: string,
  stepName: string,
  stepDescription: string,
  inputData?: Record<string, unknown>,
  outputData?: Record<string, unknown>,
  durationMs?: number,
  findingId?: string,
  status: 'completed' | 'failed' | 'skipped' = 'completed',
) {
  return prisma.complianceAuditTrail.create({
    data: {
      caseId,
      findingId,
      stepName,
      stepDescription,
      inputData: inputData ? JSON.stringify(inputData) : null,
      outputData: outputData ? JSON.stringify(outputData) : null,
      durationMs,
      status,
    },
  });
}

/**
 * Get audit trail for a case
 */
export async function getCaseAuditTrail(caseId: string) {
  return prisma.complianceAuditTrail.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get audit trail for a specific finding
 */
export async function getFindingAuditTrail(findingId: string) {
  return prisma.complianceAuditTrail.findMany({
    where: { findingId },
    orderBy: { createdAt: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Phase 148 — Expert Witness Mode
// ---------------------------------------------------------------------------

export interface ExpertWitnessPackage {
  caseId: string;
  generatedAt: string;
  methodology: string;
  analysisSteps: Array<{
    step: number;
    name: string;
    description: string;
    toolsUsed: string[];
    timestamp: string;
  }>;
  findings: Array<{
    findingNumber: number;
    description: string;
    policyReference: string;
    evidenceTimestamp: string;
    confidenceBreakdown: {
      evidence: string;
      rule: string;
      analysis: string;
      overall: string;
    };
    evidenceChain: Array<{ type: string; reference: string; content: string }>;
  }>;
  auditTrail: Array<{
    step: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
  limitations: string[];
  disclaimer: string;
}

/**
 * Generate an expert witness analysis package
 */
export async function generateExpertWitnessPackage(caseId: string): Promise<ExpertWitnessPackage> {
  const findings = await prisma.complianceFinding.findMany({
    where: { caseId },
    orderBy: { confidence: 'desc' },
  });

  const auditTrail = await prisma.complianceAuditTrail.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  const methodology = applySafetyGuardrails(
    'This analysis was conducted using a systematic, evidence-based methodology that includes: ' +
    '(1) automated evidence event extraction from bodycam, dashcam, audio, and documentary sources; ' +
    '(2) structured policy rule parsing to convert agency policies into analyzable rules; ' +
    '(3) deterministic mapping of detected actions to applicable policy rules; ' +
    '(4) confidence-scored compliance analysis comparing detected events to policy requirements; ' +
    '(5) human review and verification of all automated findings. ' +
    'All findings represent potential policy inconsistencies and require human expert interpretation.',
  );

  const analysisSteps = [
    { step: 1, name: 'Evidence Collection', description: 'All available evidence sources were cataloged and indexed', toolsUsed: ['Evidence Indexer', 'Document Scanner'], timestamp: '' },
    { step: 2, name: 'Event Extraction', description: 'Structured events were extracted from each evidence source using NLP and pattern matching', toolsUsed: ['Event Extraction Engine', 'Speech Analyzer', 'Video Analyzer'], timestamp: '' },
    { step: 3, name: 'Timeline Construction', description: 'All detected events were organized into a chronological officer action timeline', toolsUsed: ['Timeline Service'], timestamp: '' },
    { step: 4, name: 'Policy Rule Parsing', description: 'Agency policies were parsed into structured rules with conditions and exceptions', toolsUsed: ['Policy Rule Engine'], timestamp: '' },
    { step: 5, name: 'Compliance Analysis', description: 'Each detected event was evaluated against applicable policy rules', toolsUsed: ['Compliance Analyzer', 'Confidence Scorer'], timestamp: '' },
    { step: 6, name: 'Human Review', description: 'All findings were queued for human investigator review', toolsUsed: ['Review Queue'], timestamp: '' },
  ];

  const expertFindings = await Promise.all(findings.map(async (f, idx) => {
    const links = await prisma.evidenceLink.findMany({
      where: { findingId: f.findingId },
    });

    return {
      findingNumber: idx + 1,
      description: applySafetyGuardrails(f.explanation || `Potential policy inconsistency: ${f.detectedAction.replace(/_/g, ' ')}`),
      policyReference: f.policyReference,
      evidenceTimestamp: f.evidenceTimestamp,
      confidenceBreakdown: {
        evidence: `${(f.evidenceConfidence * 100).toFixed(0)}%`,
        rule: `${(f.ruleConfidence * 100).toFixed(0)}%`,
        analysis: `${(f.analysisConfidence * 100).toFixed(0)}%`,
        overall: `${(f.confidence * 100).toFixed(0)}%`,
      },
      evidenceChain: links.map(l => ({
        type: l.linkType,
        reference: l.sourceReference,
        content: l.sourceContent || '',
      })),
    };
  }));

  return {
    caseId,
    generatedAt: new Date().toISOString(),
    methodology,
    analysisSteps,
    findings: expertFindings,
    auditTrail: auditTrail.map(a => ({
      step: a.stepName,
      description: a.stepDescription,
      timestamp: a.createdAt.toISOString(),
      status: a.status,
    })),
    limitations: [
      'Automated detection systems have inherent accuracy limitations',
      'Video analysis is subject to camera angle, lighting, and resolution constraints',
      'Speech detection accuracy varies with audio quality and background noise',
      'Policy rule parsing may not capture all nuances of complex policy language',
      'All findings require expert human interpretation in the context of the full incident',
      'Confidence scores represent statistical likelihood, not certainty',
    ],
    disclaimer: applySafetyGuardrails(
      'This analysis identifies potential policy inconsistencies based on automated evidence analysis. ' +
      'All findings are preliminary and require expert review. This system does not make determinations ' +
      'of policy compliance or non-compliance. Final determinations must be made by qualified reviewers ' +
      'with full access to all evidence and context.',
    ),
  };
}

// ---------------------------------------------------------------------------
// Phase 149 — Jury Visualization (simplified finding summaries)
// ---------------------------------------------------------------------------

export interface JuryVisualization {
  caseId: string;
  title: string;
  exhibits: Array<{
    exhibitNumber: number;
    type: 'timeline' | 'policy_highlight' | 'evidence_clip' | 'comparison';
    title: string;
    description: string;
    visualData: Record<string, unknown>;
  }>;
  /** Present only when no exhibit is supported by the repository. */
  message?: string;
}

/**
 * Generate simplified jury-ready visual exhibits
 */
export async function generateJuryVisualizations(caseId: string): Promise<JuryVisualization> {
  const findings = await prisma.complianceFinding.findMany({
    where: { caseId },
    orderBy: { evidenceTimestamp: 'asc' },
  });

  const events = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  const exhibits: JuryVisualization['exhibits'] = [];
  let exhibitNumber = 1;

  // Timeline exhibit — only when there is something to exhibit. An exhibit
  // built from no events has nothing behind it, and describing it as a
  // "complete sequence" asserts a completeness the repository cannot support:
  // it holds what was extracted from the discovery that was uploaded, which is
  // not the same as everything that happened.
  if (events.length > 0) {
    exhibits.push({
      exhibitNumber: exhibitNumber++,
      type: 'timeline',
      title: 'Chronological Event Timeline',
      description:
        `Sequence of ${events.length} event(s) extracted from the discovery indexed for this case. ` +
        'Events not described in the uploaded materials do not appear here.',
      visualData: {
        events: events.map(e => ({
          time: e.timestamp,
          action: e.eventType.replace(/_/g, ' '),
          source: e.sourceType,
          sourceEvidence: e.sourceEvidence,
          confidence: `${(e.confidence * 100).toFixed(0)}%`,
        })),
        totalEvents: events.length,
        timeRange: `${events[0].timestamp} to ${events[events.length - 1].timestamp}`,
      },
    });
  }

  // Finding-specific exhibits
  for (const finding of findings) {
    if (finding.findingType !== 'potential_inconsistency') continue;

    // Policy highlight exhibit
    exhibits.push({
      exhibitNumber: exhibitNumber++,
      type: 'policy_highlight',
      title: applySafetyGuardrails(`Policy Analysis: ${finding.detectedAction.replace(/_/g, ' ')}`),
      description: applySafetyGuardrails(finding.explanation || ''),
      visualData: {
        detectedAction: finding.detectedAction.replace(/_/g, ' '),
        policyReference: finding.policyReference,
        evidenceTimestamp: finding.evidenceTimestamp,
        confidence: `${(finding.confidence * 100).toFixed(0)}%`,
        ruleDescription: finding.ruleDescription.substring(0, 200),
      },
    });

    // Evidence clip exhibit
    exhibits.push({
      exhibitNumber: exhibitNumber++,
      type: 'evidence_clip',
      title: `Evidence at ${finding.evidenceTimestamp}`,
      description: `Source evidence showing ${finding.detectedAction.replace(/_/g, ' ')}`,
      visualData: {
        timestamp: finding.evidenceTimestamp,
        action: finding.detectedAction.replace(/_/g, ' '),
        confidenceBreakdown: {
          evidence: `${(finding.evidenceConfidence * 100).toFixed(0)}%`,
          rule: `${(finding.ruleConfidence * 100).toFixed(0)}%`,
          analysis: `${(finding.analysisConfidence * 100).toFixed(0)}%`,
        },
      },
    });
  }

  return {
    caseId,
    title: applySafetyGuardrails('Policy Compliance Analysis — Visual Exhibits'),
    exhibits,
    // Say so explicitly rather than returning a bare empty list, so the
    // absence of exhibits reads as "nothing supports one yet" rather than as
    // a rendering failure.
    ...(exhibits.length === 0
      ? {
          message:
            'No exhibits can be produced for this case. No compliance findings or extracted events are held ' +
            'in the repository for it, and an exhibit is only generated from material already indexed.',
        }
      : {}),
  };
}
