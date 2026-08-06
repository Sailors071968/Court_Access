// Gold Standard Certification API client. Administrator-only; the server
// enforces that independently on every route.

const API_BASE = '/api/certification';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: authHeaders() });
  const body = await res.text();

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message || parsed.error || message;
    } catch {
      /* keep the status message */
    }
    throw new Error(message);
  }

  return JSON.parse(body) as T;
}

export interface CertificationCaseSummary {
  certificationCaseId: string;
  reference: string;
  label: string;
  status: string;
  caseId: string | null;
  fileCount: number;
  runCount: number;
  corpusHash: string | null;
  totalBytes: string;
  importedAt: string;
  importCompletedAt: string | null;
}

export interface ModuleStatus {
  module: string;
  corpora: number;
  totalRuns: number;
  documentClasses: number;
  cases: CertificationCaseSummary[];
}

export interface PreviewFile {
  relativePath: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt: string | null;
  fromArchive: string | null;
}

export interface PreviewResult {
  sourceDirectory: string;
  fileCount: number;
  totalBytes: number;
  byExtension: Record<string, number>;
  warnings: string[];
  files: PreviewFile[];
  truncated: boolean;
}

export interface ImportResult {
  certificationCaseId: string;
  reference: string;
  caseId: string;
  fileCount: number;
  ingested: number;
  duplicates: number;
  failed: number;
  totalBytes: number;
  corpusHash: string;
  warnings: string[];
}

export interface InventoryFile {
  certificationFileId: string;
  relativePath: string;
  fileName: string;
  sizeBytes: string;
  sha256: string;
  originalModifiedAt: string | null;
  classification: string;
  classificationConfidence: number;
  classificationBasis: string | null;
  ingestStatus: string;
  ingestMessage: string | null;
  evidenceId: string | null;
  isDuplicate: boolean;
}

export interface Inventory {
  certificationCaseId: string;
  reference: string;
  label: string;
  status: string;
  caseId: string | null;
  corpusHash: string | null;
  importedAt: string;
  totals: {
    files: number;
    bytes: number;
    documents: number;
    videos: number;
    audio: number;
    images: number;
    duplicates: number;
    ingested: number;
    failed: number;
  };
  byExtension: Record<string, number>;
  byClassification: Record<string, number>;
  files: InventoryFile[];
}

export interface Regression {
  metric: string;
  baseline: number | string;
  current: number | string;
  delta: number | null;
  severity: 'regression' | 'improvement' | 'change';
  note: string;
}

export interface RunMetrics {
  corpus: { files: number; bytes: number; ingested: number; duplicates: number; failedToIngest: number; corpusHash: string | null };
  extraction: { documentsWithText: number; documentsWithoutText: number; totalPages: number; documentsWithPageMap: number; totalChunks: number; totalCharacters: number };
  ocr: { imagesProcessed: number; belowConfidenceThreshold: number; lowConfidenceFiles: string[] };
  classification: { classified: number; unknown: number; byClass: Record<string, number>; lowConfidence: number };
  repositories: { evidence: number; evidenceChunks: number; timelineEvents: number; evidenceEvents: number; narrativeClaims: number; verifiedFacts: number; charges: number };
  knowledgeGraph: { nodes: number; edges: number; actors: number; sourceDocuments: number };
  calcrim: { chargesAnalysed: number; chargesUnmapped: number; elementsTotal: number; elementsSupported: number; elementsMissing: number; caseStrength: string };
  mensRea: { resolved: number; unknown: number };
  contradictions: { detected: number };
  intelligence: { investigationGaps: number; motionCandidates: number };
  failures: Array<{ file: string; stage: string; message: string }>;
  unknowns: Array<{ subject: string; reason: string }>;
}

export interface RunResult {
  certificationRunId: string;
  metrics: RunMetrics;
  regressions: Regression[] | null;
}

export interface RunHistoryEntry {
  certificationRunId: string;
  gitCommit: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
  isBaseline: boolean;
  metrics: RunMetrics | null;
  regressions: Regression[] | null;
}

export const certificationApi = {
  status: () => call<ModuleStatus>('/status'),

  preview: (sourceDirectory: string) =>
    call<PreviewResult>('/preview', { method: 'POST', body: JSON.stringify({ sourceDirectory }) }),

  import: (payload: { reference: string; label: string; description?: string; sourceDirectory: string }) =>
    call<ImportResult>('/import', { method: 'POST', body: JSON.stringify(payload) }),

  inventory: (certificationCaseId: string) =>
    call<Inventory>(`/cases/${certificationCaseId}/inventory`),

  run: (certificationCaseId: string) =>
    call<RunResult>(`/cases/${certificationCaseId}/run`, { method: 'POST', body: '{}' }),

  runs: (certificationCaseId: string) =>
    call<{ certificationCaseId: string; runCount: number; runs: RunHistoryEntry[] }>(
      `/cases/${certificationCaseId}/runs`,
    ),

  compare: (baselineRunId: string, currentRunId: string) =>
    call<{
      baselineRunId: string;
      currentRunId: string;
      baselineCommit: string | null;
      currentCommit: string | null;
      differences: number;
      regressions: Regression[];
      improvements: Regression[];
      changes: Regression[];
    }>(`/compare?baselineRunId=${baselineRunId}&currentRunId=${currentRunId}`),

  setBaseline: (certificationRunId: string) =>
    call<{ certificationRunId: string; isBaseline: boolean }>(`/runs/${certificationRunId}/baseline`, {
      method: 'POST',
      body: '{}',
    }),
};
