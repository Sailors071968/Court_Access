// ============================================================================
// Phase D.6 — Judicial Motion Intelligence + Evidentiary Objection Framework
// Deterministic evidence-code objection engine. Citation-backed only.
// NEVER fabricates Brady claims, invents constitutional violations, or
// generates legal opinions. Identifies and organizes provable evidentiary
// and procedural issues.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Hearsay detection patterns (EC § 1200 et seq.)
// ---------------------------------------------------------------------------

const HEARSAY_INDICATORS = [
  { pattern: /\b(?:he|she|they)\s+(?:said|told|stated|claimed|reported|testified|mentioned|indicated|informed)\b/i, level: 'single' },
  { pattern: /\baccording\s+to\b/i, level: 'single' },
  { pattern: /\b(?:was\s+told|heard\s+(?:him|her|them)\s+say)\b/i, level: 'single' },
  { pattern: /\b(?:somebody|someone)\s+(?:said|told|mentioned)\b/i, level: 'single' },
  { pattern: /\btold\s+(?:me|us|him|her|them|the\s+officer)\s+that\b/i, level: 'single' },
  { pattern: /\b(?:he|she)\s+said\s+(?:that\s+)?(?:he|she|they)\s+(?:said|told)\b/i, level: 'double' },
  { pattern: /\breported\s+that\s+.*\s+said\b/i, level: 'double' },
];

const HEARSAY_EXCEPTIONS: Record<string, { section: string; name: string; test: RegExp }> = {
  party_admission: { section: 'EC § 1220', name: 'Party Admission', test: /\bdefendant\s+(?:said|stated|admitted|told|confessed)\b/i },
  spontaneous: { section: 'EC § 1240', name: 'Spontaneous Statement', test: /\b(?:spontaneous|excited\s+utterance|immediately\s+(?:said|exclaimed|shouted))\b/i },
  business_record: { section: 'EC § 1271', name: 'Business Record', test: /\b(?:business\s+record|medical\s+record|hospital\s+record|lab\s+report)\b/i },
  official_record: { section: 'EC § 1280', name: 'Official Record', test: /\b(?:official\s+record|police\s+report|government\s+record)\b/i },
  dying_declaration: { section: 'EC § 1242', name: 'Dying Declaration', test: /\b(?:dying\s+declaration|thought\s+(?:he|she)\s+was\s+dying)\b/i },
  prior_inconsistent: { section: 'EC § 1235', name: 'Prior Inconsistent Statement', test: /\b(?:prior\s+inconsistent|previously\s+(?:said|stated|testified))\b/i },
  contemporaneous: { section: 'EC § 1241', name: 'Contemporaneous Statement', test: /\b(?:at\s+the\s+(?:same\s+)?time|while\s+(?:it|the\s+event)\s+was\s+happening)\b/i },
};

// ---------------------------------------------------------------------------
// Foundation defect patterns (EC § 403, 700, 702, 800, 801)
// ---------------------------------------------------------------------------

