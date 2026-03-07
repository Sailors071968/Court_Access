// ============================================
// Court Access — Video Processing Service (AI Evidence Intelligence Phase 3)
// Video metadata extraction, frame extraction, OCR, transcription.
//
// Processing pipeline:
//   1. Extract video metadata (duration, resolution, codec)
//   2. Extract frames at configurable intervals
//   3. Extract audio track → transcription
//   4. Run OCR on extracted frames
//   5. Generate timeline markers
//
// Async background worker — does not block upload.
// ============================================

import type {
  VideoMetadata,
  VideoFrame,
  VideoTranscript,
  VideoTimelineMarker,
  VideoProcessingInput,
  VideoProcessingResult,
} from '../models/VideoAnalysisModel';

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_FRAME_INTERVAL = 5; // Extract a frame every 5 seconds

// ---------------------------------------------------------------------------
// Video Metadata Extraction — Integration Point
// ---------------------------------------------------------------------------

/**
 * Extract metadata from a video file.
 * In production, this calls a backend API that uses ffprobe or similar.
 */
export async function extractVideoMetadata(
  evidenceId: string,
  fileUrl: string
): Promise<VideoMetadata> {
  void fileUrl;
  const metadataId = `vm-${evidenceId.replace('ev-', '')}`;

  // Placeholder — will be populated by backend processing
  return {
    metadataId,
    evidenceId,
    duration: 0,
    width: 0,
    height: 0,
    frameRate: 0,
    codec: '',
    audioCodec: null,
    bitrate: 0,
    fileFormat: '',
    createdDate: null,
    extractionTimestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Frame Extraction — Integration Point
// ---------------------------------------------------------------------------

/**
 * Extract frames from a video at specified intervals.
 * In production, uses ffmpeg on the backend to extract frames.
 *
 * @param evidenceId - Evidence record ID
 * @param duration - Total video duration in seconds
 * @param intervalSeconds - Extract a frame every N seconds
 */
export function generateFrameTimestamps(
  duration: number,
  intervalSeconds: number = DEFAULT_FRAME_INTERVAL
): number[] {
  if (duration <= 0 || intervalSeconds <= 0) return [];

  const timestamps: number[] = [];
  for (let t = 0; t < duration; t += intervalSeconds) {
    timestamps.push(t);
  }
  return timestamps;
}

/**
 * Build VideoFrame records for extracted frames.
 * Called after backend frame extraction completes.
 */
export function buildVideoFrames(
  evidenceId: string,
  timestamps: number[],
  storagePaths: string[],
  ocrResults: (string | null)[]
): VideoFrame[] {
  return timestamps.map((timestamp, index) => ({
    frameId: `vf-${evidenceId.replace('ev-', '')}-${String(index).padStart(4, '0')}`,
    evidenceId,
    timestamp,
    imagePath: storagePaths[index] || '',
    detectedText: ocrResults[index] ?? null,
    frameWidth: 0,
    frameHeight: 0,
  }));
}

// ---------------------------------------------------------------------------
// Timeline Marker Generation
// ---------------------------------------------------------------------------

/**
 * Generate timeline markers from video analysis results.
 * Marks text detections, speaker changes, and keyword matches.
 */
export function generateVideoTimelineMarkers(
  evidenceId: string,
  frames: VideoFrame[],
  transcript: VideoTranscript | null
): VideoTimelineMarker[] {
  const markers: VideoTimelineMarker[] = [];
  let markerIndex = 0;

  // Text detection markers from frames
  for (const frame of frames) {
    if (frame.detectedText && frame.detectedText.trim().length > 0) {
      markers.push({
        markerId: `vtm-${evidenceId.replace('ev-', '')}-${String(markerIndex++).padStart(4, '0')}`,
        evidenceId,
        timestamp: frame.timestamp,
        markerType: 'text_detected',
        description: `Text detected: "${frame.detectedText.slice(0, 100)}${frame.detectedText.length > 100 ? '...' : ''}"`,
        frameId: frame.frameId,
      });
    }
  }

  // Speaker change markers from transcript
  if (transcript && transcript.segments.length > 1) {
    let lastSpeaker = transcript.segments[0].speakerLabel;
    for (let i = 1; i < transcript.segments.length; i++) {
      const segment = transcript.segments[i];
      if (segment.speakerLabel !== lastSpeaker) {
        markers.push({
          markerId: `vtm-${evidenceId.replace('ev-', '')}-${String(markerIndex++).padStart(4, '0')}`,
          evidenceId,
          timestamp: segment.startTime,
          markerType: 'speaker_change',
          description: `Speaker changed: ${lastSpeaker} → ${segment.speakerLabel}`,
          frameId: null,
        });
        lastSpeaker = segment.speakerLabel;
      }
    }
  }

  // Sort markers by timestamp
  markers.sort((a, b) => a.timestamp - b.timestamp);

  return markers;
}

// ---------------------------------------------------------------------------
// Video Processing Pipeline — Integration Point
// ---------------------------------------------------------------------------

/**
 * Process a video evidence file.
 * Orchestrates metadata extraction, frame extraction, transcription, and OCR.
 *
 * In production, this dispatches to a backend worker queue.
 * For now, creates placeholder structures the UI can render.
 */
export async function processVideoEvidence(
  input: VideoProcessingInput
): Promise<VideoProcessingResult> {
  try {
    // Step 1: Extract metadata
    const metadata = await extractVideoMetadata(input.evidenceId, input.fileUrl);

    // Step 2: Generate frame timestamps
    const frameTimestamps = generateFrameTimestamps(
      metadata.duration,
      input.frameIntervalSeconds || DEFAULT_FRAME_INTERVAL
    );

    // Step 3: Build placeholder frames (populated after backend extraction)
    const frames = buildVideoFrames(
      input.evidenceId,
      frameTimestamps,
      frameTimestamps.map(() => ''),
      frameTimestamps.map(() => null)
    );

    // Step 4: Create placeholder transcript
    const transcriptId = `vt-${input.evidenceId.replace('ev-', '')}`;
    const transcript: VideoTranscript = {
      transcriptId,
      evidenceId: input.evidenceId,
      segments: [],
      fullText: '',
      duration: metadata.duration,
      speakerCount: 0,
      language: input.language ?? 'en',
      processingTimestamp: new Date().toISOString(),
    };

    // Step 5: Generate timeline markers
    const timelineMarkers = generateVideoTimelineMarkers(
      input.evidenceId,
      frames,
      transcript
    );

    return {
      success: true,
      metadata,
      frames,
      transcript,
      timelineMarkers,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      metadata: null,
      frames: [],
      transcript: null,
      timelineMarkers: [],
      error: err instanceof Error ? err.message : 'Video processing failed',
    };
  }
}
