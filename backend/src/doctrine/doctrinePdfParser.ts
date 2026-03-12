// ============================================
// Court Access — POST Doctrine PDF Parser
// Structured segmentation of POST training
// manuals into doctrine rule objects.
// ============================================

import { createHash } from 'node:crypto';
import type { ParsedDoctrineChunk, DoctrineCategory } from './types.ts';

// ---------------------------------------------------------------------------
// Category Detection
// ---------------------------------------------------------------------------

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: DoctrineCategory }> = [
  { pattern: /fourth\s+amendment|search\s+and\s+seizure|unreasonable\s+search|warrant\s+requirement/i, category: 'search' },
  { pattern: /fifth\s+amendment|self[- ]incrimination|due\s+process/i, category: 'constitutional' },
  { pattern: /sixth\s+amendment|right\s+to\s+counsel/i, category: 'constitutional' },
  { pattern: /fourteenth\s+amendment|equal\s+protection/i, category: 'constitutional' },
  { pattern: /miranda|right\s+to\s+remain\s+silent|custodial\s+interrogation|miranda\s+warning/i, category: 'miranda' },
  { pattern: /interrogat|question|interview.*suspect|coerci/i, category: 'interrogation' },
  { pattern: /detention|detain|terry\s+stop|investigat.*stop|reasonable\s+suspicion/i, category: 'detention' },
  { pattern: /consensual\s+encounter|voluntary\s+contact|consent.*contact/i, category: 'encounter' },
  { pattern: /pat\s+search|frisk|plain\s+feel|search\s+incident|protective\s+search/i, category: 'search' },
  { pattern: /arrest|probable\s+cause|warrantless\s+arrest|custody|book/i, category: 'arrest' },
  { pattern: /force|use\s+of\s+force|deadly\s+force|reasonable\s+force|graham\s+v/i, category: 'use_of_force' },
  { pattern: /pursuit|chase|vehicle\s+pursuit/i, category: 'pursuit' },
  // LD-17: Presentation of Evidence
  { pattern: /chain\s+of\s+custody|evidence\s+custod|transfer\s+of\s+evidence/i, category: 'chain_of_custody' },
  { pattern: /courtroom\s+testimon|witness\s+stand|cross[- ]examin|direct\s+examin/i, category: 'testimony' },
  { pattern: /evidence\s+authenticat|foundation.*evidence|admissib/i, category: 'evidence_presentation' },
  // LD-18: Report Writing
  { pattern: /report\s+writ|officer\s+report|narrative|incident\s+report|supplement.*report/i, category: 'report_writing' },
  // LD-24: Handling Evidence
  { pattern: /evidence\s+(?:collect|packag|label|transport|stor|preserv|handl|log)/i, category: 'evidence_handling' },
  { pattern: /contaminat|cross[- ]contaminat|forensic\s+integrit/i, category: 'evidence_handling' },
  // LD-30: Crime Scene
  { pattern: /crime\s+scene|scene\s+secur|scene\s+preserv|scene\s+document|search\s+pattern/i, category: 'crime_scene' },
  // LD-21: Patrol
  { pattern: /patrol|field\s+(?:contact|interview)|surveillance|beat|officer\s+safet/i, category: 'patrol' },
  { pattern: /field\s+contact|consensual.*field|investigat.*contact/i, category: 'field_contact' },
];

function detectCategory(text: string): DoctrineCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return 'general';
}

// ---------------------------------------------------------------------------
// Keyword Extraction
// ---------------------------------------------------------------------------