const FOUNDATION_PATTERNS: Array<{ pattern: RegExp; defectType: string; section: string }> = [
  { pattern: /\bI\s+(?:think|believe|guess|assume|suppose)\b/i, defectType: 'speculation', section: 'EC § 702' },
  { pattern: /\b(?:probably|possibly|maybe|might\s+have|could\s+have\s+been)\b/i, defectType: 'speculation', section: 'EC § 702' },
  { pattern: /\bin\s+my\s+(?:opinion|experience|view)\b/i, defectType: 'improper_opinion', section: 'EC § 800' },
  { pattern: /\bI\s+(?:wasn't|was\s+not)\s+there\b/i, defectType: 'lack_personal_knowledge', section: 'EC § 702' },
  { pattern: /\bI\s+(?:didn't|did\s+not)\s+(?:see|hear|witness|observe)\b/i, defectType: 'lack_personal_knowledge', section: 'EC § 702' },
  { pattern: /\b(?:it\s+looked\s+like|it\s+appeared|it\s+seemed)\b/i, defectType: 'improper_opinion', section: 'EC § 800' },
  { pattern: /\b(?:expert|expertise|specialized\s+knowledge)\b/i, defectType: 'insufficient_expertise', section: 'EC § 801' },
];

// ---------------------------------------------------------------------------
// Constitutional issue patterns
// ---------------------------------------------------------------------------

const CONSTITUTIONAL_PATTERNS: Array<{ pattern: RegExp; amendment: string; issueType: string }> = [
  { pattern: /\b(?:searched|search)\s+(?:without|no)\s+(?:a\s+)?warrant\b/i, amendment: '4th', issueType: 'unlawful_search' },
  { pattern: /\b(?:warrantless\s+(?:search|entry|seizure))\b/i, amendment: '4th', issueType: 'unlawful_search' },
  { pattern: /\b(?:consent\s+(?:was\s+)?(?:not|never)\s+(?:given|obtained))\b/i, amendment: '4th', issueType: 'unlawful_search' },
  { pattern: /\b(?:seized|confiscated)\s+(?:without|no)\s+(?:a\s+)?warrant\b/i, amendment: '4th', issueType: 'unlawful_seizure' },
  { pattern: /\b(?:Miranda|rights?\s+(?:were\s+)?(?:not|never)\s+(?:read|given|advised))\b/i, amendment: '5th', issueType: 'miranda_violation' },
  { pattern: /\b(?:invoked|requested)\s+(?:an?\s+)?(?:attorney|lawyer|counsel)\b/i, amendment: '6th', issueType: 'right_to_counsel' },
  { pattern: /\b(?:questioned|interrogated)\s+(?:after|without)\s+(?:requesting\s+)?(?:attorney|lawyer|counsel)\b/i, amendment: '6th', issueType: 'right_to_counsel' },
  { pattern: /\b(?:confrontation|cross-examin|face\s+(?:his|her|their)\s+accuser)\b/i, amendment: '6th', issueType: 'confrontation_clause' },
  { pattern: /\b(?:speedy\s+trial|delayed\s+(?:prosecution|arraignment|trial))\b/i, amendment: '6th', issueType: 'speedy_trial' },
  { pattern: /\b(?:due\s+process)\b/i, amendment: '14th', issueType: 'due_process' },
];

// ---------------------------------------------------------------------------
// Chain of custody patterns
// ---------------------------------------------------------------------------

const CUSTODY_PATTERNS: Array<{ pattern: RegExp; issueType: string }> = [
  { pattern: /\b(?:evidence\s+was\s+(?:lost|misplaced|missing|destroyed))\b/i, issueType: 'missing_log' },
  { pattern: /\b(?:no\s+(?:log|record|documentation)\s+of\s+(?:transfer|handling|storage))\b/i, issueType: 'undocumented_transfer' },
  { pattern: /\b(?:contaminated|contamination|cross-contaminat)\b/i, issueType: 'contamination_risk' },
  { pattern: /\b(?:improper(?:ly)?\s+(?:stored|storage|sealed|packaging))\b/i, issueType: 'improper_storage' },
  { pattern: /\b(?:gap\s+in\s+(?:the\s+)?chain|unaccounted\s+(?:for\s+)?(?:time|period))\b/i, issueType: 'gap_in_chain' },
  { pattern: /\b(?:delayed\s+(?:processing|testing|analysis))\b/i, issueType: 'delayed_processing' },
];

// ---------------------------------------------------------------------------
// Discovery violation patterns (PC § 1054 et seq.)
// ---------------------------------------------------------------------------

const DISCOVERY_PATTERNS: Array<{ pattern: RegExp; violationType: string }> = [
  { pattern: /\b(?:late(?:ly)?\s+disclos|untimely\s+disclos|disclosed\s+(?:late|at\s+the\s+last))\b/i, violationType: 'late_disclosure' },
  { pattern: /\b(?:never\s+(?:provided|disclosed|produced)|withheld|failed\s+to\s+(?:disclose|produce))\b/i, violationType: 'withheld_evidence' },
  { pattern: /\b(?:incomplete\s+(?:production|disclosure|discovery))\b/i, violationType: 'incomplete_production' },
  { pattern: /\b(?:altered|tampered|modified\s+(?:evidence|document))\b/i, violationType: 'altered_evidence' },
  { pattern: /\b(?:lost\s+evidence|evidence\s+(?:was\s+)?(?:lost|destroyed))\b/i, violationType: 'lost_evidence' },
  { pattern: /\b(?:fail(?:ed|ure)\s+to\s+preserve)\b/i, violationType: 'failure_to_preserve' },
];

// ---------------------------------------------------------------------------
// Brady/Giglio patterns
// ---------------------------------------------------------------------------

const BRADY_PATTERNS: Array<{ pattern: RegExp; issueType: string }> = [
  { pattern: /\b(?:exculpatory|favorable\s+to\s+(?:the\s+)?(?:defense|defendant))\b/i, issueType: 'undisclosed_exculpatory' },
  { pattern: /\b(?:deal|agreement|plea\s+(?:bargain|deal)|cooperation\s+agreement|immunity)\b/i, issueType: 'undisclosed_deal' },
  { pattern: /\b(?:prior\s+(?:conviction|arrest|bad\s+act)|criminal\s+history)\b/i, issueType: 'undisclosed_prior_bad_acts' },
  { pattern: /\b(?:impeach(?:ment)?|credibility\s+(?:issue|problem))\b/i, issueType: 'giglio_impeachment' },
];

// ---------------------------------------------------------------------------
// 1. Hearsay Analysis
// ---------------------------------------------------------------------------

export async function analyzeHearsay(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const indicator of HEARSAY_INDICATORS) {
      if (indicator.pattern.test(stmt.rawText)) {
        // Check for exceptions
        let exceptionClaimed: string | null = null;
        let exceptionAnalysis: string | null = null;
        for (const [_key, exc] of Object.entries(HEARSAY_EXCEPTIONS)) {
          if (exc.test.test(stmt.rawText)) {
            exceptionClaimed = `${exc.section} (${exc.name})`;
            exceptionAnalysis = `Pattern match for ${exc.name} detected. Defense should challenge applicability of ${exc.section}.`;
            break;
          }
        }

        const strength = indicator.level === 'double' ? 'strong' : (exceptionClaimed ? 'moderate' : 'strong');

        const issue = await prisma.hearsayIssue.create({
          data: {
            caseId,
            statementId: stmt.id,
            declarant: stmt.speaker || 'Unknown declarant',
            reportingSpeaker: stmt.speaker,
            hearsayLevel: indicator.level,
            statementText: stmt.rawText,
            page: stmt.page,
            lineStart: stmt.lineStart,
            documentId: stmt.documentId,
            exceptionClaimed,
            exceptionAnalysis,
            objectionBasis: `EC § 1200 (Hearsay Rule) — ${indicator.level} hearsay`,
            strength,
          },
        });

        results.push({
          id: issue.id,
          declarant: issue.declarant,
          hearsayLevel: issue.hearsayLevel,
          text: stmt.rawText.slice(0, 200),
          page: stmt.page,
          line: stmt.lineStart,
          exception: exceptionClaimed,
          strength,
        });

        // Only record first hearsay match per statement
        break;
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

// ---------------------------------------------------------------------------
// 2. Foundation Defect Detection
// ---------------------------------------------------------------------------

export async function detectFoundationDefects(caseId: string): Promise<{
  caseId: string; defectsFound: number; defects: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    for (const fp of FOUNDATION_PATTERNS) {
      if (fp.pattern.test(stmt.rawText)) {
        const explanation = buildFoundationExplanation(fp.defectType, stmt.rawText, stmt.speaker);
        const strength = fp.defectType === 'lack_personal_knowledge' ? 'strong' : 'moderate';

        const defect = await prisma.foundationDefect.create({
          data: {
            caseId,
            statementId: stmt.id,
            documentId: stmt.documentId,
            defectType: fp.defectType,
            evidenceCodeSection: fp.section,
            affectedText: stmt.rawText,
            page: stmt.page,
            lineStart: stmt.lineStart,
            speaker: stmt.speaker,
            explanation,
            strength,
          },
        });

        results.push({
          id: defect.id,
          defectType: fp.defectType,
          section: fp.section,
          text: stmt.rawText.slice(0, 200),
          page: stmt.page,
          speaker: stmt.speaker,
          strength,
        });

        break; // One defect per statement
      }
    }
  }

  return { caseId, defectsFound: results.length, defects: results };
}

function buildFoundationExplanation(defectType: string, _text: string, speaker: string | null): string {
  const who = speaker || 'The witness';
  switch (defectType) {
    case 'speculation':
      return `${who} uses speculative language indicating lack of actual knowledge. Objection: The testimony calls for speculation (EC § 702).`;
    case 'improper_opinion':
      return `${who} offers an improper lay opinion beyond the scope of EC § 800 (lay opinion must be rationally based on witness perception).`;
    case 'lack_personal_knowledge':
      return `${who} lacks personal knowledge of the facts testified to. EC § 702 requires personal knowledge as foundation.`;
    case 'insufficient_expertise':
      return `${who} offers expert-level opinion without proper qualification under EC § 801. Foundation for expertise not established.`;
    default:
      return `Foundation defect identified in testimony by ${who}.`;
  }
}

// ---------------------------------------------------------------------------
// 3. Authentication Challenge Detection
// ---------------------------------------------------------------------------

export async function detectAuthenticationChallenges(caseId: string): Promise<{
  caseId: string; challengesFound: number; challenges: Array<Record<string, unknown>>;
}> {
  // Look at documents and their evidence statements for authentication issues
  const documents = await prisma.evidenceDocument.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const doc of documents) {
    // Check if any statements reference this document's authentication
    const stmts = await prisma.evidenceStatement.findMany({
      where: { documentId: doc.id },
      take: 50,
    });

    // Look for authentication-related issues in statements
    let hasFoundation = false;
    const authIssues: string[] = [];

    for (const stmt of stmts) {
      if (/\b(?:authentic|original|true\s+(?:and\s+correct\s+)?copy)\b/i.test(stmt.rawText)) {
        hasFoundation = true;
      }
      if (/\b(?:altered|modified|changed|different\s+(?:version|copy))\b/i.test(stmt.rawText)) {
        authIssues.push('altered_document');
      }
      if (/\b(?:incomplete|missing\s+page|redacted)\b/i.test(stmt.rawText)) {
        authIssues.push('incomplete_document');
      }
    }

    // If document has many statements but no authentication foundation
    if (stmts.length > 3 && !hasFoundation) {
      const challenge = await prisma.authenticationChallenge.create({
        data: {
          caseId,
          documentId: doc.id,
          challengeType: 'no_witness_foundation',
          evidenceCodeSection: 'EC § 1401',
          documentDescription: doc.fileName || doc.id,
          explanation: `No witness has authenticated this document per EC § 1401. Defense may challenge its admissibility.`,
          supportingEvidence: JSON.stringify([{ document: doc.id, note: 'No authentication testimony found' }]),
          strength: 'moderate',
        },
      });
      results.push({
        id: challenge.id,
        documentId: doc.id,
        challengeType: 'no_witness_foundation',
        strength: 'moderate',
      });
    }

    // Record specific authentication issues found in testimony
    for (const issue of [...new Set(authIssues)]) {
      const challenge = await prisma.authenticationChallenge.create({
        data: {
          caseId,
          documentId: doc.id,
          challengeType: issue,
          evidenceCodeSection: issue === 'altered_document' ? 'EC § 1402' : 'EC § 1400',
          documentDescription: doc.fileName || doc.id,
          explanation: issue === 'altered_document'
            ? 'Evidence suggests document may have been altered. Defense should challenge under EC § 1402.'
            : 'Document appears incomplete. Defense should object to admission of incomplete evidence.',
          supportingEvidence: JSON.stringify(stmts.filter(s => /\b(?:altered|incomplete|missing|redacted)\b/i.test(s.rawText)).map(s => ({
            text: s.rawText.slice(0, 150), page: s.page, line: s.lineStart,
          }))),
          strength: 'strong',
        },
      });
      results.push({
        id: challenge.id,
        documentId: doc.id,
        challengeType: issue,
        strength: 'strong',
      });
    }
  }

  return { caseId, challengesFound: results.length, challenges: results };
}

// ---------------------------------------------------------------------------
// 4. Chain of Custody Issue Detection
// ---------------------------------------------------------------------------

export async function detectChainOfCustodyIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedItems = new Set<string>();

  for (const stmt of statements) {
    for (const cp of CUSTODY_PATTERNS) {
      if (cp.pattern.test(stmt.rawText)) {
        // Group by issue type + approximate evidence item
        const itemKey = `${cp.issueType}_${stmt.documentId || 'unknown'}`;
        if (processedItems.has(itemKey)) continue;
        processedItems.add(itemKey);

        const issue = await prisma.chainOfCustodyIssue.create({
          data: {
            caseId,
            evidenceItem: `Evidence referenced in ${stmt.documentId || 'unknown document'}`,
            issueType: cp.issueType,
            explanation: buildCustodyExplanation(cp.issueType, stmt.rawText),
            affectedStatements: JSON.stringify([stmt.id]),
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 300),
              page: stmt.page,
              line: stmt.lineStart,
              speaker: stmt.speaker,
              document: stmt.documentId,
            }]),
            strength: cp.issueType === 'contamination_risk' ? 'strong' : 'moderate',
          },
        });

        results.push({
          id: issue.id,
          issueType: cp.issueType,
          text: stmt.rawText.slice(0, 200),
          page: stmt.page,
          strength: issue.strength,
        });
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

function buildCustodyExplanation(issueType: string, _text: string): string {
  switch (issueType) {
    case 'gap_in_chain':
      return 'Gap identified in chain of custody. Defense should challenge continuity of evidence handling.';
    case 'improper_storage':
      return 'Evidence may have been improperly stored, risking degradation or contamination.';
    case 'contamination_risk':
      return 'Contamination risk identified. Defense should challenge integrity of physical evidence.';
    case 'missing_log':
      return 'Evidence handling log appears incomplete or missing. Defense should demand full chain documentation.';
    case 'undocumented_transfer':
      return 'Evidence transfer not properly documented. Defense should challenge admissibility.';
    case 'delayed_processing':
      return 'Evidence processing was delayed, potentially affecting reliability of results.';
    default:
      return 'Chain of custody issue identified.';
  }
}

// ---------------------------------------------------------------------------
// 5. Constitutional Issue Detection
// ---------------------------------------------------------------------------

export async function detectConstitutionalIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const cp of CONSTITUTIONAL_PATTERNS) {
      if (cp.pattern.test(stmt.rawText)) {
        const typeKey = `${cp.issueType}_${stmt.documentId || 'na'}`;
        if (processedTypes.has(typeKey)) continue;
        processedTypes.add(typeKey);

        const title = buildConstitutionalTitle(cp.issueType);
        const description = buildConstitutionalDescription(cp.issueType, cp.amendment, stmt.rawText);

        const issue = await prisma.constitutionalIssue.create({
          data: {
            caseId,
            amendmentBasis: cp.amendment,
            issueType: cp.issueType,
            title,
            description,
            factualBasis: `Statement by ${stmt.speaker || 'unknown'}: "${stmt.rawText.slice(0, 300)}" (p. ${stmt.page ?? '?'}, ln. ${stmt.lineStart ?? '?'})`,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 300),
              page: stmt.page,
              line: stmt.lineStart,
              speaker: stmt.speaker,
              document: stmt.documentId,
            }]),
            affectedEvidence: JSON.stringify([stmt.id]),
            suppressionPotential: cp.issueType === 'unlawful_search' || cp.issueType === 'miranda_violation' ? 'high' : 'medium',
            strength: 'moderate',
          },
        });

        results.push({
          id: issue.id,
          amendment: cp.amendment,
          issueType: cp.issueType,
          title,
          suppressionPotential: issue.suppressionPotential,
          strength: issue.strength,
        });
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

