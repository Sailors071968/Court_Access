// ============================================
// Court Access — Evidence Intelligence API Routes
// Phases 120-150 + A-P: Full evidence intelligence
// and fact-graph reasoning endpoints
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

// Phase 120: Evidence Registry
import { registerEvidence, verifyIntegrity, appendCustodyEvent, getChainOfCustody, getCaseEvidence, findByHash } from '../services/evidenceIntegrityService.js';
// Phase 121: Evidence Classifier
import { classifyEvidence, batchClassify } from '../services/evidenceClassifier.js';
// Phase 122: Transcription
import { processTranscription, getTranscriptPage, getFullTranscript, searchTranscript } from '../workers/transcriptionWorker.js';
// Phase 123/124/B: Fact Extraction
import { extractFacts, getCaseFacts, getDocumentFacts } from '../engines/factExtractionEngine.js';
// Phase 125: Correlation
import { correlateEvidence, getCaseCorrelations } from '../engines/evidenceCorrelationEngine.js';
// Phase 126: Event Reconstruction
import { reconstructEvents, getCaseReconstructedEvents } from '../engines/eventReconstructionEngine.js';
// Phase 127: Court Timeline
import { buildCourtTimeline, getCaseTimeline } from '../engines/courtTimelineEngine.js';
// Phase 128: Timeline Conflicts
import { detectTimelineConflicts, getCaseTimelineConflicts } from '../engines/timelineConflictEngine.js';
// Phase 129: Witness Reliability
import { analyzeWitnessReliability, getCaseWitnessReliability, getWitnessReliability } from '../engines/witnessReliabilityEngine.js';
// Phase 130: Misidentification Risk
import { evaluateMisidentificationRisk, autoEvaluateMisidentificationRisk, getCaseMisidentificationRisks } from '../engines/misidentificationRiskEngine.js';
// Phase 131: Admissibility
import { analyzeAdmissibility, analyzeCaseAdmissibility, getCaseAdmissibilityIssues } from '../engines/admissibilityEngine.js';
// Phase 132: Evidence Impact
import { scoreEvidenceImpact, scoreCaseEvidence, getCaseImpactScores } from '../engines/evidenceImpactEngine.js';
// Phase 133: Investigative Opportunities
import { identifyOpportunities, getCaseOpportunities } from '../engines/investigativeOpportunityEngine.js';
// Phase 134: Investigative Tasks
import { generateInvestigativeTasks, updateTaskStatus, getCaseTasks } from '../engines/investigativeTaskEngine.js';
// Phase 135: Task Tracking
import { transitionTask, getTaskProgress, assignTask, getTaskHistory } from '../engines/taskTrackingEngine.js';
// Phase 136: Corroboration Matrix
import { buildCorroborationMatrix, getCaseCorroborationMatrix } from '../engines/corroborationEngine.js';
// Phase 137: Narrative Reconstruction
import { reconstructNarrative, getCaseNarratives } from '../engines/narrativeReconstructionEngine.js';
// Phase 138: Narrative Comparison
import { compareNarratives, getCaseNarrativeComparisons } from '../engines/narrativeComparisonEngine.js';
// Phase 139: Cross-Examination
import { generateCrossExamQuestions, getCaseQuestions } from '../engines/crossExaminationEngine.js';
// Phase 141: Exam Builder
import { buildExamOutline, getCaseExamOutlines } from '../engines/examBuilderEngine.js';
// Phase 142: Trial Outline
import { generateTrialOutline, getCaseTrialOutlines } from '../engines/trialOutlineEngine.js';
// Phase 143: Motion Strategy
import { generateMotionStrategy, getCaseMotionRecommendations } from '../engines/motionStrategyEngine.js';
// Phase 144: Legal Issues
import { spotLegalIssues, getCaseLegalIssues } from '../engines/legalIssueEngine.js';
// Phase 145: Graph Enrichment
import { enrichEvidenceGraph, getCaseEnrichedGraph } from '../engines/graphEnrichmentEngine.js';
// Phase 146: Path Analysis
import { analyzeEvidencePaths, findNodeConnections } from '../engines/pathAnalysisEngine.js';
// Phase 147: Performance
import { getCasePerformanceSummary } from '../engines/evidencePerformanceEngine.js';
// Phase 148: Audit
import { logAuditEvent, getCaseAuditTrail, getAuditSummary, verifyAuditCompleteness } from '../engines/evidenceAuditEngine.js';
// Phase 149: Neutrality
import { checkNeutrality, auditCaseNeutrality, getCaseNeutralityAudits } from '../engines/evidenceNeutralityEngine.js';

