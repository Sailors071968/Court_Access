// ============================================================================
// Phase E.2 — Habeas / Post-Conviction Intelligence + Innocence Review Framework
// Organizes provable post-conviction issue structures. NEVER acts as habeas counsel.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// 1. Newly Discovered Evidence Tracker (citation-backed)
// ---------------------------------------------------------------------------

const NEW_EVIDENCE_PATTERNS: Record<string, { regex: RegExp; evidenceType: string }> = {
  witness_recantation: { regex: /\b(recant(ed|ation|s)?|retract(ed|ion|s)?|changed?\s+(his|her|their)\s+(story|testimony|statement))\b/i, evidenceType: 'witness_recantation' },
  dna_evidence: { regex: /\b(dna\s+(test|evidence|result|profile|match|exclusion|exonerat))\b/i, evidenceType: 'dna_evidence' },
  alibi_evidence: { regex: /\b(alibi\s+(witness|evidence|proof)|proves?\s+elsewhere|not\s+at\s+the\s+scene)\b/i, evidenceType: 'alibi_evidence' },
  third_party: { regex: /\b(third[\s-]party\s+culpability|another\s+(person|suspect|individual)\s+(commit|did|responsible)|alternative\s+suspect)\b/i, evidenceType: 'third_party_culpability' },
  government_misconduct: { regex: /\b(police\s+misconduct|officer\s+(lied|fabricat)|evidence\s+(plant|tamper)|coerced?\s+(confession|statement))\b/i, evidenceType: 'government_misconduct' },
};

export async function trackNewlyDiscoveredEvidence(caseId: string): Promise<{
  caseId: string; evidenceFound: number; entries: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  // Also check existing Brady/Giglio issues from D.6
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(NEW_EVIDENCE_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const entry = await prisma.newlyDiscoveredEvidence.create({
          data: {
            caseId,
            evidenceType: pattern.evidenceType,
            description: stmt.rawText.slice(0, 500),
            discoverySource: 'defense_investigation',
            materialityAssessment: pattern.evidenceType === 'dna_evidence' || pattern.evidenceType === 'alibi_evidence' ? 'highly_material' : 'material',
            unavailableAtTrial: true,
            diligenceShown: true,
            probableOutcomeChange: pattern.evidenceType === 'dna_evidence' ? 'probable' : 'possible',
            legalStandard: 'PC § 1473',
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: entry.id, evidenceType: pattern.evidenceType, materialityAssessment: entry.materialityAssessment });
      }
    }
  }

  // Brady issues as potential newly discovered evidence
  for (const bi of bradyIssues) {
    const entry = await prisma.newlyDiscoveredEvidence.create({
      data: {
        caseId,
        evidenceType: bi.issueType.includes('giglio') ? 'new_testimony' : 'documentary',
        description: `Brady/Giglio issue: ${bi.description.slice(0, 400)}`,
        discoverySource: 'government_disclosure',
        materialityAssessment: bi.strength === 'strong' ? 'material' : 'potentially_material',
        unavailableAtTrial: true,
        diligenceShown: true,
        probableOutcomeChange: bi.strength === 'strong' ? 'probable' : 'possible',
        legalStandard: 'Brady v. Maryland',
        citations: bi.citations,
      },
    });
    results.push({ id: entry.id, evidenceType: entry.evidenceType, source: 'brady_issue' });
  }

  return { caseId, evidenceFound: results.length, entries: results };
}

// ---------------------------------------------------------------------------
// 2. Actual Innocence Indicator Framework (deterministic)
// ---------------------------------------------------------------------------

