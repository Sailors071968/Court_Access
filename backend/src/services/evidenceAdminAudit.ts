// ============================================================================
// Phase 268 — Evidence Admin Audit
// Every admin action on evidence is logged
// ============================================================================

export interface EvidenceAdminAction {
  id: string;
  adminUserId: string;
  action: 'view' | 'download' | 'delete' | 'modify' | 'reassign' | 'reprocess' | 'export' | 'share';
  evidenceId: string;
  timestamp: string;
  details: string;
  ipAddress?: string;
}

export class EvidenceAdminAuditService {
  private static logs: EvidenceAdminAction[] = [];

  static log(entry: Omit<EvidenceAdminAction, 'id' | 'timestamp'>): EvidenceAdminAction {
    const record: EvidenceAdminAction = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    EvidenceAdminAuditService.logs.push(record);
    console.log(`[AUDIT] ${record.action} on evidence ${record.evidenceId} by admin ${record.adminUserId}`);
    return record;
  }

  static getAuditLog(evidenceId?: string): EvidenceAdminAction[] {
    if (evidenceId) {
      return EvidenceAdminAuditService.logs.filter((l) => l.evidenceId === evidenceId);
    }
    return [...EvidenceAdminAuditService.logs];
  }
}
