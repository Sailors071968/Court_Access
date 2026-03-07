// ============================================
// Court Access — Audio Processing Service (AI Evidence Intelligence Phase 2)
// Audio transcription, speaker segmentation, keyword indexing.
//
// Processing pipeline:
//   1. Validate audio file
//   2. Send to transcription API (OpenAI Whisper)
//   3. Segment by speaker
//   4. Extract keywords
//   5. Build AudioTranscript + AudioKeyword records
//
// Async background worker — does not block upload.
// ============================================

import type {
  AudioTranscript,
  AudioTranscriptSegment,
  AudioKeyword,
  AudioKeywordOccurrence,
  AudioProcessingInput,
  AudioProcessingResult,
} from '../models/AudioTranscriptModel';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KEYWORD_MIN_LENGTH = 3;
const KEYWORD_CONTEXT_CHARS = 80;

// ---------------------------------------------------------------------------
// Keyword Extraction — Deterministic
// ---------------------------------------------------------------------------

/**
 * Extract keywords from transcript segments.
 * Filters common stop words, groups by keyword, and counts occurrences.
 *
 * Deterministic — same input always produces same output.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'was', 'are', 'were', 'be',
  'has', 'had', 'have', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'not',
  'no', 'yes', 'so', 'if', 'then', 'than', 'just', 'also', 'very',
  'too', 'up', 'out', 'about', 'into', 'over', 'after', 'before',
]);

export function extractKeywords(segments: AudioTranscriptSegment[]): AudioKeyword[] {
  const keywordMap = new Map<string, AudioKeywordOccurrence[]>();

  for (const segment of segments) {
    const words = segment.transcriptText
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= KEYWORD_MIN_LENGTH && !STOP_WORDS.has(w));

    for (const word of words) {
      const normalized = word.toLowerCase();
      if (!keywordMap.has(normalized)) {
        keywordMap.set(normalized, []);
      }

      // Extract context around the word
      const idx = segment.transcriptText.toLowerCase().indexOf(normalized);
      const contextStart = Math.max(0, idx - KEYWORD_CONTEXT_CHARS);
      const contextEnd = Math.min(segment.transcriptText.length, idx + normalized.length + KEYWORD_CONTEXT_CHARS);
      const context = segment.transcriptText.slice(contextStart, contextEnd).trim();

      const occurrences = keywordMap.get(normalized);
      if (occurrences) {
        occurrences.push({
          segmentId: segment.segmentId,
          startTime: segment.startTime,
          endTime: segment.endTime,
          context,
        });
      }
    }
  }

  // Sort keywords by total occurrences (descending)
  const keywords: AudioKeyword[] = [];
  for (const [keyword, occurrences] of keywordMap.entries()) {
    keywords.push({
      keyword,
      occurrences,
      totalCount: occurrences.length,
    });
  }

  keywords.sort((a, b) => b.totalCount - a.totalCount);

  return keywords;
}

// ---------------------------------------------------------------------------
// Transcript Builder — Simulated (API integration point)
// ---------------------------------------------------------------------------

/**
 * Build an AudioTranscript from transcription API response.
 * This is the integration point for OpenAI Whisper or equivalent.
 *
 * In production, this calls the transcription API.
 * For now, it creates a placeholder structure that the UI can render.
 */
export async function processAudioEvidence(
  input: AudioProcessingInput
): Promise<AudioProcessingResult> {
  try {
    // In production: call OpenAI Whisper API here
    // const response = await fetch('/api/transcribe', { ... });
    // For now, create a processing placeholder

    const transcriptId = `at-${input.evidenceId.replace('ev-', '')}`;

    // Create initial transcript structure (will be populated by API)
    const transcript: AudioTranscript = {
      transcriptId,
      evidenceId: input.evidenceId,
      segments: [],
      fullText: '',
      duration: 0,
      speakerCount: 0,
      language: input.language ?? 'en',
      processingTimestamp: new Date().toISOString(),
    };

    return {
      success: true,
      transcript,
      keywords: [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      transcript: null,
      keywords: [],
      error: err instanceof Error ? err.message : 'Audio processing failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Search Transcript
// ---------------------------------------------------------------------------

/**
 * Search within an audio transcript for a query string.
 * Returns matching segments with timestamps.
 *
 * Deterministic — same input always produces same output.
 */
export function searchTranscript(
  transcript: AudioTranscript,
  query: string
): AudioTranscriptSegment[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length === 0) return [];

  return transcript.segments.filter((segment) =>
    segment.transcriptText.toLowerCase().includes(normalizedQuery)
  );
}
