// ============================================================================
// Program (Premium Demo Enhancement) — Illustrative Litigation Demonstration Data
//
// ⚠️ EVERY VALUE IN THIS FILE IS A FICTIONAL, ILLUSTRATIVE EXAMPLE.
// It exists ONLY to demonstrate the CourtAccess product to prospective
// customers. It is NOT actual case data, NOT a real client, NOT real evidence.
// The fictional case name, number, people, and facts are invented for
// demonstration purposes and must never be presented as production information.
// ============================================================================

import type { KnowledgeGraphData } from '../../components/graph/types';

export const DEMO_DISCLAIMER = {
  title: 'ILLUSTRATIVE EXAMPLE',
  line1: 'DEMONSTRATION ONLY',
  line2: 'NOT ACTUAL CASE INFORMATION',
};

export const demoCase = {
  title: 'People v. Jonathan Doe (ILLUSTRATIVE)',
  caseNumber: '23CR012345 (DEMO)',
  court: 'Los Angeles County Superior Court',
  judge: 'Hon. Michael Johnson (illustrative)',
  attorney: 'Sarah Chen, Esq. (illustrative)',
  prosecutor: 'Office of the District Attorney (illustrative)',
  status: 'Active',
  jurisdiction: 'CA',
  filingDate: '2023-01-14',
  nextHearing: '2025-05-21 10:30 AM',
  nextHearingNote: 'Motion to Suppress',
};

// Headline scorecard metrics (illustrative), matching the premium reference layout.
export const demoScorecard = {
  caseStrength: { value: 94, label: 'HIGH', sub: 'Strong likelihood of favorable defense posture' },
  evidenceConfidence: { value: 98, label: 'VERY HIGH', sub: 'Based on 106 total evidentiary items' },
  completeness: { value: 91, label: 'COMPREHENSIVE', sub: 'All critical areas addressed' },
};

export const demoStats = {
  charges: 3,
  evidence: 24,
  witnesses: 18,
  statutes: 11,
  authorities: 42,
  discovery: 9,
  timelineEvents: 13,
  motions: 4,
  contradictions: 4,
  defenseOpportunities: 7,
  investigativeTasks: 12,
  evidenceGaps: 2,
  humanReview: 1,
  kgNodes: 24,
};