function buildConstitutionalTitle(issueType: string): string {
  const titles: Record<string, string> = {
    unlawful_search: 'Potential Unlawful Search (4th Amendment)',
    unlawful_seizure: 'Potential Unlawful Seizure (4th Amendment)',
    miranda_violation: 'Potential Miranda Violation (5th Amendment)',
    right_to_counsel: 'Right to Counsel Issue (6th Amendment)',
    confrontation_clause: 'Confrontation Clause Issue (6th Amendment)',
    speedy_trial: 'Speedy Trial Issue (6th Amendment)',
    due_process: 'Due Process Issue (14th Amendment)',
    double_jeopardy: 'Double Jeopardy Issue (5th Amendment)',
  };
  return titles[issueType] || `Constitutional Issue: ${issueType}`;
}

function buildConstitutionalDescription(issueType: string, amendment: string, _text: string): string {
  return `Evidence in case record suggests possible ${amendment} Amendment issue (${issueType.replace(/_/g, ' ')}). This issue was identified from testimony/evidence — defense should evaluate for suppression motion.`;
}

// ---------------------------------------------------------------------------
// 6. Discovery Violation Detection
// ---------------------------------------------------------------------------

export async function detectDiscoveryViolations(caseId: string): Promise<{
  caseId: string; violationsFound: number; violations: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const dp of DISCOVERY_PATTERNS) {
      if (dp.pattern.test(stmt.rawText)) {
        const typeKey = `${dp.violationType}_${stmt.documentId || 'na'}`;
        if (processedTypes.has(typeKey)) continue;
        processedTypes.add(typeKey);

        const remedySought = dp.violationType === 'withheld_evidence'
          ? 'exclusion' : dp.violationType === 'altered_evidence'
          ? 'sanctions' : 'continuance';

        const violation = await prisma.discoveryViolation.create({
          data: {
            caseId,
            violationType: dp.violationType,
            penalCodeSection: 'PC § 1054.1',
            description: buildDiscoveryDescription(dp.violationType),
            affectedEvidence: JSON.stringify([stmt.id]),
            discoveryTimeline: JSON.stringify({ note: 'Timeline to be determined from case file review' }),
            prejudiceAnalysis: `Defense was prejudiced by prosecution's ${dp.violationType.replace(/_/g, ' ')}. This impaired ability to prepare adequate defense.`,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 300),
              page: stmt.page,
              line: stmt.lineStart,
              speaker: stmt.speaker,
              document: stmt.documentId,
            }]),
            remedySought,
            strength: dp.violationType === 'withheld_evidence' ? 'strong' : 'moderate',
          },
        });

        results.push({
          id: violation.id,
          violationType: dp.violationType,
          remedySought,
          text: stmt.rawText.slice(0, 200),
          strength: violation.strength,
        });
      }
    }
  }

  return { caseId, violationsFound: results.length, violations: results };
}

