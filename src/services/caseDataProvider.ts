// ============================================
// Court Access — Case Data Provider (Phase 1)
// Abstraction layer returning canonical model types.
// Phase 6 will replace mock data with real API calls.
// ============================================

import type { CaseEntity, ChargeEntity, ActivityEntry, NotificationEntry } from '../models/CaseModel';
import type { DocumentEntity, DocumentType } from '../models/DocumentModel';
import { DOCUMENT_TYPE_LABELS } from '../models/DocumentModel';
import { MOCK_ACTIVITY, MOCK_CASES, MOCK_CHARGES, MOCK_DOCUMENTS, MOCK_NOTIFICATIONS } from '../constants/mockData';

function stableSortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export const caseDataProvider = {
  getCases(): CaseEntity[] {
    return stableSortById(MOCK_CASES);
  },

  getPrimaryCase(): CaseEntity | null {
    const cases = caseDataProvider.getCases();
    if (cases.length === 0) {
      return null;
    }
    return cases[0];
  },

  getCaseById(caseId: string): CaseEntity | null {
    const cases = caseDataProvider.getCases();
    return cases.find((c) => c.id === caseId) ?? null;
  },

  getCharges(_caseId?: string): ChargeEntity[] {
    return stableSortById(MOCK_CHARGES);
  },

  getDocuments(_caseId?: string): DocumentEntity[] {
    return stableSortById(MOCK_DOCUMENTS);
  },

  getActivity(_caseId?: string): ActivityEntry[] {
    return stableSortById(MOCK_ACTIVITY);
  },

  getNotifications(): NotificationEntry[] {
    return stableSortById(MOCK_NOTIFICATIONS);
  },

  getDocumentTypeLabels(): Record<DocumentType, string> {
    return { ...DOCUMENT_TYPE_LABELS };
  },
} as const;

export const { getCases, getPrimaryCase, getCaseById, getCharges, getDocuments, getActivity, getNotifications, getDocumentTypeLabels } = caseDataProvider;
