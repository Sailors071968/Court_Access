// ============================================================================
// Phase B — Video Analysis Helpers
// Extracted from videoIntelligencePipeline.ts and videoActionDetectionService.ts
// for use by the video pipeline orchestrator.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlayResult {
  frameIndex: number | null;
  timestampSec: number;
  overlayTimestamp: string | null;
  gpsLat: number | null;
  gpsLong: number | null;
  vehicleSpeed: number | null;
  cameraId: string | null;
  officerId: string | null;
  rawOcrText: string | null;
  confidence: number;
}

export interface DetectedAction {
  videoId: string;
  timestamp: string;
  actionType: string;
  actorLabel: string;
  objectDetected: string | null;
  confidence: number;
  description: string;
}

export interface GeneratedEvent {
  eventId: string;
  caseId: string;
  eventType: string;
  timestamp: string | null;
  actor: string;
  actorRole: string;
  confidence: number;
  description: string;
  extractionMethod: string;
  sourceEvidenceId: string;
}

// ---------------------------------------------------------------------------
// Overlay OCR Patterns
// ---------------------------------------------------------------------------

interface OverlayPattern {
  name: string;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<{
    overlayTimestamp: string;
    gpsLat: number;
    gpsLong: number;
    vehicleSpeed: number;
    cameraId: string;
    officerId: string;
  }>;
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
  confidence: number;
}

const ACTION_DETECTION_RULES: ActionDetectionRule[] = [
  {
    actionType: 'weapon_drawn',
    eventType: 'OFFICER_DRAWS_WEAPON',
    keywords: ['gun', 'weapon', 'firearm', 'draw'],
    confidence: 0.75,
  },
  {
    actionType: 'taser_deployed',
    eventType: 'OFFICER_DEPLOYS_TASER',
    keywords: ['taser', 'deploying', 'tase'],
    confidence: 0.80,
  },
  {
    actionType: 'handcuffing',
    eventType: 'OFFICER_HANDCUFFS_SUSPECT',
    keywords: ['handcuff', 'cuff', 'restraint'],
    confidence: 0.80,
  },
  {
    actionType: 'physical_contact',
    eventType: 'OFFICER_USES_PHYSICAL_FORCE',
    keywords: ['force', 'physical', 'strike', 'push', 'grab'],
    confidence: 0.70,
  },
  {
    actionType: 'person_running',
    eventType: 'SUSPECT_RUNS',
    keywords: ['running', 'fleeing', 'foot pursuit', 'chase'],
    confidence: 0.70,
  },
  {
    actionType: 'vehicle_pursuit',
    eventType: 'OFFICER_PURSUES_IN_VEHICLE',
    keywords: ['pursuit', 'chasing', 'high speed'],
    confidence: 0.75,
  },
  {
    actionType: 'person_searched',
    eventType: 'OFFICER_SEARCHES_PERSON',
    keywords: ['search', 'pat down', 'frisk'],
    confidence: 0.70,
  },
  {
    actionType: 'vehicle_searched',
    eventType: 'OFFICER_SEARCHES_VEHICLE',
    keywords: ['search vehicle', 'trunk', 'glove box', 'interior search'],
    confidence: 0.70,
  },
  {
    actionType: 'evidence_collected',
    eventType: 'EVIDENCE_ITEM_COLLECTED',
    keywords: ['evidence', 'bag', 'collect', 'recover'],
    confidence: 0.70,
  },
  {
    actionType: 'camera_obstructed',
    eventType: 'OFFICER_DEACTIVATES_BODYCAM',
    keywords: ['camera', 'blocked', 'covered', 'obstructed'],
    confidence: 0.65,
  },
  {
    actionType: 'miranda_warning',
    eventType: 'OFFICER_READS_MIRANDA',
    keywords: ['right to remain silent', 'miranda', 'right to an attorney'],
    confidence: 0.85,
  },
  {
    actionType: 'verbal_command',
    eventType: 'OFFICER_GIVES_VERBAL_COMMAND',
    keywords: ['stop', 'get on the ground', 'hands up', 'don\'t move', 'show me your hands'],
    confidence: 0.70,
  },
];