const LEGAL_KEYWORDS = [
  'reasonable suspicion', 'probable cause', 'miranda', 'custodial',
  'detention', 'arrest', 'search', 'seizure', 'consent', 'encounter',
  'fourth amendment', 'fifth amendment', 'sixth amendment', 'fourteenth amendment',
  'warrant', 'warrantless', 'pat search', 'frisk', 'plain feel', 'plain view',
  'terry stop', 'exigent circumstances', 'hot pursuit', 'suppression',
  'exclusionary rule', 'fruit of the poisonous tree', 'interrogation',
  'self-incrimination', 'right to counsel', 'due process', 'equal protection',
  'use of force', 'deadly force', 'reasonable force', 'booking',
  'citation', 'release', 'bail', 'arraignment', 'prosecution',
  'evidence', 'testimony', 'witness', 'victim', 'suspect',
  'investigation', 'crime scene', 'report', 'documentation',
  // LD-17: Presentation of Evidence
  'chain of custody', 'authentication', 'foundation', 'admissibility',
  'courtroom testimony', 'cross-examination', 'direct examination',
  'expert testimony', 'witness credibility', 'hearsay',
  // LD-18: Report Writing
  'report writing', 'narrative', 'objective', 'subjective', 'chronological',
  'incident report', 'supplemental report', 'fact', 'conclusion', 'opinion',
  // LD-20: Use of Force
  'graham v connor', 'force escalation', 'de-escalation', 'reasonableness',
  'totality of circumstances', 'proportional force', 'lethal force',
  // LD-21: Patrol
  'patrol', 'field contact', 'field interview', 'surveillance',
  'officer safety', 'suspicious activity', 'beat', 'tactical',
  // LD-24: Handling Evidence
  'evidence collection', 'evidence packaging', 'evidence labeling',
  'evidence transport', 'evidence storage', 'contamination',
  'cross-contamination', 'forensic integrity', 'evidence log',
  // LD-30: Crime Scene Investigation
  'crime scene', 'scene security', 'scene preservation', 'evidence documentation',
  'search pattern', 'evidence logging', 'first responder', 'scene integrity',
];

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return LEGAL_KEYWORDS.filter((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Chapter Detection — identifies major sections in POST manuals
// ---------------------------------------------------------------------------

const CHAPTER_PATTERNS = [
  { pattern: /constitutional\s+(?:protection|right|law|basis)/i, chapter: 'Constitutional Protections' },
  { pattern: /consensual\s+encounter/i, chapter: 'Consensual Encounters' },
  { pattern: /detention/i, chapter: 'Detentions' },
  { pattern: /search(?:es)?\s+(?:during|incident|of)/i, chapter: 'Searches' },
  { pattern: /arrest/i, chapter: 'Arrests' },
  { pattern: /miranda/i, chapter: 'Miranda' },
  { pattern: /interrogation/i, chapter: 'Interrogations' },
  { pattern: /use\s+of\s+force/i, chapter: 'Use of Force' },
  { pattern: /chain\s+of\s+custody/i, chapter: 'Chain of Custody' },
  { pattern: /courtroom\s+testimon|witness/i, chapter: 'Courtroom Testimony' },
  { pattern: /evidence\s+authenticat|admissib/i, chapter: 'Evidence Authentication' },
  { pattern: /report\s+writ|narrative/i, chapter: 'Report Writing' },
  { pattern: /evidence\s+(?:collect|packag|handl)/i, chapter: 'Evidence Handling' },
  { pattern: /crime\s+scene/i, chapter: 'Crime Scene Investigation' },
  { pattern: /patrol|field\s+contact/i, chapter: 'Patrol Operations' },
  { pattern: /force\s+escalat|de-escalat/i, chapter: 'Force Escalation' },
];

function detectChapter(text: string): string {
  for (const { pattern, chapter } of CHAPTER_PATTERNS) {
    if (pattern.test(text)) return chapter;
  }
  return 'General';
}

// ---------------------------------------------------------------------------
// Topic Detection
// ---------------------------------------------------------------------------

const TOPIC_PATTERNS = [
  { pattern: /reasonable\s+suspicion/i, topic: 'Reasonable Suspicion' },
  { pattern: /probable\s+cause/i, topic: 'Probable Cause' },
  { pattern: /miranda\s+warning/i, topic: 'Miranda Warnings' },
  { pattern: /miranda\s+waiver/i, topic: 'Miranda Waiver' },
  { pattern: /custodial\s+interrogation/i, topic: 'Custodial Interrogation' },
  { pattern: /consent\s+search/i, topic: 'Consent Searches' },
  { pattern: /pat\s+search|protective\s+search/i, topic: 'Pat Searches' },
  { pattern: /plain\s+feel/i, topic: 'Plain Feel Doctrine' },
  { pattern: /plain\s+view/i, topic: 'Plain View Doctrine' },
  { pattern: /warrantless\s+arrest/i, topic: 'Warrantless Arrests' },
  { pattern: /warrant\s+requirement/i, topic: 'Warrant Requirements' },
  { pattern: /exigent\s+circumstances/i, topic: 'Exigent Circumstances' },
  { pattern: /terry\s+stop/i, topic: 'Terry Stops' },
  { pattern: /exclusionary\s+rule/i, topic: 'Exclusionary Rule' },
  { pattern: /fruit\s+of\s+the\s+poisonous\s+tree/i, topic: 'Fruit of the Poisonous Tree' },
  { pattern: /search\s+incident\s+to\s+arrest/i, topic: 'Search Incident to Arrest' },
  { pattern: /vehicle\s+search/i, topic: 'Vehicle Searches' },
  { pattern: /hot\s+pursuit/i, topic: 'Hot Pursuit' },
  { pattern: /self[- ]incrimination/i, topic: 'Self-Incrimination' },
  { pattern: /right\s+to\s+counsel/i, topic: 'Right to Counsel' },
  { pattern: /due\s+process/i, topic: 'Due Process' },
  { pattern: /equal\s+protection/i, topic: 'Equal Protection' },
  { pattern: /consensual\s+encounter/i, topic: 'Consensual Encounters' },
  { pattern: /investigat.*\s+detention/i, topic: 'Investigative Detention' },
  { pattern: /duration.*\s+detention|length.*\s+detention/i, topic: 'Detention Duration' },
  { pattern: /booking/i, topic: 'Booking Procedures' },
  { pattern: /use\s+of\s+force/i, topic: 'Use of Force' },
  { pattern: /deadly\s+force/i, topic: 'Deadly Force' },
  { pattern: /fourth\s+amendment/i, topic: 'Fourth Amendment' },
  { pattern: /fifth\s+amendment/i, topic: 'Fifth Amendment' },
  { pattern: /sixth\s+amendment/i, topic: 'Sixth Amendment' },
  { pattern: /fourteenth\s+amendment/i, topic: 'Fourteenth Amendment' },
];

function detectTopic(text: string): string {
  for (const { pattern, topic } of TOPIC_PATTERNS) {
    if (pattern.test(text)) return topic;
  }
  return 'General';
}

// ---------------------------------------------------------------------------
// Legal Implication Inference
// ---------------------------------------------------------------------------

function inferLegalImplication(_rule: string, category: DoctrineCategory): string {
  const implications: Record<DoctrineCategory, string> = {
    constitutional: 'Constitutional violation may result in civil rights claims and evidence suppression.',
    encounter: 'If encounter is determined non-consensual, it becomes a detention requiring reasonable suspicion.',
    detention: 'If reasonable suspicion cannot be articulated, evidence obtained during the detention may be suppressed.',
    search: 'Evidence obtained through an unlawful search is subject to the exclusionary rule and may be suppressed.',
    arrest: 'An arrest without probable cause is unlawful; all evidence obtained as a result may be suppressed.',
    miranda: 'Failure to administer Miranda warnings before custodial interrogation renders statements inadmissible.',
    interrogation: 'Statements obtained through coercive interrogation techniques are inadmissible.',
    use_of_force: 'Excessive force may result in civil liability, criminal prosecution, and disciplinary action.',
    pursuit: 'Improper pursuit may result in liability for injuries and violation of department policy.',
    evidence_presentation: 'Failure to properly present evidence may result in exclusion at trial or case dismissal.',
    chain_of_custody: 'A break in chain of custody may result in evidence being excluded or its weight diminished at trial.',
    testimony: 'Improper testimony preparation or conduct may result in credibility challenges or sanctions.',
    report_writing: 'Incomplete or inaccurate reports may undermine prosecution, enable impeachment, or create liability.',
    evidence_handling: 'Improper evidence handling may result in contamination, exclusion, or forensic integrity challenges.',
    evidence_collection: 'Improper evidence collection may result in loss of probative value or exclusion at trial.',
    crime_scene: 'Compromised crime scene integrity may result in lost evidence and investigation failure.',
    patrol: 'Non-compliant patrol techniques may result in procedural challenges or officer safety risks.',
    field_contact: 'Improper field contacts may escalate to unlawful detentions or Fourth Amendment violations.',
    general: 'Non-compliance may result in procedural challenges to the case.',
  };
  return implications[category];
}

// ---------------------------------------------------------------------------
// Content Hash
// ---------------------------------------------------------------------------

function contentHash(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

// ---------------------------------------------------------------------------
// Parse raw text into structured doctrine chunks
// ---------------------------------------------------------------------------

/**
 * Parses raw text extracted from a POST training manual PDF
 * into structured doctrine chunks using pattern matching.
 *
 * Strategy:
 * 1. Split text into sentences/paragraphs
 * 2. Identify doctrine rules (statements of requirement or prohibition)
 * 3. Group related sentences into rule + explanation
 * 4. Classify by chapter/topic/category
 */
export function parseDoctrineText(
  rawText: string,
  sourceName: string,
): ParsedDoctrineChunk[] {
  const chunks: ParsedDoctrineChunk[] = [];
  const seen = new Set<string>();

  // Split into paragraphs
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 30); // Skip very short fragments

  // Rule indicator patterns — sentences that express doctrine rules
  const rulePatterns = [
    /(?:an?\s+)?officer\s+(?:must|shall|should|may\s+not|cannot|is\s+required|is\s+prohibited)/i,
    /(?:is|are)\s+required\s+(?:to|before|when)/i,
    /(?:is|are)\s+prohibited\s+from/i,
    /(?:must|shall)\s+(?:be|have|obtain|provide|inform|advise|document)/i,
    /reasonable\s+suspicion\s+(?:is|exists|requires|must|cannot)/i,
    /probable\s+cause\s+(?:is|exists|requires|must|means)/i,
    /miranda\s+(?:warnings?|rights?)\s+(?:must|shall|are\s+required)/i,
    /(?:the\s+)?fourth\s+amendment\s+(?:protects|requires|prohibits|limits|guarantees)/i,
    /(?:the\s+)?fifth\s+amendment\s+(?:protects|requires|prohibits|guarantees)/i,
    /(?:the\s+)?sixth\s+amendment\s+(?:protects|requires|prohibits|guarantees)/i,
    /evidence\s+(?:obtained|seized|discovered)\s+(?:in\s+violation|without|illegally)/i,
    /(?:a|the)\s+(?:detention|arrest|search|seizure)\s+(?:requires|must|is\s+lawful|is\s+unlawful)/i,
    /consent\s+(?:must\s+be|is|can\s+be)\s+(?:voluntary|freely|revoked|withdrawn)/i,
    /(?:a\s+)?(?:pat|protective)\s+search\s+(?:is|may|must|cannot)/i,
    /exclusionary\s+rule\s+(?:requires|states|provides|means)/i,
    /fruit\s+of\s+the\s+poisonous\s+tree/i,
    /(?:an?\s+)?(?:lawful|unlawful)\s+(?:detention|arrest|search|seizure)/i,
    /(?:the\s+)?right\s+to\s+(?:remain\s+silent|counsel|attorney)/i,
    /(?:a\s+)?person\s+(?:has\s+the\s+right|is\s+entitled|may\s+not\s+be)/i,
    /(?:no|cannot|shall\s+not)\s+(?:person|officer|individual)\s+(?:shall|may|can)/i,
  ];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Check if paragraph contains a doctrine rule
    const isRule = rulePatterns.some((pattern) => pattern.test(para));
    if (!isRule) continue;

    // Extract the rule sentence(s)
    const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
    const ruleSentences: string[] = [];
    const explanationSentences: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (rulePatterns.some((p) => p.test(trimmed))) {
        ruleSentences.push(trimmed);
      } else if (trimmed.length > 20) {
        explanationSentences.push(trimmed);
      }
    }

    if (ruleSentences.length === 0) continue;

    const ruleText = ruleSentences.join(' ');
    const hash = contentHash(ruleText);

    // Skip duplicates
    if (seen.has(hash)) continue;
    seen.add(hash);

    const combinedText = `${ruleText} ${explanationSentences.join(' ')}`;
    const chapter = detectChapter(combinedText);
    const topic = detectTopic(combinedText);
    const category = detectCategory(combinedText);
    const keywords = extractKeywords(combinedText);

    // Use next paragraph as additional explanation if short
    let explanation = explanationSentences.join(' ');
    if (explanation.length < 30 && i + 1 < paragraphs.length) {
      const nextPara = paragraphs[i + 1];
      if (!rulePatterns.some((p) => p.test(nextPara)) && nextPara.length < 500) {
        explanation = nextPara;
      }
    }

    const legalImplication = inferLegalImplication(ruleText, category);

    chunks.push({
      source: sourceName,
      chapter,
      topic,
      rule: ruleText,
      explanation: explanation || `Derived from ${sourceName}, ${chapter} chapter.`,
      legalImplication,
      category,
      keywords,
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Generate doctrine ID from source and content
// ---------------------------------------------------------------------------

export function generateDoctrineId(
  sourceName: string,
  category: DoctrineCategory,
  index: number,
): string {
  const sourceCode = sourceName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10);
  const catCode = category.toUpperCase().slice(0, 4);
  const num = String(index).padStart(3, '0');
  return `${sourceCode}_${catCode}_${num}`;
}
