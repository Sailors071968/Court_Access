// ============================================================================
// Phase E.1 — Appellate Record Intelligence + Error Preservation Framework
// Organizes provable appellate issue structures. NEVER functions as appellate counsel.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// 1. Error Preservation Tracking
// ---------------------------------------------------------------------------

const ERROR_PATTERNS: Record<string, { regex: RegExp; errorType: string; legalBasis: string }> = {
  objection_sustained: { regex: /\b(objection\s+sustained|sustained\s+the\s+objection|the\s+court\s+sustained)\b/i, errorType: 'objection_sustained', legalBasis: 'EC § 353' },
  objection_overruled: { regex: /\b(objection\s+overruled|overruled\s+the\s+objection|the\s+court\s+overruled)\b/i, errorType: 'objection_overruled', legalBasis: 'EC § 353' },
  motion_denied: { regex: /\b(motion\s+(is\s+)?denied|denied\s+the\s+motion|court\s+denies)\b/i, errorType: 'motion_denied', legalBasis: 'PC § 1538.5' },
  motion_granted: { regex: /\b(motion\s+(is\s+)?granted|granted\s+the\s+motion|court\s+grants)\b/i, errorType: 'motion_granted', legalBasis: 'PC § 1538.5' },
  mistrial_denied: { regex: /\b(mistrial\s+(is\s+)?denied|denied\s+mistrial)\b/i, errorType: 'motion_denied', legalBasis: 'PC § 1140' },
};

const PRESERVATION_PATTERNS: Record<string, RegExp> = {
  defense_objection: /\b(defense\s+objects?|counsel\s+objects?|defendant\s+objects?)\b/i,
  motion_in_limine: /\b(motion\s+in\s+limine|in\s+limine)\b/i,
  written_motion: /\b(written\s+motion|filed\s+motion|motion\s+to\s+suppress|motion\s+to\s+exclude)\b/i,
  oral_motion: /\b(oral\s+motion|moves?\s+orally)\b/i,
  jury_instruction_request: /\b(request(ed|s)?\s+instruction|proposed\s+instruction)\b/i,
  standing_objection: /\b(standing\s+objection|continuing\s+objection)\b/i,
};

const TRIAL_PHASE_PATTERNS: Record<string, RegExp> = {
  pretrial: /\b(pretrial|pre-trial|preliminary\s+hearing)\b/i,
  jury_selection: /\b(voir\s+dire|jury\s+selection)\b/i,
  opening: /\b(opening\s+statement)\b/i,
  prosecution_case: /\b(people'?s?\s+case|prosecution\s+(case|rests?))\b/i,
  defense_case: /\b(defense\s+case|defendant'?s?\s+case)\b/i,
  rebuttal: /\b(rebuttal)\b/i,
  closing: /\b(closing\s+argument|summation)\b/i,
  jury_instructions: /\b(jury\s+instruction|charge\s+to\s+the\s+jury)\b/i,
  sentencing: /\b(sentencing|sentence\s+hearing)\b/i,
};

export async function trackErrorPreservation(caseId: string): Promise<{
  caseId: string; errorsFound: number; records: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(ERROR_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        let preservedBy = 'defense_objection';
        for (const [method, methodRegex] of Object.entries(PRESERVATION_PATTERNS)) {
          if (methodRegex.test(stmt.rawText)) { preservedBy = method; break; }
        }

        let trialPhase = 'prosecution_case';
        for (const [phase, phaseRegex] of Object.entries(TRIAL_PHASE_PATTERNS)) {
          if (phaseRegex.test(stmt.rawText)) { trialPhase = phase; break; }
        }

        const preservationStatus = /\b(objection|object|objects)\b/i.test(stmt.rawText) ? 'preserved' : 'partially_preserved';

        const record = await prisma.errorPreservationRecord.create({
          data: {
            caseId,
            errorType: pattern.errorType,
            errorDescription: stmt.rawText.slice(0, 500),
            preservedBy,
            preservationStatus,
            legalBasis: pattern.legalBasis,
            trialPhase,
            judgeResponse: pattern.errorType.includes('sustained') ? 'sustained'
              : pattern.errorType.includes('overruled') ? 'overruled'
              : pattern.errorType.includes('denied') ? 'denied'
              : pattern.errorType.includes('granted') ? 'granted' : null,
            citedText: stmt.rawText.slice(0, 300),
            citedPage: stmt.page,
            citedLine: stmt.lineStart,
            citedDocument: stmt.document?.fileName || null,
            appellateRelevance: pattern.errorType === 'objection_overruled' || pattern.errorType === 'motion_denied' ? 'high' : 'medium',
            standardOfReview: pattern.errorType.includes('motion') ? 'abuse_of_discretion' : 'harmless_error',
          },
        });
        results.push({ id: record.id, errorType: record.errorType, preservationStatus: record.preservationStatus, appellateRelevance: record.appellateRelevance });
      }
    }
  }

  return { caseId, errorsFound: results.length, records: results };
}

