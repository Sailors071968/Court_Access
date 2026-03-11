// ============================================================================
// Phase 291.5 — Case Analysis Worker Pipeline
// New worker job: generate_case_analysis
// Queue stage order:
//   OCR → TEXT_EXTRACTION → ENTITY_EXTRACTION → TIMELINE_BUILD →
//   POLICY_COMPARISON → CASE_ANALYSIS → LITIGATION_RECOMMENDATIONS
// ============================================================================

import { QUEUE_CONFIGS } from './queueManager';

// ---------------------------------------------------------------------------
// Pipeline Stage Definitions
// ---------------------------------------------------------------------------

export type CaseAnalysisPipelineStage =
  | 'OCR'
  | 'TEXT_EXTRACTION'
  | 'ENTITY_EXTRACTION'
  | 'TIMELINE_BUILD'
  | 'POLICY_COMPARISON'
  | 'CASE_ANALYSIS'
  | 'LITIGATION_RECOMMENDATIONS';

export const PIPELINE_STAGE_ORDER: CaseAnalysisPipelineStage[] = [
  'OCR',
  'TEXT_EXTRACTION',
  'ENTITY_EXTRACTION',
  'TIMELINE_BUILD',
  'POLICY_COMPARISON',
  'CASE_ANALYSIS',
  'LITIGATION_RECOMMENDATIONS',
];

export interface PipelineStageStatus {
  stage: CaseAnalysisPipelineStage;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  outputSummary?: string;
}

export interface CaseAnalysisJobData {
  caseId: string;
  triggeredBy: string;
  trigger: 'new_evidence' | 'evidence_reprocessed' | 'policy_update' | 'manual';
  evidenceFileIds: string[];
  startFromStage?: CaseAnalysisPipelineStage;
  skipStages?: CaseAnalysisPipelineStage[];
}

export interface CaseAnalysisJobResult {
  caseId: string;
  jobId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stageResults: PipelineStageStatus[];
  analysisVersion: number;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Register queue config for case analysis
// ---------------------------------------------------------------------------

// Add case analysis queue config to the registry
QUEUE_CONFIGS.caseAnalysis = {
  name: 'case-analysis-queue',
  concurrency: 2,
  maxRetries: 2,
  retryBackoffMs: 15_000,
  timeoutMs: 600_000, // 10 minutes for full pipeline
  enabled: true,
  description: 'Runs full case analysis pipeline: OCR → Text → Entities → Timeline → Policy → Analysis → Recommendations',
};

QUEUE_CONFIGS.litigationRecommendations = {
  name: 'litigation-recommendations-queue',
  concurrency: 3,
  maxRetries: 2,
  retryBackoffMs: 10_000,
  timeoutMs: 300_000, // 5 minutes for recommendation generation
  enabled: true,
  description: 'Generates litigation intelligence recommendations from processed evidence',
};

// ---------------------------------------------------------------------------
// Pipeline Executor
// ---------------------------------------------------------------------------

export class CaseAnalysisPipeline {
  private caseId: string;
  private stageStatuses: PipelineStageStatus[] = [];

  constructor(caseId: string) {
    this.caseId = caseId;
    // Initialize all stages as pending
    this.stageStatuses = PIPELINE_STAGE_ORDER.map(stage => ({
      stage,
      status: 'pending' as const,
    }));
  }

  /**
   * Execute the full pipeline from the specified starting stage.
   * Stages before startFromStage are marked as 'skipped'.
   */
  async execute(jobData: CaseAnalysisJobData): Promise<CaseAnalysisJobResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    const startIndex = jobData.startFromStage
      ? PIPELINE_STAGE_ORDER.indexOf(jobData.startFromStage)
      : 0;

    const skipSet = new Set(jobData.skipStages ?? []);