export const demoCharges = [
  { code: 'PC', section: '459', title: 'Burglary (illustrative)', classification: 'Felony (wobbler)', calcrim: '1700', primary: true },
  { code: 'PC', section: '211', title: 'Robbery (illustrative)', classification: 'Felony', calcrim: '1600', primary: false },
  { code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon (illustrative)', classification: 'Felony (wobbler)', calcrim: '875', primary: false },
];

export const demoEvidence = [
  { name: 'bodycam_officer_martinez.mp4', type: 'Body-worn camera', hash: '9f2a…c418', ocr: 'analyzed', custody: 'complete' },
  { name: '911_call_recording.wav', type: '911 audio', hash: '3d81…7b02', ocr: 'analyzed', custody: 'complete' },
  { name: 'store_surveillance.mp4', type: 'Surveillance video', hash: 'a71c…9e55', ocr: 'analyzed', custody: 'partial' },
  { name: 'police_report_23-0114.pdf', type: 'Police report', hash: 'c904…12af', ocr: 'analyzed', custody: 'complete' },
  { name: 'forensic_latent_prints.pdf', type: 'Forensic report', hash: 'ee20…4a7d', ocr: 'analyzed', custody: 'complete' },
  { name: 'witness_statement_doe.pdf', type: 'Witness statement', hash: '5b6f…88c1', ocr: 'analyzed', custody: 'complete' },
  { name: 'booking_photos.zip', type: 'Booking record', hash: '1a44…d0e9', ocr: 'pending', custody: 'partial' },
];

export const demoWitnesses = [
  { name: 'Officer M. Martinez (illustrative)', type: 'Law enforcement', interview: 'completed', credibility: 'Impeachment material noted' },
  { name: 'A. Doe (illustrative)', type: 'Eyewitness', interview: 'scheduled', credibility: 'Identification reliability at issue' },
  { name: 'R. Kim (illustrative)', type: 'Victim', interview: 'completed', credibility: 'To be assessed' },
  { name: 'Dr. L. Okafor (illustrative)', type: 'Forensic expert', interview: 'not scheduled', credibility: 'To be assessed' },
  { name: 'Dispatch Operator #4471 (illustrative)', type: '911 operator', interview: 'not scheduled', credibility: 'To be assessed' },
];

export const demoDiscovery = [
  { title: 'CAD / dispatch log', category: 'cad_log', brady: false, giglio: false, jencks: true },
  { title: 'Officer personnel complaint index', category: 'giglio', brady: false, giglio: true, jencks: false },
  { title: 'Exculpatory surveillance segment', category: 'brady', brady: true, giglio: false, jencks: false },
  { title: 'Forensic bench notes', category: 'lab_report', brady: false, giglio: false, jencks: false },
];

// ── Element-based analysis (Phase 3) ────────────────────────────────────────
export type ElementStatus = 'supported' | 'partial' | 'missing' | 'contradicted';
export interface DemoElement {
  name: string;
  kind: 'actus reus' | 'mens rea' | 'attendant';
  status: ElementStatus;
  supporting: string[];
  missing?: string;
  contradicting?: string;
  why: string;
}
export interface DemoChargeAnalysis {
  code: string; section: string; title: string; calcrim: string; classification: string;
  elements: DemoElement[];
}

export const demoChargeAnalysis: DemoChargeAnalysis[] = [
  {
    code: 'PC', section: '459', title: 'Burglary (illustrative)', calcrim: 'CALCRIM 1700', classification: 'Felony (wobbler)',
    elements: [
      { name: 'Entry into a building', kind: 'actus reus', status: 'supported', supporting: ['store_surveillance.mp4', 'police_report_23-0114.pdf'], why: 'Surveillance and report place a person entering the premises — the entry element appears supported.' },
      { name: 'Intent to commit theft/felony at time of entry', kind: 'mens rea', status: 'missing', missing: 'No evidence establishes intent formed BEFORE entry.', supporting: [], why: 'Burglary requires the felonious intent to exist at the moment of entry. The repository shows no evidence of pre-entry intent — a potentially dispositive gap the prosecution must prove beyond a reasonable doubt.' },
      { name: 'Structure was a building/locked structure', kind: 'attendant', status: 'supported', supporting: ['police_report_23-0114.pdf'], why: 'The report identifies a commercial structure; element appears supported.' },
      { name: 'Identity of the person who entered', kind: 'attendant', status: 'contradicted', supporting: ['witness_statement_doe.pdf'], contradicting: 'store_surveillance.mp4 timestamp vs. eyewitness placement', why: 'Eyewitness identification conflicts with the surveillance timeline — identity is contested and may support misidentification and alibi theories.' },
    ],
  },
  {
    code: 'PC', section: '211', title: 'Robbery (illustrative)', calcrim: 'CALCRIM 1600', classification: 'Felony',
    elements: [
      { name: 'Taking of property', kind: 'actus reus', status: 'partial', supporting: ['police_report_23-0114.pdf'], missing: 'No recovered property linked to defendant.', why: 'A taking is alleged but no recovered property ties the defendant to it — weakens the taking element.' },
      { name: 'From person/immediate presence', kind: 'attendant', status: 'partial', supporting: ['witness_statement_doe.pdf'], why: 'Presence is asserted by one witness; corroboration is thin.' },
      { name: 'Against will by force or fear', kind: 'actus reus', status: 'missing', missing: 'No injury documentation; force/fear not corroborated.', supporting: [], why: 'The force-or-fear element lacks corroborating medical or video evidence — a core weakness in the robbery count.' },
      { name: 'Intent to permanently deprive', kind: 'mens rea', status: 'missing', missing: 'Intent to permanently deprive is not established.', supporting: [], why: 'Specific intent is required; the repository contains no evidence of intent to permanently deprive.' },
    ],
  },
  {
    code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon (illustrative)', calcrim: 'CALCRIM 875', classification: 'Felony (wobbler)',
    elements: [
      { name: 'Act with a deadly weapon', kind: 'actus reus', status: 'missing', missing: 'No weapon recovered or depicted.', supporting: [], why: 'No weapon was recovered or shown in evidence — the central element of the ADW charge is unsupported in the repository.' },
      { name: 'Act likely to produce great bodily injury', kind: 'attendant', status: 'partial', supporting: ['911_call_recording.wav'], why: '911 audio references a confrontation; injury is not documented.' },
      { name: 'Present ability to apply force', kind: 'mens rea', status: 'partial', supporting: [], why: 'Present ability is inferred, not established — attorney review required.' },
    ],
  },
];

// ── Prosecution weaknesses (Phase 2) ────────────────────────────────────────
export interface DemoWeakness { id: string; category: string; title: string; severity: 'high' | 'medium' | 'low'; why: string; element?: string }
export const demoWeaknesses: DemoWeakness[] = [
  { id: 'w1', category: 'Missing Element', title: 'Burglary intent-at-entry unproven', severity: 'high', element: 'PC 459 — Intent at entry', why: 'The prosecution must prove felonious intent existed at the moment of entry. No repository evidence establishes pre-entry intent, going to the heart of the burglary count.' },
  { id: 'w2', category: 'Missing Evidence', title: 'No weapon recovered for ADW', severity: 'high', element: 'PC 245(a)(1) — Deadly weapon', why: 'The ADW charge depends on a deadly weapon; none was recovered or depicted, leaving the central element unsupported.' },
  { id: 'w3', category: 'Weak Witness', title: 'Eyewitness identification reliability', severity: 'high', element: 'PC 459 — Identity', why: 'Single-witness identification conflicts with surveillance timing; classic misidentification exposure (lighting, distance, suggestion).' },
  { id: 'w4', category: 'Contradiction', title: 'Surveillance timestamp vs. dispatch time', severity: 'medium', element: 'Timeline', why: 'The store video timestamp is inconsistent with the CAD dispatch time, undermining the prosecution timeline and identity.' },
  { id: 'w5', category: 'Chain of Custody', title: 'Surveillance video custody incomplete', severity: 'medium', element: 'Authentication', why: 'The surveillance file shows partial chain of custody — authentication and foundation may be challenged.' },
  { id: 'w6', category: 'Missing Evidence', title: 'No recovered property for robbery', severity: 'medium', element: 'PC 211 — Taking', why: 'No property tied to the defendant weakens the taking and intent-to-deprive elements.' },
  { id: 'w7', category: 'Procedural', title: 'Possible un-Mirandized statement', severity: 'high', element: 'Suppression', why: 'The report notes an interview with no Miranda warning documented — a suppression opportunity that could exclude statements.' },
];

// ── Defense opportunities (Phase 4) ─────────────────────────────────────────
export interface DemoDefenseOpp { id: string; category: string; title: string; why: string; repositoryRef: string }
export const demoDefenseOpps: DemoDefenseOpp[] = [
  { id: 'd1', category: 'Suppression', title: 'Motion to suppress un-Mirandized statement', why: 'Report indicates custodial interview without documented Miranda advisement — statements may be inadmissible (Miranda v. Arizona).', repositoryRef: 'police_report_23-0114.pdf; U.S. Const. amend. V' },
  { id: 'd2', category: 'Suppression', title: 'Fourth Amendment search challenge', why: 'Circumstances of the search/seizure are unclear; a 1538.5 motion may exclude physical evidence.', repositoryRef: 'Cal. Penal Code § 1538.5' },
  { id: 'd3', category: 'Impeachment', title: 'Officer Giglio / personnel record', why: 'Personnel complaint index flagged (Giglio/Pitchess) may yield impeachment of the officer witness.', repositoryRef: 'Brady/Giglio; Evid. Code §§ 1043–1045' },
  { id: 'd4', category: 'Identification', title: 'Misidentification / eyewitness reliability', why: 'Single-witness ID conflicts with video timing; CALCRIM 315 factors support reasonable doubt.', repositoryRef: 'CALCRIM 315; store_surveillance.mp4' },
  { id: 'd5', category: 'Alibi', title: 'Alibi corroboration', why: 'Multiple witnesses may place the defendant elsewhere; travel-time analysis may be exculpatory.', repositoryRef: 'witness_statement_doe.pdf' },
  { id: 'd6', category: 'Authentication', title: 'Surveillance authentication / foundation', why: 'Partial chain of custody permits a foundation challenge to the video.', repositoryRef: 'store_surveillance.mp4; Evid. Code § 1401' },
  { id: 'd7', category: 'Intent', title: 'Intent-at-entry challenge (burglary)', why: 'Absent pre-entry intent evidence, move for acquittal on the burglary count (PC 1118.1).', repositoryRef: 'CALCRIM 1700; Cal. Penal Code § 1118.1' },
];

// ── Investigative tasks (Phase 5) ───────────────────────────────────────────
export interface DemoTask { id: string; task: string; priority: 'high' | 'medium' | 'low'; reason: string; value: string; status: 'open' | 'in_progress' | 'done' }
export const demoTasks: DemoTask[] = [
  { id: 't1', task: 'Interview eyewitness A. Doe under oath', priority: 'high', reason: 'Lock in identification details; probe lighting/distance/suggestion.', value: 'Impeachment / misidentification', status: 'open' },
  { id: 't2', task: 'Canvass neighborhood for additional cameras', priority: 'high', reason: 'Independent video may corroborate alibi and contradict timeline.', value: 'Alibi corroboration', status: 'open' },
  { id: 't3', task: 'Request business surveillance from adjacent stores', priority: 'high', reason: 'Nearby businesses may hold un-produced footage.', value: 'Timeline / identity', status: 'open' },
  { id: 't4', task: 'Obtain complete dispatch (CAD) recordings', priority: 'high', reason: 'Resolve the timestamp contradiction with store video.', value: 'Timeline contradiction', status: 'in_progress' },
  { id: 't5', task: 'Review full body-worn camera footage', priority: 'medium', reason: 'Assess Miranda advisement and search circumstances.', value: 'Suppression', status: 'open' },
  { id: 't6', task: 'Preserve digital evidence (phone extraction)', priority: 'medium', reason: 'Prevent spoliation; establish location data.', value: 'Alibi / preservation', status: 'open' },
  { id: 't7', task: 'Verify travel times between locations', priority: 'medium', reason: 'Test physical feasibility of the alleged movements.', value: 'Alibi', status: 'open' },
  { id: 't8', task: 'Scene measurements & photographs', priority: 'medium', reason: 'Document sightlines and lighting for ID challenge.', value: 'Misidentification', status: 'open' },
  { id: 't9', task: 'Obtain jail call recordings', priority: 'low', reason: 'Review for exculpatory statements.', value: 'Context', status: 'open' },
  { id: 't10', task: 'Additional forensic testing of latent prints', priority: 'medium', reason: 'Confirm/exclude attribution of prints.', value: 'Identity', status: 'open' },
  { id: 't11', task: 'Subpoena officer personnel records (Pitchess)', priority: 'high', reason: 'Impeachment material for the officer witness.', value: 'Impeachment', status: 'open' },
  { id: 't12', task: 'Retain forensic video examiner', priority: 'medium', reason: 'Authenticate/analyze surveillance timestamp.', value: 'Authentication', status: 'open' },
];

// ── Contradictions (Phase 6) ────────────────────────────────────────────────
export interface DemoContradiction { id: string; type: string; title: string; severity: 'high' | 'medium' | 'low'; element: string; recommendation: string; sources: string[] }
export const demoContradictions: DemoContradiction[] = [
  { id: 'c1', type: 'Video vs. Dispatch', title: 'Surveillance timestamp precedes 911/dispatch time', severity: 'high', element: 'Timeline / Identity (PC 459)', recommendation: 'Retain a video examiner; move to exclude or impeach the timeline. This undercuts identity and the prosecution narrative.', sources: ['store_surveillance.mp4', 'CAD / dispatch log'] },
  { id: 'c2', type: 'Witness vs. Video', title: 'Eyewitness placement conflicts with video', severity: 'high', element: 'Identity (PC 459)', recommendation: 'Develop misidentification theory; CALCRIM 315 cross-examination.', sources: ['witness_statement_doe.pdf', 'store_surveillance.mp4'] },
  { id: 'c3', type: 'Officer vs. Report', title: 'Body-cam does not corroborate report on search', severity: 'medium', element: 'Suppression', recommendation: 'Compare body-cam to report; support 1538.5 suppression.', sources: ['bodycam_officer_martinez.mp4', 'police_report_23-0114.pdf'] },
  { id: 'c4', type: 'Physical vs. Charge', title: 'No weapon recovered despite ADW charge', severity: 'medium', element: 'PC 245(a)(1) — Deadly weapon', recommendation: 'Move for acquittal / reduction; central element unsupported.', sources: ['police_report_23-0114.pdf'] },
];

// ── Key findings (dashboard) ────────────────────────────────────────────────
export interface DemoFinding { title: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; detail: string; tone: 'weakness' | 'opportunity' | 'contradiction' }
export const demoKeyFindings: DemoFinding[] = [
  { title: 'Insufficient evidence of intent', confidence: 'HIGH', detail: 'Prosecution lacks proof of felonious intent at entry (PC 459).', tone: 'weakness' },
  { title: 'Fourth Amendment / Miranda issues', confidence: 'HIGH', detail: 'Possible unlawful search and un-Mirandized statement — suppression opportunities.', tone: 'opportunity' },
  { title: 'Alibi corroborated', confidence: 'MEDIUM', detail: 'Multiple witnesses may place the defendant elsewhere.', tone: 'opportunity' },
  { title: 'Forensic chain-of-custody issues', confidence: 'MEDIUM', detail: 'Chain of custody incomplete for key surveillance evidence.', tone: 'weakness' },
];

// ── Timeline (interactive; Phase 8) ─────────────────────────────────────────
export interface DemoTimelineEvent {
  phase: string; time: string; title: string; detail: string;
  kind: 'incident' | 'investigation' | 'court' | 'evidence' | 'discovery';
  sources?: string[]; evidence?: string[]; witnesses?: string[]; contradictions?: string[]; charges?: string[]; note?: string;
}
export const demoTimeline: DemoTimelineEvent[] = [
  { phase: 'Incident', time: '2023-01-12 20:45', title: 'Incident occurred', detail: 'Alleged incident reported downtown Los Angeles (illustrative).', kind: 'incident', sources: ['911_call_recording.wav'], charges: ['PC 459', 'PC 211'], contradictions: ['c1'], note: 'Store video timestamp is inconsistent with this reported time.' },
  { phase: '911 Call', time: '2023-01-12 21:06', title: '911 call placed', detail: 'Caller reports suspect fleeing (illustrative).', kind: 'incident', sources: ['911_call_recording.wav'], witnesses: ['Dispatch Operator #4471'] },
  { phase: 'Police Respond', time: '2023-01-12 21:15', title: 'Officers respond; initial report filed', detail: 'Officer Martinez arrives; body-worn camera activated (illustrative).', kind: 'investigation', evidence: ['bodycam_officer_martinez.mp4'], witnesses: ['Officer M. Martinez'], contradictions: ['c3'] },
  { phase: 'Evidence Collection', time: '2023-01-13 11:30', title: 'Evidence collected; items seized', detail: 'Surveillance secured; latent prints lifted (illustrative).', kind: 'evidence', evidence: ['store_surveillance.mp4', 'forensic_latent_prints.pdf'] },
  { phase: 'Interview', time: '2023-01-20 14:00', title: 'Defendant interviewed — no Miranda warning documented', detail: 'Custodial interview with no documented advisement (illustrative).', kind: 'investigation', evidence: ['police_report_23-0114.pdf'], note: 'Suppression opportunity — see Defense Workspace.' },
  { phase: 'Discovery', time: '2023-03-02', title: 'Initial discovery produced', detail: 'Reports, CAD log, and media produced (illustrative).', kind: 'discovery' },
  { phase: 'Preliminary Hearing', time: '2023-04-18', title: 'Preliminary hearing', detail: 'Held to answer (illustrative).', kind: 'court' },
  { phase: 'Motions', time: '2025-05-21', title: 'Next hearing — Motion to Suppress', detail: 'Defense motion to suppress statement and evidence (illustrative, scheduled).', kind: 'court', charges: ['PC 459'] },
  { phase: 'Trial', time: 'Pending', title: 'Jury trial', detail: 'UNKNOWN — illustrative example, not scheduled.', kind: 'court' },
  { phase: 'Verdict', time: 'Pending', title: 'Verdict', detail: 'UNKNOWN — illustrative example, outcome not determined.', kind: 'court' },
];

export const demoAuthorities = [
  { citation: 'Cal. Penal Code § 459', note: 'Burglary — illustrative statute reference' },
  { citation: 'Cal. Penal Code § 211', note: 'Robbery — illustrative statute reference' },
  { citation: 'Cal. Penal Code § 245(a)(1)', note: 'Assault with a deadly weapon — illustrative' },
  { citation: 'CALCRIM No. 1700', note: 'Burglary instruction — illustrative' },
  { citation: 'CALCRIM No. 315', note: 'Eyewitness identification — illustrative' },
  { citation: 'Miranda v. Arizona (1966) 384 U.S. 436', note: 'Custodial interrogation warnings' },
  { citation: 'Cal. Penal Code § 1538.5', note: 'Motion to suppress' },
  { citation: 'Brady v. Maryland (1963) 373 U.S. 83', note: 'Disclosure of favorable evidence' },
];

// ── Knowledge Graph (with node significance for detail panel) ────────────────
export const demoKnowledgeGraph: KnowledgeGraphData = {
  nodes: [
    { id: 'case', type: 'organization', label: 'People v. Doe (illustrative)', repositorySource: 'Demonstration' },
    { id: 'def', type: 'person', label: 'Defendant (illustrative)' },
    { id: 'ch1', type: 'charge', label: 'PC 459 Burglary', repositorySource: 'CA Penal Code' },
    { id: 'ch2', type: 'charge', label: 'PC 211 Robbery', repositorySource: 'CA Penal Code' },
    { id: 'ch3', type: 'charge', label: 'PC 245(a)(1) ADW', repositorySource: 'CA Penal Code' },
    { id: 'st1', type: 'statute', label: 'PC 459', repositorySource: 'CA Legislative' },
    { id: 'cal1', type: 'calcrim', label: 'CALCRIM 1700', repositorySource: 'CALCRIM' },
    { id: 'cal2', type: 'calcrim', label: 'CALCRIM 315', repositorySource: 'CALCRIM' },
    { id: 'auth1', type: 'authority', label: 'Miranda v. Arizona', repositorySource: 'CourtListener' },
    { id: 'ev1', type: 'evidence', label: 'Body-worn camera', evidenceCitations: ['bodycam_officer_martinez.mp4'] },
    { id: 'ev2', type: 'evidence', label: '911 audio', evidenceCitations: ['911_call_recording.wav'] },
    { id: 'ev3', type: 'evidence', label: 'Surveillance video', evidenceCitations: ['store_surveillance.mp4'] },
    { id: 'ev4', type: 'evidence', label: 'Forensic report', evidenceCitations: ['forensic_latent_prints.pdf'] },
    { id: 'w1', type: 'witness', label: 'Officer Martinez' },
    { id: 'w2', type: 'witness', label: 'Eyewitness A. Doe' },
    { id: 'w3', type: 'witness', label: 'Victim R. Kim' },
    { id: 't1', type: 'timeline_event', label: 'Incident 20:45', timestamp: '2023-01-12T20:45:00Z' },
    { id: 't2', type: 'timeline_event', label: 'Interview 14:00', timestamp: '2023-01-20T14:00:00Z' },
    { id: 'loc1', type: 'location', label: 'Store (illustrative)' },
    { id: 'doc1', type: 'document', label: 'Motion to Suppress' },
    { id: 'con1', type: 'contradiction', label: 'Video/Dispatch timestamp conflict' },
    { id: 'con2', type: 'contradiction', label: 'Witness/Video ID conflict' },
    { id: 'con3', type: 'contradiction', label: 'No weapon vs. ADW charge' },
    { id: 'gap1', type: 'unknown', label: 'Intent-at-entry: UNKNOWN' },
  ],
  edges: [
    { from: 'case', to: 'def', relation: 'defendant', strength: 1 },
    { from: 'case', to: 'ch1', relation: 'charge', strength: 1 },
    { from: 'case', to: 'ch2', relation: 'charge', strength: 0.9 },
    { from: 'case', to: 'ch3', relation: 'charge', strength: 0.9 },
    { from: 'ch1', to: 'st1', relation: 'statute', strength: 0.8 },
    { from: 'ch1', to: 'cal1', relation: 'instruction', strength: 0.7 },
    { from: 'ch1', to: 'gap1', relation: 'missing-element', strength: 0.9 },
    { from: 'ch1', to: 'cal2', relation: 'instruction', strength: 0.6 },
    { from: 'ev1', to: 'w1', relation: 'source', strength: 0.9 },
    { from: 'ev2', to: 't1', relation: 'documents', strength: 0.8 },
    { from: 'ev3', to: 'loc1', relation: 'depicts', strength: 0.7 },
    { from: 'ev3', to: 'con1', relation: 'flagged-by', strength: 0.8 },
    { from: 'ev4', to: 'ch1', relation: 'supports', strength: 0.6 },
    { from: 'w1', to: 't2', relation: 'observed', strength: 0.8 },
    { from: 'w2', to: 'con2', relation: 'flagged-by', strength: 0.8 },
    { from: 'w3', to: 'ch2', relation: 'victim', strength: 0.9 },
    { from: 'con1', to: 'ch1', relation: 'undermines', strength: 0.8 },
    { from: 'con2', to: 'ch1', relation: 'undermines', strength: 0.8 },
    { from: 'con3', to: 'ch3', relation: 'undermines', strength: 0.9 },
    { from: 'auth1', to: 'doc1', relation: 'supports', strength: 0.7 },
    { from: 'doc1', to: 'ev1', relation: 'challenges', strength: 0.6 },
    { from: 't1', to: 't2', relation: 'precedes', strength: 0.5 },
    { from: 'def', to: 'loc1', relation: 'present-at', strength: 0.4 },
  ],
};

export const demoKgSignificance: Record<string, { explanation: string; significance: string; affects?: string }> = {
  gap1: { explanation: 'The burglary intent-at-entry element has no supporting repository evidence.', significance: 'Potentially dispositive — the prosecution must prove felonious intent existed at the moment of entry.', affects: 'PC 459 — Intent element' },
  con1: { explanation: 'The surveillance timestamp is inconsistent with the CAD/dispatch time.', significance: 'Undermines the prosecution timeline and identity; supports a video-examiner challenge.', affects: 'Timeline / PC 459 identity' },
  con2: { explanation: 'Eyewitness placement conflicts with the surveillance video.', significance: 'Supports a misidentification defense (CALCRIM 315).', affects: 'PC 459 — Identity' },
  con3: { explanation: 'No weapon was recovered despite the ADW charge.', significance: 'The central element of PC 245(a)(1) is unsupported.', affects: 'PC 245(a)(1)' },
  ch1: { explanation: 'Primary charge: PC 459 Burglary.', significance: 'Intent-at-entry is the key contested element.', affects: 'CALCRIM 1700' },
  doc1: { explanation: 'Defense motion to suppress.', significance: 'Targets un-Mirandized statement and search — could exclude key evidence.', affects: 'Suppression' },
};

// ── Investigative map (Phase 10) — labeled aid, cameras NOT confirmed ────────
export interface DemoMapPoint { id: string; label: string; kind: 'incident' | 'business' | 'camera-candidate' | 'route'; note: string }
export const demoMap = {
  disclaimer: 'Investigative aid only. Camera locations are UNVERIFIED candidates for canvassing — the platform does NOT assert cameras exist. All points require field verification.',
  incident: { label: 'Alleged incident location (illustrative)', note: 'Downtown Los Angeles (fictional coordinates).' },
  points: [
    { id: 'm1', label: 'Adjacent retail (illustrative)', kind: 'business', note: 'Canvass for surveillance — footage not confirmed.' } as DemoMapPoint,
    { id: 'm2', label: 'Corner ATM (illustrative)', kind: 'camera-candidate', note: 'Possible camera — UNVERIFIED, subpoena required.' } as DemoMapPoint,
    { id: 'm3', label: 'Transit stop (illustrative)', kind: 'camera-candidate', note: 'Possible transit camera — UNVERIFIED.' } as DemoMapPoint,
    { id: 'm4', label: 'Alleged flight route (illustrative)', kind: 'route', note: 'Test travel time vs. alibi — requires verification.' } as DemoMapPoint,
  ],
  travelTimes: [
    { from: 'Incident', to: 'Alibi location (illustrative)', distance: '2.1 mi (illustrative)', driving: '~8 min', walking: '~42 min', note: 'Illustrative — verify with mapping + testimony.' },
  ],
};

// ── Case Brief (Phase 9) ────────────────────────────────────────────────────
export const demoCaseBrief = {
  overview: 'Defendant is charged with burglary, robbery, and assault with a deadly weapon arising from a single alleged downtown incident. The prosecution case rests on a single eyewitness identification and surveillance video whose timestamp conflicts with dispatch records. (Illustrative.)',
  materialFacts: [
    'A commercial premises was allegedly entered on the night of the incident.',
    'A single eyewitness identifies the defendant; the identification conflicts with surveillance timing.',
    'No weapon was recovered; no property was recovered and tied to the defendant.',
    'A custodial interview occurred with no documented Miranda advisement.',
  ],
  keyEvidence: ['store_surveillance.mp4', 'bodycam_officer_martinez.mp4', '911_call_recording.wav', 'forensic_latent_prints.pdf', 'police_report_23-0114.pdf'],
  weaknesses: ['Burglary intent-at-entry unproven', 'No weapon for ADW', 'Eyewitness reliability', 'Timeline contradiction', 'Chain-of-custody gap'],
  contradictions: ['Video timestamp vs. dispatch', 'Witness vs. video', 'No weapon vs. ADW charge'],
  statutes: ['PC 459', 'PC 211', 'PC 245(a)(1)', 'PC 1538.5', 'PC 1118.1'],
  authorities: ['Miranda v. Arizona', 'Brady v. Maryland', 'CALCRIM 1700', 'CALCRIM 315'],
  issues: ['Was there intent at entry?', 'Is the eyewitness ID reliable?', 'Was the statement obtained in violation of Miranda?', 'Can the surveillance video be authenticated?'],
  recommendations: ['File motion to suppress statement (Miranda)', 'File 1538.5 suppression', 'Retain forensic video examiner', 'Pitchess motion for officer records', 'PC 1118.1 motion on burglary intent'],
  outstandingTasks: ['Canvass for additional cameras', 'Obtain full CAD recordings', 'Verify travel times', 'Interview eyewitness under oath'],
  humanReview: ['All legal conclusions and authorities require attorney verification before use.'],
};

export type DemoReportType =
  | 'attorney-report' | 'motion' | 'voir-dire' | 'sentencing' | 'calcrim'
  | 'discovery' | 'evidence' | 'knowledge-graph' | 'timeline' | 'witness'
  | 'trial-prep' | 'repository';

export interface DemoReportSection { heading: string; body: string[] }
export interface DemoReport { type: DemoReportType; title: string; subtitle: string; sections: DemoReportSection[] }

export const demoReports: Record<DemoReportType, DemoReport> = {
  'attorney-report': {
    type: 'attorney-report', title: 'Attorney Report', subtitle: 'Comprehensive repository-backed case intelligence',
    sections: [
      { heading: 'Executive Summary', body: [`${demoCase.title} · Case No. ${demoCase.caseNumber}. ${demoStats.charges} charges, ${demoStats.evidence} evidence items, ${demoStats.witnesses} witnesses. Case strength (illustrative): ${demoScorecard.caseStrength.value}% favorable defense posture.`] },
      { heading: 'Prosecution Weaknesses', body: demoWeaknesses.map((w) => `${w.title} (${w.severity}) — ${w.why}`) },
      { heading: 'Defense Opportunities', body: demoDefenseOpps.map((d) => `${d.title} — ${d.why}`) },
      { heading: 'Recommendations', body: demoCaseBrief.recommendations },
    ],
  },
  motion: {
    type: 'motion', title: 'Motion to Suppress', subtitle: 'Repository-backed motion draft',
    sections: [
      { heading: 'I. Introduction', body: ['Defendant respectfully moves to suppress the statement and evidence pursuant to Miranda and Cal. Penal Code § 1538.5 (illustrative).'] },
      { heading: 'II. Statement of Facts', body: ['A custodial interview occurred with no documented Miranda advisement (illustrative).'] },
      { heading: 'III. Argument', body: ['The un-Mirandized statement must be excluded; the search lacked a valid basis (illustrative).'] },
    ],
  },
  'voir-dire': { type: 'voir-dire', title: 'Voir Dire Notebook', subtitle: 'Repository-derived questions', sections: [{ heading: 'Eyewitness Reliability', body: ['Would you accept that eyewitness identification can be mistaken even when sincere? (CALCRIM 315 — illustrative)'] }] },
  sentencing: { type: 'sentencing', title: 'Sentencing Notebook', subtitle: 'Classification & exposure', sections: [{ heading: 'Exposure', body: ['Numeric exposure is UNKNOWN and never estimated; classification per repository (illustrative).'] }] },
  calcrim: { type: 'calcrim', title: 'CALCRIM Report', subtitle: 'Jury instruction intelligence', sections: [{ heading: 'Instructions', body: demoCharges.map((c) => `CALCRIM ${c.calcrim} — ${c.code} ${c.section} (illustrative).`) }] },
  discovery: { type: 'discovery', title: 'Discovery Summary', subtitle: 'Brady / Giglio / Jencks', sections: [{ heading: 'Inventory', body: demoDiscovery.map((d) => `${d.title} — ${d.category} (illustrative).`) }] },
  evidence: { type: 'evidence', title: 'Evidence Summary', subtitle: 'Digital evidence intelligence', sections: [{ heading: 'Inventory', body: demoEvidence.map((e) => `${e.name} — ${e.type}; hash ${e.hash}; custody ${e.custody} (illustrative).`) }] },
  'knowledge-graph': { type: 'knowledge-graph', title: 'Knowledge Graph Report', subtitle: 'Case relationship intelligence', sections: [{ heading: 'Summary', body: [`${demoKnowledgeGraph.nodes.length} nodes / ${demoKnowledgeGraph.edges.length} edges including contradictions that undermine specific charges (illustrative).`] }] },
  timeline: { type: 'timeline', title: 'Timeline Report', subtitle: 'Chronological reconstruction', sections: [{ heading: 'Chronology', body: demoTimeline.map((t) => `${t.time} — ${t.title}: ${t.detail}`) }] },
  witness: { type: 'witness', title: 'Witness Report', subtitle: 'Witness & credibility intelligence', sections: [{ heading: 'Roster', body: demoWitnesses.map((w) => `${w.name} — ${w.type}; ${w.credibility} (illustrative).`) }] },
  'trial-prep': { type: 'trial-prep', title: 'Trial Preparation Report', subtitle: 'Readiness & exhibits', sections: [{ heading: 'Readiness', body: ['Evidence, witness, and discovery readiness with honest UNKNOWN where uncomputed (illustrative).'] }] },
  repository: { type: 'repository', title: 'Repository Summary', subtitle: 'CA legislative & CALCRIM coverage', sections: [{ heading: 'Authorities', body: demoAuthorities.map((a) => `${a.citation} — ${a.note}`) }] },
};

export const demoWorkspaces: Array<{ id: string; name: string; blurb: string; icon: string; to?: string }> = [
  { id: 'workbench', name: 'Attorney Workbench', blurb: 'Prosecution weaknesses, element analysis, defense opportunities & tasks.', icon: 'workbench', to: 'workbench' },
  { id: 'brief', name: 'Case Brief', blurb: 'Legal-assistant-grade case brief with weaknesses & recommendations.', icon: 'report', to: 'brief' },
  { id: 'contradictions', name: 'Contradiction Workspace', blurb: 'Conflicting witnesses, video, dispatch & physical evidence.', icon: 'contradiction', to: 'workbench#contradictions' },
  { id: 'defense', name: 'Defense Opportunities', blurb: 'Suppression, impeachment, misidentification & alibi.', icon: 'shield', to: 'workbench#defense' },
  { id: 'tasks', name: 'Investigative Tasks', blurb: 'Prioritized investigation plan with value & reason.', icon: 'search', to: 'workbench#tasks' },
  { id: 'knowledge-graph', name: 'Knowledge Graph', blurb: 'Interactive graph — contradictions undermine specific charges.', icon: 'graph', to: 'knowledge-graph' },
  { id: 'timeline', name: 'Interactive Timeline', blurb: 'Clickable events with sources, evidence & contradictions.', icon: 'timeline', to: 'timeline' },
  { id: 'map', name: 'Investigative Mapping', blurb: 'Incident scene, camera candidates & travel-time aid.', icon: 'map', to: 'map' },
  { id: 'evidence', name: 'Evidence Workspace', blurb: 'Hash-verified exhibits, OCR & chain of custody.', icon: 'evidence', to: 'reports/evidence' },
  { id: 'calcrim', name: 'CALCRIM Center', blurb: 'Jury instruction discovery & element mapping.', icon: 'calcrim', to: 'reports/calcrim' },
  { id: 'sentencing', name: 'Sentencing Center', blurb: 'Classification, enhancements, exposure.', icon: 'sentencing', to: 'reports/sentencing' },
  { id: 'attorney-report', name: 'Attorney Report', blurb: 'Comprehensive case intelligence report.', icon: 'report', to: 'reports/attorney-report' },
];
