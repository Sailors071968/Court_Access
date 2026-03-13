// ============================================
// Court Access — Data Constants (Production)
// All mock data removed for production security.
// Real data is served via backend API endpoints.
// ============================================

import type { CaseEntity, ChargeEntity, ActivityEntry, NotificationEntry, InvestigativeTaskEntity } from '../models/CaseModel';
import type { DocumentEntity } from '../models/DocumentModel';
import { DOCUMENT_TYPE_LABELS } from '../models/DocumentModel';

// Re-export for consumers that imported from here
export { DOCUMENT_TYPE_LABELS };

// ---------------------------------------------------------------------------
// Empty arrays — production uses real API data
// ---------------------------------------------------------------------------

export const MOCK_CASES: CaseEntity[] = [];
export const MOCK_CHARGES: ChargeEntity[] = [];
export const MOCK_DOCUMENTS: DocumentEntity[] = [];
export const MOCK_ACTIVITY: ActivityEntry[] = [];
export const MOCK_NOTIFICATIONS: NotificationEntry[] = [];
export const MOCK_TASKS: InvestigativeTaskEntity[] = [];