const INNOCENCE_INDICATOR_PATTERNS: Record<string, { regex: RegExp; indicatorType: string }> = {
  misidentification: { regex: /\b(misidentif(ied|ication)|wrong\s+(person|man|woman|suspect)|eyewitness\s+error|lineup\s+(problem|issue|suggestive))\b/i, indicatorType: 'misidentification' },
  false_confession: { regex: /\b(false\s+confession|coerced?\s+(confession|admit|statement)|involuntary\s+(confession|statement))\b/i, indicatorType: 'false_confession' },
  forensic_invalidity: { regex: /\b(forensic\s+(error|mistake|invalid|debunked|junk\s+science)|bite\s+mark|hair\s+(comparison|microscop)|arson\s+investigation\s+(flawed|discredited))\b/i, indicatorType: 'forensic_invalidity' },
  witness_bias: { regex: /\b(informant|jailhouse\s+snitch|cooperat(ing|or)\s+witness|incentivized\s+(witness|testimony))\b/i, indicatorType: 'witness_bias' },
};

export async function assessActualInnocenceIndicators(caseId: string): Promise<{
  caseId: string; indicatorsFound: number; indicators: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  // Pull in contradiction data for strength assessment
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId, severity: { in: ['critical', 'high'] } } });
  const burdenScores = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  const recantations = await prisma.witnessRecantation.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(INNOCENCE_INDICATOR_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const hasContradictionSupport = contradictions.some(c =>
          c.statementAText.includes(stmt.speaker || '') || c.statementBText.includes(stmt.speaker || '')
        );

        const hasBurdenCollapse = burdenScores.some(b => b.collapseLevel === 'collapsed');

        let strength: string;
        if (hasContradictionSupport && hasBurdenCollapse) strength = 'strong';
        else if (hasContradictionSupport || hasBurdenCollapse) strength = 'moderate';
        else strength = 'weak';

        let schlupStandard: string;
        if (strength === 'strong') schlupStandard = 'Meets Schlup gateway';
        else if (strength === 'moderate') schlupStandard = 'Arguable';
        else schlupStandard = 'Does not meet';

        const indicator = await prisma.actualInnocenceIndicator.create({
          data: {
            caseId,
            indicatorType: pattern.indicatorType,
            description: stmt.rawText.slice(0, 500),
            strength,
            supportingEvidence: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
            contraryEvidence: JSON.stringify([]),
            schlupStandard,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: indicator.id, indicatorType: pattern.indicatorType, strength, schlupStandard });
      }
    }
  }

  // Recantation-based innocence indicators
  for (const r of recantations) {
    const indicator = await prisma.actualInnocenceIndicator.create({
      data: {
        caseId,
        indicatorType: 'recantation',
        description: `Witness recantation by ${r.witnessName}: original testimony recanted.`,
        strength: r.credibilityOfRecantation === 'high' ? 'strong' : r.credibilityOfRecantation === 'medium' ? 'moderate' : 'weak',
        supportingEvidence: r.corroboration,
        contraryEvidence: JSON.stringify([]),
        schlupStandard: r.materialityToConviction === 'critical' && r.credibilityOfRecantation === 'high' ? 'Meets Schlup gateway' : 'Arguable',
        citations: r.citations,
      },
    });
    results.push({ id: indicator.id, indicatorType: 'recantation', witness: r.witnessName });
  }

  return { caseId, indicatorsFound: results.length, indicators: results };
}

// ---------------------------------------------------------------------------
// 3. Ineffective Assistance Issue Tracking (citation-required)
// ---------------------------------------------------------------------------

