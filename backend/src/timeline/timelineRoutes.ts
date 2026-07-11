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
import { authMiddleware } from '../middleware/authMiddleware';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

import {
  getTimelineEvents,
  getTimelineConflicts,
} from './timelineReconstructionService.js';
import prisma from '../lib/prisma.js';

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

// Map a raw TimelineEvent row → the ApiTimelineEvent shape the frontend expects.
function toApiEvent(e: any) {
  const meta = (e?.metadata ?? {}) as Record<string, unknown>;
  return {
    eventId: e.id,
    eventType: (typeof meta.eventType === 'string' && meta.eventType) || e.sourceType || 'event',
    canonicalTimestamp: e.timestamp ? new Date(e.timestamp).toISOString() : '',
    timestampSource: e.sourceType || (e.timestamp ? 'repository' : 'UNKNOWN'),
    confidence: typeof e.confidence === 'number' ? e.confidence : 0,
    actor: e.actor ?? undefined,
    action: e.action ?? undefined,
    target: e.target ?? undefined,
    location: e.location ?? undefined,
    description: e.description ?? '',
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
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const { tenantId } = resolveContext(request);
      const { caseId } = request.params as { caseId: string };

      try {
        // Real, DB-backed timeline events for this case — no fabricated data.
        // (Previously returned hardcoded test events with auth disabled and ran
        // a broken legal-cascade on them.) A raw events endpoint returns events
        // + conflicts; legal analysis lives in the intelligence/workbench APIs.
        const eventList = await getTimelineEvents(caseId, tenantId);
        const conflictResult = await getTimelineConflicts(caseId, tenantId);
        const events = (eventList.events ?? []).map(toApiEvent);
        return reply.send({
          caseId,
          totalEvents: events.length,
          events,
          conflicts: (conflictResult.conflicts ?? []).map((c: any) => ({
            conflictId: c.id,
            type: 'chronology_conflict',
            description: c.description,
            eventIds: c.conflictsWith ? [c.id, c.conflictsWith] : [c.id],
            severity: 'medium',
          })),
        });

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
          crimeType: 'burglary'
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
  // POST /events — attorney-entered ("Custom Event"). Real user data, never
  // fabricated; time may be UNKNOWN (null) rather than invented.
  // --------------------------------------------------------------------------
  app.post(
    '/api/timeline/:caseId/events',
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const { tenantId } = resolveContext(request);
      const { caseId } = request.params as { caseId: string };
      const body = (request.body ?? {}) as {
        description?: string; timestamp?: string; eventType?: string;
        actor?: string; location?: string; sourceDoc?: string;
      };
      if (!body.description || !body.description.trim()) {
        return reply.code(400).send({ error: 'Event description is required' });
      }
      let ts: Date | null = null;
      if (body.timestamp) {
        const d = new Date(body.timestamp);
        if (!Number.isNaN(d.getTime())) ts = d;
      }
      try {
        const created = await prisma.timelineEvent.create({
          data: {
            caseId,
            tenantId,
            description: body.description.trim(),
            timestamp: ts,
            actor: body.actor?.trim() || null,
            action: body.eventType?.trim() || null,
            location: body.location?.trim() || null,
            sourceDoc: body.sourceDoc?.trim() || null,
            sourceType: 'attorney_entry',
            confidence: 1.0,
            metadata: { eventType: body.eventType?.trim() || 'custom', manual: true },
          },
        });
        return reply.code(201).send({ event: toApiEvent(created) });
      } catch (err) {
        request.log?.error?.(err);
        return reply.code(500).send({ error: 'Failed to create timeline event' });
      }
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