// Phase A: Verified Fact Registry
import { registerVerifiedFact, updateFactStatus, getCaseVerifiedFacts, getFactRevisions, getVFRSummary } from '../services/verifiedFactRegistry.js';
// Phase C: Fact Deduplication
import { deduplicateFacts, getCaseDeduplicationReport } from '../services/factDeduplicationService.js';
// Phase D: Fact Corroboration
import { analyzeFactCorroboration, getCaseCorroborationReport } from '../services/factCorroborationService.js';
// Phase E: Graph-Fact Integration
import { integrateFactsIntoGraph } from '../services/graphFactIntegrationService.js';
// Phase F: Fact Reasoning
import { runFactReasoning, getCaseInferences } from '../services/factReasoningEngine.js';
// Phase G: Logic Query
import { queryFacts, getCaseQueryHistory } from '../services/logicQueryService.js';
// Phase H: Fact-Narrative Comparison
import { compareNarrativeToFacts, getCaseNarrativeFactComparisons } from '../services/factNarrativeService.js';
// Phase I: Legal Reasoning
import { applyLegalReasoning, runFullLegalAnalysis, getCaseLegalAnalyses } from '../services/legalReasoningService.js';
// Phase J: Fact-Based Output
import { validateOutputGrounding, getCaseOutputValidations } from '../services/factBasedOutputService.js';
// Phase K: Dual Analysis
import { runDualAnalysis, getCaseDualAnalysisResults } from '../services/dualAnalysisService.js';
// Phase L: Output Deduplication
import { checkOutputDuplicate, registerOutput, getOutputDedupStats } from '../services/outputDeduplicationService.js';
// Phase M: Investigative Task Gen
import { generateFactBasedTasks } from '../services/investigativeTaskGenService.js';
// Phase N: Fact Audit Trail
import { logFactAuditEvent, getFactAuditTrail, getFactAuditSummary } from '../services/factAuditTrailService.js';
// Phase O: Fact Neutrality
import { auditFactOutputNeutrality } from '../services/factNeutralityService.js';
// Phase P: Fact Performance
import { getFactPerformanceSummary } from '../services/factPerformanceService.js';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------
// Phase 120: Evidence Registry
// ---------------------------------------------------------------

