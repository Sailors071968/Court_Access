// ============================================
// Court Access — Case Data Provider (Production)
// Fetches real data from backend API endpoints.
// All mock data removed for production security.
// ============================================

import type { CaseEntity, ChargeEntity, ActivityEntry, NotificationEntry } from '../models/CaseModel';
import type { DocumentEntity, DocumentType } from '../models/DocumentModel';
import { DOCUMENT_TYPE_LABELS } from '../models/DocumentModel';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? []);
  } catch {
    return [];
  }
}

export const caseDataProvider = {
  async getCases(): Promise<CaseEntity[]> {
    return apiFetch<CaseEntity>('/cases');
  },

  async getPrimaryCase(): Promise<CaseEntity | null> {
    const cases = await caseDataProvider.getCases();
    return cases.length > 0 ? cases[0] : null;
  },

  async getCaseById(caseId: string): Promise<CaseEntity | null> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? json ?? null;
    } catch {
      return null;
    }
  },

  async getCharges(caseId?: string): Promise<ChargeEntity[]> {
    const path = caseId ? `/cases/${caseId}/charges` : '/charges';
    return apiFetch<ChargeEntity>(path);
  },

  async getDocuments(caseId?: string): Promise<DocumentEntity[]> {
    const path = caseId ? `/cases/${caseId}/documents` : '/documents';
    return apiFetch<DocumentEntity>(path);
  },

  async getActivity(caseId?: string): Promise<ActivityEntry[]> {
    const path = caseId ? `/cases/${caseId}/activity` : '/activity';
    return apiFetch<ActivityEntry>(path);
  },

  async getNotifications(): Promise<NotificationEntry[]> {
    return apiFetch<NotificationEntry>('/notifications');
  },

  getDocumentTypeLabels(): Record<DocumentType, string> {
    return { ...DOCUMENT_TYPE_LABELS };
  },
} as const;

export const { getCases, getPrimaryCase, getCaseById, getCharges, getDocuments, getActivity, getNotifications, getDocumentTypeLabels } = caseDataProvider;
