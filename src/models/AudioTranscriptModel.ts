// ============================================
// Court Access — Audio Transcript Model (AI Evidence Intelligence Phase 2)
// Audio transcription, speaker segmentation, keyword indexing.
//
// Processing pipeline:
//   Upload → Audio normalization → AI transcription
//   → Speaker segmentation → Keyword indexing
//
// Deterministic storage — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Audio Transcript Segment
// ---------------------------------------------------------------------------

/**
 * A single segment of an audio transcript.
 * Represents one speaker's utterance with start/end timestamps.
 */
export interface AudioTranscriptSegment {
  segmentId: string;
  transcriptId: string;
  speakerLabel: string;           // e.g. "Speaker 1", "Speaker 2", or identified name
  startTime: number;              // Seconds from start of audio
  endTime: number;                // Seconds from start of audio
  transcriptText: string;         // Raw transcribed text for this segment
  confidence: number;             // 0–1 transcription confidence (from Whisper/STT engine)
}

// ---------------------------------------------------------------------------
// Audio Transcript Record
// ---------------------------------------------------------------------------

/**
 * Complete audio transcript for an evidence record.
 * Links to EvidenceRecord via evidenceId.
 */
export interface AudioTranscript {
  transcriptId: string;
  evidenceId: string;
  segments: AudioTranscriptSegment[];
  fullText: string;               // Concatenated transcript text
  duration: number;               // Total audio duration in seconds
  speakerCount: number;           // Number of distinct speakers detected
  language: string;               // Detected language (ISO 639-1)
  processingTimestamp: string;    // ISO 8601 — when transcription completed
}

// ---------------------------------------------------------------------------
// Audio Keyword Index
// ---------------------------------------------------------------------------

/**
 * A keyword extracted from an audio transcript.
 * Links back to specific segments where the keyword appears.
 */
export interface AudioKeyword {
  keyword: string;
  occurrences: AudioKeywordOccurrence[];
  totalCount: number;
}

export interface AudioKeywordOccurrence {
  segmentId: string;
  startTime: number;
  endTime: number;
  context: string;                // Surrounding text for context
}

// ---------------------------------------------------------------------------
// Audio Processing Input
// ---------------------------------------------------------------------------

export interface AudioProcessingInput {
  evidenceId: string;
  fileUrl: string;                // Storage URL for the audio file
  mimeType: string;
  language?: string;              // Optional language hint
}

// ---------------------------------------------------------------------------
// Audio Processing Result
// ---------------------------------------------------------------------------

export interface AudioProcessingResult {
  success: boolean;
  transcript: AudioTranscript | null;
  keywords: AudioKeyword[];
  error: string | null;
}
