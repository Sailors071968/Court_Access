// ============================================================================
// Discovery document classification.
//
// Discovery arrives as a mixed pile: a producing party sends one folder with
// reports, transcripts, warrants, lab results and photographs together, often
// with unhelpful names like "Doc001.pdf". Requiring the user to separate it by
// hand defeats the purpose, so each file is classified from what it contains,
// falling back to its name only as a weak signal.
//
// A classifier that guesses is worse than one that abstains: a preliminary
// hearing transcript filed as a police report will be cited wrongly. Anything
// the evidence does not clearly support is returned as 'unknown'.
// ============================================================================

export type DocumentClass =
  | 'complaint'
  | 'police_report'
  | 'supplemental_report'
  | 'investigation_report'
  | 'officer_narrative'
  | 'search_warrant'
  | 'search_warrant_affidavit'
  | 'search_warrant_return'
  | 'cad_report'
  | 'dispatch_log'
  | 'laboratory_report'
  | 'dna_report'
  | 'medical_report'
  | 'hospital_report'
  | 'doctor_report'
  | 'psychological_evaluation'
  | 'preliminary_hearing_transcript'
  | 'trial_transcript'
  | 'minute_order'
  | 'court_filing'
  | 'photograph'
  | 'financial_records'
  | 'expert_report'
  | 'video'
  | 'audio'
  | 'unknown';

export interface Classification {
  classification: DocumentClass;
  /** 0–1. Only scores at or above CONFIDENCE_FLOOR are reported as a class. */
  confidence: number;
  /** What drove the decision, so a reviewer can check it. */
  basis: string;
}

/** Below this the file is reported as unknown rather than guessed at. */
export const CONFIDENCE_FLOOR = 0.4;

interface Rule {
  cls: DocumentClass;
  /** Phrases in the document text. Weighted highest — this is the evidence. */
  content: RegExp[];
  /** Hints in the file or folder name. Weak on their own. */
  name?: RegExp[];
  /**
   * Phrases that rule the class out even when others match, used where two
   * classes share vocabulary (a warrant return is not the warrant itself).
   */
  not?: RegExp[];
  /** Raises a class above others that share vocabulary. */
  priority?: number;
}

