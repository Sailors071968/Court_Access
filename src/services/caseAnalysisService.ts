// ============================================================================
// Phase 291.7 — Case Analysis Data Service (Frontend)
// Provides data hooks for CaseAnalysisSection and LitigationIntelligencePanel.
// Connects frontend components to the backend evidence processing pipeline.
// Includes sample evidence data for integration verification (Phase 291.9).
// ============================================================================

// ---------------------------------------------------------------------------
// Types (mirror backend output types for frontend consumption)
// ---------------------------------------------------------------------------

export interface EvidenceSummaryItem {
  type: string;
  count: number;
  iconType: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  source: string;
  sourceFileId: string;
  description: string;
  sourceType: 'bodycam' | 'dispatch' | '911' | 'officer_report' | 'witness';
  confidence: number;
}

export interface CrossDocComparison {
  id: string;
  sourceA: string;
  sourceAFileId: string;
  sourceB: string;
  sourceBFileId: string;
  observation: string;
  severity: 'high' | 'medium' | 'low';
}

export interface OfficerAction {
  id: string;
  officerId: string;
  actionType: string;
  timestamp: string;
  evidenceSource: string;
  evidenceFileId: string;
  confidence: number;
}

export interface PolicyComparison {
  id: string;
  officerAction: string;
  policyReference: string;
  observation: string;
  evidenceFileId: string;
  findingId: string;
  confidence: number;
}

export interface Inconsistency {
  id: string;
  type: string;
  description: string;
  sources: Array<{ label: string; fileId: string; timestamp?: string; paragraph?: string }>;
  severity: 'high' | 'medium' | 'low';
}

export interface RecommendedExhibit {
  id: string;
  title: string;
  type: string;
  linkedEvidence: Array<{ label: string; fileId: string }>;
}

export interface CaseAnalysisData {
  caseId: string;
  generatedAt: string;
  analysisVersion: number;
  evidenceSummary: EvidenceSummaryItem[];
  timelineEvents: TimelineEvent[];
  crossDocComparisons: CrossDocComparison[];
  officerActions: OfficerAction[];
  policyComparisons: PolicyComparison[];
  inconsistencies: Inconsistency[];
  recommendedExhibits: RecommendedExhibit[];
  pipelineStatus: PipelineStageStatus[];
  cached: boolean;
}

