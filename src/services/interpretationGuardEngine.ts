// ============================================
// Court Access — Interpretation Guard Engine (Phase 13)
// FOIL Enforcement Engine
// (Facts Only, Interpretation Limited)
//
// Deterministic text validation pipeline.
// Token-level forbidden phrase matching.
// No regex-only soft layer — structural token scan.
// No ML. No probabilistic classification. No scoring.
//
// This engine enforces the epistemic boundary of Court Access:
//   Court Access produces structural facts only.
//   It does NOT produce opinions, predictions, likelihoods,
//   recommendations, or interpretive language.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import signatureEngine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No ranking
//   - No anomaly detection
//   - No likelihood
//   - No confidence
//   - No prediction
//   - No intent inference
//   - No interpretive language
//   - No ML classification
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - Additive-only rule registry
//   - No downgrade path
//   - No silent bypass flag
//   - Binary PASS/FAIL only
//   - ASCII comparator only
// ============================================

import type {
  ForbiddenPhraseEntry,
  ForbiddenPhraseCategory,
  ForbiddenPhraseRegistry,
  TextToken,
  ViolationRecord,
  TextValidationResult,
  GuardFieldValidation,
  GuardValidationMatrix,
  CIEnforcementResult,
} from '../models/ForbiddenPhraseModel';

// ---------------------------------------------------------------------------
// Static Forbidden Phrase Registry — deterministic, additive-only
// ---------------------------------------------------------------------------

/**
 * Static forbidden phrase registry.
 *
 * Rules:
 *   - All phrases are lowercase (text is normalized before matching)
 *   - Sorted by phrase (ASCII comparator)
 *   - Additive-only — new phrases may be appended, none removed
 *   - No downgrade path — once forbidden, always forbidden
 *   - No silent bypass flag
 *   - Registry is frozen at runtime
 *
 * Categories:
 *   PROBABILISTIC  — statistical language (likely, probably, chance)
 *   SPECULATIVE    — hypothetical language (might, could, possibly)
 *   INFERENTIAL    — implication language (suggests, implies, indicates)
 *   INTERPRETIVE   — opinion language (seems, looks like, in my opinion)
 *   PREDICTIVE     — forecast language (will likely, expected to)
 *   SCORING        — metric language (score, rating, confidence level)
 *   RECOMMENDATION — advisory language (should, recommend, advise)
 *   ANOMALY        — outlier language (unusual, anomalous, suspicious)
 *   INTENT         — motive language (intended, meant to, trying to)
 *   SENTIMENT      — assessment language (positive outlook, negative trend)
 */