// Ordered by specificity: a supplemental report also reads as a police report,
// so the more specific rule has to be able to win.
const RULES: Rule[] = [
  {
    cls: 'preliminary_hearing_transcript',
    content: [/preliminary\s+hearing/i, /reporter'?s\s+transcript/i, /\bTHE\s+COURT:/],
    name: [/prelim/i, /\bph\b/i],
    priority: 3,
  },
  {
    cls: 'trial_transcript',
    content: [/trial\s+transcript/i, /jury\s+trial/i, /\bTHE\s+COURT:/, /direct\s+examination/i],
    not: [/preliminary\s+hearing/i],
    name: [/trial/i, /transcript/i],
    priority: 3,
  },
  {
    cls: 'search_warrant_return',
    content: [/search\s+warrant\s+return/i, /return\s+to\s+search\s+warrant/i, /property\s+seized/i],
    name: [/return/i],
    priority: 4,
  },
  {
    cls: 'search_warrant_affidavit',
    content: [/affidavit\s+in\s+support/i, /statement\s+of\s+probable\s+cause/i, /being\s+duly\s+sworn/i],
    name: [/affidavit/i],
    priority: 4,
  },
  {
    cls: 'search_warrant',
    content: [/search\s+warrant/i, /premises\s+to\s+be\s+searched/i, /property\s+to\s+be\s+seized/i],
    not: [/search\s+warrant\s+return/i, /affidavit\s+in\s+support/i],
    name: [/warrant/i, /\bsw\b/i],
    priority: 2,
  },
  {
    cls: 'dna_report',
    content: [/\bDNA\b/, /short\s+tandem\s+repeat/i, /\bSTR\b\s+(profile|analysis)/i, /codis/i],
    name: [/dna/i],
    priority: 4,
  },
  {
    cls: 'laboratory_report',
    content: [/(crime\s+)?laborator(y|ies)\s+report/i, /forensic\s+biology/i, /criminalist/i, /presumptive\s+test/i, /toxicolog/i],
    name: [/\blab\b/i, /forensic/i, /tox/i],
    priority: 2,
  },
  {
    cls: 'psychological_evaluation',
    content: [/psychological\s+evaluation/i, /mental\s+status\s+exam/i, /competency\s+(to\s+stand\s+trial|evaluation)/i, /\bDSM-5\b/],
    name: [/psych/i, /competenc/i],
    priority: 4,
  },
  {
    cls: 'hospital_report',
    content: [/emergency\s+department/i, /\bhospital\b/i, /admission\s+(record|note)/i, /discharge\s+summary/i],
    name: [/hospital/i, /\ber\b/i],
    priority: 3,
  },
  {
    cls: 'doctor_report',
    content: [/physician'?s\s+(report|statement)/i, /attending\s+physician/i, /\bMD\b.*(report|opinion)/i],
    name: [/physician/i, /doctor/i],
    priority: 3,
  },
  {
    cls: 'medical_report',
    content: [/medical\s+record/i, /chief\s+complaint/i, /diagnosis/i, /treatment\s+plan/i, /\bpatient\b/i],
    name: [/medical/i, /\bmed\b/i],
    priority: 1,
  },
  {
    cls: 'cad_report',
    content: [/\bCAD\b\s*(report|log|incident)/i, /computer[-\s]aided\s+dispatch/i],
    name: [/\bcad\b/i],
    priority: 4,
  },
  {
    cls: 'dispatch_log',
    content: [/dispatch\s+log/i, /unit\s+(assigned|on\s+scene)/i, /call\s+received/i, /incident\s+closed/i],
    name: [/dispatch/i],
    priority: 3,
  },
  {
    cls: 'supplemental_report',
    content: [/supplement(al)?\s+report/i, /supplemental\s+narrative/i],
    name: [/supp/i],
    priority: 4,
  },
  {
    cls: 'investigation_report',
    content: [/investigation\s+report/i, /investigative\s+summary/i, /follow[-\s]up\s+investigation/i],
    name: [/investigat/i],
    priority: 3,
  },
  {
    cls: 'officer_narrative',
    content: [/officer'?s\s+narrative/i, /^\s*narrative:/im],
    name: [/narrative/i],
    priority: 2,
  },
  {
    cls: 'police_report',
    content: [/police\s+department/i, /incident\s+report/i, /report\s+number/i, /reporting\s+officer/i, /\bbadge\b/i],
    not: [/supplement(al)?\s+report/i],
    name: [/police/i, /incident/i, /\brpt\b/i],
    priority: 1,
  },
  {
    cls: 'complaint',
    content: [/criminal\s+complaint/i, /the\s+people\s+of\s+the\s+state\s+of\s+california\s+.{0,40}\bplaintiff/i, /count\s+(one|1|i)\b.{0,80}violation/i],
    name: [/complaint/i],
    priority: 3,
  },
  {
    cls: 'minute_order',
    content: [/minute\s+order/i, /minutes\s+of\s+the\s+court/i, /matter\s+continued\s+to/i],
    name: [/minute/i],
    priority: 4,
  },
  {
    cls: 'expert_report',
    content: [/expert\s+(witness\s+)?report/i, /retained\s+by/i, /scope\s+of\s+engagement/i, /\bopinion\s+\d/i, /curriculum\s+vitae/i],
    name: [/expert/i],
    priority: 3,
  },
  {
    cls: 'financial_records',
    content: [/account\s+statement/i, /transaction\s+history/i, /\bdeposit\b.*\bwithdrawal\b/i, /routing\s+number/i],
    name: [/financ/i, /bank/i, /statement/i],
    priority: 3,
  },
  {
    cls: 'court_filing',
    content: [/superior\s+court\s+of\s+california/i, /notice\s+of\s+motion/i, /points\s+and\s+authorities/i, /declaration\s+of/i],
    not: [/reporter'?s\s+transcript/i, /minute\s+order/i],
    name: [/motion/i, /filing/i, /pleading/i],
    priority: 1,
  },
];

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'webp']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg']);

export interface ClassifierInput {
  fileName: string;
  /** Folder path relative to the import root; often carries the best hint. */
  relativePath?: string;
  /** Extracted text, when the file produced any. */
  text?: string | null;
  mimeType?: string | null;
}

/**
 * Decide what a discovery document is. Content evidence dominates; the file
 * and folder name can only break ties or nudge a borderline score.
 */
export function classifyDocument(input: ClassifierInput): Classification {
  const ext = (input.fileName.split('.').pop() ?? '').toLowerCase();
  const haystackName = `${input.relativePath ?? ''} ${input.fileName}`.toLowerCase();

  // Media is classified by what it is, not by what it says.
  if (VIDEO_EXT.has(ext) || (input.mimeType ?? '').startsWith('video/')) {
    return { classification: 'video', confidence: 1, basis: `file extension .${ext}` };
  }
  if (AUDIO_EXT.has(ext) || (input.mimeType ?? '').startsWith('audio/')) {
    return { classification: 'audio', confidence: 1, basis: `file extension .${ext}` };
  }

  const text = (input.text ?? '').slice(0, 20000);

  if (IMAGE_EXT.has(ext) || (input.mimeType ?? '').startsWith('image/')) {
    // A scanned document is an image carrying a document; only treat it as a
    // photograph when OCR found nothing that reads like one.
    if (text.trim().length < 120) {
      return { classification: 'photograph', confidence: 0.9, basis: 'image with no recognisable document text' };
    }
  }

  if (text.trim().length === 0) {
    return {
      classification: 'unknown',
      confidence: 0,
      basis: 'no text was extracted, so the document could not be classified from its contents',
    };
  }

  let best: { rule: Rule; score: number; hits: string[] } | null = null;

  for (const rule of RULES) {
    if (rule.not?.some((re) => re.test(text))) continue;

    const contentHits = rule.content.filter((re) => re.test(text));
    if (contentHits.length === 0) continue;

    const nameHit = rule.name?.some((re) => re.test(haystackName)) ?? false;

    // Each matching phrase is a piece of evidence; the name adds a little.
    let score = Math.min(0.35 + contentHits.length * 0.2, 0.95);
    if (nameHit) score = Math.min(score + 0.1, 0.98);
    score += (rule.priority ?? 0) * 0.01;

    if (!best || score > best.score) {
      best = {
        rule,
        score,
        hits: contentHits.map((re) => re.source.slice(0, 40)),
      };
    }
  }

  if (!best || best.score < CONFIDENCE_FLOOR) {
    return {
      classification: 'unknown',
      confidence: best?.score ?? 0,
      basis: best
        ? `closest match was ${best.rule.cls} but the evidence was too weak to report it`
        : 'no classification rule matched the document text',
    };
  }

  return {
    classification: best.rule.cls,
    confidence: Math.round(Math.min(best.score, 1) * 100) / 100,
    basis: `matched ${best.hits.length} phrase(s) in the document text: ${best.hits.join(', ')}`,
  };
}

/** The evidenceType the production pipeline stores, derived from the class. */
export function evidenceTypeFor(classification: DocumentClass, fileName: string): string {
  switch (classification) {
    case 'preliminary_hearing_transcript':
    case 'trial_transcript':
      return 'transcript';
    case 'police_report':
    case 'supplemental_report':
    case 'officer_narrative':
    case 'investigation_report':
      return 'police_report';
    case 'cad_report':
    case 'dispatch_log':
      return 'dispatch_log';
    case 'laboratory_report':
    case 'dna_report':
    case 'expert_report':
      return 'forensic_report';
    case 'photograph':
      return 'photo';
    case 'video':
      return /bodycam|body[-_\s]?worn|bwc/i.test(fileName)
        ? 'bodycam'
        : /dash/i.test(fileName)
          ? 'dashcam'
          : 'witness_video';
    default:
      return 'other_document';
  }
}

export const DOCUMENT_CLASSES: DocumentClass[] = [
  'complaint', 'police_report', 'supplemental_report', 'investigation_report',
  'officer_narrative', 'search_warrant', 'search_warrant_affidavit',
  'search_warrant_return', 'cad_report', 'dispatch_log', 'laboratory_report',
  'dna_report', 'medical_report', 'hospital_report', 'doctor_report',
  'psychological_evaluation', 'preliminary_hearing_transcript',
  'trial_transcript', 'minute_order', 'court_filing', 'photograph',
  'financial_records', 'expert_report', 'video', 'audio', 'unknown',
];
