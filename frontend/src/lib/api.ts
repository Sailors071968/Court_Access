// ============================================================================
// CourtAccess — API Client (PRODUCTION READY)
// ============================================================================

const API_BASE =
  import.meta.env.VITE_API_URL || "https://courtaccess.net/api";

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export const apiHealth = () => request("/health");

// ---------------------------------------------------------------------------
// Upload Evidence
// ---------------------------------------------------------------------------
export async function uploadEvidence(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/evidence/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload failed");
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Trigger Timeline Processing
// ---------------------------------------------------------------------------
export const rebuildTimeline = (caseId: string) =>
  request(`/timeline/rebuild/${caseId}`, {
    method: "POST",
  });

// ---------------------------------------------------------------------------
// Fetch Timeline Events
// ---------------------------------------------------------------------------
export const getTimelineEvents = (caseId: string) =>
  request(`/timeline/${caseId}/events`);

// ---------------------------------------------------------------------------
// 🔥 OPTIONAL (future)
// ---------------------------------------------------------------------------
export const getContradictions = (caseId: string) =>
  request(`/contradictions/${caseId}`);
