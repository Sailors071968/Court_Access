// ============================================================================
// Contradiction Detection Engine — API Routes
// REST endpoints for event extraction, timeline building, contradiction
// analysis, doctrine matching, litigation intelligence, and graph queries.
// ============================================================================

import { extractEvents } from './eventExtractionEngine.ts';
import { buildUnifiedTimeline, findTimelineGaps } from './timelineEngine.ts';
import { processVideo, detectBodycamGaps } from './videoIntelligencePipeline.ts';
import { analyzeContradictions } from './contradictionDetectionEngine.ts';
import { matchAllContradictions, assessCaseSeverity } from './doctrineMatchingEngine.ts';
import { generateRecommendations, generateLitigationSummary } from './litigationIntelligence.ts';
import { buildContradictionGraph, generateCypherStatements } from './graphIntelligenceLayer.ts';
import { getOntologyStats, getEventTypesByCategory, getEventType } from './eventOntology.ts';
import type { ExtractionJobData, ExtractedEvent, VideoProcessingStage, VideoProcessingJob } from './types.ts';

// ---------------------------------------------------------------------------
// Minimal Fastify-compatible type stubs
// ---------------------------------------------------------------------------

interface FastifyRequest {
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  body: unknown;
}

interface FastifyReply {
  code(statusCode: number): FastifyReply;
  send(payload: unknown): FastifyReply;
}

interface FastifyInstance {
  get(url: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>): void;
  post(url: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>): void;
}

// ---------------------------------------------------------------------------
// In-memory stores (production would use database)
// ---------------------------------------------------------------------------

const extractedEventsStore = new Map<string, ExtractedEvent[]>();

function getEventsForCase(caseId: string): ExtractedEvent[] {
  return extractedEventsStore.get(caseId) ?? [];
}

