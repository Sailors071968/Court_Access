// ============================================================================
// Phase B — Video Pipeline Orchestrator
// Multi-stage video processing pipeline with restartable stages.
// Stages: Probe → Segment → Frame Extract → OCR → Transcribe → Action Detect → Event Generate
// Each stage writes results to Prisma and can be resumed from the last completed stage.
// ============================================================================

import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import prisma from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { getR2Object, getR2Client, R2_BUCKET } from '../lib/r2.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  probeVideo,
  segmentVideo,
  extractKeyFrames,
  createTempDir,
  cleanupTempDir,
} from './ffmpegService.js';
import { getDefaultProvider } from './transcriptionService.js';
import { analyzeOverlays, detectActions, actionsToEvents } from './videoAnalysisHelpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'probe'
  | 'segment'
  | 'frames'
  | 'ocr'
  | 'transcribe'
  | 'actions'
  | 'events';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Weight of each stage for overall progress calculation (must sum to 100) */
const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  probe: 5,
  segment: 25,
  frames: 15,
  ocr: 10,
  transcribe: 20,
  actions: 15,
  events: 10,
};

const ALL_STAGES: PipelineStage[] = ['probe', 'segment', 'frames', 'ocr', 'transcribe', 'actions', 'events'];

export interface PipelineContext {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  pipelineRunId: string;
  processingJobId?: string;
  tempDir: string;
  localVideoPath: string;
  signal: AbortSignal;
  onProgress: (stage: PipelineStage, stageProgress: number) => void;
}

// ---------------------------------------------------------------------------
// Stage field mapping helper
// ---------------------------------------------------------------------------

function stageDbField(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    probe: 'stageProbe',
    segment: 'stageSegment',
    frames: 'stageFrames',
    ocr: 'stageOcr',
    transcribe: 'stageTranscribe',
    actions: 'stageActions',
    events: 'stageEvents',
  };
  return map[stage];
}

function calculateOverallProgress(completedStages: PipelineStage[], currentStage?: PipelineStage, currentStageProgress?: number): number {
  let progress = 0;
  for (const stage of completedStages) {
    progress += STAGE_WEIGHTS[stage];
  }
  if (currentStage && currentStageProgress !== undefined) {
    progress += (STAGE_WEIGHTS[currentStage] * currentStageProgress) / 100;
  }
  return Math.min(100, Math.round(progress * 10) / 10);
}

// ---------------------------------------------------------------------------
// Pipeline Execution
// ---------------------------------------------------------------------------

/**
 * Run the full video intelligence pipeline for a piece of evidence.
 * Each stage is independently restartable — if a previous run partially completed,
 * this will resume from the last completed stage.
 */
export async function runVideoPipeline(params: {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  processingJobId?: string;
  signal: AbortSignal;
  onProgress?: (stage: PipelineStage, stageProgress: number) => void;
}): Promise<void> {
  const { evidenceId, caseId, tenantId, s3Key, processingJobId, signal } = params;
  const onProgress = params.onProgress ?? (() => {});

  // Create or find existing pipeline run
  let pipelineRun = await prisma.videoPipelineRun.findUnique({
    where: { evidenceId },
  });

  if (!pipelineRun) {
    pipelineRun = await prisma.videoPipelineRun.create({
      data: {
        evidenceId,
        tenantId,
        caseId,
        processingJobId: processingJobId ?? null,
        status: 'running',
        startedAt: new Date(),
      },
    });
  } else if (pipelineRun.status === 'completed') {
    console.log(`[VideoPipeline] Pipeline already completed for evidence ${evidenceId}`);
    return;
  } else {
    // Resume: mark as running again
    pipelineRun = await prisma.videoPipelineRun.update({
      where: { id: pipelineRun.id },
      data: { status: 'running', startedAt: new Date(), error: null },
    });
  }

  const tempDir = await createTempDir('video-pipeline');

  const ctx: PipelineContext = {
    evidenceId,
    caseId,
    tenantId,
    s3Key,
    pipelineRunId: pipelineRun.id,
    processingJobId,
    tempDir,
    localVideoPath: join(tempDir, 'source_video'),
    signal,
    onProgress,
  };

  try {
    // Download video from R2 to local temp
    await downloadFromR2(ctx);

    // Determine which stages need to run
    const completedStages = getCompletedStages(pipelineRun);

    for (const stage of ALL_STAGES) {
      if (signal.aborted) {
        throw new Error('Pipeline cancelled by abort signal');
      }

      if (completedStages.includes(stage)) {
        console.log(`[VideoPipeline] Skipping already-completed stage: ${stage}`);
        continue;
      }

      await runStage(ctx, stage, completedStages);
      completedStages.push(stage);
    }

    // Mark pipeline as completed
    await prisma.videoPipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        currentStage: null,
      },
    });

    console.log(`[VideoPipeline] Pipeline completed for evidence ${evidenceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[VideoPipeline] Pipeline failed for evidence ${evidenceId}: ${message}`);

    await prisma.videoPipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        status: 'failed',
        error: message.slice(0, 2000),
        completedAt: new Date(),
      },
    }).catch((err: unknown) => {
      console.error('[VideoPipeline] Failed to update pipeline run status:', err);
    });

    throw error;
  } finally {
    await cleanupTempDir(tempDir);
  }
}

