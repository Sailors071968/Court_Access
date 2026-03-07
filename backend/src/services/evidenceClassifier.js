// ============================================
// Court Access — Evidence Type Classifier
// Phase 121: Evidence Type Classification
//
// Automatically classify uploaded evidence using
// mime-type, filename heuristics, and content inspection.
// ============================================

// ---------------------------------------------------------------------------
// Evidence Categories
// ---------------------------------------------------------------------------

export const EVIDENCE_CATEGORIES = {
  POLICE_REPORT: 'POLICE_REPORT',
  TRANSCRIPT: 'TRANSCRIPT',
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  PHONE_RECORD: 'PHONE_RECORD',
  GPS_LOG: 'GPS_LOG',
  COURT_DOCUMENT: 'COURT_DOCUMENT',
  OTHER: 'OTHER',
};

// ---------------------------------------------------------------------------
// Mime-Type Mapping
// ---------------------------------------------------------------------------

const MIME_TYPE_MAP = {
  'image/jpeg': EVIDENCE_CATEGORIES.PHOTO,
  'image/png': EVIDENCE_CATEGORIES.PHOTO,
  'image/gif': EVIDENCE_CATEGORIES.PHOTO,
  'image/webp': EVIDENCE_CATEGORIES.PHOTO,
  'image/tiff': EVIDENCE_CATEGORIES.PHOTO,
  'image/bmp': EVIDENCE_CATEGORIES.PHOTO,
  'video/mp4': EVIDENCE_CATEGORIES.VIDEO,
  'video/quicktime': EVIDENCE_CATEGORIES.VIDEO,
  'video/x-msvideo': EVIDENCE_CATEGORIES.VIDEO,
  'video/webm': EVIDENCE_CATEGORIES.VIDEO,
  'video/x-matroska': EVIDENCE_CATEGORIES.VIDEO,
  'audio/mpeg': EVIDENCE_CATEGORIES.AUDIO,
  'audio/wav': EVIDENCE_CATEGORIES.AUDIO,
  'audio/ogg': EVIDENCE_CATEGORIES.AUDIO,
  'audio/flac': EVIDENCE_CATEGORIES.AUDIO,
  'audio/mp4': EVIDENCE_CATEGORIES.AUDIO,
  'audio/x-m4a': EVIDENCE_CATEGORIES.AUDIO,
};

// ---------------------------------------------------------------------------
// Filename Heuristics
// ---------------------------------------------------------------------------

const FILENAME_PATTERNS = [
  { pattern: /police[_\-\s]*report/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /incident[_\-\s]*report/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /arrest[_\-\s]*report/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /officer[_\-\s]*report/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /transcript/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /deposition/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /interrogation/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /interview[_\-\s]*record/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /phone[_\-\s]*record/i, category: EVIDENCE_CATEGORIES.PHONE_RECORD },
  { pattern: /call[_\-\s]*log/i, category: EVIDENCE_CATEGORIES.PHONE_RECORD },
  { pattern: /cell[_\-\s]*tower/i, category: EVIDENCE_CATEGORIES.PHONE_RECORD },
  { pattern: /cdr/i, category: EVIDENCE_CATEGORIES.PHONE_RECORD },
  { pattern: /gps[_\-\s]*log/i, category: EVIDENCE_CATEGORIES.GPS_LOG },
  { pattern: /gps[_\-\s]*data/i, category: EVIDENCE_CATEGORIES.GPS_LOG },
  { pattern: /location[_\-\s]*history/i, category: EVIDENCE_CATEGORIES.GPS_LOG },
  { pattern: /geolocation/i, category: EVIDENCE_CATEGORIES.GPS_LOG },
  { pattern: /court[_\-\s]*order/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /motion/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /subpoena/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /warrant/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /indictment/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /plea/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /bodycam/i, category: EVIDENCE_CATEGORIES.VIDEO },
  { pattern: /body[_\-\s]*camera/i, category: EVIDENCE_CATEGORIES.VIDEO },
  { pattern: /surveillance/i, category: EVIDENCE_CATEGORIES.VIDEO },
  { pattern: /dashcam/i, category: EVIDENCE_CATEGORIES.VIDEO },
];

// ---------------------------------------------------------------------------
// Content Inspection Patterns
// ---------------------------------------------------------------------------

const CONTENT_PATTERNS = [
  { pattern: /INCIDENT\s*REPORT/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /REPORTING\s*OFFICER/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /BADGE\s*(?:NO|NUMBER|#)/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /CASE\s*(?:NO|NUMBER|#)\s*:/i, category: EVIDENCE_CATEGORIES.POLICE_REPORT },
  { pattern: /Q:\s*.+\nA:\s*.+/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /TRANSCRIPT\s*OF\s*PROCEEDINGS/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /THE\s*WITNESS:/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /DIRECT\s*EXAMINATION/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /CROSS[\-\s]*EXAMINATION/i, category: EVIDENCE_CATEGORIES.TRANSCRIPT },
  { pattern: /SUPERIOR\s*COURT/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /DISTRICT\s*COURT/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /ORDER\s*(?:OF|TO)\s*(?:THE|SHOW)/i, category: EVIDENCE_CATEGORIES.COURT_DOCUMENT },
  { pattern: /latitude|longitude|lat:|lng:|coordinates/i, category: EVIDENCE_CATEGORIES.GPS_LOG },
  { pattern: /incoming\s*call|outgoing\s*call|duration\s*\(min/i, category: EVIDENCE_CATEGORIES.PHONE_RECORD },
];

// ---------------------------------------------------------------------------
// Main Classifier
// ---------------------------------------------------------------------------

/**
 * Classify evidence based on mime-type, filename, and content.
 *
 * @param {object} params
 * @param {string} params.filename
 * @param {string} params.mimeType
 * @param {string} [params.textContent] - Optional extracted text for content inspection
 * @returns {{ category: string, confidence: number, method: string }}
 */
export function classifyEvidence({ filename, mimeType, textContent = '' }) {
  const scores = {};

  // 1. Mime-type classification (highest confidence for media types)
  if (mimeType && MIME_TYPE_MAP[mimeType]) {
    const cat = MIME_TYPE_MAP[mimeType];
    scores[cat] = (scores[cat] || 0) + 0.9;
  }

  // 2. Filename heuristics
  for (const { pattern, category } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      scores[category] = (scores[category] || 0) + 0.7;
    }
  }

  // 3. Content inspection (if text available)
  if (textContent && textContent.length > 0) {
    for (const { pattern, category } of CONTENT_PATTERNS) {
      if (pattern.test(textContent)) {
        scores[category] = (scores[category] || 0) + 0.6;
      }
    }
  }

  // Find highest scoring category
  let bestCategory = EVIDENCE_CATEGORIES.OTHER;
  let bestScore = 0;
  let method = 'default';

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Determine primary classification method
  if (mimeType && MIME_TYPE_MAP[mimeType] && bestCategory === MIME_TYPE_MAP[mimeType]) {
    method = 'mime_type';
  } else if (bestScore >= 0.6) {
    method = textContent ? 'content_inspection' : 'filename_heuristic';
  }

  // Normalize confidence to 0-1 range
  const confidence = Math.min(bestScore / 1.5, 1.0);

  return {
    category: bestCategory,
    confidence: Math.round(confidence * 100) / 100,
    method,
  };
}

/**
 * Batch classify multiple evidence items.
 * @param {Array<{ filename: string, mimeType: string, textContent?: string }>} items
 * @returns {Array<{ category: string, confidence: number, method: string }>}
 */
export function batchClassify(items) {
  return items.map(item => classifyEvidence(item));
}