// ---------------------------------------------------------------------------
// 2. Objection History Graph
// ---------------------------------------------------------------------------

const OBJECTION_TYPE_PATTERNS: Record<string, { regex: RegExp; ecSection: string }> = {
  hearsay: { regex: /\b(hearsay|out[\s-]of[\s-]court\s+statement)\b/i, ecSection: 'EC § 1200' },
  foundation: { regex: /\b(foundation|lack(s|ing)?\s+(of\s+)?foundation)\b/i, ecSection: 'EC § 403' },
  relevance: { regex: /\b(relevan(ce|t)|irrelevant)\b/i, ecSection: 'EC § 350' },
  prejudice_352: { regex: /\b(352|unduly?\s+prejudic(e|ial)|more\s+prejudicial\s+than\s+probative)\b/i, ecSection: 'EC § 352' },
  speculation: { regex: /\b(speculat(ion|ive|es?|ing)|calls?\s+for\s+speculation)\b/i, ecSection: 'EC § 702' },
  leading: { regex: /\b(leading(\s+question)?)\b/i, ecSection: 'EC § 767' },
  confrontation: { regex: /\b(confrontation\s+clause|right\s+to\s+confront)\b/i, ecSection: '6th Amendment' },
  best_evidence: { regex: /\b(best\s+evidence|original\s+document|secondary\s+evidence)\b/i, ecSection: 'EC § 1500' },
  authentication: { regex: /\b(authenticat(ion|e)|not\s+authenticated)\b/i, ecSection: 'EC § 1400' },
};

const RULING_PATTERNS: Record<string, RegExp> = {
  sustained: /\b(sustained)\b/i,
  overruled: /\b(overruled)\b/i,
  withdrawn: /\b(withdrawn|withdraw)\b/i,
  deferred: /\b(deferred|taken\s+under\s+advisement)\b/i,
};

export async function buildObjectionHistory(caseId: string): Promise<{
  caseId: string; objectionsFound: number; entries: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const objectionStatements = statements.filter(s => /\b(objection|object|objects)\b/i.test(s.rawText));

  for (const stmt of objectionStatements) {
    let objectionType = 'relevance';
    let ecSection: string | null = null;
    for (const [type, pattern] of Object.entries(OBJECTION_TYPE_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        objectionType = type;
        ecSection = pattern.ecSection;
        break;
      }
    }

    let ruling = 'overruled';
    for (const [r, rRegex] of Object.entries(RULING_PATTERNS)) {
      if (rRegex.test(stmt.rawText)) { ruling = r; break; }
    }

    let trialPhase = 'prosecution_case';
    for (const [phase, phaseRegex] of Object.entries(TRIAL_PHASE_PATTERNS)) {
      if (phaseRegex.test(stmt.rawText)) { trialPhase = phase; break; }
    }

    let followUpAction: string | null = null;
    if (/\b(motion\s+to\s+strike|move\s+to\s+strike)\b/i.test(stmt.rawText)) followUpAction = 'motion_to_strike';
    else if (/\b(curative\s+instruction|admonish)\b/i.test(stmt.rawText)) followUpAction = 'curative_instruction';
    else if (/\b(mistrial)\b/i.test(stmt.rawText)) followUpAction = 'mistrial_motion';

    const entry = await prisma.objectionHistoryEntry.create({
      data: {
        caseId,
        objectionType,
        evidenceCodeSection: ecSection,
        objectedTo: stmt.rawText.slice(0, 300),
        objectedBy: /\b(people|prosecution|district\s+attorney)\b/i.test(stmt.rawText) ? 'prosecution' : 'defense',
        ruling,
        trialPhase,
        witnessOnStand: stmt.speaker !== 'COURT' && stmt.speaker !== 'UNKNOWN' ? stmt.speaker : null,
        citedText: stmt.rawText.slice(0, 300),
        citedPage: stmt.page,
        citedLine: stmt.lineStart,
        citedDocument: stmt.document?.fileName || null,
        followUpAction,
        preservedForAppeal: ruling === 'overruled' || ruling === 'sustained',
      },
    });

    results.push({ id: entry.id, objectionType, ruling, preservedForAppeal: entry.preservedForAppeal });
  }

  return { caseId, objectionsFound: results.length, entries: results };
}

// ---------------------------------------------------------------------------
// 3. Harmless/Prejudicial Error Modeling
// ---------------------------------------------------------------------------

