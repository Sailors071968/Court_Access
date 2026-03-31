// ============================================================================
// Phase B — Video Intelligence API Routes
// Exposes video analysis results: pipeline status, segments, transcripts,
// frames, overlays, detected actions, and unified timeline.
// All endpoints enforce tenant isolation via JWT auth.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerVideoIntelligenceRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/video/:evidenceId/status — Pipeline status + progress
  app.get('/api/video/:evidenceId/status', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const run = await prisma.videoPipelineRun.findFirst({
      where: { evidenceId, tenantId: user.tenantId },
    });

    if (!run) {
      return reply.code(404).send({ error: 'No pipeline run found for this evidence' });
    }

    return {
      pipelineRun: {
        id: run.id,
        evidenceId: run.evidenceId,
        status: run.status,
        currentStage: run.currentStage,
        progress: run.progress,
        stages: {
          probe: run.stageProbe,
          segment: run.stageSegment,
          frames: run.stageFrames,
          ocr: run.stageOcr,
          transcribe: run.stageTranscribe,
          actions: run.stageActions,
          events: run.stageEvents,
        },
        probe: run.durationSec != null ? {
          durationSec: run.durationSec,
          codec: run.codec,
          resolution: run.resolution,
          fps: run.fps,
          fileSizeBytes: run.fileSizeBytes?.toString() ?? null,
        } : null,
        summary: {
          segmentCount: run.segmentCount,
          frameCount: run.frameCount,
          overlayCount: run.overlayCount,
          transcriptWords: run.transcriptWords,
          actionCount: run.actionCount,
          eventCount: run.eventCount,
        },
        error: run.error,
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
      },
    };
  });

  // GET /api/video/:evidenceId/segments — Video segments (30s chunks)
  app.get('/api/video/:evidenceId/segments', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const segments = await prisma.videoSegment.findMany({
      where: { evidenceId, tenantId: user.tenantId },
      orderBy: { segmentIndex: 'asc' },
    });

    return {
      evidenceId,
      count: segments.length,
      segments: segments.map((s) => ({
        id: s.id,
        segmentIndex: s.segmentIndex,
        startTimeSec: s.startTimeSec,
        endTimeSec: s.endTimeSec,
        durationSec: s.durationSec,
        s3Key: s.s3Key,
        fileSize: s.fileSize.toString(),
        status: s.status,
      })),
    };
  });

  // GET /api/video/:evidenceId/transcript — Full transcript + word timestamps
  app.get('/api/video/:evidenceId/transcript', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const transcript = await prisma.videoTranscript.findFirst({
      where: { evidenceId, tenantId: user.tenantId, segmentIndex: null },
    });

    if (!transcript) {
      return reply.code(404).send({ error: 'No transcript found for this evidence' });
    }

    return {
      evidenceId,
      transcript: {
        id: transcript.id,
        language: transcript.language,
        text: transcript.text,
        wordCount: transcript.wordCount,
        durationSec: transcript.durationSec,
        confidence: transcript.confidence,
        provider: transcript.provider,
        words: transcript.words,
        status: transcript.status,
      },
    };
  });

  // GET /api/video/:evidenceId/frames — Extracted key frames
  app.get('/api/video/:evidenceId/frames', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };
    const query = request.query as { limit?: string; offset?: string; keyOnly?: string };
    const limit = Math.min(parseInt(query.limit || '100', 10), 500);
    const offset = parseInt(query.offset || '0', 10);
    const keyOnly = query.keyOnly === 'true';

    const where = {
      evidenceId,
      tenantId: user.tenantId,
      ...(keyOnly ? { isKeyFrame: true } : {}),
    };

    const [frames, total] = await Promise.all([
      prisma.videoFrame.findMany({
        where,
        orderBy: { frameIndex: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.videoFrame.count({ where }),
    ]);

    return {
      evidenceId,
      total,
      limit,
      offset,
      frames: frames.map((f) => ({
        id: f.id,
        frameIndex: f.frameIndex,
        timestampSec: f.timestampSec,
        s3Key: f.s3Key,
        width: f.width,
        height: f.height,
        fileSize: f.fileSize,
        isKeyFrame: f.isKeyFrame,
        sceneChangeScore: f.sceneChangeScore,
      })),
    };
  });

  // GET /api/video/:evidenceId/overlays — OCR-extracted overlay data
  app.get('/api/video/:evidenceId/overlays', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const overlays = await prisma.videoOverlayExtraction.findMany({
      where: { evidenceId, tenantId: user.tenantId },
      orderBy: { timestampSec: 'asc' },
    });

    return {
      evidenceId,
      count: overlays.length,
      overlays: overlays.map((o) => ({
        id: o.id,
        frameIndex: o.frameIndex,
        timestampSec: o.timestampSec,
        overlayTimestamp: o.overlayTimestamp,
        gpsLat: o.gpsLat,
        gpsLong: o.gpsLong,
        vehicleSpeed: o.vehicleSpeed,
        cameraId: o.cameraId,
        officerId: o.officerId,
        rawOcrText: o.rawOcrText,
        confidence: o.confidence,
      })),
    };
  });

  // GET /api/video/:evidenceId/actions — Detected actions (from transcript)
  app.get('/api/video/:evidenceId/actions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const evidence = await prisma.evidence.findFirst({
      where: { evidenceId, tenantId: user.tenantId },
      select: { caseId: true },
    });

    if (!evidence) {
      return reply.code(404).send({ error: 'Evidence not found' });
    }

    const actions = await prisma.evidenceEvent.findMany({
      where: {
        caseId: evidence.caseId,
        sourceEvidence: evidenceId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      evidenceId,
      count: actions.length,
      actions: actions.map((a) => ({
        eventId: a.eventId,
        timestamp: a.timestamp,
        eventType: a.eventType,
        confidence: a.confidence,
        description: a.description,
        metadata: a.metadata,
      })),
    };
  });

  // GET /api/video/:evidenceId/timeline — Unified video timeline
  app.get('/api/video/:evidenceId/timeline', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    const [run, segments, transcript, overlays, evidence] = await Promise.all([
      prisma.videoPipelineRun.findFirst({
        where: { evidenceId, tenantId: user.tenantId },
      }),
      prisma.videoSegment.findMany({
        where: { evidenceId, tenantId: user.tenantId },
        orderBy: { segmentIndex: 'asc' },
      }),
      prisma.videoTranscript.findFirst({
        where: { evidenceId, tenantId: user.tenantId, segmentIndex: null },
      }),
      prisma.videoOverlayExtraction.findMany({
        where: { evidenceId, tenantId: user.tenantId },
        orderBy: { timestampSec: 'asc' },
      }),
      prisma.evidence.findFirst({
        where: { evidenceId, tenantId: user.tenantId },
        select: { caseId: true, fileName: true, evidenceType: true },
      }),
    ]);

    if (!run || !evidence) {
      return reply.code(404).send({ error: 'No pipeline data found for this evidence' });
    }

    const events = await prisma.evidenceEvent.findMany({
      where: {
        caseId: evidence.caseId,
        sourceEvidence: evidenceId,
      },
      orderBy: { createdAt: 'asc' },
    });

    interface TimelineEntry {
      timestampSec: number;
      type: string;
      data: Record<string, unknown>;
    }

    const timeline: TimelineEntry[] = [];

    for (const seg of segments) {
      timeline.push({
        timestampSec: seg.startTimeSec,
        type: 'segment',
        data: {
          segmentIndex: seg.segmentIndex,
          startTimeSec: seg.startTimeSec,
          endTimeSec: seg.endTimeSec,
          durationSec: seg.durationSec,
        },
      });
    }

    for (const overlay of overlays) {
      timeline.push({
        timestampSec: overlay.timestampSec,
        type: 'overlay',
        data: {
          overlayTimestamp: overlay.overlayTimestamp,
          gpsLat: overlay.gpsLat,
          gpsLong: overlay.gpsLong,
          vehicleSpeed: overlay.vehicleSpeed,
          cameraId: overlay.cameraId,
          officerId: overlay.officerId,
        },
      });
    }

    for (const event of events) {
      timeline.push({
        timestampSec: 0,
        type: 'action',
        data: {
          eventType: event.eventType,
          confidence: event.confidence,
          description: event.description,
          timestamp: event.timestamp,
        },
      });
    }

    timeline.sort((a, b) => a.timestampSec - b.timestampSec);

    return {
      evidenceId,
      fileName: evidence.fileName,
      evidenceType: evidence.evidenceType,
      pipeline: {
        status: run.status,
        progress: run.progress,
        durationSec: run.durationSec,
      },
      counts: {
        segments: segments.length,
        overlays: overlays.length,
        actions: events.length,
        transcriptWords: transcript?.wordCount ?? 0,
      },
      transcript: transcript ? {
        text: transcript.text,
        language: transcript.language,
        confidence: transcript.confidence,
        provider: transcript.provider,
      } : null,
      timeline,
    };
  });
}
