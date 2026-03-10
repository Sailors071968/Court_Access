// ============================================================================
// CourtAccess — Demo Request Model
// Phase 211: Government demonstration request storage
// ============================================================================

export interface DemoRequest {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  county: string;
  agencyType: string;
  message: string;
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'declined';
  submittedAt: string;
  updatedAt: string;
}

// In-memory store (production: migrate to PostgreSQL)
const demoRequests: DemoRequest[] = [];

export function createDemoRequest(data: Omit<DemoRequest, 'id' | 'status' | 'submittedAt' | 'updatedAt'>): DemoRequest {
  const request: DemoRequest = {
    ...data,
    id: crypto.randomUUID(),
    status: 'new',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  demoRequests.push(request);
  return request;
}

export function getDemoRequests(): DemoRequest[] {
  return [...demoRequests];
}

export function getDemoRequestById(id: string): DemoRequest | undefined {
  return demoRequests.find((r) => r.id === id);
}

export function updateDemoRequestStatus(id: string, status: DemoRequest['status']): DemoRequest | undefined {
  const request = demoRequests.find((r) => r.id === id);
  if (request) {
    request.status = status;
    request.updatedAt = new Date().toISOString();
  }
  return request;
}
