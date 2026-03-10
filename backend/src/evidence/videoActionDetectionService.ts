// ============================================================================
// Phase 130 — Bodycam Video Analysis Service
// Detects physical restraints, weapon deployment, strikes, handcuffing,
// vehicle searches, officer proximity from video evidence.
// Uses frame analysis with pose/object detection patterns.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoAnalysisResult {
  sourceId: string;
  caseId: string;
  totalFramesAnalyzed: number;
  detectedActions: DetectedVideoAction[];
  durationMs: number;
}

export interface DetectedVideoAction {
  timestamp: string;
  actionType: string;
  confidence: number;
  description: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  poseData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Action detection patterns (frame-level heuristics)
// ---------------------------------------------------------------------------

const VIDEO_ACTION_PATTERNS: Record<string, {
  keywords: string[];
  minConfidence: number;
  category: string;
}> = {
  physical_restraint: {
    keywords: ['prone_position', 'arm_control', 'body_weight', 'ground_control'],
    minConfidence: 0.70,
    category: 'Use_of_Force',
  },
  weapon_deployment: {
    keywords: ['firearm_drawn', 'taser_aim', 'baton_raised', 'pepper_spray_aim'],
    minConfidence: 0.75,
    category: 'Use_of_Force',
  },
  physical_strike: {
    keywords: ['punch_motion', 'kick_motion', 'baton_swing', 'elbow_strike'],
    minConfidence: 0.72,
    category: 'Use_of_Force',
  },
  handcuffing: {
    keywords: ['wrist_manipulation', 'behind_back_arms', 'cuff_application'],
    minConfidence: 0.68,
    category: 'Arrest',
  },
  vehicle_search: {
    keywords: ['trunk_open', 'glove_box', 'under_seat', 'vehicle_interior'],
    minConfidence: 0.65,
    category: 'Search_Seizure',
  },
  officer_proximity: {
    keywords: ['close_approach', 'personal_space', 'within_arms_reach'],
    minConfidence: 0.60,
    category: 'Officer_Conduct',
  },
  neck_restraint: {
    keywords: ['neck_contact', 'chokehold_position', 'carotid_compression'],
    minConfidence: 0.80,
    category: 'Use_of_Force',
  },
  prone_restraint: {
    keywords: ['prone_position', 'weight_on_back', 'face_down'],
    minConfidence: 0.75,
    category: 'Use_of_Force',
  },
  k9_deployment: {
    keywords: ['canine_release', 'dog_bite', 'k9_engagement'],
    minConfidence: 0.78,
    category: 'Use_of_Force',
  },
};

// ---------------------------------------------------------------------------
// Simulated video analysis (production would use OpenCV + ML models)
// ---------------------------------------------------------------------------

/**
 * Analyze video frames for officer actions.
 * In production, this would interface with OpenCV/TensorFlow for
 * pose detection and object detection. Currently uses metadata-based analysis.
 */
export async function analyzeVideoEvidence(
  caseId: string,
  sourceId: string,
  videoMetadata: {
    durationSeconds: number;
    description?: string;
    transcript?: string;
    frameAnnotations?: Array<{
      timestamp: string;
      annotation: string;
    }>;
  },
): Promise<VideoAnalysisResult> {
  const startTime = Date.now();
  const detectedActions: DetectedVideoAction[] = [];

  // Analyze frame annotations if provided
  if (videoMetadata.frameAnnotations) {
    for (const frame of videoMetadata.frameAnnotations) {
      for (const [actionType, pattern] of Object.entries(VIDEO_ACTION_PATTERNS)) {
        const matchScore = calculateAnnotationMatch(frame.annotation, pattern.keywords);
        if (matchScore >= pattern.minConfidence) {
          detectedActions.push({
            timestamp: frame.timestamp,
            actionType,
            confidence: matchScore,
            description: `Detected ${actionType.replace(/_/g, ' ')} at ${frame.timestamp}`,
          });
        }
      }
    }
  }

  // Analyze transcript overlay for additional context
  if (videoMetadata.transcript) {
    const transcriptActions = analyzeTranscriptOverlay(
      videoMetadata.transcript,
      videoMetadata.durationSeconds,
    );
    detectedActions.push(...transcriptActions);
  }

  // Store detected actions as evidence events
  for (const action of detectedActions) {
    await prisma.evidenceEvent.create({
      data: {
        caseId,
        timestamp: action.timestamp,
        eventType: action.actionType,
        confidence: action.confidence,
        sourceEvidence: sourceId,
        sourceType: 'bodycam',
        description: action.description,
        metadata: action.boundingBox ? JSON.stringify(action.boundingBox) : undefined,
      },
    });
  }

  return {
    sourceId,
    caseId,
    totalFramesAnalyzed: Math.floor(videoMetadata.durationSeconds * 30), // 30fps estimate
    detectedActions,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Calculate match score between annotation text and action keywords
 */
function calculateAnnotationMatch(annotation: string, keywords: string[]): number {
  const normalized = annotation.toLowerCase();
  let matches = 0;
  for (const keyword of keywords) {
    if (normalized.includes(keyword.replace(/_/g, ' ')) || normalized.includes(keyword)) {
      matches++;
    }
  }
  return matches > 0 ? Math.min(0.95, 0.5 + (matches / keywords.length) * 0.45) : 0;
}

/**
 * Analyze transcript text overlaid on video for action cues
 */
function analyzeTranscriptOverlay(
  transcript: string,
  _durationSeconds: number,
): DetectedVideoAction[] {
  const actions: DetectedVideoAction[] = [];
  const lines = transcript.split('\n');

  for (const line of lines) {
    const tsMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    const timestamp = tsMatch ? tsMatch[1] : '00:00:00';

    for (const [actionType, pattern] of Object.entries(VIDEO_ACTION_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        const searchTerm = keyword.replace(/_/g, ' ');
        if (line.toLowerCase().includes(searchTerm)) {
          actions.push({
            timestamp: timestamp.length <= 5 ? `${timestamp}:00` : timestamp,
            actionType,
            confidence: pattern.minConfidence + 0.05,
            description: `Video transcript indicates ${actionType.replace(/_/g, ' ')}`,
          });
          break;
        }
      }
    }
  }

  return actions;
}

/**
 * Get video analysis summary for a case
 */
export async function getVideoAnalysisSummary(caseId: string) {
  const events = await prisma.evidenceEvent.findMany({
    where: { caseId, sourceType: 'bodycam' },
    orderBy: { timestamp: 'asc' },
  });

  const actionCounts: Record<string, number> = {};
  for (const event of events) {
    actionCounts[event.eventType] = (actionCounts[event.eventType] || 0) + 1;
  }

  return {
    caseId,
    totalDetections: events.length,
    actionCounts,
    events,
  };
}
