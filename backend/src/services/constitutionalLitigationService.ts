// ============================================================================
// Phase G.1 — Constitutional Litigation Intelligence + Structural Rights Analysis
// Organizes provable constitutional issue structures.
// NEVER functions as constitutional litigation counsel.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Fourth Amendment Issue Framework (citation-backed)
// ---------------------------------------------------------------------------

const SEARCH_PATTERNS: Array<{ pattern: RegExp; issueType: string; legalStandard: string }> = [
  { pattern: /warrant(less)?\s+(search|entry|seizure)/i, issueType: 'warrantless_search', legalStandard: 'warrant_requirement' },
  { pattern: /consent\s+(to\s+)?search/i, issueType: 'consent_issue', legalStandard: 'consent' },
  { pattern: /exigent\s+circumstance/i, issueType: 'exigent_circumstances', legalStandard: 'exigent_circumstances' },
  { pattern: /plain\s+view/i, issueType: 'plain_view', legalStandard: 'probable_cause' },
  { pattern: /vehicle|automobile|car\s+search/i, issueType: 'automobile_exception', legalStandard: 'probable_cause' },
  { pattern: /stop\s+and\s+frisk|terry\s+stop|pat[\s-]?down/i, issueType: 'stop_and_frisk', legalStandard: 'reasonable_suspicion' },
  { pattern: /inventory\s+search/i, issueType: 'inventory_search', legalStandard: 'probable_cause' },
  { pattern: /overbroad|stale|lack(ing)?\s+particularity|false\s+affidavit/i, issueType: 'warrant_deficiency', legalStandard: 'probable_cause' },
];

export async function analyzeFourthAmendmentIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({
    where: { caseId, amendmentBasis: { contains: '4th' } },
  });
  const results: Array<Record<string, unknown>> = [];

  for (const ci of constitutionalIssues) {
    const existing = await prisma.fourthAmendmentIssue.findFirst({
      where: { caseId, description: ci.description.slice(0, 100) },
    });
    if (existing) continue;

    let issueType = 'warrantless_search';
    let legalStandard = 'warrant_requirement';
    for (const sp of SEARCH_PATTERNS) {
      if (sp.pattern.test(ci.description)) {
        issueType = sp.issueType;
        legalStandard = sp.legalStandard;
        break;
      }
    }

    const suppressionViability = ci.strength === 'strong' ? 'strong' : ci.strength === 'moderate' ? 'moderate' : 'weak';

    const issue = await prisma.fourthAmendmentIssue.create({
      data: {
        caseId,
        issueType,
        description: ci.description.slice(0, 500),
        legalStandard,
        suppressionViability,
        citations: ci.citations,
      },
    });
    results.push({ id: issue.id, issueType, suppressionViability });
  }

  // Scan statements for search-related patterns
  for (const stmt of statements) {
    for (const sp of SEARCH_PATTERNS) {
      if (sp.pattern.test(stmt.rawText)) {
        const existing = await prisma.fourthAmendmentIssue.findFirst({
          where: { caseId, issueType: sp.issueType, description: { contains: stmt.rawText.slice(0, 50) } },
        });
        if (existing) continue;

        const issue = await prisma.fourthAmendmentIssue.create({
          data: {
            caseId,
            issueType: sp.issueType,
            description: stmt.rawText.slice(0, 500),
            legalStandard: sp.legalStandard,
            suppressionViability: 'moderate',
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
          },
        });
        results.push({ id: issue.id, issueType: sp.issueType, source: 'statement_scan' });
        break;
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 2. Fifth Amendment Issue Tracking (evidence-linked)
// ---------------------------------------------------------------------------

const FIFTH_PATTERNS: Array<{ pattern: RegExp; issueType: string; legalBasis: string }> = [
  { pattern: /miranda|rights?\s+(were|was)\s+(not\s+)?(read|given|advised)/i, issueType: 'miranda_violation', legalBasis: 'Miranda v. Arizona, 384 U.S. 436 (1966)' },
  { pattern: /compelled|forced\s+(to\s+)?(speak|testify|state)/i, issueType: 'compelled_statement', legalBasis: 'Fifth Amendment Self-Incrimination Clause' },
  { pattern: /self[\s-]?incrimination|right\s+to\s+remain\s+silent/i, issueType: 'self_incrimination', legalBasis: 'Fifth Amendment Self-Incrimination Clause' },
  { pattern: /double\s+jeopardy/i, issueType: 'double_jeopardy', legalBasis: 'Fifth Amendment Double Jeopardy Clause' },
];

export async function trackFifthAmendmentIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({
    where: { caseId, amendmentBasis: { contains: '5th' } },
  });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const ci of constitutionalIssues) {
    const existing = await prisma.fifthAmendmentIssue.findFirst({
      where: { caseId, description: ci.description.slice(0, 100) },
    });
    if (existing) continue;

    let issueType = 'miranda_violation';
    let legalBasis = 'Miranda v. Arizona, 384 U.S. 436 (1966)';
    for (const fp of FIFTH_PATTERNS) {
      if (fp.pattern.test(ci.description)) {
        issueType = fp.issueType;
        legalBasis = fp.legalBasis;
        break;
      }
    }

    const issue = await prisma.fifthAmendmentIssue.create({
      data: {
        caseId,
        issueType,
        description: ci.description.slice(0, 500),
        suppressionViability: ci.strength === 'strong' ? 'strong' : ci.strength === 'moderate' ? 'moderate' : 'weak',
        legalBasis,
        citations: ci.citations,
      },
    });
    results.push({ id: issue.id, issueType });
  }

  for (const stmt of statements) {
    for (const fp of FIFTH_PATTERNS) {
      if (fp.pattern.test(stmt.rawText)) {
        const existing = await prisma.fifthAmendmentIssue.findFirst({
          where: { caseId, issueType: fp.issueType, description: { contains: stmt.rawText.slice(0, 50) } },
        });
        if (existing) continue;

        const issue = await prisma.fifthAmendmentIssue.create({
          data: {
            caseId,
            issueType: fp.issueType,
            description: stmt.rawText.slice(0, 500),
            suppressionViability: 'moderate',
            legalBasis: fp.legalBasis,
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
          },
        });
        results.push({ id: issue.id, issueType: fp.issueType, source: 'statement_scan' });
        break;
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 3. Sixth Amendment Confrontation Analysis (deterministic)
// ---------------------------------------------------------------------------

export async function analyzeSixthAmendmentConfrontation(caseId: string): Promise<{
  caseId: string; confrontationsFound: number; confrontations: Array<Record<string, unknown>>;
}> {
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({
    where: { caseId, amendmentBasis: { contains: '6th' } },
  });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const CONFRONTATION_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /hearsay|out[\s-]?of[\s-]?court/i, type: 'testimonial_hearsay' },
    { pattern: /lab\s+report|forensic\s+report|autopsy/i, type: 'lab_report' },
    { pattern: /prior\s+testimony|preliminary\s+hearing/i, type: 'prior_testimony' },
    { pattern: /co[\s-]?defendant|co[\s-]?conspirator/i, type: 'co_defendant_statement' },
    { pattern: /911\s+call|emergency\s+call/i, type: '911_call' },
  ];

  for (const ci of constitutionalIssues) {
    const existing = await prisma.sixthAmendmentConfrontation.findFirst({
      where: { caseId, witnessName: 'Unknown', confrontationType: 'testimonial_hearsay' },
    });
    if (existing) continue;

    let confrontationType = 'testimonial_hearsay';
    for (const cp of CONFRONTATION_PATTERNS) {
      if (cp.pattern.test(ci.description)) {
        confrontationType = cp.type;
        break;
      }
    }

    const crawfordApplicable = /crawford|testimonial/i.test(ci.description);
    const brutonIssue = /bruton|co[\s-]?defendant/i.test(ci.description);

    const confrontation = await prisma.sixthAmendmentConfrontation.create({
      data: {
        caseId,
        witnessName: 'Unknown',
        confrontationType,
        testimonialStatus: crawfordApplicable ? 'testimonial' : 'disputed',
        crawfordApplicable,
        brutonIssue,
        confrontationViability: ci.strength === 'strong' ? 'strong' : 'moderate',
        citations: ci.citations,
      },
    });
    results.push({ id: confrontation.id, confrontationType, crawfordApplicable });
  }

  // Scan for hearsay-related evidence
  for (const stmt of statements) {
    if (/told\s+me|said\s+that|informed\s+me|stated\s+to/i.test(stmt.rawText) && stmt.statementType === 'testimony') {
      const existing = await prisma.sixthAmendmentConfrontation.findFirst({
        where: { caseId, witnessName: stmt.speaker || 'Unknown' },
      });
      if (existing) continue;

      const confrontation = await prisma.sixthAmendmentConfrontation.create({
        data: {
          caseId,
          witnessName: stmt.speaker || 'Unknown',
          confrontationType: 'testimonial_hearsay',
          testimonialStatus: 'disputed',
          confrontationViability: 'moderate',
          citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
        },
      });
      results.push({ id: confrontation.id, witnessName: stmt.speaker, source: 'hearsay_scan' });
    }
  }

  return { caseId, confrontationsFound: results.length, confrontations: results };
}

// ---------------------------------------------------------------------------
// 4. Due Process Integrity Analysis (citation-required)
// ---------------------------------------------------------------------------

const DUE_PROCESS_PATTERNS: Array<{ pattern: RegExp; issueType: string; remedyAvailable: string }> = [
  { pattern: /suggestive\s+(lineup|identification|showup|photo\s+array)/i, issueType: 'suggestive_identification', remedyAvailable: 'suppression' },
  { pattern: /destroy(ed)?\s+evidence|spoliation/i, issueType: 'destroyed_evidence', remedyAvailable: 'instruction' },
  { pattern: /delay(ed)?\s+prosecution|statute\s+of\s+limitations/i, issueType: 'delayed_prosecution', remedyAvailable: 'dismissal' },
  { pattern: /vindictive\s+prosecution|retaliatory/i, issueType: 'vindictive_prosecution', remedyAvailable: 'dismissal' },
  { pattern: /outrageous\s+(government\s+)?conduct/i, issueType: 'outrageous_conduct', remedyAvailable: 'dismissal' },
  { pattern: /lack\s+of\s+notice|vague(ness)?/i, issueType: 'notice_deficiency', remedyAvailable: 'instruction' },
];

export async function analyzeDueProcessIntegrity(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // Brady/Giglio issues as due process violations
  for (const bi of bradyIssues) {
    if (bi.issueType === 'brady_material' || bi.issueType === 'undisclosed_exculpatory') {
      const existing = await prisma.dueProcessIntegrity.findFirst({
        where: { caseId, issueType: 'destroyed_evidence', description: { contains: bi.description.slice(0, 50) } },
      });
      if (existing) continue;

      const issue = await prisma.dueProcessIntegrity.create({
        data: {
          caseId,
          issueType: 'destroyed_evidence',
          description: `Brady/Giglio due process violation: ${bi.description.slice(0, 400)}`,
          amendment: '14th',
          substantiveOrProcedural: 'procedural',
          prejudiceLevel: bi.strength === 'strong' ? 'severe' : bi.strength === 'moderate' ? 'significant' : 'moderate',
          remedyAvailable: 'new_trial',
          legalBasis: 'Brady v. Maryland, 373 U.S. 83 (1963)',
          citations: bi.citations,
        },
      });
      results.push({ id: issue.id, issueType: 'destroyed_evidence', source: 'brady' });
    }
  }

  // Statement scan
  for (const stmt of statements) {
    for (const dp of DUE_PROCESS_PATTERNS) {
      if (dp.pattern.test(stmt.rawText)) {
        const existing = await prisma.dueProcessIntegrity.findFirst({
          where: { caseId, issueType: dp.issueType, description: { contains: stmt.rawText.slice(0, 50) } },
        });
        if (existing) continue;

        const issue = await prisma.dueProcessIntegrity.create({
          data: {
            caseId,
            issueType: dp.issueType,
            description: stmt.rawText.slice(0, 500),
            amendment: '14th',
            substantiveOrProcedural: 'procedural',
            prejudiceLevel: 'moderate',
            remedyAvailable: dp.remedyAvailable,
            legalBasis: 'Fourteenth Amendment Due Process Clause',
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
          },
        });
        results.push({ id: issue.id, issueType: dp.issueType, source: 'statement_scan' });
        break;
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 5. Structural Error Categorization (deterministic)
// ---------------------------------------------------------------------------

const STRUCTURAL_ERRORS: Array<{ pattern: RegExp; errorType: string; authority: string; basis: string }> = [
  { pattern: /denial\s+of\s+counsel|no\s+attorney|unrepresented/i, errorType: 'denial_of_counsel', authority: 'Gideon v. Wainwright, 372 U.S. 335 (1963)', basis: '6th Amendment' },
  { pattern: /biased\s+judge|judicial\s+bias|recusal/i, errorType: 'biased_judge', authority: 'Tumey v. Ohio, 273 U.S. 510 (1927)', basis: '14th Amendment' },
  { pattern: /racial\s+discrimination.*jury|batson|systematic\s+exclusion/i, errorType: 'racial_discrimination_jury', authority: 'Batson v. Kentucky, 476 U.S. 79 (1986)', basis: '14th Amendment' },
  { pattern: /closed\s+(court|proceeding)|public\s+trial\s+denied/i, errorType: 'denial_public_trial', authority: 'Waller v. Georgia, 467 U.S. 39 (1984)', basis: '6th Amendment' },
  { pattern: /reasonable\s+doubt\s+instruction|defective.*instruction.*reasonable/i, errorType: 'defective_reasonable_doubt_instruction', authority: 'Sullivan v. Louisiana, 508 U.S. 275 (1993)', basis: '6th Amendment' },
  { pattern: /self[\s-]?representation|pro\s+se|faretta/i, errorType: 'denial_self_representation', authority: 'Faretta v. California, 422 U.S. 806 (1975)', basis: '6th Amendment' },
];

export async function categorizeStructuralErrors(caseId: string): Promise<{
  caseId: string; errorsFound: number; errors: Array<Record<string, unknown>>;
}> {
  const errorPreservations = await prisma.errorPreservationRecord.findMany({ where: { caseId } });
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const allTexts = [
    ...errorPreservations.map(ep => ({ text: ep.errorDescription, citations: JSON.stringify([{ errorType: ep.errorType, legalBasis: ep.legalBasis }]) })),
    ...constitutionalIssues.map(ci => ({ text: ci.description, citations: ci.citations })),
  ];

  for (const item of allTexts) {
    for (const se of STRUCTURAL_ERRORS) {
      if (se.pattern.test(item.text)) {
        const existing = await prisma.structuralErrorCategory.findFirst({
          where: { caseId, errorType: se.errorType },
        });
        if (existing) continue;

        const error = await prisma.structuralErrorCategory.create({
          data: {
            caseId,
            errorType: se.errorType,
            description: item.text.slice(0, 500),
            autoReversible: true,
            harmlessAnalysisRequired: false,
            constitutionalBasis: se.basis,
            caseAuthority: se.authority,
            citations: item.citations,
          },
        });
        results.push({ id: error.id, errorType: se.errorType, autoReversible: true });
        break;
      }
    }
  }

  return { caseId, errorsFound: results.length, errors: results };
}

// ---------------------------------------------------------------------------
// 6. Suppression Issue Mapping (evidence-linked)
// ---------------------------------------------------------------------------

export async function mapSuppressionIssues(caseId: string): Promise<{
  caseId: string; issuesMapped: number; issues: Array<Record<string, unknown>>;
}> {
  const fourthIssues = await prisma.fourthAmendmentIssue.findMany({ where: { caseId } });
  const fifthIssues = await prisma.fifthAmendmentIssue.findMany({ where: { caseId } });
  const sixthIssues = await prisma.sixthAmendmentConfrontation.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const fi of fourthIssues) {
    const existing = await prisma.suppressionIssueMap.findFirst({
      where: { caseId, constitutionalBasis: '4th', suppressionGround: 'illegal_search' },
    });
    if (existing) continue;

    const issue = await prisma.suppressionIssueMap.create({
      data: {
        caseId,
        evidenceDescription: fi.description.slice(0, 300),
        evidenceType: 'physical',
        constitutionalBasis: '4th',
        suppressionGround: 'illegal_search',
        impactIfSuppressed: fi.suppressionViability === 'strong' ? 'case_dispositive' : 'significant',
        citations: fi.citations,
      },
    });
    results.push({ id: issue.id, basis: '4th', ground: 'illegal_search' });
  }

  for (const fi of fifthIssues) {
    const existing = await prisma.suppressionIssueMap.findFirst({
      where: { caseId, constitutionalBasis: '5th', suppressionGround: 'miranda_violation' },
    });
    if (existing) continue;

    const issue = await prisma.suppressionIssueMap.create({
      data: {
        caseId,
        evidenceDescription: fi.description.slice(0, 300),
        evidenceType: 'testimonial',
        constitutionalBasis: '5th',
        suppressionGround: 'miranda_violation',
        impactIfSuppressed: fi.suppressionViability === 'strong' ? 'case_dispositive' : 'significant',
        citations: fi.citations,
      },
    });
    results.push({ id: issue.id, basis: '5th', ground: 'miranda_violation' });
  }

  for (const si of sixthIssues) {
    if (!si.crawfordApplicable && !si.brutonIssue) continue;
    const existing = await prisma.suppressionIssueMap.findFirst({
      where: { caseId, constitutionalBasis: '6th', suppressionGround: 'confrontation' },
    });
    if (existing) continue;

    const issue = await prisma.suppressionIssueMap.create({
      data: {
        caseId,
        evidenceDescription: `Confrontation issue: ${si.confrontationType} — ${si.witnessName}`,
        evidenceType: 'testimonial',
        constitutionalBasis: '6th',
        suppressionGround: 'confrontation',
        impactIfSuppressed: si.confrontationViability === 'strong' ? 'significant' : 'moderate',
        citations: si.citations,
      },
    });
    results.push({ id: issue.id, basis: '6th', ground: 'confrontation' });
  }

  return { caseId, issuesMapped: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 7. Search/Seizure Chronology (timeline-linked)
// ---------------------------------------------------------------------------

const SS_EVENT_PATTERNS: Array<{ pattern: RegExp; eventType: string }> = [
  { pattern: /stopped|pulled\s+over|traffic\s+stop/i, eventType: 'stop' },
  { pattern: /detained|held|handcuff/i, eventType: 'detention' },
  { pattern: /pat[\s-]?(down|search)|frisk/i, eventType: 'pat_down' },
  { pattern: /search(ed)?\s+(his|her|the\s+person|defendant)/i, eventType: 'search_person' },
  { pattern: /search(ed)?\s+(the\s+)?(vehicle|car|truck)/i, eventType: 'search_vehicle' },
  { pattern: /search(ed)?\s+(the\s+)?(house|home|apartment|premises|residence)/i, eventType: 'search_premises' },
  { pattern: /arrest(ed)?|taken\s+into\s+custody/i, eventType: 'arrest' },
  { pattern: /seized|confiscated|took\s+possession/i, eventType: 'seizure' },
];

export async function buildSearchSeizureChronology(caseId: string): Promise<{
  caseId: string; eventsCreated: number; events: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    orderBy: [{ page: 'asc' }, { lineStart: 'asc' }],
  });
  const results: Array<Record<string, unknown>> = [];
  let sequence = 0;

  for (const stmt of statements) {
    for (const sep of SS_EVENT_PATTERNS) {
      if (sep.pattern.test(stmt.rawText)) {
        const existing = await prisma.searchSeizureChronology.findFirst({
          where: { caseId, eventType: sep.eventType, citations: { contains: stmt.id } },
        });
        if (existing) continue;

        const isLEspeaker = /officer|detective|sergeant|deputy|agent/i.test(stmt.speaker || '');

        const event = await prisma.searchSeizureChronology.create({
          data: {
            caseId,
            eventType: sep.eventType,
            officerIdentifier: isLEspeaker ? (stmt.speaker || 'Unknown Officer') : null,
            sequenceNumber: sequence++,
            constitutionalIssue: false,
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker, statementId: stmt.id }]),
          },
        });
        results.push({ id: event.id, eventType: sep.eventType, sequence: event.sequenceNumber });
        break;
      }
    }
  }

  return { caseId, eventsCreated: results.length, events: results };
}

// ---------------------------------------------------------------------------
// 8. Custodial Interrogation Tracking (citation-backed)
// ---------------------------------------------------------------------------

export async function trackCustodialInterrogations(caseId: string): Promise<{
  caseId: string; interrogationsTracked: number; interrogations: Array<Record<string, unknown>>;
}> {
  const fifthIssues = await prisma.fifthAmendmentIssue.findMany({
    where: { caseId, issueType: { in: ['miranda_violation', 'compelled_statement'] } },
  });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // From Fifth Amendment issues
  for (const fi of fifthIssues) {
    const existing = await prisma.custodialInterrogation.findFirst({
      where: { caseId, voluntarinessAssessment: fi.voluntariness || 'ambiguous' },
    });
    if (existing) continue;

    const coercionIndicators: string[] = [];
    if (/threat|threaten/i.test(fi.description)) coercionIndicators.push('threats');
    if (/prolonged|hours|lengthy/i.test(fi.description)) coercionIndicators.push('prolonged_interrogation');
    if (/deception|lied|false/i.test(fi.description)) coercionIndicators.push('deception');
    if (/minor|juvenile|youth/i.test(fi.description)) coercionIndicators.push('juvenile');
    if (/mental|cognitive|disability/i.test(fi.description)) coercionIndicators.push('mental_vulnerability');

    const interrogation = await prisma.custodialInterrogation.create({
      data: {
        caseId,
        location: fi.interrogationContext || 'unknown',
        mirandaGiven: fi.mirandaAdvisement === 'given',
        mirandaWaiver: fi.mirandaAdvisement === 'given' ? 'express' : 'ambiguous',
        invocationOfRights: 'ambiguous',
        postInvocationQuestioning: false,
        coercionIndicators: JSON.stringify(coercionIndicators),
        statementObtained: fi.statementUsed,
        voluntarinessAssessment: fi.voluntariness || 'ambiguous',
        suppressionViability: fi.suppressionViability,
        citations: fi.citations,
      },
    });
    results.push({ id: interrogation.id, voluntariness: fi.voluntariness, coercionIndicators });
  }

  // Scan for interrogation-related statements
  for (const stmt of statements) {
    if (/interrogat|question(ed|ing)\s+(the\s+)?(defendant|suspect)/i.test(stmt.rawText)) {
      const existing = await prisma.custodialInterrogation.findFirst({
        where: { caseId, citations: { contains: stmt.id } },
      });
      if (existing) continue;

      const interrogation = await prisma.custodialInterrogation.create({
        data: {
          caseId,
          coercionIndicators: JSON.stringify([]),
          voluntarinessAssessment: 'ambiguous',
          suppressionViability: 'moderate',
          citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker, statementId: stmt.id }]),
        },
      });
      results.push({ id: interrogation.id, source: 'statement_scan' });
    }
  }

  return { caseId, interrogationsTracked: results.length, interrogations: results };
}

