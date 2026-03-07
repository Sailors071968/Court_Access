// ============================================
// Court Access — Legal Reasoning Service
// Phase I: Apply legal rules to verified facts
// to generate legal conclusions
// ============================================

import prisma from './prismaClient.js';

const LEGAL_ELEMENTS = {
  fourth_amendment: {
    name: 'Fourth Amendment Analysis',
    elements: [
      { id: 'search_occurred', description: 'A search or seizure occurred' },
      { id: 'government_action', description: 'Conducted by government actor' },
      { id: 'reasonable_expectation', description: 'Defendant had reasonable expectation of privacy' },
      { id: 'no_warrant', description: 'No valid warrant was obtained' },
      { id: 'no_exception', description: 'No exception to warrant requirement applies' },
    ],
  },
  fifth_amendment: {
    name: 'Fifth Amendment / Miranda Analysis',
    elements: [
      { id: 'custodial', description: 'Defendant was in custody' },
      { id: 'interrogation', description: 'Interrogation occurred' },
      { id: 'no_warnings', description: 'Miranda warnings not given' },
      { id: 'no_waiver', description: 'No valid waiver of rights' },
    ],
  },
  speedy_trial: {
    name: 'Speedy Trial Analysis (Barker v. Wingo)',
    elements: [
      { id: 'length_of_delay', description: 'Length of delay is presumptively prejudicial' },
      { id: 'reason_for_delay', description: 'Government responsible for delay' },
      { id: 'assertion_of_right', description: 'Defendant asserted speedy trial right' },
      { id: 'prejudice', description: 'Defendant suffered prejudice from delay' },
    ],
  },
  identification: {
    name: 'Identification Reliability (Manson v. Brathwaite)',
    elements: [
      { id: 'suggestive_procedure', description: 'Identification procedure was suggestive' },
      { id: 'opportunity_to_view', description: 'Witness opportunity to view was limited' },
      { id: 'attention_level', description: 'Witness attention level was low' },
      { id: 'accuracy_of_description', description: 'Prior description was inaccurate' },
      { id: 'time_between', description: 'Significant time elapsed between event and identification' },
      { id: 'certainty_level', description: 'Witness certainty level questionable' },
    ],
  },
};

/**
 * Apply legal reasoning to case facts.
 * @param {string} caseId
 * @param {string} analysisType - Key from LEGAL_ELEMENTS
 * @returns {object} LegalAnalysis record
 */
export async function applyLegalReasoning(caseId, analysisType) {
  console.log(`[LegalReasoning] Applying ${analysisType} analysis to case ${caseId}`);

  const template = LEGAL_ELEMENTS[analysisType];
  if (!template) throw new Error(`Unknown analysis type: ${analysisType}`);

  const [facts, legalIssues, admissibility, inferences] = await Promise.all([
    prisma.verifiedFact.findMany({ where: { caseId, verificationStatus: { not: 'merged' } } }),
    prisma.legalIssue.findMany({ where: { caseId } }),
    prisma.admissibilityIssue.findMany({ where: { caseId } }),
    prisma.factInference.findMany({ where: { caseId } }),
  ]);

  const elementAnalysis = [];

  for (const element of template.elements) {
    const supporting = findSupportingEvidence(element.id, facts, legalIssues, admissibility, inferences);
    const met = supporting.length > 0;
    const confidence = met ? Math.min(...supporting.map(s => s.confidence || 0.5)) : 0;

    elementAnalysis.push({
      elementId: element.id,
      description: element.description,
      isMet: met,
      confidence,
      supportingEvidence: supporting,
    });
  }

  const metElements = elementAnalysis.filter(e => e.isMet).length;
  const totalElements = elementAnalysis.length;
  const overallStrength = totalElements > 0 ? Math.round((metElements / totalElements) * 100) / 100 : 0;

  let conclusion = 'insufficient_evidence';
  if (overallStrength >= 0.8) conclusion = 'strong_argument';
  else if (overallStrength >= 0.5) conclusion = 'moderate_argument';
  else if (overallStrength >= 0.25) conclusion = 'weak_argument';

  const record = await prisma.legalAnalysis.create({
    data: {
      caseId,
      analysisType,
      analysisName: template.name,
      elements: elementAnalysis,
      metElements,
      totalElements,
      overallStrength,
      conclusion,
      metadata: {
        analyzedAt: new Date().toISOString(),
        factCount: facts.length,
        issueCount: legalIssues.length,
      },
    },
  });

  console.log(`[LegalReasoning] ${analysisType}: ${conclusion} (${metElements}/${totalElements} elements met)`);
  return record;
}

