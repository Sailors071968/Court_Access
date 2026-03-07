// ============================================
// Court Access — Legal Issue Spotter Engine
// Phase 144: Identify legal issues from evidence
// ============================================

import prisma from '../services/prismaClient.js';

const LEGAL_ISSUE_PATTERNS = [
  {
    issueType: 'miranda_violation',
    category: 'constitutional',
    patterns: [
      /(?:no miranda|wasn't? read rights|without (?:being )?advised)/i,
      /(?:custodial interrogation|in custody.*question)/i,
    ],
    severity: 'critical',
    caselaw: 'Miranda v. Arizona, 384 U.S. 436 (1966)',
  },
  {
    issueType: 'illegal_search',
    category: 'constitutional',
    patterns: [
      /(?:without (?:a )?warrant|warrantless|no warrant)/i,
      /(?:illegal search|unreasonable search|exceeded scope)/i,
    ],
    severity: 'critical',
    caselaw: 'Mapp v. Ohio, 367 U.S. 643 (1961)',
  },
  {
    issueType: 'confrontation_clause',
    category: 'constitutional',
    patterns: [
      /(?:unable to cross.?examine|no opportunity.*confront)/i,
      /(?:testimonial hearsay|absent witness.*statement)/i,
    ],
    severity: 'high',
    caselaw: 'Crawford v. Washington, 541 U.S. 36 (2004)',
  },
  {
    issueType: 'brady_violation',
    category: 'disclosure',
    patterns: [
      /(?:withheld evidence|suppressed.*favorable|undisclosed)/i,
      /(?:exculpatory.*not disclosed|favorable.*not provided)/i,
    ],
    severity: 'critical',
    caselaw: 'Brady v. Maryland, 373 U.S. 83 (1963)',
  },
  {
    issueType: 'chain_of_custody',
    category: 'evidence',
    patterns: [
      /(?:chain of custody|evidence handling|storage gap)/i,
      /(?:contaminated|tampered|mishandled evidence)/i,
    ],
    severity: 'high',
    caselaw: 'FRE 901(a)',
  },
  {
    issueType: 'expert_reliability',
    category: 'evidence',
    patterns: [
      /(?:unqualified expert|unreliable methodology|junk science)/i,
      /(?:not peer.?reviewed|not generally accepted)/i,
    ],
    severity: 'medium',
    caselaw: 'Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)',
  },
  {
    issueType: 'suggestive_identification',
    category: 'identification',
    patterns: [
      /(?:show.?up|suggestive lineup|single photo)/i,
      /(?:coached.*identify|told.*suspect)/i,
    ],
    severity: 'high',
    caselaw: 'Manson v. Brathwaite, 432 U.S. 98 (1977)',
  },
  {
    issueType: 'coerced_confession',
    category: 'constitutional',
    patterns: [
      /(?:coerced|forced.*confess|threatened|promised)/i,
      /(?:lengthy interrogation|denied.*sleep|denied.*food)/i,
    ],
    severity: 'critical',
    caselaw: 'Arizona v. Fulminante, 499 U.S. 279 (1991)',
  },
];

/**
 * Spot legal issues in case evidence.
 * @param {string} caseId
 * @returns {{ issues: object[], summary: object }}
 */
export async function spotLegalIssues(caseId) {
  console.log(`[LegalIssue] Spotting legal issues for case ${caseId}`);

  const facts = await prisma.extractedFact.findMany({ where: { caseId } });
  const transcripts = await prisma.mediaTranscript.findMany({
    where: { caseId, status: 'complete' },
  });

  const allText = [
    ...facts.map(f => f.statementText),
    ...transcripts.map(t => t.transcriptText || ''),
  ].join(' ');

  const issues = [];

  for (const rule of LEGAL_ISSUE_PATTERNS) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(allText);
      if (match) {
        const contextStart = Math.max(0, match.index - 150);
        const contextEnd = Math.min(allText.length, match.index + match[0].length + 150);

        issues.push({
          caseId,
          issueType: rule.issueType,
          category: rule.category,
          severity: rule.severity,
          description: `Potential ${rule.issueType.replace(/_/g, ' ')}: "${match[0]}" detected in case evidence.`,
          caselaw: rule.caselaw,
          context: allText.substring(contextStart, contextEnd),
          metadata: {
            matchText: match[0],
            matchIndex: match.index,
          },
        });
        break;
      }
    }
  }

  const stored = [];
  for (const issue of issues) {
    try {
      const record = await prisma.legalIssue.create({ data: issue });
      stored.push(record);
    } catch (err) {
      console.warn(`[LegalIssue] Store error: ${err.message}`);
    }
  }

  console.log(`[LegalIssue] Found ${stored.length} legal issues for case ${caseId}`);

  return {
    issues: stored,
    summary: {
      total: stored.length,
      byCategory: groupBy(stored, 'category'),
      bySeverity: groupBy(stored, 'severity'),
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

export async function getCaseLegalIssues(caseId) {
  return prisma.legalIssue.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