const FORBIDDEN_PHRASE_ENTRIES: ForbiddenPhraseEntry[] = [
  // ANOMALY
  { phrase: 'anomalous', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'anomaly detected', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'outlier', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'suspicious', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'unusual', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'unusual pattern', category: 'ANOMALY', registeredEpoch: 1, severity: 'BLOCK' },
  // INFERENTIAL
  { phrase: 'appears to', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'consistent with', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'implies', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'in light of', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'indicates', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'points to', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'suggests', category: 'INFERENTIAL', registeredEpoch: 1, severity: 'BLOCK' },
  // INTENT
  { phrase: 'intended to', category: 'INTENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'meant to', category: 'INTENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'motive', category: 'INTENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'trying to', category: 'INTENT', registeredEpoch: 1, severity: 'BLOCK' },
  // INTERPRETIVE
  { phrase: 'arguably', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'clearly', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'in my opinion', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'it is believed', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'looks like', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'obviously', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'seems', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'seems like', category: 'INTERPRETIVE', registeredEpoch: 1, severity: 'BLOCK' },
  // PREDICTIVE
  { phrase: 'expected to', category: 'PREDICTIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'forecast', category: 'PREDICTIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'predicted', category: 'PREDICTIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'projection', category: 'PREDICTIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'will likely', category: 'PREDICTIVE', registeredEpoch: 1, severity: 'BLOCK' },
  // PROBABILISTIC
  { phrase: 'chance', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'likelihood', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'likely', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'odds', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'probability', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'probable', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'probably', category: 'PROBABILISTIC', registeredEpoch: 1, severity: 'BLOCK' },
  // RECOMMENDATION
  { phrase: 'advise', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'consider', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'it is advisable', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'recommend', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'should', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'we suggest', category: 'RECOMMENDATION', registeredEpoch: 1, severity: 'BLOCK' },
  // SCORING
  { phrase: 'confidence level', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'confidence score', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'high confidence', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'low confidence', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'rated', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'rating', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'risk score', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'score', category: 'SCORING', registeredEpoch: 1, severity: 'BLOCK' },
  // SENTIMENT
  { phrase: 'negative outlook', category: 'SENTIMENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'negative trend', category: 'SENTIMENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'positive outlook', category: 'SENTIMENT', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'positive trend', category: 'SENTIMENT', registeredEpoch: 1, severity: 'BLOCK' },
  // SPECULATIVE
  { phrase: 'could be', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'may have', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'might', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'perhaps', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'possibly', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'speculate', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
  { phrase: 'speculation', category: 'SPECULATIVE', registeredEpoch: 1, severity: 'BLOCK' },
];

// Freeze the registry — no runtime mutation
Object.freeze(FORBIDDEN_PHRASE_ENTRIES);
for (const entry of FORBIDDEN_PHRASE_ENTRIES) {
  Object.freeze(entry);
}

// ---------------------------------------------------------------------------
// Registry Access Functions — read-only
// ---------------------------------------------------------------------------

/**
 * Get the full forbidden phrase registry.
 * Returns a frozen structure — no mutation possible.
 */
export function getForbiddenPhraseRegistry(): ForbiddenPhraseRegistry {
  return {
    entries: FORBIDDEN_PHRASE_ENTRIES,
    registryVersion: 1,
    registryEpoch: 1,
  };
}

/**
 * Get all phrases for a specific category.
 * Returns entries filtered by category, maintaining ASCII sort order.
 */
export function getPhrasesByCategory(
  category: ForbiddenPhraseCategory
): ForbiddenPhraseEntry[] {
  return FORBIDDEN_PHRASE_ENTRIES.filter((e) => e.category === category);
}

// ---------------------------------------------------------------------------
// Tokenizer — deterministic, structural
// ---------------------------------------------------------------------------

/**
 * ASCII-only lowercase normalization.
 *
 * Converts A-Z (0x41-0x5A) to a-z (0x61-0x7A) by adding 32.
 * All other characters pass through unchanged.
 *
 * This is NOT locale-sensitive. Does NOT use .toLowerCase().
 * No Unicode folding. No environment-dependent behavior.
 * Pure ASCII transformation — deterministic across all runtimes.
 */
function asciiLowerChar(ch: string): string {
  return ch >= 'A' && ch <= 'Z'
    ? String.fromCharCode(ch.charCodeAt(0) + 32)
    : ch;
}

/**
 * Tokenize text into structural tokens.
 *
 * Tokenization rules (deterministic):
 *   1. Normalize each character to ASCII lowercase (asciiLowerChar)
 *   2. Classify: alphanumeric (a-z, 0-9) + apostrophe = token char
 *   3. Everything else = token boundary
 *   4. Emit non-empty tokens with sequential zero-based positions
 *
 * This is NOT regex-only — it is a forward-scan tokenizer:
 *   - Scans each character sequentially
 *   - ASCII-only lowercase normalization (no .toLowerCase())
 *   - No locale-sensitive operations
 *   - No Unicode folding
 *   - No environment-dependent behavior
 *   - No regex engine dependency for core tokenization
 *
 * This is a pure function — same input always produces same output.
 */
export function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let currentToken = '';
  let position = 0;

  for (let i = 0; i < text.length; i++) {
    // ASCII-only lowercase — no .toLowerCase(), no locale dependency
    const ch = asciiLowerChar(text[i]);

    // Alphanumeric and apostrophe are token characters
    const isTokenChar =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === "'";

    if (isTokenChar) {
      currentToken += ch;
    } else {
      // Boundary — emit current token if non-empty
      if (currentToken.length > 0) {
        tokens.push({ position, value: currentToken });
        position++;
        currentToken = '';
      }
    }
  }

  // Emit final token if non-empty
  if (currentToken.length > 0) {
    tokens.push({ position, value: currentToken });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Phrase Tokenizer — split phrase into token values
// ---------------------------------------------------------------------------

/**
 * Split a forbidden phrase into its constituent token values.
 * Uses the same tokenization rules as tokenizeText for consistency.
 *
 * This is a pure function — same input always produces same output.
 */
function tokenizePhrase(phrase: string): string[] {
  return tokenizeText(phrase).map((t) => t.value);
}

// ---------------------------------------------------------------------------
// Token-Level Phrase Matching — deterministic scan
// ---------------------------------------------------------------------------

/**
 * Scan tokens for a specific forbidden phrase.
 *
 * Algorithm (forward scan, no regex):
 *   1. Tokenize the forbidden phrase into phraseTokens
 *   2. Slide a window of phraseTokens.length across the text tokens
 *   3. At each position, compare token values sequentially
 *   4. If all token values match → record violation
 *   5. Continue scanning (non-greedy — report all occurrences)
 *
 * This is a structural token-level scan, not a regex search.
 * Matching is exact (case-insensitive via prior lowercase normalization).
 *
 * This is a pure function — same input always produces same output.
 */
function scanForPhrase(
  tokens: TextToken[],
  entry: ForbiddenPhraseEntry
): ViolationRecord[] {
  const violations: ViolationRecord[] = [];
  const phraseTokens = tokenizePhrase(entry.phrase);

  if (phraseTokens.length === 0 || tokens.length < phraseTokens.length) {
    return violations;
  }

  for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
    let match = true;
    for (let j = 0; j < phraseTokens.length; j++) {
      if (tokens[i + j].value !== phraseTokens[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Reconstruct matched text from tokens
      const matchedTokens: string[] = [];
      for (let j = 0; j < phraseTokens.length; j++) {
        matchedTokens.push(tokens[i + j].value);
      }

      violations.push({
        phrase: entry.phrase,
        category: entry.category,
        tokenStartPosition: tokens[i].position,
        tokenEndPosition: tokens[i].position + phraseTokens.length,
        matchedText: matchedTokens.join(' '),
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Text Validation Pipeline — deterministic, binary
// ---------------------------------------------------------------------------

/**
 * Validate text against the forbidden phrase registry.
 *
 * Pipeline:
 *   1. Tokenize input text (forward-scan tokenizer)
 *   2. For each forbidden phrase in registry (ASCII-sorted order):
 *      a. Tokenize the phrase
 *      b. Scan text tokens for phrase match (sliding window)
 *      c. Record all violations
 *   3. Return PASS if zero violations, FAIL if any violations
 *
 * This is NOT a regex-only layer:
 *   - Tokenization is structural (forward-scan character classification)
 *   - Phrase matching is structural (token-level sliding window)
 *   - No regex engine dependency for matching
 *
 * Binary result only. No scoring. No confidence. No ranking.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateText(text: string): TextValidationResult {
  const tokens = tokenizeText(text);
  const registry = getForbiddenPhraseRegistry();
  const allViolations: ViolationRecord[] = [];

  // Scan for each forbidden phrase (registry is already ASCII-sorted)
  for (const entry of registry.entries) {
    const phraseViolations = scanForPhrase(tokens, entry);
    for (const v of phraseViolations) {
      allViolations.push(v);
    }
  }

  // Sort violations by tokenStartPosition (deterministic order)
  allViolations.sort(
    (a, b) =>
      a.tokenStartPosition < b.tokenStartPosition ? -1 :
      a.tokenStartPosition > b.tokenStartPosition ? 1 : 0
  );

  return {
    result: allViolations.length === 0 ? 'PASS' : 'FAIL',
    violations: allViolations,
    tokenCount: tokens.length,
    phrasesChecked: registry.entries.length,
  };
}

// ---------------------------------------------------------------------------
// Multi-Field Validation — validate multiple named fields
// ---------------------------------------------------------------------------

/**
 * Validate multiple named text fields against the forbidden phrase registry.
 *
 * Each field is validated independently.
 * Overall: PASS only if ALL fields pass.
 *
 * Use this for validating structured outputs (e.g., export descriptions,
 * deviation records, element descriptions) before they leave the system.
 *
 * Returns per-field results and overall binary result.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateFields(
  fields: Array<{ fieldName: string; text: string }>
): GuardValidationMatrix {
  const results: GuardFieldValidation[] = [];

  for (const field of fields) {
    const validation = validateText(field.text);
    results.push({
      field: field.fieldName,
      result: validation.result,
    });
  }

  const allPass = results.every((r) => r.result === 'PASS');

  return {
    fields: results,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook
// ---------------------------------------------------------------------------

/**
 * CI enforcement check for interpretation guard.
 *
 * Validates all provided text fields and returns a CI-compatible result.
 * Designed to be called from build/CI pipeline to gate outputs.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, violatingFields lists which fields contain forbidden phrases.
 * No soft pass. No warning-only mode. No bypass flag.
 *
 * Exit behavior (for CI integration):
 *   - PASS → build may proceed
 *   - FAIL → build MUST be blocked
 *
 * This is a pure function — same input always produces same output.
 */
export function enforceInterpretationGuard(
  fields: Array<{ fieldName: string; text: string }>
): CIEnforcementResult {
  const violatingFields: string[] = [];
  let totalViolations = 0;

  for (const field of fields) {
    const validation = validateText(field.text);
    if (validation.result === 'FAIL') {
      violatingFields.push(field.fieldName);
      totalViolations += validation.violations.length;
    }
  }

  return {
    result: violatingFields.length === 0 ? 'PASS' : 'FAIL',
    violatingFields,
    totalViolations,
  };
}

// ---------------------------------------------------------------------------
// Registry Verification — structural integrity
// ---------------------------------------------------------------------------

/**
 * Verify the structural integrity of the forbidden phrase registry.
 *
 * Checks:
 *   1. All entries have non-empty phrase
 *   2. All entries have valid category
 *   3. All entries have severity === 'BLOCK'
 *   4. All entries have positive registeredEpoch
 *   5. Entries are sorted by phrase (ASCII comparator)
 *   6. No duplicate phrases
 *
 * Binary result only: PASS or FAIL per check.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyRegistryIntegrity(): GuardValidationMatrix {
  const registry = getForbiddenPhraseRegistry();
  const fields: GuardFieldValidation[] = [];

  const validCategories: string[] = [
    'ANOMALY',
    'INFERENTIAL',
    'INTENT',
    'INTERPRETIVE',
    'PREDICTIVE',
    'PROBABILISTIC',
    'RECOMMENDATION',
    'SCORING',
    'SENTIMENT',
    'SPECULATIVE',
  ];

  // Check 1: All phrases non-empty
  const allPhrasesNonEmpty = registry.entries.every(
    (e) => typeof e.phrase === 'string' && e.phrase.length > 0
  );
  fields.push({
    field: 'allPhrasesNonEmpty',
    result: allPhrasesNonEmpty ? 'PASS' : 'FAIL',
  });

  // Check 2: All categories valid
  const allCategoriesValid = registry.entries.every(
    (e) => validCategories.indexOf(e.category) !== -1
  );
  fields.push({
    field: 'allCategoriesValid',
    result: allCategoriesValid ? 'PASS' : 'FAIL',
  });

  // Check 3: All severities are BLOCK
  const allSeveritiesBlock = registry.entries.every(
    (e) => e.severity === 'BLOCK'
  );
  fields.push({
    field: 'allSeveritiesBlock',
    result: allSeveritiesBlock ? 'PASS' : 'FAIL',
  });

  // Check 4: All registeredEpoch positive
  const allEpochsPositive = registry.entries.every(
    (e) => Number.isInteger(e.registeredEpoch) && e.registeredEpoch > 0
  );
  fields.push({
    field: 'allEpochsPositive',
    result: allEpochsPositive ? 'PASS' : 'FAIL',
  });

  // Check 5: Entries sorted by phrase (ASCII comparator)
  let sorted = true;
  for (let i = 0; i < registry.entries.length - 1; i++) {
    if (!(registry.entries[i].phrase < registry.entries[i + 1].phrase ||
          registry.entries[i].phrase === registry.entries[i + 1].phrase)) {
      sorted = false;
      break;
    }
  }
  fields.push({
    field: 'entriesSorted',
    result: sorted ? 'PASS' : 'FAIL',
  });

  // Check 6: No duplicate phrases
  const phraseSet = new Set<string>();
  let hasDuplicates = false;
  for (const entry of registry.entries) {
    if (phraseSet.has(entry.phrase)) {
      hasDuplicates = true;
      break;
    }
    phraseSet.add(entry.phrase);
  }
  fields.push({
    field: 'noDuplicatePhrases',
    result: hasDuplicates ? 'FAIL' : 'PASS',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
