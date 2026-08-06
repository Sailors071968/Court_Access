// ============================================================================
// Phases 129-150 — Policy Compliance Analysis Engine Routes
// Registers all API endpoints for the compliance analysis system.
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
// Case-scoped compliance output is privileged work product. Every handler that
// takes a caseId must confirm the caller may read that case before touching it.
import { guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { extractEventsForCase, getCaseEvents, getCaseEventStats } from './eventExtractionService.js';
import { analyzeVideoEvidence, getVideoAnalysisSummary } from './videoActionDetectionService.js';
import { runSpeechAnalysis } from './speechAnalysisService.js';
import { buildOfficerTimeline, formatTimelineText } from './officerActionTimelineService.js';
import { extractRulesFromPolicy, storeRules, getAgencyRules, generateActionMappings, getRelevantRules } from './policyRuleEngine.js';
import {
  analyzeCompliance,
  getCaseFindings,
  getAgencyFindings,
  getPendingReviews,
  updateReviewStatus,
  getReviewStats,
  applySafetyGuardrails,
} from './policyComplianceAnalyzer.js';
import {
  getComplianceDashboardData,
  getInconsistencyHeatmap,
  generateComplianceReport,
  generateTrialExhibits,
  comparePolicies,
  getStoredComparisons,
  analyzeTrainingAlignment,
  getPolicyEvolutionHistory,
  detectPolicyChanges,
  logAuditStep,
  getCaseAuditTrail,
  generateExpertWitnessPackage,
  generateJuryVisualizations,
} from './complianceDashboardService.js';

export async function registerComplianceRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // Phase 129 — Evidence Event Extraction
  // =========================================================================

  // POST /api/compliance/events/extract — extract events from evidence
  app.post(
    '/api/compliance/events/extract',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sources: Array<{ content: string; sourceId: string; sourceType: string }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sources } = request.body;
        const result = await extractEventsForCase(
          caseId,
          sources.map(s => ({
            ...s,
            sourceType: s.sourceType as 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report',
          })),
        );
        await logAuditStep(caseId, 'event_extraction', `Extracted ${result.eventsExtracted} events`, { sourceCount: sources.length }, { eventsExtracted: result.eventsExtracted }, result.durationMs);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/events/:caseId — get events for a case
  app.get(
    '/api/compliance/events/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const events = await getCaseEvents(request.params.caseId);
        return reply.send({ success: true, data: events });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/events/:caseId/stats — event statistics
  app.get(
    '/api/compliance/events/:caseId/stats',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const stats = await getCaseEventStats(request.params.caseId);
        return reply.send({ success: true, data: stats });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 130 — Video Analysis
  // =========================================================================

  // POST /api/compliance/video/analyze — analyze video evidence
  app.post(
    '/api/compliance/video/analyze',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sourceId: string;
          durationSeconds: number;
          description?: string;
          transcript?: string;
          frameAnnotations?: Array<{ timestamp: string; annotation: string }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sourceId, ...metadata } = request.body;
        const result = await analyzeVideoEvidence(caseId, sourceId, metadata);
        await logAuditStep(caseId, 'action_detection', `Video analysis: ${result.detectedActions.length} actions detected`, { sourceId }, { actionsDetected: result.detectedActions.length }, result.durationMs);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/video/:caseId/summary — video analysis summary
  app.get(
    '/api/compliance/video/:caseId/summary',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const summary = await getVideoAnalysisSummary(request.params.caseId);
        return reply.send({ success: true, data: summary });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 131 — Speech Analysis
  // =========================================================================

  // POST /api/compliance/speech/analyze — analyze audio/speech
  app.post(
    '/api/compliance/speech/analyze',
    async (
      request: FastifyRequest<{
        Body: { caseId: string; sourceId: string; transcript: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sourceId, transcript } = request.body;
        const result = await runSpeechAnalysis(caseId, sourceId, transcript);
        await logAuditStep(caseId, 'event_extraction', `Speech analysis: ${result.speechEvents.length} events, Miranda: ${result.mirandaDetected}`, { sourceId }, { speechEvents: result.speechEvents.length }, result.durationMs);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 132 — Officer Action Timeline
  // =========================================================================

  // GET /api/compliance/timeline/:caseId — build officer action timeline
  app.get(
    '/api/compliance/timeline/:caseId',
    async (
      request: FastifyRequest<{
        Params: { caseId: string };
        Querystring: { format?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const timeline = await buildOfficerTimeline(request.params.caseId);
        if (request.query.format === 'text') {
          const text = formatTimelineText(timeline);
          return reply.header('Content-Type', 'text/plain').send(text);
        }
        return reply.send({ success: true, data: timeline });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 133 — Policy Rule Engine
  // =========================================================================

  // POST /api/compliance/rules/extract — extract rules from policy text
  app.post(
    '/api/compliance/rules/extract',
    async (
      request: FastifyRequest<{
        Body: { policyText: string; policyId: string; agencyId: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { policyText, policyId, agencyId } = request.body;
        const rules = extractRulesFromPolicy(policyText, policyId, agencyId);
        const stored = await storeRules(rules);
        return reply.send({ success: true, data: { rulesExtracted: rules.length, rulesStored: stored } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/rules/:agencyId — get rules for an agency
  app.get(
    '/api/compliance/rules/:agencyId',
    async (
      request: FastifyRequest<{
        Params: { agencyId: string };
        Querystring: { category?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const rules = await getAgencyRules(request.params.agencyId, request.query.category);
        return reply.send({ success: true, data: rules });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 134 — Policy Action Mapping
  // =========================================================================

  // POST /api/compliance/mappings/generate — generate action mappings for agency
  app.post(
    '/api/compliance/mappings/generate',
    async (
      request: FastifyRequest<{ Body: { agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const count = await generateActionMappings(request.body.agencyId);
        return reply.send({ success: true, data: { mappingsCreated: count } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/mappings/:eventType/:agencyId — get relevant rules for an event
  app.get(
    '/api/compliance/mappings/:eventType/:agencyId',
    async (
      request: FastifyRequest<{ Params: { eventType: string; agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const rules = await getRelevantRules(request.params.eventType, request.params.agencyId);
        return reply.send({ success: true, data: rules });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 135 — Compliance Analysis
  // =========================================================================

  // POST /api/compliance/analyze — run compliance analysis for a case
  app.post(
    '/api/compliance/analyze',
    async (
      request: FastifyRequest<{ Body: { caseId: string; agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, agencyId } = request.body;
        await logAuditStep(caseId, 'compliance_analysis', 'Starting compliance analysis', { agencyId });
        const result = await analyzeCompliance(caseId, agencyId);
        await logAuditStep(caseId, 'compliance_analysis', `Analysis complete: ${result.totalFindings} findings`, undefined, { totalFindings: result.totalFindings }, result.durationMs);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/findings/:caseId — get findings for a case
  app.get(
    '/api/compliance/findings/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const findings = await getCaseFindings(request.params.caseId);
        return reply.send({ success: true, data: findings });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/findings/agency/:agencyId — get agency findings
  app.get(
    '/api/compliance/findings/agency/:agencyId',
    async (request: FastifyRequest<{ Params: { agencyId: string } }>, reply: FastifyReply) => {
      try {
        const findings = await getAgencyFindings(request.params.agencyId);
        return reply.send({ success: true, data: findings });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 137 — Review Queue
  // =========================================================================

  // GET /api/compliance/reviews — get pending reviews
  app.get(
    '/api/compliance/reviews',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
        const reviews = await getPendingReviews(limit);
        return reply.send({ success: true, data: reviews });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // PUT /api/compliance/reviews/:reviewId — update review status
  app.put(
    '/api/compliance/reviews/:reviewId',
    async (
      request: FastifyRequest<{
        Params: { reviewId: string };
        Body: {
          status: string;
          reviewerId: string;
          notes?: string;
          approvedForReport?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { status, reviewerId, notes, approvedForReport } = request.body;
        const updated = await updateReviewStatus(
          request.params.reviewId,
          status,
          reviewerId,
          notes,
          approvedForReport,
        );
        return reply.send({ success: true, data: updated });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/reviews/stats — review statistics
  app.get(
    '/api/compliance/reviews/stats',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getReviewStats();
        return reply.send({ success: true, data: stats });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 138 — Compliance Dashboard
  // =========================================================================

  // GET /api/compliance/dashboard — main compliance dashboard data
  app.get(
    '/api/compliance/dashboard',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await getComplianceDashboardData();
        return reply.send({ success: true, data });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 139 — Inconsistency Heatmap
  // =========================================================================

  // GET /api/compliance/heatmap — agency inconsistency heatmap
  app.get(
    '/api/compliance/heatmap',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const heatmap = await getInconsistencyHeatmap();
        return reply.send({ success: true, data: heatmap });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 140 — Compliance Report
  // =========================================================================

  // POST /api/compliance/report/:caseId — generate compliance report
  app.post(
    '/api/compliance/report/:caseId',
    async (
      request: FastifyRequest<{
        Params: { caseId: string };
        Body: { caseName?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const report = await generateComplianceReport(request.params.caseId, request.body?.caseName);
        await logAuditStep(request.params.caseId, 'report_generation', `Report generated with ${report.findings.length} findings`);
        return reply.send({ success: true, data: report });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 141 — Trial Exhibits
  // =========================================================================

  // GET /api/compliance/exhibits/:caseId — generate trial exhibit packages
  app.get(
    '/api/compliance/exhibits/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const exhibits = await generateTrialExhibits(request.params.caseId);
        return reply.send({ success: true, data: exhibits });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 142 — Cross-Agency Comparison
  // =========================================================================

  // POST /api/compliance/compare — compare policies between agencies
  app.post(
    '/api/compliance/compare',
    async (
      request: FastifyRequest<{
        Body: { agencyAId: string; agencyBId: string; topic: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agencyAId, agencyBId, topic } = request.body;
        const result = await comparePolicies(agencyAId, agencyBId, topic);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // GET /api/compliance/comparisons — get stored comparisons
  app.get(
    '/api/compliance/comparisons',
    async (
      request: FastifyRequest<{ Querystring: { topic?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const comparisons = await getStoredComparisons(request.query.topic);
        return reply.send({ success: true, data: comparisons });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 143 — Training Standard Analysis
  // =========================================================================

  // POST /api/compliance/training/analyze — analyze training alignment
  app.post(
    '/api/compliance/training/analyze',
    async (
      request: FastifyRequest<{ Body: { caseId: string; agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, agencyId } = request.body;
        const result = await analyzeTrainingAlignment(caseId, agencyId);
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 144 — Policy Evolution
  // =========================================================================

  // GET /api/compliance/evolution/:agencyId — policy evolution history
  app.get(
    '/api/compliance/evolution/:agencyId',
    async (
      request: FastifyRequest<{
        Params: { agencyId: string };
        Querystring: { topic?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const history = await getPolicyEvolutionHistory(request.params.agencyId, request.query.topic);
        return reply.send({ success: true, data: history });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // POST /api/compliance/evolution/:agencyId/detect — detect policy changes
  app.post(
    '/api/compliance/evolution/:agencyId/detect',
    async (request: FastifyRequest<{ Params: { agencyId: string } }>, reply: FastifyReply) => {
      try {
        const changes = await detectPolicyChanges(request.params.agencyId);
        return reply.send({ success: true, data: { changesDetected: changes } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 147 — Audit Trail
  // =========================================================================

  // GET /api/compliance/audit/:caseId — get case audit trail
  app.get(
    '/api/compliance/audit/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const trail = await getCaseAuditTrail(request.params.caseId);
        return reply.send({ success: true, data: trail });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 148 — Expert Witness Mode
  // =========================================================================

  // GET /api/compliance/expert/:caseId — generate expert witness package
  app.get(
    '/api/compliance/expert/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const pkg = await generateExpertWitnessPackage(request.params.caseId);
        return reply.send({ success: true, data: pkg });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 149 — Jury Visualization
  // =========================================================================

  // GET /api/compliance/jury/:caseId — generate jury-ready visualizations
  app.get(
    '/api/compliance/jury/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;
      if (!user) return reply.code(401).send({ success: false, error: 'Authentication required' });
      if (!(await guardCaseAccess(user, request.params.caseId, 'view', reply))) return;

      try {
        const viz = await generateJuryVisualizations(request.params.caseId);
        return reply.send({ success: true, data: viz });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 150 — Safety Guardrails (utility endpoint)
  // =========================================================================

  // POST /api/compliance/safety/check — check text against safety guardrails
  app.post(
    '/api/compliance/safety/check',
    async (
      request: FastifyRequest<{ Body: { text: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const safe = applySafetyGuardrails(request.body.text);
        const modified = safe !== request.body.text;
        return reply.send({ success: true, data: { original: request.body.text, safe, modified } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  console.log('[Phases 129-150] Policy Compliance Analysis Engine routes registered');
}
