// ============================================
// Court Access — Doctrine Intelligence Frontend Service
// Fetches doctrine compliance analysis, search,
// and status from the backend API.
// Includes demo data fallback for offline mode.
// ============================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoctrineFlagType = 'violation' | 'concern' | 'compliant';
export type DoctrineCategory =
  | 'constitutional'
  | 'encounter'
  | 'detention'
  | 'search'
  | 'arrest'
  | 'miranda'
  | 'interrogation'
  | 'use_of_force'
  | 'pursuit'
  | 'evidence_presentation'
  | 'chain_of_custody'
  | 'testimony'
  | 'report_writing'
  | 'evidence_handling'
  | 'evidence_collection'
  | 'crime_scene'
  | 'patrol'
  | 'field_contact'
  | 'general';

export interface DoctrineMatchResult {
  doctrineId: string;
  source: string;
  chapter: string;
  topic: string;
  ruleText: string;
  category: DoctrineCategory;
  similarityScore: number;
  flagType: DoctrineFlagType;
  flagDescription: string;
  legalImplication: string | null;
}

export interface DoctrineComplianceResponse {
  overallCompliance: 'compliant' | 'concerns' | 'violations';
  totalRulesChecked: number;
  violations: number;
  concerns: number;
  compliant: number;
  matches: DoctrineMatchResult[];
  analyzedAt: string;
}

export interface DoctrineQuickScanResponse {
  hasViolations: boolean;
  hasConcerns: boolean;
  violations: Array<{
    doctrineId: string;
    topic: string;
    ruleText: string;
    flagDescription: string;
    similarityScore: number;
  }>;
  concerns: Array<{
    doctrineId: string;
    topic: string;
    ruleText: string;
    flagDescription: string;
    similarityScore: number;
  }>;
}

export interface DoctrineStatusResponse {
  status: string;
  totalRules: number;
  totalEmbeddings: number;
  rulesByCategory: Record<string, number>;
  rulesBySource: Record<string, number>;
  rulesByDomain: Record<string, number>;
  seedDataLoaded: boolean;
}

