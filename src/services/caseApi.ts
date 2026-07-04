// ============================================================================
// Core Evidence System — Case & Evidence API Service (Part 16)
// Async API client for case management and evidence upload.
// Replaces synchronous mock data with real backend calls.
// ============================================================================

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Auth-only headers for requests with no body (e.g. DELETE).
 *  Omits Content-Type to avoid Fastify rejecting empty JSON bodies. */
function getAuthHeadersNoBody(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiCase {
  caseId: string;
  tenantId: string;
  ownerId: string;
  title: string;
  caseNumber: string;
  jurisdiction: string;
  caseType: string;
  status: string;
  phase: string;
  court: string | null;
  judge: string | null;
  department: string | null;
  nextHearing: string | null;
  nextHearingNote: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { evidence: number };
}

export interface ApiEvidence {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  mimeType: string | null;
  size: string;
  duration: number | null;
  pageCount: number | null;
  evidenceType: string;
  s3Key: string | null;
  uploadedBy: string;
  uploadedAt: string;
  processingStatus: string;
  processingError: string | null;
  multiplexDetected: boolean;
  multiplexCount: number | null;
  normalizedPageCount: number | null;
  acuCost: number | null;
  acuConsumed: number;
  analysisStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCasePayload {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  caseType: string;
  court?: string;
  judge?: string;
  department?: string;
}

export interface UploadUrlPayload {
  caseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  evidenceType: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  fileId: string;
  s3Key: string;
  expiresIn: number;
}

export interface RegisterEvidencePayload {
  caseId: string;
  fileName: string;
  mimeType: string;
  size: number;
  evidenceType: string;
  s3Key: string;
  pageCount?: number;
  duration?: number;
}

export const EVIDENCE_TYPES = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'police_report', label: 'Police Report' },
  { value: 'bodycam', label: 'Body Camera Video' },
  { value: 'dashcam', label: 'Dashcam Video' },
  { value: 'witness_video', label: 'Witness Video' },
  { value: 'photo', label: 'Photograph' },
  { value: 'dispatch_log', label: 'Dispatch Log' },
  { value: 'forensic_report', label: 'Forensic Report' },
  { value: 'autopsy_report', label: 'Autopsy Report' },
  { value: 'other_document', label: 'Other Document' },
] as const;

export const CASE_TYPES = [
  { value: 'felony', label: 'Felony' },
  { value: 'misdemeanor', label: 'Misdemeanor' },
  { value: 'infraction', label: 'Infraction' },
  { value: 'federal', label: 'Federal' },
] as const;

// ---------------------------------------------------------------------------
// Case API
// ---------------------------------------------------------------------------

export async function fetchCases(): Promise<ApiCase[]> {
  const res = await fetch(`${API_BASE}/cases`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch cases' }));
    throw new Error(err.error || 'Failed to fetch cases');
  }
  const data = await res.json();
  return data.cases;
}

export async function fetchCase(caseId: string): Promise<ApiCase> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch case' }));
    throw new Error(err.error || 'Failed to fetch case');
  }
  const data = await res.json();
  return data.case;
}

export async function createCase(payload: CreateCasePayload): Promise<ApiCase> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create case' }));
    throw new Error(err.error || 'Failed to create case');
  }
  const data = await res.json();
  return data.case;
}

export async function updateCase(caseId: string, payload: Partial<CreateCasePayload> & { status?: string }): Promise<ApiCase> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update case' }));
    throw new Error(err.error || 'Failed to update case');
  }
  const data = await res.json();
  return data.case;
}