// ---------------------------------------------------------------------------
// 9. Confrontation Clause Witness Index (deterministic)
// ---------------------------------------------------------------------------

export async function indexConfrontationWitnesses(caseId: string): Promise<{
  caseId: string; witnessesIndexed: number; witnesses: Array<Record<string, unknown>>;
}> {
  const confrontations = await prisma.sixthAmendmentConfrontation.findMany({ where: { caseId } });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const witnessMap = new Map<string, { testimonialStatements: number; crossExamined: boolean }>();
  for (const stmt of statements) {
    if (!stmt.speaker) continue;
    const entry = witnessMap.get(stmt.speaker) || { testimonialStatements: 0, crossExamined: false };
    if (stmt.statementType === 'testimony') entry.testimonialStatements++;
    witnessMap.set(stmt.speaker, entry);
  }

  for (const [witness, data] of witnessMap) {
    const confrontation = confrontations.find(c => c.witnessName === witness);

    const existing = await prisma.confrontationWitnessIndex.findFirst({
      where: { caseId, witnessName: witness },
    });
    if (existing) continue;

    const crawfordIssue = confrontation?.crawfordApplicable || false;
    const brutonIssue = confrontation?.brutonIssue || false;
    const confrontationSatisfied = !crawfordIssue && !brutonIssue && data.testimonialStatements > 0;

    const index = await prisma.confrontationWitnessIndex.create({
      data: {
        caseId,
        witnessName: witness,
        witnessType: data.testimonialStatements > 0 ? 'testifying' : 'non_testifying',
        testimonialStatements: data.testimonialStatements,
        crossExaminationOccurred: data.crossExamined,
        confrontationSatisfied,
        crawfordIssue,
        brutonIssue,
        reliabilityScore: confrontationSatisfied ? 1.0 : crawfordIssue ? 0.3 : 0.6,
        citations: JSON.stringify([{ caseId, testimonialStatements: data.testimonialStatements }]),
      },
    });
    results.push({ id: index.id, witnessName: witness, confrontationSatisfied, crawfordIssue });
  }

  return { caseId, witnessesIndexed: results.length, witnesses: results };
}