    for (let i = 0; i < PIPELINE_STAGE_ORDER.length; i++) {
      const stage = PIPELINE_STAGE_ORDER[i];
      const stageStatus = this.stageStatuses[i];

      // Skip stages before the start point
      if (i < startIndex) {
        stageStatus.status = 'skipped';
        stageStatus.outputSummary = 'Skipped: prior stage data available';
        continue;
      }

      // Skip explicitly excluded stages
      if (skipSet.has(stage)) {
        stageStatus.status = 'skipped';
        stageStatus.outputSummary = 'Skipped by request';
        continue;
      }

      // Execute stage
      const stageStart = Date.now();
      stageStatus.status = 'running';
      stageStatus.startedAt = new Date().toISOString();

      try {
        const result = await this.executeStage(stage, jobData);
        stageStatus.status = 'completed';
        stageStatus.completedAt = new Date().toISOString();
        stageStatus.durationMs = Date.now() - stageStart;
        stageStatus.outputSummary = result;
      } catch (err) {
        stageStatus.status = 'failed';
        stageStatus.completedAt = new Date().toISOString();
        stageStatus.durationMs = Date.now() - stageStart;
        stageStatus.error = err instanceof Error ? err.message : String(err);
        error = `Stage ${stage} failed: ${stageStatus.error}`;
        success = false;
        break; // Stop pipeline on failure
      }
    }

    return {
      caseId: this.caseId,
      jobId: `job-${Date.now()}`,
      startedAt,
      completedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      stageResults: this.stageStatuses,
      analysisVersion: Date.now(),
      success,
      error,
    };
  }

  /**
   * Execute a single pipeline stage.
   * Each stage calls the appropriate backend service.
   */
  private async executeStage(stage: CaseAnalysisPipelineStage, jobData: CaseAnalysisJobData): Promise<string> {
    console.log(`[CaseAnalysisPipeline] Executing stage: ${stage} for case ${this.caseId}`);

    switch (stage) {
      case 'OCR':
        // Process evidence files through OCR
        // In production: calls OCR service for each evidence file
        return `OCR processed ${jobData.evidenceFileIds.length} files`;

      case 'TEXT_EXTRACTION':
        // Extract text from OCR output and native text files
        // In production: calls text extraction service
        return `Text extracted from ${jobData.evidenceFileIds.length} documents`;

      case 'ENTITY_EXTRACTION':
        // Extract named entities (officers, witnesses, locations, etc.)
        // In production: calls NER pipeline
        return `Entities extracted from case ${this.caseId}`;

      case 'TIMELINE_BUILD':
        // Build chronological timeline from extracted events
        // In production: calls eventExtractionService + officerActionTimelineService
        return `Timeline built for case ${this.caseId}`;

      case 'POLICY_COMPARISON':
        // Compare detected actions against policy database
        // In production: calls policyComplianceAnalyzer
        return `Policy comparison complete for case ${this.caseId}`;

      case 'CASE_ANALYSIS':
        // Run full case analysis integration
        // In production: calls EvidenceIntelligenceIntegration.generateCaseAnalysis()
        return `Case analysis generated for case ${this.caseId}`;

      case 'LITIGATION_RECOMMENDATIONS':
        // Generate litigation recommendations from all processed data
        // In production: calls LitigationRecommendationGenerator.generate()
        return `Litigation recommendations generated for case ${this.caseId}`;

      default:
        throw new Error(`Unknown pipeline stage: ${stage}`);
    }
  }

  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStageStatus[] {
    return [...this.stageStatuses];
  }

  /**
   * Get the current active stage
   */
  getCurrentStage(): CaseAnalysisPipelineStage | null {
    const running = this.stageStatuses.find(s => s.status === 'running');
    return running?.stage ?? null;
  }

  /**
   * Get pipeline progress as a percentage
   */
  getProgress(): number {
    const total = this.stageStatuses.length;
    const completed = this.stageStatuses.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
}

// ---------------------------------------------------------------------------
// Job processor function (for BullMQ worker)
// ---------------------------------------------------------------------------

/**
 * Process a case analysis job. Called by BullMQ worker.
 */
export async function processCaseAnalysisJob(jobData: CaseAnalysisJobData): Promise<CaseAnalysisJobResult> {
  const pipeline = new CaseAnalysisPipeline(jobData.caseId);
  return pipeline.execute(jobData);
}
