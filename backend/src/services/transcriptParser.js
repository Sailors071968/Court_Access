// ============================================
// Court Access — Transcript Parsing Engine (Foundation)
// Phase 115: Structured transcript ingestion
//
// Supported formats:
// - Court reporter PDFs (line-numbered)
// - Multi-column transcripts
// - Line-numbered transcripts
//
// Extracts:
// - speaker
// - timestamp (if present)
// - line number
// - dialogue
//
// Output: structured transcript JSON
// ============================================

/**
 * Parse a raw transcript text into structured segments.
 *
 * @param {string} rawText - The raw transcript text
 * @param {object} options - Parsing options
 * @param {string} options.format - 'court_reporter' | 'multi_column' | 'line_numbered' | 'auto'
 * @returns {{ segments: Array, metadata: object }}
 */
export function parseTranscript(rawText, options = {}) {
  const { format = 'auto' } = options;

  if (!rawText || rawText.trim().length === 0) {
    return { segments: [], metadata: { format: 'empty', lineCount: 0, speakerCount: 0 } };
  }

  const lines = rawText.split('\n');
  const detectedFormat = format === 'auto' ? detectFormat(lines) : format;

  let segments;
  switch (detectedFormat) {
    case 'court_reporter':
      segments = parseCourtReporterFormat(lines);
      break;
    case 'multi_column':
      segments = parseMultiColumnFormat(lines);
      break;
    case 'line_numbered':
      segments = parseLineNumberedFormat(lines);
      break;
    default:
      segments = parseGenericFormat(lines);
  }

  // Extract unique speakers
  const speakers = [...new Set(segments.map(s => s.speaker).filter(Boolean))];

  return {
    segments,
    metadata: {
      format: detectedFormat,
      lineCount: lines.length,
      segmentCount: segments.length,
      speakerCount: speakers.length,
      speakers,
    },
  };
}

/**
 * Detect the transcript format from the first N lines.
 */
function detectFormat(lines) {
  const sample = lines.slice(0, 50).join('\n');

  // Court reporter format: line numbers in left margin, page breaks
  if (/^\s*\d{1,2}\s{2,}/.test(sample) && /PAGE\s+\d+/i.test(sample)) {
    return 'court_reporter';
  }

  // Line-numbered format: starts with line numbers
  const lineNumberedCount = lines.slice(0, 20).filter(l => /^\s*\d+\s+/.test(l)).length;
  if (lineNumberedCount > 10) {
    return 'line_numbered';
  }

  // Multi-column: tab-separated or fixed-width columns
  const tabCount = lines.slice(0, 20).filter(l => l.includes('\t') && l.split('\t').length >= 3).length;
  if (tabCount > 5) {
    return 'multi_column';
  }

  return 'generic';
}

/**
 * Parse court reporter format transcripts.
 * Format: line numbers in left margin, speaker names in CAPS followed by colon.
 *
 * Example:
 *  1   THE COURT: Good morning.
 *  2   MR. SMITH: Good morning, Your Honor.
 */
function parseCourtReporterFormat(lines) {
  const segments = [];
  let currentSpeaker = '';
  let currentDialogue = '';
  let currentLineNumber = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Extract line number if present
    const lineNumMatch = trimmed.match(/^(\d+)\s+(.*)/);
    const content = lineNumMatch ? lineNumMatch[2] : trimmed;
    const lineNum = lineNumMatch ? parseInt(lineNumMatch[1], 10) : ++currentLineNumber;

    // Detect speaker change (UPPERCASE NAME followed by colon)
    const speakerMatch = content.match(/^([A-Z][A-Z.\s]+[A-Z]):\s*(.*)/);

    if (speakerMatch) {
      // Save previous segment
      if (currentSpeaker && currentDialogue.trim()) {
        segments.push({
          lineNumber: currentLineNumber,
          speaker: currentSpeaker.trim(),
          dialogue: currentDialogue.trim(),
          timestamp: null,
        });
      }

      currentSpeaker = speakerMatch[1];
      currentDialogue = speakerMatch[2] || '';
      currentLineNumber = lineNum;
    } else {
      // Continuation of current speaker's dialogue
      currentDialogue += ' ' + content;
    }
  }

  // Push last segment
  if (currentSpeaker && currentDialogue.trim()) {
    segments.push({
      lineNumber: currentLineNumber,
      speaker: currentSpeaker.trim(),
      dialogue: currentDialogue.trim(),
      timestamp: null,
    });
  }

  return segments;
}

/**
 * Parse line-numbered transcript format.
 * Each line starts with a number.
 */
