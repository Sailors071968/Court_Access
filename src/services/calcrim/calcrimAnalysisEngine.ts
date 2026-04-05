// ============================================================================
// CALCRIM Analysis Engine
// Compares uploaded evidence against CALCRIM charge elements to produce:
// 1. Element-by-element strength assessment
// 2. Investigative tasks
// 3. Legal instruments (motions, discovery)
// 4. Defense strategies
// 5. Inconsistencies/contradictions scored 1-100
// ============================================================================

import type { CalcrimInstruction, CalcrimElement } from './calcrimDatabase';
import { CALCRIM_DATABASE, findByCalcrimNumber, findByPenalCode, searchCalcrim } from './calcrimDatabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ElementStrength = 'strong' | 'moderate' | 'weak' | 'unsupported';

export interface ElementAnalysis {
  elementNumber: number;
  elementText: string;
  strength: ElementStrength;
  /** 1-100 score of how well prosecution can prove this element */
  prosecutionScore: number;
  /** Evidence snippets that support or refute the element */
  supportingEvidence: string[];
  refutingEvidence: string[];
  /** Suggested defense angle for this element */
  defenseAngle: string;
}

export interface InvestigativeTask {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedElements: number[];
  category: 'investigation' | 'witness' | 'forensic' | 'records' | 'expert';
}

export interface LegalInstrument {
  id: string;
  title: string;
  description: string;
  type: 'motion' | 'discovery' | 'subpoena' | 'expert' | 'brady_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedElements: number[];
  legalBasis: string;
}

export interface DefenseStrategy {
  id: string;
  title: string;
  description: string;
  confidence: number; // 1-100
  relatedElements: number[];
  category: 'constitutional' | 'procedural' | 'factual' | 'affirmative' | 'mitigation';
}

export interface Inconsistency {
  id: string;
  description: string;
  score: number; // 1-100
  sources: string[];
  relatedElements: number[];
  category: 'timeline' | 'narrative' | 'physical' | 'witness' | 'procedural' | 'documentary';
  recommendation: string;
}

export interface ChargeAnalysisResult {
  chargeId: string;
  calcrimNumber: string;
  chargeTitle: string;
  penalCode: string;
  overallDefenseScore: number; // 1-100 (higher = stronger defense)
  elements: ElementAnalysis[];
  investigativeTasks: InvestigativeTask[];
  legalInstruments: LegalInstrument[];
  defenseStrategies: DefenseStrategy[];
  inconsistencies: Inconsistency[];
  analyzedAt: string;
}

export interface FullCaseAnalysis {
  caseId: string;
  charges: ChargeAnalysisResult[];
  /** Cross-charge inconsistencies found across all evidence */
  crossChargeInconsistencies: Inconsistency[];
  /** Top 5 highest-rated inconsistencies across entire case */
  topInconsistencies: Inconsistency[];
  /** All inconsistencies sorted by score descending */
  allInconsistencies: Inconsistency[];
  totalInconsistencies: number;
  analyzedAt: string;
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  progress: number; // 0-100
}

// ---------------------------------------------------------------------------
// Evidence text extraction helpers
// ---------------------------------------------------------------------------

interface EvidenceDocument {
  id: string;
  name: string;
  type: string;
  content: string; // extracted text content
}

function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];

  // Extract sentences that contain legally significant keywords
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  for (const sentence of sentences) {
    const sl = sentence.toLowerCase();
    if (
      sl.includes('officer') || sl.includes('suspect') || sl.includes('defendant') ||
      sl.includes('witness') || sl.includes('evidence') || sl.includes('search') ||
      sl.includes('consent') || sl.includes('arrest') || sl.includes('possess') ||
      sl.includes('weapon') || sl.includes('force') || sl.includes('injury') ||
      sl.includes('vehicle') || sl.includes('substance') || sl.includes('intoxicated') ||
      sl.includes('drove') || sl.includes('impair') || sl.includes('blood') ||
      sl.includes('bodycam') || sl.includes('camera') || sl.includes('report') ||
      sl.includes('miranda') || sl.includes('rights') || sl.includes('warrant')
    ) {
      phrases.push(sentence);
    }
  }

  return phrases.length > 0 ? phrases : sentences.slice(0, 5);
}

