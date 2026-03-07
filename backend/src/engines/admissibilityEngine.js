// ============================================
// Court Access — Evidence Admissibility Analyzer
// Phase 131: Detect admissibility issues
//
// Issues: hearsay, chain_of_custody_break,
// improper_interrogation, suggestive_identification
// ============================================

import prisma from '../services/prismaClient.js';

const ADMISSIBILITY_RULES = [
  {
    issueType: 'hearsay',
    patterns: [
      /(?:told me|said that|heard (?:him|her|them) say|someone said|they said)/i,
      /(?:according to|reportedly|allegedly|was told that)/i,
      /(?:out-of-court|statement made outside)/i,
    ],
    severity: 'medium',
    legalBasis: 'FRE 801-807 (Hearsay)',
    recommendation: 'Evaluate whether a hearsay exception applies (excited utterance, present sense impression, business records, etc.)',
  },
  {
    issueType: 'chain_of_custody_break',
    patterns: [
      /(?:no seal|unsealed|tampered|contaminated|mishandled)/i,
      /(?:gap in custody|unaccounted|missing log|no documentation)/i,
      /(?:transferred without|not logged|chain.*broken)/i,
    ],
    severity: 'high',
    legalBasis: 'FRE 901(a) (Authentication)',
    recommendation: 'Challenge the authenticity and integrity of the evidence. Request full chain of custody documentation.',
  },
  {
    issueType: 'improper_interrogation',
    patterns: [
      /(?:no miranda|wasn't? read (?:his|her|their) rights|without counsel)/i,
      /(?:coerced|threatened|forced|pressured to confess)/i,
      /(?:denied (?:attorney|lawyer|counsel)|invoked .* right|requested attorney)/i,
      /(?:continued questioning after|interrogation lasted (?:\d+ hours|overnight))/i,
    ],
    severity: 'critical',
    legalBasis: 'Fifth Amendment / Miranda v. Arizona, 384 U.S. 436 (1966)',
    recommendation: 'File motion to suppress statements obtained in violation of Miranda rights or through coercion.',
  },
  {
    issueType: 'suggestive_identification',
    patterns: [
      /(?:show-?up|single photo|only one|pointed (?:him|her|them) out)/i,
      /(?:suggestive|leading|coached|told (?:him|her|them) to identify)/i,
      /(?:tainted lineup|unfair procedure|administrator knew)/i,
    ],
    severity: 'high',
    legalBasis: 'Manson v. Brathwaite, 432 U.S. 98 (1977)',
    recommendation: 'Challenge identification procedure under due process. Request lineup documentation and assess reliability factors.',
  },
  {
    issueType: 'fourth_amendment_violation',
    patterns: [
      /(?:without (?:a )?warrant|warrantless search|illegal search)/i,
      /(?:no probable cause|exceeded scope|plain view.*pretext)/i,
      /(?:consent.*coerced|forced entry|no knock)/i,
    ],
    severity: 'critical',
    legalBasis: 'Fourth Amendment / Mapp v. Ohio, 367 U.S. 643 (1961)',
    recommendation: 'File motion to suppress evidence obtained through unlawful search and seizure.',
  },
];

/**
 * Analyze evidence for admissibility issues.
 * @param {string} caseId
 * @param {string} evidenceId
 * @param {string} textContent
 * @returns {{ issues: object[], summary: object }}
 */
export async function analyzeAdmissibility(caseId, evidenceId, textContent) {
  console.log(`[Admissibility] Analyzing evidence ${evidenceId} for case ${caseId}`);

  const issues = [];

  for (const rule of ADMISSIBILITY_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(textContent);
      if (match) {
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(textContent.length, match.index + match[0].length + 100);
        const context = textContent.substring(contextStart, contextEnd);

        issues.push({
          caseId,
          evidenceId,
          issueType: rule.issueType,
          description: `Potential ${rule.issueType.replace(/_/g, ' ')}: "${match[0]}" found in evidence. Context: "...${context}..."`,
          severity: rule.severity,
          legalBasis: rule.legalBasis,
          recommendation: rule.recommendation,
          metadata: {
            matchText: match[0],
            matchIndex: match.index,
            context,
          },
        });
        break; // One match per rule per evidence
      }
    }
  }

  // Store issues
  const stored = [];
  for (const issue of issues) {
    try {
      const record = await prisma.admissibilityIssue.create({ data: issue });
      stored.push(record);
    } catch (err) {
      console.warn(`[Admissibility] Store error: ${err.message}`);
    }
  }

  console.log(`[Admissibility] Found ${stored.length} issues for evidence ${evidenceId}`);

  return {
    issues: stored,
    summary: {
      total: stored.length,
      bySeverity: {
        critical: stored.filter(i => i.severity === 'critical').length,
        high: stored.filter(i => i.severity === 'high').length,
        medium: stored.filter(i => i.severity === 'medium').length,
        low: stored.filter(i => i.severity === 'low').length,
      },
    },
  };
}

/**
 * Run admissibility analysis across all evidence in a case.
 * @param {string} caseId
 * @returns {{ issues: object[], summary: object }}
 */
export async function analyzeCaseAdmissibility(caseId) {
  const transcripts = await prisma.mediaTranscript.findMany({
    where: { caseId, fullTranscript: true, status: 'complete' },
  });

  const allIssues = [];
  for (const transcript of transcripts) {
    const result = await analyzeAdmissibility(caseId, transcript.evidenceId, transcript.transcriptText);
    allIssues.push(...result.issues);
  }

  return {
    issues: allIssues,
    summary: {
      total: allIssues.length,
      evidenceAnalyzed: transcripts.length,
      bySeverity: {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        high: allIssues.filter(i => i.severity === 'high').length,
        medium: allIssues.filter(i => i.severity === 'medium').length,
        low: allIssues.filter(i => i.severity === 'low').length,
      },
    },
  };
}

export async function getCaseAdmissibilityIssues(caseId) {
  return prisma.admissibilityIssue.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
