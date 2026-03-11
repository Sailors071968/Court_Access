// ============================================
// POST LD-21: Patrol Techniques — Expansion
// Additional doctrine rules to reach ~70 total
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD21_EXPANSION_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // CHAPTER: Traffic Stop Procedures
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'Traffic Stop Legal Authority',
    rule: 'An officer must have reasonable suspicion of a traffic violation or criminal activity to initiate a traffic stop. Stops based solely on hunches or profiling are unlawful.',
    explanation: 'Traffic stops are seizures under the Fourth Amendment. The officer must be able to articulate the specific violation or suspicious activity observed.',
    legalImplication: 'A traffic stop without reasonable suspicion is unlawful and evidence obtained may be suppressed.',
    category: 'patrol',
    keywords: ['traffic stop', 'reasonable suspicion', 'traffic violation', 'fourth amendment'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'High-Risk Traffic Stops',
    rule: 'High-risk (felony) traffic stops require officers to maintain tactical advantage through proper vehicle positioning, verbal commands from cover, and systematic suspect extraction.',
    explanation: 'High-risk stops are conducted when the vehicle or occupants are suspected of involvement in a serious crime. Officers should use PA systems and wait for backup.',
    legalImplication: 'The level of force and restraint used during high-risk stops must be proportional to the threat.',
    category: 'patrol',
    keywords: ['high-risk stop', 'felony stop', 'tactical advantage', 'verbal commands'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'Traffic Stop Duration',
    rule: 'A traffic stop must be completed within a reasonable time. Officers must diligently pursue the purpose of the stop and may not extend it without additional reasonable suspicion.',
    explanation: 'Per Rodriguez v. United States, extending a traffic stop to conduct a dog sniff without reasonable suspicion violates the Fourth Amendment.',
    legalImplication: 'Evidence discovered during an unreasonably extended traffic stop is subject to suppression.',
    category: 'patrol',
    keywords: ['traffic stop duration', 'Rodriguez', 'extension', 'dog sniff', 'reasonable time'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'Passenger Contact During Stops',
    rule: 'Officers may check passengers for identification and may order passengers to remain in or exit the vehicle for officer safety, but may not search passengers without independent justification.',
    explanation: 'Per Maryland v. Wilson, officers may order passengers out of a vehicle during a traffic stop. However, searching passengers requires separate reasonable suspicion or consent.',
    legalImplication: 'Searching a passenger without independent justification may violate the passenger\'s Fourth Amendment rights.',
    category: 'patrol',
    keywords: ['passenger', 'traffic stop', 'identification', 'exit order', 'search'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'DUI Detection',
    rule: 'Officers trained in DUI detection must follow standardized field sobriety testing (SFST) protocols when conducting DUI investigations during traffic stops.',
    explanation: 'NHTSA-approved SFSTs include the Horizontal Gaze Nystagmus, Walk and Turn, and One Leg Stand tests. Deviations from standard protocol may affect admissibility.',
    legalImplication: 'Improperly administered field sobriety tests may be excluded or given reduced weight in court.',
    category: 'patrol',
    keywords: ['DUI', 'field sobriety', 'SFST', 'HGN', 'impaired driving'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Traffic Stops',
    topic: 'Pretext Stops',
    rule: 'A traffic stop is lawful regardless of the officer\'s subjective motivation, as long as an objective basis for the stop exists.',
    explanation: 'Per Whren v. United States, an officer\'s ulterior motive does not invalidate a stop if an objective traffic violation occurred. However, California law imposes additional restrictions on pretextual stops.',
    legalImplication: 'While pretextual stops are generally lawful under federal law, California AB 2773 restricts certain minor-violation stops.',
    category: 'patrol',
    keywords: ['pretext stop', 'Whren', 'subjective motivation', 'objective basis'],
  },

  // =========================================================================
  // CHAPTER: Patrol Operations
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Patrol Operations',
    topic: 'Beat Patrol',
    rule: 'Officers on patrol must maintain situational awareness, observe and document suspicious activity, and respond to calls for service while maintaining officer safety.',
    explanation: 'Effective patrol requires balancing proactive policing with reactive response. Officers should vary their patrol patterns to maximize visibility and deterrence.',
    legalImplication: 'Observations made during routine patrol may establish reasonable suspicion or probable cause for enforcement action.',
    category: 'patrol',
    keywords: ['beat patrol', 'situational awareness', 'suspicious activity', 'proactive'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Patrol Operations',
    topic: 'Building Searches',
    rule: 'Officers conducting building searches must use systematic clearing techniques, maintain communication with team members, and avoid complacency during the search process.',
    explanation: 'Building searches present significant tactical risks. Officers should use the one-plus-one rule, never entering a room alone when backup is available.',
    legalImplication: 'Evidence discovered during a lawful building search based on exigent circumstances is admissible.',
    category: 'patrol',
    keywords: ['building search', 'clearing', 'tactical', 'communication', 'systematic'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Patrol Operations',
    topic: 'Alarm Response',
    rule: 'Officers responding to burglar alarms must approach the location tactically, secure a perimeter, and systematically clear the premises before declaring the scene code-4.',
    explanation: 'Even frequent false alarms do not relieve officers of the duty to respond with appropriate caution. Each alarm call should be treated as potentially valid.',
    legalImplication: 'Officers may enter premises in response to alarms under the emergency exception without a warrant.',
    category: 'patrol',
    keywords: ['alarm response', 'burglar alarm', 'perimeter', 'clearing', 'emergency'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Patrol Operations',
    topic: 'Suspicious Persons',
    rule: 'When contacting suspicious persons, officers must articulate specific facts and circumstances that justify the contact and any subsequent detention or enforcement action.',
    explanation: 'Consensual contacts do not require justification, but any escalation to detention requires reasonable suspicion. Officers must document the basis for their actions.',
    legalImplication: 'Contacts that escalate to detentions without articulable reasonable suspicion may be found unlawful.',
    category: 'patrol',
    keywords: ['suspicious persons', 'contact', 'articulable facts', 'detention', 'documentation'],
  },

  // =========================================================================
  // CHAPTER: Domestic Violence Response
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Domestic Violence',
    topic: 'DV Response Protocol',
    rule: 'Officers responding to domestic violence calls must separate the parties, conduct independent interviews, document visible injuries with photographs, and determine the dominant aggressor.',
    explanation: 'California Penal Code Section 13701 requires agencies to have DV response protocols. Officers must complete the DV supplemental report.',
    legalImplication: 'Failure to follow DV response protocols may expose the department to civil liability if the victim is subsequently harmed.',
    category: 'patrol',
    keywords: ['domestic violence', 'dominant aggressor', 'separation', 'photographs', 'injuries'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Domestic Violence',
    topic: 'Emergency Protective Orders',
    rule: 'Officers may request an Emergency Protective Order (EPO) from a judicial officer when a person is in immediate danger of domestic violence, providing protection for up to seven days.',
    explanation: 'EPOs are available 24 hours a day. The officer must have reasonable grounds to believe the person is in immediate danger.',
    legalImplication: 'An EPO issued without proper grounds may be challenged, but officers are generally protected by good faith reliance.',
    category: 'patrol',
    keywords: ['EPO', 'emergency protective order', 'domestic violence', 'immediate danger'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Domestic Violence',
    topic: 'DV Mandatory Arrest',
    rule: 'When an officer has probable cause to believe a felony domestic violence offense has occurred, the officer must make an arrest regardless of the victim\'s wishes.',
    explanation: 'Pro-arrest policies exist because domestic violence victims may be reluctant to cooperate due to fear, financial dependence, or emotional attachment.',
    legalImplication: 'Failure to arrest when mandatory arrest criteria are met may expose the department to liability.',
    category: 'patrol',
    keywords: ['mandatory arrest', 'domestic violence', 'felony', 'pro-arrest policy'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Domestic Violence',
    topic: 'DV Evidence Collection',
    rule: 'Officers must collect and preserve all available evidence in domestic violence cases, including photographs of injuries, excited utterances, damaged property, and 911 recordings.',
    explanation: 'Because DV victims may later recant, officers must build evidence-based cases that do not rely solely on victim cooperation.',
    legalImplication: 'Evidence-based prosecution allows cases to proceed even when victims are uncooperative.',
    category: 'patrol',
    keywords: ['DV evidence', 'photographs', 'excited utterances', '911 recordings', 'evidence-based'],
  },

  // =========================================================================
  // CHAPTER: Vehicle Operations
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Operations',
    topic: 'Emergency Vehicle Operations',
    rule: 'Officers operating emergency vehicles must exercise due care for the safety of all persons and are not relieved from the duty to drive with due regard for the safety of others.',
    explanation: 'California Vehicle Code Section 21056 requires officers to drive with due regard even during emergency responses. Speed and traffic violations are authorized but recklessness is not.',
    legalImplication: 'An officer involved in a collision during emergency driving may face civil liability if driving without due regard for safety.',
    category: 'patrol',
    keywords: ['emergency vehicle', 'due care', 'code 3', 'emergency driving', 'safety'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Operations',
    topic: 'Pursuit Policy',
    rule: 'Officers must comply with department pursuit policies, which generally require supervisory notification, continuous radio updates, and termination when risks outweigh the need to apprehend.',
    explanation: 'Pursuit policies balance public safety with law enforcement needs. Officers must consider traffic, weather, road conditions, and the nature of the offense.',
    legalImplication: 'Officers who violate pursuit policies and cause injury may face personal and departmental liability.',
    category: 'pursuit',
    keywords: ['pursuit policy', 'supervisory notification', 'radio updates', 'termination'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Vehicle Operations',
    topic: 'Pursuit Intervention Techniques',
    rule: 'Pursuit intervention techniques such as the PIT maneuver may only be used at appropriate speeds and when deadly force is justified or the technique is authorized by department policy.',
    explanation: 'PIT maneuvers at high speeds can cause rollover accidents and are considered deadly force. Low-speed PIT maneuvers carry less risk but still require training.',
    legalImplication: 'A PIT maneuver that causes serious injury or death may be judged under the deadly force standard.',
    category: 'pursuit',
    keywords: ['PIT maneuver', 'pursuit intervention', 'speed', 'deadly force', 'training'],
  },

  // =========================================================================
  // CHAPTER: Field Contact Procedures
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Field Contacts',
    topic: 'Consensual Contact Procedures',
    rule: 'During consensual contacts, officers must not display authority in a manner that would cause a reasonable person to believe they are not free to leave or decline the encounter.',
    explanation: 'Consensual contacts are valuable investigative tools but must remain voluntary. Factors that convert a contact to a detention include blocking paths, touching, or commanding.',
    legalImplication: 'If a consensual contact is found to have become a detention, any evidence obtained without reasonable suspicion may be suppressed.',
    category: 'field_contact',
    keywords: ['consensual contact', 'free to leave', 'authority', 'voluntary'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Field Contacts',
    topic: 'Field Interview Cards',
    rule: 'Officers may complete field interview cards during consensual contacts to document information about persons contacted. Participation by the contactee is voluntary.',
    explanation: 'Field interview cards provide intelligence for investigators. However, officers must ensure the contact remains consensual and the person understands they can decline.',
    legalImplication: 'Information obtained during a contact that was actually a detention may be challenged.',
    category: 'field_contact',
    keywords: ['field interview card', 'FI card', 'consensual', 'intelligence', 'documentation'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Field Contacts',
    topic: 'Gang Contact Documentation',
    rule: 'Officers documenting gang contacts must comply with California Penal Code Section 186.34, which restricts criteria for designating a person as a gang member in CalGang or similar databases.',
    explanation: 'California law limits the criteria for gang designation to protect civil liberties. Officers must use specific statutory criteria, not mere association or location.',
    legalImplication: 'Improper gang designation may violate civil rights and expose the department to liability.',
    category: 'field_contact',
    keywords: ['gang contact', 'CalGang', 'designation criteria', 'penal code 186.34'],
  },

  // =========================================================================
  // CHAPTER: Officer Safety
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Officer Safety',
    topic: 'Contact and Cover',
    rule: 'The contact and cover principle requires that during multi-officer contacts, one officer engages with the subject (contact officer) while the second officer maintains a position to observe and respond to threats (cover officer).',
    explanation: 'The cover officer should maintain a wider field of view and not become engaged in the contact. This tactical principle significantly reduces the risk of ambush.',
    legalImplication: 'The contact and cover principle is a tactical best practice. Failure to follow it may be cited in use-of-force reviews.',
    category: 'patrol',
    keywords: ['contact and cover', 'officer safety', 'tactical', 'multi-officer', 'cover officer'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Officer Safety',
    topic: 'Tactical Communication',
    rule: 'Officers should use clear, calm verbal communication to gain voluntary compliance before escalating to physical force options.',
    explanation: 'Tactical communication combines verbal and non-verbal skills to de-escalate situations and gain cooperation. It includes active listening, empathy, and clear direction.',
    legalImplication: 'Effective verbal communication may reduce the need for force and demonstrate the reasonableness of the officer\'s actions.',
    category: 'patrol',
    keywords: ['tactical communication', 'verbal', 'de-escalation', 'voluntary compliance'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Officer Safety',
    topic: 'Ambush Awareness',
    rule: 'Officers must maintain constant awareness of potential ambush situations, including during traffic stops, building approaches, and foot contacts, and should use tactical positioning to minimize exposure.',
    explanation: 'Ambush attacks on officers are a significant threat. Officers should vary routines, use cover, and maintain awareness of surroundings at all times.',
    legalImplication: 'Officer safety tactics help preserve the officer\'s ability to respond appropriately to threats.',
    category: 'patrol',
    keywords: ['ambush awareness', 'tactical positioning', 'cover', 'officer safety'],
  },

  // =========================================================================
  // CHAPTER: Report Writing for Patrol
  // =========================================================================
  {
    source: 'POST LD-21',
    chapter: 'Patrol Reporting',
    topic: 'Traffic Stop Documentation',
    rule: 'Officers must document the legal basis for every traffic stop, including the specific violation observed, the location, and the actions taken during the stop.',
    explanation: 'Thorough documentation of traffic stops supports prosecution and defends against allegations of profiling or improper stops.',
    legalImplication: 'A traffic stop without documented legal basis may be challenged as unconstitutional.',
    category: 'patrol',
    keywords: ['traffic stop documentation', 'legal basis', 'violation', 'reporting'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Patrol Reporting',
    topic: 'Use of Force Reporting',
    rule: 'Any use of force during patrol activities must be documented in a separate use-of-force report detailing the subject\'s actions, the force applied, and the results.',
    explanation: 'Force reports are critical for departmental review and legal defense. They should be completed as soon as practical after the incident.',
    legalImplication: 'Failure to report force may constitute a policy violation and may undermine the officer\'s account if challenged.',
    category: 'patrol',
    keywords: ['use of force report', 'patrol', 'documentation', 'subject actions'],
  },
  {
    source: 'POST LD-21',
    chapter: 'Patrol Reporting',
    topic: 'Racial and Identity Profiling Act',
    rule: 'Officers must collect and report stop data as required by the Racial and Identity Profiling Act (RIPA), including perceived demographics, reason for stop, and actions taken.',
    explanation: 'AB 953 requires California law enforcement agencies to collect and report data on all stops to the Attorney General. This data is used to identify patterns of bias.',
    legalImplication: 'Failure to collect RIPA data may result in sanctions and may indicate a pattern of non-compliance.',
    category: 'patrol',
    keywords: ['RIPA', 'racial profiling', 'stop data', 'AB 953', 'demographics'],
  },
];
