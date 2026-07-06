// ============================================
// POST LD-18: Investigative Report Writing — Expansion
// Additional doctrine rules to reach ~60 total
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD18_EXPANSION_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // CHAPTER: Report Writing Fundamentals
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Fundamentals',
    topic: 'Purpose of Reports',
    rule: 'Police reports serve as the official record of events and form the foundation for prosecution, civil proceedings, and departmental review. Reports must be accurate, complete, and objective.',
    explanation: 'Reports are legal documents relied upon by prosecutors, defense attorneys, judges, and juries. Inaccurate or incomplete reports can undermine cases.',
    legalImplication: 'A report containing material inaccuracies may be used to impeach the officer\'s testimony and damage credibility.',
    category: 'report_writing',
    keywords: ['report purpose', 'official record', 'prosecution', 'accuracy', 'completeness'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Fundamentals',
    topic: 'Timeliness',
    rule: 'Reports should be written as soon as practical after the event to ensure accuracy while details are fresh in the officer\'s memory.',
    explanation: 'Memory degrades over time. Reports written promptly are more accurate and carry greater weight in court. Officers should take field notes to preserve details.',
    legalImplication: 'A significant delay between the event and report writing may undermine the report\'s reliability and the officer\'s testimony.',
    category: 'report_writing',
    keywords: ['timeliness', 'prompt', 'memory', 'field notes', 'accuracy'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Fundamentals',
    topic: 'Objectivity',
    rule: 'Reports must present facts objectively without personal opinions, conclusions, or biased language. Officers should report what they observed, not what they believed or assumed.',
    explanation: 'Objective reporting separates factual observations from conclusions. Officers should use specific, descriptive language rather than characterizations.',
    legalImplication: 'Reports containing subjective opinions or biased language may be used by defense to show prejudice.',
    category: 'report_writing',
    keywords: ['objectivity', 'facts', 'bias', 'observations', 'conclusions'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Fundamentals',
    topic: 'First Person Narrative',
    rule: 'Reports should be written in first person, past tense, using clear and concise language. The narrative should follow a chronological sequence of events.',
    explanation: 'First person narrative is clearer and more direct. Chronological organization helps the reader follow the sequence of events.',
    legalImplication: 'A poorly organized report may confuse the reader and weaken the prosecution\'s case.',
    category: 'report_writing',
    keywords: ['first person', 'past tense', 'chronological', 'narrative', 'clear language'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Writing Fundamentals',
    topic: 'Specificity',
    rule: 'Reports must include specific details including exact times, locations, descriptions, and direct quotes when possible, avoiding vague or generalized statements.',
    explanation: 'Specific details make reports more useful for investigation, prosecution, and court proceedings. Exact quotes should be attributed to the speaker.',
    legalImplication: 'Vague reports may fail to establish elements of crimes or probable cause.',
    category: 'report_writing',
    keywords: ['specificity', 'details', 'exact times', 'direct quotes', 'descriptions'],
  },

  // =========================================================================
  // CHAPTER: Documenting Probable Cause
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Documenting Probable Cause',
    topic: 'Articulable Facts',
    rule: 'Reports documenting detentions and arrests must include the specific articulable facts that established reasonable suspicion or probable cause at the time of the action.',
    explanation: 'Courts evaluate the legality of detentions and arrests based on the facts known to the officer at the time. These facts must be documented in the report.',
    legalImplication: 'A report that fails to articulate the basis for a detention or arrest may result in the action being found unlawful.',
    category: 'report_writing',
    keywords: ['articulable facts', 'probable cause', 'reasonable suspicion', 'documentation'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Documenting Probable Cause',
    topic: 'Search Justification',
    rule: 'When documenting a search, the report must clearly state the legal authority for the search, whether warrant, consent, or exception to the warrant requirement.',
    explanation: 'The legal basis for every search must be documented. For consent searches, document who consented, whether they were advised of the right to refuse, and the scope.',
    legalImplication: 'A search without documented legal authority is presumptively unreasonable.',
    category: 'report_writing',
    keywords: ['search documentation', 'legal authority', 'warrant', 'consent', 'exception'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Documenting Probable Cause',
    topic: 'Informant Documentation',
    rule: 'Reports relying on information from informants must document the informant\'s reliability, the basis of their knowledge, and how their information was corroborated.',
    explanation: 'The two-pronged Aguilar-Spinelli test or the totality-of-circumstances test under Illinois v. Gates requires showing the informant\'s reliability and basis of knowledge.',
    legalImplication: 'Failure to document informant reliability may undermine probable cause based on informant information.',
    category: 'report_writing',
    keywords: ['informant', 'reliability', 'basis of knowledge', 'corroboration', 'probable cause'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Documenting Probable Cause',
    topic: 'Timeline Documentation',
    rule: 'Reports must include accurate timestamps for all significant events including initial contact, detention, Miranda advisement, arrest, and booking.',
    explanation: 'Accurate timelines are essential for evaluating the legality of detentions (duration) and the sequence of events. Discrepancies may be exploited by defense.',
    legalImplication: 'Inaccurate or missing timestamps may undermine the officer\'s credibility and the legality of time-sensitive procedures.',
    category: 'report_writing',
    keywords: ['timeline', 'timestamps', 'sequence of events', 'duration', 'accuracy'],
  },

  // =========================================================================
  // CHAPTER: Witness and Victim Statements
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Witness Statements',
    topic: 'Recording Statements',
    rule: 'Witness and victim statements should be recorded in the witness\'s own words whenever possible, using direct quotes to preserve the original language and meaning.',
    explanation: 'Paraphrasing may alter the meaning of statements. Direct quotes are more reliable and carry greater weight in court proceedings.',
    legalImplication: 'Inaccurate paraphrasing of statements may constitute Brady material if it favors the defense.',
    category: 'report_writing',
    keywords: ['witness statements', 'direct quotes', 'victim statements', 'original language'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Witness Statements',
    topic: 'Excited Utterances',
    rule: 'Spontaneous statements made by victims or witnesses under the stress of the event should be carefully documented with the exact words, the speaker\'s demeanor, and the timing relative to the event.',
    explanation: 'Excited utterances are an exception to the hearsay rule and are admissible even if the declarant is unavailable. Proper documentation preserves their admissibility.',
    legalImplication: 'Well-documented excited utterances can be admitted even without the declarant\'s testimony.',
    category: 'report_writing',
    keywords: ['excited utterance', 'spontaneous statement', 'hearsay exception', 'demeanor'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Witness Statements',
    topic: 'Dying Declarations',
    rule: 'A dying declaration must be documented with the declarant\'s exact words, their awareness of impending death, and the circumstances under which the statement was made.',
    explanation: 'Dying declarations are admissible as an exception to the hearsay rule when the declarant believed death was imminent. The officer must document the declarant\'s state of mind.',
    legalImplication: 'Failure to properly document a dying declaration may prevent its admission in court.',
    category: 'report_writing',
    keywords: ['dying declaration', 'hearsay exception', 'impending death', 'exact words'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Witness Statements',
    topic: 'Conflicting Statements',
    rule: 'When witnesses provide conflicting accounts, all versions must be documented accurately. The officer should not resolve conflicts by choosing one version over another.',
    explanation: 'Conflicting statements are valuable evidence. The fact-finder (judge or jury) determines credibility, not the reporting officer.',
    legalImplication: 'Failure to document conflicting statements may constitute a Brady violation if the omitted statement favors the defense.',
    category: 'report_writing',
    keywords: ['conflicting statements', 'credibility', 'Brady', 'multiple accounts'],
  },

  // =========================================================================
  // CHAPTER: Use of Force Documentation
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Force Documentation',
    topic: 'Force Report Elements',
    rule: 'Use of force reports must document: the subject\'s actions that necessitated force, the specific force techniques used, the duration of force application, and the results including any injuries.',
    explanation: 'Comprehensive force documentation is essential for departmental review, legal defense, and public accountability. Each application of force should be separately described.',
    legalImplication: 'Inadequate force documentation may create an inference of excessive force and undermine the officer\'s defense.',
    category: 'report_writing',
    keywords: ['force report', 'elements', 'techniques', 'duration', 'injuries'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Force Documentation',
    topic: 'De-escalation Documentation',
    rule: 'Reports must document all de-escalation efforts attempted before and during the use of force, including verbal commands, warnings, and attempts to create time and distance.',
    explanation: 'Documentation of de-escalation efforts demonstrates that force was used as a last resort and supports the reasonableness of the officer\'s actions.',
    legalImplication: 'Failure to document de-escalation attempts may suggest force was premature or unnecessary.',
    category: 'report_writing',
    keywords: ['de-escalation documentation', 'verbal commands', 'warnings', 'last resort'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Force Documentation',
    topic: 'Injury Documentation',
    rule: 'All injuries to both subjects and officers must be documented in detail, including photographs, medical treatment provided or refused, and the apparent cause of each injury.',
    explanation: 'Injury documentation serves multiple purposes: evidence of resistance, accountability for force, and protection against false claims.',
    legalImplication: 'Undocumented injuries may be attributed to excessive force, undermining the officer\'s account.',
    category: 'report_writing',
    keywords: ['injury documentation', 'photographs', 'medical treatment', 'subject injuries'],
  },

  // =========================================================================
  // CHAPTER: Evidence Documentation
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Evidence Description',
    rule: 'Each item of evidence must be described in detail in the report, including its location, condition, how it was discovered, and how it was collected and preserved.',
    explanation: 'Detailed evidence descriptions establish the relevance and connection of each item to the crime. The description should be sufficient to identify the item uniquely.',
    legalImplication: 'Inadequately described evidence may be excluded or its relevance challenged.',
    category: 'report_writing',
    keywords: ['evidence description', 'location', 'condition', 'collection', 'identification'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Chain of Custody',
    rule: 'The chain of custody for each piece of evidence must be documented from the moment of collection through storage, analysis, and court presentation.',
    explanation: 'Chain of custody establishes that the evidence presented in court is the same evidence collected at the scene and has not been altered or contaminated.',
    legalImplication: 'A broken chain of custody may result in evidence being excluded or its weight significantly diminished.',
    category: 'report_writing',
    keywords: ['chain of custody', 'evidence handling', 'documentation', 'authentication'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Evidence Documentation',
    topic: 'Digital Evidence Documentation',
    rule: 'Reports involving digital evidence must document the device type, condition, passwords or lock status, and the method used to preserve data integrity, including hash values.',
    explanation: 'Digital evidence requires special documentation to establish authenticity and integrity. Hash values (MD5, SHA-256) verify that data has not been altered.',
    legalImplication: 'Digital evidence without proper documentation of collection and preservation methods may be challenged.',
    category: 'report_writing',
    keywords: ['digital evidence', 'hash values', 'data integrity', 'device documentation'],
  },

  // =========================================================================
  // CHAPTER: Report Review and Supplemental Reports
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Report Review',
    topic: 'Supervisor Review',
    rule: 'Supervisors must review reports for accuracy, completeness, and legal sufficiency. Reports with deficiencies must be returned for correction before approval.',
    explanation: 'Supervisory review is a quality control measure. Supervisors should verify that the report documents all elements of the offense and legal justification for actions taken.',
    legalImplication: 'A supervisor who approves a deficient report may share liability for resulting legal issues.',
    category: 'report_writing',
    keywords: ['supervisor review', 'accuracy', 'completeness', 'legal sufficiency', 'approval'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Review',
    topic: 'Supplemental Reports',
    rule: 'When additional information is discovered after the initial report is completed, a supplemental report must be prepared documenting the new information without altering the original report.',
    explanation: 'Original reports must not be altered or backdated. Supplemental reports preserve the integrity of the original while adding new information.',
    legalImplication: 'Altering an original report may constitute falsification of records, a criminal offense.',
    category: 'report_writing',
    keywords: ['supplemental report', 'additional information', 'original report', 'integrity'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Report Review',
    topic: 'Report Corrections',
    rule: 'Corrections to reports must be made transparently through addenda or supplemental reports. Officers must never delete, overwrite, or conceal original report content.',
    explanation: 'Transparent correction processes maintain the integrity of the record. Corrections should explain what is being corrected and why.',
    legalImplication: 'Concealed corrections may be viewed as evidence tampering and may result in criminal charges.',
    category: 'report_writing',
    keywords: ['corrections', 'addenda', 'transparency', 'integrity', 'evidence tampering'],
  },

  // =========================================================================
  // CHAPTER: Special Report Types
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Special Reports',
    topic: 'Arrest Report',
    rule: 'An arrest report must document the elements of each offense charged, the facts establishing probable cause, Miranda advisement, booking information, and any statements made.',
    explanation: 'The arrest report is the primary document for prosecution. It must establish every element of the charged offense through documented facts.',
    legalImplication: 'An arrest report that fails to document elements of the offense may result in case dismissal.',
    category: 'report_writing',
    keywords: ['arrest report', 'elements of offense', 'probable cause', 'Miranda', 'booking'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Special Reports',
    topic: 'Crime Scene Report',
    rule: 'Crime scene reports must document the condition of the scene, evidence collected, processing techniques used, and the names and roles of all personnel involved.',
    explanation: 'The crime scene report connects physical evidence to the crime and documents the integrity of the scene processing.',
    legalImplication: 'An inadequate crime scene report may compromise the evidentiary value of physical evidence.',
    category: 'report_writing',
    keywords: ['crime scene report', 'evidence collected', 'processing techniques', 'personnel'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Special Reports',
    topic: 'Vehicle Pursuit Report',
    rule: 'A vehicle pursuit report must document the reason for initiating the pursuit, speeds attained, duration, road conditions, termination method, and any collisions or injuries.',
    explanation: 'Pursuit reports are essential for departmental review of pursuit decisions and for defending against civil liability claims.',
    legalImplication: 'A pursuit resulting in injury without proper documentation may expose the officer and department to significant liability.',
    category: 'report_writing',
    keywords: ['pursuit report', 'speeds', 'duration', 'termination', 'collisions'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Special Reports',
    topic: 'Missing Person Report',
    rule: 'Missing person reports must be taken immediately without a waiting period, with particular urgency for children, elderly persons, and persons with mental or physical disabilities.',
    explanation: 'California law prohibits agencies from imposing waiting periods before accepting missing person reports. Reports must be entered into NCIC/CLETS immediately.',
    legalImplication: 'Failure to immediately accept and process a missing person report may violate state law and expose the department to liability.',
    category: 'report_writing',
    keywords: ['missing person', 'no waiting period', 'NCIC', 'CLETS', 'children'],
  },

  // =========================================================================
  // CHAPTER: Legal Considerations in Report Writing
  // =========================================================================
  {
    source: 'POST LD-18',
    chapter: 'Legal Considerations',
    topic: 'Brady Material',
    rule: 'Officers have a duty to document and disclose all material facts, including those favorable to the defense. Failure to disclose exculpatory information violates Brady v. Maryland.',
    explanation: 'Brady requires the prosecution to disclose exculpatory evidence. Officers must document all relevant facts, not just those supporting the prosecution.',
    legalImplication: 'A Brady violation may result in case dismissal, reversal of conviction, and civil liability.',
    category: 'report_writing',
    keywords: ['Brady', 'exculpatory', 'disclosure', 'material facts', 'defense favorable'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Legal Considerations',
    topic: 'Hearsay Documentation',
    rule: 'Officers should clearly attribute statements in reports to their source, distinguishing between personal observations, witness statements, and information from other officers or records.',
    explanation: 'Proper attribution allows courts to evaluate the admissibility of each piece of information. Unattributed hearsay may be excluded.',
    legalImplication: 'Reports with unattributed statements may be challenged as containing inadmissible hearsay.',
    category: 'report_writing',
    keywords: ['hearsay', 'attribution', 'source', 'personal observation', 'witness statement'],
  },
  {
    source: 'POST LD-18',
    chapter: 'Legal Considerations',
    topic: 'Report as Testimony Foundation',
    rule: 'Officers should write reports with the understanding that they will use the report to refresh their memory during testimony, sometimes months or years after the event.',
    explanation: 'A well-written report enables accurate testimony. Officers should include sufficient detail to recall the event clearly when testifying.',
    legalImplication: 'Officers who testify inconsistently with their reports may be impeached, damaging their credibility.',
    category: 'report_writing',
    keywords: ['testimony', 'refresh memory', 'impeachment', 'credibility', 'detail'],
  },
];