export interface PipelineStageStatus {
  stage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Recommendation Types (for LitigationIntelligencePanel)
// ---------------------------------------------------------------------------

export type RecommendationType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';
export type FeedbackStatus = 'relevant' | 'already_handled' | 'not_relevant' | null;

export interface EvidenceCitation {
  evidenceFileId: string;
  evidenceFileName: string;
  timestamp?: string;
  documentParagraph?: string;
  pageNumber?: number;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  observation: string;
  suggestedOpportunity: string;
  evidenceSource: string;
  evidenceLinks: EvidenceCitation[];
  confidenceScore: number;
  feedbackStatus: FeedbackStatus;
  duplicateCount?: number;
  deduplicationKey?: string;
}

export interface RecommendationData {
  caseId: string;
  generatedAt: string;
  disclaimer: string;
  recommendations: Recommendation[];
  duplicatesRemoved: number;
  totalByType: Record<RecommendationType, number>;
  cached: boolean;
}

// ---------------------------------------------------------------------------
// Sample Evidence Data (Phase 291.9 Integration Verification)
// Contains: 1 police report, 1 bodycam transcript, 1 witness statement
// ---------------------------------------------------------------------------

const SAMPLE_CASE_ID = 'case-demo-001';

const SAMPLE_ANALYSIS: CaseAnalysisData = {
  caseId: SAMPLE_CASE_ID,
  generatedAt: new Date().toISOString(),
  analysisVersion: Date.now(),
  cached: false,

  pipelineStatus: [
    { stage: 'OCR', status: 'completed', durationMs: 2340 },
    { stage: 'TEXT_EXTRACTION', status: 'completed', durationMs: 1120 },
    { stage: 'ENTITY_EXTRACTION', status: 'completed', durationMs: 890 },
    { stage: 'TIMELINE_BUILD', status: 'completed', durationMs: 560 },
    { stage: 'POLICY_COMPARISON', status: 'completed', durationMs: 1780 },
    { stage: 'CASE_ANALYSIS', status: 'completed', durationMs: 3200 },
    { stage: 'LITIGATION_RECOMMENDATIONS', status: 'completed', durationMs: 1450 },
  ],

  evidenceSummary: [
    { type: 'Police Reports', count: 1, iconType: 'FileText' },
    { type: 'Bodycam Videos', count: 1, iconType: 'Video' },
    { type: 'Witness Statements', count: 1, iconType: 'Users' },
  ],

  timelineEvents: [
    {
      id: 't-1', timestamp: '14:22:03', source: 'Dispatch Log',
      sourceFileId: 'ev-dispatch-001',
      description: '911 call received — report of disturbance at 1200 Oak Ave',
      sourceType: '911', confidence: 0.95,
    },
    {
      id: 't-2', timestamp: '14:24:15', source: 'Dispatch Log',
      sourceFileId: 'ev-dispatch-001',
      description: 'Unit 42 dispatched to scene',
      sourceType: 'dispatch', confidence: 0.95,
    },
    {
      id: 't-3', timestamp: '14:31:42', source: 'Bodycam — Officer Martinez',
      sourceFileId: 'ev-bodycam-001',
      description: 'Officer Martinez arrives on scene, activates body camera',
      sourceType: 'bodycam', confidence: 0.92,
    },
    {
      id: 't-4', timestamp: '14:32:18', source: 'Bodycam — Officer Martinez',
      sourceFileId: 'ev-bodycam-001',
      description: 'Initial contact with suspect, verbal commands issued',
      sourceType: 'bodycam', confidence: 0.88,
    },
    {
      id: 't-5', timestamp: '14:33:05', source: 'Police Report — Officer Martinez',
      sourceFileId: 'ev-report-001',
      description: 'Officer report states suspect began running southbound on Oak Ave',
      sourceType: 'officer_report', confidence: 0.85,
    },
    {
      id: 't-6', timestamp: '14:33:12', source: 'Bodycam — Officer Martinez',
      sourceFileId: 'ev-bodycam-001',
      description: 'Bodycam shows suspect stationary with hands at sides at this timestamp',
      sourceType: 'bodycam', confidence: 0.91,
    },
    {
      id: 't-7', timestamp: '14:34:30', source: 'Witness Statement — J. Rodriguez',
      sourceFileId: 'ev-witness-001',
      description: 'Witness reports hearing officer commands, states suspect had hands raised',
      sourceType: 'witness', confidence: 0.78,
    },
    {
      id: 't-8', timestamp: '14:35:15', source: 'Dispatch Log',
      sourceFileId: 'ev-dispatch-001',
      description: 'Officer Martinez requests backup units to 1200 Oak Ave',
      sourceType: 'dispatch', confidence: 0.95,
    },
    {
      id: 't-9', timestamp: '14:36:20', source: 'Bodycam — Officer Martinez',
      sourceFileId: 'ev-bodycam-001',
      description: 'Physical restraint applied — suspect taken to ground',
      sourceType: 'bodycam', confidence: 0.93,
    },
    {
      id: 't-10', timestamp: '14:37:45', source: 'Bodycam — Officer Martinez',
      sourceFileId: 'ev-bodycam-001',
      description: 'Handcuffs applied, suspect placed in custody',
      sourceType: 'bodycam', confidence: 0.95,
    },
  ],

  crossDocComparisons: [
    {
      id: 'cd-1',
      sourceA: 'Police Report (pg 3, para 2)',
      sourceAFileId: 'ev-report-001',
      sourceB: 'Bodycam Transcript (14:33:05-14:33:12)',
      sourceBFileId: 'ev-bodycam-001',
      observation: 'Officer report states suspect was running. Bodycam footage at same timestamp shows suspect stationary with hands at sides. Potential narrative discrepancy between written report and video evidence.',
      severity: 'high',
    },
    {
      id: 'cd-2',
      sourceA: 'Witness Statement — J. Rodriguez',
      sourceAFileId: 'ev-witness-001',
      sourceB: 'Bodycam Transcript (14:34:30)',
      sourceBFileId: 'ev-bodycam-001',
      observation: 'Witness states suspect had hands raised. Bodycam partially corroborates but camera angle limits full visibility of suspect\'s hands. Angle-dependent observation.',
      severity: 'medium',
    },
    {
      id: 'cd-3',
      sourceA: 'Dispatch Log (14:35:15)',
      sourceAFileId: 'ev-dispatch-001',
      sourceB: 'Police Report (pg 4)',
      sourceBFileId: 'ev-report-001',
      observation: 'Dispatch log shows backup requested at 14:35:15. Officer report states backup arrived before force was used at 14:36:20. Timeline appears consistent — 65-second gap between request and force application.',
      severity: 'low',
    },
  ],

  officerActions: [
    {
      id: 'oa-1', officerId: 'Martinez #4821', actionType: 'verbal command',
      timestamp: '14:32:18', evidenceSource: 'Bodycam — Officer Martinez',
      evidenceFileId: 'ev-bodycam-001', confidence: 0.88,
    },
    {
      id: 'oa-2', officerId: 'Martinez #4821', actionType: 'foot pursuit',
      timestamp: '14:33:05', evidenceSource: 'Police Report',
      evidenceFileId: 'ev-report-001', confidence: 0.85,
    },
    {
      id: 'oa-3', officerId: 'Martinez #4821', actionType: 'suspect restrained',
      timestamp: '14:36:20', evidenceSource: 'Bodycam — Officer Martinez',
      evidenceFileId: 'ev-bodycam-001', confidence: 0.93,
    },
    {
      id: 'oa-4', officerId: 'Martinez #4821', actionType: 'handcuffing',
      timestamp: '14:37:45', evidenceSource: 'Bodycam — Officer Martinez',
      evidenceFileId: 'ev-bodycam-001', confidence: 0.95,
    },
  ],

  policyComparisons: [
    {
      id: 'pc-1',
      officerAction: 'foot pursuit',
      policyReference: 'Sacramento PD Foot Pursuit Policy (Section 4.2)',
      observation: 'Officer report describes initiating foot pursuit. Policy requires supervisor notification prior to or immediately upon initiating foot pursuit. No supervisor notification is documented in dispatch log or bodycam audio prior to pursuit. Potential policy inconsistency regarding notification timing.',
      evidenceFileId: 'ev-report-001',
      findingId: 'find-001',
      confidence: 0.78,
    },
    {
      id: 'pc-2',
      officerAction: 'suspect restrained',
      policyReference: 'Sacramento PD Use of Force Policy (Section 2.1)',
      observation: 'Physical restraint applied at 14:36:20. Bodycam does not clearly show de-escalation verbal warnings documented in policy as required prior to physical force application. Evidence suggests force may have preceded the standard verbal warning sequence.',
      evidenceFileId: 'ev-bodycam-001',
      findingId: 'find-002',
      confidence: 0.82,
    },
  ],

  inconsistencies: [
    {
      id: 'inc-1', type: 'report_vs_camera',
      description: 'Officer report states suspect was running at 14:33:05. Bodycam footage at 14:33:12 shows suspect stationary. 7-second discrepancy — report narrative is inconsistent with video evidence.',
      sources: [
        { label: 'Police Report pg 3, para 2', fileId: 'ev-report-001', paragraph: 'Paragraph 2' },
        { label: 'Bodycam (14:33:05-14:33:12)', fileId: 'ev-bodycam-001', timestamp: '14:33:05' },
      ],
      severity: 'high',
    },
    {
      id: 'inc-2', type: 'timeline_conflict',
      description: 'Dispatch log shows backup requested at 14:35:15. Physical force applied at 14:36:20. Officer report (pg 4) states "backup had arrived" before force was used. However, no unit arrival is logged in dispatch until 14:37:00.',
      sources: [
        { label: 'Dispatch Log', fileId: 'ev-dispatch-001', timestamp: '14:35:15' },
        { label: 'Police Report pg 4', fileId: 'ev-report-001', paragraph: 'Page 4' },
      ],
      severity: 'high',
    },
    {
      id: 'inc-3', type: 'statement_vs_camera',
      description: 'Witness J. Rodriguez states suspect had "hands raised above his head." Bodycam shows suspect\'s hands at sides at 14:33:12, then raised at approximately 14:34:20. Timing discrepancy in witness account.',
      sources: [
        { label: 'Witness Statement — J. Rodriguez', fileId: 'ev-witness-001' },
        { label: 'Bodycam (14:33:12 and 14:34:20)', fileId: 'ev-bodycam-001', timestamp: '14:34:20' },
      ],
      severity: 'medium',
    },
  ],

  recommendedExhibits: [
    {
      id: 're-1', title: 'Timeline Comparison: Report vs Bodycam',
      type: 'timeline',
      linkedEvidence: [
        { label: 'Police Report', fileId: 'ev-report-001' },
        { label: 'Bodycam — Officer Martinez', fileId: 'ev-bodycam-001' },
        { label: 'Dispatch Log', fileId: 'ev-dispatch-001' },
      ],
    },
    {
      id: 're-2', title: 'Officer Report vs Bodycam Visual Comparison (14:33)',
      type: 'comparison',
      linkedEvidence: [
        { label: 'Police Report pg 3', fileId: 'ev-report-001' },
        { label: 'Bodycam (14:33:05-14:33:12)', fileId: 'ev-bodycam-001' },
      ],
    },
    {
      id: 're-3', title: 'Policy Compliance Analysis Exhibit',
      type: 'policy',
      linkedEvidence: [
        { label: 'Sacramento PD Foot Pursuit Policy', fileId: 'ev-report-001' },
        { label: 'Sacramento PD Use of Force Policy', fileId: 'ev-bodycam-001' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sample Recommendations (Phase 291.9 — generated from sample evidence)
// ---------------------------------------------------------------------------

const SAMPLE_RECOMMENDATIONS: RecommendationData = {
  caseId: SAMPLE_CASE_ID,
  generatedAt: new Date().toISOString(),
  disclaimer: 'CourtAccess provides analytical observations based on uploaded evidence. Attorneys must independently evaluate all legal strategies.',
  duplicatesRemoved: 2,
  cached: false,
  totalByType: {
    INVESTIGATION: 3,
    MOTION: 3,
    SUBPOENA: 2,
    PUBLIC_RECORD: 2,
    EXPERT: 2,
  },
  recommendations: [
    // Investigative Opportunities (from bodycam + police report analysis)
    {
      id: 'inv-1', type: 'INVESTIGATION',
      observation: 'Bodycam footage indicates suspect was stationary at 14:33:12, contradicting officer report of suspect running.',
      suggestedOpportunity: 'Obtain additional camera angles from nearby businesses to corroborate bodycam footage of suspect behavior at 14:33.',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:33:12' },
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 3, Paragraph 2' },
      ],
      confidenceScore: 0.90, feedbackStatus: null,
    },
    {
      id: 'inv-2', type: 'INVESTIGATION',
      observation: 'Witness J. Rodriguez references additional bystanders who were present but have not been identified.',
      suggestedOpportunity: 'Identify and interview additional witnesses referenced in witness statement.',
      evidenceSource: 'Witness Statement — J. Rodriguez',
      evidenceLinks: [
        { evidenceFileId: 'ev-witness-001', evidenceFileName: 'Witness Statement — J. Rodriguez', documentParagraph: 'Paragraph 4' },
      ],
      confidenceScore: 0.80, feedbackStatus: null,
    },
    {
      id: 'inv-3', type: 'INVESTIGATION',
      observation: 'Incident occurred at intersection of Oak Ave and 12th St, area with traffic cameras.',
      suggestedOpportunity: 'Obtain and review available traffic camera and surveillance recordings from the intersection.',
      evidenceSource: 'Police Report — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 1, Scene Description' },
      ],
      confidenceScore: 0.88, feedbackStatus: null,
    },

    // Procedural Opportunities (from policy comparison results)
    {
      id: 'mot-1', type: 'MOTION',
      observation: 'Bodycam shows physical restraint at 14:36:20 without documented de-escalation warnings. Officer report does not document verbal force warnings prior to physical restraint.',
      suggestedOpportunity: 'Review for potential suppression motion regarding use-of-force sequence and policy compliance.',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:36:20' },
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 4' },
      ],
      confidenceScore: 0.85, feedbackStatus: null,
    },
    {
      id: 'mot-2', type: 'MOTION',
      observation: 'Officer report narrative contradicts bodycam footage regarding suspect movement at 14:33. Report states running; bodycam shows stationary.',
      suggestedOpportunity: 'Request disclosure of all bodycam footage segments (potential Brady material if narrative discrepancy was known).',
      evidenceSource: 'Police Report — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 3, Paragraph 2' },
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:33:05' },
      ],
      confidenceScore: 0.90, feedbackStatus: null,
    },
    {
      id: 'mot-3', type: 'MOTION',
      observation: 'Officer Martinez has use-of-force event documented in this incident. Standard review for officer history.',
      suggestedOpportunity: 'Consider officer personnel record discovery review (Pitchess motion).',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:36:20' },
      ],
      confidenceScore: 0.75, feedbackStatus: null,
    },