// ---------------------------------------------------------------------------
// 10. Constitutional Preservation Graph (immutable)
// ---------------------------------------------------------------------------

export async function buildConstitutionalPreservationGraph(caseId: string): Promise<{
  caseId: string; graphsBuilt: number; graphs: Array<Record<string, unknown>>;
}> {
  const claimPreservations = await prisma.constitutionalClaimPreservation.findMany({ where: { caseId } });
  const fourthIssues = await prisma.fourthAmendmentIssue.findMany({ where: { caseId } });
  const fifthIssues = await prisma.fifthAmendmentIssue.findMany({ where: { caseId } });
  const sixthIssues = await prisma.sixthAmendmentConfrontation.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // From ConstitutionalClaimPreservation (E.1)
  for (const cp of claimPreservations) {
    const existing = await prisma.constitutionalPreservationGraph.findFirst({
      where: { caseId, amendment: cp.amendment, issueType: cp.claimType },
    });
    if (existing) continue;

    const chain = [{ action: cp.preservationMethod, status: cp.preservationStatus, standard: cp.standardOfReview }];

    const graph = await prisma.constitutionalPreservationGraph.create({
      data: {
        caseId,
        amendment: cp.amendment,
        issueType: cp.claimType,
        preservationChain: JSON.stringify(chain),
        chainLength: chain.length,
        currentStatus: cp.preservationStatus,
        riskOfForfeiture: cp.preservationStatus === 'partially_preserved',
        requiredActions: cp.preservationStatus === 'partially_preserved' ? JSON.stringify(['File supplemental motion', 'Renew objection at appropriate time']) : null,
        citations: cp.citations,
      },
    });
    results.push({ id: graph.id, amendment: cp.amendment, issueType: cp.claimType, status: cp.preservationStatus });
  }

  // 4th Amendment issues
  for (const fi of fourthIssues) {
    const existing = await prisma.constitutionalPreservationGraph.findFirst({
      where: { caseId, amendment: '4th', issueType: fi.issueType },
    });
    if (existing) continue;

    const graph = await prisma.constitutionalPreservationGraph.create({
      data: {
        caseId,
        amendment: '4th',
        issueType: fi.issueType,
        preservationChain: JSON.stringify([{ action: 'motion_to_suppress', viability: fi.suppressionViability }]),
        chainLength: 1,
        currentStatus: 'preserved',
        riskOfForfeiture: fi.suppressionViability === 'weak',
        citations: fi.citations,
      },
    });
    results.push({ id: graph.id, amendment: '4th', issueType: fi.issueType });
  }

  // 5th Amendment issues
  for (const fi of fifthIssues) {
    const existing = await prisma.constitutionalPreservationGraph.findFirst({
      where: { caseId, amendment: '5th', issueType: fi.issueType },
    });
    if (existing) continue;

    const graph = await prisma.constitutionalPreservationGraph.create({
      data: {
        caseId,
        amendment: '5th',
        issueType: fi.issueType,
        preservationChain: JSON.stringify([{ action: 'motion_to_suppress', viability: fi.suppressionViability }]),
        chainLength: 1,
        currentStatus: 'preserved',
        riskOfForfeiture: fi.suppressionViability === 'weak',
        citations: fi.citations,
      },
    });
    results.push({ id: graph.id, amendment: '5th', issueType: fi.issueType });
  }

  // 6th Amendment issues
  for (const si of sixthIssues) {
    if (!si.crawfordApplicable && !si.brutonIssue) continue;
    const existing = await prisma.constitutionalPreservationGraph.findFirst({
      where: { caseId, amendment: '6th', issueType: si.confrontationType },
    });
    if (existing) continue;

    const graph = await prisma.constitutionalPreservationGraph.create({
      data: {
        caseId,
        amendment: '6th',
        issueType: si.confrontationType,
        preservationChain: JSON.stringify([{ action: 'confrontation_objection', viability: si.confrontationViability }]),
        chainLength: 1,
        currentStatus: 'preserved',
        riskOfForfeiture: si.confrontationViability === 'weak',
        citations: si.citations,
      },
    });
    results.push({ id: graph.id, amendment: '6th', issueType: si.confrontationType });
  }

  return { caseId, graphsBuilt: results.length, graphs: results };
}