// ---------------------------------------------------------------------------
// Stage Execution
// ---------------------------------------------------------------------------

async function runStage(ctx: PipelineContext, stage: PipelineStage, completedStages: PipelineStage[]): Promise<void> {
  console.log(`[VideoPipeline] Starting stage: ${stage} for evidence ${ctx.evidenceId}`);

  // Mark stage as running
  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: {
      currentStage: stage,
      [stageDbField(stage)]: 'running',
      progress: calculateOverallProgress(completedStages, stage, 0),
    },
  });

  try {
    switch (stage) {
      case 'probe':
        await stageProbe(ctx);
        break;
      case 'segment':
        await stageSegment(ctx);
        break;
      case 'frames':
        await stageFrames(ctx);
        break;
      case 'ocr':
        await stageOcr(ctx);
        break;
      case 'transcribe':
        await stageTranscribe(ctx);
        break;
      case 'actions':
        await stageActions(ctx);
        break;
      case 'events':
        await stageEvents(ctx);
        break;
    }

    // Mark stage as completed
    await prisma.videoPipelineRun.update({
      where: { id: ctx.pipelineRunId },
      data: {
        [stageDbField(stage)]: 'completed',
        progress: calculateOverallProgress([...completedStages, stage]),
      },
    });

    console.log(`[VideoPipeline] Stage ${stage} completed for evidence ${ctx.evidenceId}`);
  } catch (error) {
    await prisma.videoPipelineRun.update({
      where: { id: ctx.pipelineRunId },
      data: { [stageDbField(stage)]: 'failed' },
    }).catch(() => {});

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Individual Stage Implementations
// ---------------------------------------------------------------------------

/**
 * Stage 1: Probe — Extract video metadata via FFprobe
 */
async function stageProbe(ctx: PipelineContext): Promise<void> {
  const probe = await probeVideo(ctx.localVideoPath);

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: {
      durationSec: probe.durationSec,
      codec: probe.codec,
      resolution: `${probe.width}x${probe.height}`,
      fps: probe.fps,
      fileSizeBytes: BigInt(probe.fileSizeBytes),
    },
  });

  ctx.onProgress('probe', 100);
}

/**
 * Stage 2: Segment — Split video into 30-second chunks
 */
async function stageSegment(ctx: PipelineContext): Promise<void> {
  const segmentDir = join(ctx.tempDir, 'segments');
  const segments = await segmentVideo(ctx.localVideoPath, segmentDir, 30, ctx.signal);

  let uploadedCount = 0;
  for (const segment of segments) {
    if (ctx.signal.aborted) throw new Error('Cancelled');

    // Upload segment to R2
    const segmentS3Key = `${ctx.s3Key}_segments/segment_${String(segment.segmentIndex).padStart(4, '0')}.mp4`;
    await uploadToR2(segment.filePath, segmentS3Key);

    // Save segment record
    await prisma.videoSegment.upsert({
      where: {
        evidenceId_segmentIndex: {
          evidenceId: ctx.evidenceId,
          segmentIndex: segment.segmentIndex,
        },
      },
      create: {
        evidenceId: ctx.evidenceId,
        tenantId: ctx.tenantId,
        caseId: ctx.caseId,
        segmentIndex: segment.segmentIndex,
        startTimeSec: segment.startTimeSec,
        endTimeSec: segment.endTimeSec,
        durationSec: segment.durationSec,
        s3Key: segmentS3Key,
        fileSize: BigInt(segment.fileSize),
        status: 'ready',
      },
      update: {
        startTimeSec: segment.startTimeSec,
        endTimeSec: segment.endTimeSec,
        durationSec: segment.durationSec,
        s3Key: segmentS3Key,
        fileSize: BigInt(segment.fileSize),
        status: 'ready',
      },
    });

    uploadedCount++;
    ctx.onProgress('segment', Math.round((uploadedCount / segments.length) * 100));
  }

  // Update segment count
  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { segmentCount: segments.length },
  });
}