function matchElementToEvidence(
  element: CalcrimElement,
  documents: EvidenceDocument[]
): { supporting: string[]; refuting: string[] } {
  const supporting: string[] = [];
  const refuting: string[] = [];

  for (const doc of documents) {
    const content = doc.content.toLowerCase();
    const phrases = extractKeyPhrases(doc.content);

    let hasKeywordMatch = false;
    for (const keyword of element.keywords) {
      if (content.includes(keyword.toLowerCase())) {
        hasKeywordMatch = true;
        break;
      }
    }

    if (hasKeywordMatch) {
      // Check for negation patterns that might refute the element
      for (const phrase of phrases) {
        const pl = phrase.toLowerCase();
        const hasNegation =
          pl.includes('no evidence') || pl.includes('not found') ||
          pl.includes('denied') || pl.includes('did not') ||
          pl.includes('unable to') || pl.includes('inconsistent') ||
          pl.includes('contradicts') || pl.includes('disputes') ||
          pl.includes('no indication') || pl.includes('lacks');

        const matchesElement = element.keywords.some((k) => pl.includes(k.toLowerCase()));

        if (matchesElement) {
          if (hasNegation) {
            refuting.push(`[${doc.name}] ${phrase}`);
          } else {
            supporting.push(`[${doc.name}] ${phrase}`);
          }
        }
      }
    }
  }

  return { supporting, refuting };
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function calculateElementStrength(
  supporting: number,
  refuting: number
): { strength: ElementStrength; score: number } {
  if (supporting === 0 && refuting === 0) {
    return { strength: 'unsupported', score: 25 };
  }
  const total = supporting + refuting;
  const ratio = supporting / total;

  if (ratio >= 0.75) return { strength: 'strong', score: Math.min(95, 60 + Math.round(ratio * 35)) };
  if (ratio >= 0.5) return { strength: 'moderate', score: Math.round(40 + ratio * 30) };
  if (ratio >= 0.25) return { strength: 'weak', score: Math.round(20 + ratio * 30) };
  return { strength: 'unsupported', score: Math.max(5, Math.round(ratio * 25)) };
}

function generateInconsistencies(
  documents: EvidenceDocument[],
  instruction: CalcrimInstruction,
  chargeId: string
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];
  let counter = 0;

  // Cross-document comparison for timeline inconsistencies
  const timePatterns = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b|\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
  const docTimes: Map<string, Array<{ doc: string; context: string }>> = new Map();

  for (const doc of documents) {
    const matches = doc.content.matchAll(timePatterns);
    for (const match of matches) {
      const time = match[0];
      if (!docTimes.has(time)) docTimes.set(time, []);
      const sentence = doc.content.substring(
        Math.max(0, (match.index ?? 0) - 60),
        Math.min(doc.content.length, (match.index ?? 0) + 60)
      ).trim();
      docTimes.get(time)!.push({ doc: doc.name, context: sentence });
    }
  }

  // Look for conflicting descriptions at the same time
  for (const [time, entries] of docTimes.entries()) {
    if (entries.length >= 2) {
      const docs = [...new Set(entries.map((e) => e.doc))];
      if (docs.length >= 2) {
        counter++;
        inconsistencies.push({
          id: `${chargeId}-inc-timeline-${counter}`,
          description: `Timeline discrepancy at ${time}: Different accounts in ${docs.join(' vs. ')}. "${entries[0].context}" vs. "${entries[1].context}"`,
          score: Math.min(85, 55 + docs.length * 10),
          sources: docs,
          relatedElements: instruction.elements.map((e) => e.number),
          category: 'timeline',
          recommendation: `Investigate timeline conflict at ${time}. Obtain independent corroboration (surveillance footage, dispatch logs, cell tower records).`,
        });
      }
    }
  }

  // Look for narrative inconsistencies (contradicting statements)
  const contradictionPairs = [
    { a: 'consent', b: 'refused', desc: 'Consent dispute' },
    { a: 'compliant', b: 'resist', desc: 'Compliance dispute' },
    { a: 'visible', b: 'concealed', desc: 'Visibility dispute' },
    { a: 'admitted', b: 'denied', desc: 'Statement dispute' },
    { a: 'armed', b: 'unarmed', desc: 'Weapon presence dispute' },
    { a: 'sober', b: 'intoxicated', desc: 'Intoxication dispute' },
    { a: 'cooperative', b: 'combative', desc: 'Behavior dispute' },
    { a: 'witness', b: 'no witness', desc: 'Witness availability dispute' },
    { a: 'identified', b: 'unidentified', desc: 'Identification dispute' },
    { a: 'warrant', b: 'warrantless', desc: 'Search authority dispute' },
  ];

  for (const pair of contradictionPairs) {
    const docsWithA: string[] = [];
    const docsWithB: string[] = [];

    for (const doc of documents) {
      const lower = doc.content.toLowerCase();
      if (lower.includes(pair.a)) docsWithA.push(doc.name);
      if (lower.includes(pair.b)) docsWithB.push(doc.name);
    }

    if (docsWithA.length > 0 && docsWithB.length > 0) {
      const uniqueDocsA = [...new Set(docsWithA)];
      const uniqueDocsB = [...new Set(docsWithB)];

      // Only flag if contradiction appears across different documents
      const crossDoc = uniqueDocsA.some((a) => !uniqueDocsB.includes(a)) ||
                       uniqueDocsB.some((b) => !uniqueDocsA.includes(b));

      if (crossDoc) {
        counter++;
        const relatedElements = instruction.elements
          .filter((el) => el.keywords.some((k) => k.toLowerCase().includes(pair.a) || k.toLowerCase().includes(pair.b)))
          .map((el) => el.number);

        inconsistencies.push({
          id: `${chargeId}-inc-narrative-${counter}`,
          description: `${pair.desc}: "${pair.a}" referenced in ${uniqueDocsA.join(', ')} but "${pair.b}" referenced in ${uniqueDocsB.join(', ')}. This directly conflicts and warrants investigation.`,
          score: Math.min(92, 60 + (uniqueDocsA.length + uniqueDocsB.length) * 8),
          sources: [...new Set([...uniqueDocsA, ...uniqueDocsB])],
          relatedElements: relatedElements.length > 0 ? relatedElements : [1],
          category: 'narrative',
          recommendation: `Obtain all versions of reports mentioning "${pair.a}" and "${pair.b}". File Brady request for any suppressed statements. Consider filing a motion highlighting this inconsistency.`,
        });
      }
    }
  }

  // Procedural inconsistencies — check for missing expected procedures
  const proceduralChecks = [
    { keyword: 'search', required: ['warrant', 'consent', 'incident to arrest', 'plain view', 'exigent'], desc: 'Search conducted without documented legal authority' },
    { keyword: 'arrest', required: ['miranda', 'rights', 'advised'], desc: 'Arrest without documented Miranda advisement' },
    { keyword: 'bodycam', required: ['activated', 'recording'], desc: 'Bodycam referenced but activation not documented' },
    { keyword: 'force', required: ['justified', 'reasonable', 'necessary', 'proportional'], desc: 'Force used without documented justification' },
  ];

  for (const check of proceduralChecks) {
    for (const doc of documents) {
      const lower = doc.content.toLowerCase();
      if (lower.includes(check.keyword)) {
        const hasRequired = check.required.some((r) => lower.includes(r));
        if (!hasRequired) {
          counter++;
          inconsistencies.push({
            id: `${chargeId}-inc-procedural-${counter}`,
            description: `${check.desc} in ${doc.name}. The document mentions "${check.keyword}" but does not include expected documentation of ${check.required.join('/')}.`,
            score: Math.min(88, 65 + 10),
            sources: [doc.name],
            relatedElements: instruction.elements.map((e) => e.number),
            category: 'procedural',
            recommendation: `File discovery request for complete documentation of the ${check.keyword}. Consider Motion to Suppress if procedural requirements were not met.`,
          });
        }
      }
    }
  }

  return inconsistencies;
}

