// ============================================================================
// Phase 159 — Compliance Engine Test Dataset
// 50 test cases covering:
//   - Public police bodycam footage scenarios
//   - Training scenario footage
//   - Sample arrest reports
//   - Sample police reports
// Each includes: evidence text, incident narrative, agency, expected policy refs
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationTestCase {
  testCaseId: string;
  title: string;
  sourceType: 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report';
  agencyId: string;
  agencyName: string;
  incidentNarrative: string;
  evidenceText: string;
  expectedEvents: ExpectedEvent[];
  expectedPolicyReferences: string[];
  expectedFindingCount: { min: number; max: number };
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'use_of_force' | 'pursuit' | 'search_seizure' | 'arrest' | 'interrogation' | 'officer_conduct' | 'custody' | 'mixed';
}

export interface ExpectedEvent {
  eventType: string;
  shouldDetect: boolean;
  timestamp?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// 50 Test Cases
// ---------------------------------------------------------------------------

export const VALIDATION_DATASET: ValidationTestCase[] = [
  // =========================================================================
  // USE OF FORCE SCENARIOS (Cases 1-10)
  // =========================================================================
  {
    testCaseId: 'VAL-001',
    title: 'Taser Deployment During Traffic Stop',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer conducts traffic stop. Driver becomes non-compliant and exits vehicle aggressively. Officer deploys taser after verbal warnings.',
    evidenceText: `00:00:15 Officer: License and registration please.
00:00:45 Officer: Sir, step back in your vehicle.
00:01:10 Officer: Stop right there. Don't move.
00:01:20 Officer: Put your hands up. Show me your hands.
00:01:35 Officer: This is your last warning. I will deploy my taser.
00:01:42 Officer: Taser! Taser! Taser! [taser deployed]
00:01:50 Subject taken to ground. Suspect restrained.
00:02:05 Officer: Are you hurt? Do you need medical attention?
00:02:15 Officer applied handcuffs. Subject placed in cuffs.
00:02:30 Officer: Dispatch, requesting medical to my location.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true, timestamp: '00:01:10' },
      { eventType: 'uof_warning', shouldDetect: true, timestamp: '00:01:35' },
      { eventType: 'taser_deployed', shouldDetect: true, timestamp: '00:01:42' },
      { eventType: 'suspect_restrained', shouldDetect: true, timestamp: '00:01:50' },
      { eventType: 'handcuffing', shouldDetect: true, timestamp: '00:02:15' },
      { eventType: 'medical_attention', shouldDetect: true, timestamp: '00:02:30' },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 1, max: 5 },
    difficulty: 'easy',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-002',
    title: 'Prone Restraint with Subject Distress',
    sourceType: 'bodycam',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officers respond to disturbance. Subject is placed in prone restraint position. Subject expresses difficulty breathing.',
    evidenceText: `00:03:00 Officer: Get on the ground! On your stomach!
00:03:15 Subject placed face down on ground in prone position.
00:03:25 Officer: Stop resisting! Relax!
00:03:40 Subject: I can't breathe! Please stop!
00:03:55 Officer: You need to calm down. Stop resisting.
00:04:10 Subject: I can't breathe, please help me.
00:04:25 Officer: Turn him on his side. Get him off his stomach.
00:04:35 Officer applied handcuffs. Suspect restrained in side position.
00:04:50 Officer: Call paramedic. We need medical here now.
00:05:00 Officer: Ambulance requested. Subject complaining of breathing difficulty.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'prone_restraint', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 6 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-003',
    title: 'Neck Restraint Application',
    sourceType: 'bodycam',
    agencyId: 'agency-sfpd',
    agencyName: 'San Francisco Police Department',
    incidentNarrative: 'SFPD — Officer applies neck restraint during altercation with combative subject. Chokehold lasts approximately 15 seconds.',
    evidenceText: `00:00:30 Officer: Drop the weapon! Drop it now!
00:00:45 Subject swings at officer. Physical strike attempted by subject.
00:00:55 Officer takes subject to ground with control hold. Subject restrained.
00:01:05 Officer applies lateral vascular neck restraint for approximately 15 seconds.
00:01:20 Subject becomes compliant. Neck hold released.
00:01:30 Officer: Are you okay? Can you breathe?
00:01:45 Handcuffs applied. Subject placed in cuffs.
00:02:00 Officer requests medical to scene. Paramedic dispatched.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'neck_restraint', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 6 },
    difficulty: 'easy',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-004',
    title: 'Pepper Spray Deployment at Protest',
    sourceType: 'bodycam',
    agencyId: 'agency-oakpd',
    agencyName: 'Oakland Police Department',
    incidentNarrative: 'Oakland Police — Officers deploy OC spray during crowd control situation. Multiple subjects affected.',
    evidenceText: `00:05:00 Officer: Move back! Clear the intersection!
00:05:20 Crowd advances toward police line. Officer proximity to subjects decreasing.
00:05:35 Officer: This is your final warning. Disperse now.
00:05:50 Deploying OC spray. Pepper spray deployed toward advancing group.
00:06:00 Multiple subjects affected. Chemical agent dispersed.
00:06:15 Officer: Medics, we have subjects needing decontamination.
00:06:30 First aid being administered to affected persons. Medical attention provided.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'uof_warning', shouldDetect: true },
      { eventType: 'pepper_spray', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 1, max: 4 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-005',
    title: 'Officer-Involved Shooting',
    sourceType: 'bodycam',
    agencyId: 'agency-sdpd',
    agencyName: 'San Diego Police Department',
    incidentNarrative: 'SDPD — Officer fires weapon at armed subject during confrontation. Subject had previously pointed firearm at officers.',
    evidenceText: `00:00:10 Officer: Police! Drop the gun! Drop the weapon!
00:00:20 Subject raises firearm toward officers. Weapon drawn by officer.
00:00:25 Officer drew sidearm. Gun drawn and pointed at subject.
00:00:30 Shots fired! Officer discharged firearm. Three rounds fired.
00:00:35 Subject down. Officer: Cease fire, cease fire.
00:00:45 Officer: Suspect is down. Need medical NOW. Ambulance requested.
00:01:00 Officer: Secure the weapon. Applying first aid to subject.
00:01:15 CPR being administered by officer while waiting for paramedics.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'shots_fired', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 5 },
    difficulty: 'easy',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-006',
    title: 'Baton Strike During Arrest',
    sourceType: 'bodycam',
    agencyId: 'agency-sjpd',
    agencyName: 'San Jose Police Department',
    incidentNarrative: 'San Jose Police — Officer uses baton during arrest of resisting subject. Impact weapon deployed to legs.',
    evidenceText: `00:02:00 Officer: Get on the ground! You are under arrest.
00:02:15 Subject pulls away. Officer: Stop resisting!
00:02:25 Officer deploys baton. Baton strike delivered to subject's thigh.
00:02:30 Impact weapon used on lower extremity. Subject struck.
00:02:40 Subject goes to ground. Suspect restrained.
00:02:50 Officer applies restraints. Handcuffed subject.
00:03:00 Officer: Do you need medical? Paramedic is on the way.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'baton_strike', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 6 },
    difficulty: 'easy',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-007',
    title: 'K-9 Deployment During Suspect Search',
    sourceType: 'bodycam',
    agencyId: 'agency-sacpd',
    agencyName: 'Sacramento Police Department',
    incidentNarrative: 'Sacramento Police — K-9 unit deployed to track fleeing suspect. Canine locates and apprehends subject.',
    evidenceText: `00:10:00 Officer: Suspect fled on foot. Initiating foot pursuit.
00:10:30 Officer: Deploying K-9 unit. Police dog is being released.
00:10:45 K-9 handler: Find him! Canine deployed to track suspect.
00:11:00 K-9 tracks suspect behind building. Dog deployed successfully.
00:11:15 K-9 apprehends suspect. Subject held down by canine.
00:11:30 Officer: Call off the dog. Subject is restrained.
00:11:45 Medical attention needed. K-9 bite to left arm. Requesting ambulance.
00:12:00 Officer applies handcuffs. First aid administered to bite wound.`,
    expectedEvents: [
      { eventType: 'foot_pursuit', shouldDetect: true },
      { eventType: 'k9_deployment', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 1, max: 4 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-008',
    title: 'De-escalation Success — No Force Used',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer successfully de-escalates confrontation with agitated subject. No force deployed.',
    evidenceText: `00:00:00 Officer approaches subject at gas station. Officer moved toward individual.
00:00:30 Officer: Hey, can we talk? I understand you are upset.
00:01:00 Officer: Let's calm down and work this out. Nobody needs to get hurt.
00:01:30 Officer: I'm here to help you. Take a deep breath.
00:02:00 Subject begins to calm down. Officer: That's good, just relax.
00:02:30 Officer: We can resolve this peacefully. I understand your frustration.
00:03:00 Subject cooperates voluntarily. No force used. No restraints applied.
00:03:30 Officer: Thank you for cooperating. Let me help you sort this out.`,
    expectedEvents: [
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'de_escalation_attempt', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'taser_deployed', shouldDetect: false, notes: 'Should NOT detect taser' },
      { eventType: 'physical_strike', shouldDetect: false, notes: 'Should NOT detect strike' },
      { eventType: 'weapon_drawn', shouldDetect: false, notes: 'Should NOT detect weapon drawn' },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-009',
    title: 'Multiple Force Escalation Steps',
    sourceType: 'transcript',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officer progresses through multiple force options: verbal commands, OC spray, then taser. Force continuum documented.',
    evidenceText: `00:00:00 Officer: Step out of the vehicle. Get out of the car.
00:00:30 Officer: This is your second warning. Comply now.
00:01:00 Officer: I am going to deploy OC spray if you do not comply.
00:01:15 OC spray deployed. Pepper spray discharged into vehicle.
00:01:30 Subject exits vehicle but continues resisting. Stop resisting!
00:01:45 Officer: Deploying taser. Taser! Taser! Taser!
00:01:50 Taser deployed. Subject taken to ground.
00:02:00 Subject handcuffed. Placed in cuffs.
00:02:15 Ambulance called. Medical attention being provided. First aid for OC exposure.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'uof_warning', shouldDetect: true },
      { eventType: 'pepper_spray', shouldDetect: true },
      { eventType: 'taser_deployed', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 7 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-010',
    title: 'Physical Strike Without Warning',
    sourceType: 'bodycam',
    agencyId: 'agency-fresno-pd',
    agencyName: 'Fresno Police Department',
    incidentNarrative: 'Fresno Police — Officer strikes subject without issuing verbal warnings first. No de-escalation attempted.',
    evidenceText: `00:00:10 Officer approaches suspect. Closed distance rapidly.
00:00:15 Officer punched subject in the face. Physical force applied.
00:00:20 Subject hit and taken to ground. Struck again while on ground.
00:00:25 Officer: Stay down! (said after physical strike)
00:00:30 Handcuffs applied immediately. Subject placed in cuffs.
00:00:45 Subject bleeding from face. No medical called for 5 minutes.`,
    expectedEvents: [
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true, notes: 'Verbal command came AFTER strike' },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'de_escalation_attempt', shouldDetect: false, notes: 'No de-escalation attempted' },
      { eventType: 'uof_warning', shouldDetect: false, notes: 'No use of force warning given' },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 2, max: 5 },
    difficulty: 'hard',
    category: 'use_of_force',
  },

  // =========================================================================
  // SEARCH & SEIZURE SCENARIOS (Cases 11-18)
  // =========================================================================
  {
    testCaseId: 'VAL-011',
    title: 'Vehicle Search Without Consent',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer conducts vehicle search during traffic stop. No consent obtained and no warrant present.',
    evidenceText: `00:05:00 Officer: I am going to search your vehicle.
00:05:10 Subject: I don't consent to any search.
00:05:20 Officer proceeds to search the car. Vehicle search commenced.
00:05:30 Officer searched trunk. Searched glove box as well.
00:05:45 Officer: Found nothing. Vehicle search completed.
00:06:00 Subject: I told you I don't consent. This is not authorized.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure'],
    expectedFindingCount: { min: 1, max: 3 },
    difficulty: 'easy',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-012',
    title: 'Pat Down / Terry Stop',
    sourceType: 'bodycam',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officer conducts a Terry stop and pat down of a pedestrian based on reasonable suspicion.',
    evidenceText: `00:00:00 Officer approaches pedestrian. Officer moved toward individual.
00:00:15 Officer: Can I ask you a few questions?
00:00:30 Officer: I need to pat you down for weapons. Terry stop initiated.
00:00:45 Officer conducted pat down. Frisked subject's outer clothing.
00:01:00 Officer: Clean. No weapons found. Patted down completely.
00:01:15 Officer: You are free to go. Have a good day.`,
    expectedEvents: [
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'easy',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-013',
    title: 'Consent Search of Residence',
    sourceType: 'police_report',
    agencyId: 'agency-sdpd',
    agencyName: 'San Diego Police Department',
    incidentNarrative: 'SDPD — Officers obtain verbal consent to search a residence. Consent documented in report.',
    evidenceText: `Officer Smith obtained verbal consent from homeowner J. Doe to search the residence at 1234 Main St.
Consent was freely given without coercion. Homeowner signed consent search form.
Search of the residence revealed no contraband or evidence.
Search commenced at 14:30 and concluded at 15:15.
All rooms were searched including the garage and backyard shed.
No warrant was obtained as consent was provided voluntarily.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: false, notes: 'Residence search, not vehicle' },
    ],
    expectedPolicyReferences: ['Search_Seizure'],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'medium',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-014',
    title: 'Warrant-Based Vehicle Search',
    sourceType: 'police_report',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officers execute a search warrant on a vehicle suspected in drug trafficking.',
    evidenceText: `Pursuant to search warrant SW-2026-1234, officers searched the vehicle (2024 Toyota Camry, license plate 8ABC123).
The warrant authorized search of the vehicle, trunk, and all containers within.
Officers searched the car systematically. Trunk search revealed 2kg of suspected narcotics.
Glove box contained paraphernalia. Vehicle search documented with photographs.
All items seized per warrant authority. Chain of custody maintained.
Vehicle impounded as evidence. Search warrant properly executed.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'easy',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-015',
    title: 'Exigent Circumstances Entry',
    sourceType: 'police_report',
    agencyId: 'agency-oakpd',
    agencyName: 'Oakland Police Department',
    incidentNarrative: 'Oakland Police — Officers enter residence without warrant under exigent circumstances — screaming heard from inside.',
    evidenceText: `At 0230 hours, officers responded to 567 Oak Ave regarding a domestic disturbance.
Upon arrival, officers heard screaming from inside the residence.
Under exigent circumstances, officers entered the residence without a warrant.
Officers searched the main floor and found victim with injuries.
Suspect was located in the back bedroom. Officers approached and closed distance.
Suspect restrained and placed in handcuffs without further incident.
Medical attention was provided to the victim. Ambulance dispatched.`,
    expectedEvents: [
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure', 'Arrest'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'medium',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-016',
    title: 'Plain View Doctrine Seizure',
    sourceType: 'bodycam',
    agencyId: 'agency-sjpd',
    agencyName: 'San Jose Police Department',
    incidentNarrative: 'San Jose Police — During a lawful traffic stop, officer observes contraband in plain view on the back seat.',
    evidenceText: `00:00:00 Officer: Good evening. The reason I pulled you over is a broken tail light.
00:00:30 Officer: License and registration please.
00:01:00 Officer observes clear plastic bag with white powder on back seat.
00:01:15 Officer: Sir, I can see what appears to be contraband on your back seat.
00:01:30 Officer: Please step out of the vehicle. Get out of the car.
00:01:45 Officer conducts pat down for officer safety. Frisked outer clothing.
00:02:00 Officer seizes visible contraband from back seat.
00:02:15 Subject placed in handcuffs. Placed under arrest.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure', 'Arrest'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'medium',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-017',
    title: 'Inventory Search of Impounded Vehicle',
    sourceType: 'police_report',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Following DUI arrest, officer conducts standard inventory search of vehicle before towing.',
    evidenceText: `Following the arrest of J. Smith for DUI, the vehicle (2023 Honda Civic) was impounded.
Per department policy, an inventory search was conducted prior to towing.
Officer searched the car per inventory checklist. Trunk search completed.
Glove box contained registration and insurance documents.
Personal items inventoried and documented on property receipt.
Vehicle towed to city impound lot. CHP Form 180 completed.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Search_Seizure'],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'easy',
    category: 'search_seizure',
  },
  {
    testCaseId: 'VAL-018',
    title: 'School Resource Officer Locker Search',
    sourceType: 'police_report',
    agencyId: 'agency-fresno-pd',
    agencyName: 'Fresno Police Department',
    incidentNarrative: 'Fresno Police — School resource officer assists in searching student locker based on school administrator request.',
    evidenceText: `School administrator Ms. Johnson requested SRO assistance with locker search.
Student locker #247 was opened by school custodian with master key.
SRO observed the search conducted by school staff.
Search of locker revealed no prohibited items.
Officer documented the search in daily activity log.
No arrest made. Student counseled by school administration.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: false, notes: 'Not a vehicle search' },
      { eventType: 'pat_down_search', shouldDetect: false, notes: 'Not a pat down' },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'hard',
    category: 'search_seizure',
  },

  // =========================================================================
  // ARREST & INTERROGATION SCENARIOS (Cases 19-28)
  // =========================================================================
  {
    testCaseId: 'VAL-019',
    title: 'Miranda Warning Before Custodial Interrogation',
    sourceType: 'audio',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer reads Miranda rights before questioning suspect in custody.',
    evidenceText: `00:00:00 Officer: Before I ask you any questions, I need to read you your rights.
00:00:10 Officer: You have the right to remain silent.
00:00:15 Officer: Anything you say can and will be used against you in a court of law.
00:00:25 Officer: You have the right to an attorney.
00:00:30 Officer: If you cannot afford an attorney, one will be appointed for you.
00:00:40 Officer: Do you understand these rights as I have read them to you?
00:00:50 Subject: Yes, I understand.
00:01:00 Officer: With these rights in mind, do you wish to speak to me?
00:01:10 Subject: Yes, I'll talk.`,
    expectedEvents: [
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Interrogation'],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'easy',
    category: 'interrogation',
  },
  {
    testCaseId: 'VAL-020',
    title: 'Custodial Interrogation Without Miranda',
    sourceType: 'audio',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Detective questions suspect in custody without administering Miranda warnings first.',
    evidenceText: `00:00:00 Detective: So tell me what happened last night.
00:00:30 Subject: I was at the bar and things got out of hand.
00:01:00 Detective: Did you hit the victim?
00:01:15 Subject: It was self-defense.
00:01:30 Detective: Who else was there? Give me names.
00:02:00 Subject: Can I have a lawyer? I want to talk to an attorney.
00:02:15 Detective: We'll get to that. First tell me about the weapon.
00:02:30 Subject: I want my right to an attorney. I'm not saying anything else.
00:02:45 Detective continued questioning despite request for attorney.`,
    expectedEvents: [
      { eventType: 'miranda_warning', shouldDetect: false, notes: 'Miranda NOT given — should be flagged' },
    ],
    expectedPolicyReferences: ['Interrogation'],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'hard',
    category: 'interrogation',
  },
  {
    testCaseId: 'VAL-021',
    title: 'Felony Traffic Stop Arrest',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — High-risk felony traffic stop with multiple officers. Driver ordered out at gunpoint.',
    evidenceText: `00:00:00 Officer: Driver, turn off the vehicle. Show me your hands!
00:00:15 Officer unholstered weapon. Firearm pointed at vehicle. Gun drawn.
00:00:30 Officer: Driver, open the door from the outside with your left hand.
00:00:45 Officer: Walk backward toward my voice. Get on your knees.
00:01:00 Subject complied. Officer approaches. Moved toward subject.
00:01:15 Officer: Hands behind your back. Handcuffs applied.
00:01:30 Officer: You are under arrest for vehicle theft. Pat down for weapons.
00:01:45 Officer patted down subject. Frisked clothing. Terry stop completed.
00:02:00 Officer: You have the right to remain silent. Anything you say can and will be used.
00:02:15 Officer reads full Miranda rights to arrestee.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Arrest', 'Interrogation'],
    expectedFindingCount: { min: 1, max: 4 },
    difficulty: 'medium',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-022',
    title: 'DUI Arrest with Field Sobriety Tests',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer conducts DUI stop, administers field sobriety tests, and arrests driver.',
    evidenceText: `00:00:00 Officer: Good evening. I noticed you were swerving. License and registration.
00:01:00 Officer: Have you been drinking tonight? I smell alcohol.
00:01:30 Officer: I need you to step out of the vehicle. Get out of the car.
00:02:00 Officer: I'm going to administer some field sobriety tests.
00:05:00 Officer: Based on the results, you are under arrest for DUI.
00:05:15 Officer: Turn around. Hands behind your back. Handcuffs applied.
00:05:30 Officer: You have the right to remain silent. Miranda rights read.
00:06:00 Officer: You have the right to an attorney. Do you understand?`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Arrest', 'Interrogation'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'easy',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-023',
    title: 'Resisting Arrest — Escalating Force',
    sourceType: 'bodycam',
    agencyId: 'agency-sfpd',
    agencyName: 'San Francisco Police Department',
    incidentNarrative: 'SFPD — Subject actively resists arrest. Officer escalates through verbal commands to physical control.',
    evidenceText: `00:00:00 Officer: You are under arrest. Turn around and put your hands behind your back.
00:00:15 Subject pulls away and begins running.
00:00:20 Officer initiates foot pursuit. Running after subject. Foot chase begins.
00:00:45 Officer catches subject. Physical altercation. Officer struck subject.
00:00:50 Subject taken to ground. Control hold applied. Held down and pinned.
00:01:00 Stop resisting! Calm down! Comply now!
00:01:15 Second officer arrives. Subject restrained by both officers.
00:01:30 Handcuffs applied. Subject placed in cuffs.
00:01:45 Officer: Are you injured? Do you need medical? Ambulance available.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'foot_pursuit', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Arrest'],
    expectedFindingCount: { min: 2, max: 6 },
    difficulty: 'medium',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-024',
    title: 'Juvenile Arrest Procedures',
    sourceType: 'police_report',
    agencyId: 'agency-sacpd',
    agencyName: 'Sacramento Police Department',
    incidentNarrative: 'Sacramento Police — Officer arrests 16-year-old juvenile for shoplifting. Must follow juvenile-specific procedures.',
    evidenceText: `Officer responded to Walmart for shoplifting call. Loss prevention detained a 16-year-old male.
Subject was taken into custody at 1430 hours. Handcuffed per protocol.
Miranda rights read to juvenile in presence of store manager.
You have the right to remain silent. Anything you say can and will be used.
Parent/guardian contacted at 1445 hours and informed of arrest.
Juvenile transported to juvenile hall. No force used during arrest.
Subject was cooperative throughout. No injuries to report.`,
    expectedEvents: [
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Arrest', 'Interrogation'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'medium',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-025',
    title: 'Domestic Violence Mandatory Arrest',
    sourceType: 'police_report',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officers respond to DV call. Evidence of injury requires mandatory arrest per CA Penal Code.',
    evidenceText: `Officers responded to 911 call for domestic disturbance at 789 Elm St.
Victim had visible bruising to left eye and abrasions on both arms.
Suspect J. Brown was still on scene. Officers approached suspect carefully.
Officer: Sir, turn around. You are under arrest for domestic battery.
Suspect complied. Handcuffs applied without resistance. Placed in cuffs.
Miranda rights administered. You have the right to remain silent.
Victim transported to hospital for medical evaluation. Medical attention provided.
Emergency protective order issued per department policy.`,
    expectedEvents: [
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Arrest', 'Interrogation'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'easy',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-026',
    title: 'Mental Health Crisis Response',
    sourceType: 'bodycam',
    agencyId: 'agency-sfpd',
    agencyName: 'San Francisco Police Department',
    incidentNarrative: 'SFPD — Officers respond to mental health crisis. Subject is armed with knife. CIT-trained officer leads response.',
    evidenceText: `00:00:00 Dispatch: 5150 in progress. Subject armed with a knife. Mental health crisis.
00:00:30 Officer: Sir, my name is Officer Chen. I'm here to help you. I understand you're upset.
00:01:00 Officer: Nobody needs to get hurt. Let's talk about this. We can resolve this.
00:01:30 Officer: Can you put the knife down for me? Take a deep breath.
00:02:00 Officer maintains distance. Keeping 20 feet away. Within safe distance.
00:02:30 Officer: I understand what you're going through. Let me help you.
00:03:00 Subject drops knife voluntarily.
00:03:15 Officer: Thank you. Let's get you some help. No arrest necessary.
00:03:30 Mental health team responding. Medical attention arranged for evaluation.`,
    expectedEvents: [
      { eventType: 'de_escalation_attempt', shouldDetect: true },
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
      { eventType: 'taser_deployed', shouldDetect: false, notes: 'No taser used' },
      { eventType: 'physical_strike', shouldDetect: false, notes: 'No force used' },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'medium',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-027',
    title: 'Witness Interview During Investigation',
    sourceType: 'audio',
    agencyId: 'agency-sdpd',
    agencyName: 'San Diego Police Department',
    incidentNarrative: 'SDPD — Detective interviews key witness to homicide. Non-custodial interview.',
    evidenceText: `00:00:00 Detective: Thank you for coming in. You are not under arrest.
00:00:15 Detective: You are free to leave at any time. This is voluntary.
00:00:30 Detective: Can you tell me what you saw on the night of March 1st?
00:01:00 Witness: I was walking my dog and I heard shouting from the alley.
00:02:00 Detective: Can you describe the individuals you saw?
00:03:00 Witness: One was wearing a dark hoodie, the other had a red jacket.
00:04:00 Detective: Did you see any weapons? Were there any threats?
00:04:30 Witness: I heard someone say "I'll shoot you" but I didn't see a gun.
00:05:00 Detective: Thank you. Here's my card if you remember anything else.`,
    expectedEvents: [
      { eventType: 'threat_language', shouldDetect: true, notes: 'From witness quote, not officer' },
      { eventType: 'miranda_warning', shouldDetect: false, notes: 'Non-custodial, no Miranda needed' },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'hard',
    category: 'interrogation',
  },
  {
    testCaseId: 'VAL-028',
    title: 'Booking Process at County Jail',
    sourceType: 'police_report',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer completes booking process at county jail following DUI arrest.',
    evidenceText: `Subject transported to county jail at 2200 hours.
Booking process initiated. Subject searched per booking protocol.
Pat down conducted. Personal property inventoried and secured. Patted down completely.
Subject placed in holding cell. Custody transfer completed.
Medical screening completed by jail nurse. Medical attention available.
Subject informed of right to make phone call. Right to an attorney.
Bail information provided. Arraignment scheduled for tomorrow 0900.`,
    expectedEvents: [
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Custody'],
    expectedFindingCount: { min: 0, max: 1 },
    difficulty: 'easy',
    category: 'custody',
  },

  // =========================================================================
  // VEHICLE PURSUIT SCENARIOS (Cases 29-34)
  // =========================================================================
  {
    testCaseId: 'VAL-029',
    title: 'High-Speed Vehicle Pursuit',
    sourceType: 'dashcam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP officer initiates pursuit of stolen vehicle on freeway. Speeds exceed 100mph.',
    evidenceText: `00:00:00 Officer: Dispatch, I have a stolen vehicle refusing to yield. Initiating vehicle pursuit.
00:00:30 Pursuit heading northbound on I-5. High speed chase in progress. Speeds 85mph.
00:01:00 Officer: Pursuit now at 100mph. Requesting additional units.
00:01:30 Officer: Vehicle pursuit continuing. Subject weaving through traffic.
00:02:00 Supervisor authorizes continuation of pursuit per policy.
00:02:30 Officer: Subject exiting freeway. Reducing speed. Pursuit continuing.
00:03:00 Subject vehicle loses control. Vehicle stops. Pursuit concluded.
00:03:15 Officer: Felony stop procedures. Show me your hands! Get out!
00:03:30 Driver exits vehicle. Get on the ground! Hands up!
00:03:45 Suspect handcuffed. Placed in cuffs without further incident.`,
    expectedEvents: [
      { eventType: 'vehicle_pursuit', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit'],
    expectedFindingCount: { min: 1, max: 4 },
    difficulty: 'easy',
    category: 'pursuit',
  },
  {
    testCaseId: 'VAL-030',
    title: 'Foot Pursuit Through Residential Area',
    sourceType: 'bodycam',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officer pursues fleeing burglary suspect on foot through residential neighborhood.',
    evidenceText: `00:00:00 Officer: Suspect is running! Foot pursuit initiated. Running after suspect.
00:00:15 Foot chase through residential area. Foot pursuit southbound on Oak St.
00:00:30 Officer: He's going over the fence. Continuing foot pursuit.
00:00:45 Officer: Suspect cornered in backyard. Don't move! Freeze!
00:01:00 Suspect complies. Get on the ground! Hands where I can see them.
00:01:15 Handcuffs applied. Subject placed in cuffs.
00:01:30 Officer: Dispatch, suspect in custody. Foot pursuit concluded.`,
    expectedEvents: [
      { eventType: 'foot_pursuit', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'easy',
    category: 'pursuit',
  },
  {
    testCaseId: 'VAL-031',
    title: 'Pursuit Termination — Safety Concerns',
    sourceType: 'dashcam',
    agencyId: 'agency-sfpd',
    agencyName: 'San Francisco Police Department',
    incidentNarrative: 'SFPD — Supervisor orders termination of vehicle pursuit due to pedestrian safety concerns in downtown area.',
    evidenceText: `00:00:00 Officer: Pursuing stolen vehicle eastbound on Market St. Vehicle pursuit in progress.
00:00:30 Vehicle pursuit heading into downtown area. High foot traffic.
00:01:00 Supervisor: Terminate pursuit. Too many pedestrians. Safety concerns.
00:01:15 Officer: Copy, terminating pursuit. Vehicle pursuit terminated.
00:01:30 Officer: Lost visual on suspect vehicle. Pursuit concluded.
00:01:45 Officer: Returning to normal patrol. No arrest made.`,
    expectedEvents: [
      { eventType: 'vehicle_pursuit', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'medium',
    category: 'pursuit',
  },
  {
    testCaseId: 'VAL-032',
    title: 'PIT Maneuver to End Pursuit',
    sourceType: 'dashcam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officer executes PIT maneuver to end prolonged vehicle pursuit after supervisor authorization.',
    evidenceText: `00:05:00 Vehicle pursuit now in 8th minute. Continuing at high speed.
00:05:30 Supervisor authorizes PIT maneuver to terminate pursuit.
00:06:00 Officer executes PIT. Pursuit vehicle spins and comes to rest.
00:06:15 Officer: Vehicle stopped. Felony stop procedures.
00:06:30 Officer: Get out of the vehicle! Show me your hands! Hands up!
00:06:45 Officer drew weapon. Gun drawn and covering suspect.
00:07:00 Subject exits vehicle. Get on the ground! On your knees!
00:07:15 Suspect handcuffed. Vehicle pursuit concluded with arrest.
00:07:30 Medical check on suspect. Are you injured? Ambulance standing by.`,
    expectedEvents: [
      { eventType: 'vehicle_pursuit', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit', 'Use_of_Force'],
    expectedFindingCount: { min: 1, max: 5 },
    difficulty: 'medium',
    category: 'pursuit',
  },
  {
    testCaseId: 'VAL-033',
    title: 'Unauthorized Pursuit — Policy Threshold Not Met',
    sourceType: 'dashcam',
    agencyId: 'agency-oakpd',
    agencyName: 'Oakland Police Department',
    incidentNarrative: 'Oakland Police — Officer initiates pursuit for minor traffic infraction without supervisor approval.',
    evidenceText: `00:00:00 Officer: Vehicle failed to signal lane change. Activating lights.
00:00:15 Subject does not yield. Vehicle pursuit for failure to yield.
00:00:30 Officer: Pursuing vehicle northbound. Car chase initiated.
00:00:45 Officer: Speed now 70 in 35 zone. High speed pursuit.
00:01:00 Dispatch: What is the reason for pursuit?
00:01:10 Officer: Failure to yield for traffic stop. Original violation was lane change.
00:01:30 Supervisor: Terminate pursuit. Infraction does not meet pursuit threshold.
00:01:45 Officer terminates pursuit per supervisor order.`,
    expectedEvents: [
      { eventType: 'vehicle_pursuit', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit'],
    expectedFindingCount: { min: 1, max: 3 },
    difficulty: 'hard',
    category: 'pursuit',
  },
  {
    testCaseId: 'VAL-034',
    title: 'Multi-Agency Pursuit Coordination',
    sourceType: 'dashcam',
    agencyId: 'agency-sdpd',
    agencyName: 'San Diego Police Department',
    incidentNarrative: 'SDPD — Vehicle pursuit crosses jurisdictions. CHP takes over primary pursuit role.',
    evidenceText: `00:00:00 Officer: Vehicle pursuit heading east on I-8. Pursuit from initial traffic stop.
00:01:00 Vehicle pursuit crossing into La Mesa jurisdiction. Car chase continuing.
00:01:30 CHP unit joining pursuit. Multi-jurisdiction pursuit protocols activated.
00:02:00 Officer: CHP is now primary pursuit unit. I'm going secondary.
00:02:30 Vehicle pursuit terminated by CHP at El Cajon city limits.
00:03:00 Suspect vehicle stopped. CHP officers conducting felony stop.
00:03:15 Show me your hands! Get on the ground! Don't move!
00:03:30 Suspect in custody. Handcuffs applied. Pursuit concluded safely.`,
    expectedEvents: [
      { eventType: 'vehicle_pursuit', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Pursuit'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'medium',
    category: 'pursuit',
  },

  // =========================================================================
  // OFFICER CONDUCT & MIXED SCENARIOS (Cases 35-50)
  // =========================================================================
  {
    testCaseId: 'VAL-035',
    title: 'Body Camera Activation Failure',
    sourceType: 'police_report',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officer fails to activate body camera prior to use of force incident.',
    evidenceText: `Supplemental Report: BWC Review
Officer Johnson responded to assault call at 2300 hours.
Body-worn camera was not activated until after physical contact with subject.
Officer restrained subject on arrival. Suspect restrained without camera footage.
Camera activation occurred at 2305 hours, approximately 3 minutes after force used.
Officer stated camera activation was forgotten in the urgency of the situation.
Supervisor review notes: BWC policy requires activation prior to contact.`,
    expectedEvents: [
      { eventType: 'suspect_restrained', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Body_Camera'],
    expectedFindingCount: { min: 0, max: 2 },
    difficulty: 'hard',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-036',
    title: 'Racial Profiling Complaint — Traffic Stop',
    sourceType: 'bodycam',
    agencyId: 'agency-oakpd',
    agencyName: 'Oakland Police Department',
    incidentNarrative: 'Oakland Police — Citizen files complaint alleging racial profiling during routine traffic stop.',
    evidenceText: `00:00:00 Officer: Good evening. License and registration please.
00:00:30 Driver: Why did you pull me over?
00:00:45 Officer: You have a broken tail light.
00:01:00 Driver: Is that really why you stopped me?
00:01:15 Officer: Yes sir, your right tail light is out. Here is your citation.
00:01:30 Officer: Drive safely and get that light fixed.
00:01:45 Stop concluded. No search conducted. No force used.`,
    expectedEvents: [
      { eventType: 'vehicle_search', shouldDetect: false },
      { eventType: 'handcuffing', shouldDetect: false },
      { eventType: 'weapon_drawn', shouldDetect: false },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'hard',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-037',
    title: 'Welfare Check — Subject with Firearm',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Officers respond to welfare check. Subject found with firearm. De-escalation attempted.',
    evidenceText: `00:00:00 Officer: Sir, are you okay? We received a call about you.
00:00:30 Subject has a firearm in hand. Weapon visible.
00:00:45 Officer: Sir, please put down the gun. Drop the weapon.
00:01:00 Officer drew sidearm as precaution. Gun drawn but kept at low ready.
00:01:15 Officer: We are here to help you. Nobody needs to get hurt. Let's talk.
00:01:30 Officer: I understand you're going through a tough time. Take a deep breath.
00:02:00 Subject places firearm on ground.
00:02:15 Officer: Thank you. We can resolve this. Let me get you help.
00:02:30 No arrest. Medical team responds. Ambulance for psychiatric evaluation.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'de_escalation_attempt', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'medium',
    category: 'mixed',
  },
  {
    testCaseId: 'VAL-038',
    title: 'Mass Casualty Incident Response',
    sourceType: 'bodycam',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officers respond to multi-vehicle collision. Triage and scene management.',
    evidenceText: `00:00:00 Officer: Dispatch, major MVA at intersection of 5th and Broadway.
00:00:30 Officer: Multiple vehicles involved. Requesting all available medical units.
00:01:00 Officer: Beginning triage. First aid being administered to driver.
00:01:30 CPR in progress on passenger of vehicle 2. Medical attention critical.
00:02:00 Officer: Setting up perimeter. Diverting traffic around scene.
00:02:30 Ambulance arriving. Paramedic on scene now.
00:03:00 Officer coordinates with fire department. Scene management ongoing.`,
    expectedEvents: [
      { eventType: 'medical_attention', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: false },
      { eventType: 'weapon_drawn', shouldDetect: false },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'medium',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-039',
    title: 'Excessive Force Allegation — Handcuffing Injury',
    sourceType: 'bodycam',
    agencyId: 'agency-sjpd',
    agencyName: 'San Jose Police Department',
    incidentNarrative: 'San Jose Police — Subject alleges handcuffs were applied too tightly, causing wrist injury.',
    evidenceText: `00:00:00 Officer: Turn around. You are under arrest.
00:00:15 Officer applied handcuffs very tightly. Placed in cuffs.
00:00:30 Subject: The cuffs are too tight! You're hurting me! Please stop!
00:00:45 Subject: My wrist is broken! I need medical attention!
00:01:00 Officer: Stop resisting and they won't be so tight.
00:01:15 Subject: I'm not resisting! Please loosen them!
00:01:30 Officer does not adjust handcuffs.
00:02:00 Supervisor arrives. Checks handcuff tightness.
00:02:15 Supervisor: Loosen these cuffs. Request medical for wrist injury. Ambulance coming.`,
    expectedEvents: [
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Arrest'],
    expectedFindingCount: { min: 1, max: 4 },
    difficulty: 'medium',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-040',
    title: 'Training Scenario — Active Shooter Response',
    sourceType: 'transcript',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Training exercise documenting proper active shooter response protocol.',
    evidenceText: `TRAINING SCENARIO - NOT A REAL INCIDENT
00:00:00 Instructor: This is a training exercise. Active shooter scenario.
00:00:30 Officer draws weapon. Gun drawn per training protocol.
00:01:00 Officer: Police! Drop your weapon! Show me your hands!
00:01:30 Simulated shots fired. Blank rounds discharged.
00:02:00 Officer clears rooms. Moves toward threat location.
00:02:30 Suspect role player neutralized. Training suspect restrained.
00:03:00 First aid administered to role player victim. Medical training.
00:03:30 Instructor: Exercise complete. Good response time and procedures.`,
    expectedEvents: [
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'shots_fired', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 0, max: 4 },
    difficulty: 'hard',
    category: 'mixed',
  },
  {
    testCaseId: 'VAL-041',
    title: 'Threat Language — Officer Issues Verbal Threat',
    sourceType: 'bodycam',
    agencyId: 'agency-fresno-pd',
    agencyName: 'Fresno Police Department',
    incidentNarrative: 'Fresno Police — Officer uses threatening language toward non-compliant subject.',
    evidenceText: `00:00:00 Officer: Get out of the car now!
00:00:15 Subject refuses to exit vehicle.
00:00:30 Officer: I'll shoot if you don't get out! I will use force!
00:00:45 Officer: You're going to get tased if you don't comply.
00:01:00 Officer: This is your last chance. Last warning.
00:01:15 Subject exits vehicle.
00:01:30 Officer: Get on the ground. Don't move. Freeze!
00:01:45 Handcuffs applied. Subject in cuffs.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'threat_language', shouldDetect: true },
      { eventType: 'uof_warning', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Officer_Conduct', 'Use_of_Force'],
    expectedFindingCount: { min: 1, max: 5 },
    difficulty: 'medium',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-042',
    title: 'Traffic Collision Investigation',
    sourceType: 'police_report',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Routine traffic collision investigation. No criminal activity suspected.',
    evidenceText: `Officer responded to a two-vehicle collision at Highway 101 and Willow Ave.
Vehicle 1 (2023 Ford F-150) rear-ended Vehicle 2 (2024 Tesla Model 3).
Driver of Vehicle 1 stated he was distracted by cell phone.
No injuries reported by either driver. Medical attention offered but declined.
Both drivers exchanged information. CHP 555 form completed.
Traffic direction provided during scene clearance.
Tow truck called for Vehicle 2 (not drivable). Scene cleared at 1530 hours.`,
    expectedEvents: [
      { eventType: 'medical_attention', shouldDetect: true, notes: 'Medical offered' },
      { eventType: 'handcuffing', shouldDetect: false },
      { eventType: 'weapon_drawn', shouldDetect: false },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'easy',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-043',
    title: 'Community Policing Event — No Incident',
    sourceType: 'police_report',
    agencyId: 'agency-oakpd',
    agencyName: 'Oakland Police Department',
    incidentNarrative: 'Oakland Police — Officers participate in community engagement event. No law enforcement action taken.',
    evidenceText: `Officers attended community BBQ at Lincoln Park from 1200-1600 hours.
Approximately 200 community members attended the event.
Officers engaged in positive interactions with residents.
Information about neighborhood watch programs distributed.
No arrests or citations issued during the event.
Community feedback was overwhelmingly positive.
Next event scheduled for April 15th.`,
    expectedEvents: [
      { eventType: 'handcuffing', shouldDetect: false },
      { eventType: 'weapon_drawn', shouldDetect: false },
      { eventType: 'vehicle_search', shouldDetect: false },
      { eventType: 'taser_deployed', shouldDetect: false },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'easy',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-044',
    title: 'Missing Person Report',
    sourceType: 'police_report',
    agencyId: 'agency-sacpd',
    agencyName: 'Sacramento Police Department',
    incidentNarrative: 'Sacramento Police — Officer takes missing person report for elderly individual with dementia.',
    evidenceText: `Reporting party (daughter of missing person) filed report at 1800 hours.
Missing: John Smith, 78-year-old male, diagnosed with Alzheimers.
Last seen at 1400 hours wearing blue jacket and brown pants.
Officer initiated search protocol for at-risk missing person.
BOLO broadcast to all units. Silver Alert criteria evaluated.
Area hospitals and shelters contacted for welfare check.
Subject located at 2100 hours at nearby convenience store. Medical evaluation recommended.`,
    expectedEvents: [
      { eventType: 'medical_attention', shouldDetect: true, notes: 'Medical evaluation mentioned' },
      { eventType: 'handcuffing', shouldDetect: false },
    ],
    expectedPolicyReferences: [],
    expectedFindingCount: { min: 0, max: 0 },
    difficulty: 'easy',
    category: 'officer_conduct',
  },
  {
    testCaseId: 'VAL-045',
    title: 'Drug-Related Arrest with Force',
    sourceType: 'bodycam',
    agencyId: 'agency-sdpd',
    agencyName: 'San Diego Police Department',
    incidentNarrative: 'SDPD — Officers arrest suspected drug dealer. Subject attempts to destroy evidence and resist.',
    evidenceText: `00:00:00 Officer: Police! Don't move! Show me your hands!
00:00:15 Subject attempts to swallow evidence.
00:00:20 Officer: Spit it out! Stop! Physical force used to prevent evidence destruction.
00:00:25 Officer struck subject's hand. Physical strike to dislodge item.
00:00:30 Subject taken to ground. Control hold applied. Suspect restrained.
00:00:45 Stop resisting! Calm down! Subject handcuffed.
00:01:00 Officer: We need medical here. Subject may have ingested narcotics. Ambulance now.
00:01:15 Pat down conducted. Frisked for additional drugs. Patted down.
00:01:30 Miranda rights read. You have the right to remain silent.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Search_Seizure', 'Interrogation'],
    expectedFindingCount: { min: 2, max: 7 },
    difficulty: 'medium',
    category: 'mixed',
  },
  {
    testCaseId: 'VAL-046',
    title: 'Armed Robbery Response — Suspect Surrenders',
    sourceType: 'bodycam',
    agencyId: 'agency-lapd',
    agencyName: 'Los Angeles Police Department',
    incidentNarrative: 'LAPD — Officers respond to armed robbery in progress. Suspect surrenders peacefully upon officer arrival.',
    evidenceText: `00:00:00 Dispatch: Armed robbery in progress, 7-Eleven on Main St.
00:00:30 Officer arrives on scene. Approaches store entrance.
00:00:45 Officer drew weapon. Gun drawn. Firearm pointed toward entrance.
00:01:00 Officer: Police! Come out with your hands up! Drop any weapons!
00:01:15 Suspect exits store with hands raised.
00:01:30 Officer: Get on the ground! On your knees! Don't move!
00:01:45 Subject complies. Handcuffs applied. Placed in cuffs.
00:02:00 Pat down for weapons. Frisked suspect. Found no firearms.
00:02:15 Miranda warning read. You have the right to remain silent.
00:02:30 No force used. Subject fully cooperative after initial commands.`,
    expectedEvents: [
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Arrest'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'easy',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-047',
    title: 'Multiple Use of Force Techniques in Sequence',
    sourceType: 'bodycam',
    agencyId: 'agency-sfpd',
    agencyName: 'San Francisco Police Department',
    incidentNarrative: 'SFPD — Officer uses multiple force techniques in rapid succession during arrest of combative individual.',
    evidenceText: `00:00:00 Officer: You are under arrest. Turn around.
00:00:10 Subject attacks officer. Physical altercation.
00:00:15 Officer delivers elbow strike. Physical strike to subject's torso.
00:00:20 Subject still combative. Going to deploy taser.
00:00:25 Taser deployed. Taser! Taser! Subject not incapacitated.
00:00:30 Officer uses baton on subject's leg. Baton strike to thigh.
00:00:35 Impact weapon contact. Subject goes down.
00:00:40 Subject placed face down. Prone restraint position.
00:00:50 Stop resisting! Subject restrained. Control hold maintained.
00:01:00 Handcuffs applied. Subject in cuffs.
00:01:15 Medical requested immediately. Need ambulance at this location. Paramedic.`,
    expectedEvents: [
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'taser_deployed', shouldDetect: true },
      { eventType: 'baton_strike', shouldDetect: true },
      { eventType: 'prone_restraint', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force'],
    expectedFindingCount: { min: 3, max: 8 },
    difficulty: 'hard',
    category: 'use_of_force',
  },
  {
    testCaseId: 'VAL-048',
    title: 'Domestic Violence — Dual Arrest',
    sourceType: 'bodycam',
    agencyId: 'agency-sacpd',
    agencyName: 'Sacramento Police Department',
    incidentNarrative: 'Sacramento Police — Officers arrest both parties in domestic violence incident after both show signs of being aggressors.',
    evidenceText: `00:00:00 Officer: What happened here? Show me the injuries.
00:01:00 Officer: Both of you have injuries. We need to sort this out.
00:01:30 Officer: Sir, turn around. You are under arrest. Handcuffs applied to subject 1.
00:01:45 Subject 1 placed in cuffs.
00:02:00 Officer: Ma'am, you are also under arrest. Handcuffs applied to subject 2.
00:02:15 Subject 2 placed in cuffs. Both subjects restrained.
00:02:30 You have the right to remain silent. Miranda read to both subjects.
00:02:45 Medical attention offered to both parties. Do you need an ambulance?
00:03:00 Subjects transported in separate patrol vehicles.`,
    expectedEvents: [
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Arrest', 'Interrogation'],
    expectedFindingCount: { min: 0, max: 3 },
    difficulty: 'medium',
    category: 'arrest',
  },
  {
    testCaseId: 'VAL-049',
    title: 'Narcotics Operation — Controlled Buy',
    sourceType: 'audio',
    agencyId: 'agency-sjpd',
    agencyName: 'San Jose Police Department',
    incidentNarrative: 'San Jose Police — Undercover narcotics operation. Controlled buy followed by takedown team arrest.',
    evidenceText: `00:00:00 Handler: Confidential informant entering location.
00:05:00 Handler: Buy is complete. Takedown team go.
00:05:15 Officers converge. Police! Don't move! Show me your hands!
00:05:20 Get on the ground! Freeze! Hands where I can see them!
00:05:30 Subject 1 complies. Handcuffs applied. Placed in cuffs.
00:05:45 Subject 2 runs. Foot pursuit initiated. Running after suspect.
00:06:00 Foot chase through parking lot. Foot pursuit continuing.
00:06:15 Subject 2 caught. Taken to ground. Suspect restrained.
00:06:30 Handcuffed. Both subjects in custody.
00:06:45 Pat down conducted on both. Patted down for weapons and drugs.
00:07:00 You have the right to remain silent. Miranda warnings read to both.`,
    expectedEvents: [
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'foot_pursuit', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'pat_down_search', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Arrest', 'Search_Seizure'],
    expectedFindingCount: { min: 0, max: 4 },
    difficulty: 'medium',
    category: 'mixed',
  },
  {
    testCaseId: 'VAL-050',
    title: 'Complete Force Incident with All Phases',
    sourceType: 'bodycam',
    agencyId: 'agency-chp',
    agencyName: 'California Highway Patrol',
    incidentNarrative: 'CHP — Comprehensive incident involving most event types: verbal commands, de-escalation attempt, weapon drawn, physical strike, taser, handcuffing, Miranda, medical attention.',
    evidenceText: `00:00:00 Officer arrives at scene. Approached individual in parking lot.
00:00:15 Officer: Excuse me, sir. Can we talk? I'm here to help. Let's work this out.
00:00:30 De-escalation attempt. Nobody needs to get hurt.
00:00:45 Subject becomes aggressive. Advances toward officer.
00:01:00 Officer: Stop right there! Don't move! Show me your hands!
00:01:10 Officer drew weapon as precaution. Gun drawn at low ready.
00:01:20 Officer: I will use force if necessary. This is your last warning.
00:01:30 Subject charges. Officer holsters weapon, engages physically.
00:01:35 Officer punched subject. Physical force applied. Struck in shoulder.
00:01:40 Subject continues fighting. Officer: Deploying taser. Taser! Taser!
00:01:45 Taser deployed. Subject goes down.
00:01:50 Subject placed on ground. Prone position briefly. Face down.
00:01:55 Rolled to side immediately. Suspect restrained. Control hold.
00:02:00 Stop resisting! Calm down! Comply!
00:02:10 Handcuffs applied. Subject placed in cuffs.
00:02:20 Officer: Are you injured? Do you need medical? Paramedic is coming.
00:02:30 You have the right to remain silent. Anything you say can be used.
00:02:45 Miranda rights fully administered. Right to an attorney explained.
00:03:00 Ambulance arrives. First aid being administered. CPR not needed.
00:03:15 Subject transported. Vehicle searched incident to arrest. Searched trunk.`,
    expectedEvents: [
      { eventType: 'officer_proximity', shouldDetect: true },
      { eventType: 'de_escalation_attempt', shouldDetect: true },
      { eventType: 'verbal_command', shouldDetect: true },
      { eventType: 'weapon_drawn', shouldDetect: true },
      { eventType: 'uof_warning', shouldDetect: true },
      { eventType: 'physical_strike', shouldDetect: true },
      { eventType: 'taser_deployed', shouldDetect: true },
      { eventType: 'prone_restraint', shouldDetect: true },
      { eventType: 'suspect_restrained', shouldDetect: true },
      { eventType: 'compliance_command', shouldDetect: true },
      { eventType: 'handcuffing', shouldDetect: true },
      { eventType: 'medical_attention', shouldDetect: true },
      { eventType: 'miranda_warning', shouldDetect: true },
      { eventType: 'vehicle_search', shouldDetect: true },
    ],
    expectedPolicyReferences: ['Use_of_Force', 'Search_Seizure', 'Interrogation'],
    expectedFindingCount: { min: 3, max: 12 },
    difficulty: 'hard',
    category: 'mixed',
  },
];