function addEventsForCase(caseId: string, events: ExtractedEvent[]): void {
  const existing = extractedEventsStore.get(caseId) ?? [];
  extractedEventsStore.set(caseId, [...existing, ...events]);
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export function registerContradictionRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // GET /api/contradiction/status — CDE system status
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/status', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const ontologyStats = getOntologyStats();
    const totalCases = extractedEventsStore.size;
    let totalEvents = 0;
    for (const events of extractedEventsStore.values()) {
      totalEvents += events.length;
    }

    return {
      status: 'operational',
      engine: 'Contradiction Detection Engine v1.0',
      phases: {
        eventOntology: 'active',
        eventExtraction: 'active',
        timelineEngine: 'active',
        videoIntelligence: 'active',
        contradictionDetection: 'active',
        doctrineMatching: 'active',
        litigationIntelligence: 'active',
        graphIntelligence: 'active',
      },
      ontologyStats,
      totalCases,
      totalEvents,
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/ontology — event type ontology stats
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/ontology', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return getOntologyStats();
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/ontology/:category — events by category
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/ontology/:category', async (req: FastifyRequest, reply: FastifyReply) => {
    const { category } = req.params;
    const events = getEventTypesByCategory(category as never);

    if (events.length === 0) {
      return reply.code(404).send({ error: `No event types found for category: ${category}` });
    }

    return { category, count: events.length, eventTypes: events };
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/ontology/event/:eventTypeId — single event type
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/ontology/event/:eventTypeId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { eventTypeId } = req.params;
    const eventDef = getEventType(eventTypeId);

    if (!eventDef) {
      return reply.code(404).send({ error: `Event type not found: ${eventTypeId}` });
    }

    return { eventType: eventDef };
  });

  // -----------------------------------------------------------------------
  // POST /api/contradiction/extract — extract events from evidence
  // -----------------------------------------------------------------------
  app.post('/api/contradiction/extract', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<ExtractionJobData> | null;

    if (!body?.caseId || !body?.evidenceId || !body?.evidenceType || !body?.content) {
      return reply.code(400).send({
        error: 'Missing required fields: caseId, evidenceId, evidenceType, content',
      });
    }

    const job: ExtractionJobData = {
      caseId: body.caseId,
      evidenceId: body.evidenceId,
      evidenceType: body.evidenceType,
      content: body.content,
    };

    const result = extractEvents(job);
    addEventsForCase(job.caseId, result.events);

    return {
      success: true,
      ...result,
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/events/:caseId — get extracted events for a case
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/events/:caseId', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    return {
      caseId,
      totalEvents: events.length,
      events,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/contradiction/timeline/:caseId — build unified timeline
  // -----------------------------------------------------------------------
  app.post('/api/contradiction/timeline/:caseId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    if (events.length === 0) {
      return reply.code(404).send({ error: `No events found for case: ${caseId}. Extract events first.` });
    }

    const timeline = buildUnifiedTimeline(caseId, events);
    const gaps = findTimelineGaps(timeline.timeline);

    return {
      ...timeline,
      gaps,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/contradiction/video/process — process video through pipeline
  // -----------------------------------------------------------------------
  app.post('/api/contradiction/video/process', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      caseId?: string;
      videoId?: string;
      videoUrl?: string;
      videoType?: 'bodycam' | 'dashcam' | 'surveillance' | 'other';
      stages?: VideoProcessingStage[];
      ocrText?: string;
      transcript?: string;
      frameIntervalSec?: number;
    } | null;

    if (!body?.caseId || !body?.videoId) {
      return reply.code(400).send({
        error: 'Missing required fields: caseId, videoId',
      });
    }

    const job: VideoProcessingJob = {
      caseId: body.caseId,
      videoId: body.videoId,
      videoUrl: body.videoUrl ?? '',
      videoType: body.videoType ?? 'other',
      stages: body.stages ?? ['frame_extraction', 'overlay_ocr', 'action_detection', 'event_generation'] as VideoProcessingStage[],
      frameIntervalSec: body.frameIntervalSec ?? 0.5,
    };

    const { result, overlays, actions, events } = processVideo(
      job,
      body.ocrText ?? '',
      body.transcript ?? '',
    );

    // Store generated events
    if (events.length > 0) {
      addEventsForCase(body.caseId, events);
    }

    return {
      success: true,
      result,
      overlaysDetected: overlays.length,
      actionsDetected: actions.length,
      eventsGenerated: events.length,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/contradiction/video/bodycam-gaps — detect bodycam gaps
  // -----------------------------------------------------------------------
  app.post('/api/contradiction/video/bodycam-gaps', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      overlays?: Array<{ overlayTimestamp?: string | null }>;
      expectedStartTime?: string;
      expectedEndTime?: string;
    } | null;

    if (!body?.expectedStartTime || !body?.expectedEndTime) {
      return reply.code(400).send({
        error: 'Missing required fields: expectedStartTime, expectedEndTime',
      });
    }

    const gaps = detectBodycamGaps(
      (body.overlays ?? []) as never,
      body.expectedStartTime,
      body.expectedEndTime,
    );

    return { gaps, totalGaps: gaps.length };
  });

  // -----------------------------------------------------------------------
  // POST /api/contradiction/analyze/:caseId — run full contradiction analysis
  // -----------------------------------------------------------------------
  app.post('/api/contradiction/analyze/:caseId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    if (events.length === 0) {
      return reply.code(404).send({ error: `No events found for case: ${caseId}. Extract events first.` });
    }

    // Step 1: Build timeline
    const timeline = buildUnifiedTimeline(caseId, events);

    // Step 2: Detect contradictions
    const analysis = analyzeContradictions(caseId, events, timeline.timeline);

    // Step 3: Match to doctrine
    const eventMap = new Map<string, string>();
    for (const ev of events) {
      eventMap.set(ev.eventId, ev.eventType);
    }
    const doctrineResults = matchAllContradictions(analysis.contradictions, eventMap);
    const caseSeverity = assessCaseSeverity(doctrineResults);

    // Step 4: Generate litigation recommendations
    const recommendations = generateRecommendations(caseId, analysis.contradictions, doctrineResults);
    const litigationSummary = generateLitigationSummary(caseId, recommendations);

    // Step 5: Build graph
    const graph = buildContradictionGraph(caseId, events, analysis.contradictions);

    return {
      caseId,
      analysis,
      timeline: {
        totalEvents: timeline.totalEvents,
        mergedEvents: timeline.mergedEvents,
        clockDriftDetected: timeline.clockDriftDetected,
        driftCorrections: timeline.driftCorrections,
        gaps: findTimelineGaps(timeline.timeline),
      },
      doctrineMatching: {
        totalMatches: doctrineResults.reduce((sum, r) => sum + r.doctrineMatches.length, 0),
        caseSeverity,
        results: doctrineResults,
      },
      litigationSummary,
      graph: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        contradictionClusters: graph.contradictionClusters.length,
      },
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/graph/:caseId — get contradiction graph
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/graph/:caseId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    if (events.length === 0) {
      return reply.code(404).send({ error: `No events found for case: ${caseId}.` });
    }

    const analysis = analyzeContradictions(caseId, events, []);
    const graph = buildContradictionGraph(caseId, events, analysis.contradictions);

    return graph;
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/graph/:caseId/cypher — get Cypher statements
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/graph/:caseId/cypher', async (req: FastifyRequest, reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    if (events.length === 0) {
      return reply.code(404).send({ error: `No events found for case: ${caseId}.` });
    }

    const analysis = analyzeContradictions(caseId, events, []);
    const graph = buildContradictionGraph(caseId, events, analysis.contradictions);
    const cypher = generateCypherStatements(graph);

    return { caseId, statementCount: cypher.length, statements: cypher };
  });

  // -----------------------------------------------------------------------
  // GET /api/contradiction/recommendations/:caseId — get recommendations
  // -----------------------------------------------------------------------
  app.get('/api/contradiction/recommendations/:caseId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { caseId } = req.params;
    const events = getEventsForCase(caseId);

    // Empty case: return a valid, empty litigation summary (200) rather than a
    // 404, so the workspace renders an honest empty state instead of erroring.
    if (events.length === 0) {
      return reply.send(generateLitigationSummary(caseId, []));
    }

    const timeline = buildUnifiedTimeline(caseId, events);
    const analysis = analyzeContradictions(caseId, events, timeline.timeline);

    const eventMap = new Map<string, string>();
    for (const ev of events) {
      eventMap.set(ev.eventId, ev.eventType);
    }
    const doctrineResults = matchAllContradictions(analysis.contradictions, eventMap);
    const recommendations = generateRecommendations(caseId, analysis.contradictions, doctrineResults);
    const summary = generateLitigationSummary(caseId, recommendations);

    return summary;
  });
}
