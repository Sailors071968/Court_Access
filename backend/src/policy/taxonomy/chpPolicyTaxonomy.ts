/**
 * Phase 1-2: CHP Policy Taxonomy — 18 Normalized Categories
 *
 * Canonical taxonomy derived from ~1,956 CHP (California Highway Patrol) policy documents.
 * Each category contains:
 *   - category key (enum-safe)
 *   - display name
 *   - description
 *   - keywords (used for topic matching)
 *   - known CHP policy references (HPM numbers)
 *   - expected topics within the category
 */

// ---------------------------------------------------------------------------
// Category enum — 18 canonical policy categories
// ---------------------------------------------------------------------------

export const POLICY_CATEGORIES = [
  'Use_of_Force',
  'Officer_Conduct',
  'Internal_Affairs',
  'Discipline',
  'Arrest',
  'Search_Seizure',
  'Pursuit',
  'Body_Camera',
  'Evidence_Handling',
  'Interrogation',
  'Traffic',
  'Training',
  'Informants',
  'Records',
  'Custody',
  'OIS',
  'Critical_Incident',
  'Special_Units',
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Category definition — keywords, CHP references, expected topics
// ---------------------------------------------------------------------------

export interface CategoryDefinition {
  category: PolicyCategory;
  displayName: string;
  description: string;
  keywords: string[];
  chpReferences: string[];
  expectedTopics: string[];
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    category: 'Use_of_Force',
    displayName: 'Use of Force Policies',
    description: 'Policies governing when and how officers may use physical force, deadly force, less-lethal weapons, and force reporting requirements.',
    keywords: [
      'use of force', 'force continuum', 'deadly force', 'less lethal',
      'taser', 'chokehold', 'carotid restraint', 'baton', 'pepper spray',
      'OC spray', 'force options', 'de-escalation', 'force reporting',
      'proportional force', 'reasonable force', 'neck restraint',
      'lateral vascular', 'bean bag', 'rubber bullet', '40mm',
      'force review board', 'excessive force',
    ],
    chpReferences: ['HPM 100.68', 'HPM 70.16'],
    expectedTopics: [
      'Deadly Force Authorization',
      'Less-Lethal Weapons Deployment',
      'Force Continuum / Force Options',
      'De-Escalation Requirements',
      'Chokehold / Neck Restraint Ban',
      'Taser / CEW Policy',
      'OC Spray / Chemical Agents',
      'Baton Use Guidelines',
      'Force Reporting Requirements',
      'Force Review Board Process',
      'Duty to Intervene',
      'Warning Requirements Before Force',
    ],
  },
  {
    category: 'Officer_Conduct',
    displayName: 'Officer Conduct Policies',
    description: 'Standards of conduct, ethics, bias-free policing, off-duty behavior, social media, and professional standards.',
    keywords: [
      'officer conduct', 'ethics', 'code of conduct', 'bias policing',
      'racial profiling', 'professional standards', 'off-duty conduct',
      'social media', 'courtesy', 'impartiality', 'conflict of interest',
      'gratuities', 'secondary employment', 'moonlighting',
      'truthfulness', 'Brady officer', 'moral turpitude',
    ],
    chpReferences: ['HPM 10.2', 'HPM 10.3'],
    expectedTopics: [
      'Code of Ethics / Standards of Conduct',
      'Bias-Free Policing / Racial Profiling Prohibition',
      'Social Media Policy',
      'Off-Duty Conduct Standards',
      'Conflict of Interest / Gratuities',
      'Truthfulness / Brady Disclosure Obligations',
      'Secondary Employment Rules',
      'Courtesy and Professionalism',
    ],
  },
  {
    category: 'Internal_Affairs',
    displayName: 'Internal Affairs Policies',
    description: 'Internal investigations, citizen complaints, misconduct investigations, Pitchess motions, and complaint tracking.',
    keywords: [
      'internal affairs', 'complaints', 'misconduct investigations',
      'discipline review', 'citizen complaint', 'IA investigation',
      'Pitchess', 'personnel complaint', 'administrative investigation',
      'sustained finding', 'exonerated', 'unfounded', 'not sustained',
      'complaint intake', 'anonymous complaint', 'early warning system',
      'peace officer bill of rights', 'POBR', 'Lybarger warning',
    ],
    chpReferences: ['HPM 70.5', 'HPM 70.6'],
    expectedTopics: [
      'Citizen Complaint Intake Process',
      'Internal Investigation Procedures',
      'Administrative vs Criminal Investigations',
      'Pitchess Motion Compliance',
      'Sustained / Exonerated / Unfounded Findings',
      'POBR (Peace Officer Bill of Rights) Compliance',
      'Early Warning System / At-Risk Officer Tracking',
      'Anonymous Complaint Processing',
      'Investigation Timeline Requirements',
      'Witness Interview Procedures (IA)',
    ],
  },
  {
    category: 'Discipline',
    displayName: 'Discipline and Penalty Matrices',
    description: 'Progressive discipline systems, penalty guidelines, suspension, termination, Skelly hearings, and appeal processes.',
    keywords: [
      'discipline matrix', 'penalty guidelines', 'termination policy',
      'progressive discipline', 'suspension', 'demotion', 'written reprimand',
      'Skelly hearing', 'adverse action', 'letter of reprimand',
      'corrective action', 'penalty range', 'mitigating factors',
      'aggravating factors', 'arbitration', 'grievance',
    ],
    chpReferences: ['HPM 70.7', 'HPM 70.8'],
    expectedTopics: [
      'Progressive Discipline Framework',
      'Penalty Matrix / Penalty Guidelines',
      'Skelly Hearing Procedures',
      'Suspension and Demotion Standards',
      'Termination Criteria and Process',
      'Mitigating / Aggravating Factors',
      'Grievance and Appeal Process',
      'Written Reprimand Standards',
    ],
  },
  {
    category: 'Arrest',
    displayName: 'Arrest Procedures',
    description: 'Arrest authority, probable cause standards, custodial procedures, booking, cite-and-release, and arrest documentation.',
    keywords: [
      'arrest procedures', 'probable cause', 'custody procedures',
      'booking', 'cite and release', 'warrantless arrest', 'arrest warrant',
      'Miranda', 'custodial arrest', 'detention', 'Terry stop',
      'reasonable suspicion', 'handcuffing', 'transport', 'field interview',
    ],
    chpReferences: ['HPM 81.4', 'HPM 81.6'],
    expectedTopics: [
      'Arrest Authority and Standards',
      'Probable Cause Determination',
      'Warrantless Arrest Procedures',
      'Cite-and-Release Policy',
      'Custodial Arrest and Transport',
      'Handcuffing and Restraint During Arrest',
      'Arrest Documentation Requirements',
      'Juvenile Arrest Procedures',
    ],
  },
  {
    category: 'Search_Seizure',
    displayName: 'Search and Seizure Policies',
    description: 'Search warrant procedures, consent searches, vehicle searches, digital evidence seizure, and Fourth Amendment compliance.',
    keywords: [
      'search warrant', 'consent search', 'probable cause search',
      'vehicle search', 'pat down', 'frisk', 'plain view', 'search incident',
      'exigent circumstances', 'inventory search', 'strip search',
      'body cavity search', 'digital evidence', 'cell phone search',
      'Riley', 'Chimel', 'Carroll doctrine', 'knock and announce',
    ],
    chpReferences: ['HPM 81.2', 'HPM 81.3'],
    expectedTopics: [
      'Search Warrant Procedures',
      'Consent Search Protocols',
      'Vehicle Search Authority',
      'Stop-and-Frisk / Pat Down Standards',
      'Digital Device Search Requirements',
      'Strip Search / Body Cavity Search Restrictions',
      'Plain View Doctrine Application',
      'Exigent Circumstances Searches',
      'Inventory Search Procedures',
    ],
  },
  {
    category: 'Pursuit',
    displayName: 'Pursuit Policies',
    description: 'Vehicle pursuit authorization, pursuit termination, intervention techniques, PIT maneuver, spike strips, and pursuit reporting.',
    keywords: [
      'vehicle pursuit', 'high speed pursuit', 'pursuit termination',
      'PIT maneuver', 'spike strips', 'tire deflation', 'pursuit policy',
      'emergency driving', 'code three', 'rolling roadblock',
      'pursuit supervisor', 'pursuit review', 'pursuit reporting',
      'air support pursuit', 'helicopter pursuit', 'terminate pursuit',
    ],
    chpReferences: ['HPM 100.68', 'HPM 100.23'],
    expectedTopics: [
      'Pursuit Authorization Standards',
      'Pursuit Termination Criteria',
      'PIT Maneuver Authorization',
      'Spike Strip / Tire Deflation Policy',
      'Pursuit Supervisor Responsibilities',
      'Emergency Vehicle Operation',
      'Pursuit Reporting Requirements',
      'Air Support During Pursuits',
      'Inter-Agency Pursuit Coordination',
    ],
  },
  {
    category: 'Body_Camera',
    displayName: 'Body Camera Policies',
    description: 'Body-worn camera activation, recording retention, review policies, footage release, and BWC program management.',
    keywords: [
      'body camera', 'BWC', 'body worn camera', 'camera activation',
      'recording retention', 'footage review', 'dashcam', 'in-car camera',
      'video evidence', 'camera deactivation', 'buffering', 'footage release',
      'public records video', 'redaction', 'camera assignment',
    ],
    chpReferences: ['HPM 100.71'],
    expectedTopics: [
      'BWC Activation Requirements',
      'BWC Deactivation Rules',
      'Recording Retention Periods',
      'Officer Review of Footage Before Reports',
      'Supervisor Review of BWC Footage',
      'Footage Release and Public Records',
      'Redaction Procedures',
      'In-Car Camera (Dashcam) Policy',
      'Camera Equipment Assignment and Maintenance',
    ],
  },
  {
    category: 'Evidence_Handling',
    displayName: 'Evidence Handling Policies',
    description: 'Evidence collection, chain of custody, property room management, digital evidence preservation, and evidence disposal.',
    keywords: [
      'evidence collection', 'chain of custody', 'property room',
      'digital evidence', 'evidence storage', 'evidence disposal',
      'evidence log', 'forensic evidence', 'crime scene', 'DNA evidence',
      'biological evidence', 'firearms evidence', 'narcotics evidence',
      'evidence technician', 'evidence audit',
    ],
    chpReferences: ['HPM 81.8', 'HPM 81.9'],
    expectedTopics: [
      'Evidence Collection Procedures',
      'Chain of Custody Protocols',
      'Property Room Management',
      'Digital Evidence Preservation',
      'Biological / DNA Evidence Handling',
      'Firearms Evidence Processing',
      'Narcotics Evidence Storage',
      'Evidence Disposal / Destruction',
      'Evidence Audit Requirements',
    ],
  },
  {
    category: 'Interrogation',
    displayName: 'Interrogation Policies',
    description: 'Interview and interrogation procedures, Miranda warnings, recording requirements, juveniles, and constitutional protections.',
    keywords: [
      'interview procedures', 'custodial interrogation', 'Miranda warnings',
      'interrogation recording', 'Reid technique', 'deception in interrogation',
      'juvenile interrogation', 'interpreter', 'confession',
      'voluntary statement', 'involuntary confession', 'coerced statement',
      'right to counsel', 'right to silence', 'invocation of rights',
    ],
    chpReferences: ['HPM 81.4'],
    expectedTopics: [
      'Miranda Warning Procedures',
      'Custodial Interrogation Recording Requirements',
      'Juvenile Interview Protections',
      'Right to Counsel Procedures',
      'Voluntary Statement Documentation',
      'Interpreter / Language Access During Interviews',
      'Deception in Interrogation Guidelines',
    ],
  },
  {
    category: 'Traffic',
    displayName: 'Traffic Enforcement Policies',
    description: 'Traffic stops, DUI enforcement, sobriety checkpoints, citations, speed enforcement, and traffic collision investigation.',
    keywords: [
      'traffic stop', 'DUI enforcement', 'sobriety checkpoints',
      'traffic citation', 'speed enforcement', 'traffic collision',
      'accident investigation', 'radar', 'lidar', 'breathalyzer',
      'field sobriety test', 'implied consent', 'license check',
      'commercial vehicle inspection', 'hit and run', 'fatality investigation',
    ],
    chpReferences: ['HPM 100.1', 'HPM 100.2', 'HPM 100.3', 'HPM 100.61'],
    expectedTopics: [
      'Traffic Stop Procedures',
      'DUI Enforcement and FST Protocols',
      'Sobriety Checkpoint Authorization',
      'Speed Enforcement (Radar/Lidar)',
      'Traffic Citation Issuance',
      'Traffic Collision Investigation',
      'Hit-and-Run Investigation',
      'Fatality Investigation Procedures',
      'Commercial Vehicle Enforcement',
    ],
  },
  {
    category: 'Training',
    displayName: 'Training Policies',
    description: 'Academy training, in-service training, de-escalation training, use of force training, firearms qualification, and CPT requirements.',
    keywords: [
      'training requirements', 'academy training', 'de-escalation training',
      'firearms qualification', 'CPT', 'continuing professional training',
      'field training officer', 'FTO', 'PTO', 'POST certification',
      'annual training', 'scenario training', 'defensive tactics',
      'first aid training', 'crisis intervention', 'CIT',
    ],
    chpReferences: ['HPM 70.10', 'HPM 70.11'],
    expectedTopics: [
      'Academy Training Standards',
      'Field Training Officer (FTO) Program',
      'Continuing Professional Training (CPT)',
      'De-Escalation Training Requirements',
      'Firearms Qualification Standards',
      'Defensive Tactics Training',
      'Crisis Intervention Training (CIT)',
      'First Aid / CPR Training',
      'POST Certification Compliance',
      'Use of Force Training Curriculum',
    ],
  },
  {
    category: 'Informants',
    displayName: 'Use of Informants',
    description: 'Confidential informant management, informant reliability, payments, juvenile informants, and informant documentation.',
    keywords: [
      'confidential informant', 'informant management', 'informant reliability',
      'CI', 'snitch', 'informant payment', 'informant file',
      'informant agreement', 'juvenile informant', 'unwitting informant',
      'informant supervisor', 'informant meeting', 'informant debrief',
    ],
    chpReferences: ['HPM 81.12'],
    expectedTopics: [
      'Confidential Informant Registration',
      'Informant Reliability Assessment',
      'Informant Payment / Compensation',
      'Juvenile Informant Restrictions',
      'Informant File Management',
      'Supervisor Approval for CI Operations',
      'Informant Meeting Protocols',
    ],
  },
  {
    category: 'Records',
    displayName: 'Records and Transparency',
    description: 'Public records requests, CPRA compliance, Brady list management, Giglio disclosures, records retention, and transparency.',
    keywords: [
      'public records', 'CPRA', 'California Public Records Act',
      'Brady list', 'Giglio disclosure', 'records retention',
      'transparency', 'FOIA', 'records request', 'body camera release',
      'SB 1421', 'SB 16', 'peace officer records', 'personnel records',
      'Pitchess records', 'disclosure', 'redaction',
    ],
    chpReferences: ['HPM 70.12', 'HPM 11.1'],
    expectedTopics: [
      'CPRA (California Public Records Act) Compliance',
      'Brady / Giglio Disclosure Obligations',
      'SB 1421 / SB 16 Records Disclosure',
      'Records Retention Schedule',
      'Public Records Request Processing',
      'Personnel Records Access (Pitchess)',
      'Body Camera Footage Release',
      'Redaction Procedures for Public Release',
    ],
  },
  {
    category: 'Custody',
    displayName: 'Custody and Jail Procedures',
    description: 'Holding cell procedures, detainee treatment, custody monitoring, medical screening, and prisoner transport.',
    keywords: [
      'holding cell', 'detainee treatment', 'custody monitoring',
      'jail procedures', 'prisoner transport', 'medical screening',
      'intake screening', 'suicide watch', 'mental health custody',
      'cell check', 'strip search custody', 'segregation',
      'visitation', 'commissary', 'inmate grievance',
    ],
    chpReferences: ['HPM 81.10'],
    expectedTopics: [
      'Holding Cell / Temporary Detention Standards',
      'Detainee Medical Screening',
      'Suicide Prevention in Custody',
      'Prisoner Transport Procedures',
      'Detainee Rights and Treatment',
      'Cell Check Frequency Requirements',
      'Mental Health Crisis in Custody',
    ],
  },
  {
    category: 'OIS',
    displayName: 'Officer-Involved Shooting',
    description: 'OIS investigation procedures, shooting review boards, involved officer protocols, independent investigation requirements.',
    keywords: [
      'officer involved shooting', 'OIS', 'critical incident',
      'shooting review', 'shooting investigation', 'shooting review board',
      'involved officer statement', 'compelled statement',
      'independent investigation', 'walkthrough', 'scene management',
      'public integrity', 'district attorney review',
    ],
    chpReferences: ['HPM 70.16', 'HPM 100.68'],
    expectedTopics: [
      'OIS Investigation Procedures',
      'Shooting Review Board Process',
      'Involved Officer Post-Shooting Protocol',
      'Compelled vs Voluntary Statements',
      'Independent Investigation Requirements',
      'Scene Management After OIS',
      'District Attorney Review of OIS',
      'Public Notification After OIS',
    ],
  },
  {
    category: 'Critical_Incident',
    displayName: 'Critical Incident Response',
    description: 'Major incident management, SWAT deployment, active shooter response, mass casualty, and emergency operations.',
    keywords: [
      'critical incident', 'major incident', 'SWAT deployment',
      'active shooter', 'mass casualty', 'emergency operations',
      'incident command', 'ICS', 'NIMS', 'tactical operations',
      'hostage negotiation', 'barricaded subject', 'bomb threat',
      'terrorism', 'natural disaster', 'evacuation', 'mutual aid',
    ],
    chpReferences: ['HPM 100.62', 'HPM 100.63'],
    expectedTopics: [
      'Active Shooter Response Protocol',
      'SWAT Deployment Criteria',
      'Incident Command System (ICS) Procedures',
      'Hostage / Barricaded Subject Protocols',
      'Mass Casualty Incident Response',
      'Bomb Threat Procedures',
      'Mutual Aid Coordination',
      'Emergency Operations Center Activation',
    ],
  },
  {
    category: 'Special_Units',
    displayName: 'Special Units',
    description: 'K-9 operations, SWAT, bomb squad, narcotics units, gang enforcement, task forces, and specialized unit procedures.',
    keywords: [
      'K9', 'K-9', 'canine', 'SWAT', 'bomb squad', 'EOD',
      'narcotics unit', 'gang enforcement', 'task force',
      'undercover', 'surveillance', 'special operations',
      'aviation', 'marine unit', 'mounted unit', 'motorcycle unit',
      'detective bureau', 'crime lab', 'forensics unit',
    ],
    chpReferences: ['HPM 100.65', 'HPM 100.67'],
    expectedTopics: [
      'K-9 Unit Deployment and Bite Protocols',
      'SWAT Team Composition and Deployment',
      'Narcotics Unit Operations',
      'Gang Enforcement Procedures',
      'Undercover Operations Guidelines',
      'Bomb Squad / EOD Procedures',
      'Aviation / Air Operations',
      'Task Force Participation Protocols',
    ],
  },
];

