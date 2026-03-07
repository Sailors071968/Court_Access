// ============================================
// Court Access — Evidence Neutrality Engine
// Phase 149: Ensure all outputs maintain neutrality
//
// Rules:
// 1. Never assume guilt or innocence
// 2. Only reference evidence in the record
// 3. Present facts without value judgment
// 4. Flag biased language in outputs
// ============================================

import prisma from '../services/prismaClient.js';

const BIASED_PATTERNS = [
  { pattern: /(?:clearly guilty|obviously guilty|must have done it)/i, category: 'guilt_assumption', severity: 'critical' },
  { pattern: /(?:definitely innocent|couldn't have done|impossible.*committed)/i, category: 'innocence_assumption', severity: 'critical' },
  { pattern: /(?:criminal|thug|predator|monster|evil)/i, category: 'pejorative_label', severity: 'high' },
  { pattern: /(?:victim's story|truth is|we know that|it's clear that)/i, category: 'editorial_judgment', severity: 'medium' },
  { pattern: /(?:should be convicted|deserves|ought to be punished)/i, category: 'sentencing_opinion', severity: 'critical' },
  { pattern: /(?:lies|lying|fabricated|made up.*story)/i, category: 'credibility_judgment', severity: 'high' },
  { pattern: /(?:always|never|everyone knows|common knowledge)/i, category: 'absolute_language', severity: 'low' },
  { pattern: /(?:suspect admitted|defendant confessed)(?!.*miranda)/i, category: 'unqualified_admission', severity: 'medium' },
];

const NEUTRAL_REPLACEMENTS = {
  'clearly guilty': 'evidence suggests involvement',
  'obviously guilty': 'evidence indicates',
  'definitely innocent': 'evidence does not support the charge',
  'criminal': 'defendant',
  'victim': 'complainant',
  'lies': 'inconsistent statements',
  'lying': 'providing inconsistent account',
  'truth is': 'evidence indicates',
  'we know that': 'evidence shows',
};

/**
 * Check text for neutrality violations.
 * @param {string} text
 * @returns {{ violations: object[], isNeutral: boolean, neutralizedText: string }}
 */
export function checkNeutrality(text) {
  const violations = [];

  for (const { pattern, category, severity } of BIASED_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        category,
        severity,
        matchText: match[0],
        position: match.index,
        suggestion: NEUTRAL_REPLACEMENTS[match[0].toLowerCase()] || 'Rephrase using neutral, evidence-based language',
      });
    }
  }

  let neutralizedText = text;
  for (const [biased, neutral] of Object.entries(NEUTRAL_REPLACEMENTS)) {
    neutralizedText = neutralizedText.replace(new RegExp(biased, 'gi'), neutral);
  }

  return {
    violations,
    isNeutral: violations.length === 0,
    neutralizedText,
    violationCount: violations.length,
    maxSeverity: violations.length > 0
      ? violations.reduce((max, v) => {
          const order = { critical: 4, high: 3, medium: 2, low: 1 };
          return (order[v.severity] || 0) > (order[max] || 0) ? v.severity : max;
        }, 'low')
      : null,
  };
}

/**
 * Run neutrality check on all case narratives.
 * @param {string} caseId
 * @returns {{ results: object[], summary: object }}
 */
export async function auditCaseNeutrality(caseId) {
  console.log(`[Neutrality] Auditing case ${caseId} for neutrality`);

  const narratives = await prisma.caseNarrative.findMany({ where: { caseId } });
  const results = [];

  for (const narrative of narratives) {
    const sections = narrative.metadata?.sections || narrative.keyEvents || [];
    for (const section of (Array.isArray(sections) ? sections : [])) {
      const check = checkNeutrality(section.content || '');
      if (!check.isNeutral) {
        results.push({
          narrativeId: narrative.id,
          perspective: narrative.modelVersion || narrative.metadata?.perspective || 'unknown',
          section: section.title,
          violations: check.violations,
          originalText: section.content?.substring(0, 200),
          suggestedText: check.neutralizedText?.substring(0, 200),
        });
      }
    }
  }

  // Store audit result
  await prisma.neutralityAudit.create({
    data: {
      caseId,
      entityType: 'narrative',
      totalChecked: narratives.length,
      violationsFound: results.reduce((sum, r) => sum + r.violations.length, 0),
      results,
      metadata: { auditedAt: new Date().toISOString() },
    },
  });

  console.log(`[Neutrality] Found ${results.length} sections with neutrality issues in case ${caseId}`);

  return {
    results,
    summary: {
      narrativesChecked: narratives.length,
      sectionsWithIssues: results.length,
      totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
    },
  };
}

export async function getCaseNeutralityAudits(caseId) {
  return prisma.neutralityAudit.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