function parseLineNumberedFormat(lines) {
  const segments = [];
  let currentSpeaker = '';
  let currentDialogue = '';
  let startLineNum = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Extract line number
    const match = trimmed.match(/^(\d+)\s+(.*)/);
    if (!match) continue;

    const lineNum = parseInt(match[1], 10);
    const content = match[2];

    // Check for speaker label
    const speakerMatch = content.match(/^([A-Z][A-Za-z.\s]+):\s*(.*)/);

    if (speakerMatch) {
      if (currentSpeaker && currentDialogue.trim()) {
        segments.push({
          lineNumber: startLineNum,
          speaker: currentSpeaker.trim(),
          dialogue: currentDialogue.trim(),
          timestamp: null,
        });
      }
      currentSpeaker = speakerMatch[1];
      currentDialogue = speakerMatch[2] || '';
      startLineNum = lineNum;
    } else {
      currentDialogue += ' ' + content;
    }
  }

  if (currentSpeaker && currentDialogue.trim()) {
    segments.push({
      lineNumber: startLineNum,
      speaker: currentSpeaker.trim(),
      dialogue: currentDialogue.trim(),
      timestamp: null,
    });
  }

  return segments;
}

/**
 * Parse multi-column format (tab-separated: timestamp, speaker, dialogue).
 */
function parseMultiColumnFormat(lines) {
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const columns = trimmed.split('\t').map(c => c.trim()).filter(Boolean);
    if (columns.length < 2) continue;

    // Try: [timestamp, speaker, dialogue] or [speaker, dialogue]
    let timestamp = null;
    let speaker = '';
    let dialogue = '';

    if (columns.length >= 3 && /^\d{1,2}:\d{2}/.test(columns[0])) {
      timestamp = columns[0];
      speaker = columns[1];
      dialogue = columns.slice(2).join(' ');
    } else {
      speaker = columns[0];
      dialogue = columns.slice(1).join(' ');
    }

    segments.push({
      lineNumber: i + 1,
      speaker,
      dialogue,
      timestamp,
    });
  }

  return segments;
}

/**
 * Parse generic transcript format.
 * Looks for "Speaker: dialogue" patterns.
 */
function parseGenericFormat(lines) {
  const segments = [];
  let currentSpeaker = '';
  let currentDialogue = '';
  let currentTimestamp = null;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Check for timestamp prefix (e.g., "10:02:14 AM")
    const tsMatch = trimmed.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s+(.*)/i);
    const content = tsMatch ? tsMatch[2] : trimmed;
    const timestamp = tsMatch ? tsMatch[1] : null;

    // Check for speaker label
    const speakerMatch = content.match(/^([A-Z][A-Za-z.\s]+):\s*(.*)/);

    if (speakerMatch) {
      if (currentSpeaker && currentDialogue.trim()) {
        segments.push({
          lineNumber: startLine,
          speaker: currentSpeaker.trim(),
          dialogue: currentDialogue.trim(),
          timestamp: currentTimestamp,
        });
      }
      currentSpeaker = speakerMatch[1];
      currentDialogue = speakerMatch[2] || '';
      currentTimestamp = timestamp;
      startLine = i + 1;
    } else {
      currentDialogue += ' ' + content;
      if (timestamp && !currentTimestamp) {
        currentTimestamp = timestamp;
      }
    }
  }

  if (currentSpeaker && currentDialogue.trim()) {
    segments.push({
      lineNumber: startLine,
      speaker: currentSpeaker.trim(),
      dialogue: currentDialogue.trim(),
      timestamp: currentTimestamp,
    });
  }

  return segments;
}

/**
 * Convert parsed segments to legal ledger format (8.5" x 11" numbered ruled).
 *
 * @param {Array} segments - Parsed transcript segments
 * @returns {string} Formatted ledger text
 */
export function toLegalLedger(segments) {
  const lines = [];
  let lineNum = 1;

  lines.push(`${'='.repeat(72)}`);
  lines.push('CERTIFIED TRANSCRIPT — COURT ACCESS PLATFORM');
  lines.push(`${'='.repeat(72)}`);
  lines.push('');

  for (const seg of segments) {
    const header = `${String(lineNum).padStart(4)}  ${seg.speaker}:`;
    lines.push(header);
    lineNum++;

    // Word-wrap dialogue at 65 characters
    const words = seg.dialogue.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      if (currentLine.length + word.length + 1 > 65) {
        lines.push(`${String(lineNum).padStart(4)}      ${currentLine.trim()}`);
        lineNum++;
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine.trim()) {
      lines.push(`${String(lineNum).padStart(4)}      ${currentLine.trim()}`);
      lineNum++;
    }
    lines.push('');
    lineNum++;
  }

  lines.push(`${'='.repeat(72)}`);
  lines.push(`Total lines: ${lineNum - 1}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`${'='.repeat(72)}`);

  return lines.join('\n');
}
