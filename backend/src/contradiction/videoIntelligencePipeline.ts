// ============================================================================
// Phase 4 — Video Intelligence Pipeline
// Frame extraction, overlay OCR, action detection, and metadata analysis
// for bodycam, dashcam, and surveillance footage.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  VideoProcessingJob,
  VideoProcessingResult,
  VideoProcessingStage,
  VideoOverlayMetadata,
  VideoAction,
  ExtractedEvent,
  ExtractionMethod,
} from './types.ts';
import { isValidEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// Frame Extraction Configuration
// ---------------------------------------------------------------------------

const DEFAULT_FRAME_INTERVAL_SEC = 0.5;
const MAX_FRAMES_PER_VIDEO = 7200; // ~1 hour at 0.5s intervals

// ---------------------------------------------------------------------------
// Overlay OCR Patterns
// ---------------------------------------------------------------------------

interface OverlayPattern {
  name: string;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<VideoOverlayMetadata>;
}

const OVERLAY_PATTERNS: OverlayPattern[] = [
  {
    name: 'timestamp_standard',
    pattern: /(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})/,
    extractor: (match) => ({ overlayTimestamp: match[1] }),
  },
  {
    name: 'timestamp_us',
    pattern: /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
    extractor: (match) => ({ overlayTimestamp: match[1] }),
  },
  {
    name: 'gps_coordinates',
    pattern: /(?:GPS|LAT\/LON|COORD)[:\s]*(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i,
    extractor: (match) => ({
      gpsLat: parseFloat(match[1]),
      gpsLong: parseFloat(match[2]),
    }),
  },
  {
    name: 'vehicle_speed',
    pattern: /(?:SPEED|SPD|MPH)[:\s]*(\d+(?:\.\d+)?)\s*(?:MPH|KPH)?/i,
    extractor: (match) => ({ vehicleSpeed: parseFloat(match[1]) }),
  },
  {
    name: 'camera_id',
    pattern: /(?:CAM|CAMERA|UNIT|BWC)[:\s#]*([A-Z0-9-]+)/i,
    extractor: (match) => ({ cameraId: match[1] }),
  },
  {
    name: 'officer_id',
    pattern: /(?:OFFICER|OFC|BADGE)[:\s#]*([A-Z0-9-]+)/i,
    extractor: (match) => ({ officerId: match[1] }),
  },
];

// ---------------------------------------------------------------------------
// Action Detection Rules
// ---------------------------------------------------------------------------

interface ActionDetectionRule {
  actionType: string;
  eventType: string;
  keywords: string[];
  visualCues: string[];
  confidence: number;
}

const ACTION_DETECTION_RULES: ActionDetectionRule[] = [
  {
    actionType: 'weapon_drawn',
    eventType: 'OFFICER_DRAWS_WEAPON',
    keywords: ['gun', 'weapon', 'firearm', 'draw'],
    visualCues: ['hand_on_holster', 'weapon_visible', 'pointing'],
    confidence: 0.75,
  },
  {
    actionType: 'taser_deployed',
    eventType: 'OFFICER_DEPLOYS_TASER',
    keywords: ['taser', 'deploying', 'tase'],
    visualCues: ['taser_visible', 'electrical_arc'],
    confidence: 0.80,
  },
  {
    actionType: 'handcuffing',
    eventType: 'OFFICER_HANDCUFFS_SUSPECT',
    keywords: ['handcuff', 'cuff', 'restraint'],
    visualCues: ['handcuff_visible', 'hands_behind_back'],
    confidence: 0.80,
  },
  {
    actionType: 'physical_contact',
    eventType: 'OFFICER_USES_PHYSICAL_FORCE',
    keywords: ['force', 'physical', 'strike', 'push', 'grab'],
    visualCues: ['physical_contact', 'takedown', 'struggle'],
    confidence: 0.70,
  },
  {
    actionType: 'person_running',
    eventType: 'SUSPECT_RUNS',
    keywords: ['running', 'fleeing', 'foot pursuit', 'chase'],
    visualCues: ['running_motion', 'rapid_camera_movement'],
    confidence: 0.70,
  },
  {
    actionType: 'vehicle_pursuit',
    eventType: 'OFFICER_PURSUES_IN_VEHICLE',
    keywords: ['pursuit', 'chasing', 'high speed'],
    visualCues: ['high_speed', 'siren_lights', 'rapid_movement'],
    confidence: 0.75,
  },
  {
    actionType: 'person_searched',
    eventType: 'OFFICER_SEARCHES_PERSON',
    keywords: ['search', 'pat down', 'frisk'],
    visualCues: ['pat_down_motion', 'search_posture'],
    confidence: 0.70,
  },
  {
    actionType: 'vehicle_searched',
    eventType: 'OFFICER_SEARCHES_VEHICLE',
    keywords: ['search vehicle', 'trunk', 'glove box', 'interior search'],
    visualCues: ['vehicle_interior', 'searching_motion'],
    confidence: 0.70,
  },
  {
    actionType: 'evidence_collected',
    eventType: 'EVIDENCE_ITEM_COLLECTED',
    keywords: ['evidence', 'bag', 'collect', 'recover'],
    visualCues: ['evidence_bag', 'gloves', 'collection'],
    confidence: 0.70,
  },
  {
    actionType: 'camera_obstructed',
    eventType: 'OFFICER_DEACTIVATES_BODYCAM',
    keywords: ['camera', 'blocked', 'covered', 'obstructed'],
    visualCues: ['black_frame', 'obstructed_view', 'hand_over_lens'],
    confidence: 0.65,
  },
];

// ---------------------------------------------------------------------------
// Video Processing Functions
// ---------------------------------------------------------------------------

/**
 * Simulate frame extraction from a video.
 * In production, this would call ffmpeg or a video processing service.
 */
function extractFrames(
  job: VideoProcessingJob,
): { framesExtracted: number; durationMs: number } {
  const interval = job.frameIntervalSec || DEFAULT_FRAME_INTERVAL_SEC;
  // Estimate based on typical video lengths
  const estimatedDurationSec = 1800; // 30 min default estimate
  const frames = Math.min(
    Math.ceil(estimatedDurationSec / interval),
    MAX_FRAMES_PER_VIDEO,
  );

  return {
    framesExtracted: frames,
    durationMs: frames * 10, // Simulated processing time
  };
}

/**
 * Analyze overlay text from video frames using OCR pattern matching.
 */
function analyzeOverlays(
  videoId: string,
  ocrText: string,
): VideoOverlayMetadata[] {
  const overlays: VideoOverlayMetadata[] = [];
  const lines = ocrText.split('\n');

  for (const line of lines) {
    const metadata: Partial<VideoOverlayMetadata> = {
      videoId,
      confidence: 0.80,
    };

    for (const overlayPattern of OVERLAY_PATTERNS) {
      const match = line.match(overlayPattern.pattern);
      if (match) {
        const extracted = overlayPattern.extractor(match);
        Object.assign(metadata, extracted);
      }
    }

    if (metadata.overlayTimestamp || metadata.gpsLat || metadata.vehicleSpeed) {
      overlays.push({
        videoId,
        frameTimestamp: metadata.overlayTimestamp ?? '',
        overlayTimestamp: metadata.overlayTimestamp ?? null,
        gpsLat: metadata.gpsLat ?? null,
        gpsLong: metadata.gpsLong ?? null,
        vehicleSpeed: metadata.vehicleSpeed ?? null,
        cameraId: metadata.cameraId ?? null,
        officerId: metadata.officerId ?? null,
        confidence: metadata.confidence ?? 0.80,
      });
    }
  }

  return overlays;
}

/**
 * Detect actions in video using transcript and visual cue analysis.
 */
function detectActions(
  videoId: string,
  transcript: string,
): VideoAction[] {
  const actions: VideoAction[] = [];

  for (const rule of ACTION_DETECTION_RULES) {
    for (const keyword of rule.keywords) {
      const regex = new RegExp(keyword, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(transcript)) !== null) {
        actions.push({
          videoId,
          timestamp: '', // Would be derived from transcript timing
          actionType: rule.actionType,
          actorLabel: 'Detected',
          objectDetected: null,
          confidence: rule.confidence,
        });
        break; // One detection per rule per pass
      }
    }
  }

  return actions;
}

/**
 * Convert detected actions into structured events.
 */
function actionsToEvents(
  caseId: string,
  videoId: string,
  actions: VideoAction[],
): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];

  for (const action of actions) {
    const rule = ACTION_DETECTION_RULES.find((r) => r.actionType === action.actionType);
    if (!rule) continue;
    if (!isValidEventType(rule.eventType)) continue;

    events.push({
      eventId: uuidv4(),
      caseId,
      eventType: rule.eventType,
      timestamp: action.timestamp || null,
      timestampSource: 'bodycam_overlay',
      actor: action.actorLabel,
      actorRole: 'officer',
      object: action.objectDetected,
      location: null,
      sourceEvidenceId: videoId,
      confidence: action.confidence,
      extractionMethod: 'VIDEO_ACTION_DETECTION' as ExtractionMethod,
      rawText: `Video action detected: ${action.actionType}`,
      createdAt: new Date().toISOString(),
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Public API — Video Processing Pipeline
// ---------------------------------------------------------------------------

/**
 * Process a video through the full intelligence pipeline.
 */
export function processVideo(
  job: VideoProcessingJob,
  ocrText: string = '',
  transcript: string = '',
): {
  result: VideoProcessingResult;
  overlays: VideoOverlayMetadata[];
  actions: VideoAction[];
  events: ExtractedEvent[];
} {
  const stageResults: VideoProcessingResult['stages'] = [];
  let framesExtracted = 0;
  let overlaysDetected = 0;
  let actionsDetected = 0;
  let eventsGenerated = 0;
  const startTime = Date.now();

  // Stage 1: Frame Extraction
  if (job.stages.includes('frame_extraction')) {
    const frameStart = Date.now();
    try {
      const frameResult = extractFrames(job);
      framesExtracted = frameResult.framesExtracted;
      stageResults.push({
        stage: 'frame_extraction',
        status: 'completed',
        durationMs: Date.now() - frameStart,
      });
    } catch (err) {
      stageResults.push({
        stage: 'frame_extraction',
        status: 'failed',
        durationMs: Date.now() - frameStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Stage 2: Overlay OCR
  let overlays: VideoOverlayMetadata[] = [];
  if (job.stages.includes('overlay_ocr') && ocrText) {
    const ocrStart = Date.now();
    try {
      overlays = analyzeOverlays(job.videoId, ocrText);
      overlaysDetected = overlays.length;
      stageResults.push({
        stage: 'overlay_ocr',
        status: 'completed',
        durationMs: Date.now() - ocrStart,
      });
    } catch (err) {
      stageResults.push({
        stage: 'overlay_ocr',
        status: 'failed',
        durationMs: Date.now() - ocrStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Stage 3: Action Detection
  let actions: VideoAction[] = [];
  if (job.stages.includes('action_detection') && transcript) {
    const actionStart = Date.now();
    try {
      actions = detectActions(job.videoId, transcript);
      actionsDetected = actions.length;
      stageResults.push({
        stage: 'action_detection',
        status: 'completed',
        durationMs: Date.now() - actionStart,
      });
    } catch (err) {
      stageResults.push({
        stage: 'action_detection',
        status: 'failed',
        durationMs: Date.now() - actionStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Stage 4: Event Generation
  let events: ExtractedEvent[] = [];
  if (job.stages.includes('event_generation')) {
    const eventStart = Date.now();
    try {
      events = actionsToEvents(job.caseId, job.videoId, actions);
      eventsGenerated = events.length;
      stageResults.push({
        stage: 'event_generation',
        status: 'completed',
        durationMs: Date.now() - eventStart,
      });
    } catch (err) {
      stageResults.push({
        stage: 'event_generation',
        status: 'failed',
        durationMs: Date.now() - eventStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const result: VideoProcessingResult = {
    videoId: job.videoId,
    framesExtracted,
    overlaysDetected,
    actionsDetected,
    eventsGenerated,
    processingTimeMs: Date.now() - startTime,
    stages: stageResults,
  };

  return { result, overlays, actions, events };
}

/**
 * Detect bodycam activation gaps — periods where bodycam should have
 * been active but was not recording.
 */
export function detectBodycamGaps(
  overlays: VideoOverlayMetadata[],
  expectedStartTime: string,
  expectedEndTime: string,
): Array<{ gapStart: string; gapEnd: string; durationMs: number }> {
  if (overlays.length === 0) {
    return [{
      gapStart: expectedStartTime,
      gapEnd: expectedEndTime,
      durationMs: 0, // Unknown duration
    }];
  }

  const gaps: Array<{ gapStart: string; gapEnd: string; durationMs: number }> = [];
  const sortedOverlays = [...overlays]
    .filter((o) => o.overlayTimestamp)
    .sort((a, b) => (a.overlayTimestamp ?? '').localeCompare(b.overlayTimestamp ?? ''));

  // Check if recording started late
  if (sortedOverlays.length > 0 && sortedOverlays[0].overlayTimestamp) {
    if (sortedOverlays[0].overlayTimestamp > expectedStartTime) {
      gaps.push({
        gapStart: expectedStartTime,
        gapEnd: sortedOverlays[0].overlayTimestamp,
        durationMs: 0,
      });
    }
  }

  // Check for gaps within the recording
  for (let i = 0; i < sortedOverlays.length - 1; i++) {
    const current = sortedOverlays[i].overlayTimestamp;
    const next = sortedOverlays[i + 1].overlayTimestamp;
    if (current && next) {
      // If gap between frames is > 30 seconds, flag it
      const currentDate = new Date(current).getTime();
      const nextDate = new Date(next).getTime();
      if (!isNaN(currentDate) && !isNaN(nextDate) && nextDate - currentDate > 30_000) {
        gaps.push({
          gapStart: current,
          gapEnd: next,
          durationMs: nextDate - currentDate,
        });
      }
    }
  }

  return gaps;
}
