// ============================================
// Court Access — Intelligence Model (Scaffold)
// Deterministic signals only (no probabilistic scoring).
// ============================================

export type IntelligenceSeverity = 'info' | 'warning' | 'danger';

export interface IntelligenceSignal {
  id: string;
  label: string;
  severity: IntelligenceSeverity;
}

export interface IntelligenceSnapshot {
  caseId: string;
  signals: IntelligenceSignal[];
  notes: string;
}
