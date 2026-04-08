// ============================================================================
// Phase B — Transcription Service
// Abstract interface for speech-to-text with mock implementation.
// Real API integration (Whisper, Google STT, Deepgram) deferred to Phase C.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptionWord {
  word: string;
  startSec: number;
  endSec: number;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  language: string;
  durationSec: number;
  confidence: number;
  provider: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audioPath: string, options?: TranscriptionOptions): Promise<TranscriptionResult>;
}

export interface TranscriptionOptions {
  language?: string;
  /** Hint about the expected duration (helps providers allocate resources) */
  expectedDurationSec?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Mock Transcription Provider (Phase B — development/testing only)
// ---------------------------------------------------------------------------

/**
 * Generates placeholder transcription results.
 * In production, this will be replaced by a real provider in Phase C.
 */
class MockTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'mock';

  async transcribe(
    _audioPath: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    const durationSec = options?.expectedDurationSec ?? 30;
    const language = options?.language ?? 'en';

    // Generate realistic-looking placeholder transcript
    const sentences = generateMockSentences(durationSec);
    const words = generateMockWords(sentences, durationSec);
    const text = sentences.join(' ');

    return {
      text,
      words,
      language,
      durationSec,
      confidence: 0.0, // Zero confidence signals this is mock data
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Mock Data Generation
// ---------------------------------------------------------------------------

const MOCK_PHRASES = [
  'The officer approached the vehicle from the driver side.',
  'License and registration please.',
  'Do you know why I pulled you over?',
  'I observed you failing to signal when changing lanes.',
  'Please step out of the vehicle.',
  'I am placing you under arrest.',
  'You have the right to remain silent.',
  'Anything you say can and will be used against you in a court of law.',
  'You have the right to an attorney.',
  'Dispatch, I have a traffic stop at the intersection.',
  'Subject is compliant.',
  'Requesting backup at this location.',
  'The suspect was handcuffed without incident.',
  'Evidence was collected from the scene.',
  'The witness stated they observed the incident.',
];

function generateMockSentences(durationSec: number): string[] {
  const sentenceCount = Math.max(1, Math.floor(durationSec / 5));
  const result: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    result.push(MOCK_PHRASES[i % MOCK_PHRASES.length]);
  }
  return result;
}

function generateMockWords(sentences: string[], durationSec: number): TranscriptionWord[] {
  const allWords = sentences.join(' ').split(' ');
  const wordDuration = durationSec / allWords.length;
  let currentTime = 0;

  return allWords.map((word) => {
    const start = currentTime;
    const end = currentTime + wordDuration;
    currentTime = end;
    return {
      word,
      startSec: Math.round(start * 100) / 100,
      endSec: Math.round(end * 100) / 100,
      confidence: 0.0,
    };
  });
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const providers = new Map<string, TranscriptionProvider>();

// Register the mock provider
providers.set('mock', new MockTranscriptionProvider());

/**
 * Register a custom transcription provider (for Phase C real API integration).
 */
export function registerTranscriptionProvider(provider: TranscriptionProvider): void {
  providers.set(provider.name, provider);
  console.log(`[Transcription] Registered provider: ${provider.name}`);
}

/**
 * Get a transcription provider by name. Falls back to 'mock' if not found.
 */
export function getTranscriptionProvider(name?: string): TranscriptionProvider {
  if (name && providers.has(name)) {
    return providers.get(name)!;
  }
  return providers.get('mock')!;
}

/**
 * Get the currently configured default provider.
 * Reads from TRANSCRIPTION_PROVIDER env var, defaults to 'mock'.
 */
export function getDefaultProvider(): TranscriptionProvider {
  const providerName = process.env.TRANSCRIPTION_PROVIDER ?? 'mock';
  return getTranscriptionProvider(providerName);
}
