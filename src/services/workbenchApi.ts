// ============================================================================
// Domain V — Attorney Workbench API Client
// ============================================================================

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface CitationRef {
  type: 'evidence' | 'authority' | 'timeline' | 'claim' | 'audit' | 'repository';
  id: string;
  label?: string;
}

export interface WorkbenchCommandCenter {
  caseHealth: { score: number; label: string; factors: string[] };
  evidenceHealth: { score: number; label: string; pending: number; failed: number };
  legalCoverage: { score: number; label: string; offensesCovered: number; offensesTotal: number };
  timelineCoverage: { score: number; label: string; eventCount: number; conflictCount: number };
  unknownCount: number;
  contradictionCount: number;
  motionOpportunities: number;
  discoveryStatus: { pending: number; acknowledged: number; total: number };
  investigationStatus: { open: number; inProgress: number; completed: number };
  trialReadiness: { score: number; label: string };
  productionGateStatus: { pass: number; total: number; status: string };
}

export interface ElementRow {
  chargeId: string;
  code: string;
  section: string;
  elementId: string;
  elementLabel: string;
  status: string;
  supportingEvidence: Array<{ evidenceId: string; role: string }>;
  contradictoryEvidence: Array<{ evidenceId: string; role: string }>;
  missingEvidenceReason: string | null;
  confidence: string;
}

export interface WorkbenchBundle {
  generatedAt: string;
  workbenchVersion: string;
  caseId: string;
  caseOverview: {
    client: { clientId: string; name: string } | null;
    case: { title: string; caseNumber: string; status: string; phase: string };
    charges: Array<{ id: string; code: string; section: string; title: string | null }>;
    court: string | null;
    judge: string | null;
    prosecutor: string | null;
    defenseTeam: Array<{ userId: string; role: string }>;
    currentStatus: string;
    upcomingHearings: Array<{ date: string | null; note: string | null }>;
    caseTimeline: Array<{ id: string; timestamp: string | null; description: string; actor: string | null; conflictFlag: boolean }>;
    intelligenceSummary: { unknownCount: number; riskCount: number; contradictionCount: number; offenseCount: number };
    outstandingUnknowns: string[];
    evidenceSummary: { total: number; byType: Record<string, number>; processingPending: number };
  };
  offenseAnalysis: Array<{
    chargeId: string;
    code: string;
    section: string;
    applicableCalcrim: Array<{ instructionNumber: string; title: string }>;
    defenses: string[];
    exceptions: string[];
    enhancements: string[];
    unknownLegalQuestions: string[];
  }>;
  elementMatrices: Array<{ chargeId: string; code: string; section: string; rows: ElementRow[] }>;
  evidenceWorkbench: {
    items: Array<{ evidenceId: string; fileName: string; evidenceType: string; processingStatus: string; confidence: string }>;
    contradictions: Array<{ id: string; finding: string; status: string }>;
    duplicates: Array<{ evidenceIds: string[]; reason: string }>;
    missing: string[];
    graph: { nodes: Array<{ id: string; type: string; label: string }>; edges: Array<{ from: string; to: string; relation: string }> };
  };
  legalAuthority: {
    calcrim: Array<{ id: string; finding: string }>;
    defenses: string[];
    exceptions: string[];
    enhancements: string[];
    relatedOffenses: string[];
    authorities: Array<{ id: string; finding: string }>;
  };
  investigation: {
    recommendedInvestigation: string[];
    recommendedSubpoenas: string[];
    recommendedDiscovery: string[];
    evidenceGaps: Array<{ finding: string }>;
    witnessGaps: Array<{ finding: string }>;
    timelineGaps: Array<{ finding: string }>;
    tasks: Array<{ id: string; title: string; status: string; priority: string; assignedTo: string | null }>;
    discoveryRequests: Array<{ id: string; title: string; status: string; priority: string }>;
  };
  trialPreparation: {
    witnessList: Array<{ id: string; title: string; detail: string; citations: CitationRef[] }>;
    exhibitList: Array<{ id: string; title: string; detail: string; citations: CitationRef[] }>;
    crossExaminationTopics: Array<{ id: string; title: string; detail: string; citations: CitationRef[] }>;
    impeachmentOpportunities: Array<{ id: string; title: string; detail: string; citations: CitationRef[] }>;
    openingOutline: Array<{ id: string; title: string; detail: string }>;
    closingOutline: Array<{ id: string; title: string; detail: string }>;
    trialNotebook: Array<{ id: string; title: string; detail: string; citations: CitationRef[] }>;
  };
  attorneyNotes: {
    notes: Array<{ id: string; title: string | null; content: string; createdAt: string }>;
    pins: Array<{ id: string; pinType: string; entityId: string; label: string | null }>;
  };
  commandCenter: WorkbenchCommandCenter;
  intelligence: { unknowns: { all: string[] }; recommendedMotions: string[] };
}

export type ExportPackageType =
  | 'attorney_report'
  | 'trial_notebook'
  | 'evidence_package'
  | 'witness_binder'
  | 'authority_binder'
  | 'motion_package'
  | 'discovery_package'
  | 'investigation_package'
  | 'chronology';

export async function fetchWorkbench(caseId: string): Promise<WorkbenchBundle> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to load workbench: HTTP ${res.status}`);
  return res.json();
}

export async function fetchWorkbenchExport(caseId: string, packageType: ExportPackageType): Promise<unknown> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench/export/${packageType}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  return res.json();
}

export async function createWorkbenchNote(caseId: string, content: string, title?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench/notes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content, title }),
  });
  if (!res.ok) throw new Error(`Failed to create note: HTTP ${res.status}`);
}

export async function createWorkbenchTask(
  caseId: string,
  data: { title: string; description?: string; priority?: string; assignedTo?: string },
): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create task: HTTP ${res.status}`);
}

export async function updateWorkbenchTask(
  caseId: string,
  taskId: string,
  data: { status?: string; assignedTo?: string; priority?: string },
): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench/tasks/${taskId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update task: HTTP ${res.status}`);
}

export async function pinWorkbenchItem(
  caseId: string,
  pinType: string,
  entityId: string,
  label?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/workbench/pins`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ pinType, entityId, label }),
  });
  if (!res.ok) throw new Error(`Failed to pin item: HTTP ${res.status}`);
}