function findSupportingEvidence(elementId, facts, legalIssues, admissibility, inferences) {
  const supporting = [];

  // Map element IDs to fact/issue patterns
  const patterns = {
    search_occurred: { factTypes: ['EVENT'], keywords: ['search', 'seized', 'found', 'discovered'] },
    government_action: { factTypes: ['PERSON'], keywords: ['officer', 'detective', 'agent', 'police'] },
    reasonable_expectation: { factTypes: ['LOCATION'], keywords: ['home', 'car', 'vehicle', 'property'] },
    no_warrant: { issueTypes: ['illegal_search'] },
    no_exception: { issueTypes: ['illegal_search'] },
    custodial: { factTypes: ['EVENT'], keywords: ['arrested', 'detained', 'custody', 'handcuffed'] },
    interrogation: { factTypes: ['EVENT'], keywords: ['questioned', 'interrogated', 'asked', 'interview'] },
    no_warnings: { issueTypes: ['miranda_violation'] },
    no_waiver: { issueTypes: ['miranda_violation'] },
    suggestive_procedure: { issueTypes: ['suggestive_identification'] },
    opportunity_to_view: { factTypes: ['TIME'], keywords: ['brief', 'seconds', 'glimpse', 'moment'] },
  };

  const pattern = patterns[elementId];
  if (!pattern) return [];

  if (pattern.factTypes) {
    for (const fact of facts) {
      if (pattern.factTypes.includes(fact.factType)) {
        const text = fact.factText.toLowerCase();
        if (pattern.keywords?.some(kw => text.includes(kw))) {
          supporting.push({ type: 'fact', id: fact.id, text: fact.factText, confidence: fact.confidence });
        }
      }
    }
  }

  if (pattern.issueTypes) {
    for (const issue of legalIssues) {
      if (pattern.issueTypes.includes(issue.issueType)) {
        supporting.push({ type: 'legal_issue', id: issue.id, text: issue.description, confidence: 0.7 });
      }
    }
    for (const issue of admissibility) {
      if (pattern.issueTypes.includes(issue.issueType)) {
        supporting.push({ type: 'admissibility', id: issue.id, text: issue.description, confidence: 0.7 });
      }
    }
  }

  return supporting;
}

/**
 * Run all applicable legal analyses for a case.
 * @param {string} caseId
 * @returns {{ analyses: object[], summary: object }}
 */
export async function runFullLegalAnalysis(caseId) {
  const analyses = [];
  for (const analysisType of Object.keys(LEGAL_ELEMENTS)) {
    try {
      const result = await applyLegalReasoning(caseId, analysisType);
      analyses.push(result);
    } catch (err) {
      console.warn(`[LegalReasoning] Failed ${analysisType}: ${err.message}`);
    }
  }

  return {
    analyses,
    summary: {
      total: analyses.length,
      strongArguments: analyses.filter(a => a.conclusion === 'strong_argument').length,
      moderateArguments: analyses.filter(a => a.conclusion === 'moderate_argument').length,
      weakArguments: analyses.filter(a => a.conclusion === 'weak_argument').length,
    },
  };
}

export async function getCaseLegalAnalyses(caseId) {
  return prisma.legalAnalysis.findMany({
    where: { caseId },
    orderBy: { overallStrength: 'desc' },
  });
}
