// ============================================================================
// Program 12 — Investigator Workbench Types
// ============================================================================

export const INVESTIGATOR_WORKBENCH_VERSION = '1.0.0';

export interface InvestigatorWorkbenchBundle {
  generatedAt: string;
  version: string;
  caseId: string;
  tenantId: string;
  dashboard: {
    caseTitle: string;
    caseNumber: string;
    phase: string;
    assignmentCount: number;
    openTasks: number;
    openLeads: number;
    witnessCount: number;
    evidenceCount: number;
    unknownCount: number;
  };
  assignments: Array<{
    id: string;
    investigatorId: string;
    role: string;
    status: string;
    assignedAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignedTo: string | null;
    dueDate: string | null;
    sourceType: string | null;
  }>;
  leads: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignedTo: string | null;
  }>;
  witnesses: Array<{
    id: string;
    name: string;
    role: string | null;
    status: string;
    interviewStatus: string;
    contactPhone: string | null;
    sourceType: string | null;
    citations: Array<{ type: string; id: string }>;
  }>;
  interviews: Array<{
    witnessId: string;
    witnessName: string;
    interviewStatus: string;
    scheduledAt: string | null;
    notes: string | null;
  }>;
  evidenceCollection: {
    photos: Array<{ evidenceId: string; fileName: string; uploadedAt: string }>;
    videos: Array<{ evidenceId: string; fileName: string; uploadedAt: string }>;
    audio: Array<{ evidenceId: string; fileName: string; uploadedAt: string }>;
    other: Array<{ evidenceId: string; fileName: string; evidenceType: string }>;
  };
  chainOfCustody: Array<{
    evidenceId: string;
    fileName: string;
    status: 'complete' | 'partial' | 'unknown';
    uploadedAt: string;
    uploadedBy: string;
  }>;
  timeline: Array<{
    id: string;
    timestamp: string | null;
    description: string;
    actor: string | null;
    conflictFlag: boolean;
  }>;
  fieldNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    noteType: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
  }>;
  recommendedInvestigation: string[];
  gaps: {
    evidence: string[];
    witness: string[];
    timeline: string[];
  };
  unknowns: string[];
}