router.post('/:caseId/registry/register', async (req, res) => {
  try {
    const result = await registerEvidence({ caseId: req.params.caseId, ...req.body });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:caseId/registry/verify', async (req, res) => {
  try {
    const result = await verifyIntegrity(req.body.evidenceId, Buffer.from(req.body.fileBuffer, 'base64'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:caseId/registry/custody', async (req, res) => {
  try {
    const result = await appendCustodyEvent(req.body.evidenceId, req.body.custodyEvent);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/registry/custody/:evidenceId', async (req, res) => {
  try {
    const result = await getChainOfCustody(req.params.evidenceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/registry', async (req, res) => {
  try {
    const result = await getCaseEvidence(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/registry/hash/:fileHash', async (req, res) => {
  try {
    const result = await findByHash(req.params.fileHash);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 121: Classification
// ---------------------------------------------------------------

router.post('/:caseId/classify', async (req, res) => {
  try {
    const result = await classifyEvidence(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:caseId/classify/batch', async (req, res) => {
  try {
    const result = await batchClassify(req.body.items);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 122: Transcription
// ---------------------------------------------------------------

router.post('/:caseId/transcribe', async (req, res) => {
  try {
    const result = await processTranscription({ caseId: req.params.caseId, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/transcript/:evidenceId', async (req, res) => {
  try {
    const result = await getFullTranscript(req.params.caseId, req.params.evidenceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/transcript/:evidenceId/page/:page', async (req, res) => {
  try {
    const result = await getTranscriptPage(req.params.caseId, req.params.evidenceId, parseInt(req.params.page));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/transcript/:evidenceId/search', async (req, res) => {
  try {
    const result = await searchTranscript(req.params.caseId, req.params.evidenceId, req.query.q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 123/124: Fact Extraction
// ---------------------------------------------------------------

router.post('/:caseId/facts/extract', async (req, res) => {
  try {
    const result = await extractFacts({ caseId: req.params.caseId, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/facts', async (req, res) => {
  try {
    const result = await getCaseFacts(req.params.caseId, req.query.type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/facts/document/:documentId', async (req, res) => {
  try {
    const result = await getDocumentFacts(req.params.documentId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 125: Correlation
// ---------------------------------------------------------------

router.post('/:caseId/correlate', async (req, res) => {
  try {
    const result = await correlateEvidence(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/correlations', async (req, res) => {
  try {
    const result = await getCaseCorrelations(req.params.caseId, req.query.type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 126: Event Reconstruction
// ---------------------------------------------------------------

router.post('/:caseId/events/reconstruct', async (req, res) => {
  try {
    const result = await reconstructEvents(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/events', async (req, res) => {
  try {
    const result = await getCaseReconstructedEvents(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 127: Court Timeline
// ---------------------------------------------------------------

router.post('/:caseId/timeline/build', async (req, res) => {
  try {
    const result = await buildCourtTimeline(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/timeline', async (req, res) => {
  try {
    const result = await getCaseTimeline(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 128: Timeline Conflicts
// ---------------------------------------------------------------

router.post('/:caseId/conflicts/detect', async (req, res) => {
  try {
    const result = await detectTimelineConflicts(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/conflicts', async (req, res) => {
  try {
    const result = await getCaseTimelineConflicts(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 129: Witness Reliability
// ---------------------------------------------------------------

router.post('/:caseId/witness/analyze', async (req, res) => {
  try {
    const result = await analyzeWitnessReliability(req.params.caseId, req.body.witnessName, req.body.factors);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/witness/reliability', async (req, res) => {
  try {
    const result = await getCaseWitnessReliability(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/witness/reliability/:witnessName', async (req, res) => {
  try {
    const result = await getWitnessReliability(req.params.caseId, req.params.witnessName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 130: Misidentification Risk
// ---------------------------------------------------------------

router.post('/:caseId/misidentification/evaluate', async (req, res) => {
  try {
    const result = req.body.auto
      ? await autoEvaluateMisidentificationRisk(req.params.caseId, req.body.witnessName)
      : await evaluateMisidentificationRisk(req.params.caseId, req.body.witnessName, req.body.factors);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/misidentification', async (req, res) => {
  try {
    const result = await getCaseMisidentificationRisks(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 131: Admissibility
// ---------------------------------------------------------------

router.post('/:caseId/admissibility/analyze', async (req, res) => {
  try {
    const result = req.body.evidenceId
      ? await analyzeAdmissibility(req.params.caseId, req.body.evidenceId, req.body.textContent)
      : await analyzeCaseAdmissibility(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/admissibility', async (req, res) => {
  try {
    const result = await getCaseAdmissibilityIssues(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 132: Impact Scoring
// ---------------------------------------------------------------

router.post('/:caseId/impact/score', async (req, res) => {
  try {
    const result = req.body.evidenceId
      ? await scoreEvidenceImpact(req.params.caseId, req.body.evidenceId)
      : await scoreCaseEvidence(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/impact', async (req, res) => {
  try {
    const result = await getCaseImpactScores(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 133: Investigative Opportunities
// ---------------------------------------------------------------

router.post('/:caseId/opportunities/identify', async (req, res) => {
  try {
    const result = await identifyOpportunities(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/opportunities', async (req, res) => {
  try {
    const result = await getCaseOpportunities(req.params.caseId, req.query.priority);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 134/135: Investigative Tasks + Tracking
// ---------------------------------------------------------------

router.post('/:caseId/tasks/generate', async (req, res) => {
  try {
    const result = await generateInvestigativeTasks(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/tasks', async (req, res) => {
  try {
    const result = await getCaseTasks(req.params.caseId, req.query.status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:caseId/tasks/:taskId/status', async (req, res) => {
  try {
    const result = await transitionTask(req.params.taskId, req.body.status, req.body.actor, req.body.notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:caseId/tasks/:taskId/assign', async (req, res) => {
  try {
    const result = await assignTask(req.params.taskId, req.body.assignee, req.body.actor);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:caseId/tasks/progress', async (req, res) => {
  try {
    const result = await getTaskProgress(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/tasks/:taskId/history', async (req, res) => {
  try {
    const result = await getTaskHistory(req.params.taskId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 136: Corroboration Matrix
// ---------------------------------------------------------------

router.post('/:caseId/corroboration/build', async (req, res) => {
  try {
    const result = await buildCorroborationMatrix(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/corroboration', async (req, res) => {
  try {
    const result = await getCaseCorroborationMatrix(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 137: Narrative Reconstruction
// ---------------------------------------------------------------

router.post('/:caseId/narrative/reconstruct', async (req, res) => {
  try {
    const result = await reconstructNarrative(req.params.caseId, req.body.perspective);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/narratives', async (req, res) => {
  try {
    const result = await getCaseNarratives(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 138: Narrative Comparison
// ---------------------------------------------------------------

router.post('/:caseId/narrative/compare', async (req, res) => {
  try {
    const result = await compareNarratives(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/narrative/comparisons', async (req, res) => {
  try {
    const result = await getCaseNarrativeComparisons(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 139: Cross-Examination
// ---------------------------------------------------------------

router.post('/:caseId/cross-exam/generate', async (req, res) => {
  try {
    const result = await generateCrossExamQuestions(req.params.caseId, req.body.witnessName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/cross-exam', async (req, res) => {
  try {
    const result = await getCaseQuestions(req.params.caseId, req.query.witness);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 141: Exam Builder
// ---------------------------------------------------------------

router.post('/:caseId/exam/build', async (req, res) => {
  try {
    const result = await buildExamOutline(req.params.caseId, req.body.witnessName, req.body.examType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/exam/outlines', async (req, res) => {
  try {
    const result = await getCaseExamOutlines(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 142: Trial Outline
// ---------------------------------------------------------------

router.post('/:caseId/trial/outline', async (req, res) => {
  try {
    const result = await generateTrialOutline(req.params.caseId, req.body.side);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/trial/outlines', async (req, res) => {
  try {
    const result = await getCaseTrialOutlines(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 143: Motion Strategy
// ---------------------------------------------------------------

router.post('/:caseId/motions/generate', async (req, res) => {
  try {
    const result = await generateMotionStrategy(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/motions', async (req, res) => {
  try {
    const result = await getCaseMotionRecommendations(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 144: Legal Issues
// ---------------------------------------------------------------

router.post('/:caseId/legal-issues/spot', async (req, res) => {
  try {
    const result = await spotLegalIssues(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/legal-issues', async (req, res) => {
  try {
    const result = await getCaseLegalIssues(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 145: Graph Enrichment
// ---------------------------------------------------------------

router.post('/:caseId/graph/enrich', async (req, res) => {
  try {
    const result = await enrichEvidenceGraph(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/graph/enriched', async (req, res) => {
  try {
    const result = await getCaseEnrichedGraph(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 146: Path Analysis
// ---------------------------------------------------------------

router.post('/:caseId/graph/paths', async (req, res) => {
  try {
    const result = await analyzeEvidencePaths(req.params.caseId, req.body.sourceId, req.body.targetId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/graph/connections/:nodeId', async (req, res) => {
  try {
    const result = await findNodeConnections(req.params.caseId, req.params.nodeId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 147: Performance
// ---------------------------------------------------------------

router.get('/:caseId/performance', async (req, res) => {
  try {
    const result = await getCasePerformanceSummary(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 148: Audit Trail
// ---------------------------------------------------------------

router.post('/:caseId/audit/log', async (req, res) => {
  try {
    const result = await logAuditEvent({ caseId: req.params.caseId, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/audit', async (req, res) => {
  try {
    const result = await getCaseAuditTrail(req.params.caseId, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/audit/summary', async (req, res) => {
  try {
    const result = await getAuditSummary(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/audit/completeness/:evidenceId', async (req, res) => {
  try {
    const result = await verifyAuditCompleteness(req.params.caseId, req.params.evidenceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase 149: Neutrality
// ---------------------------------------------------------------

router.post('/:caseId/neutrality/check', async (req, res) => {
  try {
    const result = checkNeutrality(req.body.text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:caseId/neutrality/audit', async (req, res) => {
  try {
    const result = await auditCaseNeutrality(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/neutrality', async (req, res) => {
  try {
    const result = await getCaseNeutralityAudits(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================================================
// FACT-GRAPH REASONING LAYER (Phases A-P)
// ===============================================================

// ---------------------------------------------------------------
// Phase A: Verified Fact Registry
// ---------------------------------------------------------------

router.post('/:caseId/vfr/register', async (req, res) => {
  try {
    const result = await registerVerifiedFact({ caseId: req.params.caseId, ...req.body });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:caseId/vfr/:factId/status', async (req, res) => {
  try {
    const result = await updateFactStatus(req.params.factId, req.body.status, req.body.changedBy, req.body.reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:caseId/vfr', async (req, res) => {
  try {
    const result = await getCaseVerifiedFacts(req.params.caseId, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/vfr/:factId/revisions', async (req, res) => {
  try {
    const result = await getFactRevisions(req.params.factId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/vfr/summary', async (req, res) => {
  try {
    const result = await getVFRSummary(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase C: Fact Deduplication
// ---------------------------------------------------------------

router.post('/:caseId/facts/dedup', async (req, res) => {
  try {
    const result = await deduplicateFacts(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/facts/dedup/report', async (req, res) => {
  try {
    const result = await getCaseDeduplicationReport(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase D: Fact Corroboration
// ---------------------------------------------------------------

router.post('/:caseId/facts/corroborate', async (req, res) => {
  try {
    const result = await analyzeFactCorroboration(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/facts/corroboration', async (req, res) => {
  try {
    const result = await getCaseCorroborationReport(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase E: Graph-Fact Integration
// ---------------------------------------------------------------

router.post('/:caseId/graph/integrate-facts', async (req, res) => {
  try {
    const result = await integrateFactsIntoGraph(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase F: Fact Reasoning
// ---------------------------------------------------------------

router.post('/:caseId/reasoning/run', async (req, res) => {
  try {
    const result = await runFactReasoning(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/reasoning/inferences', async (req, res) => {
  try {
    const result = await getCaseInferences(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase G: Logic Query
// ---------------------------------------------------------------

router.post('/:caseId/query', async (req, res) => {
  try {
    const result = await queryFacts(req.params.caseId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/query/history', async (req, res) => {
  try {
    const result = await getCaseQueryHistory(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase H: Fact-Narrative Comparison
// ---------------------------------------------------------------

router.post('/:caseId/narrative/fact-check', async (req, res) => {
  try {
    const result = await compareNarrativeToFacts(req.params.caseId, req.body.narrativeId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/narrative/fact-comparisons', async (req, res) => {
  try {
    const result = await getCaseNarrativeFactComparisons(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase I: Legal Reasoning
// ---------------------------------------------------------------

router.post('/:caseId/legal/analyze', async (req, res) => {
  try {
    const result = req.body.analysisType
      ? await applyLegalReasoning(req.params.caseId, req.body.analysisType)
      : await runFullLegalAnalysis(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/legal/analyses', async (req, res) => {
  try {
    const result = await getCaseLegalAnalyses(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase J: Output Validation
// ---------------------------------------------------------------

router.post('/:caseId/output/validate', async (req, res) => {
  try {
    const result = await validateOutputGrounding(req.params.caseId, req.body.outputText, req.body.outputType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/output/validations', async (req, res) => {
  try {
    const result = await getCaseOutputValidations(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase K: Dual Analysis
// ---------------------------------------------------------------

router.post('/:caseId/dual-analysis/run', async (req, res) => {
  try {
    const result = await runDualAnalysis(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/dual-analysis', async (req, res) => {
  try {
    const result = await getCaseDualAnalysisResults(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase L: Output Deduplication
// ---------------------------------------------------------------

router.post('/:caseId/output/check-dup', async (req, res) => {
  try {
    const result = await checkOutputDuplicate(req.params.caseId, req.body.outputType, req.body.content);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:caseId/output/register', async (req, res) => {
  try {
    const result = await registerOutput(req.params.caseId, req.body.outputType, req.body.content, req.body.entityId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/output/dedup-stats', async (req, res) => {
  try {
    const result = await getOutputDedupStats(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase M: Fact-Based Task Generation
// ---------------------------------------------------------------

router.post('/:caseId/tasks/generate-from-facts', async (req, res) => {
  try {
    const result = await generateFactBasedTasks(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase N: Fact Audit Trail
// ---------------------------------------------------------------

router.post('/:caseId/fact-audit/log', async (req, res) => {
  try {
    const result = await logFactAuditEvent({ caseId: req.params.caseId, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/fact-audit', async (req, res) => {
  try {
    const result = await getFactAuditTrail(req.params.caseId, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:caseId/fact-audit/summary', async (req, res) => {
  try {
    const result = await getFactAuditSummary(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase O: Fact Neutrality
// ---------------------------------------------------------------

router.post('/:caseId/fact-neutrality/audit', async (req, res) => {
  try {
    const result = await auditFactOutputNeutrality(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Phase P: Fact Performance
// ---------------------------------------------------------------

router.get('/:caseId/fact-performance', async (req, res) => {
  try {
    const result = await getFactPerformanceSummary(req.params.caseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Composite: Full Intelligence Dashboard Data
// ---------------------------------------------------------------

router.get('/:caseId/dashboard', async (req, res) => {
  try {
    const [
      registry, impacts, conflicts, witnesses, admissibility,
      tasks, motions, legalIssues, vfrSummary, performance,
    ] = await Promise.all([
      getCaseEvidence(req.params.caseId).catch(() => []),
      getCaseImpactScores(req.params.caseId).catch(() => []),
      getCaseTimelineConflicts(req.params.caseId).catch(() => []),
      getCaseWitnessReliability(req.params.caseId).catch(() => []),
      getCaseAdmissibilityIssues(req.params.caseId).catch(() => []),
      getCaseTasks(req.params.caseId).catch(() => []),
      getCaseMotionRecommendations(req.params.caseId).catch(() => []),
      getCaseLegalIssues(req.params.caseId).catch(() => []),
      getVFRSummary(req.params.caseId).catch(() => ({})),
      getCasePerformanceSummary(req.params.caseId).catch(() => ({})),
    ]);

    res.json({
      registry: { total: registry.length },
      impacts: { total: impacts.length, byLevel: groupBy(impacts, 'impactLevel') },
      conflicts: { total: conflicts.length },
      witnesses: { total: witnesses.length },
      admissibility: { total: admissibility.length },
      tasks: { total: tasks.length, byStatus: groupBy(tasks, 'status') },
      motions: { total: motions.length },
      legalIssues: { total: legalIssues.length },
      vfr: vfrSummary,
      performance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export default router;