/**
 * Stage 3: Frames — Extract key frames at regular intervals
 */
async function stageFrames(ctx: PipelineContext): Promise<void> {
  const frameDir = join(ctx.tempDir, 'frames');
  const frames = await extractKeyFrames(ctx.localVideoPath, frameDir, 2, ctx.signal);

  let uploadedCount = 0;
  for (const frame of frames) {
    if (ctx.signal.aborted) throw new Error('Cancelled');

    // Upload frame to R2
    const frameS3Key = `${ctx.s3Key}_frames/frame_${String(frame.frameIndex).padStart(6, '0')}.jpg`;
    await uploadToR2(frame.filePath, frameS3Key);

    // Save frame record
    await prisma.videoFrame.upsert({
      where: {
        evidenceId_frameIndex: {
          evidenceId: ctx.evidenceId,
          frameIndex: frame.frameIndex,
        },
      },
      create: {
        evidenceId: ctx.evidenceId,
        tenantId: ctx.tenantId,
        caseId: ctx.caseId,
        frameIndex: frame.frameIndex,
        timestampSec: frame.timestampSec,
        s3Key: frameS3Key,
        isKeyFrame: true,
      },
      update: {
        timestampSec: frame.timestampSec,
        s3Key: frameS3Key,
        isKeyFrame: true,
      },
    });

    uploadedCount++;
    if (uploadedCount % 10 === 0 || uploadedCount === frames.length) {
      ctx.onProgress('frames', Math.round((uploadedCount / frames.length) * 100));
    }
  }

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { frameCount: frames.length },
  });
}

/**
 * Stage 4: OCR — Extract overlay text from video frames.
 * Uses pattern matching on frame metadata (real OCR via Tesseract/cloud in Phase C).
 */
async function stageOcr(ctx: PipelineContext): Promise<void> {
  // Get all frames for this evidence
  const frames = await prisma.videoFrame.findMany({
    where: { evidenceId: ctx.evidenceId },
    orderBy: { frameIndex: 'asc' },
  });

  if (frames.length === 0) {
    console.log('[VideoPipeline] No frames to OCR — skipping');
    return;
  }

  // In Phase B, we use placeholder OCR analysis.
  // Phase C will integrate Tesseract.js or cloud OCR on actual frame images.
  const overlays = analyzeOverlays(ctx.evidenceId, frames);

  for (const overlay of overlays) {
    await prisma.videoOverlayExtraction.create({
      data: {
        evidenceId: ctx.evidenceId,
        tenantId: ctx.tenantId,
        caseId: ctx.caseId,
        frameIndex: overlay.frameIndex,
        timestampSec: overlay.timestampSec,
        overlayTimestamp: overlay.overlayTimestamp,
        gpsLat: overlay.gpsLat,
        gpsLong: overlay.gpsLong,
        vehicleSpeed: overlay.vehicleSpeed,
        cameraId: overlay.cameraId,
        officerId: overlay.officerId,
        rawOcrText: overlay.rawOcrText,
        confidence: overlay.confidence,
      },
    });
  }

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { overlayCount: overlays.length },
  });

  ctx.onProgress('ocr', 100);
}

/**
 * Stage 5: Transcribe — Speech-to-text on video audio.
 * Uses the configured transcription provider (mock in Phase B, real in Phase C).
 */
async function stageTranscribe(ctx: PipelineContext): Promise<void> {
  const provider = getDefaultProvider();

  // Get pipeline run for duration info
  const run = await prisma.videoPipelineRun.findUnique({
    where: { id: ctx.pipelineRunId },
  });

  const result = await provider.transcribe(ctx.localVideoPath, {
    expectedDurationSec: run?.durationSec ?? 30,
    signal: ctx.signal,
  });

  // Save full-video transcript
  await prisma.videoTranscript.create({
    data: {
      evidenceId: ctx.evidenceId,
      tenantId: ctx.tenantId,
      caseId: ctx.caseId,
      segmentIndex: null, // Full video
      language: result.language,
      text: result.text,
      wordCount: result.words.length,
      durationSec: result.durationSec,
      confidence: result.confidence,
      provider: result.provider,
      words: result.words as unknown as Prisma.InputJsonValue,
      status: 'completed',
    },
  });

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { transcriptWords: result.words.length },
  });

  ctx.onProgress('transcribe', 100);
}