export interface DoctrineRuleResponse {
  doctrineId: string;
  sourceType: string;
  sourceName: string;
  domain: string;
  chapter: string;
  topic: string;
  ruleText: string;
  explanation: string | null;
  legalImplication: string | null;
  category: DoctrineCategory;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Demo Data — fallback when API is unavailable
// ---------------------------------------------------------------------------

const DEMO_COMPLIANCE_RESULT: DoctrineComplianceResponse = {
  overallCompliance: 'violations',
  totalRulesChecked: 45,
  violations: 3,
  concerns: 2,
  compliant: 4,
  matches: [
    {
      doctrineId: 'POSTLD15_DETE_002',
      source: 'POST LD-15',
      chapter: 'Detentions',
      topic: 'Reasonable Suspicion',
      ruleText: 'Reasonable suspicion cannot be based on a mere hunch, gut feeling, or unparticularized suspicion.',
      category: 'detention',
      similarityScore: 0.89,
      flagType: 'violation',
      flagDescription: 'Potential detention doctrine violation: Reasonable Suspicion. Training doctrine states: "Reasonable suspicion cannot be based on a mere hunch, gut feeling, or unparticularized suspicion..." (89% relevance). If reasonable suspicion cannot be articulated, evidence obtained during the detention may be suppressed.',
      legalImplication: 'A detention based on a mere hunch is unlawful, and any evidence obtained as a result may be suppressed.',
    },
    {
      doctrineId: 'POSTLD15_DETE_001',
      source: 'POST LD-15',
      chapter: 'Detentions',
      topic: 'Reasonable Suspicion',
      ruleText: 'A lawful detention requires reasonable suspicion that criminal activity may be occurring and the person detained is connected to that activity.',
      category: 'detention',
      similarityScore: 0.85,
      flagType: 'violation',
      flagDescription: 'Potential detention doctrine violation: Reasonable Suspicion. Training doctrine states: "A lawful detention requires reasonable suspicion that criminal activity may be occurring..." (85% relevance).',
      legalImplication: 'If reasonable suspicion cannot be articulated, evidence obtained during the detention may be suppressed.',
    },
    {
      doctrineId: 'POSTLD15_DETE_006',
      source: 'POST LD-15',
      chapter: 'Detentions',
      topic: 'Reasonable Suspicion',
      ruleText: 'Reasonable suspicion must be based on objective facts, not on a person\'s race, ethnicity, national origin, gender, or other protected characteristic.',
      category: 'detention',
      similarityScore: 0.82,
      flagType: 'violation',
      flagDescription: 'Potential detention doctrine violation: Reasonable Suspicion. Training doctrine states: "Reasonable suspicion must be based on objective facts, not on a person\'s race..." (82% relevance).',
      legalImplication: 'A detention based on racial profiling violates both the Fourth and Fourteenth Amendments and may result in suppression and civil liability.',
    },
    {
      doctrineId: 'POSTLD15_SEAR_006',
      source: 'POST LD-15',
      chapter: 'Searches',
      topic: 'Pat Searches',
      ruleText: 'An officer cannot conduct a pat search based solely on the fact that the person is in a high-crime area.',
      category: 'search',
      similarityScore: 0.71,
      flagType: 'concern',
      flagDescription: 'search compliance concern: Pat Searches. Related doctrine: "An officer cannot conduct a pat search based solely on the fact that the person is in a high-crime area." (71% relevance). Review recommended.',
      legalImplication: 'A pat search based solely on location is unlawful and evidence discovered may be suppressed.',
    },
    {
      doctrineId: 'POSTLD15_ENCO_002',
      source: 'POST LD-15',
      chapter: 'Consensual Encounters',
      topic: 'Consensual Encounters',
      ruleText: 'An officer must not use commands, physical force, sirens, or other displays of authority that would cause a reasonable person to believe they are not free to leave.',
      category: 'encounter',
      similarityScore: 0.65,
      flagType: 'concern',
      flagDescription: 'encounter compliance concern: Consensual Encounters. Related doctrine: "An officer must not use commands, physical force, sirens, or other displays of authority..." (65% relevance). Review recommended.',
      legalImplication: 'If encounter is determined non-consensual, it becomes a detention requiring reasonable suspicion.',
    },
    {
      doctrineId: 'POSTLD15_CONS_001',
      source: 'POST LD-15',
      chapter: 'Constitutional Protections',
      topic: 'Fourth Amendment',
      ruleText: 'The Fourth Amendment protects individuals from unreasonable searches and seizures by the government.',
      category: 'constitutional',
      similarityScore: 0.58,
      flagType: 'compliant',
      flagDescription: 'Evidence aligns with constitutional doctrine: Fourth Amendment. (58% relevance)',
      legalImplication: 'Evidence obtained through an unreasonable search or seizure is subject to the exclusionary rule and may be suppressed at trial.',
    },
    {
      doctrineId: 'POSTLD15_ARRE_001',
      source: 'POST LD-15',
      chapter: 'Arrests',
      topic: 'Probable Cause',
      ruleText: 'Probable cause is required before an arrest may be made. It exists when facts and circumstances would lead a reasonable person to believe a crime has been or is being committed.',
      category: 'arrest',
      similarityScore: 0.52,
      flagType: 'compliant',
      flagDescription: 'Evidence aligns with arrest doctrine: Probable Cause. (52% relevance)',
      legalImplication: 'An arrest without probable cause is unlawful; all evidence obtained as a result may be suppressed under the exclusionary rule.',
    },
    {
      doctrineId: 'POSTLD15_MIRA_001',
      source: 'POST LD-15',
      chapter: 'Miranda',
      topic: 'Miranda Warnings',
      ruleText: 'Miranda warnings must be given before any custodial interrogation.',
      category: 'miranda',
      similarityScore: 0.45,
      flagType: 'compliant',
      flagDescription: 'Evidence aligns with miranda doctrine: Miranda Warnings. (45% relevance)',
      legalImplication: 'Failure to administer Miranda warnings before custodial interrogation renders statements inadmissible.',
    },
    {
      doctrineId: 'POSTLD15_CONS_005',
      source: 'POST LD-15',
      chapter: 'Constitutional Protections',
      topic: 'Exclusionary Rule',
      ruleText: 'The exclusionary rule requires that evidence obtained in violation of the Constitution must be suppressed.',
      category: 'constitutional',
      similarityScore: 0.42,
      flagType: 'compliant',
      flagDescription: 'Evidence aligns with constitutional doctrine: Exclusionary Rule. (42% relevance)',
      legalImplication: 'Evidence obtained through constitutional violations is inadmissible, and all derivative evidence may also be suppressed.',
    },
  ],
  analyzedAt: new Date().toISOString(),
};

const DEMO_STATUS: DoctrineStatusResponse = {
  status: 'operational',
  totalRules: 225,
  totalEmbeddings: 225,
  rulesByCategory: {
    constitutional: 6,
    encounter: 3,
    detention: 10,
    search: 40,
    arrest: 6,
    miranda: 7,
    interrogation: 5,
    use_of_force: 22,
    pursuit: 3,
    evidence_presentation: 6,
    chain_of_custody: 4,
    testimony: 7,
    report_writing: 18,
    evidence_handling: 19,
    evidence_collection: 5,
    crime_scene: 21,
    patrol: 8,
    field_contact: 3,
    general: 3,
  },
  rulesBySource: {
    'POST LD-15': 45,
    'POST LD-16': 36,
    'POST LD-17': 21,
    'POST LD-18': 18,
    'POST LD-20': 22,
    'POST LD-21': 18,
    'POST LD-24': 19,
    'POST LD-30': 21,
  },
  rulesByDomain: {
    'Laws of Arrest': 45,
    'Search & Seizure': 36,
    'Presentation of Evidence': 21,
    'Investigative Report Writing': 18,
    'Use of Force': 22,
    'Patrol Techniques': 18,
    'Handling Evidence': 19,
    'Crime Scene Investigation': 21,
  },
  seedDataLoaded: true,
};

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const API_BASE = '/api/doctrine';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze evidence text for doctrine compliance.
 */
export async function analyzeDoctrineCompliance(
  evidenceText: string,
  options?: { category?: DoctrineCategory; maxResults?: number },
): Promise<DoctrineComplianceResponse> {
  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        evidenceText,
        category: options?.category,
        maxResults: options?.maxResults ?? 20,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as DoctrineComplianceResponse;
  } catch {
    return DEMO_COMPLIANCE_RESULT;
  }
}