// ---------------------------------------------------------------------------
// Main Analysis Functions
// ---------------------------------------------------------------------------

/**
 * Analyze a single charge against uploaded evidence documents.
 */
export function analyzeCharge(
  chargeId: string,
  calcrimNumberOrPenalCode: string,
  documents: EvidenceDocument[]
): ChargeAnalysisResult {
  // Find the instruction
  let instruction = findByCalcrimNumber(calcrimNumberOrPenalCode);
  if (!instruction) {
    const results = findByPenalCode(calcrimNumberOrPenalCode);
    instruction = results[0] ?? null;
  }
  if (!instruction) {
    const results = searchCalcrim(calcrimNumberOrPenalCode);
    instruction = results[0] ?? null;
  }

  // Fallback for unrecognized charges
  if (!instruction) {
    return {
      chargeId,
      calcrimNumber: calcrimNumberOrPenalCode,
      chargeTitle: `Charge: ${calcrimNumberOrPenalCode}`,
      penalCode: calcrimNumberOrPenalCode,
      overallDefenseScore: 50,
      elements: [],
      investigativeTasks: [],
      legalInstruments: [],
      defenseStrategies: [],
      inconsistencies: [],
      analyzedAt: new Date().toISOString(),
    };
  }

  // Analyze each element
  const elements: ElementAnalysis[] = instruction.elements.map((element) => {
    const { supporting, refuting } = matchElementToEvidence(element, documents);
    const { strength, score } = calculateElementStrength(supporting.length, refuting.length);

    // Generate defense angle based on strength
    let defenseAngle: string;
    switch (strength) {
      case 'unsupported':
        defenseAngle = `Element ${element.number} has no evidentiary support. Prosecution cannot establish this element beyond reasonable doubt.`;
        break;
      case 'weak':
        defenseAngle = `Element ${element.number} has weak evidentiary support. Challenge the credibility and weight of the limited evidence presented.`;
        break;
      case 'moderate':
        defenseAngle = `Element ${element.number} has moderate support. Focus on creating reasonable doubt through cross-examination and contradictory evidence.`;
        break;
      case 'strong':
        defenseAngle = `Element ${element.number} has strong evidentiary support. Consider challenging admissibility of key evidence or procedural violations.`;
        break;
    }

    return {
      elementNumber: element.number,
      elementText: element.text,
      strength,
      prosecutionScore: score,
      supportingEvidence: supporting.slice(0, 5),
      refutingEvidence: refuting.slice(0, 5),
      defenseAngle,
    };
  });

  // Generate investigative tasks
  const investigativeTasks: InvestigativeTask[] = [];
  let taskCounter = 0;

  for (const element of elements) {
    if (element.strength === 'moderate' || element.strength === 'strong') {
      taskCounter++;
      investigativeTasks.push({
        id: `${chargeId}-task-${taskCounter}`,
        title: `Investigate Element ${element.elementNumber} Vulnerabilities`,
        description: `Element ${element.elementNumber} ("${element.elementText.substring(0, 80)}...") has ${element.strength} prosecution support. Investigate potential weaknesses in their evidence chain.`,
        priority: element.strength === 'strong' ? 'critical' : 'high',
        relatedElements: [element.elementNumber],
        category: 'investigation',
      });
    }
    if (element.refutingEvidence.length > 0) {
      taskCounter++;
      investigativeTasks.push({
        id: `${chargeId}-task-${taskCounter}`,
        title: `Develop Refuting Evidence for Element ${element.elementNumber}`,
        description: `Found ${element.refutingEvidence.length} piece(s) of refuting evidence. Strengthen this defense angle with additional investigation.`,
        priority: 'high',
        relatedElements: [element.elementNumber],
        category: 'investigation',
      });
    }
  }

  // Add standard investigative tasks
  taskCounter++;
  investigativeTasks.push({
    id: `${chargeId}-task-${taskCounter}`,
    title: 'Obtain Complete Body-Worn Camera Footage',
    description: 'Request all BWC footage from all officers involved, including footage before and after the incident. Check for gaps in recording.',
    priority: 'critical',
    relatedElements: instruction.elements.map((e) => e.number),
    category: 'records',
  });
  taskCounter++;
  investigativeTasks.push({
    id: `${chargeId}-task-${taskCounter}`,
    title: 'Interview Independent Witnesses',
    description: 'Identify and interview any independent witnesses not listed in police reports. Canvass the area for surveillance cameras.',
    priority: 'high',
    relatedElements: instruction.elements.map((e) => e.number),
    category: 'witness',
  });

  // Generate legal instruments from the instruction
  const legalInstruments: LegalInstrument[] = instruction.legalInstruments.map((li, idx) => {
    const isMotion = li.toLowerCase().includes('motion');
    const isDiscovery = li.toLowerCase().includes('discovery') || li.toLowerCase().includes('subpoena');
    const isBrady = li.toLowerCase().includes('brady');
    const isExpert = li.toLowerCase().includes('expert');

    return {
      id: `${chargeId}-legal-${idx + 1}`,
      title: li.split(' — ')[0] || li,
      description: li,
      type: isBrady ? 'brady_request' : isExpert ? 'expert' : isDiscovery ? 'discovery' : isMotion ? 'motion' : 'motion',
      priority: idx === 0 ? 'critical' : idx === 1 ? 'high' : 'medium',
      relatedElements: instruction.elements.map((e) => e.number),
      legalBasis: li,
    };
  });

  // Generate defense strategies from common defenses
  const defenseStrategies: DefenseStrategy[] = instruction.commonDefenses.map((defense, idx) => {
    const isConstitutional = defense.toLowerCase().includes('search') || defense.toLowerCase().includes('4th amendment') || defense.toLowerCase().includes('suppress');
    const isProcedural = defense.toLowerCase().includes('title 17') || defense.toLowerCase().includes('procedure') || defense.toLowerCase().includes('protocol');
    const isAffirmative = defense.toLowerCase().includes('self-defense') || defense.toLowerCase().includes('consent') || defense.toLowerCase().includes('claim of right');
    const isMitigation = defense.toLowerCase().includes('prop') || defense.toLowerCase().includes('diversion') || defense.toLowerCase().includes('reduce');

    // Calculate confidence based on how well evidence supports this defense
    const relevantRefuting = elements.reduce((sum, el) => sum + el.refutingEvidence.length, 0);
    const weakElements = elements.filter((el) => el.strength === 'weak' || el.strength === 'unsupported').length;
    const baseConfidence = 40 + (weakElements * 8) + (relevantRefuting * 5);

    return {
      id: `${chargeId}-strategy-${idx + 1}`,
      title: defense.split('—')[0]?.trim() || defense.split('(')[0]?.trim() || defense,
      description: defense,
      confidence: Math.min(95, Math.max(20, baseConfidence - idx * 3)),
      relatedElements: instruction.elements.map((e) => e.number),
      category: isConstitutional ? 'constitutional' : isProcedural ? 'procedural' : isAffirmative ? 'affirmative' : isMitigation ? 'mitigation' : 'factual',
    };
  });

  // Generate inconsistencies
  const inconsistencies = generateInconsistencies(documents, instruction, chargeId);

  // Calculate overall defense score
  const avgProsecutionScore = elements.length > 0
    ? elements.reduce((sum, el) => sum + el.prosecutionScore, 0) / elements.length
    : 50;
  const overallDefenseScore = Math.round(100 - avgProsecutionScore + (inconsistencies.length * 3));

  return {
    chargeId,
    calcrimNumber: instruction.calcrimNumber,
    chargeTitle: instruction.title,
    penalCode: instruction.penalCode,
    overallDefenseScore: Math.min(95, Math.max(5, overallDefenseScore)),
    elements,
    investigativeTasks,
    legalInstruments,
    defenseStrategies,
    inconsistencies: inconsistencies.sort((a, b) => b.score - a.score),
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Analyze the full case — all charges against all evidence.
 * Returns the complete analysis including cross-charge inconsistencies
 * and the top 5 highest-rated inconsistencies.
 */
export function analyzeFullCase(
  caseId: string,
  charges: Array<{ id: string; code: string; calcrimNumber?: string }>,
  documents: EvidenceDocument[]
): FullCaseAnalysis {
  const chargeResults: ChargeAnalysisResult[] = charges.map((charge) => {
    const lookup = charge.calcrimNumber || charge.code;
    return analyzeCharge(charge.id, lookup, documents);
  });

  // Collect all inconsistencies across charges
  const allInconsistencies: Inconsistency[] = [];
  for (const result of chargeResults) {
    allInconsistencies.push(...result.inconsistencies);
  }

  // Generate cross-charge inconsistencies
  const crossChargeInconsistencies: Inconsistency[] = [];

  // Check if same evidence is used to support contradictory elements across charges
  if (chargeResults.length >= 2) {
    for (let i = 0; i < chargeResults.length; i++) {
      for (let j = i + 1; j < chargeResults.length; j++) {
        const charge1 = chargeResults[i];
        const charge2 = chargeResults[j];

        // Find overlapping evidence
        const sources1 = new Set(charge1.inconsistencies.flatMap((inc) => inc.sources));
        const sources2 = new Set(charge2.inconsistencies.flatMap((inc) => inc.sources));
        const overlap = [...sources1].filter((s) => sources2.has(s));

        if (overlap.length > 0) {
          crossChargeInconsistencies.push({
            id: `cross-${charge1.chargeId}-${charge2.chargeId}`,
            description: `Cross-charge conflict: Evidence in ${overlap.join(', ')} contains inconsistencies relevant to both ${charge1.chargeTitle} and ${charge2.chargeTitle}. These compounding inconsistencies may strengthen defense across multiple charges.`,
            score: Math.min(95, 70 + overlap.length * 5),
            sources: overlap,
            relatedElements: [],
            category: 'documentary',
            recommendation: `Leverage this cross-charge inconsistency in plea negotiations or trial strategy. The same evidentiary weakness undermines multiple charges simultaneously.`,
          });
        }
      }
    }
  }

  allInconsistencies.push(...crossChargeInconsistencies);

  // Sort all inconsistencies by score descending
  allInconsistencies.sort((a, b) => b.score - a.score);

  // Deduplicate by description similarity
  const seen = new Set<string>();
  const deduped = allInconsistencies.filter((inc) => {
    const key = inc.description.substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    caseId,
    charges: chargeResults,
    crossChargeInconsistencies,
    topInconsistencies: deduped.slice(0, 5),
    allInconsistencies: deduped,
    totalInconsistencies: deduped.length,
    analyzedAt: new Date().toISOString(),
    status: 'complete',
    progress: 100,
  };
}

/**
 * Get all available CALCRIM instructions for reference.
 */
export function getAllCalcrimInstructions(): CalcrimInstruction[] {
  return CALCRIM_DATABASE;
}
