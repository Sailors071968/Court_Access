const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface SentencingCitation {
  type: 'statute' | 'authority' | 'calcrim' | 'repository' | 'kg';
  id: string;
  label?: string;
}

export interface OffenseSentencing {
  chargeId: string;
  code: string;
  section: string;
  offenseTitle: string;
  offenseId: string | null;
  classification: string;
  classificationConfidence: string;
  isFelony: boolean;
  isMisdemeanor: boolean;
  isInfraction: boolean;
  isWobbler: boolean;
  isStraight: boolean;
  penaltyProvision: string;
  penaltyConfidence: string;
  baseTerm: string;
  lowerTerm: string;
  middleTerm: string;
  upperTerm: string;
  mandatoryMinimum: string;
  probationEligibility: string;
  diversionEligibility: string;
  alternativeSentencing: string;
  repositoryConfidence: string;
  citations: SentencingCitation[];
}

export interface EnhancementFinding {
  category: string;
  status: 'repository-referenced' | 'UNKNOWN';
  detail: string;
  citations: SentencingCitation[];
}

export interface SentencingCenter {
  sentencingVersion: string;
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
    chargeCount: number;
    felonies: number;
    misdemeanors: number;
    infractions: number;
    wobblers: number;
    unknownClassification: number;
    enhancementsReferenced: number;
    repositoryConfidence: string;
    humanReviewCount: number;
  };
  offenses: OffenseSentencing[];
  enhancements: EnhancementFinding[];
  defenseAnalysis: {
    defenses: Array<{ text: string; citations: SentencingCitation[] }>;
    exceptions: Array<{ text: string; citations: SentencingCitation[] }>;
    immunities: Array<{ text: string; citations: SentencingCitation[] }>;
  };
  exposure: {
    minimum: string;
    maximum: string;
    mandatoryTerms: string[];
    consecutiveTerms: string[];
    concurrentTerms: string[];
    repositoryConfidence: string;
    penaltyProvisions: Array<{ charge: string; provision: string; citations: SentencingCitation[] }>;
    note: string;
  };
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  attorneyReview: {
    repositoryGaps: string[];
    incompleteSentencingData: string[];
    manualReviewRequired: string[];
    unknownExposure: boolean;
    repositoryCoverage: string;
  };
}

export async function fetchSentencingCenter(caseId: string): Promise<SentencingCenter> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/sentencing`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to load Sentencing center');
  }
  const data = await res.json();
  return (data.sentencing ?? data) as SentencingCenter;
}