// ---------------------------------------------------------------------------
// Overlay Analysis (Phase B placeholder — real OCR in Phase C)
// ---------------------------------------------------------------------------

/**
 * Analyze video frames for overlay text.
 * In Phase B, this generates placeholder overlay data based on frame timestamps.
 * Phase C will integrate actual OCR (Tesseract.js / cloud OCR) on frame images.
 */
export function analyzeOverlays(
  _evidenceId: string,
  frames: Array<{ frameIndex: number; timestampSec: number }>,
): OverlayResult[] {
  // Phase B: Generate placeholder overlay data from frame timestamps
  // In production (Phase C), each frame would be OCR'd for timestamp/GPS/camera overlays
  const overlays: OverlayResult[] = [];

  for (const frame of frames) {
    // Generate a simulated bodycam timestamp overlay every 10 frames
    if (frame.frameIndex % 10 === 0) {
      const baseDate = new Date('2024-01-15T14:30:00');
      baseDate.setSeconds(baseDate.getSeconds() + Math.floor(frame.timestampSec));

      overlays.push({
        frameIndex: frame.frameIndex,
        timestampSec: frame.timestampSec,
        overlayTimestamp: baseDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
        gpsLat: null,
        gpsLong: null,
        vehicleSpeed: null,
        cameraId: null,
        officerId: null,
        rawOcrText: null,
        confidence: 0.0, // Zero confidence = placeholder data
      });
    }
  }

  return overlays;
}

// ---------------------------------------------------------------------------
// Action Detection
// ---------------------------------------------------------------------------

/**
 * Detect actions in video using transcript text analysis.
 */
export function detectActions(videoId: string, transcript: string): DetectedAction[] {
  const actions: DetectedAction[] = [];

  for (const rule of ACTION_DETECTION_RULES) {
    for (const keyword of rule.keywords) {
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(transcript)) {
        actions.push({
          videoId,
          timestamp: '',
          actionType: rule.actionType,
          actorLabel: 'Detected',
          objectDetected: null,
          confidence: rule.confidence,
          description: `Detected ${rule.actionType.replace(/_/g, ' ')} in transcript`,
        });
        break; // One detection per rule
      }
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Event Generation
// ---------------------------------------------------------------------------

/**
 * Convert detected actions into structured timeline events.
 */
export function actionsToEvents(
  caseId: string,
  videoId: string,
  actions: DetectedAction[],
): GeneratedEvent[] {
  const events: GeneratedEvent[] = [];

  for (const action of actions) {
    const rule = ACTION_DETECTION_RULES.find((r) => r.actionType === action.actionType);
    if (!rule) continue;

    events.push({
      eventId: `${videoId}-${rule.eventType}-${events.length}`,
      caseId,
      eventType: rule.eventType,
      timestamp: action.timestamp || null,
      actor: action.actorLabel,
      actorRole: 'officer',
      confidence: action.confidence,
      description: `Video action detected: ${action.actionType.replace(/_/g, ' ')}`,
      extractionMethod: 'VIDEO_ACTION_DETECTION',
      sourceEvidenceId: videoId,
    });
  }

  return events;
}

/**
 * Parse overlay text using OCR patterns.
 * Used when real OCR text is available (Phase C).
 */
export function parseOverlayText(text: string): Partial<{
  overlayTimestamp: string;
  gpsLat: number;
  gpsLong: number;
  vehicleSpeed: number;
  cameraId: string;
  officerId: string;
}> {
  const result: Partial<{
    overlayTimestamp: string;
    gpsLat: number;
    gpsLong: number;
    vehicleSpeed: number;
    cameraId: string;
    officerId: string;
  }> = {};

  for (const pattern of OVERLAY_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (match) {
      Object.assign(result, pattern.extractor(match));
    }
  }

  return result;
}