    // Records to Obtain (from dispatch + bodycam analysis)
    {
      id: 'sub-1', type: 'SUBPOENA',
      observation: 'Dispatch log references radio traffic and CAD records not included in current evidence package.',
      suggestedOpportunity: 'Obtain full dispatch log, CAD records, and 911 call recordings.',
      evidenceSource: 'Dispatch Log',
      evidenceLinks: [
        { evidenceFileId: 'ev-dispatch-001', evidenceFileName: 'Dispatch Log', timestamp: '14:22:03' },
      ],
      confidenceScore: 0.90, feedbackStatus: null, duplicateCount: 2,
    },
    {
      id: 'sub-2', type: 'SUBPOENA',
      observation: 'Incident occurred in commercial district at 1200 Oak Ave with multiple nearby businesses.',
      suggestedOpportunity: 'Obtain nearby surveillance camera recordings from businesses at 1200 block of Oak Ave.',
      evidenceSource: 'Police Report — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 1' },
      ],
      confidenceScore: 0.80, feedbackStatus: null,
    },

    // Public Records (from policy comparison)
    {
      id: 'pub-1', type: 'PUBLIC_RECORD',
      observation: 'Officer used physical restraint technique during arrest. Training compliance unclear.',
      suggestedOpportunity: 'Request training records for physical restraint techniques used by Officer Martinez.',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:36:20' },
      ],
      confidenceScore: 0.85, feedbackStatus: null,
    },
    {
      id: 'pub-2', type: 'PUBLIC_RECORD',
      observation: 'Foot pursuit policy referenced in analysis but full policy manual not in evidence.',
      suggestedOpportunity: 'Request updated Sacramento PD policy manuals effective on the incident date.',
      evidenceSource: 'Policy Comparison Analysis',
      evidenceLinks: [
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 3' },
      ],
      confidenceScore: 0.90, feedbackStatus: null,
    },

    // Expert Consultations (from force event detection)
    {
      id: 'exp-1', type: 'EXPERT',
      observation: 'Use-of-force event detected at 14:36:20 with potential excessive force indicators based on bodycam review.',
      suggestedOpportunity: 'Consult police practices / use-of-force expert.',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:36:20' },
        { evidenceFileId: 'ev-report-001', evidenceFileName: 'Police Report', documentParagraph: 'Page 4, Use of Force Section' },
      ],
      confidenceScore: 0.90, feedbackStatus: null,
    },
    {
      id: 'exp-2', type: 'EXPERT',
      observation: 'Bodycam footage contains partially obscured segments during key moments. Enhancement may reveal additional detail.',
      suggestedOpportunity: 'Consult video forensic analyst for enhancement and frame-by-frame analysis of 14:33-14:37 segment.',
      evidenceSource: 'Bodycam — Officer Martinez',
      evidenceLinks: [
        { evidenceFileId: 'ev-bodycam-001', evidenceFileName: 'Bodycam — Officer Martinez', timestamp: '14:33:00' },
      ],
      confidenceScore: 0.82, feedbackStatus: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Data Service API
// ---------------------------------------------------------------------------

// In-memory cache (frontend layer — complements backend CaseAnalysisCacheService)
const analysisCache = new Map<string, { data: CaseAnalysisData; fetchedAt: number }>();
const recommendationCache = new Map<string, { data: RecommendationData; fetchedAt: number }>();
const FRONTEND_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch case analysis data for a given case ID.
 * Uses frontend cache first, then falls back to API (or sample data).
 */
export async function fetchCaseAnalysis(caseId: string): Promise<CaseAnalysisData> {
  // Check frontend cache
  const cached = analysisCache.get(caseId);
  if (cached && Date.now() - cached.fetchedAt < FRONTEND_CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  // In production: fetch from backend API
  // GET /api/cases/:caseId/analysis
  // For now: return sample data for demo case, or generate stub for other cases
  const data = caseId === SAMPLE_CASE_ID || caseId === 'demo'
    ? { ...SAMPLE_ANALYSIS, caseId }
    : { ...SAMPLE_ANALYSIS, caseId }; // Use sample data for all cases until API is wired

  // Store in frontend cache
  analysisCache.set(caseId, { data, fetchedAt: Date.now() });

  return data;
}

/**
 * Fetch litigation recommendations for a given case ID.
 * Uses frontend cache first, then falls back to API (or sample data).
 */
export async function fetchRecommendations(caseId: string): Promise<RecommendationData> {
  // Check frontend cache
  const cached = recommendationCache.get(caseId);
  if (cached && Date.now() - cached.fetchedAt < FRONTEND_CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  // In production: fetch from backend API
  // GET /api/cases/:caseId/recommendations
  const data = caseId === SAMPLE_CASE_ID || caseId === 'demo'
    ? { ...SAMPLE_RECOMMENDATIONS, caseId }
    : { ...SAMPLE_RECOMMENDATIONS, caseId };

  // Store in frontend cache
  recommendationCache.set(caseId, { data, fetchedAt: Date.now() });

  return data;
}

/**
 * Invalidate frontend cache for a case.
 * Called when evidence changes or user requests refresh.
 */
export function invalidateCaseCache(caseId: string): void {
  analysisCache.delete(caseId);
  recommendationCache.delete(caseId);
}

/**
 * Submit attorney feedback for a recommendation.
 * In production: POST /api/cases/:caseId/recommendations/:recId/feedback
 */
export async function submitFeedback(
  caseId: string,
  recommendationId: string,
  feedback: 'relevant' | 'already_handled' | 'not_relevant',
): Promise<void> {
  console.log(`[CaseAnalysisService] Feedback submitted: ${caseId}/${recommendationId} = ${feedback}`);
  // In production: API call
  // POST /api/cases/:caseId/recommendations/:recId/feedback
  // Body: { feedback }
}

/**
 * Trigger regeneration of case analysis.
 * In production: POST /api/cases/:caseId/analysis/regenerate
 */
export async function triggerRegeneration(caseId: string, reason: string): Promise<void> {
  console.log(`[CaseAnalysisService] Regeneration triggered for case ${caseId}: ${reason}`);
  invalidateCaseCache(caseId);
  // In production: API call
  // POST /api/cases/:caseId/analysis/regenerate
  // Body: { reason }
}
