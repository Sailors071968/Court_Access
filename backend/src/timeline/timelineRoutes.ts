// ============================================================================
// CourtAccess — Timeline Routes (FULL FILE — DEBUG + CASCADE ENABLED)
// ============================================================================

import {
  applyInteractionStrength,
  propagateToElements,
  evaluateBurden,
  buildFailureExplanation,
  applyElementDependencies
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
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';

import {
  getTimelineEvents,
  getTimelineConflicts,
} from './timelineReconstructionService.js';

import { enqueueTimelineProcessing } from '../workers/pipelineJobService.js';
import { getQueueHealth } from '../lib/queues.js';

import { runLegalAnalysis } from '../services/legalAnalysisEngine';
// Was called without being imported, so every request threw a ReferenceError
// that the surrounding try/catch turned into the "Cascade engine error"
// fallback — the verdict, jury narrative, cross-examination and impeachment
// output were never produced by the engine.
import { runLegalCascade } from '../logic/legalCascadeEngine.js';

// ============================================================================
// CONTEXT RESOLVER
// ============================================================================
/**
 * Identify the caller. There is no fallback: a placeholder identity would
 * attribute jobs and timeline rows to a user and tenant that do not exist,
 * which both breaks credit accounting and writes case data outside the
 * tenant it belongs to.
 */
function resolveContext(request: AuthenticatedRequest): { userId: string; tenantId: string } | null {
  const user = request.user;
  if (!user?.userId || !user?.tenantId) return null;
  return { userId: user.userId, tenantId: user.tenantId };
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
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const ctx = resolveContext(request);
      if (!ctx) return reply.code(401).send({ error: 'Authentication required' });

      const { caseId } = request.params as { caseId: string };

      try {
        // The case must belong to the caller's tenant before anything is read.
        const owningCase = await prisma.criminalCase.findFirst({
          where: { caseId, tenantId: ctx.tenantId, deletedAt: null },
          select: { caseId: true },
        });
        if (!owningCase) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        // Real events for this case only. Analysis output is only meaningful
        // if it is derived from the case's own evidence, so an empty timeline
        // is reported as empty rather than filled with sample data.
        const stored = await getTimelineEvents(caseId, ctx.tenantId, { limit: 500 });
        const eventList = (stored.events ?? []).map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          description: e.description,
          action: e.action,
          object: e.object,
          target: e.target,
          actor: e.actor,
          sourceDoc: e.sourceDoc,
          sourceType: e.sourceType,
          confidence: e.confidence,
          conflictFlag: e.conflictFlag,
        }));

        if (eventList.length === 0) {
          return {
            caseId,
            events: [],
            total: 0,
            analysis: null,
            arguments: [],
            argumentInteractions: [],
            explanation: null,
            message:
              'No timeline events have been extracted for this case yet. ' +
              'Upload discovery documents and run a timeline rebuild to populate the chronology.',
          };
        }

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
          caseId,
          total: stored.total ?? eventList.length,
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
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const ctx = resolveContext(request);
      if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
      const { caseId } = request.params as { caseId: string };
      return await getTimelineConflicts(caseId, ctx.tenantId);
    }
  );

  // --------------------------------------------------------------------------
  // POST /rebuild
  // --------------------------------------------------------------------------
  app.post(
    '/api/timeline/rebuild/:caseId',
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const ctx = resolveContext(request);
      if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
      const { caseId } = request.params as { caseId: string };

      const owningCase = await prisma.criminalCase.findFirst({
        where: { caseId, tenantId: ctx.tenantId, deletedAt: null },
        select: { caseId: true },
      });
      if (!owningCase) return reply.code(403).send({ error: 'Forbidden' });

      return await enqueueTimelineProcessing({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        caseId,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /process
  // --------------------------------------------------------------------------
  app.post(
    '/api/timeline/process',
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const ctx = resolveContext(request);
      if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
      const { userId, tenantId } = ctx;
      const body = request.body as { caseId?: string } | undefined;

      if (!body?.caseId) {
        return reply.code(400).send({ error: 'Missing caseId' });
      }

      const owningCase = await prisma.criminalCase.findFirst({
        where: { caseId: body.caseId, tenantId, deletedAt: null },
        select: { caseId: true },
      });
      if (!owningCase) return reply.code(403).send({ error: 'Forbidden' });

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
