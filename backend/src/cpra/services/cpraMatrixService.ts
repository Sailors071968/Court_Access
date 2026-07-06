// ============================================================================
// CourtAccess — CPRA Policy Matrix Service
// Manages the agency × policy topic status matrix for CPRA tracking.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyMatrixStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'RECEIVED'
  | 'UPLOADED'
  | 'IN_USE';

export interface AgencyPolicyMatrixEntry {
  id: string;
  agencyId: string;
  topicId: string;
  status: PolicyMatrixStatus;
  requestDate: string | null;
  receivedDate: string | null;
  uploadedDate: string | null;
  inUseDate: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CpraAgencyInfo {
  agencyId: string;
  agencyName: string;
  state: string;
  city: string | null;
  email: string | null;
  cpraContact: string | null;
  website: string | null;
}

export interface PolicyTopicInfo {
  topicId: string;
  topicName: string;
  description: string | null;
}

export interface MatrixFilterOptions {
  state?: string;
  agencyId?: string;
  topicId?: string;
  status?: PolicyMatrixStatus;
}

export interface MatrixSummary {
  totalAgencies: number;
  totalTopics: number;
  statusBreakdown: Record<PolicyMatrixStatus, number>;
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Canonical Policy Topics — 40+ topics as specified
// ---------------------------------------------------------------------------

export const CANONICAL_POLICY_TOPICS: Array<{ topicName: string; description: string }> = [
  { topicName: 'Use of Force', description: 'General use of force policies and procedures' },
  { topicName: 'Deadly Force', description: 'Policies governing lethal force by officers' },
  { topicName: 'Body Worn Cameras', description: 'Body-worn camera activation, deactivation, and retention' },
  { topicName: 'Dash Cameras', description: 'Dashboard camera policies for patrol vehicles' },
  { topicName: 'Vehicle Pursuits', description: 'Vehicle pursuit initiation, continuation, and termination' },
  { topicName: 'Search and Seizure', description: 'Policies governing searches of persons, vehicles, and property' },
  { topicName: 'Evidence Handling', description: 'Collection, processing, and handling of physical evidence' },
  { topicName: 'Evidence Storage', description: 'Secure storage and retention of evidence' },
  { topicName: 'Evidence Chain of Custody', description: 'Documentation and transfer of evidence custody' },
  { topicName: 'Arrest Procedures', description: 'Policies governing lawful arrest and booking' },
  { topicName: 'Detention Procedures', description: 'Temporary detention and investigative stops' },
  { topicName: 'Report Writing', description: 'Standards for incident report documentation' },
  { topicName: 'Officer Discipline', description: 'Disciplinary procedures and progressive discipline' },
  { topicName: 'Interrogations', description: 'Suspect interrogation procedures and Miranda compliance' },
  { topicName: 'Witness Interviews', description: 'Policies for interviewing witnesses and victims' },
  { topicName: 'Crime Scene Procedures', description: 'Crime scene security, processing, and documentation' },
  { topicName: 'Digital Evidence Handling', description: 'Collection and preservation of digital/electronic evidence' },
  { topicName: 'Informant Handling', description: 'Policies for managing confidential informants' },
  { topicName: 'Officer-Involved Shootings', description: 'Investigation procedures after officer-involved shootings' },
  { topicName: 'Use of K9 Units', description: 'Deployment and use of police canine units' },
  { topicName: 'Use of Tasers', description: 'Conducted energy device deployment policies' },
  { topicName: 'Use of Chemical Agents', description: 'OC spray, CS gas, and chemical agent deployment' },
  { topicName: 'Use of Less Lethal Weapons', description: 'Bean bag rounds, rubber bullets, and impact munitions' },
  { topicName: 'Officer Bodycam Activation', description: 'Mandatory activation triggers for body-worn cameras' },
  { topicName: 'Officer Bodycam Deactivation', description: 'Authorized deactivation circumstances for body-worn cameras' },
  { topicName: 'Public Complaint Procedures', description: 'Citizen complaint intake, investigation, and resolution' },
  { topicName: 'Internal Affairs Investigations', description: 'Internal investigation procedures and timelines' },
  { topicName: 'Duty to Intervene', description: 'Officer obligation to intervene in excessive force situations' },
  { topicName: 'Duty to Report Misconduct', description: 'Officer obligation to report policy deviations or misconduct' },
  { topicName: 'Drone Operations', description: 'Unmanned aerial vehicle deployment and surveillance policies' },
  { topicName: 'SWAT Procedures', description: 'Special weapons and tactics team deployment criteria' },
  { topicName: 'Crowd Control', description: 'Crowd management, dispersal orders, and protest response' },
  { topicName: 'Use of Surveillance Technology', description: 'Electronic surveillance, wiretaps, and monitoring policies' },
  { topicName: 'License Plate Readers', description: 'Automated license plate reader deployment and data retention' },
  { topicName: 'Racial Profiling Prevention', description: 'Anti-bias policing and racial profiling prohibition' },
  { topicName: 'De-escalation Techniques', description: 'Required de-escalation tactics before force application' },
  { topicName: 'Mental Health Crisis Response', description: 'Procedures for encounters with persons in mental health crisis' },
  { topicName: 'Juvenile Procedures', description: 'Special procedures for interactions with minors' },
  { topicName: 'Domestic Violence Response', description: 'Mandatory arrest and victim assistance policies' },
  { topicName: 'Officer Wellness Programs', description: 'Mental health support and peer counseling for officers' },
  { topicName: 'Foot Pursuit Policy', description: 'Policies governing foot pursuit initiation and termination' },
  { topicName: 'Neck Restraint Policy', description: 'Policies on carotid restraints and chokeholds' },
  { topicName: 'No-Knock Warrant Policy', description: 'Policies governing no-knock warrant execution' },
  { topicName: 'Social Media Policy', description: 'Officer social media use and department communications' },
  { topicName: 'Use of Force Reporting', description: 'Mandatory reporting requirements after any use of force' },
];

// ---------------------------------------------------------------------------
// In-Memory Store (production would use Prisma)
// ---------------------------------------------------------------------------

const matrixStore = new Map<string, AgencyPolicyMatrixEntry>();
const agencyStore = new Map<string, CpraAgencyInfo>();
const topicStore = new Map<string, PolicyTopicInfo>();

// Initialize topics from canonical list
function initializeTopics(): void {
  if (topicStore.size > 0) return;
  for (const topic of CANONICAL_POLICY_TOPICS) {
    const topicId = uuidv4();
    topicStore.set(topicId, {
      topicId,
      topicName: topic.topicName,
      description: topic.description,
    });
  }
}

// ---------------------------------------------------------------------------
// Topic CRUD
// ---------------------------------------------------------------------------

export function getAllTopics(): PolicyTopicInfo[] {
  initializeTopics();
  return Array.from(topicStore.values()).sort((a, b) =>
    a.topicName.localeCompare(b.topicName),
  );
}

export function getTopicById(topicId: string): PolicyTopicInfo | null {
  initializeTopics();
  return topicStore.get(topicId) ?? null;
}

// ---------------------------------------------------------------------------
// Agency CRUD
// ---------------------------------------------------------------------------

export function getAllAgencies(): CpraAgencyInfo[] {
  return Array.from(agencyStore.values()).sort((a, b) =>
    a.agencyName.localeCompare(b.agencyName),
  );
}

export function getAgencyById(agencyId: string): CpraAgencyInfo | null {
  return agencyStore.get(agencyId) ?? null;
}

export function upsertAgency(agency: CpraAgencyInfo): CpraAgencyInfo {
  agencyStore.set(agency.agencyId, agency);
  return agency;
}

export function seedAgency(data: Omit<CpraAgencyInfo, 'agencyId'>): CpraAgencyInfo {
  const agencyId = uuidv4();
  const agency: CpraAgencyInfo = { agencyId, ...data };
  agencyStore.set(agencyId, agency);
  return agency;
}

// ---------------------------------------------------------------------------
// Matrix CRUD
// ---------------------------------------------------------------------------

function matrixKey(agencyId: string, topicId: string): string {
  return `${agencyId}:${topicId}`;
}

export function getMatrixEntry(
  agencyId: string,
  topicId: string,
): AgencyPolicyMatrixEntry | null {
  return matrixStore.get(matrixKey(agencyId, topicId)) ?? null;
}

export function upsertMatrixEntry(
  agencyId: string,
  topicId: string,
  update: Partial<Pick<AgencyPolicyMatrixEntry, 'status' | 'requestDate' | 'receivedDate' | 'uploadedDate' | 'inUseDate' | 'fileUrl' | 'notes'>>,
): AgencyPolicyMatrixEntry {
  const key = matrixKey(agencyId, topicId);
  const existing = matrixStore.get(key);
  const now = new Date().toISOString();

  if (existing) {
    const updated: AgencyPolicyMatrixEntry = {
      ...existing,
      ...update,
      updatedAt: now,
    };
    // Auto-set dates based on status transitions
    if (update.status === 'REQUESTED' && !updated.requestDate) {
      updated.requestDate = now;
    }
    if (update.status === 'RECEIVED' && !updated.receivedDate) {
      updated.receivedDate = now;
    }
    if (update.status === 'UPLOADED' && !updated.uploadedDate) {
      updated.uploadedDate = now;
    }
    if (update.status === 'IN_USE' && !updated.inUseDate) {
      updated.inUseDate = now;
    }
    matrixStore.set(key, updated);
    return updated;
  }

  const entry: AgencyPolicyMatrixEntry = {
    id: uuidv4(),
    agencyId,
    topicId,
    status: update.status ?? 'NOT_REQUESTED',
    requestDate: update.requestDate ?? (update.status === 'REQUESTED' ? now : null),
    receivedDate: update.receivedDate ?? (update.status === 'RECEIVED' ? now : null),
    uploadedDate: update.uploadedDate ?? (update.status === 'UPLOADED' ? now : null),
    inUseDate: update.inUseDate ?? (update.status === 'IN_USE' ? now : null),
    fileUrl: update.fileUrl ?? null,
    notes: update.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  matrixStore.set(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Matrix Queries
// ---------------------------------------------------------------------------

export function getFullMatrix(
  filters?: MatrixFilterOptions,
): AgencyPolicyMatrixEntry[] {
  let entries = Array.from(matrixStore.values());

  if (filters?.agencyId) {
    entries = entries.filter((e) => e.agencyId === filters.agencyId);
  }
  if (filters?.topicId) {
    entries = entries.filter((e) => e.topicId === filters.topicId);
  }
  if (filters?.status) {
    entries = entries.filter((e) => e.status === filters.status);
  }
  if (filters?.state) {
    const agenciesInState = Array.from(agencyStore.values())
      .filter((a) => a.state === filters.state)
      .map((a) => a.agencyId);
    entries = entries.filter((e) => agenciesInState.includes(e.agencyId));
  }

  return entries;
}

export function getMatrixForAgency(agencyId: string): AgencyPolicyMatrixEntry[] {
  return Array.from(matrixStore.values()).filter((e) => e.agencyId === agencyId);
}

export function getMatrixSummary(): MatrixSummary {
  const entries = Array.from(matrixStore.values());
  const agencyIds = new Set(entries.map((e) => e.agencyId));
  const topicIds = new Set(entries.map((e) => e.topicId));

  const statusBreakdown: Record<PolicyMatrixStatus, number> = {
    NOT_REQUESTED: 0,
    REQUESTED: 0,
    RECEIVED: 0,
    UPLOADED: 0,
    IN_USE: 0,
  };

  for (const entry of entries) {
    const status = entry.status as PolicyMatrixStatus;
    if (status in statusBreakdown) {
      statusBreakdown[status]++;
    }
  }

  const totalCells = entries.length;
  const activeCells = entries.filter((e) => e.status !== 'NOT_REQUESTED').length;
  const coveragePercent = totalCells > 0 ? Math.round((activeCells / totalCells) * 100) : 0;

  return {
    totalAgencies: agencyIds.size,
    totalTopics: topicIds.size,
    statusBreakdown,
    coveragePercent,
  };
}

// ---------------------------------------------------------------------------
// Seed Data — sample agencies for development
// ---------------------------------------------------------------------------

export function seedSampleAgencies(): CpraAgencyInfo[] {
  const sampleAgencies: Array<Omit<CpraAgencyInfo, 'agencyId'>> = [
    { agencyName: 'Sacramento Police Department', state: 'CA', city: 'Sacramento', email: 'records@sacpd.org', cpraContact: 'Records Division', website: 'https://www.cityofsacramento.org/police' },
    { agencyName: 'Los Angeles Police Department', state: 'CA', city: 'Los Angeles', email: 'records@lapd.online', cpraContact: 'Discovery Unit', website: 'https://www.lapdonline.org' },
    { agencyName: 'San Francisco Police Department', state: 'CA', city: 'San Francisco', email: 'sfpdrecords@sfgov.org', cpraContact: 'Records Section', website: 'https://www.sanfranciscopolice.org' },
    { agencyName: 'San Diego Police Department', state: 'CA', city: 'San Diego', email: 'records@pd.sandiego.gov', cpraContact: 'Records Unit', website: 'https://www.sandiego.gov/police' },
    { agencyName: 'San Jose Police Department', state: 'CA', city: 'San Jose', email: 'records@sjpd.org', cpraContact: 'Records Bureau', website: 'https://www.sjpd.org' },
    { agencyName: 'Oakland Police Department', state: 'CA', city: 'Oakland', email: 'records@oaklandca.gov', cpraContact: 'Records Section', website: 'https://www.oaklandca.gov/departments/police' },
    { agencyName: 'Fresno Police Department', state: 'CA', city: 'Fresno', email: 'records@fresno.gov', cpraContact: 'Records Division', website: 'https://www.fresno.gov/police' },
    { agencyName: 'Long Beach Police Department', state: 'CA', city: 'Long Beach', email: 'records@longbeach.gov', cpraContact: 'Records Bureau', website: 'https://www.longbeach.gov/police' },
    { agencyName: 'Riverside Police Department', state: 'CA', city: 'Riverside', email: 'records@riversideca.gov', cpraContact: 'Records Section', website: 'https://www.riversideca.gov/rpd' },
    { agencyName: 'Bakersfield Police Department', state: 'CA', city: 'Bakersfield', email: 'records@bakersfieldpd.us', cpraContact: 'Records Division', website: 'https://www.bakersfieldpd.us' },
    { agencyName: 'Los Angeles County Sheriff', state: 'CA', city: 'Los Angeles', email: 'records@lasd.org', cpraContact: 'Discovery Unit', website: 'https://lasd.org' },
    { agencyName: 'Orange County Sheriff', state: 'CA', city: 'Santa Ana', email: 'records@ocsd.org', cpraContact: 'Records Bureau', website: 'https://www.ocsheriff.gov' },
    { agencyName: 'San Bernardino County Sheriff', state: 'CA', city: 'San Bernardino', email: 'records@sbcsd.org', cpraContact: 'Records Section', website: 'https://wp.sbcounty.gov/sheriff' },
    { agencyName: 'Alameda County Sheriff', state: 'CA', city: 'Oakland', email: 'records@acgov.org', cpraContact: 'Records Division', website: 'https://www.alamedacountysheriff.org' },
    { agencyName: 'California Highway Patrol', state: 'CA', city: null, email: 'records@chp.ca.gov', cpraContact: 'Public Records Unit', website: 'https://www.chp.ca.gov' },
  ];

  const seeded: CpraAgencyInfo[] = [];
  for (const data of sampleAgencies) {
    // Only seed if not already present
    const existing = Array.from(agencyStore.values()).find(
      (a) => a.agencyName === data.agencyName,
    );
    if (!existing) {
      seeded.push(seedAgency(data));
    }
  }

  return seeded;
}

/**
 * Initialize the matrix with NOT_REQUESTED status for all agency × topic combinations.
 */
export function initializeMatrix(): { agencies: number; topics: number; cells: number } {
  initializeTopics();
  const agencies = getAllAgencies();
  const topics = getAllTopics();
  let cellsCreated = 0;

  for (const agency of agencies) {
    for (const topic of topics) {
      const key = matrixKey(agency.agencyId, topic.topicId);
      if (!matrixStore.has(key)) {
        upsertMatrixEntry(agency.agencyId, topic.topicId, { status: 'NOT_REQUESTED' });
        cellsCreated++;
      }
    }
  }

  return { agencies: agencies.length, topics: topics.length, cells: cellsCreated };
}
