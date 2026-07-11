const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface VoirDireCitation {
  type: 'authority' | 'statute' | 'calcrim' | 'evidence' | 'witness' | 'repository' | 'kg' | 'constitutional';
  id: string;
  label?: string;
}

export interface VoirDireQuestion {
  id: string;
  text: string;
  citations: VoirDireCitation[];
  repositoryBacked: boolean;
}

export interface VoirDireCategory {
  id: string;
  label: string;
  basis: string;
  citations: VoirDireCitation[];
  questions: VoirDireQuestion[];
}

export interface ChallengeFramework {
  causeChallenges: { authority: string[]; guidance: string };
  peremptoryChallenges: { authority: string[]; guidance: string; batsonWheeler: string };
}

export interface VoirDireCenter {
  voirDireVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  header: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    generatedAt: string;
  };
  dashboard: {
    categoryCount: number;
    questionCount: number;
    repositoryBackedQuestions: number;
    chargeCount: number;
    authorityCount: number;
    knowledgeGraphStatus: string;
    humanReviewCount: number;
  };
  questionLibrary: VoirDireCategory[];
  challengeFramework: ChallengeFramework;
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  attorneyReview: {
    probeAreas: Array<{ id: string; area: string; rationale: string; citations: VoirDireCitation[] }>;
    humanReviewRequired: string[];
    incompleteInformation: string[];
    repositoryGaps: Array<{ id: string; label: string; value: string }>;
  };
}

// --- Attorney-entered juror & challenge records (client-persisted) ---
export interface JurorRecord {
  id: string;
  jurorNumber: string;
  seatNumber: string;
  notes: string;
  observedResponses: string;
  rating: 'favorable' | 'neutral' | 'unfavorable' | 'unknown';
  concerns: string;
}

export interface ChallengeRecord {
  id: string;
  jurorRef: string;
  type: 'cause' | 'peremptory';
  notes: string;
}

export async function fetchVoirDireCenter(caseId: string): Promise<VoirDireCenter> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/voir-dire`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to load Voir Dire center');
  }
  const data = await res.json();
  return (data.voirDire ?? data) as VoirDireCenter;
}
