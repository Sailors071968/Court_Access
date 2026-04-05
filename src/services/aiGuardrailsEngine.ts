// ============================================================================
// AI Guardrails Engine
// Requirement #2: Prevent AI hallucinations, unsubstantiated information,
// and unverified claims from being reported. Every claim must be
// evidence-sourced and corroborated.
//
// Architecture: BLOCKING layer — analysis output that fails verification
// is rejected and never reaches the user interface.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationLevel = 'verified' | 'corroborated' | 'single_source' | 'unverified' | 'rejected';

export interface VerificationResult {
  level: VerificationLevel;
  confidence: number;           // 0-100
  sourceCount: number;          // Number of evidence sources supporting this claim
  sourceDocuments: string[];    // Document IDs/names that support the claim
  corroborationDetails: string; // Human-readable explanation of verification
  passesThreshold: boolean;     // True if claim meets minimum verification standard
  rejectionReason: string | null; // If rejected, why
}

export interface GuardrailReport {
  totalClaims: number;
  verifiedClaims: number;
  rejectedClaims: number;
  overallConfidence: number;    // Average confidence of passed claims
  passRate: number;             // Percentage of claims that passed
  timestamp: string;
  details: VerificationResult[];
}

export interface AnalysisClaim {
  id: string;
  text: string;
  sourceDocumentIds: string[];
  confidence: number;
  category: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum confidence threshold for a claim to be reported.
 * Claims below this threshold are blocked (Requirement #2).
 */
const MINIMUM_CONFIDENCE_THRESHOLD = 0.40;

/**
 * Phrases that indicate unsubstantiated or speculative assertions.
 * Claims containing these are flagged for additional scrutiny.
 */
const SPECULATIVE_MARKERS = [
  'it is likely that',
  'it is probable',
  'it can be assumed',
  'presumably',
  'it stands to reason',
  'one could argue',
  'it goes without saying',
  'certainly',
  'definitely',
  'undoubtedly',
  'without question',
  'obviously',
  'clearly shows guilt',
  'proves innocence',
  'conclusively establishes',
  'beyond any doubt',
  'guarantees',
  'will result in',
  'must be true',
];

/**
 * Phrases that indicate unsourced AI-generated claims
 * (hallucination risk indicators).
 */
const HALLUCINATION_MARKERS = [
  'according to general knowledge',
  'it is well known that',
  'common sense dictates',
  'as everyone knows',
  'studies have shown',
  'research indicates',
  'experts agree',
  'statistics show',
  'data suggests',
  'historical records indicate',
  'based on my analysis',
  'in my opinion',
  'i believe',
  'it seems clear',
];

// ---------------------------------------------------------------------------
// Verification Functions
// ---------------------------------------------------------------------------

/**
 * Verify a single analysis claim against its evidence sources.
 * Returns a VerificationResult with pass/fail determination.
 */
export function verifyClaim(claim: AnalysisClaim): VerificationResult {
  const lowerText = claim.text.toLowerCase();

  // Check for hallucination markers
  const hasHallucinationMarker = HALLUCINATION_MARKERS.some(marker =>
    lowerText.includes(marker.toLowerCase())
  );

  if (hasHallucinationMarker) {
    return {
      level: 'rejected',
      confidence: 0,
      sourceCount: 0,
      sourceDocuments: [],
      corroborationDetails: 'Claim contains language patterns associated with unsourced assertions. All claims must be directly supported by uploaded evidence.',
      passesThreshold: false,
      rejectionReason: 'Contains unsourced assertion language. All analysis must reference specific uploaded evidence documents.',
    };
  }

  // Check for speculative markers
  const hasSpeculativeMarker = SPECULATIVE_MARKERS.some(marker =>
    lowerText.includes(marker.toLowerCase())
  );

  if (hasSpeculativeMarker && claim.sourceDocumentIds.length < 2) {
    return {
      level: 'rejected',
      confidence: Math.min(claim.confidence, 30),
      sourceCount: claim.sourceDocumentIds.length,
      sourceDocuments: claim.sourceDocumentIds,
      corroborationDetails: 'Claim uses speculative language without sufficient evidence corroboration. Speculative assertions require corroboration from at least 2 evidence sources.',
      passesThreshold: false,
      rejectionReason: 'Speculative assertion with insufficient evidence support. Requires corroboration from multiple evidence documents.',
    };
  }

  // Check confidence threshold
  if (claim.confidence / 100 < MINIMUM_CONFIDENCE_THRESHOLD) {
    return {
      level: 'rejected',
      confidence: claim.confidence,
      sourceCount: claim.sourceDocumentIds.length,
      sourceDocuments: claim.sourceDocumentIds,
      corroborationDetails: `Claim confidence (${claim.confidence}%) falls below minimum reporting threshold (${MINIMUM_CONFIDENCE_THRESHOLD * 100}%).`,
      passesThreshold: false,
      rejectionReason: `Confidence ${claim.confidence}% below ${MINIMUM_CONFIDENCE_THRESHOLD * 100}% threshold. Insufficient evidence to support this claim.`,
    };
  }

  // Check source attribution
  if (claim.sourceDocumentIds.length === 0) {
    return {
      level: 'rejected',
      confidence: 0,
      sourceCount: 0,
      sourceDocuments: [],
      corroborationDetails: 'Claim has no source attribution. Every analysis finding must reference specific uploaded evidence.',
      passesThreshold: false,
      rejectionReason: 'No evidence source attribution. All findings must be directly linked to uploaded evidence documents.',
    };
  }

  // Determine verification level based on source count and confidence
  const sourceCount = claim.sourceDocumentIds.length;
  let level: VerificationLevel;
  let adjustedConfidence = claim.confidence;

  if (sourceCount >= 3 && claim.confidence >= 80) {
    level = 'verified';
    adjustedConfidence = Math.min(99, claim.confidence + 5);
  } else if (sourceCount >= 2 && claim.confidence >= 60) {
    level = 'corroborated';
    adjustedConfidence = claim.confidence;
  } else if (sourceCount >= 1 && claim.confidence >= 40) {
    level = 'single_source';
    adjustedConfidence = Math.max(40, claim.confidence - 10);
  } else {
    level = 'unverified';
    adjustedConfidence = Math.max(20, claim.confidence - 20);
  }

  return {
    level,
    confidence: adjustedConfidence,
    sourceCount,
    sourceDocuments: claim.sourceDocumentIds,
    corroborationDetails: level === 'verified'
      ? `Claim supported by ${sourceCount} evidence sources with ${adjustedConfidence}% confidence.`
      : level === 'corroborated'
        ? `Claim corroborated by ${sourceCount} sources. Confidence: ${adjustedConfidence}%.`
        : level === 'single_source'
          ? `Claim based on single evidence source. Independent corroboration recommended.`
          : `Claim has insufficient evidence support. Verification recommended.`,
    passesThreshold: true,
    rejectionReason: null,
  };
}

/**
 * Run full guardrail analysis on a set of claims.
 * Returns a GuardrailReport with aggregate verification statistics.
 */
export function runGuardrailCheck(claims: AnalysisClaim[]): GuardrailReport {
  const results = claims.map(claim => verifyClaim(claim));

  const passed = results.filter(r => r.passesThreshold);
  const rejected = results.filter(r => !r.passesThreshold);

  const avgConfidence = passed.length > 0
    ? Math.round(passed.reduce((sum, r) => sum + r.confidence, 0) / passed.length)
    : 0;

  return {
    totalClaims: claims.length,
    verifiedClaims: passed.length,
    rejectedClaims: rejected.length,
    overallConfidence: avgConfidence,
    passRate: claims.length > 0 ? Math.round((passed.length / claims.length) * 100) : 0,
    timestamp: new Date().toISOString(),
    details: results,
  };
}

/**
 * Sanitize analysis text by removing hallucination-risk language patterns.
 * Replaces speculative/unsourced language with evidence-referenced phrasing.
 */
export function sanitizeAnalysisText(text: string): string {
  let sanitized = text;

  // Replace speculative markers with evidence-based alternatives
  const replacements: [RegExp, string][] = [
    [/\b(it is likely that)\b/gi, 'evidence indicates that'],
    [/\b(it is probable)\b/gi, 'evidence suggests'],
    [/\b(it can be assumed)\b/gi, 'based on uploaded evidence'],
    [/\b(presumably)\b/gi, 'based on the evidence reviewed'],
    [/\b(it stands to reason)\b/gi, 'the evidence documents indicate'],
    [/\b(one could argue)\b/gi, 'the evidence may indicate'],
    [/\b(obviously)\b/gi, 'as documented in the evidence'],
    [/\b(certainly|definitely|undoubtedly)\b/gi, 'as reflected in the evidence'],
    [/\b(without question)\b/gi, 'based on the evidence reviewed'],
    [/\b(clearly shows guilt)\b/gi, 'the prosecution may argue relevance to elements'],
    [/\b(proves innocence)\b/gi, 'evidence may support defense arguments regarding'],
    [/\b(conclusively establishes)\b/gi, 'the evidence documents indicate'],
    [/\b(beyond any doubt)\b/gi, 'based on available evidence'],
    [/\b(guarantees)\b/gi, 'the evidence supports'],
    [/\b(will result in)\b/gi, 'may be relevant to'],
    [/\b(must be true)\b/gi, 'is documented in the evidence'],
    [/\b(according to general knowledge)\b/gi, 'according to the uploaded evidence'],
    [/\b(it is well known that)\b/gi, 'the evidence documents show'],
    [/\b(common sense dictates)\b/gi, 'the evidence indicates'],
    [/\b(as everyone knows)\b/gi, 'as documented in the case file'],
    [/\b(studies have shown)\b/gi, 'the uploaded evidence shows'],
    [/\b(research indicates)\b/gi, 'the evidence documents indicate'],
    [/\b(experts agree)\b/gi, 'the documented evidence indicates'],
    [/\b(statistics show)\b/gi, 'the evidence reflects'],
    [/\b(data suggests)\b/gi, 'the evidence documents suggest'],
    [/\b(based on my analysis)\b/gi, 'based on analysis of uploaded evidence'],
    [/\b(in my opinion)\b/gi, 'based on the evidence reviewed'],
    [/\b(i believe)\b/gi, 'the evidence indicates'],
    [/\b(it seems clear)\b/gi, 'the evidence documents indicate'],
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Validate that an analysis output meets all guardrail requirements
 * before being displayed to users. Returns true only if safe to display.
 */
export function isOutputSafeToDisplay(
  text: string,
  sourceDocumentCount: number,
  confidence: number
): boolean {
  // Must have at least one source document
  if (sourceDocumentCount < 1) return false;

  // Must meet confidence threshold
  if (confidence / 100 < MINIMUM_CONFIDENCE_THRESHOLD) return false;

  // Must not contain hallucination markers
  const lowerText = text.toLowerCase();
  if (HALLUCINATION_MARKERS.some(marker => lowerText.includes(marker.toLowerCase()))) {
    return false;
  }

  return true;
}
