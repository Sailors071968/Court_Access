// ============================================================================
// CourtAccess — Timeline Routes (FULL FILE — DEBUG + CASCADE ENABLED)
// ============================================================================

import {
  applyInteractionStrength,
  propagateToElements,
  evaluateBurden,
  buildFailureExplanation,
  applyElementDependencies,
  runLegalCascade
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
  // GET /events (DEBUG MODE - AUTH DISABLED)
  // --------------------------------------------------------------------------
  app.get(
    '/api/timeline/:caseId/events',
    {}, // 🔥 TEMP disable auth
    async (_request: AuthenticatedRequest, reply: FastifyReply) => {

      console.log("🚀 EVENTS ROUTE HIT (DEBUG)");

      try {
        // --------------------------------------------------
        // TEST EVENTS
        // --------------------------------------------------
        const eventList = [
          {
            description: "Defendant entered the house",
            action: "enter",
            target: "house"
          },
          {
            description: "Defendant was not present at the house",
            action: "deny",
            target: "presence"
          }
        ];

        // --------------------------------------------------
        // CONTRADICTIONS
        // --------------------------------------------------
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

  console.log('🔥 Timeline routes loaded (DEBUG MODE ACTIVE)');
}
