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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
// Timeline API
// ---------------------------------------------------------------------------

export interface ApiTimelineEvent {
  eventId: string;
  caseId: string;
  sourceEvidenceId: string | null;
  eventType: string;
  timestamp: string;
  endTimestamp: string | null;
  confidence: number;
  sourceType: string;
  description: string;
  rawText: string | null;
  metadata: Record<string, unknown> | null;
  correlationGroup: string | null;
}

export interface ApiCaseTimeline {
  timelineId: string;
  caseId: string;
  status: string;
  eventCount: number;
  conflictCount: number;
  clockOffsets: unknown;
  builtAt: string | null;
}

export interface ApiTimelineConflict {
  conflictType: string;
  description: string;
  eventA: {
    eventId: string;
    eventType: string;
    timestamp: string;
    sourceType: string;
    description: string;
  } | null;
  eventB: {
    eventId: string;
    eventType: string;
    timestamp: string;
    sourceType: string;
    description: string;
  } | null;
}

export async function fetchTimeline(caseId: string): Promise<{
  timeline: ApiCaseTimeline | null;
  events: ApiTimelineEvent[];
  graph: { nodes: unknown[]; relationships: unknown[] };
}> {
  const res = await fetch(`${API_BASE}/timeline/${caseId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch timeline' }));
    throw new Error(err.error || 'Failed to fetch timeline');
  }
  return res.json();
}

export async function fetchTimelineEvents(
  caseId: string,
  params?: { sourceType?: string; eventType?: string; minConfidence?: number },
): Promise<{ events: ApiTimelineEvent[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.sourceType) query.set('sourceType', params.sourceType);
  if (params?.eventType) query.set('eventType', params.eventType);
  if (params?.minConfidence !== undefined) query.set('minConfidence', String(params.minConfidence));
  const qs = query.toString();
  const url = `${API_BASE}/timeline/${caseId}/events${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch timeline events' }));
    throw new Error(err.error || 'Failed to fetch timeline events');
  }
  return res.json();
}

export async function fetchTimelineConflicts(caseId: string): Promise<{
  conflicts: ApiTimelineConflict[];
  conflictCount: number;
}> {
  const res = await fetch(`${API_BASE}/timeline/${caseId}/conflicts`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch conflicts' }));
    throw new Error(err.error || 'Failed to fetch conflicts');
  }
  return res.json();
}

export async function rebuildTimeline(caseId: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/timeline/rebuild/${caseId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to rebuild timeline' }));
    throw new Error(err.error || 'Failed to rebuild timeline');
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
