// ============================================
// Court Access — Timeline Builder Service (AI Evidence Intelligence Phase 6)
// Builds visual timeline of events extracted from evidence.
//
// Sources:
//   - Audio timestamps + transcript content
//   - Video timestamps + frame content
//   - Document dates + content
//   - Image EXIF data
//
// Deterministic — same input always produces same output.
// ============================================

import type {
  CaseTimelineEvent,
  TimelineBuilderInput,
  TimelineBuilderResult,
  TimelineEventExtraction,
  TimelineEventCategory,
  TimelineEventSource,
} from '../models/CaseTimelineModel';
import type { AudioTranscript } from '../models/AudioTranscriptModel';
import type { VideoMetadata, VideoFrame } from '../models/VideoAnalysisModel';
import type { ImageExifData } from '../models/ImageAnalysisModel';

// ---------------------------------------------------------------------------
// Timeline Event Builder
// ---------------------------------------------------------------------------

/**
 * Build timeline events from extracted event data.
 * Each extraction becomes a CaseTimelineEvent.
 */
export function buildTimelineEvents(
  input: TimelineBuilderInput
): TimelineBuilderResult {
  try {
    const now = new Date().toISOString();
    const events: CaseTimelineEvent[] = input.extractedEvents.map(
      (extraction, index) => ({
        eventId: `te-${input.evidenceId.replace('ev-', '')}-${String(index).padStart(4, '0')}`,
        caseId: input.caseId,
        tenantId: input.tenantId,
        timestamp: extraction.timestamp,
        sourceEvidenceId: input.evidenceId,
        sourceType: input.sourceType,
        eventDescription: extraction.description,
        eventCategory: extraction.category,
        metadata: extraction.metadata ?? {},
        createdAt: now,
      })
    );

    return {
      success: true,
      eventsCreated: events.length,
      events,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      eventsCreated: 0,
      events: [],
      error: err instanceof Error ? err.message : 'Timeline building failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Audio Timeline Extraction
// ---------------------------------------------------------------------------

/**
 * Extract timeline events from an audio transcript.
 * Creates events for speaker segments that contain date/time references.
 */
export function extractAudioTimelineEvents(
  transcript: AudioTranscript,
  evidenceId: string
): TimelineEventExtraction[] {
  const events: TimelineEventExtraction[] = [];

  // Create an event for the audio recording itself
  if (transcript.duration > 0) {
    events.push({
      timestamp: transcript.processingTimestamp,
      description: `Audio recording analyzed: ${transcript.duration.toFixed(0)}s duration, ${transcript.speakerCount} speaker(s)`,
      category: 'evidence_collected' as TimelineEventCategory,
      metadata: {
        duration: String(transcript.duration),
        speakers: String(transcript.speakerCount),
        language: transcript.language,
      },
    });
  }

  // Extract events from segments mentioning dates/times
  for (const segment of transcript.segments) {
    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})\b/g;
    const matches = segment.transcriptText.match(datePattern);
    if (matches) {
      for (const match of matches) {
        events.push({
          timestamp: transcript.processingTimestamp,
          description: `Date reference in audio at ${segment.startTime.toFixed(1)}s: "${match}" — "${segment.transcriptText.slice(0, 100)}"`,
          category: 'communication' as TimelineEventCategory,
          metadata: {
            speaker: segment.speakerLabel,
            audioTimestamp: String(segment.startTime),
            dateReference: match,
          },
        });
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Video Timeline Extraction
// ---------------------------------------------------------------------------

/**
 * Extract timeline events from video metadata and frames.
 */
export function extractVideoTimelineEvents(
  metadata: VideoMetadata,
  frames: VideoFrame[],
  evidenceId: string
): TimelineEventExtraction[] {
  const events: TimelineEventExtraction[] = [];

  // Video recording event
  events.push({
    timestamp: metadata.createdDate ?? metadata.extractionTimestamp,
    description: `Video evidence: ${metadata.duration.toFixed(0)}s, ${metadata.width}x${metadata.height}, ${metadata.codec}`,
    category: 'evidence_collected' as TimelineEventCategory,
    metadata: {
      duration: String(metadata.duration),
      resolution: `${metadata.width}x${metadata.height}`,
      codec: metadata.codec,
    },
  });

  // Frames with detected text
  for (const frame of frames) {
    if (frame.detectedText && frame.detectedText.trim().length > 0) {
      events.push({
        timestamp: metadata.createdDate ?? metadata.extractionTimestamp,
        description: `Text detected in video frame at ${frame.timestamp.toFixed(1)}s: "${frame.detectedText.slice(0, 100)}"`,
        category: 'evidence_collected' as TimelineEventCategory,
        metadata: {
          videoTimestamp: String(frame.timestamp),
          detectedText: frame.detectedText,
        },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Image Timeline Extraction
// ---------------------------------------------------------------------------

/**
 * Extract timeline events from image EXIF data.
 */
export function extractImageTimelineEvents(
  exifData: ImageExifData | null,
  evidenceId: string
): TimelineEventExtraction[] {
  const events: TimelineEventExtraction[] = [];

  if (exifData?.dateTaken) {
    events.push({
      timestamp: exifData.dateTaken,
      description: `Photo taken${exifData.cameraModel ? ` with ${exifData.cameraMake ?? ''} ${exifData.cameraModel}` : ''}${exifData.gpsLatitude && exifData.gpsLongitude ? ` at GPS (${exifData.gpsLatitude.toFixed(4)}, ${exifData.gpsLongitude.toFixed(4)})` : ''}`,
      category: 'evidence_collected' as TimelineEventCategory,
      metadata: {
        ...(exifData.cameraModel ? { camera: `${exifData.cameraMake ?? ''} ${exifData.cameraModel}` } : {}),
        ...(exifData.gpsLatitude && exifData.gpsLongitude
          ? { gps: `${exifData.gpsLatitude},${exifData.gpsLongitude}` }
          : {}),
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Sort Timeline Events
// ---------------------------------------------------------------------------

/**
 * Sort timeline events by timestamp (ascending).
 * Deterministic — same input always produces same output.
 */
export function sortTimelineEvents(events: CaseTimelineEvent[]): CaseTimelineEvent[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    if (dateA !== dateB) return dateA - dateB;
    // Stable sort by eventId if timestamps are equal
    return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
  });
}
