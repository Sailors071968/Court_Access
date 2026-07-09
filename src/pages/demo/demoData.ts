// ============================================================================
// Program 94 — Illustrative Litigation Demonstration Data
//
// ⚠️ EVERY VALUE IN THIS FILE IS A FICTIONAL, ILLUSTRATIVE EXAMPLE.
// It exists ONLY to demonstrate the CourtAccess product to prospective
// customers. It is NOT actual case data, NOT a real client, NOT real evidence,
// and must never be presented as production information. The fictional case
// name, number, people, and facts are invented for demonstration purposes.
// ============================================================================

import type { KnowledgeGraphData } from '../../components/graph/types';

export const DEMO_DISCLAIMER = {
  title: 'ILLUSTRATIVE EXAMPLE',
  line1: 'DEMONSTRATION ONLY',
  line2: 'NOT ACTUAL CASE INFORMATION',
};

export const demoCase = {
  title: 'People v. Jordan A. Rivera (ILLUSTRATIVE)',
  caseNumber: 'DEMO-2026-000001',
  court: 'Superior Court of California, County of Demonstration',
  judge: 'Hon. Pat Delgado (illustrative)',
  attorney: 'Sarah Chen, Esq. (illustrative)',
  prosecutor: 'Office of the District Attorney (illustrative)',
  status: 'Pretrial',
  jurisdiction: 'CA',
  filingDate: '2026-02-11',
  trialDate: '2026-09-14',
};

export const demoStats = {
  charges: 3,
  evidence: 7,
  witnesses: 5,
  discovery: 9,
  timelineEvents: 13,
  motions: 4,
  authorities: 8,
  kgNodes: 24,
};

