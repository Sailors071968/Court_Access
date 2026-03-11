// ============================================================================
// Phase 272 — Analysis Version History
// Phase 273 — Analysis Regeneration Trigger
// Analysis documents are versioned and auto-regenerate on changes
// ============================================================================

export interface CaseAnalysisVersion {
  versionId: string;
  caseId: string;
  createdTimestamp: string;
  evidenceSnapshot: string[];
  analysisSummary: string;
  timelineEventsCount: number;
  inconsistenciesCount: number;
  exhibitsRecommended: number;
  triggeredBy: 'new_evidence' | 'evidence_reprocessed' | 'policy_update' | 'manual';
}

export class AnalysisVersionService {
  private static versions: CaseAnalysisVersion[] = [];

  static createVersion(caseId: string, trigger: CaseAnalysisVersion['triggeredBy'], snapshot: string[]): CaseAnalysisVersion {
    const version: CaseAnalysisVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId,
      createdTimestamp: new Date().toISOString(),
      evidenceSnapshot: snapshot,
      analysisSummary: 'Analysis regenerated',
      timelineEventsCount: 0,
      inconsistenciesCount: 0,
      exhibitsRecommended: 0,
      triggeredBy: trigger,
    };
    AnalysisVersionService.versions.push(version);
    return version;
  }

  static getVersionHistory(caseId: string): CaseAnalysisVersion[] {
    return AnalysisVersionService.versions
      .filter((v) => v.caseId === caseId)
      .sort((a, b) => new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime());
  }

  // Phase 273: Regeneration triggers
  static shouldRegenerate(trigger: 'new_evidence' | 'evidence_reprocessed' | 'policy_update'): boolean {
    return true; // Always regenerate on these triggers
  }
}