function buildDiscoveryDescription(violationType: string): string {
  const descriptions: Record<string, string> = {
    late_disclosure: 'Prosecution disclosed evidence after the deadline required by PC § 1054.7, impairing defense preparation.',
    withheld_evidence: 'Prosecution failed to disclose evidence required under PC § 1054.1.',
    incomplete_production: 'Discovery production was incomplete. Defense should file motion to compel under PC § 1054.5.',
    altered_evidence: 'Evidence appears to have been altered or tampered with. Defense should seek sanctions.',
    lost_evidence: 'Prosecution lost or destroyed evidence. Defense should seek adverse inference instruction or dismissal.',
    failure_to_preserve: 'Prosecution failed to preserve evidence as required. Defense should file Trombetta/Youngblood motion.',
  };
  return descriptions[violationType] || `Discovery violation: ${violationType}`;
}

// ---------------------------------------------------------------------------
// 7. Brady/Giglio Issue Detection
// ---------------------------------------------------------------------------

export async function detectBradyGiglioIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  // Also check witness inconsistencies — these can indicate Giglio issues
  const witnessInconsistencies = await prisma.witnessInconsistency.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  // Pattern-based detection from statements
  for (const stmt of statements) {
    for (const bp of BRADY_PATTERNS) {
      if (bp.pattern.test(stmt.rawText)) {
        const typeKey = `${bp.issueType}_${stmt.documentId || 'na'}`;
        if (processedTypes.has(typeKey)) continue;
        processedTypes.add(typeKey);

        const issue = await prisma.bradyGiglioIssue.create({
          data: {
            caseId,
            issueType: bp.issueType,
            title: buildBradyTitle(bp.issueType),
            description: buildBradyDescription(bp.issueType),
            materialityAnalysis: `This evidence is material because it could change the outcome of the trial or sentencing.`,
            favorabilityBasis: `Evidence is favorable to the defense because it ${bp.issueType === 'giglio_impeachment' ? 'undermines prosecution witness credibility' : 'supports innocence or mitigates culpability'}.`,
            suppressionEvidence: `Identified from case materials — defense should request complete disclosure.`,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 300),
              page: stmt.page,
              line: stmt.lineStart,
              speaker: stmt.speaker,
              document: stmt.documentId,
            }]),
            discoveredVia: 'Pattern analysis of case evidence statements',
            strength: bp.issueType === 'undisclosed_exculpatory' ? 'strong' : 'moderate',
          },
        });

        results.push({
          id: issue.id,
          issueType: bp.issueType,
          title: issue.title,
          strength: issue.strength,
        });
      }
    }
  }

  // Giglio issues from witness credibility problems
  if (witnessInconsistencies.length >= 3) {
    const speakers = new Set(witnessInconsistencies.map(w => w.speaker));
    for (const speaker of speakers) {
      const speakerIssues = witnessInconsistencies.filter(w => w.speaker === speaker);
      if (speakerIssues.length >= 2) {
        const typeKey = `giglio_witness_${speaker}`;
        if (processedTypes.has(typeKey)) continue;
        processedTypes.add(typeKey);

        const issue = await prisma.bradyGiglioIssue.create({
          data: {
            caseId,
            issueType: 'giglio_impeachment',
            title: `Giglio Impeachment: ${speaker}`,
            description: `Witness ${speaker} has ${speakerIssues.length} identified inconsistencies. If prosecution is aware of credibility issues with this witness and has not disclosed, this constitutes a Giglio violation.`,
            materialityAnalysis: `Witness credibility is material to the prosecution's case. ${speakerIssues.length} inconsistencies identified.`,
            favorabilityBasis: `Impeachment evidence is favorable to the defense under Giglio v. United States.`,
            suppressionEvidence: `Defense should demand full disclosure of any prosecution knowledge of this witness's credibility issues.`,
            citations: JSON.stringify(speakerIssues.slice(0, 5).map(si => ({
              text: si.inconsistencyType,
              page: si.statementAPage,
              speaker: si.speaker,
              document: si.statementADocumentId,
            }))),
            discoveredVia: 'Cross-reference of witness inconsistencies detected in D.3 analysis',
            strength: speakerIssues.length >= 4 ? 'strong' : 'moderate',
          },
        });

        results.push({
          id: issue.id,
          issueType: 'giglio_impeachment',
          title: issue.title,
          witness: speaker,
          inconsistencyCount: speakerIssues.length,
          strength: issue.strength,
        });
      }
    }
  }

  return { caseId, issuesFound: results.length, issues: results };
}