export const demoCharges = [
  { code: 'PC', section: '211', title: 'Robbery (illustrative)', classification: 'Felony', calcrim: '1600', primary: true },
  { code: 'PC', section: '459', title: 'Burglary (illustrative)', classification: 'Felony (wobbler)', calcrim: '1700', primary: false },
  { code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon (illustrative)', classification: 'Felony (wobbler)', calcrim: '875', primary: false },
];

export const demoEvidence = [
  { name: 'bodycam_officer_martinez.mp4', type: 'Body-worn camera', hash: '9f2a…c418', ocr: 'analyzed', custody: 'complete' },
  { name: '911_call_recording.wav', type: '911 audio', hash: '3d81…7b02', ocr: 'analyzed', custody: 'complete' },
  { name: 'store_surveillance.mp4', type: 'Surveillance video', hash: 'a71c…9e55', ocr: 'analyzed', custody: 'partial' },
  { name: 'police_report_2026-0211.pdf', type: 'Police report', hash: 'c904…12af', ocr: 'analyzed', custody: 'complete' },
  { name: 'forensic_latent_prints.pdf', type: 'Forensic report', hash: 'ee20…4a7d', ocr: 'analyzed', custody: 'complete' },
  { name: 'witness_statement_doe.pdf', type: 'Witness statement', hash: '5b6f…88c1', ocr: 'analyzed', custody: 'complete' },
  { name: 'booking_photos.zip', type: 'Booking record', hash: '1a44…d0e9', ocr: 'pending', custody: 'partial' },
];

export const demoWitnesses = [
  { name: 'Officer M. Martinez (illustrative)', type: 'Law enforcement', interview: 'completed', credibility: 'To be assessed' },
  { name: 'A. Doe (illustrative)', type: 'Eyewitness', interview: 'scheduled', credibility: 'To be assessed' },
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

export interface DemoTimelineEvent {
  phase: string;
  time: string;
  title: string;
  detail: string;
  kind: 'incident' | 'investigation' | 'court' | 'evidence' | 'discovery';
}

export const demoTimeline: DemoTimelineEvent[] = [
  { phase: 'Incident', time: '2026-02-11 21:04', title: 'Reported incident', detail: 'Alleged robbery reported at retail location (illustrative).', kind: 'incident' },
  { phase: '911 Call', time: '2026-02-11 21:06', title: '911 call placed', detail: 'Caller reports suspect fleeing on foot (illustrative).', kind: 'incident' },
  { phase: 'Officer Arrival', time: '2026-02-11 21:13', title: 'First officer on scene', detail: 'Officer Martinez arrives; body-worn camera activated (illustrative).', kind: 'investigation' },
  { phase: 'Witness Statements', time: '2026-02-11 21:40', title: 'Initial witness statements', detail: 'Eyewitness and victim provide statements (illustrative).', kind: 'investigation' },
  { phase: 'Evidence Collection', time: '2026-02-11 22:30', title: 'Evidence collected', detail: 'Surveillance footage secured; latent prints lifted (illustrative).', kind: 'evidence' },
  { phase: 'Arrest', time: '2026-02-12 01:15', title: 'Arrest made', detail: 'Suspect detained several blocks away (illustrative).', kind: 'investigation' },
  { phase: 'Booking', time: '2026-02-12 02:40', title: 'Booking processed', detail: 'Booking photos and property inventory recorded (illustrative).', kind: 'investigation' },
  { phase: 'Discovery', time: '2026-03-02', title: 'Initial discovery produced', detail: 'Prosecution produces reports, CAD log, and media (illustrative).', kind: 'discovery' },
  { phase: 'Preliminary Hearing', time: '2026-04-18', title: 'Preliminary hearing', detail: 'Court finds sufficient cause to hold to answer (illustrative).', kind: 'court' },
  { phase: 'Motions', time: '2026-05-20', title: 'Pretrial motions filed', detail: 'Defense files motion to suppress and Pitchess motion (illustrative).', kind: 'court' },
  { phase: 'Trial', time: '2026-09-14', title: 'Jury trial (scheduled)', detail: 'Jury selection and trial (illustrative, scheduled).', kind: 'court' },
  { phase: 'Verdict', time: 'Pending', title: 'Verdict', detail: 'UNKNOWN — illustrative example, outcome not determined.', kind: 'court' },
  { phase: 'Sentencing', time: 'Pending', title: 'Sentencing', detail: 'UNKNOWN — illustrative example, no sentence imposed.', kind: 'court' },
];

export const demoAuthorities = [
  { citation: 'Cal. Penal Code § 211', note: 'Robbery — illustrative statute reference' },
  { citation: 'Cal. Penal Code § 459', note: 'Burglary — illustrative statute reference' },
  { citation: 'Cal. Penal Code § 245(a)(1)', note: 'Assault with a deadly weapon — illustrative' },
  { citation: 'CALCRIM No. 1600', note: 'Robbery instruction — illustrative' },
  { citation: 'CALCRIM No. 1700', note: 'Burglary instruction — illustrative' },
  { citation: 'CALCRIM No. 220', note: 'Reasonable doubt — illustrative' },
  { citation: 'People v. Example (2019) 00 Cal.5th 000', note: 'Illustrative case authority (fictional citation)' },
  { citation: 'Brady v. Maryland (1963) 373 U.S. 83', note: 'Disclosure of favorable evidence' },
];

// Illustrative Knowledge Graph — fictional nodes/edges for demonstration.
export const demoKnowledgeGraph: KnowledgeGraphData = {
  nodes: [
    { id: 'case', type: 'organization', label: 'People v. Rivera (illustrative)', repositorySource: 'Demonstration' },
    { id: 'def', type: 'person', label: 'Defendant (illustrative)' },
    { id: 'ch1', type: 'charge', label: 'PC 211 Robbery', repositorySource: 'CA Penal Code' },
    { id: 'ch2', type: 'charge', label: 'PC 459 Burglary', repositorySource: 'CA Penal Code' },
    { id: 'ch3', type: 'charge', label: 'PC 245(a)(1) ADW', repositorySource: 'CA Penal Code' },
    { id: 'st1', type: 'statute', label: 'PC 211', repositorySource: 'CA Legislative' },
    { id: 'st2', type: 'statute', label: 'PC 459', repositorySource: 'CA Legislative' },
    { id: 'cal1', type: 'calcrim', label: 'CALCRIM 1600', repositorySource: 'CALCRIM' },
    { id: 'cal2', type: 'calcrim', label: 'CALCRIM 1700', repositorySource: 'CALCRIM' },
    { id: 'auth1', type: 'authority', label: 'Brady v. Maryland', repositorySource: 'CourtListener' },
    { id: 'ev1', type: 'evidence', label: 'Body-worn camera', evidenceCitations: ['bodycam_officer_martinez.mp4'] },
    { id: 'ev2', type: 'evidence', label: '911 audio', evidenceCitations: ['911_call_recording.wav'] },
    { id: 'ev3', type: 'evidence', label: 'Surveillance video', evidenceCitations: ['store_surveillance.mp4'] },
    { id: 'ev4', type: 'evidence', label: 'Forensic report', evidenceCitations: ['forensic_latent_prints.pdf'] },
    { id: 'w1', type: 'witness', label: 'Officer Martinez' },
    { id: 'w2', type: 'witness', label: 'Eyewitness A. Doe' },
    { id: 'w3', type: 'witness', label: 'Victim R. Kim' },
    { id: 'w4', type: 'witness', label: 'Forensic expert' },
    { id: 't1', type: 'timeline_event', label: 'Incident 21:04', timestamp: '2026-02-11T21:04:00Z' },
    { id: 't2', type: 'timeline_event', label: 'Officer arrival 21:13', timestamp: '2026-02-11T21:13:00Z' },
    { id: 't3', type: 'timeline_event', label: 'Arrest 01:15', timestamp: '2026-02-12T01:15:00Z' },
    { id: 'loc1', type: 'location', label: 'Retail location (illustrative)' },
    { id: 'doc1', type: 'document', label: 'Motion to Suppress' },
    { id: 'con1', type: 'contradiction', label: 'Timeline discrepancy (illustrative)' },
  ],
  edges: [
    { from: 'case', to: 'def', relation: 'defendant', strength: 1 },
    { from: 'case', to: 'ch1', relation: 'charge', strength: 1 },
    { from: 'case', to: 'ch2', relation: 'charge', strength: 0.9 },
    { from: 'case', to: 'ch3', relation: 'charge', strength: 0.9 },
    { from: 'ch1', to: 'st1', relation: 'statute', strength: 0.8 },
    { from: 'ch2', to: 'st2', relation: 'statute', strength: 0.8 },
    { from: 'ch1', to: 'cal1', relation: 'instruction', strength: 0.7 },
    { from: 'ch2', to: 'cal2', relation: 'instruction', strength: 0.7 },
    { from: 'ch1', to: 'auth1', relation: 'authority', strength: 0.5 },
    { from: 'ev1', to: 'w1', relation: 'source', strength: 0.9 },
    { from: 'ev2', to: 't1', relation: 'documents', strength: 0.8 },
    { from: 'ev3', to: 'loc1', relation: 'depicts', strength: 0.7 },
    { from: 'ev4', to: 'ch1', relation: 'supports', strength: 0.6 },
    { from: 'w1', to: 't2', relation: 'observed', strength: 0.8 },
    { from: 'w2', to: 't1', relation: 'observed', strength: 0.7 },
    { from: 'w3', to: 'ch1', relation: 'victim', strength: 0.9 },
    { from: 'w4', to: 'ev4', relation: 'authored', strength: 0.8 },
    { from: 't1', to: 't2', relation: 'precedes', strength: 0.6 },
    { from: 't2', to: 't3', relation: 'precedes', strength: 0.6 },
    { from: 'doc1', to: 'ev1', relation: 'challenges', strength: 0.5 },
    { from: 'con1', to: 'ev3', relation: 'flags', strength: 0.5 },
    { from: 'con1', to: 'w2', relation: 'flags', strength: 0.4 },
    { from: 'def', to: 'loc1', relation: 'present-at', strength: 0.5 },
  ],
};

export type DemoReportType =
  | 'attorney-report' | 'motion' | 'voir-dire' | 'sentencing' | 'calcrim'
  | 'discovery' | 'evidence' | 'knowledge-graph' | 'timeline' | 'witness'
  | 'trial-prep' | 'repository';

export interface DemoReportSection { heading: string; body: string[] }
export interface DemoReport {
  type: DemoReportType;
  title: string;
  subtitle: string;
  sections: DemoReportSection[];
}

export const demoReports: Record<DemoReportType, DemoReport> = {
  'attorney-report': {
    type: 'attorney-report', title: 'Attorney Report', subtitle: 'Comprehensive repository-backed case intelligence',
    sections: [
      { heading: 'Executive Summary', body: [`${demoCase.title} · Case No. ${demoCase.caseNumber}. ${demoStats.charges} charges, ${demoStats.evidence} evidence items, ${demoStats.witnesses} witnesses, ${demoStats.timelineEvents} timeline events. Repository integrity: verified. Knowledge graph: generated.`] },
      { heading: 'Charge Analysis', body: demoCharges.map((c) => `${c.code} ${c.section} — ${c.title} (${c.classification}); linked CALCRIM ${c.calcrim}.`) },
      { heading: 'Evidence Analysis', body: [`${demoStats.evidence} exhibits with SHA-256 verification and chain-of-custody tracking; OCR-processed and cross-linked to timeline and witnesses.`] },
      { heading: 'Analysis', body: ['Illustrative case-strength, contradiction, and coverage findings — every conclusion cites supporting evidence and authority. UNKNOWN is displayed wherever repository evidence is insufficient.'] },
      { heading: 'Recommendations', body: ['Repository-derived motion topics, witness follow-up, and discovery requests — attorney verification required.'] },
    ],
  },
  motion: {
    type: 'motion', title: 'Motion to Suppress', subtitle: 'Repository-backed motion draft',
    sections: [
      { heading: 'I. Introduction', body: ['Defendant respectfully moves to suppress evidence pursuant to Cal. Penal Code § 1538.5 and the Fourth Amendment (illustrative).'] },
      { heading: 'II. Statement of Facts', body: ['Facts assembled from the case timeline and evidence, each cited (illustrative).'] },
      { heading: 'III. Applicable Law', body: ['Cal. Penal Code § 1538.5; U.S. Const. amend. IV (illustrative standard authority).'] },
      { heading: 'IV. Analysis', body: ['Repository contradictions and chain-of-custody gaps support the requested relief (illustrative).'] },
      { heading: 'V. Conclusion', body: ['For the foregoing reasons, Defendant requests the challenged evidence be suppressed (illustrative).'] },
    ],
  },
  'voir-dire': {
    type: 'voir-dire', title: 'Voir Dire Notebook', subtitle: 'Repository-derived question library',
    sections: [
      { heading: 'Presumption of Innocence', body: ['Do you accept that the defendant is presumed innocent? (CALCRIM 220 — illustrative)'] },
      { heading: 'Law Enforcement', body: ['Would you give more or less weight to an officer’s testimony? (CALCRIM 226 — illustrative)'] },
      { heading: 'Charge-Specific', body: ['Do you have strong feelings about robbery charges that would affect impartiality? (illustrative)'] },
    ],
  },
  sentencing: {
    type: 'sentencing', title: 'Sentencing Notebook', subtitle: 'Repository-backed classification & exposure',
    sections: [
      { heading: 'Offense Sentencing', body: demoCharges.map((c) => `${c.code} ${c.section} — ${c.classification} (illustrative classification).`) },
      { heading: 'Enhancement Analysis', body: ['Enhancements flagged only where referenced in repository text; otherwise UNKNOWN (illustrative).'] },
      { heading: 'Criminal Exposure', body: ['Numeric exposure is UNKNOWN and never estimated; verbatim statutory penalty provisions are listed as the basis (illustrative).'] },
    ],
  },
  calcrim: {
    type: 'calcrim', title: 'CALCRIM Report', subtitle: 'Jury instruction intelligence',
    sections: [
      { heading: 'Discovered Instructions', body: demoCharges.map((c) => `CALCRIM ${c.calcrim} — linked to ${c.code} ${c.section} (illustrative).`) },
      { heading: 'Element Analysis', body: ['Each instruction maps required elements to supporting evidence; unsupported elements shown as UNKNOWN (illustrative).'] },
    ],
  },
  discovery: {
    type: 'discovery', title: 'Discovery Summary', subtitle: 'Brady / Giglio / Jencks tracking',
    sections: [
      { heading: 'Discovery Inventory', body: demoDiscovery.map((d) => `${d.title} — ${d.category}${d.brady ? ' · Brady' : ''}${d.giglio ? ' · Giglio' : ''}${d.jencks ? ' · Jencks' : ''} (illustrative).`) },
    ],
  },
  evidence: {
    type: 'evidence', title: 'Evidence Summary', subtitle: 'Digital evidence intelligence',
    sections: [
      { heading: 'Evidence Inventory', body: demoEvidence.map((e) => `${e.name} — ${e.type}; SHA-256 ${e.hash}; OCR ${e.ocr}; custody ${e.custody} (illustrative).`) },
    ],
  },
  'knowledge-graph': {
    type: 'knowledge-graph', title: 'Knowledge Graph Report', subtitle: 'Case relationship intelligence',
    sections: [
      { heading: 'Graph Summary', body: [`${demoKnowledgeGraph.nodes.length} nodes and ${demoKnowledgeGraph.edges.length} edges across charges, evidence, witnesses, timeline, statutes, CALCRIM, and authorities (illustrative).`] },
    ],
  },
  timeline: {
    type: 'timeline', title: 'Timeline Report', subtitle: 'Chronological event reconstruction',
    sections: [
      { heading: 'Chronology', body: demoTimeline.map((t) => `${t.time} — ${t.title}: ${t.detail}`) },
    ],
  },
  witness: {
    type: 'witness', title: 'Witness Report', subtitle: 'Witness & credibility intelligence',
    sections: [
      { heading: 'Witness Roster', body: demoWitnesses.map((w) => `${w.name} — ${w.type}; interview ${w.interview}; credibility ${w.credibility} (illustrative).`) },
    ],
  },
  'trial-prep': {
    type: 'trial-prep', title: 'Trial Preparation Report', subtitle: 'Readiness, exhibits & witness order',
    sections: [
      { heading: 'Readiness', body: ['Evidence readiness, witness readiness, discovery status, and repository coverage with honest UNKNOWN where uncomputed (illustrative).'] },
      { heading: 'Exhibit List', body: demoEvidence.slice(0, 4).map((e, i) => `Exhibit ${i + 1}: ${e.name} — ${e.type} (illustrative).`) },
    ],
  },
  repository: {
    type: 'repository', title: 'Repository Summary', subtitle: 'California legislative & CALCRIM coverage',
    sections: [
      { heading: 'Coverage', body: ['Illustrative repository coverage across California codes, CALCRIM instructions, and case authorities with provenance tracking.'] },
      { heading: 'Authorities', body: demoAuthorities.map((a) => `${a.citation} — ${a.note}`) },
    ],
  },
};

export const demoWorkspaces: Array<{ id: string; name: string; blurb: string; icon: string; to?: string }> = [
  { id: 'dashboard', name: 'Attorney Dashboard', blurb: 'Executive command center with real-time case intelligence.', icon: 'dashboard' },
  { id: 'overview', name: 'Case Overview', blurb: 'Flagship case summary with evidence-governed intelligence cards.', icon: 'overview' },
  { id: 'workbench', name: 'Attorney Workbench', blurb: 'One-click litigation launcher and command widgets.', icon: 'workbench' },
  { id: 'evidence', name: 'Evidence Workspace', blurb: 'Hash-verified exhibits, OCR, chain of custody.', icon: 'evidence' },
  { id: 'knowledge-graph', name: 'Knowledge Graph', blurb: 'Interactive relationship graph across the case.', icon: 'graph', to: 'knowledge-graph' },
  { id: 'timeline', name: 'Timeline', blurb: 'Chronological reconstruction of the incident.', icon: 'timeline', to: 'timeline' },
  { id: 'discovery', name: 'Discovery Workspace', blurb: 'Brady / Giglio / Jencks disclosure tracking.', icon: 'discovery', to: 'reports/discovery' },
  { id: 'witness', name: 'Witness Workspace', blurb: 'Credibility intelligence and prep.', icon: 'witness', to: 'reports/witness' },
  { id: 'voir-dire', name: 'Voir Dire', blurb: 'Repository-derived jury selection questions.', icon: 'voir-dire', to: 'reports/voir-dire' },
  { id: 'motion', name: 'Motion Builder', blurb: 'Repository-backed motion drafting with citations.', icon: 'motion', to: 'reports/motion' },
  { id: 'trial-prep', name: 'Trial Preparation', blurb: 'Readiness dashboard, exhibits, checklist.', icon: 'trial', to: 'reports/trial-prep' },
  { id: 'attorney-report', name: 'Attorney Report', blurb: 'Comprehensive case intelligence report.', icon: 'report', to: 'reports/attorney-report' },
  { id: 'calcrim', name: 'CALCRIM Center', blurb: 'Jury instruction discovery and element mapping.', icon: 'calcrim', to: 'reports/calcrim' },
  { id: 'sentencing', name: 'Sentencing Center', blurb: 'Classification, enhancements, exposure.', icon: 'sentencing', to: 'reports/sentencing' },
  { id: 'courtlistener', name: 'CourtListener', blurb: 'Federated case-law authority search.', icon: 'authority', to: 'reports/repository' },
  { id: 'research', name: 'Legal Research', blurb: 'California statutes, CALCRIM, and authorities.', icon: 'research', to: 'reports/repository' },
  { id: 'admin', name: 'Administration', blurb: 'Provider integrations and firm settings.', icon: 'admin' },
  { id: 'billing', name: 'Billing', blurb: 'Subscription and usage management.', icon: 'billing' },
  { id: 'search', name: 'Search', blurb: 'Global case, statute, and citation search.', icon: 'search' },
  { id: 'repository', name: 'Repository Browser', blurb: 'Browse the California legal repository.', icon: 'repository', to: 'reports/repository' },
  { id: 'landing', name: 'Landing Page', blurb: 'Premium public product presentation.', icon: 'landing' },
];
