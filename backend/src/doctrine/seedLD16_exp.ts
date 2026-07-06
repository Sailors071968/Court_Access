// ============================================
// POST LD-16: Search & Seizure — Expansion
// Additional doctrine rules to reach ~100 total
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD16_EXPANSION_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // CHAPTER: Warrant Execution (expanded)
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Search Warrants',
    topic: 'Nighttime Warrant Execution',
    rule: 'A search warrant may only be served between 7:00 AM and 10:00 PM unless the magistrate has specifically authorized nighttime execution based on a showing of good cause.',
    explanation: 'California Penal Code Section 1533 restricts nighttime service. Good cause for nighttime execution includes risk of evidence destruction or flight.',
    legalImplication: 'A warrant executed at night without nighttime authorization may be found invalid and evidence suppressed.',
    category: 'search',
    keywords: ['nighttime warrant', 'execution', 'good cause', 'penal code 1533'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Search Warrants',
    topic: 'Warrant Return',
    rule: 'Officers must make a return on the search warrant within the time specified, providing the court with an inventory of all items seized.',
    explanation: 'The return documents what was seized and ensures judicial oversight of the search. Failure to make a timely return may result in sanctions.',
    legalImplication: 'Failure to properly return the warrant with a complete inventory may affect the admissibility of seized items.',
    category: 'search',
    keywords: ['warrant return', 'inventory', 'judicial oversight', 'timely'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Search Warrants',
    topic: 'Anticipatory Warrant',
    rule: 'An anticipatory search warrant is valid only if the triggering condition specified in the warrant actually occurs before the warrant is executed.',
    explanation: 'Anticipatory warrants authorize a future search contingent on a triggering event. If the event does not occur, the warrant may not be executed.',
    legalImplication: 'Execution of an anticipatory warrant without the triggering condition is unlawful.',
    category: 'search',
    keywords: ['anticipatory warrant', 'triggering condition', 'future search', 'contingent'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Search Warrants',
    topic: 'Sneak and Peek Warrant',
    rule: 'A covert entry warrant (sneak and peek) authorizes officers to enter and search premises without providing immediate notice to the occupant, with delayed notification as authorized by the court.',
    explanation: 'These warrants are used when immediate notice would compromise an ongoing investigation. They must be specifically authorized and include a notice timeline.',
    legalImplication: 'Failure to provide delayed notice as required may violate constitutional rights.',
    category: 'search',
    keywords: ['covert entry', 'sneak and peek', 'delayed notification', 'warrant'],
  },

  // =========================================================================
  // CHAPTER: Consent Searches (expanded)
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Consent Searches',
    topic: 'Consent During Traffic Stops',
    rule: 'Officers may request consent to search a vehicle during a traffic stop, but must not coerce consent through implied threats of prolonged detention or arrest.',
    explanation: 'The voluntary nature of consent is critical. Officers should not suggest that refusal will result in negative consequences.',
    legalImplication: 'Consent obtained through implied threats or coercion is involuntary and the resulting search is unlawful.',
    category: 'search',
    keywords: ['consent', 'traffic stop', 'vehicle search', 'coercion', 'voluntary'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Consent Searches',
    topic: 'Consent Withdrawal',
    rule: 'A person who has given consent to search may withdraw that consent at any time. Once consent is withdrawn, the search must cease immediately unless another legal basis exists.',
    explanation: 'The withdrawal of consent must be clear and unequivocal. Officers may retain items already seized under plain view or other exceptions.',
    legalImplication: 'Continuing a search after consent is withdrawn, without other legal authority, is unlawful.',
    category: 'search',
    keywords: ['consent withdrawal', 'revoke', 'cease search', 'legal basis'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Consent Searches',
    topic: 'Apparent Authority Consent',
    rule: 'A search based on apparent authority consent is valid if the officer reasonably believed the person had authority to consent, even if that belief was mistaken.',
    explanation: 'Per Illinois v. Rodriguez, the test is whether a reasonable officer would believe the consenting party had authority. Officers should inquire about the relationship to the premises.',
    legalImplication: 'If the officer\'s belief in authority was unreasonable, the consent is invalid.',
    category: 'search',
    keywords: ['apparent authority', 'consent', 'reasonable belief', 'Illinois v Rodriguez'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Consent Searches',
    topic: 'Consent — Co-Occupant Objection',
    rule: 'When a physically present co-occupant objects to a search, their objection overrides the consent of another co-occupant, and the search may not proceed without a warrant or other exception.',
    explanation: 'Per Georgia v. Randolph, a present co-occupant\'s refusal to consent is controlling. However, per Fernandez v. California, if the objecting party is lawfully removed, the remaining occupant may consent.',
    legalImplication: 'A search conducted over the objection of a present co-occupant violates the Fourth Amendment.',
    category: 'search',
    keywords: ['co-occupant', 'objection', 'Georgia v Randolph', 'Fernandez', 'consent'],
  },

  // =========================================================================
  // CHAPTER: Vehicle Search Exceptions (expanded)
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Vehicle Searches',
    topic: 'Vehicle Passenger Belongings',
    rule: 'When officers have probable cause to search a vehicle, they may also search personal belongings of passengers if those items could reasonably contain the evidence sought.',
    explanation: 'Per Wyoming v. Houghton, probable cause to search a vehicle extends to containers belonging to passengers when those containers could hold the evidence.',
    legalImplication: 'Searching passenger belongings without probable cause or when the items could not contain the evidence sought may be unlawful.',
    category: 'search',
    keywords: ['passenger belongings', 'Wyoming v Houghton', 'vehicle search', 'probable cause'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Vehicle Searches',
    topic: 'Trunk Search',
    rule: 'Officers with probable cause to search a vehicle may search the trunk and all containers within it that could reasonably contain the evidence sought.',
    explanation: 'The automobile exception extends to all areas of the vehicle, including locked compartments, if probable cause exists for the vehicle search.',
    legalImplication: 'A trunk search without probable cause or beyond the scope of the evidence sought may be unlawful.',
    category: 'search',
    keywords: ['trunk search', 'vehicle', 'probable cause', 'automobile exception'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Vehicle Searches',
    topic: 'Canine Sniff During Traffic Stop',
    rule: 'A canine sniff of the exterior of a vehicle during a lawful traffic stop does not constitute a search, but the stop may not be extended solely to conduct the sniff without reasonable suspicion.',
    explanation: 'Per Illinois v. Caballes, a canine sniff during a lawful stop is permissible. However, per Rodriguez, the stop may not be prolonged for the sniff.',
    legalImplication: 'A canine alert during a lawful sniff provides probable cause to search the vehicle.',
    category: 'search',
    keywords: ['canine sniff', 'drug dog', 'traffic stop', 'Illinois v Caballes', 'probable cause'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Vehicle Searches',
    topic: 'Tow Impound Search',
    rule: 'Before towing a vehicle, officers must conduct an inventory of the vehicle\'s contents following standardized department procedures. The inventory must not be used as a pretext for investigation.',
    explanation: 'Inventory searches protect the owner\'s property, protect the agency from claims, and protect officers. They must follow written, standardized procedures.',
    legalImplication: 'An inventory search that deviates from policy or is pretextual may be found unlawful.',
    category: 'search',
    keywords: ['tow impound', 'inventory', 'standardized procedures', 'pretext'],
  },

  // =========================================================================
  // CHAPTER: Digital Searches (expanded)
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Electronic Searches',
    topic: 'Social Media Searches',
    rule: 'Officers may view publicly available social media content without a warrant, but accessing private accounts, messages, or protected content requires a warrant or valid legal process.',
    explanation: 'Public posts on social media have no reasonable expectation of privacy. However, private messages, restricted profiles, and account data stored by the provider require legal process.',
    legalImplication: 'Accessing private social media content without a warrant may violate the Stored Communications Act and the Fourth Amendment.',
    category: 'search',
    keywords: ['social media', 'public content', 'private messages', 'warrant', 'Stored Communications Act'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Electronic Searches',
    topic: 'Geofence Warrants',
    rule: 'Geofence warrants requesting location data for all devices in a specified area during a specified time period must be narrowly tailored and supported by probable cause.',
    explanation: 'Geofence warrants are controversial because they initially sweep in data from all persons in an area, not just suspects. Courts require particularity and minimization procedures.',
    legalImplication: 'Overly broad geofence warrants may violate the Fourth Amendment and affected persons\' privacy rights.',
    category: 'search',
    keywords: ['geofence warrant', 'location data', 'particularity', 'minimization', 'privacy'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Electronic Searches',
    topic: 'Cloud Storage Search',
    rule: 'Searching cloud storage accounts requires a warrant or valid legal process directed at the service provider, as users maintain a reasonable expectation of privacy in cloud-stored data.',
    explanation: 'Cloud storage is treated similarly to physical storage for Fourth Amendment purposes. The warrant must describe the specific data sought with particularity.',
    legalImplication: 'Warrantless access to cloud storage violates the Fourth Amendment.',
    category: 'search',
    keywords: ['cloud storage', 'warrant', 'service provider', 'expectation of privacy'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Electronic Searches',
    topic: 'Biometric Data',
    rule: 'Compelling a suspect to provide biometric data (fingerprint, face scan) to unlock a device is a developing area of law. Officers should obtain a warrant specifically authorizing biometric access when possible.',
    explanation: 'While the Fifth Amendment may not protect biometric unlock (it\'s not testimonial), some courts have restricted compelled biometric access. Obtaining a warrant is the safest practice.',
    legalImplication: 'Compelled biometric device unlocking without a warrant may be challenged under the Fourth or Fifth Amendment.',
    category: 'search',
    keywords: ['biometric', 'fingerprint', 'face scan', 'device unlock', 'warrant'],
  },

  // =========================================================================
  // CHAPTER: Special Needs Searches
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Special Needs Searches',
    topic: 'Administrative Searches',
    rule: 'Administrative searches of regulated businesses may be conducted without a warrant when the regulatory scheme provides adequate substitute protections and the business is closely regulated.',
    explanation: 'The closely regulated industry exception applies to businesses such as liquor stores, firearms dealers, and auto junkyards that have reduced expectations of privacy.',
    legalImplication: 'Administrative searches of non-regulated businesses require a warrant or consent.',
    category: 'search',
    keywords: ['administrative search', 'regulated business', 'closely regulated', 'warrant exception'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Special Needs Searches',
    topic: 'Workplace Searches',
    rule: 'Government employer workplace searches are permissible when they are reasonable in inception and scope, under the special needs exception to the warrant requirement.',
    explanation: 'Per O\'Connor v. Ortega, government employers may search employee workspaces for work-related purposes when the search is reasonable under the circumstances.',
    legalImplication: 'A workplace search that exceeds the work-related purpose or is investigatory in nature may require a warrant.',
    category: 'search',
    keywords: ['workplace search', 'government employer', 'special needs', 'reasonable'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Special Needs Searches',
    topic: 'DUI Checkpoints',
    rule: 'DUI sobriety checkpoints are permissible under the Fourth Amendment if they follow established guidelines: supervisory decision to establish, neutral criteria for stopping vehicles, and adequate safety measures.',
    explanation: 'Per Michigan v. Sitz, the slight intrusion of a checkpoint is outweighed by the government\'s interest in preventing drunk driving. The checkpoint must be publicly visible and follow a plan.',
    legalImplication: 'A checkpoint that does not meet constitutional requirements may be found unlawful and evidence suppressed.',
    category: 'search',
    keywords: ['DUI checkpoint', 'sobriety checkpoint', 'neutral criteria', 'Michigan v Sitz'],
  },

  // =========================================================================
  // CHAPTER: Seizure of Persons
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Seizure of Persons',
    topic: 'Show of Authority Seizure',
    rule: 'A person is seized under the Fourth Amendment when an officer\'s show of authority causes the person to submit. If the person does not submit and flees, no seizure has occurred until physical force is applied.',
    explanation: 'Per California v. Hodari D., a seizure requires either physical force or submission to authority. Evidence abandoned during flight before seizure is not subject to the exclusionary rule.',
    legalImplication: 'Evidence discarded during flight before a seizure occurs is admissible as abandoned property.',
    category: 'search',
    keywords: ['seizure', 'show of authority', 'submission', 'Hodari D', 'flight'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Seizure of Persons',
    topic: 'Seizure of Property',
    rule: 'A seizure of property occurs when there is meaningful interference with a person\'s possessory interest. Officers must have legal authority before seizing property.',
    explanation: 'Property seizures are governed by the same Fourth Amendment standards as searches. Officers must have probable cause, a warrant, or a recognized exception.',
    legalImplication: 'An unlawful seizure of property may require return of the property and suppression of any evidence derived from it.',
    category: 'search',
    keywords: ['property seizure', 'possessory interest', 'meaningful interference', 'fourth amendment'],
  },

  // =========================================================================
  // CHAPTER: Exclusionary Rule Details
  // =========================================================================
  {
    source: 'POST LD-16',
    chapter: 'Exclusionary Rule',
    topic: 'Fruit of the Poisonous Tree',
    rule: 'Under the fruit of the poisonous tree doctrine, evidence derived from an initial constitutional violation is also subject to suppression, unless an exception applies.',
    explanation: 'The doctrine extends the exclusionary rule to evidence that is the indirect product of an illegal search or seizure. Exceptions include independent source, inevitable discovery, and attenuation.',
    legalImplication: 'Both direct and derivative evidence may be suppressed when obtained through a constitutional violation.',
    category: 'search',
    keywords: ['fruit of poisonous tree', 'derivative evidence', 'exclusionary rule', 'suppression'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Exclusionary Rule',
    topic: 'Attenuation Doctrine',
    rule: 'Evidence may be admissible despite a prior constitutional violation if the connection between the violation and the evidence is sufficiently attenuated by intervening circumstances.',
    explanation: 'Per Utah v. Strieff, factors include the temporal proximity between the violation and evidence discovery, intervening circumstances, and the purpose and flagrancy of the misconduct.',
    legalImplication: 'The attenuation doctrine may save evidence that would otherwise be suppressed as fruit of the poisonous tree.',
    category: 'search',
    keywords: ['attenuation', 'intervening circumstances', 'Utah v Strieff', 'exclusionary rule'],
  },
  {
    source: 'POST LD-16',
    chapter: 'Exclusionary Rule',
    topic: 'Independent Source Doctrine',
    rule: 'Evidence obtained through an independent source untainted by the constitutional violation is admissible, even if the same evidence was also discovered through the illegal search.',
    explanation: 'If officers had an independent, lawful basis for obtaining the evidence, the exclusionary rule does not apply to that independent discovery.',
    legalImplication: 'The independent source doctrine prevents exclusion when a lawful alternative path to the evidence exists.',
    category: 'search',
    keywords: ['independent source', 'untainted', 'lawful basis', 'exclusionary rule'],
  },
];
