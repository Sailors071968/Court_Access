// ============================================
// Court Access — Case Data Provider (Phase 0)
// Abstraction layer to isolate mock data usage.
// Phase 1 will replace this with real data sources.
// ============================================

import type { ActivityItem, Case, CaseDocument, Charge, DocumentType, Notification } from '../types';
import { DOCUMENT_TYPE_LABELS, MOCK_ACTIVITY, MOCK_CASES, MOCK_CHARGES, MOCK_DOCUMENTS, MOCK_NOTIFICATIONS } from '../constants/mockData';

function stableSortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export const caseDataProvider = {
  getCases(): Case[] {
    return stableSortById(MOCK_CASES);
  },

  getPrimaryCase(): Case {
    const cases = caseDataProvider.getCases();
    if (cases.length === 0) {
      throw new Error('No cases available');
    }
    return cases[0];
  },

  getCharges(_caseId?: string): Charge[] {
    return stableSortById(MOCK_CHARGES);
  },

  getDocuments(_caseId?: string): CaseDocument[] {
    return stableSortById(MOCK_DOCUMENTS);
  },

  getActivity(_caseId?: string): ActivityItem[] {
    return stableSortById(MOCK_ACTIVITY);
  },

  getNotifications(): Notification[] {
    return stableSortById(MOCK_NOTIFICATIONS);
  },

  getDocumentTypeLabels(): Record<DocumentType, string> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { ...DOCUMENT_TYPE_LABELS } as Record<DocumentType, string>;
  },
} as const;

export const { getCases, getPrimaryCase, getCharges, getDocuments, getActivity, getNotifications, getDocumentTypeLabels } = caseDataProvider;
