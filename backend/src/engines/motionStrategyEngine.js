// ============================================
// Court Access — Motion Strategy Engine
// Phase 143: Generate motion recommendations
// based on admissibility issues and case analysis
// ============================================

import prisma from '../services/prismaClient.js';

const MOTION_TEMPLATES = {
  suppress_statement: {
    title: 'Motion to Suppress Statements',
    legalBasis: 'Fifth Amendment; Miranda v. Arizona, 384 U.S. 436 (1966)',
    standardOfReview: 'Preponderance of the evidence',
    requirements: ['Show custodial interrogation', 'Show Miranda warnings not given or waived involuntarily'],
  },
  suppress_identification: {
    title: 'Motion to Suppress Identification',
    legalBasis: 'Due Process Clause; Manson v. Brathwaite, 432 U.S. 98 (1977)',
    standardOfReview: 'Totality of the circumstances',
    requirements: ['Show unduly suggestive procedure', 'Show unreliable identification under Biggers factors'],
  },
  suppress_search: {
    title: 'Motion to Suppress Physical Evidence',
    legalBasis: 'Fourth Amendment; Mapp v. Ohio, 367 U.S. 643 (1961)',
    standardOfReview: 'Preponderance of the evidence',
    requirements: ['Show warrantless search', 'Show no valid exception applies'],
  },
  dismiss_speedy_trial: {
    title: 'Motion to Dismiss — Speedy Trial Violation',
    legalBasis: 'Sixth Amendment; Barker v. Wingo, 407 U.S. 514 (1972)',
    standardOfReview: 'Balancing test (length, reason, assertion, prejudice)',
    requirements: ['Show presumptively prejudicial delay', 'Show government responsible for delay'],
  },
  exclude_expert: {
    title: 'Motion to Exclude Expert Testimony',
    legalBasis: 'FRE 702; Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)',
    standardOfReview: 'Gatekeeping function',
    requirements: ['Challenge methodology reliability', 'Challenge relevance to facts'],
  },
  chain_of_custody: {
    title: 'Motion to Exclude — Chain of Custody',
    legalBasis: 'FRE 901(a); Authentication requirement',
    standardOfReview: 'Sufficient to support a finding of authenticity',
    requirements: ['Show gap in chain of custody', 'Show potential for tampering or contamination'],
  },
};

/**
 * Generate motion recommendations for a case.
 * @param {string} caseId
 * @returns {{ motions: object[], summary: object }}
 */
export async function generateMotionStrategy(caseId) {
  console.log(`[MotionStrategy] Generating motion recommendations for case ${caseId}`);

  const [admissibility, misidRisks, conflicts, registry] = await Promise.all([
    prisma.admissibilityIssue.findMany({ where: { caseId } }),
    prisma.misidentificationRisk.findMany({ where: { caseId } }),
    prisma.timelineConflict.findMany({ where: { caseId } }),
    prisma.evidenceRegistry.findMany({ where: { caseId } }),
  ]);

  const motions = [];

  // Map admissibility issues to motions
  for (const issue of admissibility) {
    let templateKey = null;
    if (issue.issueType === 'improper_interrogation') templateKey = 'suppress_statement';
    if (issue.issueType === 'suggestive_identification') templateKey = 'suppress_identification';
    if (issue.issueType === 'fourth_amendment_violation') templateKey = 'suppress_search';
    if (issue.issueType === 'chain_of_custody_break') templateKey = 'chain_of_custody';

    if (templateKey && MOTION_TEMPLATES[templateKey]) {
      const template = MOTION_TEMPLATES[templateKey];
      motions.push({
        caseId,
        motionType: templateKey,
        title: template.title,
        description: issue.description,
        legalBasis: template.legalBasis,
        supportingEvidence: [issue.evidenceId],
        priority: issue.severity,
        metadata: {
          admissibilityIssueId: issue.id,
          issueType: issue.issueType,
          standardOfReview: template.standardOfReview,
          strengthScore: issue.severity === 'critical' ? 0.85 : issue.severity === 'high' ? 0.7 : 0.5,
          requirements: template.requirements,
        },
      });
    }
  }

  // Misidentification-based motions
  for (const risk of misidRisks) {
    if (risk.overallRiskScore > 0.6) {
      const template = MOTION_TEMPLATES.suppress_identification;
      motions.push({
        caseId,
        motionType: 'suppress_identification',
        title: template.title,
        description: `Witness "${risk.witnessName}" has ${risk.riskLevel} misidentification risk (${risk.overallRiskScore}). Distance: ${risk.distanceScore}, Lighting: ${risk.lightingScore}, Observation: ${risk.observationTimeScore}`,
        legalBasis: template.legalBasis,
        supportingEvidence: [],
        priority: risk.riskLevel === 'critical' ? 'critical' : 'high',
        metadata: {
          misidRiskId: risk.id,
          witnessName: risk.witnessName,
          standardOfReview: template.standardOfReview,
          strengthScore: risk.overallRiskScore,
          requirements: template.requirements,
        },
      });
    }
  }

  // Deduplicate by motion type + evidence
  const seen = new Set();
  const deduped = motions.filter(m => {
    const key = `${m.motionType}:${m.supportingEvidence.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Store
  const stored = [];
  for (const motion of deduped) {
    try {
      const record = await prisma.motionSuggestion.create({ data: motion });
      stored.push(record);
    } catch (err) {
      console.warn(`[MotionStrategy] Store error: ${err.message}`);
    }
  }

  console.log(`[MotionStrategy] Generated ${stored.length} motion recommendations for case ${caseId}`);

  return {
    motions: stored,
    summary: {
      total: stored.length,
      byType: groupBy(stored, 'motionType'),
      byPriority: groupBy(stored, 'priority'),
      avgStrength: stored.length > 0
        ? Math.round((stored.reduce((s, m) => s + (m.metadata?.strengthScore || 0), 0) / stored.length) * 100) / 100
        : 0,
    },
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export async function getCaseMotionRecommendations(caseId) {
  return prisma.motionSuggestion.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
