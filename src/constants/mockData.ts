// ============================================
// Court Access — Mock Data (Production)
// All mock data has been removed for production.
// Real data is fetched from backend API.
// ============================================

import type { CaseEntity, ChargeEntity, ActivityEntry, NotificationEntry, InvestigativeTaskEntity } from '../models/CaseModel';
import type { DocumentEntity } from '../models/DocumentModel';
import { DOCUMENT_TYPE_LABELS } from '../models/DocumentModel';

// Re-export for consumers that imported from here
export { DOCUMENT_TYPE_LABELS };

// ---------------------------------------------------------------------------
// All mock data removed for production.
// Real data is fetched from backend API endpoints.
// ---------------------------------------------------------------------------

export const MOCK_CASES: CaseEntity[] = [];
export const MOCK_CHARGES: ChargeEntity[] = [];
export const MOCK_DOCUMENTS: DocumentEntity[] = [];
export const MOCK_ACTIVITY: ActivityEntry[] = [];
export const MOCK_NOTIFICATIONS: NotificationEntry[] = [];
export const MOCK_TASKS: InvestigativeTaskEntity[] = [];
