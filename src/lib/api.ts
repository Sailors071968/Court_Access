// ============================================================================
// CourtAccess — API Helper (FULLY WIRED)
// ============================================================================

const API_BASE = "/api";

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------
export async function apiRequest(
  path: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("API Error:", text);
    throw new Error(`API request failed: ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upload Evidence (multipart)
// ---------------------------------------------------------------------------
export async function uploadEvidence(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/evidence/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Upload Error:", text);
    throw new Error("Upload failed");
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Trigger Timeline Processing
// ---------------------------------------------------------------------------
export async function rebuildTimeline(caseId: string) {
  return apiRequest(`/timeline/rebuild/${caseId}`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Fetch Timeline Events
// ---------------------------------------------------------------------------
export async function getTimelineEvents(caseId: string) {
  return apiRequest(`/timeline/${caseId}/events`);
}
