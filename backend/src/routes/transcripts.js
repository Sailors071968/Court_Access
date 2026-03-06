// ============================================
// Court Access — Phase 52: Media Transcription API
// CRUD + transcription trigger + legal ledger export.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { transcribeMedia, getTranscripts, getCaseTranscripts, searchTranscripts, getTranscriptStatus } from '../services/transcriptionService.js';
import { downloadFile } from '../services/r2Storage.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/transcripts/:caseId — List all transcripts for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { search } = req.query;

    let transcripts;
    if (search) {
      transcripts = await searchTranscripts(caseId, search);
    } else {
      transcripts = await getCaseTranscripts(caseId);
    }

    res.json({ transcripts, count: transcripts.length });
  } catch (err) {
    console.error('[Transcripts] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transcripts/:caseId/evidence/:evidenceId — Get transcript for specific evidence
// ---------------------------------------------------------------------------

router.get('/:caseId/evidence/:evidenceId', async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const transcripts = await getTranscripts(evidenceId);

    const fullTranscript = transcripts.find((t) => t.fullTranscript);
    const segments = transcripts.filter((t) => !t.fullTranscript);

    res.json({
      fullTranscript: fullTranscript || null,
      segments,
      status: fullTranscript?.status || 'none',
    });
  } catch (err) {
    console.error('[Transcripts] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transcripts/:caseId/evidence/:evidenceId/status — Check transcription status
// ---------------------------------------------------------------------------

router.get('/:caseId/evidence/:evidenceId/status', async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const status = await getTranscriptStatus(evidenceId);
    res.json({ evidenceId, status });
  } catch (err) {
    console.error('[Transcripts] Status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/transcripts/:caseId/evidence/:evidenceId/transcribe — Trigger transcription
// ---------------------------------------------------------------------------

router.post('/:caseId/evidence/:evidenceId/transcribe', async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;

    // Get the evidence record
    const evidence = await prisma.evidenceRecord.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Verify it's audio or video
    if (!['audio', 'video'].includes(evidence.evidenceType)) {
      return res.status(400).json({ error: 'Transcription only available for audio/video evidence' });
    }

    // Check if already transcribed
    const existing = await getTranscriptStatus(evidenceId);
    if (existing === 'complete') {
      return res.status(409).json({ error: 'Transcription already exists', status: 'complete' });
    }

    // Download file from R2 for transcription
    let fileBuffer;
    if (evidence.storageKey) {
      fileBuffer = await downloadFile(evidence.storageKey);
    } else {
      return res.status(400).json({ error: 'Evidence file not available in storage' });
    }

    // Start transcription (async)
    const result = await transcribeMedia(fileBuffer, evidence.filename, evidenceId, caseId);

    res.status(201).json({
      transcriptId: result.transcriptId,
      segmentCount: result.segments.length,
      language: result.language,
      status: 'complete',
    });
  } catch (err) {
    console.error('[Transcripts] Transcribe error:', err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transcripts/:caseId/evidence/:evidenceId/legal-ledger — Export as legal format
// ---------------------------------------------------------------------------

router.get('/:caseId/evidence/:evidenceId/legal-ledger', async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;

    const transcripts = await getTranscripts(evidenceId);
    const fullTranscript = transcripts.find((t) => t.fullTranscript);
    const segments = transcripts.filter((t) => !t.fullTranscript);

    if (!fullTranscript) {
      return res.status(404).json({ error: 'No transcript available' });
    }

    // Get evidence metadata
    const evidence = await prisma.evidenceRecord.findUnique({
      where: { id: evidenceId },
    });

    // Get case metadata
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    // Generate legal ledger formatted transcript
    const ledger = generateLegalLedger({
      caseName: caseRecord?.caseName || 'Unknown Case',
      caseNumber: caseRecord?.caseNumber || '',
      evidenceFilename: evidence?.filename || 'Unknown',
      evidenceType: evidence?.evidenceType || 'media',
      transcriptDate: fullTranscript.createdAt,
      language: fullTranscript.language,
      modelVersion: fullTranscript.modelVersion,
      fullText: fullTranscript.transcriptText,
      segments,
    });

    // Return as both JSON and formatted text
    res.json({
      format: 'legal-ledger-8.5x11',
      pageSize: '8.5" x 11"',
      ledger,
    });
  } catch (err) {
    console.error('[Transcripts] Legal ledger error:', err.message);
    res.status(500).json({ error: 'Failed to generate legal ledger' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/transcripts/:caseId/evidence/:evidenceId — Delete all transcripts for evidence
// ---------------------------------------------------------------------------

router.delete('/:caseId/evidence/:evidenceId', async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const deleted = await prisma.mediaTranscript.deleteMany({
      where: { evidenceId },
    });

    res.json({ deleted: deleted.count });
  } catch (err) {
    console.error('[Transcripts] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete transcripts' });
  }
});

// ---------------------------------------------------------------------------
// Legal Ledger Generator — Standard 8.5" x 11" Numbered Ruled Format
// ---------------------------------------------------------------------------

/**
 * Generate a legal ledger formatted transcript.
 * Standard legal format: 8.5" x 11", numbered lines, ruled margins.
 * Line numbers on left margin, 25 lines per page (standard legal).
 */
function generateLegalLedger({ caseName, caseNumber, evidenceFilename, evidenceType, transcriptDate, language, modelVersion, fullText, segments }) {
  const LINES_PER_PAGE = 25;
  const CHARS_PER_LINE = 75; // Standard legal transcript line width
  const date = new Date(transcriptDate);

  // Header block
  const header = {
    title: 'TRANSCRIPT OF PROCEEDINGS',
    caseCaption: caseName.toUpperCase(),
    caseNumber: caseNumber ? `Case No. ${caseNumber}` : '',
    evidenceReference: `Evidence: ${evidenceFilename} (${evidenceType})`,
    transcriptionDate: date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    transcriptionEngine: `Transcription Engine: ${modelVersion}`,
    language: `Language: ${language.toUpperCase()}`,
    pageSize: '8.5" x 11" — Standard Legal Format',
  };

  // Break text into legal-format lines
  const rawLines = [];

  // Use segments if available for timestamped lines, otherwise break full text
  if (segments && segments.length > 0) {
    for (const seg of segments) {
      const timestamp = formatTimestamp(seg.startTime);
      const speaker = seg.speakerLabel ? `${seg.speakerLabel}: ` : '';
      const prefix = `${timestamp}  ${speaker}`;
      const text = seg.transcriptText.trim();

      // Word-wrap each segment into legal lines
      const wrappedLines = wordWrap(text, CHARS_PER_LINE - prefix.length);
      for (let i = 0; i < wrappedLines.length; i++) {
        rawLines.push({
          text: i === 0 ? `${prefix}${wrappedLines[i]}` : `          ${wrappedLines[i]}`,
          timestamp: seg.startTime,
          isTimestamped: i === 0,
        });
      }
    }
  } else {
    // Break full text by sentences, then word-wrap
    const sentences = fullText.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const wrapped = wordWrap(sentence.trim(), CHARS_PER_LINE);
      for (const line of wrapped) {
        rawLines.push({ text: line, timestamp: null, isTimestamped: false });
      }
    }
  }

  // Paginate: 25 lines per page, numbered
  const pages = [];
  let lineNumber = 1;

  for (let i = 0; i < rawLines.length; i += LINES_PER_PAGE) {
    const pageLines = rawLines.slice(i, i + LINES_PER_PAGE);
    const numberedLines = pageLines.map((line, idx) => ({
      lineNumber: lineNumber + idx,
      text: line.text,
      timestamp: line.timestamp,
      isTimestamped: line.isTimestamped,
    }));

    // Pad to 25 lines per page
    while (numberedLines.length < LINES_PER_PAGE) {
      numberedLines.push({
        lineNumber: lineNumber + numberedLines.length,
        text: '',
        timestamp: null,
        isTimestamped: false,
      });
    }

    pages.push({
      pageNumber: pages.length + 1,
      lines: numberedLines,
    });

    lineNumber += LINES_PER_PAGE;
  }

  // Certificate of transcription (final page)
  const certificate = {
    text: 'CERTIFICATE OF TRANSCRIPTION',
    body: `I hereby certify that the foregoing transcript was generated by automated speech recognition technology (${modelVersion}) from the audio/video evidence file "${evidenceFilename}". This transcript has been produced for use in legal proceedings and should be independently verified for accuracy. Total pages: ${pages.length}. Total lines: ${rawLines.length}. Transcription date: ${header.transcriptionDate}.`,
  };

  return {
    header,
    pages,
    certificate,
    metadata: {
      totalPages: pages.length,
      totalLines: rawLines.length,
      linesPerPage: LINES_PER_PAGE,
      charsPerLine: CHARS_PER_LINE,
      segmentCount: segments?.length || 0,
    },
  };
}

/**
 * Word-wrap text to fit within a given line width.
 */
function wordWrap(text, maxWidth) {
  if (!text) return [''];
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

/**
 * Format seconds into HH:MM:SS timestamp.
 */
function formatTimestamp(seconds) {
  if (seconds == null) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default router;
