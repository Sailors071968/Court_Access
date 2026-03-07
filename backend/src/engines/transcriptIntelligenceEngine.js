// ============================================
// Court Access — Transcript Intelligence Engine
// Phase 116: Evidence Intelligence Engine v1
//
// Extends Phase 115 transcript parser with:
// - Speaker tracking (recurring speaker detection)
// - Key testimony extraction (confessions, contradictions, etc.)
// - Statement classification and storage
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Statement Classification Patterns
// ---------------------------------------------------------------------------

const STATEMENT_PATTERNS = {
  confession: [
    /\b(?:I did it|I admit|I confess|guilty|I was (?:the one|responsible)|I killed|I stole|I took|my fault)\b/gi,
    /\b(?:I'm sorry for what I did|I shouldn't have|I regret)\b/gi,
  ],
  contradiction: [
    /\b(?:that's not (?:true|correct|right|what happened)|I disagree|that contradicts|inconsistent with|contrary to)\b/gi,
    /\b(?:actually|in fact|however|on the contrary|but that's not)\b/gi,
    /\b(?:previously (?:stated|testified|said)|earlier you said|you told (?:us|the court|police))\b/gi,
  ],
  timeline_ref: [
    /\b(?:at (?:approximately|about|around)?\s*\d{1,2}:\d{2})\b/gi,
    /\b(?:on (?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})\b/gi,
    /\b(?:that (?:morning|afternoon|evening|night|day)|the next (?:day|morning)|(?:before|after) (?:midnight|noon))\b/gi,
    /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
  ],
  evidence_mention: [
    /\b(?:exhibit\s+[A-Z0-9]+|evidence\s+(?:item|number|#)\s*\S+)\b/gi,
    /\b(?:body\s+camera|surveillance\s+(?:video|footage)|dash\s*cam|recording|photograph|document)\b/gi,
    /\b(?:DNA|fingerprint|blood\s+sample|toxicology|ballistics|forensic)\b/gi,
  ],
  key_testimony: [
    /\b(?:I (?:saw|heard|witnessed|observed|noticed)|I was (?:there|present)|I can (?:identify|confirm))\b/gi,
    /\b(?:the defendant (?:said|did|was)|the victim (?:said|did|was)|the officer (?:said|did|was))\b/gi,
    /\b(?:your honor|objection|sustained|overruled|let the record (?:show|reflect))\b/gi,
  ],
};

// ---------------------------------------------------------------------------
// Speaker Tracking
// ---------------------------------------------------------------------------

/**
 * Track and categorize speakers from transcript segments.
 *
 * @param {Array} segments - Parsed transcript segments
 * @returns {object} Speaker analysis
 */
export function trackSpeakers(segments) {
  const speakers = new Map();

  for (const segment of segments) {
    const speaker = (segment.speaker || 'UNKNOWN').trim();
    if (!speakers.has(speaker)) {
      speakers.set(speaker, {
        name: speaker,
        role: classifySpeakerRole(speaker),
        statementCount: 0,
        firstAppearance: segment.lineNumber || 0,
        lastAppearance: segment.lineNumber || 0,
        totalWords: 0,
      });
    }

    const info = speakers.get(speaker);
    info.statementCount++;
    info.lastAppearance = segment.lineNumber || info.lastAppearance;
    info.totalWords += (segment.dialogue || '').split(/\s+/).length;
  }

  return Array.from(speakers.values()).sort((a, b) => b.statementCount - a.statementCount);
}

/**
 * Classify speaker role based on naming conventions.
 */
function classifySpeakerRole(speaker) {
  const upper = speaker.toUpperCase();

  if (upper.includes('COURT') || upper.includes('JUDGE') || upper.includes('HONOR')) return 'judge';
  if (upper.includes('DEFENDANT') || upper.includes('ACCUSED')) return 'defendant';
  if (upper.includes('WITNESS') || upper.includes('THE WITNESS')) return 'witness';
  if (upper.includes('OFFICER') || upper.includes('DETECTIVE') || upper.includes('SGT') ||
      upper.includes('SERGEANT') || upper.includes('DEPUTY')) return 'law_enforcement';
  if (upper.includes('ATTORNEY') || upper.includes('COUNSEL') || upper.includes('MR.') ||
      upper.includes('MS.') || upper.includes('COUNSELOR')) return 'attorney';
  if (upper.includes('CLERK') || upper.includes('BAILIFF') || upper.includes('REPORTER')) return 'court_staff';
  if (upper.includes('PLAINTIFF') || upper.includes('COMPLAINANT') || upper.includes('VICTIM')) return 'plaintiff';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Key Testimony Extraction
// ---------------------------------------------------------------------------

/**
 * Extract and classify key statements from transcript segments.
 *
 * @param {string} transcriptId
 * @param {string} caseId
 * @param {Array} segments - [{ speaker, dialogue, lineNumber, timestamp }]
 * @returns {object} { statements: [...], summary: {...} }
 */
export async function extractKeyStatements(transcriptId, caseId, segments) {
  console.log(`[TranscriptIntel] Extracting key statements from transcript ${transcriptId}`);

  const statements = [];

  for (const segment of segments) {
    const text = segment.dialogue || '';
    if (text.length < 10) continue;

    // Check each statement pattern category
    for (const [statementType, patterns] of Object.entries(STATEMENT_PATTERNS)) {
      let matched = false;

      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(text)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        statements.push({
          transcriptId,
          caseId,
          speaker: segment.speaker || 'UNKNOWN',
          lineNumber: segment.lineNumber || 0,
          statementText: text.substring(0, 1000),
          statementType,
          confidence: calculateStatementConfidence(text, statementType),
          metadata: {
            timestamp: segment.timestamp || null,
            wordCount: text.split(/\s+/).length,
          },
        });
      }
    }
  }

  // Store statements in database
  if (statements.length > 0) {
    try {
      await prisma.transcriptStatement.createMany({
        data: statements,
        skipDuplicates: true,
      });
      console.log(`[TranscriptIntel] Stored ${statements.length} key statements`);
    } catch (err) {
      console.error(`[TranscriptIntel] Failed to store statements: ${err.message}`);
    }
  }

  // Build summary
  const typeCounts = {};
  for (const s of statements) {
    typeCounts[s.statementType] = (typeCounts[s.statementType] || 0) + 1;
  }

  return {
    statements,
    summary: {
      total: statements.length,
      byType: typeCounts,
      speakers: [...new Set(statements.map(s => s.speaker))],
    },
  };
}

/**
 * Calculate confidence score for a statement classification.
 */
function calculateStatementConfidence(text, statementType) {
  let confidence = 0.6;
  const wordCount = text.split(/\s+/).length;

  // Longer statements with clear indicators get higher confidence
  if (wordCount > 20) confidence += 0.1;
  if (wordCount > 50) confidence += 0.05;

  // Certain types inherently have higher/lower confidence
  if (statementType === 'confession') confidence += 0.15;
  if (statementType === 'contradiction') confidence += 0.1;
  if (statementType === 'evidence_mention') confidence += 0.1;

  return Math.min(1.0, confidence);
}

/**
 * Get all key statements for a case.
 */
export async function getCaseStatements(caseId, filters = {}) {
  const where = { caseId };

  if (filters.speaker) where.speaker = filters.speaker;
  if (filters.statementType) where.statementType = filters.statementType;
  if (filters.transcriptId) where.transcriptId = filters.transcriptId;

  return prisma.transcriptStatement.findMany({
    where,
    orderBy: filters.orderBy || { extractedAt: 'desc' },
    take: filters.limit || 100,
  });
}

/**
 * Get statement summary for a case.
 */
export async function getStatementSummary(caseId) {
  const statements = await prisma.transcriptStatement.findMany({
    where: { caseId },
  });

  const byType = {};
  const bySpeaker = {};

  for (const s of statements) {
    byType[s.statementType] = (byType[s.statementType] || 0) + 1;
    bySpeaker[s.speaker] = (bySpeaker[s.speaker] || 0) + 1;
  }

  return {
    total: statements.length,
    byType,
    bySpeaker,
    highConfidence: statements.filter(s => s.confidence >= 0.8).length,
  };
}
