// ============================================
// POST LD-17: Presentation of Evidence — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD17_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Chain of Custody
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Chain of Custody',
    topic: 'Chain of Custody Requirements',
    rule: 'A proper chain of custody must be maintained for all physical evidence from the time of collection through presentation in court.',
    explanation: 'The chain of custody documents every person who handled the evidence, the dates and times of transfers, and the condition of the evidence at each transfer point.',
    legalImplication: 'A break in the chain of custody may result in the evidence being excluded or its weight diminished at trial.',
    category: 'chain_of_custody',
    keywords: ['chain of custody', 'evidence', 'collection', 'transfer', 'documentation'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Chain of Custody',
    topic: 'Evidence Tracking',
    rule: 'Every transfer of evidence must be documented with the name of the person transferring, the name of the person receiving, the date, time, and reason for the transfer.',
    explanation: 'Evidence tracking logs ensure accountability and prevent tampering. Any gap in documentation creates a vulnerability to defense challenges.',
    legalImplication: 'Undocumented transfers weaken the integrity of evidence and may lead to exclusion.',
    category: 'chain_of_custody',
    keywords: ['chain of custody', 'evidence transfer', 'documentation', 'tracking', 'accountability'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Chain of Custody',
    topic: 'Evidence Storage',
    rule: 'Evidence must be stored in a secure, controlled environment with restricted access to maintain its integrity.',
    explanation: 'Evidence rooms must have access logs, security measures, and environmental controls appropriate to the type of evidence stored.',
    legalImplication: 'Evidence stored in unsecured conditions may be challenged as potentially contaminated or tampered with.',
    category: 'chain_of_custody',
    keywords: ['evidence storage', 'security', 'controlled environment', 'integrity', 'access log'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Chain of Custody',
    topic: 'Biological Evidence Preservation',
    rule: 'Biological evidence must be preserved under conditions that prevent degradation, including appropriate temperature control and packaging.',
    explanation: 'DNA evidence, blood samples, and other biological materials degrade if not properly stored. Improper preservation can render forensic analysis unreliable.',
    legalImplication: 'Improperly preserved biological evidence may be excluded or its forensic analysis challenged.',
    category: 'chain_of_custody',
    keywords: ['biological evidence', 'preservation', 'DNA', 'degradation', 'temperature control'],
  },

  // =========================================================================
  // Courtroom Testimony Standards
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Officer Testimony Standards',
    rule: 'An officer testifying in court must present factual, objective testimony based on personal observations and knowledge.',
    explanation: 'Officers should testify to what they observed, heard, and did. Speculation, personal opinions, and conclusions should be avoided unless qualified as an expert.',
    legalImplication: 'Testimony containing improper opinions or speculation may be stricken or result in credibility challenges.',
    category: 'testimony',
    keywords: ['testimony', 'courtroom', 'objective', 'personal observation', 'factual'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Testimony Preparation',
    rule: 'Officers must review their reports and notes before testifying to ensure accuracy and consistency in their testimony.',
    explanation: 'Inconsistencies between an officer\'s report and testimony can be exploited on cross-examination to undermine credibility.',
    legalImplication: 'Inconsistent testimony may result in jury distrust and weakened prosecution.',
    category: 'testimony',
    keywords: ['testimony', 'preparation', 'report review', 'accuracy', 'consistency'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Cross-Examination',
    rule: 'Officers must answer cross-examination questions directly, honestly, and without evasion, even when the questions are challenging or hostile.',
    explanation: 'Evasive or combative responses during cross-examination damage officer credibility. Officers should listen carefully, answer only what is asked, and maintain composure.',
    legalImplication: 'Evasive testimony may lead to adverse credibility findings and weakened prosecution.',
    category: 'testimony',
    keywords: ['cross-examination', 'testimony', 'honest', 'direct', 'credibility'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Testimony Scope',
    rule: 'Officers must not testify beyond the scope of their personal knowledge or training unless qualified as an expert witness.',
    explanation: 'Lay witnesses may testify only to facts within their personal knowledge. Expert testimony requires the court to qualify the witness as an expert.',
    legalImplication: 'Testimony beyond the witness\'s competence may be stricken and the witness\'s credibility damaged.',
    category: 'testimony',
    keywords: ['testimony', 'personal knowledge', 'expert witness', 'scope', 'competence'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Prior Inconsistent Statements',
    rule: 'Officers must acknowledge prior statements that are inconsistent with their testimony when confronted on cross-examination.',
    explanation: 'Denying or minimizing prior inconsistent statements when confronted with documented evidence severely damages credibility.',
    legalImplication: 'Prior inconsistent statements may be used to impeach the officer and weaken the prosecution\'s case.',
    category: 'testimony',
    keywords: ['prior inconsistent statements', 'impeachment', 'cross-examination', 'credibility'],
  },

  // =========================================================================
  // Evidence Authentication
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Evidence Authentication',
    topic: 'Authentication Requirement',
    rule: 'Evidence must be authenticated through testimony or other proof showing that the item is what it purports to be before it can be admitted.',
    explanation: 'Authentication is a condition precedent to admissibility. The proponent of the evidence must produce evidence sufficient to support a finding that the item is genuine.',
    legalImplication: 'Evidence that is not properly authenticated is inadmissible.',
    category: 'evidence_presentation',
    keywords: ['authentication', 'admissibility', 'evidence', 'foundation', 'genuine'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Authentication',
    topic: 'Photographic Evidence',
    rule: 'Photographs must be authenticated by testimony that they are a fair and accurate representation of the scene or object depicted.',
    explanation: 'The authenticating witness need not be the photographer; any person who can testify that the photograph accurately depicts the scene may authenticate it.',
    legalImplication: 'Photographs without proper authentication may be excluded from evidence.',
    category: 'evidence_presentation',
    keywords: ['photograph', 'authentication', 'fair and accurate', 'depiction'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Authentication',
    topic: 'Digital Evidence Authentication',
    rule: 'Digital evidence must be authenticated by demonstrating that it has not been altered and is a true and accurate copy of the original.',
    explanation: 'Hash values, metadata analysis, and testimony about handling procedures can establish the integrity of digital evidence.',
    legalImplication: 'Digital evidence that cannot be shown to be unaltered may be excluded or given diminished weight.',
    category: 'evidence_presentation',
    keywords: ['digital evidence', 'authentication', 'hash value', 'integrity', 'unaltered'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Authentication',
    topic: 'Body Camera Evidence',
    rule: 'Body camera footage must be authenticated by establishing the identity of the recording officer, the date and time of recording, and that the footage has not been altered.',
    explanation: 'Body camera evidence is increasingly important in criminal cases. Proper metadata and chain of custody for digital files are essential.',
    legalImplication: 'Body camera footage without proper authentication may be challenged or excluded.',
    category: 'evidence_presentation',
    keywords: ['body camera', 'authentication', 'footage', 'metadata', 'recording'],
  },

  // =========================================================================
  // Witness Credibility
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Witness Credibility',
    topic: 'Officer Credibility',
    rule: 'An officer\'s credibility as a witness is determined by their demeanor, consistency, accuracy of recall, and adherence to factual testimony.',
    explanation: 'Jurors assess credibility based on how the officer presents themselves, whether their testimony is internally consistent, and whether it aligns with other evidence.',
    legalImplication: 'Damaged officer credibility may undermine the entire prosecution case.',
    category: 'testimony',
    keywords: ['credibility', 'demeanor', 'consistency', 'accuracy', 'officer testimony'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Witness Credibility',
    topic: 'Bias and Prejudice',
    rule: 'Officers must not exhibit bias, prejudice, or advocacy when testifying. Testimony must be neutral and objective.',
    explanation: 'An officer who appears to be an advocate rather than a neutral witness loses credibility. Officers should present facts and let the evidence speak.',
    legalImplication: 'Testimony perceived as biased may be given less weight or discredited entirely.',
    category: 'testimony',
    keywords: ['bias', 'prejudice', 'neutral', 'objective', 'advocacy'],
  },

  // =========================================================================
  // Expert Testimony
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Expert Testimony',
    topic: 'Expert Qualification',
    rule: 'An officer testifying as an expert must be qualified by the court based on their knowledge, skill, experience, training, or education.',
    explanation: 'Expert witnesses may offer opinions beyond what lay witnesses can provide. The court must determine the witness has sufficient expertise in the relevant field.',
    legalImplication: 'Testimony offered as expert opinion without proper qualification may be excluded.',
    category: 'testimony',
    keywords: ['expert witness', 'qualification', 'knowledge', 'experience', 'training'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Expert Testimony',
    topic: 'Expert Opinion Basis',
    rule: 'Expert opinions must be based on sufficient facts or data and be the product of reliable principles and methods applied reliably to the facts of the case.',
    explanation: 'Under Daubert and its California equivalents, expert testimony must meet standards of reliability and relevance. Speculative or unsupported opinions are inadmissible.',
    legalImplication: 'Expert testimony not based on reliable methods may be excluded under Evidence Code section 801.',
    category: 'testimony',
    keywords: ['expert opinion', 'Daubert', 'reliable methods', 'sufficient facts', 'evidence code'],
  },

  // =========================================================================
  // Evidence Admissibility
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Evidence Admissibility',
    topic: 'Relevance',
    rule: 'Evidence must be relevant to the issues in the case to be admissible. Relevant evidence has any tendency to make a fact of consequence more or less probable.',
    explanation: 'The relevance threshold is low, but even relevant evidence may be excluded if its probative value is substantially outweighed by prejudicial effect.',
    legalImplication: 'Irrelevant evidence is inadmissible. Marginally relevant evidence may be excluded under Evidence Code section 352.',
    category: 'evidence_presentation',
    keywords: ['relevance', 'admissibility', 'probative value', 'prejudicial effect', 'evidence code'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Admissibility',
    topic: 'Hearsay Rule',
    rule: 'Hearsay is an out-of-court statement offered to prove the truth of the matter asserted and is generally inadmissible unless an exception applies.',
    explanation: 'Officers must understand that quoting statements made by witnesses or suspects outside of court is hearsay. Numerous exceptions exist, including excited utterances, dying declarations, and business records.',
    legalImplication: 'Inadmissible hearsay testimony may be stricken and the jury instructed to disregard it.',
    category: 'evidence_presentation',
    keywords: ['hearsay', 'out-of-court statement', 'truth of the matter', 'exception', 'admissibility'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Admissibility',
    topic: 'Best Evidence Rule',
    rule: 'The original of a writing, recording, or photograph is required to prove its content, unless an exception applies.',
    explanation: 'The best evidence rule ensures the most reliable evidence is presented. Copies may be admitted if the original is unavailable and the absence is adequately explained.',
    legalImplication: 'Secondary evidence of a writing may be excluded if the original is available and not produced.',
    category: 'evidence_presentation',
    keywords: ['best evidence', 'original', 'writing', 'recording', 'photograph'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Evidence Admissibility',
    topic: 'Foundation Requirements',
    rule: 'Before physical evidence can be admitted, the offering party must lay a proper foundation establishing the evidence\'s relevance, authenticity, and chain of custody.',
    explanation: 'Foundation testimony typically includes identification of the item, description of how and where it was found, and documentation of its custody from collection to court.',
    legalImplication: 'Evidence offered without adequate foundation will be excluded.',
    category: 'evidence_presentation',
    keywords: ['foundation', 'physical evidence', 'admissibility', 'relevance', 'chain of custody'],
  },
];

export const LD17_RULE_COUNT = LD17_DOCTRINE_RULES.length;