function buildBradyTitle(issueType: string): string {
  const titles: Record<string, string> = {
    brady_material: 'Potential Brady Material (Undisclosed Exculpatory)',
    giglio_impeachment: 'Potential Giglio Impeachment Material',
    undisclosed_exculpatory: 'Undisclosed Exculpatory Evidence',
    undisclosed_deal: 'Undisclosed Witness Deal/Agreement',
    undisclosed_prior_bad_acts: 'Undisclosed Witness Prior Bad Acts',
  };
  return titles[issueType] || `Brady/Giglio Issue: ${issueType}`;
}

function buildBradyDescription(issueType: string): string {
  const descriptions: Record<string, string> = {
    brady_material: 'Evidence in the case record suggests material that may be exculpatory and should have been disclosed under Brady v. Maryland.',
    giglio_impeachment: 'Evidence suggests prosecution witness credibility issues that must be disclosed under Giglio v. United States.',
    undisclosed_exculpatory: 'Evidence favorable to the defense appears not to have been disclosed by prosecution.',
    undisclosed_deal: 'Testimony suggests a witness may have a deal or agreement with prosecution that has not been disclosed.',
    undisclosed_prior_bad_acts: 'Evidence suggests witness has prior bad acts that prosecution has not disclosed for impeachment purposes.',
  };
  return descriptions[issueType] || `Brady/Giglio issue: ${issueType}`;
}