export async function modelHarmlessPrejudicialError(caseId: string): Promise<{
  caseId: string; errorsAnalyzed: number; analyses: Array<Record<string, unknown>>;
}> {
  const preservationRecords = await prisma.errorPreservationRecord.findMany({
    where: { caseId, appellateRelevance: { in: ['high', 'medium'] } },
  });

  const burdenScores = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId, severity: { in: ['critical', 'high'] } } });

  const avgBurdenClarity = burdenScores.length > 0
    ? round(burdenScores.reduce((s, b) => s + (1 - b.collapseScore), 0) / burdenScores.length)
    : 0.5;

  const results: Array<Record<string, unknown>> = [];

  for (const record of preservationRecords) {
    const isOverruled = record.judgeResponse === 'overruled' || record.judgeResponse === 'denied';
    if (!isOverruled) continue;

    const isConstitutional = record.errorType === 'constitutional';
    const strengthOfRemaining = round(Math.min(1, avgBurdenClarity + (contradictions.length > 0 ? -0.1 : 0)));

    let prejudiceLevel: string;
    let chapmanAnalysis: string;

    if (isConstitutional && record.standardOfReview === 'structural_error') {
      prejudiceLevel = 'structural';
      chapmanAnalysis = 'Structural error — automatic reversal required. No harmless error analysis needed.';
    } else if (strengthOfRemaining < 0.3) {
      prejudiceLevel = 'prejudicial';
      chapmanAnalysis = `Remaining evidence is weak (${(strengthOfRemaining * 100).toFixed(0)}%). Error likely contributed to verdict. Chapman v. California, 386 U.S. 18.`;
    } else if (strengthOfRemaining < 0.6) {
      prejudiceLevel = 'harmless_beyond_reasonable_doubt';
      chapmanAnalysis = `Remaining evidence is moderate (${(strengthOfRemaining * 100).toFixed(0)}%). Prosecution may argue error was harmless beyond reasonable doubt. Chapman analysis required.`;
    } else {
      prejudiceLevel = 'harmless';
      chapmanAnalysis = `Remaining evidence is strong (${(strengthOfRemaining * 100).toFixed(0)}%). Error likely harmless beyond reasonable doubt.`;
    }

    const watsonAnalysis = !isConstitutional
      ? `People v. Watson, 46 Cal.2d 818: ${strengthOfRemaining < 0.5 ? 'Reasonable probability of different result absent the error.' : 'No reasonable probability of different result.'}`
      : null;

    const errorClassification = record.errorType.includes('motion') ? 'evidentiary'
      : record.errorType.includes('constitutional') ? 'constitutional'
      : record.errorType.includes('instruction') ? 'instructional'
      : 'trial';

    const analysis = await prisma.harmlessPrejudicialError.create({
      data: {
        caseId,
        errorPreservationId: record.id,
        errorDescription: record.errorDescription,
        errorClassification,
        prejudiceLevel,
        chapmanAnalysis,
        watsonAnalysis,
        affectedElements: JSON.stringify([]),
        strengthOfRemaining,
        cumulativeEffect: preservationRecords.filter(r => r.judgeResponse === 'overruled' || r.judgeResponse === 'denied').length > 3
          ? 'Multiple errors compound prejudice. Cumulative effect may exceed individual harm.'
          : 'Error evaluated independently.',
        citations: JSON.stringify([{
          text: record.citedText,
          page: record.citedPage,
          line: record.citedLine,
          document: record.citedDocument,
        }]),
      },
    });

    results.push({ id: analysis.id, prejudiceLevel, strengthOfRemaining, errorClassification });
  }

  return { caseId, errorsAnalyzed: results.length, analyses: results };
}

// ---------------------------------------------------------------------------
// 4. Waiver/Forfeiture Detection
// ---------------------------------------------------------------------------

