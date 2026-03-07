// ============================================
// Court Access — Transcription Worker
// Phase 122: Audio/Video Transcription Engine
//
// Steps: 1) extract audio, 2) transcribe via Whisper,
// 3) segment speakers, 4) convert to legal ledger format.
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINES_PER_PAGE = 25;
const CHARS_PER_LINE = 75;

// ---------------------------------------------------------------------------
// Main Transcription Pipeline
// ---------------------------------------------------------------------------

/**
 * Process a media file through the full transcription pipeline.
 *
 * @param {object} params
 * @param {string} params.evidenceId
 * @param {string} params.caseId
 * @param {Array<{ start: number, end: number, text: string, speaker?: string }>} params.segments - Pre-transcribed segments
 * @returns {object} { segments: TranscriptSegment[], pageCount: number }
 */
export async function processTranscription({ evidenceId, caseId, segments }) {
  console.log(`[TranscriptionWorker] Processing transcription for evidence=${evidenceId}, case=${caseId}`);

  // Step 3: Segment speakers (assign labels if not provided)
  const labeledSegments = assignSpeakerLabels(segments);

  // Step 4: Convert to legal ledger format (page + line numbers)
  const ledgerSegments = convertToLedgerFormat(labeledSegments);

  // Store in database
  const stored = [];
  for (const seg of ledgerSegments) {
    const record = await prisma.transcriptSegment.create({
      data: {
        caseId,
        evidenceId,
        speaker: seg.speaker,
        page: seg.page,
        line: seg.line,
        timestamp: seg.timestamp,
        text: seg.text,
        confidence: seg.confidence,
        metadata: seg.metadata || {},
      },
    });
    stored.push(record);
  }

  const pageCount = ledgerSegments.length > 0
    ? ledgerSegments[ledgerSegments.length - 1].page
    : 0;

  console.log(`[TranscriptionWorker] Created ${stored.length} segments across ${pageCount} pages`);

  return {
    segments: stored,
    pageCount,
    totalLines: stored.length,
  };
}

// ---------------------------------------------------------------------------
// Speaker Label Assignment
// ---------------------------------------------------------------------------

/**
 * Assign speaker labels to segments that don't have them.
 * Uses heuristic: alternating speakers based on pauses.
 */
function assignSpeakerLabels(segments) {
  let speakerIndex = 0;
  const speakerMap = new Map();
  let lastSpeaker = null;

  return segments.map((seg, idx) => {
    let speaker = seg.speaker || '';

    if (!speaker) {
      // Heuristic: if gap > 2 seconds between segments, likely new speaker
      const prevEnd = idx > 0 ? segments[idx - 1].end : 0;
      const gap = seg.start - prevEnd;

      if (gap > 2.0 && lastSpeaker !== null) {
        speakerIndex++;
      }

      speaker = `Speaker ${(speakerIndex % 2) + 1}`;
    }

    if (!speakerMap.has(speaker)) {
      speakerMap.set(speaker, speakerMap.size + 1);
    }

    lastSpeaker = speaker;

    return {
      ...seg,
      speaker,
    };
  });
}

// ---------------------------------------------------------------------------
// Legal Ledger Format Conversion
// ---------------------------------------------------------------------------

/**
 * Convert transcribed segments into legal ledger format:
 * Page N, Line NN, Speaker: text
 *
 * Output format example:
 *   Page 12
 *   Line 01  Officer Ramirez: What time did you arrive?
 *   Line 02  Witness: Around 10:05 PM.
 */
function convertToLedgerFormat(segments) {
  const ledgerLines = [];
  let currentPage = 1;
  let currentLine = 1;

  for (const seg of segments) {
    const prefix = `${seg.speaker}: `;
    const fullText = seg.text.trim();

    // Word-wrap to CHARS_PER_LINE
    const wrappedLines = wordWrap(prefix + fullText, CHARS_PER_LINE);

    for (let i = 0; i < wrappedLines.length; i++) {
      ledgerLines.push({
        speaker: seg.speaker,
        page: currentPage,
        line: currentLine,
        timestamp: seg.start || 0,
        text: i === 0 ? wrappedLines[i] : `  ${wrappedLines[i]}`, // indent continuation
        confidence: seg.confidence || 0,
        metadata: i === 0 ? { startTime: seg.start, endTime: seg.end } : {},
      });

      currentLine++;
      if (currentLine > LINES_PER_PAGE) {
        currentLine = 1;
        currentPage++;
      }
    }
  }

  return ledgerLines;
}

/**
 * Word-wrap text to a maximum line width.
 */
function wordWrap(text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [''];
}

// ---------------------------------------------------------------------------
// Retrieve Transcript Pages
// ---------------------------------------------------------------------------

/**
 * Get transcript segments for a specific page.
 * @param {string} caseId
 * @param {string} evidenceId
 * @param {number} page
 * @returns {object[]}
 */
export async function getTranscriptPage(caseId, evidenceId, page) {
  return prisma.transcriptSegment.findMany({
    where: { caseId, evidenceId, page },
    orderBy: { line: 'asc' },
  });
}

/**
 * Get full transcript for an evidence item.
 * @param {string} caseId
 * @param {string} evidenceId
 * @returns {object[]}
 */
export async function getFullTranscript(caseId, evidenceId) {
  return prisma.transcriptSegment.findMany({
    where: { caseId, evidenceId },
    orderBy: [{ page: 'asc' }, { line: 'asc' }],
  });
}

/**
 * Search transcript by keyword.
 * @param {string} caseId
 * @param {string} evidenceId
 * @param {string} keyword
 * @returns {object[]}
 */
export async function searchTranscript(caseId, evidenceId, keyword) {
  return prisma.transcriptSegment.findMany({
    where: {
      caseId,
      evidenceId,
      text: { contains: keyword, mode: 'insensitive' },
    },
    orderBy: [{ page: 'asc' }, { line: 'asc' }],
  });
}
