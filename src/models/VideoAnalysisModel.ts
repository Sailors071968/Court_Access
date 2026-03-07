// ============================================
// Court Access — Video Analysis Model (AI Evidence Intelligence Phase 3)
// Video metadata extraction, frame extraction, OCR, transcription.
//
// Processing pipeline:
//   Upload → Video metadata extraction → Frame extraction
//   → Audio extraction → Audio transcription → Frame OCR
//
// Deterministic storage — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Video Metadata
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from a video file.
 */
export interface VideoMetadata {
  metadataId: string;
  evidenceId: string;
  duration: number;                // Total duration in seconds
  width: number;                   // Video width in pixels
  height: number;                  // Video height in pixels
  frameRate: number;               // Frames per second
  codec: string;                   // Video codec (e.g. "h264", "vp9")
  audioCodec: string | null;       // Audio codec if present
  bitrate: number;                 // Video bitrate in bps
  fileFormat: string;              // Container format (e.g. "mp4", "mkv")
  createdDate: string | null;      // Original creation date from metadata (ISO 8601)
  extractionTimestamp: string;     // When metadata was extracted (ISO 8601)
}

// ---------------------------------------------------------------------------
// Video Frame Index
// ---------------------------------------------------------------------------

/**
 * A single extracted frame from a video.
 * Frames are extracted at configurable intervals.
 */
export interface VideoFrame {
  frameId: string;
  evidenceId: string;
  timestamp: number;               // Seconds from start of video
  imagePath: string;               // Storage path to extracted frame image
  detectedText: string | null;     // OCR-detected text in this frame
  frameWidth: number;
  frameHeight: number;
}

// ---------------------------------------------------------------------------
// Video Transcript
// ---------------------------------------------------------------------------

/**
 * Transcript extracted from a video's audio track.
 * Reuses the same segment structure as AudioTranscriptModel.
 */
export interface VideoTranscriptSegment {
  segmentId: string;
  transcriptId: string;
  speakerLabel: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  confidence: number;
}

export interface VideoTranscript {
  transcriptId: string;
  evidenceId: string;
  segments: VideoTranscriptSegment[];
  fullText: string;
  duration: number;
  speakerCount: number;
  language: string;
  processingTimestamp: string;
}

// ---------------------------------------------------------------------------
// Video Timeline Marker
// ---------------------------------------------------------------------------

/**
 * A marker on a video timeline indicating a significant event or text detection.
 */
export interface VideoTimelineMarker {
  markerId: string;
  evidenceId: string;
  timestamp: number;
  markerType: 'text_detected' | 'speaker_change' | 'scene_change' | 'keyword_match';
  description: string;
  frameId: string | null;          // Associated frame if applicable
}

// ---------------------------------------------------------------------------
// Video Processing Input/Result
// ---------------------------------------------------------------------------

export interface VideoProcessingInput {
  evidenceId: string;
  fileUrl: string;
  mimeType: string;
  frameIntervalSeconds: number;    // Extract a frame every N seconds (default: 5)
  language?: string;
}

export interface VideoProcessingResult {
  success: boolean;
  metadata: VideoMetadata | null;
  frames: VideoFrame[];
  transcript: VideoTranscript | null;
  timelineMarkers: VideoTimelineMarker[];
  error: string | null;
}