// ---------------------------------------------------------------------------
// Flat keyword lookup map — category -> all keywords
// ---------------------------------------------------------------------------

export function buildKeywordCategoryMap(): Map<string, PolicyCategory> {
  const map = new Map<string, PolicyCategory>();
  for (const def of CATEGORY_DEFINITIONS) {
    for (const kw of def.keywords) {
      map.set(kw.toLowerCase(), def.category);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// All expected topics flattened with category info
// ---------------------------------------------------------------------------

export interface FlatTopic {
  topicName: string;
  category: PolicyCategory;
  keywords: string[];
  description: string;
  chpReferences: string[];
}

export function getAllExpectedTopics(): FlatTopic[] {
  const topics: FlatTopic[] = [];
  for (const def of CATEGORY_DEFINITIONS) {
    for (const topicName of def.expectedTopics) {
      topics.push({
        topicName,
        category: def.category,
        keywords: def.keywords,
        description: def.description,
        chpReferences: def.chpReferences,
      });
    }
  }
  return topics;
}

// ---------------------------------------------------------------------------
// Count summary
// ---------------------------------------------------------------------------

export function getTaxonomySummary(): {
  totalCategories: number;
  totalTopics: number;
  topicsByCategory: Record<string, number>;
} {
  const topicsByCategory: Record<string, number> = {};
  let totalTopics = 0;
  for (const def of CATEGORY_DEFINITIONS) {
    topicsByCategory[def.category] = def.expectedTopics.length;
    totalTopics += def.expectedTopics.length;
  }
  return {
    totalCategories: CATEGORY_DEFINITIONS.length,
    totalTopics,
    topicsByCategory,
  };
}
