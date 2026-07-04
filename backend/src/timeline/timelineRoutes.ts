// ============================================================================
// CourtAccess — Timeline Routes (FULL FILE — DEBUG + CASCADE ENABLED)
// ============================================================================

import {
  applyInteractionStrength,
  propagateToElements,
  evaluateBurden,
  buildFailureExplanation,
  applyElementDependencies,
  runLegalCascade,
} from "../logic/legalCascadeEngine";

import {
  analyzeArgumentInteractions,
  injectContradictionAttacks
} from '../services/argumentInteractionEngine';

import {
  buildExplainableArguments,
  buildProsecutionArguments // ✅ FIXED: moved import here
} from '../services/explainableArgumentEngine';

import { extractContradictions } from "../services/contradictionExtractionService";

import type { FastifyInstance, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/authMiddleware';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

import {
  getTimelineEvents,
  getTimelineConflicts,
} from './timelineReconstructionService.js';

import { enqueueTimelineProcessing } from '../workers/pipelineJobService.js';
import { getQueueHealth } from '../lib/queues.js';

import { runLegalAnalysis } from '../services/legalAnalysisEngine';

// ============================================================================
// CONTEXT RESOLVER
// ============================================================================
function resolveContext(request: AuthenticatedRequest) {
  const user = request.user || {};
  return {
    userId: (user as any)?.userId || 'dev-user',
    tenantId: (user as any)?.tenantId || 'dev-tenant'
  };
}

// ============================================================================
// REGISTER ROUTES
// ============================================================================
export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {

  // --------------------------------------------------------------------------
  // GET /api/timeline/:caseId/events — Evidence-governed timeline + legal analysis
  // --------------------------------------------------------------------------
  app.get(
    '/api/timeline/:caseId/events',
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { caseId } = request.params as { caseId: string };

      try {
        const timelineData = await getTimelineEvents(caseId, user.tenantId, { limit: 500 });
        const eventList = timelineData.events.map((ev) => ({
          id: ev.id,
          description: ev.description,
          action: ev.action ?? undefined,
          target: ev.target ?? undefined,
          actor: ev.actor ?? undefined,
          timestamp: ev.timestamp?.toISOString() ?? ev.timeText ?? 'UNKNOWN',
          sourceType: ev.sourceType ?? undefined,
          conflictFlag: ev.conflictFlag,
        }));

        const unknowns: string[] = [];
        if (eventList.length === 0) {
          unknowns.push('No timeline events — run timeline processing after evidence upload.');
        }

        const contradictions = extractContradictions(eventList);

        // --------------------------------------------------
        // BASE LEGAL ANALYSIS
        // --------------------------------------------------
        const baseAnalysis = runLegalAnalysis({
          events: eventList,
          contradictions,
        });

        // --------------------------------------------------
        // ARGUMENTS (DEFENSE + PROSECUTION)
        // --------------------------------------------------
        const defenseArguments = buildExplainableArguments(eventList);
        const prosecutionArguments = buildProsecutionArguments(eventList);

        const argumentsOutput = [
          ...defenseArguments,
          ...prosecutionArguments
        ];

        // --------------------------------------------------
        // INTERACTIONS
        // --------------------------------------------------
        const baseInteractions = analyzeArgumentInteractions(argumentsOutput);

        const contradictionInteractions = injectContradictionAttacks(
          argumentsOutput,
          contradictions
        );

        const interactions = [
          ...baseInteractions,
          ...contradictionInteractions
        ];

        // --------------------------------------------------
        // CASCADE ENGINE (STRICT ORDER)
        // --------------------------------------------------
        const argumentState = applyInteractionStrength(argumentsOutput, interactions);

        const allElements = (baseAnalysis.charges || [])
          .flatMap((c: any) => c.elements || []);

        const baseElements = propagateToElements(argumentState, allElements);

        const updatedElements = applyElementDependencies(baseElements);

        const burden = evaluateBurden(updatedElements);

        const explanation = buildFailureExplanation(argumentState, updatedElements);

        // --------------------------------------------------
        // REBUILD CHARGES
        // --------------------------------------------------
        const updatedCharges = (baseAnalysis.charges || []).map((charge: any) => ({
          ...charge,
          elements: updatedElements.filter((el: any) =>
            (charge.elements || []).some((orig: any) => orig.id === el.id)
          )
        }));

        const analysis = {
          ...baseAnalysis,
          charges: updatedCharges,
          burdenOfProof: burden
        };

        // --------------------------------------------------
        // 🧠 RUN LEGAL CASCADE ENGINE (FINAL INTEGRATION)
        // --------------------------------------------------
        let cascadeResult: any = {};

        try {
          const primaryCharge = updatedCharges?.[0] || {};

          cascadeResult = runLegalCascade({
            argumentsList: Array.from(argumentState?.values?.() || []),
            interactions: interactions || [],
            elements: primaryCharge?.elements || [],
            contradictions: primaryCharge?.contradictions || []
          });

        } catch (err) {
          console.error("⚠️ Cascade engine failed:", err);
          cascadeResult = {
            verdict: "NOT PROVEN",
            keyFailure: null,
            explanation: ["Cascade engine error"],
            failureRankings: [],
            defenseArgument: "",
            juryNarrative: "",
            crossExamination: [],
            impeachment: []
          };
        }

        // --------------------------------------------------
        // RESPONSE (ENHANCED)
        // --------------------------------------------------
        return {
          events: eventList,
          total: timelineData.total,
          unknowns,
          analysis,
          arguments: Array.from(argumentState?.values?.() || []),
          argumentInteractions: interactions,
          explanation,

          verdict: cascadeResult?.verdict,
          burdenMet: cascadeResult?.burdenMet,
          keyFailure: cascadeResult?.keyFailure,
          failureRankings: cascadeResult?.failureRankings,
          defenseArgument: cascadeResult?.defenseArgument,
          juryNarrative: cascadeResult?.juryNarrative,
          crossExamination: cascadeResult?.crossExamination,
          impeachment: cascadeResult?.impeachment
        };

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: msg });
      }
    }  // ← THIS CLOSES async handler
  );   // ← THIS CLOSES app.get(...)

  // --------------------------------------------------------------------------
  // GET /conflicts
  // --------------------------------------------------------------------------
  app.get(
    '/api/timeline/:caseId/conflicts',
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest) => {
      const { tenantId } = resolveContext(request);
      const { caseId } = request.params as any;
      return await getTimelineConflicts(caseId, tenantId);
    }
  );

  // --------------------------------------------------------------------------
  // POST /rebuild
  // --------------------------------------------------------------------------
  app.post(
    '/api/timeline/rebuild/:caseId',
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest) => {
      const { userId, tenantId } = resolveContext(request);
      const { caseId } = request.params as any;

      return await enqueueTimelineProcessing({
        userId,
        tenantId,
        caseId
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /process
  // --------------------------------------------------------------------------
  app.post(
    '/api/timeline/process',
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {

      const { userId, tenantId } = resolveContext(request);
      const body = request.body as any;

      if (!body?.caseId) {
        return reply.code(400).send({ error: 'Missing caseId' });
      }

      return await enqueueTimelineProcessing({
        userId,
        tenantId,
        caseId: body.caseId
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /health
  // --------------------------------------------------------------------------
  app.get('/api/timeline/health', async () => {
    const queueHealth = await getQueueHealth();
    return {
      status: 'ok',
      queue: queueHealth
    };
  });

  console.log('[Server] Timeline routes registered');
}