/**
 * Stage 6: Actions — Detect actions in the video using transcript + overlay data.
 */
async function stageActions(ctx: PipelineContext): Promise<void> {
  // Load transcript
  const transcript = await prisma.videoTranscript.findFirst({
    where: { evidenceId: ctx.evidenceId, segmentIndex: null },
  });

  const transcriptText = transcript?.text ?? '';

  // Detect actions from transcript
  const actions = detectActions(ctx.evidenceId, transcriptText);

  // Store as evidence events
  for (const action of actions) {
    await prisma.evidenceEvent.create({
      data: {
        caseId: ctx.caseId,
        timestamp: action.timestamp || '00:00:00',
        eventType: action.actionType,
        confidence: action.confidence,
        sourceEvidence: ctx.evidenceId,
        sourceType: 'bodycam',
        description: action.description,
        metadata: JSON.stringify({
          pipelineRunId: ctx.pipelineRunId,
          detectionSource: 'video_intelligence_pipeline',
        }),
      },
    });
  }

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { actionCount: actions.length },
  });

  ctx.onProgress('actions', 100);
}

/**
 * Stage 7: Events — Generate structured timeline events from detected actions.
 */
async function stageEvents(ctx: PipelineContext): Promise<void> {
  // Load transcript for event context
  const transcript = await prisma.videoTranscript.findFirst({
    where: { evidenceId: ctx.evidenceId, segmentIndex: null },
  });

  const transcriptText = transcript?.text ?? '';

  // Detect actions and convert to timeline events
  const actions = detectActions(ctx.evidenceId, transcriptText);
  const events = actionsToEvents(ctx.caseId, ctx.evidenceId, actions);

  // Store as timeline events
  for (const event of events) {
    await prisma.timelineEvent.create({
      data: {
        caseId: ctx.caseId,
        tenantId: ctx.tenantId,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        sourceDoc: ctx.evidenceId,
        sourceType: 'bodycam',
        description: event.description,
        actor: event.actor,
        confidence: event.confidence,
        metadata: {
          eventType: event.eventType,
          extractionMethod: event.extractionMethod,
          pipelineRunId: ctx.pipelineRunId,
        },
      },
    });
  }

  await prisma.videoPipelineRun.update({
    where: { id: ctx.pipelineRunId },
    data: { eventCount: events.length },
  });

  ctx.onProgress('events', 100);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCompletedStages(run: {
  stageProbe: string;
  stageSegment: string;
  stageFrames: string;
  stageOcr: string;
  stageTranscribe: string;
  stageActions: string;
  stageEvents: string;
}): PipelineStage[] {
  const completed: PipelineStage[] = [];
  if (run.stageProbe === 'completed') completed.push('probe');
  if (run.stageSegment === 'completed') completed.push('segment');
  if (run.stageFrames === 'completed') completed.push('frames');
  if (run.stageOcr === 'completed') completed.push('ocr');
  if (run.stageTranscribe === 'completed') completed.push('transcribe');
  if (run.stageActions === 'completed') completed.push('actions');
  if (run.stageEvents === 'completed') completed.push('events');
  return completed;
}

/**
 * Download a file from R2 to a local path.
 */
async function downloadFromR2(ctx: PipelineContext): Promise<void> {
  console.log(`[VideoPipeline] Downloading ${ctx.s3Key} from R2...`);
  const obj = await getR2Object(ctx.s3Key);
  if (!obj) {
    throw new Error(`Video file not found in R2: ${ctx.s3Key}`);
  }

  const writeStream = createWriteStream(ctx.localVideoPath);
  await pipeline(obj.body as Readable, writeStream);

  const fileStat = await stat(ctx.localVideoPath);
  console.log(`[VideoPipeline] Downloaded ${(Number(fileStat.size) / (1024 * 1024)).toFixed(1)}MB to ${ctx.localVideoPath}`);
}

/**
 * Upload a local file to R2.
 */
async function uploadToR2(localPath: string, s3Key: string): Promise<void> {
  const client = getR2Client();
  const fileStat = await stat(localPath);
  const body = createReadStream(localPath);

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: s3Key,
    Body: body,
    ContentLength: Number(fileStat.size),
  }));
}
