// ============================================================================
// Court Access — Video Processing Service
// API client for video processing and job progress tracking.
// Backend endpoints:
//   POST /api/video/process/:caseId → { jobId }
//   GET  /api/jobs/:jobId           → { progress, state, failedReason }
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

export type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';

export interface VideoProcessResponse {
  jobId: string;
  message?: string;
}

export interface JobStatus {
  progress: number;
  state: JobState;
  failedReason: string | null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Start video processing for a case.
 * POST /api/video/process/:caseId
 */
export async function startVideoProcessing(caseId: string): Promise<VideoProcessResponse> {
  const headers = getAuthHeaders();
  // Remove Content-Type to avoid Fastify rejecting empty JSON body
  const { 'Content-Type': _ct, ...headersWithoutCT } = headers;
  void _ct;

  const res = await fetch(`${API_BASE}/video/process/${caseId}`, {
    method: 'POST',
    headers: headersWithoutCT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to start video processing' }));
    throw new Error(err.error || 'Failed to start video processing');
  }
  return res.json();
}

/**
 * Poll job status.
 * GET /api/jobs/:jobId
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch job status' }));
    throw new Error(err.error || 'Failed to fetch job status');
  }
  return res.json();
}