// ---------------------------------------------------------------------------
// Full Constitutional Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullConstitutionalAnalysis(caseId: string): Promise<Record<string, unknown>> {
  const fourth = await analyzeFourthAmendmentIssues(caseId);
  const fifth = await trackFifthAmendmentIssues(caseId);
  const sixth = await analyzeSixthAmendmentConfrontation(caseId);
  const dueProcess = await analyzeDueProcessIntegrity(caseId);
  const structural = await categorizeStructuralErrors(caseId);
  const suppression = await mapSuppressionIssues(caseId);
  const searchSeizure = await buildSearchSeizureChronology(caseId);
  const interrogation = await trackCustodialInterrogations(caseId);
  const confrontationIndex = await indexConfrontationWitnesses(caseId);
  const preservationGraph = await buildConstitutionalPreservationGraph(caseId);

  return {
    caseId,
    summary: {
      fourthAmendmentIssues: fourth.issuesFound,
      fifthAmendmentIssues: fifth.issuesFound,
      sixthAmendmentConfrontations: sixth.confrontationsFound,
      dueProcessIssues: dueProcess.issuesFound,
      structuralErrors: structural.errorsFound,
      suppressionIssues: suppression.issuesMapped,
      searchSeizureEvents: searchSeizure.eventsCreated,
      custodialInterrogations: interrogation.interrogationsTracked,
      confrontationWitnesses: confrontationIndex.witnessesIndexed,
      preservationGraphs: preservationGraph.graphsBuilt,
    },
    principle: 'CourtAccess organizes provable constitutional issue structures. It does NOT function as constitutional litigation counsel.',
  };
}