export async function trackIneffectiveAssistance(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  // Cross-reference E.1 waiver/forfeiture issues (forfeited = potential IAC)
  const forfeitedIssues = await prisma.waiverForfeitureIssue.findMany({
    where: { caseId, issueType: 'forfeiture' },
  });

  // D.6 evidentiary objections that were identified but not raised
  const unreaisedObjections = await prisma.evidentiaryObjection.findMany({
    where: { caseId, status: 'identified', strength: 'strong' },
  });

  const results: Array<Record<string, unknown>> = [];

  // Forfeited issues → failure to preserve
  for (const fi of forfeitedIssues) {
    const issue = await prisma.ineffectiveAssistanceIssue.create({
      data: {
        caseId,
        deficiencyType: 'failure_to_preserve',
        description: fi.issueDescription,
        stricklandDeficiency: `Counsel failed to preserve ${fi.potentialAppellateIssue} by not making a timely and specific objection. This falls below the objective standard of reasonableness under Strickland v. Washington, 466 U.S. 668.`,
        stricklandPrejudice: `Had counsel preserved this issue, there is a reasonable probability the appellate court would have found error requiring reversal.`,
        trialPhase: fi.trialPhase,
        meritAssessment: fi.exceptionApplicable === 'constitutional_magnitude' ? 'strong' : 'moderate',
        citations: fi.citations,
      },
    });
    results.push({ id: issue.id, deficiencyType: 'failure_to_preserve', meritAssessment: issue.meritAssessment });
  }

  // Strong unraised objections → failure to object
  for (const uo of unreaisedObjections) {
    const issue = await prisma.ineffectiveAssistanceIssue.create({
      data: {
        caseId,
        deficiencyType: 'failure_to_object',
        description: `Strong ${uo.objectionType} objection (${uo.evidenceCodeSection}) identified but never raised at trial.`,
        stricklandDeficiency: `Counsel failed to raise a meritorious ${uo.objectionType} objection under ${uo.evidenceCodeSection}. A reasonably competent attorney would have objected to this evidence.`,
        stricklandPrejudice: `The improperly admitted evidence may have influenced the jury's verdict. Without this evidence, there is a reasonable probability of a different outcome.`,
        trialPhase: 'prosecution_case',
        relatedObjectionId: uo.id,
        meritAssessment: 'moderate',
        citations: JSON.stringify([{
          text: uo.citedText,
          page: uo.citedPage,
          line: uo.citedLine,
          document: uo.citedDocument,
        }]),
      },
    });
    results.push({ id: issue.id, deficiencyType: 'failure_to_object', objectionType: uo.objectionType });
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 4. Brady/Giglio Reassessment Engine (deterministic)
// ---------------------------------------------------------------------------

export async function reassessBradyGiglio(caseId: string): Promise<{
  caseId: string; reassessmentsCreated: number; reassessments: Array<Record<string, unknown>>;
}> {
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const discoveryViolations = await prisma.discoveryViolation.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  // Reassess each Brady/Giglio issue from D.6
  for (const bi of bradyIssues) {
    const reassessment = await prisma.bradyGiglioReassessment.create({
      data: {
        caseId,
        originalBradyIssueId: bi.id,
        reassessmentType: bi.issueType.includes('giglio') ? 'giglio_impeachment' : 'undisclosed_evidence',
        description: `Post-conviction reassessment of ${bi.issueType}: ${bi.description.slice(0, 300)}`,
        materialityAnalysis: bi.strength === 'strong'
          ? 'Material — reasonable probability of different result had evidence been disclosed.'
          : 'Materiality arguable — requires further analysis under Kyles cumulative standard.',
        favorabilityAnalysis: 'Favorable to defense',
        suppressionAnalysis: 'Government knew or should have known — prosecution has constructive knowledge of all evidence in government possession.',
        cumulativeWithOther: bradyIssues.length > 1,
        kylesBagleyStandard: bradyIssues.length > 1
          ? `Kyles v. Whitley, 514 U.S. 419: Cumulative analysis of ${bradyIssues.length} suppressed items. Materiality assessed collectively, not item-by-item.`
          : `Bagley/Brady standard: The evidence is material if there is a reasonable probability that, had the evidence been disclosed, the result of the proceeding would have been different. United States v. Bagley, 473 U.S. 667.`,
        citations: bi.citations,
      },
    });
    results.push({ id: reassessment.id, reassessmentType: reassessment.reassessmentType, originalBradyIssueId: bi.id });
  }

  // Discovery violations as potential Brady issues
  for (const dv of discoveryViolations) {
    if (dv.violationType === 'withheld_evidence' || dv.violationType === 'late_disclosure') {
      const reassessment = await prisma.bradyGiglioReassessment.create({
        data: {
          caseId,
          reassessmentType: 'undisclosed_evidence',
          description: `Discovery violation (${dv.violationType}): ${dv.description.slice(0, 300)}`,
          materialityAnalysis: 'Materiality requires assessment — withheld or late-disclosed evidence may constitute Brady violation.',
          favorabilityAnalysis: dv.violationType === 'withheld_evidence' ? 'Favorable to defense' : 'Unclear',
          suppressionAnalysis: 'Government knew or should have known',
          cumulativeWithOther: true,
          kylesBagleyStandard: 'Kyles v. Whitley cumulative analysis applies when multiple items were suppressed.',
          citations: dv.citations,
        },
      });
      results.push({ id: reassessment.id, reassessmentType: 'undisclosed_evidence', source: 'discovery_violation' });
    }
  }

  return { caseId, reassessmentsCreated: results.length, reassessments: results };
}

// ---------------------------------------------------------------------------
// 5. Forensic Reliability Reassessment (evidence-linked)
// ---------------------------------------------------------------------------

const FORENSIC_RELIABILITY_MAP: Record<string, { currentScientificStatus: string; reliabilityScore: number; nasRelevant: boolean; pcatRelevant: boolean }> = {
  bite_mark: { currentScientificStatus: 'debunked', reliabilityScore: 0.1, nasRelevant: true, pcatRelevant: true },
  hair_comparison: { currentScientificStatus: 'questioned', reliabilityScore: 0.2, nasRelevant: true, pcatRelevant: true },
  arson_investigation: { currentScientificStatus: 'questioned', reliabilityScore: 0.3, nasRelevant: true, pcatRelevant: false },
  blood_spatter: { currentScientificStatus: 'questioned', reliabilityScore: 0.4, nasRelevant: true, pcatRelevant: false },
  fiber_analysis: { currentScientificStatus: 'questioned', reliabilityScore: 0.3, nasRelevant: true, pcatRelevant: false },
  toolmark: { currentScientificStatus: 'questioned', reliabilityScore: 0.4, nasRelevant: true, pcatRelevant: true },
  shoeprint: { currentScientificStatus: 'questioned', reliabilityScore: 0.4, nasRelevant: true, pcatRelevant: false },
  fingerprint: { currentScientificStatus: 'validated', reliabilityScore: 0.8, nasRelevant: true, pcatRelevant: true },
  ballistics: { currentScientificStatus: 'under_review', reliabilityScore: 0.5, nasRelevant: true, pcatRelevant: true },
  dna: { currentScientificStatus: 'validated', reliabilityScore: 0.95, nasRelevant: false, pcatRelevant: true },
  drug_testing: { currentScientificStatus: 'validated', reliabilityScore: 0.85, nasRelevant: false, pcatRelevant: false },
};

const FORENSIC_PATTERNS: Record<string, RegExp> = {
  bite_mark: /\b(bite\s+mark|dental\s+impression|odontolog)\b/i,
  hair_comparison: /\b(hair\s+(comparison|microscop|analysis)|microscopic\s+hair)\b/i,
  arson_investigation: /\b(arson\s+(investigation|expert|analysis)|fire\s+(investigation|origin|cause))\b/i,
  blood_spatter: /\b(blood\s+(spatter|stain)\s+(pattern|analysis)|bpa)\b/i,
  fingerprint: /\b(fingerprint|latent\s+print|friction\s+ridge)\b/i,
  ballistics: /\b(ballistic|firearm|bullet\s+(comparison|match)|shell\s+casing)\b/i,
  dna: /\b(dna\s+(test|evidence|result|profile|match|mixture))\b/i,
  toolmark: /\b(tool\s*mark|striation\s+analysis)\b/i,
};

export async function reassessForensicReliability(caseId: string): Promise<{
  caseId: string; reassessmentsCreated: number; reassessments: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const [forensicType, regex] of Object.entries(FORENSIC_PATTERNS)) {
      if (regex.test(stmt.rawText) && !processedTypes.has(forensicType)) {
        processedTypes.add(forensicType);

        const reliability = FORENSIC_RELIABILITY_MAP[forensicType] || { currentScientificStatus: 'under_review', reliabilityScore: 0.5, nasRelevant: false, pcatRelevant: false };

        const reassessment = await prisma.forensicReliabilityReassessment.create({
          data: {
            caseId,
            forensicType,
            originalConclusion: stmt.rawText.slice(0, 300),
            currentScientificStatus: reliability.currentScientificStatus,
            reliabilityScore: reliability.reliabilityScore,
            nasReport2009Relevant: reliability.nasRelevant,
            pcatRelevant: reliability.pcatRelevant,
            retestingRecommended: reliability.reliabilityScore < 0.5,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({
          id: reassessment.id,
          forensicType,
          currentScientificStatus: reliability.currentScientificStatus,
          reliabilityScore: reliability.reliabilityScore,
          retestingRecommended: reassessment.retestingRecommended,
        });
      }
    }
  }

  return { caseId, reassessmentsCreated: results.length, reassessments: results };
}

// ---------------------------------------------------------------------------
// 6. Witness Recantation Analysis (citation-backed)
// ---------------------------------------------------------------------------

export async function analyzeWitnessRecantations(caseId: string): Promise<{
  caseId: string; recantationsFound: number; recantations: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  // Find inconsistencies from D.3 that might indicate recantation patterns
  const witnessInconsistencies = await prisma.witnessInconsistency.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];
  const recantationStatements = statements.filter(s =>
    /\b(recant|retract|changed?\s+(his|her|their)\s+(story|testimony|statement)|take\s+(it\s+)?back|not\s+true|lied|wasn'?t\s+honest)\b/i.test(s.rawText)
  );

  for (const stmt of recantationStatements) {
    const recantation = await prisma.witnessRecantation.create({
      data: {
        caseId,
        witnessName: stmt.speaker || 'Unknown Witness',
        originalTestimony: 'See trial testimony',
        recantedTestimony: stmt.rawText.slice(0, 500),
        recantationContext: /\b(coerce|force|pressure|threaten)\b/i.test(stmt.rawText) ? 'coerced_original' : 'conscience',
        credibilityOfRecantation: /\b(coerce|force|pressure)\b/i.test(stmt.rawText) ? 'high' : 'medium',
        materialityToConviction: 'significant',
        corroboration: JSON.stringify([]),
        citations: JSON.stringify([{
          text: stmt.rawText.slice(0, 200),
          page: stmt.page,
          line: stmt.lineStart,
          speaker: stmt.speaker,
          document: stmt.document?.fileName || null,
        }]),
      },
    });
    results.push({ id: recantation.id, witnessName: recantation.witnessName, credibilityOfRecantation: recantation.credibilityOfRecantation });
  }

  // Witnesses with high inconsistency counts are recantation candidates
  const witnessCounts = new Map<string, number>();
  for (const wi of witnessInconsistencies) {
    const count = witnessCounts.get(wi.speaker) || 0;
    witnessCounts.set(wi.speaker, count + 1);
  }

  for (const [witness, count] of witnessCounts) {
    if (count >= 3) {
      const hasRecantation = results.some(r => (r as { witnessName?: string }).witnessName === witness);
      if (!hasRecantation) {
        const inconsistencies = witnessInconsistencies.filter(wi => wi.speaker === witness);
        const recantation = await prisma.witnessRecantation.create({
          data: {
            caseId,
            witnessName: witness,
            originalTestimony: `Multiple inconsistent statements (${count} inconsistencies identified)`,
            recantedTestimony: `Witness has given ${count} materially inconsistent accounts — pattern suggests unreliable or changing testimony.`,
            recantationContext: 'new_information',
            credibilityOfRecantation: count >= 5 ? 'high' : 'medium',
            materialityToConviction: 'significant',
            corroboration: JSON.stringify(inconsistencies.slice(0, 5).map(i => ({
              text: i.explanation.slice(0, 100),
            }))),
            citations: JSON.stringify(inconsistencies.slice(0, 3).map(i => ({
              text: i.explanation.slice(0, 100),
            }))),
          },
        });
        results.push({ id: recantation.id, witnessName: witness, inconsistencyCount: count });
      }
    }
  }

  return { caseId, recantationsFound: results.length, recantations: results };
}

// ---------------------------------------------------------------------------
// 7. Cumulative Constitutional Error Analysis (deterministic)
// ---------------------------------------------------------------------------

export async function analyzeCumulativeConstitutionalError(caseId: string): Promise<{
  caseId: string; analysis: Record<string, unknown>;
}> {
  // Gather all error types from E.1 and D.6
  const [harmlessErrors, constitutionalClaims, _errorPreservation, prosecutorialMisconduct] = await Promise.all([
    prisma.harmlessPrejudicialError.findMany({ where: { caseId } }),
    prisma.constitutionalClaimPreservation.findMany({ where: { caseId } }),
    prisma.errorPreservationRecord.findMany({ where: { caseId } }),
    prisma.prosecutorialMisconductEntry.findMany({ where: { caseId } }),
  ]);

  const errorIds: string[] = [
    ...harmlessErrors.map(e => e.id),
    ...constitutionalClaims.map(c => c.id),
    ...prosecutorialMisconduct.filter(m => m.preservedForAppeal).map(m => m.id),
  ];

  const totalErrors = errorIds.length;
  const individuallyHarmless = harmlessErrors.filter(e => e.prejudiceLevel === 'harmless' || e.prejudiceLevel === 'harmless_beyond_reasonable_doubt').length;

  // Cumulative prejudice formula: each individually harmless error adds 0.15, prejudicial adds 0.3, structural adds 0.5
  let cumulativePrejudice = 0;
  for (const he of harmlessErrors) {
    if (he.prejudiceLevel === 'structural') cumulativePrejudice += 0.5;
    else if (he.prejudiceLevel === 'prejudicial') cumulativePrejudice += 0.3;
    else if (he.prejudiceLevel === 'harmless_beyond_reasonable_doubt') cumulativePrejudice += 0.15;
    else cumulativePrejudice += 0.1;
  }
  for (const pm of prosecutorialMisconduct) {
    if (pm.preservedForAppeal) cumulativePrejudice += pm.prejudiceLevel === 'prejudicial' ? 0.25 : 0.1;
  }
  cumulativePrejudice = round(Math.min(1.0, cumulativePrejudice));

  let prejudiceLevel: string;
  let collectivelyPrejudicial: boolean;

  if (cumulativePrejudice >= 0.8) {
    prejudiceLevel = 'cumulative_reversal';
    collectivelyPrejudicial = true;
  } else if (cumulativePrejudice >= 0.5) {
    prejudiceLevel = 'significant_cumulative';
    collectivelyPrejudicial = true;
  } else if (cumulativePrejudice >= 0.3) {
    prejudiceLevel = 'moderate_cumulative';
    collectivelyPrejudicial = false;
  } else {
    prejudiceLevel = 'minimal_cumulative';
    collectivelyPrejudicial = false;
  }

  const hillAnalysis = collectivelyPrejudicial
    ? `People v. Hill, 17 Cal.4th 800: ${totalErrors} errors identified, ${individuallyHarmless} individually harmless. Cumulative prejudice score: ${(cumulativePrejudice * 100).toFixed(0)}%. The combination of multiple errors, even if individually harmless, created a fundamentally unfair trial.`
    : `People v. Hill cumulative error analysis: ${totalErrors} errors identified. Cumulative prejudice score: ${(cumulativePrejudice * 100).toFixed(0)}%. Errors do not rise to the level of cumulative prejudice requiring reversal.`;

  const analysis = await prisma.cumulativeConstitutionalError.create({
    data: {
      caseId,
      errorIds: JSON.stringify(errorIds),
      totalErrors,
      cumulativePrejudice,
      prejudiceLevel,
      individuallyHarmless,
      collectivelyPrejudicial,
      hillAnalysis,
      citations: JSON.stringify(harmlessErrors.slice(0, 5).map(e => ({ errorId: e.id, prejudiceLevel: e.prejudiceLevel }))),
    },
  });

  return {
    caseId,
    analysis: {
      id: analysis.id,
      totalErrors,
      cumulativePrejudice,
      prejudiceLevel,
      individuallyHarmless,
      collectivelyPrejudicial,
    },
  };
}

// ---------------------------------------------------------------------------
// 8. Post-Conviction Timeline Reconstruction (evidence-linked)
// ---------------------------------------------------------------------------

export async function reconstructPostConvictionTimeline(caseId: string): Promise<{
  caseId: string; eventsCreated: number; events: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];

  const TIMELINE_PATTERNS: Record<string, { regex: RegExp; eventType: string; significance: string }> = {
    conviction: { regex: /\b(found\s+guilty|convict(ed|ion)|verdict\s+of\s+guilty)\b/i, eventType: 'conviction', significance: 'Conviction establishes starting point for appellate and habeas deadlines.' },
    sentencing: { regex: /\b(sentenc(ed|ing)|imposed\s+(a\s+)?sentence|prison\s+term)\b/i, eventType: 'sentencing', significance: 'Sentencing triggers direct appeal clock and custody calculation.' },
    appeal_filed: { regex: /\b(notice\s+of\s+appeal|appeal\s+filed|appealed?\s+the\s+(conviction|judgment))\b/i, eventType: 'appeal_filed', significance: 'Direct appeal preserves federal habeas rights if timely filed.' },
    new_evidence: { regex: /\b(new(ly)?\s+discovered?\s+evidence|previously\s+unavailable)\b/i, eventType: 'new_evidence', significance: 'New evidence may restart statute of limitations under PC § 1473.' },
    dna_test: { regex: /\b(dna\s+test(ing|ed)?|genetic\s+analysis|codis)\b/i, eventType: 'dna_test', significance: 'DNA testing results may support PC § 1405 motion or habeas petition.' },
  };

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(TIMELINE_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const event = await prisma.postConvictionTimeline.create({
          data: {
            caseId,
            eventType: pattern.eventType,
            eventDate: stmt.document?.createdAt?.toISOString().split('T')[0] || 'Unknown',
            description: stmt.rawText.slice(0, 500),
            legalSignificance: pattern.significance,
            deadlineImplication: pattern.eventType === 'conviction'
              ? 'Direct appeal: 60 days from sentencing. State habeas: no strict deadline but unreasonable delay may bar relief.'
              : pattern.eventType === 'sentencing'
              ? 'Federal habeas: 1 year from final judgment (28 USC § 2244(d)). Tolled during state post-conviction proceedings.'
              : null,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: event.id, eventType: pattern.eventType });
      }
    }
  }

  return { caseId, eventsCreated: results.length, events: results };
}

// ---------------------------------------------------------------------------
// 9. DNA/Forensic Testing Issue Indexing (deterministic)
// ---------------------------------------------------------------------------

export async function indexDnaForensicTestingIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const forensicReassessments = await prisma.forensicReliabilityReassessment.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  const DNA_PATTERNS: Record<string, { regex: RegExp; issueType: string }> = {
    untested_evidence: { regex: /\b(untested|not\s+tested|testing\s+not\s+(performed|done|completed))\b/i, issueType: 'untested_evidence' },
    degraded_sample: { regex: /\b(degraded|deteriorat(ed|ing)|insufficient\s+sample|partial\s+profile)\b/i, issueType: 'degraded_sample' },
    new_technology: { regex: /\b(new\s+technology|touch\s+dna|low[\s-]copy[\s-]number|next[\s-]gen|probabilistic\s+genotyping)\b/i, issueType: 'new_technology' },
    lab_error: { regex: /\b(lab\s+(error|mistake|contamination)|quality\s+control\s+(failure|issue))\b/i, issueType: 'lab_error' },
    mixture: { regex: /\b(mixture\s+(interpretation|profile)|mixed\s+(dna|sample|profile))\b/i, issueType: 'mixture_interpretation' },
  };

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(DNA_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const issue = await prisma.dnaForensicTestingIssue.create({
          data: {
            caseId,
            issueType: pattern.issueType,
            evidenceDescription: stmt.rawText.slice(0, 500),
            currentStatus: pattern.issueType === 'untested_evidence' ? 'untested' : 'pending',
            pc1405Applicable: pattern.issueType === 'untested_evidence' || pattern.issueType === 'new_technology',
            testingRecommendation: pattern.issueType === 'untested_evidence' || pattern.issueType === 'new_technology' ? 'recommended' : 'conditional',
            potentialOutcome: 'unknown',
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: issue.id, issueType: pattern.issueType, pc1405Applicable: issue.pc1405Applicable });
      }
    }
  }

  // Forensic reassessments with low reliability → retesting recommendation
  for (const fr of forensicReassessments) {
    if (fr.retestingRecommended) {
      const issue = await prisma.dnaForensicTestingIssue.create({
        data: {
          caseId,
          issueType: 'retesting_needed',
          evidenceDescription: `${fr.forensicType} evidence has reliability score of ${(fr.reliabilityScore * 100).toFixed(0)}% (${fr.currentScientificStatus}). Retesting with modern methods recommended.`,
          currentStatus: 'pending',
          pc1405Applicable: fr.forensicType === 'dna',
          testingRecommendation: 'recommended',
          potentialOutcome: 'unknown',
          citations: fr.citations,
        },
      });
      results.push({ id: issue.id, issueType: 'retesting_needed', forensicType: fr.forensicType });
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 10. Full Post-Conviction Intelligence Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullPostConvictionIntelligence(caseId: string): Promise<Record<string, unknown>> {
  const recantations = await analyzeWitnessRecantations(caseId);
  const newEvidence = await trackNewlyDiscoveredEvidence(caseId);
  const innocenceIndicators = await assessActualInnocenceIndicators(caseId);
  const ineffectiveAssistance = await trackIneffectiveAssistance(caseId);
  const bradyReassessment = await reassessBradyGiglio(caseId);
  const forensicReassessment = await reassessForensicReliability(caseId);
  const cumulativeError = await analyzeCumulativeConstitutionalError(caseId);
  const timeline = await reconstructPostConvictionTimeline(caseId);
  const dnaIssues = await indexDnaForensicTestingIssues(caseId);

  return {
    caseId,
    summary: {
      newlyDiscoveredEvidence: newEvidence.evidenceFound,
      actualInnocenceIndicators: innocenceIndicators.indicatorsFound,
      ineffectiveAssistanceIssues: ineffectiveAssistance.issuesFound,
      bradyGiglioReassessments: bradyReassessment.reassessmentsCreated,
      forensicReassessments: forensicReassessment.reassessmentsCreated,
      witnessRecantations: recantations.recantationsFound,
      cumulativeConstitutionalError: cumulativeError.analysis,
      postConvictionTimelineEvents: timeline.eventsCreated,
      dnaForensicTestingIssues: dnaIssues.issuesFound,
    },
    principle: 'CourtAccess organizes provable post-conviction issue structures. It does NOT act as habeas counsel.',
  };
}