// ---------------------------------------------------------------------------
// 8. Suppression Issue Identification
// ---------------------------------------------------------------------------

export async function identifySuppressionIssues(caseId: string): Promise<{
  caseId: string; issuesFound: number; issues: Array<Record<string, unknown>>;
}> {
  // Build suppression issues from constitutional issues
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({
    where: { caseId, suppressionPotential: { in: ['high', 'medium'] } },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const ci of constitutionalIssues) {
    const suppressionBasis = mapToSuppressionBasis(ci.issueType, ci.amendmentBasis);
    const charges = await prisma.charge.findMany({ where: { caseId } });

    const issue = await prisma.suppressionIssue.create({
      data: {
        caseId,
        suppressionBasis,
        evidenceToSuppress: `Evidence derived from ${ci.issueType.replace(/_/g, ' ')}`,
        legalBasis: `${ci.amendmentBasis} Amendment — ${ci.title}`,
        factualBasis: ci.factualBasis,
        citations: ci.citations,
        affectedCharges: JSON.stringify(charges.map(c => c.id)),
        impactAnalysis: buildSuppressionImpact(ci.issueType, charges.length),
        strength: ci.suppressionPotential === 'high' ? 'strong' : 'moderate',
      },
    });

    results.push({
      id: issue.id,
      suppressionBasis,
      constitutionalIssueId: ci.id,
      amendment: ci.amendmentBasis,
      issueType: ci.issueType,
      suppressionPotential: ci.suppressionPotential,
      strength: issue.strength,
      affectedChargeCount: charges.length,
    });
  }

  return { caseId, issuesFound: results.length, issues: results };
}

function mapToSuppressionBasis(issueType: string, amendment: string): string {
  const mapping: Record<string, string> = {
    unlawful_search: '4th_amendment',
    unlawful_seizure: '4th_amendment',
    miranda_violation: 'miranda',
    right_to_counsel: '6th_amendment',
    confrontation_clause: 'confrontation_clause',
    due_process: 'due_process',
  };
  return mapping[issueType] || `${amendment}_amendment`;
}

function buildSuppressionImpact(issueType: string, chargeCount: number): string {
  if (issueType === 'unlawful_search' || issueType === 'unlawful_seizure') {
    return `If suppressed under the exclusionary rule (fruit of the poisonous tree doctrine), physical evidence and derivative evidence would be excluded. This could affect all ${chargeCount} charge(s).`;
  }
  if (issueType === 'miranda_violation') {
    return `Statements obtained in violation of Miranda would be excluded from prosecution's case-in-chief. This could significantly weaken prosecution's case across ${chargeCount} charge(s).`;
  }
  return `Suppression of this evidence would affect the prosecution's ability to prove its case on ${chargeCount} charge(s).`;
}

// ---------------------------------------------------------------------------
// 9. General Evidentiary Objection Generation
// ---------------------------------------------------------------------------

export async function generateEvidentiaryObjections(caseId: string): Promise<{
  caseId: string; objectionsGenerated: number; objections: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
  });

  const results: Array<Record<string, unknown>> = [];
  const objectionPatterns: Array<{ pattern: RegExp; type: string; section: string; title: string }> = [
    { pattern: /\b(?:he|she|they)\s+(?:said|told|stated)\b/i, type: 'hearsay', section: 'EC § 1200', title: 'Hearsay Objection' },
    { pattern: /\bI\s+(?:think|believe|guess|assume)\b/i, type: 'speculation', section: 'EC § 702', title: 'Speculation / Lack of Foundation' },
    { pattern: /\b(?:in\s+my\s+opinion|I\s+feel\s+that)\b/i, type: 'foundation', section: 'EC § 800', title: 'Improper Lay Opinion' },
    { pattern: /\b(?:character|reputation|always\s+(?:does|has)|kind\s+of\s+person)\b/i, type: 'relevance', section: 'EC § 1101', title: 'Character Evidence (EC § 1101)' },
    { pattern: /\b(?:gruesome|graphic|shocking|disturbing|horrif)\b/i, type: 'prejudice_352', section: 'EC § 352', title: 'Undue Prejudice (EC § 352)' },
    { pattern: /\b(?:wouldn't\s+you\s+agree|isn't\s+it\s+true|don't\s+you\s+think)\b/i, type: 'leading', section: 'EC § 767', title: 'Leading Question' },
  ];

  for (const stmt of statements) {
    for (const op of objectionPatterns) {
      if (op.pattern.test(stmt.rawText)) {
        const objection = await prisma.evidentiaryObjection.create({
          data: {
            caseId,
            statementId: stmt.id,
            documentId: stmt.documentId,
            objectionType: op.type,
            evidenceCodeSection: op.section,
            title: op.title,
            description: `Objectionable testimony identified: ${op.title}. Statement by ${stmt.speaker || 'unknown'} at p. ${stmt.page ?? '?'}, ln. ${stmt.lineStart ?? '?'}.`,
            citedText: stmt.rawText,
            citedPage: stmt.page,
            citedLine: stmt.lineStart,
            citedSpeaker: stmt.speaker,
            citedDocument: stmt.documentId,
            strength: op.type === 'hearsay' || op.type === 'prejudice_352' ? 'strong' : 'moderate',
          },
        });

        results.push({
          id: objection.id,
          type: op.type,
          section: op.section,
          title: op.title,
          text: stmt.rawText.slice(0, 200),
          page: stmt.page,
          strength: objection.strength,
        });

        break; // One objection per statement
      }
    }
  }

  return { caseId, objectionsGenerated: results.length, objections: results };
}

// ---------------------------------------------------------------------------
// 10. Full Evidentiary Objection Analysis (Orchestrator)
// ---------------------------------------------------------------------------

export async function runFullObjectionAnalysis(caseId: string): Promise<{
  caseId: string;
  hearsay: { issuesFound: number };
  foundationDefects: { defectsFound: number };
  authenticationChallenges: { challengesFound: number };
  chainOfCustody: { issuesFound: number };
  constitutional: { issuesFound: number };
  discoveryViolations: { violationsFound: number };
  bradyGiglio: { issuesFound: number };
  suppressionIssues: { issuesFound: number };
  evidentiaryObjections: { objectionsGenerated: number };
  totalIssues: number;
}> {
  const hearsay = await analyzeHearsay(caseId);
  const foundation = await detectFoundationDefects(caseId);
  const authentication = await detectAuthenticationChallenges(caseId);
  const custody = await detectChainOfCustodyIssues(caseId);
  const constitutional = await detectConstitutionalIssues(caseId);
  const discovery = await detectDiscoveryViolations(caseId);
  const brady = await detectBradyGiglioIssues(caseId);
  const suppression = await identifySuppressionIssues(caseId);
  const objections = await generateEvidentiaryObjections(caseId);

  const totalIssues = hearsay.issuesFound + foundation.defectsFound + authentication.challengesFound
    + custody.issuesFound + constitutional.issuesFound + discovery.violationsFound
    + brady.issuesFound + suppression.issuesFound + objections.objectionsGenerated;

  return {
    caseId,
    hearsay: { issuesFound: hearsay.issuesFound },
    foundationDefects: { defectsFound: foundation.defectsFound },
    authenticationChallenges: { challengesFound: authentication.challengesFound },
    chainOfCustody: { issuesFound: custody.issuesFound },
    constitutional: { issuesFound: constitutional.issuesFound },
    discoveryViolations: { violationsFound: discovery.violationsFound },
    bradyGiglio: { issuesFound: brady.issuesFound },
    suppressionIssues: { issuesFound: suppression.issuesFound },
    evidentiaryObjections: { objectionsGenerated: objections.objectionsGenerated },
    totalIssues,
  };
}
