// ============================================
// POST LD-17: Presentation of Evidence — Expansion
// Additional doctrine rules to reach ~40 total
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD17_EXPANSION_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // CHAPTER: Rules of Evidence
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Rules of Evidence',
    topic: 'Relevance',
    rule: 'Evidence must be relevant to be admissible. Relevant evidence has a tendency to prove or disprove a fact of consequence to the case.',
    explanation: 'California Evidence Code Section 210 defines relevant evidence. Even relevant evidence may be excluded if its probative value is substantially outweighed by prejudice.',
    legalImplication: 'Irrelevant evidence is inadmissible and may result in a mistrial if improperly admitted.',
    category: 'evidence_presentation',
    keywords: ['relevance', 'admissible', 'probative value', 'evidence code 210'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Rules of Evidence',
    topic: 'Hearsay Rule',
    rule: 'Hearsay — an out-of-court statement offered to prove the truth of the matter asserted — is generally inadmissible unless an exception applies.',
    explanation: 'California Evidence Code Section 1200 defines hearsay. Numerous exceptions exist, including excited utterances, dying declarations, business records, and prior inconsistent statements.',
    legalImplication: 'Reliance on hearsay without a valid exception may result in exclusion of critical evidence.',
    category: 'evidence_presentation',
    keywords: ['hearsay', 'out-of-court statement', 'truth of matter', 'exceptions', 'evidence code 1200'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Rules of Evidence',
    topic: 'Authentication',
    rule: 'Physical and documentary evidence must be authenticated before it can be admitted, meaning the proponent must show the item is what it purports to be.',
    explanation: 'Authentication can be established through testimony of a witness with knowledge, chain of custody, or distinctive characteristics. Evidence Code Section 1401.',
    legalImplication: 'Evidence that cannot be properly authenticated is inadmissible.',
    category: 'evidence_presentation',
    keywords: ['authentication', 'chain of custody', 'witness knowledge', 'evidence code 1401'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Rules of Evidence',
    topic: 'Best Evidence Rule',
    rule: 'The original writing, recording, or photograph is required to prove the content of that writing, recording, or photograph, unless the original is unavailable through no fault of the proponent.',
    explanation: 'The best evidence rule (Evidence Code Section 1500) ensures the most reliable version of documentary evidence is presented. Copies are admissible under certain conditions.',
    legalImplication: 'Secondary evidence may be excluded if the original is available and the proponent fails to produce it.',
    category: 'evidence_presentation',
    keywords: ['best evidence rule', 'original', 'writing', 'evidence code 1500', 'secondary evidence'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Rules of Evidence',
    topic: 'Character Evidence',
    rule: 'Evidence of a person\'s character or character trait is generally inadmissible to prove conduct on a specific occasion, with exceptions for the defendant\'s character in criminal cases.',
    explanation: 'Evidence Code Section 1101 prohibits character evidence to show propensity. However, it may be admissible to show motive, opportunity, intent, preparation, plan, knowledge, or identity.',
    legalImplication: 'Improperly admitted character evidence may constitute reversible error.',
    category: 'evidence_presentation',
    keywords: ['character evidence', 'propensity', 'evidence code 1101', 'motive', 'intent'],
  },

  // =========================================================================
  // CHAPTER: Courtroom Testimony
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Officer Testimony Standards',
    rule: 'Officers testifying in court must present truthful, accurate testimony based on personal knowledge and documented observations. Testimony must be consistent with written reports.',
    explanation: 'Officer credibility is essential to the prosecution\'s case. Inconsistencies between testimony and reports will be exploited by defense counsel.',
    legalImplication: 'False testimony by an officer constitutes perjury and may result in criminal prosecution and case dismissal.',
    category: 'testimony',
    keywords: ['officer testimony', 'truthful', 'personal knowledge', 'credibility', 'perjury'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Expert Testimony',
    rule: 'Expert witnesses may testify on matters requiring specialized knowledge if the expert\'s qualifications, methodology, and conclusions meet the Kelly-Frye or Daubert standards for reliability.',
    explanation: 'California uses the Kelly-Frye test for new scientific techniques, requiring general acceptance in the relevant scientific community.',
    legalImplication: 'Expert testimony based on unreliable methodology may be excluded under Evidence Code Section 801.',
    category: 'testimony',
    keywords: ['expert testimony', 'Kelly-Frye', 'Daubert', 'specialized knowledge', 'reliability'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Cross-Examination Preparation',
    rule: 'Officers should prepare for cross-examination by reviewing their reports, understanding the legal issues in the case, and anticipating defense strategies.',
    explanation: 'Cross-examination is designed to test the witness\'s credibility and the reliability of their testimony. Preparation helps officers maintain composure and accuracy.',
    legalImplication: 'An officer who is unprepared for cross-examination may provide inconsistent or inaccurate testimony that damages the case.',
    category: 'testimony',
    keywords: ['cross-examination', 'preparation', 'credibility', 'defense strategies'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Courtroom Testimony',
    topic: 'Refreshing Recollection',
    rule: 'An officer may use their report to refresh their recollection while testifying, but must testify from memory after reviewing the document.',
    explanation: 'Evidence Code Section 771 allows a witness to refresh recollection with any writing. The opposing party may inspect the document and cross-examine on it.',
    legalImplication: 'The defense is entitled to see any document used to refresh recollection.',
    category: 'testimony',
    keywords: ['refresh recollection', 'report review', 'evidence code 771', 'testimony'],
  },

  // =========================================================================
  // CHAPTER: Physical Evidence Presentation
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Physical Evidence',
    topic: 'Foundation for Physical Evidence',
    rule: 'Before physical evidence can be admitted, the proponent must lay a proper foundation by establishing the item\'s relevance, authentication, and chain of custody.',
    explanation: 'Foundation testimony typically comes from the officer who collected the evidence, establishing how, when, and where it was found and how it has been preserved.',
    legalImplication: 'Physical evidence admitted without proper foundation may be challenged and excluded on appeal.',
    category: 'evidence_presentation',
    keywords: ['foundation', 'physical evidence', 'authentication', 'chain of custody', 'relevance'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Physical Evidence',
    topic: 'Demonstrative Evidence',
    rule: 'Demonstrative evidence such as diagrams, models, and reconstructions must accurately represent the facts of the case and not be misleading or prejudicial.',
    explanation: 'Demonstrative evidence helps the jury understand complex facts. It must be a fair and accurate representation of the actual conditions.',
    legalImplication: 'Misleading demonstrative evidence may be excluded and may constitute grounds for mistrial.',
    category: 'evidence_presentation',
    keywords: ['demonstrative evidence', 'diagrams', 'models', 'reconstruction', 'accuracy'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Physical Evidence',
    topic: 'Photographic Evidence',
    rule: 'Photographs offered as evidence must be authenticated by a witness who can testify that the photograph accurately depicts the scene or object as it appeared at the relevant time.',
    explanation: 'The authenticating witness need not be the photographer. Any person with knowledge can verify that the photo accurately represents what it purports to show.',
    legalImplication: 'Photographs that have been altered or do not accurately depict the scene may be excluded.',
    category: 'evidence_presentation',
    keywords: ['photographic evidence', 'authentication', 'accurate depiction', 'witness'],
  },

  // =========================================================================
  // CHAPTER: Digital Evidence Presentation
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Digital Evidence',
    topic: 'Digital Evidence Authentication',
    rule: 'Digital evidence must be authenticated by showing it has not been altered since collection, typically through hash value verification and testimony from the forensic examiner.',
    explanation: 'Hash values (MD5, SHA-256) create a digital fingerprint that proves the evidence has not been modified. The forensic examiner testifies to the analysis process.',
    legalImplication: 'Digital evidence without proper authentication may be excluded as unreliable.',
    category: 'evidence_presentation',
    keywords: ['digital evidence', 'authentication', 'hash value', 'forensic examiner'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Digital Evidence',
    topic: 'Body Camera Footage Presentation',
    rule: 'Body-worn camera footage presented as evidence must be authenticated by the recording officer, with testimony about when the camera was activated and any limitations of the recording.',
    explanation: 'BWC footage provides an objective record of encounters but may not capture the full context. Officers should explain what the camera could and could not see.',
    legalImplication: 'BWC footage that contradicts officer testimony may severely damage credibility.',
    category: 'evidence_presentation',
    keywords: ['body camera', 'BWC', 'footage', 'authentication', 'recording officer'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Digital Evidence',
    topic: 'Social Media Evidence',
    rule: 'Social media posts offered as evidence must be authenticated by showing they were actually created by the purported author, not merely that the account bears their name.',
    explanation: 'Social media accounts can be hacked, spoofed, or created by impostors. Authentication requires additional evidence linking the post to the specific individual.',
    legalImplication: 'Social media evidence attributed to the wrong person may be excluded and may mislead the jury.',
    category: 'evidence_presentation',
    keywords: ['social media', 'authentication', 'authorship', 'digital evidence'],
  },

  // =========================================================================
  // CHAPTER: Privilege and Exclusion
  // =========================================================================
  {
    source: 'POST LD-17',
    chapter: 'Privilege',
    topic: 'Attorney-Client Privilege',
    rule: 'Communications between a defendant and their attorney are privileged and may not be intercepted, recorded, or used as evidence by law enforcement.',
    explanation: 'The attorney-client privilege is fundamental to the right to counsel. Officers must take affirmative steps to avoid overhearing privileged communications.',
    legalImplication: 'Violation of attorney-client privilege may result in suppression of evidence and sanctions.',
    category: 'evidence_presentation',
    keywords: ['attorney-client privilege', 'confidential', 'right to counsel', 'suppression'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Privilege',
    topic: 'Spousal Privilege',
    rule: 'A married person may not be compelled to testify against their spouse in a criminal proceeding, and confidential marital communications are privileged.',
    explanation: 'California recognizes both the spousal testimony privilege and the marital communications privilege. These privileges belong to different parties.',
    legalImplication: 'Compelling spousal testimony in violation of the privilege may result in reversible error.',
    category: 'evidence_presentation',
    keywords: ['spousal privilege', 'marital communications', 'compelled testimony'],
  },
  {
    source: 'POST LD-17',
    chapter: 'Privilege',
    topic: 'Physician-Patient Privilege',
    rule: 'Medical records and communications between a patient and physician are privileged and generally require a court order or patient consent to be disclosed.',
    explanation: 'HIPAA and California law protect medical information. Officers seeking medical records must use proper legal process.',
    legalImplication: 'Medical records obtained without proper authorization may be excluded and may expose the agency to liability.',
    category: 'evidence_presentation',
    keywords: ['physician-patient', 'medical records', 'HIPAA', 'privilege', 'court order'],
  },
];