/**
 * Quick scan evidence text for violations.
 */
export async function quickScanDoctrine(
  evidenceText: string,
): Promise<DoctrineQuickScanResponse> {
  try {
    const response = await fetch(`${API_BASE}/quick-scan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ evidenceText }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as DoctrineQuickScanResponse;
  } catch {
    return {
      hasViolations: true,
      hasConcerns: true,
      violations: DEMO_COMPLIANCE_RESULT.matches
        .filter((m) => m.flagType === 'violation')
        .map((m) => ({
          doctrineId: m.doctrineId,
          topic: m.topic,
          ruleText: m.ruleText,
          flagDescription: m.flagDescription,
          similarityScore: m.similarityScore,
        })),
      concerns: DEMO_COMPLIANCE_RESULT.matches
        .filter((m) => m.flagType === 'concern')
        .map((m) => ({
          doctrineId: m.doctrineId,
          topic: m.topic,
          ruleText: m.ruleText,
          flagDescription: m.flagDescription,
          similarityScore: m.similarityScore,
        })),
    };
  }
}

/**
 * Get doctrine system status.
 */
export async function fetchDoctrineStatus(): Promise<DoctrineStatusResponse> {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as DoctrineStatusResponse;
  } catch {
    return DEMO_STATUS;
  }
}

/**
 * Search doctrine rules by keyword.
 */
export async function searchDoctrineRules(
  query: string,
  maxResults: number = 20,
): Promise<{ count: number; rules: DoctrineRuleResponse[] }> {
  try {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const response = await fetch(`${API_BASE}/search?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as { count: number; rules: DoctrineRuleResponse[] };
  } catch {
    return { count: 0, rules: [] };
  }
}

/**
 * Trigger seed data loading.
 */
export async function loadDoctrineSeedData(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/seed`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as { success: boolean; message: string };
  } catch {
    return { success: false, message: 'API unavailable — using demo data' };
  }
}