export async function detectWaiverForfeiture(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  // Check D.6 evidentiary objections that were NOT preserved
  const evidentiaryObjections = await prisma.evidentiaryObjection.findMany({
    where: { caseId, status: 'identified' },
  });

  // Check D.6 constitutional issues
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({
    where: { caseId },
  });

  // Check error preservation records
  const preservationRecords = await prisma.errorPreservationRecord.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];

  // Evidentiary objections that were identified but never raised = forfeiture
  const raisedObjectionTypes = new Set(preservationRecords.map(r => r.errorType));
  for (const obj of evidentiaryObjections) {
    if (!raisedObjectionTypes.has(obj.objectionType)) {
      const issue = await prisma.waiverForfeitureIssue.create({
        data: {
          caseId,
          issueType: 'forfeiture',
          issueDescription: `Evidentiary objection "${obj.objectionType}" was identified but no corresponding objection was raised in the record.`,
          legalBasis: obj.evidenceCodeSection || 'EC § 353',
          detectionMethod: 'no_objection',
          trialPhase: 'prosecution_case',
          potentialAppellateIssue: `${obj.objectionType} objection — forfeited by failure to object at trial`,
          exceptionApplicable: 'ineffective_assistance',
          exceptionAnalysis: 'If defense counsel failed to raise a meritorious objection, this may support an ineffective assistance of counsel claim under Strickland v. Washington.',
          citations: JSON.stringify([{
            text: obj.description,
            page: obj.citedPage,
            line: obj.citedLine,
          }]),
        },
      });
      results.push({ id: issue.id, issueType: 'forfeiture', detectionMethod: 'no_objection', legalBasis: issue.legalBasis });
    }
  }

  // Constitutional issues not preserved by motion = potential forfeiture
  for (const ci of constitutionalIssues) {
    const hasMotion = preservationRecords.some(r => r.errorType === 'constitutional' && r.legalBasis.includes(ci.amendmentBasis));
    if (!hasMotion) {
      const issue = await prisma.waiverForfeitureIssue.create({
        data: {
          caseId,
          issueType: 'forfeiture',
          issueDescription: `Constitutional issue (${ci.amendmentBasis} Amendment — ${ci.issueType}) identified but no motion to suppress or objection found in the record.`,
          legalBasis: `${ci.amendmentBasis} Amendment`,
          detectionMethod: 'no_objection',
          trialPhase: 'pretrial',
          potentialAppellateIssue: `${ci.amendmentBasis} Amendment claim — forfeited by failure to raise pretrial motion`,
          exceptionApplicable: ci.amendmentBasis === '5th' || ci.amendmentBasis === '6th' ? 'constitutional_magnitude' : 'plain_error',
          exceptionAnalysis: ci.amendmentBasis === '5th' || ci.amendmentBasis === '6th'
            ? 'Constitutional claims of this magnitude may survive forfeiture under the constitutional magnitude exception.'
            : 'Plain error review may apply if the error is clear under current law and prejudicial.',
          citations: JSON.stringify([{ text: ci.description }]),
        },
      });
      results.push({ id: issue.id, issueType: 'forfeiture', detectionMethod: 'no_objection', amendment: ci.amendmentBasis });
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 5. Constitutional Claim Preservation
// ---------------------------------------------------------------------------

export async function preserveConstitutionalClaims(caseId: string): Promise<{
  caseId: string; claimsPreserved: number; claims: Array<Record<string, unknown>>;
}> {
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({ where: { caseId } });
  const preservationRecords = await prisma.errorPreservationRecord.findMany({
    where: { caseId, errorType: { in: ['constitutional', 'motion_denied'] } },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const ci of constitutionalIssues) {
    const hasPreservation = preservationRecords.some(r =>
      r.legalBasis.includes(ci.amendmentBasis) || r.errorDescription.toLowerCase().includes(ci.issueType.replace(/_/g, ' '))
    );

    const AMENDMENT_CLAIM_MAP: Record<string, { claimType: string; standardOfReview: string }> = {
      '4th': { claimType: 'search_seizure', standardOfReview: 'de_novo' },
      '5th': { claimType: 'self_incrimination', standardOfReview: 'harmless_beyond_reasonable_doubt' },
      '6th': { claimType: 'right_to_counsel', standardOfReview: 'structural' },
      '8th': { claimType: 'cruel_unusual', standardOfReview: 'de_novo' },
      '14th': { claimType: 'due_process', standardOfReview: 'harmless_beyond_reasonable_doubt' },
    };

    const mapping = AMENDMENT_CLAIM_MAP[ci.amendmentBasis] || { claimType: 'due_process', standardOfReview: 'de_novo' };

    const claim = await prisma.constitutionalClaimPreservation.create({
      data: {
        caseId,
        constitutionalIssueId: ci.id,
        amendment: ci.amendmentBasis,
        claimType: mapping.claimType,
        preservationStatus: hasPreservation ? 'preserved' : 'forfeited',
        preservationMethod: hasPreservation ? 'motion_to_suppress' : 'objection',
        federalStateDistinction: ci.amendmentBasis === '4th' ? 'both' : 'federal',
        standardOfReview: mapping.standardOfReview,
        appellateStrength: hasPreservation
          ? (ci.suppressionPotential === 'high' ? 'strong' : 'moderate')
          : 'weak',
        citations: JSON.stringify([{ text: ci.description }]),
      },
    });

    results.push({ id: claim.id, amendment: ci.amendmentBasis, preservationStatus: claim.preservationStatus, appellateStrength: claim.appellateStrength });
  }

  return { caseId, claimsPreserved: results.length, claims: results };
}

// ---------------------------------------------------------------------------
// 6. Record Completeness Analysis
// ---------------------------------------------------------------------------

const REQUIRED_RECORD_TYPES = [
  { type: 'transcript', description: 'Trial transcript', importance: 'critical' },
  { type: 'jury_instruction', description: 'Jury instructions given', importance: 'critical' },
  { type: 'verdict_form', description: 'Verdict forms', importance: 'critical' },
  { type: 'motion', description: 'Pretrial motions and rulings', importance: 'important' },
  { type: 'exhibit', description: 'Trial exhibits admitted/refused', importance: 'important' },
  { type: 'sentencing', description: 'Sentencing hearing transcript', importance: 'critical' },
  { type: 'clerk_minutes', description: 'Clerk minutes', importance: 'routine' },
  { type: 'ruling', description: 'Court rulings on motions', importance: 'important' },
];

export async function analyzeRecordCompleteness(caseId: string): Promise<{
  caseId: string; recordsChecked: number; entries: Array<Record<string, unknown>>;
}> {
  const documents = await prisma.evidenceDocument.findMany({ where: { caseId } });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  for (const req of REQUIRED_RECORD_TYPES) {
    const hasDoc = documents.some(d =>
      d.documentType?.toLowerCase().includes(req.type) || d.fileName.toLowerCase().includes(req.type)
    );
    const hasStatements = statements.some(s =>
      s.rawText.toLowerCase().includes(req.type.replace(/_/g, ' '))
    );

    const status = hasDoc ? 'present' : hasStatements ? 'incomplete' : 'missing';

    const entry = await prisma.recordCompletenessEntry.create({
      data: {
        caseId,
        recordType: req.type,
        description: req.description,
        status,
        importance: req.importance,
        appellateImpact: status === 'missing' && req.importance === 'critical'
          ? 'Missing critical record may require settled statement or preclude appellate review of related issues.'
          : status === 'missing'
          ? 'Missing record may limit appellate arguments related to this proceeding phase.'
          : 'Record present — no appellate impact from absence.',
        settlementNeeded: status === 'missing' && req.importance !== 'routine',
        citations: JSON.stringify(hasDoc ? documents.filter(d => d.documentType?.toLowerCase().includes(req.type) || d.fileName.toLowerCase().includes(req.type)).map(d => ({ document: d.fileName, pages: d.totalPages })) : []),
      },
    });

    results.push({ id: entry.id, recordType: req.type, status, importance: req.importance, settlementNeeded: entry.settlementNeeded });
  }

  return { caseId, recordsChecked: results.length, entries: results };
}

// ---------------------------------------------------------------------------
// 7. Appellate Issue Indexing
// ---------------------------------------------------------------------------

export async function buildAppellateIssueIndex(caseId: string): Promise<{
  caseId: string; issuesIndexed: number; issues: Array<Record<string, unknown>>;
}> {
  const [_preservationRecords, harmlessErrors, constitutionalClaims, instructionalErrors, misconductEntries] = await Promise.all([
    prisma.errorPreservationRecord.findMany({ where: { caseId, appellateRelevance: { in: ['high', 'medium'] } } }),
    prisma.harmlessPrejudicialError.findMany({ where: { caseId } }),
    prisma.constitutionalClaimPreservation.findMany({ where: { caseId } }),
    prisma.instructionalError.findMany({ where: { caseId } }),
    prisma.prosecutorialMisconductEntry.findMany({ where: { caseId } }),
  ]);

  const results: Array<Record<string, unknown>> = [];
  let ranking = 1;

  // Structural errors first (highest priority)
  const structuralErrors = harmlessErrors.filter(e => e.prejudiceLevel === 'structural');
  for (const se of structuralErrors) {
    const issue = await prisma.appellateIssueIndex.create({
      data: {
        caseId,
        issueTitle: `Structural Error: ${se.errorDescription.slice(0, 100)}`,
        issueCategory: se.errorClassification === 'constitutional' ? 'constitutional' : 'procedural',
        preservationStatus: 'preserved',
        standardOfReview: 'structural_error',
        prejudiceAnalysis: 'structural',
        meritStrength: 'strong',
        appellateRanking: ranking++,
        supportingRecords: JSON.stringify([{ errorId: se.id, errorPreservationId: se.errorPreservationId }]),
        opposingArguments: JSON.stringify(['Prosecution will argue error was not structural in nature.']),
        citations: se.citations,
      },
    });
    results.push({ id: issue.id, issueTitle: issue.issueTitle, meritStrength: 'strong', ranking: issue.appellateRanking });
  }

  // Constitutional claims (preserved)
  const preservedClaims = constitutionalClaims.filter(c => c.preservationStatus === 'preserved' && c.appellateStrength === 'strong');
  for (const cc of preservedClaims) {
    const issue = await prisma.appellateIssueIndex.create({
      data: {
        caseId,
        issueTitle: `${cc.amendment} Amendment: ${cc.claimType.replace(/_/g, ' ')}`,
        issueCategory: 'constitutional',
        preservationStatus: 'preserved',
        standardOfReview: cc.standardOfReview,
        prejudiceAnalysis: cc.standardOfReview === 'structural' ? 'structural' : 'prejudicial',
        meritStrength: cc.appellateStrength,
        appellateRanking: ranking++,
        supportingRecords: JSON.stringify([{ constitutionalClaimId: cc.id, constitutionalIssueId: cc.constitutionalIssueId }]),
        opposingArguments: JSON.stringify([`Prosecution will argue ${cc.standardOfReview === 'structural' ? 'error was not structural' : 'error was harmless beyond reasonable doubt'}.`]),
        citations: cc.citations,
      },
    });
    results.push({ id: issue.id, issueTitle: issue.issueTitle, meritStrength: cc.appellateStrength, ranking: issue.appellateRanking });
  }

  // Prejudicial errors
  const prejudicialErrors = harmlessErrors.filter(e => e.prejudiceLevel === 'prejudicial');
  for (const pe of prejudicialErrors) {
    const issue = await prisma.appellateIssueIndex.create({
      data: {
        caseId,
        issueTitle: `Prejudicial Error: ${pe.errorDescription.slice(0, 100)}`,
        issueCategory: pe.errorClassification === 'instructional' ? 'instructional' : 'evidentiary',
        preservationStatus: 'preserved',
        standardOfReview: 'harmless_error',
        prejudiceAnalysis: 'prejudicial',
        meritStrength: pe.strengthOfRemaining < 0.3 ? 'strong' : 'moderate',
        appellateRanking: ranking++,
        supportingRecords: JSON.stringify([{ errorId: pe.id }]),
        opposingArguments: JSON.stringify([`Prosecution will argue remaining evidence (${(pe.strengthOfRemaining * 100).toFixed(0)}%) is sufficient.`]),
        citations: pe.citations,
      },
    });
    results.push({ id: issue.id, issueTitle: issue.issueTitle, meritStrength: issue.meritStrength, ranking: issue.appellateRanking });
  }

  // Instructional errors
  for (const ie of instructionalErrors) {
    const issue = await prisma.appellateIssueIndex.create({
      data: {
        caseId,
        issueTitle: `Instructional Error: ${ie.errorDescription.slice(0, 100)}`,
        issueCategory: 'instructional',
        preservationStatus: ie.preservedByObjection ? 'preserved' : 'arguable',
        standardOfReview: 'de_novo',
        prejudiceAnalysis: ie.prejudiceLevel,
        meritStrength: ie.preservedByObjection && ie.prejudiceLevel !== 'harmless' ? 'moderate' : 'weak',
        appellateRanking: ranking++,
        supportingRecords: JSON.stringify([{ instructionalErrorId: ie.id }]),
        opposingArguments: JSON.stringify([ie.preservedByObjection ? 'Prosecution will argue instruction was proper.' : 'Prosecution will argue issue was forfeited.']),
        citations: ie.citations,
      },
    });
    results.push({ id: issue.id, issueTitle: issue.issueTitle, meritStrength: issue.meritStrength, ranking: issue.appellateRanking });
  }

  // Prosecutorial misconduct
  const preservedMisconduct = misconductEntries.filter(m => m.preservedForAppeal);
  for (const pm of preservedMisconduct) {
    const issue = await prisma.appellateIssueIndex.create({
      data: {
        caseId,
        issueTitle: `Prosecutorial Misconduct: ${pm.misconductType.replace(/_/g, ' ')}`,
        issueCategory: 'prosecutorial_misconduct',
        preservationStatus: pm.objectionMade ? 'preserved' : 'arguable',
        standardOfReview: 'abuse_of_discretion',
        prejudiceAnalysis: pm.prejudiceLevel,
        meritStrength: pm.prejudiceLevel === 'structural' ? 'strong' : pm.prejudiceLevel === 'prejudicial' ? 'moderate' : 'weak',
        appellateRanking: ranking++,
        supportingRecords: JSON.stringify([{ misconductId: pm.id }]),
        opposingArguments: JSON.stringify([pm.curativeInstruction ? 'Prosecution will argue curative instruction cured any prejudice.' : 'Prosecution will argue no prejudice.']),
        citations: pm.citations,
      },
    });
    results.push({ id: issue.id, issueTitle: issue.issueTitle, meritStrength: issue.meritStrength, ranking: issue.appellateRanking });
  }

  return { caseId, issuesIndexed: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 8. Instructional Error Tracking (CALCRIM-aware)
// ---------------------------------------------------------------------------

const INSTRUCTIONAL_ERROR_PATTERNS: Record<string, { regex: RegExp; errorType: string }> = {
  refused: { regex: /\b(refused?\s+instruction|instruction\s+refused?|denied\s+instruction)\b/i, errorType: 'refused_instruction' },
  modified: { regex: /\b(modified\s+instruction|instruction\s+modified|amended\s+instruction)\b/i, errorType: 'modified_instruction' },
  pinpoint_refused: { regex: /\b(pinpoint\s+instruction\s+refused?|refused?\s+pinpoint)\b/i, errorType: 'pinpoint_refused' },
};

export async function trackInstructionalErrors(caseId: string): Promise<{
  caseId: string; errorsFound: number; errors: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const calcrimInstructions = await prisma.calcrimInstruction.findMany();
  const burdenScores = await prisma.burdenCollapseScore.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  // Pattern-based detection from transcript
  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(INSTRUCTIONAL_ERROR_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const calcrimMatch = stmt.rawText.match(/CALCRIM\s+(?:No\.\s*)?(\d+)/i);
        const instructionNumber = calcrimMatch ? parseInt(calcrimMatch[1], 10) : null;
        const matchedInstruction = instructionNumber
          ? calcrimInstructions.find(i => i.instructionNumber === instructionNumber)
          : null;

        const hasObjPreserved = /\b(objection|object)\b/i.test(stmt.rawText);

        const instructionalError = await prisma.instructionalError.create({
          data: {
            caseId,
            instructionId: matchedInstruction?.id || null,
            instructionNumber,
            errorType: pattern.errorType,
            errorDescription: stmt.rawText.slice(0, 500),
            requestedInstruction: calcrimMatch ? `CALCRIM ${calcrimMatch[1]}` : null,
            givenInstruction: null,
            legalBasis: instructionNumber ? `CALCRIM ${instructionNumber}` : 'General instruction law',
            prejudiceLevel: pattern.errorType === 'refused_instruction' ? 'prejudicial' : 'harmless',
            preservedByObjection: hasObjPreserved,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });

        results.push({ id: instructionalError.id, errorType: pattern.errorType, instructionNumber, preservedByObjection: hasObjPreserved });
      }
    }
  }

  // Check for missing element instructions from burden analysis
  for (const bs of burdenScores) {
    if (bs.collapseLevel === 'collapsed' || bs.collapseLevel === 'fractured') {
      const instruction = calcrimInstructions.find(i => i.id === bs.instructionId);
      if (instruction) {
        const elementDetails = JSON.parse(bs.elementDetails) as Array<{ elementId: string; label: string; status: string }>;
        const unsupported = elementDetails.filter(e => e.status === 'unsupported');
        if (unsupported.length > 0) {
          const instructionalError = await prisma.instructionalError.create({
            data: {
              caseId,
              instructionId: instruction.id,
              instructionNumber: instruction.instructionNumber,
              errorType: 'missing_element',
              errorDescription: `CALCRIM ${instruction.instructionNumber}: ${unsupported.length} elements lack evidentiary support. Instruction should not have been given without sufficient evidence on all elements.`,
              legalBasis: `CALCRIM ${instruction.instructionNumber} — PC § 1118.1`,
              prejudiceLevel: unsupported.length >= 2 ? 'prejudicial' : 'harmless',
              preservedByObjection: false,
              citations: JSON.stringify(unsupported.map(u => ({ elementId: u.elementId, label: u.label }))),
            },
          });
          results.push({ id: instructionalError.id, errorType: 'missing_element', instructionNumber: instruction.instructionNumber });
        }
      }
    }
  }

  return { caseId, errorsFound: results.length, errors: results };
}

// ---------------------------------------------------------------------------
// 9. Prosecutorial Misconduct Indexing (citation-required)
// ---------------------------------------------------------------------------

const MISCONDUCT_PATTERNS: Record<string, { regex: RegExp; misconductType: string }> = {
  vouching: { regex: /\b(I\s+believe|personally\s+believe|I\s+know\s+(he|she|they|the\s+defendant)\s+(is|are|was)\s+(guilty|lying)|trust\s+me)\b/i, misconductType: 'vouching' },
  burden_shifting: { regex: /\b(defendant\s+(failed\s+to|didn'?t|did\s+not)\s+(explain|testify|show|prove|account)|where\s+is\s+(his|her|their)\s+evidence)\b/i, misconductType: 'burden_shifting' },
  golden_rule: { regex: /\b(put\s+yourself\s+in|imagine\s+(you|yourself|if\s+you)\s+(were|are)|how\s+would\s+you\s+feel)\b/i, misconductType: 'golden_rule' },
  facts_not_in_evidence: { regex: /\b(not\s+in\s+evidence|outside\s+the\s+record|you\s+know\s+that|common\s+knowledge)\b/i, misconductType: 'facts_not_in_evidence' },
  griffin_error: { regex: /\b(defendant\s+(chose\s+not\s+to|refused\s+to|didn'?t|did\s+not)\s+testif(y|ied)|silence\s+(of|by)\s+the\s+defendant|invok(ed?|ing)\s+(his|her|their)\s+(right|fifth|5th))\b/i, misconductType: 'griffin_error' },
  improper_argument: { regex: /\b(send\s+a\s+message|community\s+expects|duty\s+to\s+convict|justice\s+demands)\b/i, misconductType: 'improper_argument' },
};

export async function indexProsecutorialMisconduct(caseId: string): Promise<{
  caseId: string; misconductFound: number; entries: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(MISCONDUCT_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText)) {
        const isProsecutorSpeaking = stmt.speaker?.toLowerCase().includes('prosecutor')
          || stmt.speaker?.toLowerCase().includes('district attorney')
          || stmt.speaker?.toLowerCase().includes('da ')
          || stmt.speaker?.toLowerCase().includes('people');

        if (!isProsecutorSpeaking && stmt.statementType !== 'directive') continue;

        let trialPhase = 'closing';
        for (const [phase, phaseRegex] of Object.entries(TRIAL_PHASE_PATTERNS)) {
          if (phaseRegex.test(stmt.rawText)) { trialPhase = phase; break; }
        }

        const hasObjection = /\b(objection|object)\b/i.test(stmt.rawText);

        const isGriffin = pattern.misconductType === 'griffin_error';
        const prejudiceLevel = isGriffin ? 'prejudicial' : 'harmless';

        const entry = await prisma.prosecutorialMisconductEntry.create({
          data: {
            caseId,
            misconductType: pattern.misconductType,
            description: `Potential ${pattern.misconductType.replace(/_/g, ' ')}: "${stmt.rawText.slice(0, 200)}"`,
            trialPhase,
            citedText: stmt.rawText.slice(0, 300),
            citedPage: stmt.page,
            citedLine: stmt.lineStart,
            citedDocument: stmt.document?.fileName || null,
            objectionMade: hasObjection,
            objectionRuling: hasObjection ? (stmt.rawText.match(/sustained/i) ? 'sustained' : 'overruled') : null,
            curativeInstruction: /\b(curative|admonish|disregard)\b/i.test(stmt.rawText),
            prejudiceLevel,
            preservedForAppeal: hasObjection || isGriffin,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              speaker: stmt.speaker,
              document: stmt.document?.fileName || null,
            }]),
          },
        });

        results.push({ id: entry.id, misconductType: pattern.misconductType, prejudiceLevel, preservedForAppeal: entry.preservedForAppeal });
      }
    }
  }

  return { caseId, misconductFound: results.length, entries: results };
}

// ---------------------------------------------------------------------------
// 10. Full Appellate Intelligence Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullAppellateIntelligence(caseId: string): Promise<Record<string, unknown>> {
  const errorPreservation = await trackErrorPreservation(caseId);
  const objectionHistory = await buildObjectionHistory(caseId);
  const instructionalErrors = await trackInstructionalErrors(caseId);
  const prosecutorialMisconduct = await indexProsecutorialMisconduct(caseId);
  const harmlessPrejudicial = await modelHarmlessPrejudicialError(caseId);
  const waiverForfeiture = await detectWaiverForfeiture(caseId);
  const constitutionalClaims = await preserveConstitutionalClaims(caseId);
  const recordCompleteness = await analyzeRecordCompleteness(caseId);
  const appellateIndex = await buildAppellateIssueIndex(caseId);

  return {
    caseId,
    summary: {
      errorPreservation: errorPreservation.errorsFound,
      objectionHistory: objectionHistory.objectionsFound,
      instructionalErrors: instructionalErrors.errorsFound,
      prosecutorialMisconduct: prosecutorialMisconduct.misconductFound,
      harmlessPrejudicialErrors: harmlessPrejudicial.errorsAnalyzed,
      waiverForfeitureIssues: waiverForfeiture.issuesFound,
      constitutionalClaims: constitutionalClaims.claimsPreserved,
      recordCompleteness: recordCompleteness.recordsChecked,
      appellateIssuesIndexed: appellateIndex.issuesIndexed,
    },
    principle: 'CourtAccess organizes provable appellate issue structures. It does NOT function as appellate counsel.',
  };
}