export async function deleteCase(caseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, {
    method: 'DELETE',
    headers: getAuthHeadersNoBody(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete case' }));
    throw new Error(err.error || 'Failed to delete case');
  }
}

// ---------------------------------------------------------------------------
// Evidence API
// ---------------------------------------------------------------------------

export async function fetchCaseEvidence(caseId: string): Promise<ApiEvidence[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/evidence`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch evidence' }));
    throw new Error(err.error || 'Failed to fetch evidence');
  }
  const data = await res.json();
  return data.evidence;
}

export async function fetchEvidence(evidenceId: string): Promise<ApiEvidence> {
  const res = await fetch(`${API_BASE}/evidence/${evidenceId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch evidence' }));
    throw new Error(err.error || 'Failed to fetch evidence');
  }
  const data = await res.json();
  return data.evidence;
}

export async function deleteEvidence(evidenceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/evidence/${evidenceId}`, {
    method: 'DELETE',
    headers: getAuthHeadersNoBody(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete evidence' }));
    throw new Error(err.error || 'Failed to delete evidence');
  }
}

// ---------------------------------------------------------------------------
// Evidence Upload Flow (Presigned URL → S3 → Register Metadata)
// ---------------------------------------------------------------------------

export async function getUploadUrl(payload: UploadUrlPayload): Promise<UploadUrlResponse> {
  const res = await fetch(`${API_BASE}/evidence/upload-url`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get upload URL' }));
    throw new Error(err.error || 'Failed to get upload URL');
  }
  return res.json();
}

export async function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during S3 upload'));
    xhr.send(file);
  });
}

export async function registerEvidence(payload: RegisterEvidencePayload): Promise<ApiEvidence> {
  const res = await fetch(`${API_BASE}/evidence`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to register evidence' }));
    throw new Error(err.error || 'Failed to register evidence');
  }
  const data = await res.json();
  return data.evidence;
}

// ---------------------------------------------------------------------------
// Narrative Deconstruction Engine API
// ---------------------------------------------------------------------------

export interface ApiNarrativeClaim {
  claimId: string;
  evidenceId: string;
  claimText: string;
  subject: string;
  action: string;
  object: string | null;
  target: string | null;
  timestampReference: string | null;
  confidence: number;
  sentenceIndex: number;
  validation: {
    status: string;
    confidence: number;
    reasoning: string | null;
    supportingEvidenceIds: string[];
    contradictingEvidenceIds: string[];
  } | null;
  normalizedEvent: {
    eventType: string;
    actor: string;
    actionNorm: string;
    object: string | null;
    target: string | null;
  } | null;
}

export interface ApiImpeachmentCandidate {
  impeachmentId: string;
  claimId: string;
  severity: string;
  contradictionType: string;
  claimText: string;
  contradictingEvidence: string;
  suggestedQuestion: string | null;
  confidence: number;
}

export interface ApiNarrativeContradiction {
  validationId: string;
  claimId: string;
  claim: {
    claimText: string;
    subject: string;
    action: string;
    object: string | null;
    target: string | null;
    evidenceId: string;
  } | null;
  confidence: number;
  reasoning: string | null;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
}

export async function fetchNarrativeClaims(
  caseId: string,
  params?: { status?: string; minConfidence?: number; evidenceId?: string },
): Promise<{ claims: ApiNarrativeClaim[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.minConfidence !== undefined) searchParams.set('minConfidence', String(params.minConfidence));
  if (params?.evidenceId) searchParams.set('evidenceId', params.evidenceId);

  const qs = searchParams.toString();
  const url = `${API_BASE}/narrative/${caseId}/claims${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch claims' }));
    throw new Error(err.error || 'Failed to fetch claims');
  }
  return res.json();
}

export async function fetchNarrativeContradictions(
  caseId: string,
): Promise<{ contradictions: ApiNarrativeContradiction[]; count: number }> {
  const res = await fetch(`${API_BASE}/narrative/${caseId}/contradictions`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch contradictions' }));
    throw new Error(err.error || 'Failed to fetch contradictions');
  }
  return res.json();
}

export async function fetchImpeachmentCandidates(
  caseId: string,
  severity?: string,
): Promise<{ candidates: ApiImpeachmentCandidate[]; total: number; severityCounts: { high: number; medium: number; low: number } }> {
  const qs = severity ? `?severity=${severity}` : '';
  const res = await fetch(`${API_BASE}/narrative/${caseId}/impeachment${qs}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch impeachment candidates' }));
    throw new Error(err.error || 'Failed to fetch impeachment candidates');
  }
  return res.json();
}

export async function analyzeNarrative(caseId: string): Promise<{ status: string; evidenceCount: number }> {
  const headers = getAuthHeaders();
  // Remove content-type to avoid Fastify rejecting empty JSON body
  const { 'Content-Type': _, ...headersWithoutCT } = headers;
  const res = await fetch(`${API_BASE}/narrative/analyze/${caseId}`, {
    method: 'POST',
    headers: headersWithoutCT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to start narrative analysis' }));
    throw new Error(err.error || 'Failed to start narrative analysis');
  }
  return res.json();
}

/**
 * Full upload flow: get presigned URL → upload to S3 → register metadata.
 */
export async function uploadEvidence(params: {
  caseId: string;
  file: File;
  evidenceType: string;
  onProgress?: (percent: number) => void;
}): Promise<ApiEvidence> {
  // Step 1: Get presigned URL
  const urlResponse = await getUploadUrl({
    caseId: params.caseId,
    fileName: params.file.name,
    fileType: params.file.type,
    fileSize: params.file.size,
    evidenceType: params.evidenceType,
  });

  // Step 2: Upload directly to S3
  await uploadFileToS3(urlResponse.uploadUrl, params.file, params.onProgress);

  // Step 3: Register metadata
  return registerEvidence({
    caseId: params.caseId,
    fileName: params.file.name,
    mimeType: params.file.type,
    size: params.file.size,
    evidenceType: params.evidenceType,
    s3Key: urlResponse.s3Key,
  });
}

// ---------------------------------------------------------------------------
// Direct Evidence Upload (multipart — fallback when S3 presigned URLs unavailable)
// ---------------------------------------------------------------------------

export async function uploadEvidenceDirect(params: {
  caseId: string;
  file: File;
  evidenceType: string;
  onProgress?: (percent: number) => void;
}): Promise<ApiEvidence> {
  const token = localStorage.getItem('court-access-token');
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('caseId', params.caseId);
  formData.append('evidenceType', params.evidenceType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/evidence/upload`, true);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) {
        params.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.evidence ?? data);
        } catch {
          reject(new Error('Invalid response from upload'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

// ---------------------------------------------------------------------------
// Timeline API
// ---------------------------------------------------------------------------

export interface ApiTimelineEvent {
  eventId: string;
  eventType: string;
  canonicalTimestamp: string;
  timestampSource: string;
  confidence: number;
  actor?: string;
  action?: string;
  target?: string;
  description?: string;
}

export interface ApiTimelineSummary {
  caseId: string;
  totalEvents: number;
  events: ApiTimelineEvent[];
  conflicts?: ApiTimelineConflict[];
}

export interface ApiTimelineConflict {
  conflictId?: string;
  type: string;
  description: string;
  eventIds: string[];
  severity?: string;
}

export async function fetchTimelineEvents(caseId: string): Promise<ApiTimelineEvent[]> {
  const res = await fetch(`${API_BASE}/timeline/${caseId}/events`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch timeline events' }));
    throw new Error(err.error || 'Failed to fetch timeline events');
  }
  const data = await res.json();
  return data.events ?? data;
}

export async function fetchTimeline(caseId: string): Promise<ApiTimelineSummary> {
  const res = await fetch(`${API_BASE}/timeline/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch timeline' }));
    throw new Error(err.error || 'Failed to fetch timeline');
  }
  return res.json();
}

export async function fetchTimelineConflicts(caseId: string): Promise<ApiTimelineConflict[]> {
  const res = await fetch(`${API_BASE}/timeline/${caseId}/conflicts`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch timeline conflicts' }));
    throw new Error(err.error || 'Failed to fetch timeline conflicts');
  }
  const data = await res.json();
  return data.conflicts ?? data;
}

export async function rebuildTimeline(caseId: string): Promise<{ status: string; jobId?: string; message: string }> {
  const headers = getAuthHeaders();
  const { 'Content-Type': _, ...headersWithoutCT } = headers;
  const res = await fetch(`${API_BASE}/timeline/rebuild/${caseId}`, {
    method: 'POST',
    headers: headersWithoutCT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to trigger timeline rebuild' }));
    throw new Error(err.error || 'Failed to trigger timeline rebuild');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Contradiction Detection API
// ---------------------------------------------------------------------------

export interface ApiContradiction {
  contradictionId: string;
  contradictionType: string;
  description: string;
  confidence: number;
  timeRangeStart: string | null;
  timeRangeEnd: string | null;
  sourceEvidenceIds: string[];
}

export interface ApiDoctrineMatch {
  contradictionId: string;
  doctrineRuleId: string;
  matchDescription: string;
  severity: string;
}

export interface ApiRecommendation {
  recommendationId: string;
  type: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
}

export interface ApiContradictionAnalysis {
  caseId: string;
  analysis: {
    contradictions: ApiContradiction[];
    totalContradictions: number;
  };
  timeline: {
    totalEvents: number;
    mergedEvents: number;
    gaps: unknown[];
  };
  doctrineMatching: {
    totalMatches: number;
    caseSeverity: unknown;
    results: Array<{ doctrineMatches: ApiDoctrineMatch[] }>;
  };
  litigationSummary: {
    recommendations: ApiRecommendation[];
  };
}

export async function analyzeContradictions(caseId: string): Promise<ApiContradictionAnalysis> {
  const headers = getAuthHeaders();
  const { 'Content-Type': _, ...headersWithoutCT } = headers;
  const res = await fetch(`${API_BASE}/contradiction/analyze/${caseId}`, {
    method: 'POST',
    headers: headersWithoutCT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to analyze contradictions' }));
    throw new Error(err.error || 'Failed to analyze contradictions');
  }
  return res.json();
}

export async function fetchContradictionRecommendations(caseId: string): Promise<{
  recommendations: ApiRecommendation[];
}> {
  const res = await fetch(`${API_BASE}/contradiction/recommendations/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch recommendations' }));
    throw new Error(err.error || 'Failed to fetch recommendations');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Litigation Strategy API
// ---------------------------------------------------------------------------

export interface ApiLitigationStrategy {
  caseId: string;
  generatedAt: string;
  disclaimer: string;
  observations: Array<{
    id: string;
    evidenceSource: string;
    observation: string;
    timestamp: string;
  }>;
  recommendations: Array<{
    id: string;
    type: string;
    suggestedOpportunity: string;
    evidenceSource: string;
    confidenceScore: number;
    status: string;
  }>;
  readiness: Array<{ label: string; score: number; maxScore: number }>;
  roadmap: Array<{
    stepNumber: number;
    description: string;
    category: string;
    status: string;
  }>;
  unknowns: string[];
}

export async function fetchLitigationStrategy(caseId: string): Promise<ApiLitigationStrategy> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/litigation-strategy`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch litigation strategy' }));
    throw new Error(err.error || 'Failed to fetch litigation strategy');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Attorney Reports API
// ---------------------------------------------------------------------------

export interface ApiComplianceReport {
  title: string;
  generatedAt: string;
  caseId: string;
  agencyName: string;
  findings: Array<{
    number: number;
    findingType: string;
    policyReference: string;
    evidenceTimestamp: string | null;
    detectedAction: string;
    confidence: string;
    explanation: string;
    reviewStatus: string;
  }>;
  summary: {
    totalFindings: number;
    potentialInconsistencies: number;
    consistentFindings: number;
    averageConfidence: number;
    topPolicyAreas: string[];
  };
}

export interface ApiExpertWitnessPackage {
  packageTitle?: string;
  sections?: Array<{ title: string; content: string }>;
  [key: string]: unknown;
}

export async function generateComplianceReport(
  caseId: string,
  caseName?: string,
): Promise<ApiComplianceReport> {
  const res = await fetch(`${API_BASE}/compliance/report/${caseId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ caseName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to generate compliance report' }));
    throw new Error(err.error || 'Failed to generate compliance report');
  }
  const data = await res.json();
  return data.data;
}

export async function generateExpertWitnessPackage(caseId: string): Promise<ApiExpertWitnessPackage> {
  const res = await fetch(`${API_BASE}/compliance/expert/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to generate expert package' }));
    throw new Error(err.error || 'Failed to generate expert package');
  }
  const data = await res.json();
  return data.data;
}

// ---------------------------------------------------------------------------
// Charges API
// ---------------------------------------------------------------------------

export interface ApiCharge {
  id: string;
  caseId: string;
  code: string;
  section: string;
  title: string | null;
  victim: string;
  dateOfOffense: string | null;
  createdAt: string;
}

export async function fetchCharges(caseId: string): Promise<ApiCharge[]> {
  const res = await fetch(`${API_BASE}/charges/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch charges' }));
    throw new Error(err.error || 'Failed to fetch charges');
  }
  const data = await res.json();
  return data.charges ?? [];
}

export async function createCharge(payload: {
  caseId: string;
  code: string;
  section: string;
  title?: string;
  victim: string;
  dateOfOffense?: string;
}): Promise<ApiCharge> {
  const res = await fetch(`${API_BASE}/charges`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create charge' }));
    throw new Error(err.error || 'Failed to create charge');
  }
  const data = await res.json();
  return data.charge;
}

export async function deleteCharge(chargeId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/charges/${chargeId}`, {
    method: 'DELETE',
    headers: getAuthHeadersNoBody(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete charge' }));
    throw new Error(err.error || 'Failed to delete charge');
  }
}

// ---------------------------------------------------------------------------
// Billing / Stripe API
// ---------------------------------------------------------------------------

export interface ApiBillingPlan {
  id: string;
  name: string;
  price: number;
  pages: number;
  credits: number;
  features: string[];
}

export async function fetchBillingPlans(): Promise<ApiBillingPlan[]> {
  const res = await fetch(`${API_BASE}/billing/plans`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch billing plans' }));
    throw new Error(err.error || 'Failed to fetch billing plans');
  }
  const data = await res.json();
  return data.plans;
}

export async function createCheckoutSession(planId: string): Promise<{ url?: string; sessionId?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create checkout session' }));
    throw new Error(err.error || 'Failed to create checkout session');
  }
  return res.json();
}
