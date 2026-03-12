// ============================================
// POST LD-21: Patrol Techniques — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD21_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Investigative Contacts
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Investigative Contacts',
    topic: 'Consensual Contact',
    rule: 'A consensual contact occurs when an officer approaches a person to ask questions without detention. The person is free to leave at any time, and the officer must not convey authority that would suggest otherwise.',
    explanation: 'Consensual contacts do not require reasonable suspicion. However, if the officer uses authority (blocking path, commanding to stop, retaining identification) the encounter may become a detention.',
    legalImplication: 'If a consensual contact is found to be a de facto detention, any evidence obtained without reasonable suspicion may be suppressed.',
    category: 'field_contact',
    keywords: ['consensual contact', 'free to leave', 'detention', 'reasonable suspicion', 'encounter'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Investigative Contacts',
    topic: 'Field Interview',
    rule: 'Field contacts must remain consensual unless reasonable suspicion of criminal activity develops to justify a detention.',
    explanation: 'Officers may ask questions during a consensual encounter, but the encounter must not be prolonged or escalated without legal justification. The moment the encounter becomes non-consensual, it is a detention.',
    legalImplication: 'Detaining a person during a field contact without reasonable suspicion violates the Fourth Amendment.',
    category: 'field_contact',
    keywords: ['field contact', 'field interview', 'consensual', 'reasonable suspicion', 'detention'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Investigative Contacts',
    topic: 'Contact Documentation',
    rule: 'Officers should document field contacts, including the basis for the contact, the person\'s identifying information, and the outcome of the interaction.',
    explanation: 'Documentation creates a record that can be reviewed for patterns, used in investigations, and serves as evidence that the contact was lawful.',
    legalImplication: 'Undocumented field contacts may be difficult to defend against allegations of racial profiling or unlawful detention.',
    category: 'field_contact',
    keywords: ['documentation', 'field contact', 'record', 'identifying information', 'outcome'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Investigative Contacts',
    topic: 'Racial Profiling Prohibition',
    rule: 'Officers must not use race, ethnicity, national origin, religion, gender, sexual orientation, or gender identity as the sole basis for initiating a contact, detention, or arrest.',
    explanation: 'California law prohibits racial profiling. Officers must have legitimate, non-discriminatory reasons for all law enforcement contacts. Bias-based policing violates the Equal Protection Clause.',
    legalImplication: 'Contacts based solely on protected characteristics are unlawful and may result in civil rights violations and evidence suppression.',
    category: 'patrol',
    keywords: ['racial profiling', 'bias', 'equal protection', 'discrimination', 'protected characteristics'],
  },

  // =========================================================================
  // Officer Safety
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Officer Safety',
    topic: 'Approach Tactics',
    rule: 'Officers must maintain tactical awareness when approaching persons or locations, including awareness of potential threats, escape routes, and available cover.',
    explanation: 'Tactical approach includes considering lighting, terrain, the number of persons present, and the nature of the call. Officers should communicate their position and plans to partners.',
    legalImplication: 'Poor tactical approach may create situations requiring force that could have been avoided with proper planning.',
    category: 'patrol',
    keywords: ['tactical awareness', 'officer safety', 'approach', 'cover', 'concealment', 'threats'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Officer Safety',
    topic: 'Building Searches',
    rule: 'Officers conducting building searches must follow systematic search procedures, maintain communication with partners, and clear rooms methodically.',
    explanation: 'Building searches are high-risk operations requiring coordination, communication, and discipline. Officers should not search alone when backup is available.',
    legalImplication: 'Building searches still require legal authority (warrant, exigent circumstances, consent) regardless of tactical considerations.',
    category: 'patrol',
    keywords: ['building search', 'systematic', 'officer safety', 'coordination', 'communication'],
  },

  // =========================================================================
  // Surveillance Practices
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Surveillance',
    topic: 'Surveillance Limitations',
    rule: 'Physical surveillance of persons in public places is generally permissible, but extended surveillance using technology may require a warrant.',
    explanation: 'Observation of activities in plain view from public locations does not implicate the Fourth Amendment. However, prolonged electronic surveillance, GPS tracking, and monitoring of private activities may require judicial authorization.',
    legalImplication: 'Warrantless electronic surveillance beyond public observation may violate the Fourth Amendment.',
    category: 'patrol',
    keywords: ['surveillance', 'public places', 'plain view', 'electronic surveillance', 'warrant', 'GPS'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Surveillance',
    topic: 'Body Camera Activation',
    rule: 'Officers must activate body-worn cameras in accordance with departmental policy when engaged in law enforcement contacts, detentions, arrests, and uses of force.',
    explanation: 'Body camera footage provides an objective record of encounters. Failure to activate cameras when required may create adverse inferences.',
    legalImplication: 'Failure to record required encounters may undermine the prosecution and create credibility issues.',
    category: 'patrol',
    keywords: ['body camera', 'recording', 'policy', 'activation', 'law enforcement contact'],
  },

  // =========================================================================
  // Suspicious Activity Investigation
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Suspicious Activity',
    topic: 'Suspicious Activity Response',
    rule: 'When investigating suspicious activity, officers must develop specific articulable facts before escalating from a consensual contact to a detention.',
    explanation: 'Mere presence in a high-crime area, nervous behavior, or evasive responses alone do not constitute reasonable suspicion. Officers must articulate specific facts suggesting criminal activity.',
    legalImplication: 'Detaining a person based solely on presence in a high-crime area without additional specific facts is unlawful.',
    category: 'patrol',
    keywords: ['suspicious activity', 'articulable facts', 'reasonable suspicion', 'high-crime area', 'detention'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Suspicious Activity',
    topic: 'Reasonable Suspicion Formation',
    rule: 'Reasonable suspicion must be based on the totality of the circumstances and specific articulable facts, not on a mere hunch or generalized suspicion.',
    explanation: 'Factors contributing to reasonable suspicion may include: behavior consistent with criminal activity, matching a suspect description, presence at an unusual time or place with additional circumstances, and prior criminal history combined with current behavior.',
    legalImplication: 'Actions taken based on a hunch rather than articulable facts violate the Fourth Amendment.',
    category: 'detention',
    keywords: ['reasonable suspicion', 'totality of circumstances', 'articulable facts', 'hunch', 'fourth amendment'],
  },

  // =========================================================================
  // Traffic Stops
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Traffic Enforcement',
    topic: 'Traffic Stop Authority',
    rule: 'Officers may conduct a traffic stop when they have reasonable suspicion that the driver or vehicle is in violation of the law.',
    explanation: 'Traffic violations, even minor ones, provide sufficient legal authority for a stop. The officer\'s subjective motivation (pretextual stop) is irrelevant if an objective violation exists.',
    legalImplication: 'A traffic stop without reasonable suspicion of a violation is an unlawful seizure.',
    category: 'detention',
    keywords: ['traffic stop', 'reasonable suspicion', 'violation', 'pretextual stop', 'seizure'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Enforcement',
    topic: 'Traffic Stop Duration',
    rule: 'A traffic stop must be limited in duration to the time reasonably necessary to complete the purpose of the stop. Extending the stop beyond its purpose requires additional reasonable suspicion.',
    explanation: 'Per Rodriguez v. United States, officers may not extend a traffic stop to conduct drug sniffs, seek consent, or investigate other matters without independent reasonable suspicion.',
    legalImplication: 'Evidence obtained after an unlawfully extended traffic stop is subject to suppression.',
    category: 'detention',
    keywords: ['traffic stop', 'duration', 'Rodriguez', 'extension', 'reasonable suspicion'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Enforcement',
    topic: 'Passenger Rights',
    rule: 'During a traffic stop, officers may order occupants to remain in or exit the vehicle for officer safety purposes, but passengers may not be detained beyond the scope of the stop without independent reasonable suspicion.',
    explanation: 'Per Maryland v. Wilson, officers may order passengers out of the vehicle during a lawful stop. However, detaining passengers after the stop is complete requires separate justification.',
    legalImplication: 'Detaining passengers beyond the scope of the traffic stop without reasonable suspicion is unlawful.',
    category: 'detention',
    keywords: ['passenger', 'traffic stop', 'Maryland v Wilson', 'exit vehicle', 'reasonable suspicion'],
  },

  // =========================================================================
  // Pursuit
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Pursuits',
    topic: 'Pursuit Decision',
    rule: 'Officers must weigh the risk to the public posed by the pursuit against the risk to the public posed by the suspect\'s escape before initiating or continuing a vehicle pursuit.',
    explanation: 'Vehicle pursuits create significant danger to officers, suspects, and bystanders. The decision to pursue must balance the need to apprehend against the risks created by the pursuit.',
    legalImplication: 'An unreasonable pursuit may result in civil liability for injuries caused during the pursuit.',
    category: 'pursuit',
    keywords: ['vehicle pursuit', 'risk assessment', 'public safety', 'apprehension', 'liability'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Pursuits',
    topic: 'Pursuit Termination',
    rule: 'Officers must terminate a pursuit when the risks to public safety outweigh the need to apprehend the suspect.',
    explanation: 'Factors requiring termination include: loss of visual contact, extreme speeds, heavy traffic, school zones, and when the suspect\'s identity is known and can be apprehended later.',
    legalImplication: 'Failure to terminate a dangerous pursuit may create liability for resulting injuries or deaths.',
    category: 'pursuit',
    keywords: ['pursuit termination', 'public safety', 'risk', 'terminate', 'liability'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Pursuits',
    topic: 'Pursuit Reporting',
    rule: 'All vehicle pursuits must be reported and documented, including the reason for the pursuit, speeds reached, actions taken, and the outcome.',
    explanation: 'Pursuit reports are subject to review by supervisors and are critical for accountability, training, and liability management.',
    legalImplication: 'Failure to document pursuits may indicate inadequate supervision and increase agency liability.',
    category: 'pursuit',
    keywords: ['pursuit reporting', 'documentation', 'accountability', 'supervisory review'],
  },

  // =========================================================================
  // Community Policing
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Community Relations',
    topic: 'Professional Conduct',
    rule: 'Officers must treat all persons with dignity, respect, and courtesy regardless of the circumstances of the encounter.',
    explanation: 'Professional conduct builds public trust and reduces the likelihood of complaints and liability. Disrespectful or unprofessional behavior damages community relationships.',
    legalImplication: 'Unprofessional conduct may contribute to findings of unreasonable seizure or bias-based policing.',
    category: 'patrol',
    keywords: ['professional conduct', 'dignity', 'respect', 'courtesy', 'community relations'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Community Relations',
    topic: 'Right to Record',
    rule: 'Members of the public have the right to record police activities in public places. Officers must not interfere with, seize, or destroy recording devices without legal authority.',
    explanation: 'The First Amendment protects the right to record police conducting official duties in public. Officers may not retaliate against persons who record them.',
    legalImplication: 'Interfering with the right to record may result in First Amendment violations and civil liability.',
    category: 'patrol',
    keywords: ['right to record', 'First Amendment', 'recording', 'public', 'retaliation'],
  },
];

export const LD21_RULE_COUNT = LD21_DOCTRINE_RULES.length;
