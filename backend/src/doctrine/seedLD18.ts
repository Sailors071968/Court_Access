// ============================================
// POST LD-18: Investigative Report Writing — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD18_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Officer Narrative Standards
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Standards',
    topic: 'Objective Reporting',
    rule: 'Reports must contain objective facts rather than conclusions or opinions. Officers must document what they observed, not what they believed or assumed.',
    explanation: 'Objective reporting means describing actions, behaviors, and conditions without interpretation. Words like "suspicious," "nervous," or "acting guilty" are subjective conclusions.',
    legalImplication: 'Reports containing subjective conclusions may be used to impeach the officer and undermine the prosecution.',
    category: 'report_writing',
    keywords: ['report writing', 'objective', 'facts', 'conclusions', 'opinions', 'impeachment'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Standards',
    topic: 'Factual Accuracy',
    rule: 'All information in a police report must be accurate, truthful, and verifiable. Officers must not include false, misleading, or unverified information.',
    explanation: 'Inaccurate reports can lead to wrongful arrests, failed prosecutions, and civil liability. Every factual assertion should be based on direct observation or reliable information.',
    legalImplication: 'False statements in reports may constitute misconduct, grounds for Brady disclosure, and evidence suppression.',
    category: 'report_writing',
    keywords: ['accuracy', 'truthful', 'verifiable', 'false statement', 'Brady', 'report'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Standards',
    topic: 'Complete Documentation',
    rule: 'Reports must document all relevant facts, including facts that may be favorable to the defendant or unfavorable to the prosecution.',
    explanation: 'Under Brady v. Maryland, the prosecution has an obligation to disclose exculpatory evidence. Officers who omit favorable facts from reports may cause Brady violations.',
    legalImplication: 'Omitting exculpatory information may result in Brady violations, case dismissal, and civil liability.',
    category: 'report_writing',
    keywords: ['complete documentation', 'Brady', 'exculpatory', 'relevant facts', 'disclosure'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Standards',
    topic: 'Chronological Order',
    rule: 'Reports should present events in chronological order to provide a clear, logical narrative of what occurred.',
    explanation: 'Chronological presentation helps the reader understand the sequence of events and the basis for officer actions at each point in time.',
    legalImplication: 'Disorganized reports may create confusion and undermine the prosecution\'s timeline.',
    category: 'report_writing',
    keywords: ['chronological', 'narrative', 'sequence', 'timeline', 'report writing'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Standards',
    topic: 'Specificity',
    rule: 'Reports must include specific details such as exact times, locations, descriptions, and direct quotes rather than vague or general statements.',
    explanation: 'Specific details strengthen the report and the officer\'s credibility. Vague language like "a short time later" or "in the area" can be exploited on cross-examination.',
    legalImplication: 'Vague reports may be insufficient to establish probable cause or reasonable suspicion.',
    category: 'report_writing',
    keywords: ['specificity', 'details', 'exact times', 'locations', 'descriptions', 'quotes'],
  },

  // =========================================================================
  // Objective vs Subjective Statements
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Objective vs Subjective',
    topic: 'Observable Behavior',
    rule: 'Officers must describe observable behavior rather than characterizing a person\'s mental state, intent, or emotions.',
    explanation: 'Instead of writing "the suspect was nervous," the officer should write "the suspect\'s hands were trembling, and he avoided eye contact." Observable facts are objective; characterizations are subjective.',
    legalImplication: 'Subjective characterizations can be challenged on cross-examination and may not support legal conclusions.',
    category: 'report_writing',
    keywords: ['observable behavior', 'objective', 'subjective', 'mental state', 'characterization'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Objective vs Subjective',
    topic: 'Articulable Facts',
    rule: 'When documenting reasonable suspicion or probable cause, officers must articulate specific, objective facts that support the legal standard.',
    explanation: 'Reports must contain the factual basis for officer actions, not just conclusions. "I had reasonable suspicion" is a conclusion; the report must explain why.',
    legalImplication: 'Failure to articulate specific facts may result in suppression of evidence and unlawful detention findings.',
    category: 'report_writing',
    keywords: ['articulable facts', 'reasonable suspicion', 'probable cause', 'specific facts', 'legal standard'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Objective vs Subjective',
    topic: 'Avoiding Bias in Reports',
    rule: 'Reports must not contain language that reflects racial, ethnic, gender, or other bias, and must not include irrelevant personal characteristics.',
    explanation: 'Including irrelevant demographic information or biased language undermines the report\'s credibility and may indicate discriminatory enforcement.',
    legalImplication: 'Biased language in reports may support claims of discriminatory enforcement and civil rights violations.',
    category: 'report_writing',
    keywords: ['bias', 'discrimination', 'racial', 'ethnic', 'report writing', 'civil rights'],
  },

  // =========================================================================
  // Evidence Documentation in Reports
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Evidence Description',
    rule: 'All evidence collected must be described in detail in the report, including its location when found, physical characteristics, and how it was collected and preserved.',
    explanation: 'Thorough evidence documentation in the report supports chain of custody and authentication at trial.',
    legalImplication: 'Inadequate evidence documentation may result in exclusion or challenge to the evidence\'s integrity.',
    category: 'report_writing',
    keywords: ['evidence', 'documentation', 'description', 'collection', 'preservation', 'chain of custody'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Witness Statements',
    rule: 'Witness statements must be documented accurately, using the witness\'s own words when possible, and clearly attributed to the specific witness.',
    explanation: 'Officers should use direct quotes for key statements and note the witness\'s demeanor and conditions under which the statement was made.',
    legalImplication: 'Inaccurately documented witness statements may be used to impeach the officer and the witness.',
    category: 'report_writing',
    keywords: ['witness statements', 'documentation', 'direct quotes', 'attribution', 'accuracy'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Use of Force Documentation',
    rule: 'Any use of force must be thoroughly documented in the report, including the specific force used, the justification, the subject\'s actions, and any injuries sustained.',
    explanation: 'Use of force reports must describe the totality of circumstances and the officer\'s decision-making process. Both the subject\'s and officer\'s actions must be documented.',
    legalImplication: 'Inadequate use of force documentation may result in liability and inability to justify the force used.',
    category: 'report_writing',
    keywords: ['use of force', 'documentation', 'justification', 'injuries', 'totality of circumstances'],
  },

  // =========================================================================
  // Report Integrity
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Report Integrity',
    topic: 'Report Alterations',
    rule: 'Officers must not alter, backdate, or modify reports after submission without proper documentation of the change and the reason for the change.',
    explanation: 'Any corrections to submitted reports must be documented through supplemental reports or approved amendment procedures. Undocumented changes may constitute misconduct.',
    legalImplication: 'Unauthorized report alterations may constitute evidence tampering and grounds for criminal charges.',
    category: 'report_writing',
    keywords: ['report alteration', 'modification', 'supplemental report', 'evidence tampering', 'integrity'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Integrity',
    topic: 'Supplemental Reports',
    rule: 'When new information is obtained after the initial report is filed, officers must document it in a supplemental report referencing the original.',
    explanation: 'Supplemental reports maintain the integrity of the original report while adding newly discovered information. They should reference the original report number and explain the new information.',
    legalImplication: 'Failure to file supplemental reports for material new information may constitute a Brady violation.',
    category: 'report_writing',
    keywords: ['supplemental report', 'new information', 'original report', 'Brady', 'documentation'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Integrity',
    topic: 'Report Review',
    rule: 'Officers must review their reports for accuracy, completeness, spelling, and grammar before submission.',
    explanation: 'Errors in reports, even minor ones, can be exploited to undermine the officer\'s credibility and attention to detail.',
    legalImplication: 'Careless errors may be used to challenge the officer\'s credibility and overall reliability.',
    category: 'report_writing',
    keywords: ['report review', 'accuracy', 'completeness', 'credibility', 'quality'],
  },

  // =========================================================================
  // Miranda and Rights Documentation
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Rights Documentation',
    topic: 'Miranda Documentation',
    rule: 'If Miranda warnings are administered, the report must document the exact time, the exact warnings given, and the suspect\'s response (waiver or invocation).',
    explanation: 'Detailed Miranda documentation is critical. The report should note whether the suspect acknowledged understanding, whether they waived or invoked rights, and any subsequent statements.',
    legalImplication: 'Failure to document Miranda administration may result in statements being suppressed.',
    category: 'report_writing',
    keywords: ['miranda', 'documentation', 'waiver', 'invocation', 'warnings', 'statements'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Rights Documentation',
    topic: 'Consent Documentation',
    rule: 'When consent to search is obtained, the report must document who gave consent, the scope of consent given, whether the person was informed of the right to refuse, and whether consent was written or verbal.',
    explanation: 'Detailed consent documentation helps establish voluntariness. Written consent forms are preferred but not required.',
    legalImplication: 'Inadequate consent documentation may result in the search being found involuntary.',
    category: 'report_writing',
    keywords: ['consent', 'documentation', 'voluntary', 'right to refuse', 'written consent'],
  },

  // =========================================================================
  // Detention and Arrest Documentation
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Detention Documentation',
    topic: 'Reasonable Suspicion Documentation',
    rule: 'Reports must clearly articulate the specific facts and circumstances that established reasonable suspicion for any detention.',
    explanation: 'The report should describe what the officer observed or knew that led to the detention, including time, location, behavior, and any other relevant circumstances.',
    legalImplication: 'Failure to document reasonable suspicion may result in the detention being found unlawful and evidence suppressed.',
    category: 'report_writing',
    keywords: ['reasonable suspicion', 'detention', 'documentation', 'specific facts', 'articulable'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Arrest Documentation',
    topic: 'Probable Cause Documentation',
    rule: 'Reports documenting an arrest must clearly set forth the facts and circumstances establishing probable cause at the time of arrest.',
    explanation: 'The probable cause narrative must be detailed enough to allow a reviewing attorney or judge to independently assess whether the standard was met.',
    legalImplication: 'Inadequate probable cause documentation may result in the arrest being found unlawful.',
    category: 'report_writing',
    keywords: ['probable cause', 'arrest', 'documentation', 'facts', 'circumstances'],
  },
];

export const LD18_RULE_COUNT = LD18_DOCTRINE_RULES.length;
