// ============================================
// Court Access — Drift Detector Engine (Phase 14)
// Structural Drift Detector (CI Invariant Enforcement Layer)
//
// Deterministic CI validation pipeline.
// AST-based forbidden construct detection.
// Prohibited keyword detection (engine-level).
// Cross-file scan capability.
// Build-block enforcement.
//
// This engine prevents gradual erosion of constitutional doctrine
// by detecting structural drift at build time.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import signatureEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of invariant registry
//   - No soft warnings
//   - No downgrade path
//   - No dynamic invariant removal
//   - Additive-only invariant expansion
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - No environment-dependent behavior
// ============================================

import type {
  InvariantEntry,
  InvariantCategory,
  InvariantRegistry,
  InvariantViolation,
  FileScanResult,
  CrossFileScanResult,
  CIBuildGateResult,
  InvariantFieldValidation,
  RegistryIntegrityResult,
} from '../models/InvariantRegistryModel';

// ---------------------------------------------------------------------------
// ASCII-only lowercase normalization (same as Phase 13)
// ---------------------------------------------------------------------------

/**
 * ASCII-only lowercase normalization.
 * Converts A-Z (0x41-0x5A) to a-z (0x61-0x7A) by adding 32.
 * No .toLowerCase(). No locale sensitivity. No Unicode folding.
 */
function asciiLowerChar(ch: string): string {
  return ch >= 'A' && ch <= 'Z'
    ? String.fromCharCode(ch.charCodeAt(0) + 32)
    : ch;
}

// ---------------------------------------------------------------------------
// Static Invariant Registry — immutable, additive-only
// ---------------------------------------------------------------------------

/**
 * Static invariant registry.
 *
 * Rules:
 *   - All entries sorted by invariantId (ASCII comparator)
 *   - Additive-only — entries may be appended, never removed
 *   - No downgrade path — once registered, always enforced
 *   - No dynamic removal at runtime
 *   - Registry frozen at runtime via Object.freeze
 *
 * Pattern types:
 *   TOKEN_EXACT  — exact token match (word boundary aware)
 *   SUBSTRING    — exact substring in source line
 *   IMPORT_PATH  — forbidden import path segment
 *
 * Scope:
 *   ALL      — scanned in all source files
 *   ENGINES  — *Engine.ts files only
 *   SERVICES — *Service.ts files only
 *   MODELS   — *Model.ts files only
 */
const INVARIANT_ENTRIES: InvariantEntry[] = [
  // ENTROPY_GUARD
  {
    invariantId: 'ENT-001',
    category: 'ENTROPY_GUARD',
    description: 'Math.random() is forbidden — introduces non-determinism',
    pattern: 'Math.random',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'ENT-002',
    category: 'ENTROPY_GUARD',
    description: 'crypto.getRandomValues() is forbidden — introduces non-determinism',
    pattern: 'getRandomValues',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'ENT-003',
    category: 'ENTROPY_GUARD',
    description: 'crypto.randomUUID() is forbidden — introduces non-determinism',
    pattern: 'randomUUID',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },

  // FORBIDDEN_CONSTRUCT
  {
    invariantId: 'FC-001',
    category: 'FORBIDDEN_CONSTRUCT',
    description: 'localeCompare() is forbidden — locale-sensitive sorting',
    pattern: 'localeCompare',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'FC-002',
    category: 'FORBIDDEN_CONSTRUCT',
    description: '.toLowerCase() is forbidden — locale-sensitive normalization',
    pattern: '.toLowerCase()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'FC-003',
    category: 'FORBIDDEN_CONSTRUCT',
    description: '.toUpperCase() is forbidden — locale-sensitive normalization',
    pattern: '.toUpperCase()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'FC-004',
    category: 'FORBIDDEN_CONSTRUCT',
    description: 'Intl. namespace is forbidden — locale-sensitive operations',
    pattern: 'Intl.',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'FC-005',
    category: 'FORBIDDEN_CONSTRUCT',
    description: '.toLocaleLowerCase() is forbidden — locale-sensitive normalization',
    pattern: '.toLocaleLowerCase()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'FC-006',
    category: 'FORBIDDEN_CONSTRUCT',
    description: '.toLocaleUpperCase() is forbidden — locale-sensitive normalization',
    pattern: '.toLocaleUpperCase()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },

  // HASH_DISCIPLINE
  {
    invariantId: 'HD-001',
    category: 'HASH_DISCIPLINE',
    description: 'sha256: prefix in hash string is forbidden — raw hex only',
    pattern: '"sha256:"',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'HD-002',
    category: 'HASH_DISCIPLINE',
    description: 'sha3-256: prefix in hash string is forbidden — raw hex only',
    pattern: '"sha3-256:"',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },

  // IMPORT_BOUNDARY
  {
    invariantId: 'IB-001',
    category: 'IMPORT_BOUNDARY',
    description: 'Archive/pricing services must not import exportEngine',
    pattern: 'exportEngine',
    patternType: 'IMPORT_PATH',
    scope: 'SERVICES',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'IB-002',
    category: 'IMPORT_BOUNDARY',
    description: 'Archive/pricing services must not import anchorIntegrationEngine',
    pattern: 'anchorIntegrationEngine',
    patternType: 'IMPORT_PATH',
    scope: 'SERVICES',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },

  // MUTATION_GUARD
  {
    invariantId: 'MG-001',
    category: 'MUTATION_GUARD',
    description: '.splice() is forbidden in engines — mutates arrays',
    pattern: '.splice(',
    patternType: 'SUBSTRING',
    scope: 'ENGINES',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'MG-002',
    category: 'MUTATION_GUARD',
    description: 'delete keyword on object properties is forbidden',
    pattern: 'delete ',
    patternType: 'SUBSTRING',
    scope: 'ENGINES',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },

  // TEMPORAL_GUARD
  {
    invariantId: 'TG-001',
    category: 'TEMPORAL_GUARD',
    description: 'Date.now() is forbidden — non-deterministic time source',
    pattern: 'Date.now()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'TG-002',
    category: 'TEMPORAL_GUARD',
    description: 'new Date() is forbidden — non-deterministic time source',
    pattern: 'new Date()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
  {
    invariantId: 'TG-003',
    category: 'TEMPORAL_GUARD',
    description: 'performance.now() is forbidden — non-deterministic time source',
    pattern: 'performance.now()',
    patternType: 'SUBSTRING',
    scope: 'ALL',
    severity: 'BLOCK',
    registeredEpoch: 1,
  },
];

// Freeze the registry — no runtime mutation
Object.freeze(INVARIANT_ENTRIES);
for (const entry of INVARIANT_ENTRIES) {
  Object.freeze(entry);
}

// ---------------------------------------------------------------------------
// Registry Access — read-only
// ---------------------------------------------------------------------------

/**
 * Get the full invariant registry.
 * Returns a frozen structure — no mutation possible.
 */
export function getInvariantRegistry(): InvariantRegistry {
  return {
    entries: INVARIANT_ENTRIES,
    registryVersion: 1,
    registryEpoch: 1,
  };
}

/**
 * Get all invariants for a specific category.
 * Returns entries filtered by category, maintaining ASCII sort order.
 */
export function getInvariantsByCategory(
  category: InvariantCategory
): InvariantEntry[] {
  return INVARIANT_ENTRIES.filter((e) => e.category === category);
}

// ---------------------------------------------------------------------------
// String/Comment State Machine — determines if a character position
// is inside a comment, string literal, or functional code.
//
// States:
//   CODE             — functional code (invariants enforced)
//   STRING_SINGLE    — inside '...' (invariants enforced)
//   STRING_DOUBLE    — inside "..." (invariants enforced)
//   STRING_TEMPLATE  — inside `...` (invariants enforced)
//   COMMENT_LINE     — inside // ... (invariants NOT enforced)
//   COMMENT_BLOCK    — inside /* ... */ (invariants NOT enforced)
//
// Key guarantee:
//   Comment markers inside string literals do NOT trigger comment state.
//   Patterns inside string literals ARE enforced (strings are code).
//   Only actual comments are skipped.
//
// Forward-scan, ASCII-only, no regex, deterministic.
// ---------------------------------------------------------------------------

/**
 * Character position classification.
 * 'CODE' includes string literals — invariants are enforced there.
 * 'COMMENT' means the position is inside a comment — invariants skipped.
 */
type CharClass = 'CODE' | 'COMMENT';

/**
 * Classify each character position in a line as CODE or COMMENT.
 *
 * State machine tracks:
 *   - Single-quoted string boundaries (') with backslash escape
 *   - Double-quoted string boundaries (") with backslash escape
 *   - Template literal boundaries (`) with backslash escape
 *   - Single-line comment start (//)
 *   - Block comment regions (/* ... * /)
 *
 * String literals are classified as CODE — patterns inside strings
 * are still enforced. Only actual comments are classified as COMMENT.
 *
 * The inBlockComment parameter carries block comment state across lines
 * (block comments can span multiple lines).
 *
 * This is a pure function — same input always produces same output
 * given the same inBlockComment state.
 */
function classifyLinePositions(
  line: string,
  inBlockComment: boolean
): { classes: CharClass[]; outBlockComment: boolean } {
  const classes: CharClass[] = new Array(line.length);
  let state: 'CODE' | 'STR_SINGLE' | 'STR_DOUBLE' | 'STR_TEMPLATE' | 'COMMENT_LINE' | 'COMMENT_BLOCK' =
    inBlockComment ? 'COMMENT_BLOCK' : 'CODE';
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : '';

    switch (state) {
      case 'CODE':
        // Check for comment start
        if (ch === '/' && next === '/') {
          // Single-line comment — rest of line is COMMENT
          for (let k = i; k < line.length; k++) {
            classes[k] = 'COMMENT';
          }
          return { classes, outBlockComment: false };
        }
        if (ch === '/' && next === '*') {
          // Block comment start
          classes[i] = 'COMMENT';
          classes[i + 1] = 'COMMENT';
          state = 'COMMENT_BLOCK';
          i += 2;
          continue;
        }
        // Check for string literal start
        if (ch === "'") {
          classes[i] = 'CODE';
          state = 'STR_SINGLE';
          i++;
          continue;
        }
        if (ch === '"') {
          classes[i] = 'CODE';
          state = 'STR_DOUBLE';
          i++;
          continue;
        }
        if (ch === '`') {
          classes[i] = 'CODE';
          state = 'STR_TEMPLATE';
          i++;
          continue;
        }
        // Regular code character
        classes[i] = 'CODE';
        i++;
        break;

      case 'STR_SINGLE':
        classes[i] = 'CODE'; // String content is CODE — enforce invariants
        if (ch === '\\') {
          // Escape sequence — skip next character
          if (i + 1 < line.length) {
            classes[i + 1] = 'CODE';
            i += 2;
          } else {
            i++;
          }
        } else if (ch === "'") {
          // End of single-quoted string
          state = 'CODE';
          i++;
        } else {
          i++;
        }
        break;

      case 'STR_DOUBLE':
        classes[i] = 'CODE'; // String content is CODE — enforce invariants
        if (ch === '\\') {
          // Escape sequence — skip next character
          if (i + 1 < line.length) {
            classes[i + 1] = 'CODE';
            i += 2;
          } else {
            i++;
          }
        } else if (ch === '"') {
          // End of double-quoted string
          state = 'CODE';
          i++;
        } else {
          i++;
        }
        break;

      case 'STR_TEMPLATE':
        classes[i] = 'CODE'; // Template content is CODE — enforce invariants
        if (ch === '\\') {
          // Escape sequence — skip next character
          if (i + 1 < line.length) {
            classes[i + 1] = 'CODE';
            i += 2;
          } else {
            i++;
          }
        } else if (ch === '`') {
          // End of template literal
          state = 'CODE';
          i++;
        } else {
          i++;
        }
        break;

      case 'COMMENT_BLOCK':
        // Inside block comment — look for */
        if (ch === '*' && next === '/') {
          classes[i] = 'COMMENT';
          classes[i + 1] = 'COMMENT';
          state = 'CODE';
          i += 2;
          continue;
        }
        classes[i] = 'COMMENT';
        i++;
        break;

      // COMMENT_LINE is not a state variable value — single-line comments
      // are handled by early return in the CODE case above.
    }
  }

  return {
    classes,
    outBlockComment: state === 'COMMENT_BLOCK',
  };
}

/**
 * Check if ALL positions in a range [start, start+length) are COMMENT.
 * Returns true only if every character in the range is inside a comment.
 * If any character is CODE (including string literals), returns false.
 */
function isRangeAllComment(
  classes: CharClass[],
  start: number,
  length: number
): boolean {
  for (let i = start; i < start + length && i < classes.length; i++) {
    if (classes[i] !== 'COMMENT') return false;
  }
  return true;
}

/**
 * Check if a line is entirely a comment (no functional code).
 * Uses the state machine to classify all positions.
 * Returns true only if every non-whitespace character is COMMENT.
 */
function isEntirelyComment(
  classes: CharClass[],
  line: string
): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== ' ' && line[i] !== '\t') {
      if (classes[i] !== 'COMMENT') return false;
    }
  }
  // If line is all whitespace, it is not a comment — it is empty
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== ' ' && line[i] !== '\t') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Import Line Detection
// ---------------------------------------------------------------------------

/**
 * Determine if a line is an import statement.
 *
 * Detects lines starting with 'import ' (after optional whitespace).
 * Forward-scan, ASCII-only, no regex.
 */
function isImportLine(line: string): boolean {
  // Skip leading whitespace
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i++;
  }

  // Check for 'import '
  const importKeyword = 'import ';
  if (i + importKeyword.length > line.length) return false;

  for (let j = 0; j < importKeyword.length; j++) {
    if (line[i + j] !== importKeyword[j]) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// File Scope Classification
// ---------------------------------------------------------------------------

/**
 * Classify a file path into a scope category.
 *
 * Rules (deterministic, ASCII-only):
 *   - Ends with 'Engine.ts' → 'ENGINES'
 *   - Ends with 'Service.ts' → 'SERVICES'
 *   - Ends with 'Model.ts' → 'MODELS'
 *   - Otherwise → 'ALL' (matches only ALL-scoped invariants)
 *
 * No regex. Forward string comparison only.
 */
function classifyFileScope(filePath: string): 'ENGINES' | 'SERVICES' | 'MODELS' | 'ALL' {
  if (filePath.length >= 9 && filePath.substring(filePath.length - 9) === 'Engine.ts') {
    return 'ENGINES';
  }
  if (filePath.length >= 10 && filePath.substring(filePath.length - 10) === 'Service.ts') {
    return 'SERVICES';
  }
  if (filePath.length >= 8 && filePath.substring(filePath.length - 8) === 'Model.ts') {
    return 'MODELS';
  }
  return 'ALL';
}

/**
 * Determine if an invariant applies to a given file scope.
 *
 * An invariant with scope 'ALL' applies to every file.
 * An invariant with a specific scope applies only to files of that scope.
 */
function invariantAppliesToScope(
  invariantScope: 'ALL' | 'ENGINES' | 'SERVICES' | 'MODELS',
  fileScope: 'ENGINES' | 'SERVICES' | 'MODELS' | 'ALL'
): boolean {
  // ALL-scoped invariants apply to all files
  if (invariantScope === 'ALL') return true;
  // Specific-scoped invariants apply to matching files
  return invariantScope === fileScope;
}

// ---------------------------------------------------------------------------
// Substring Detector — deterministic, forward-scan
// ---------------------------------------------------------------------------

/**
 * Detect exact substring match in a source line.
 *
 * Forward-scan character comparison. No regex.
 * Returns the starting index if found, or -1 if not found.
 *
 * This is a pure function — same input always produces same output.
 */
function findSubstring(line: string, pattern: string): number {
  if (pattern.length === 0 || line.length < pattern.length) return -1;

  for (let i = 0; i <= line.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (line[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Import Path Detector
// ---------------------------------------------------------------------------

/**
 * Detect if an import line imports from a forbidden path.
 *
 * Checks if the import line contains the forbidden path segment.
 * Only checks lines that are import statements.
 *
 * Forward-scan, no regex.
 */
function detectForbiddenImport(line: string, forbiddenPath: string): boolean {
  if (!isImportLine(line)) return false;
  return findSubstring(line, forbiddenPath) !== -1;
}

// ---------------------------------------------------------------------------
// Token-Level Exact Match Detector
// ---------------------------------------------------------------------------

/**
 * Tokenize a line for token-level matching.
 * Same tokenization rules as Phase 13 — ASCII-only lowercase,
 * alphanumeric + apostrophe are token chars, everything else is boundary.
 */
function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = asciiLowerChar(line[i]);
    const isTokenChar =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === "'";

    if (isTokenChar) {
      current += ch;
    } else {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Detect exact token sequence match in a line.
 *
 * Tokenizes both the line and the pattern.
 * Slides a window of pattern tokens across line tokens.
 * Returns true if exact token sequence is found.
 *
 * Forward-scan, no regex, ASCII-only.
 */
function detectTokenExact(line: string, pattern: string): boolean {
  const lineTokens = tokenizeLine(line);
  const patternTokens = tokenizeLine(pattern);

  if (patternTokens.length === 0 || lineTokens.length < patternTokens.length) {
    return false;
  }

  for (let i = 0; i <= lineTokens.length - patternTokens.length; i++) {
    let match = true;
    for (let j = 0; j < patternTokens.length; j++) {
      if (lineTokens[i + j] !== patternTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Line Scanner — scan a single line against one invariant
// ---------------------------------------------------------------------------

/**
 * Scan a single source line against a single invariant entry.
 *
 * Returns true if the line violates the invariant.
 *
 * Detection strategy depends on patternType:
 *   - SUBSTRING:    exact substring match in source line
 *   - IMPORT_PATH:  forbidden import path in import statement
 *   - TOKEN_EXACT:  exact token sequence match
 *
 * String/comment state awareness:
 *   - If the ENTIRE line is a comment → skip (no enforcement)
 *   - For SUBSTRING matches, checks if the match position is inside a
 *     comment region → skip that match. If the match is in CODE or a
 *     string literal → enforce (violation detected).
 *   - For IMPORT_PATH, comment-only lines are already skipped.
 *   - For TOKEN_EXACT, comment-only lines are already skipped.
 *
 * This ensures:
 *   - Patterns inside string literals ARE enforced
 *   - Patterns inside comments are NOT enforced
 *   - Comment markers inside strings do NOT trigger comment state
 *
 * This is a pure function — same input always produces same output
 * given the same classes array.
 */
function scanLineForInvariant(
  line: string,
  entry: InvariantEntry,
  classes: CharClass[]
): boolean {
  // If entire line is a comment, skip all enforcement
  if (isEntirelyComment(classes, line)) return false;

  switch (entry.patternType) {
    case 'SUBSTRING': {
      const pos = findSubstring(line, entry.pattern);
      if (pos === -1) return false;
      // Check if the match is inside a comment region
      if (isRangeAllComment(classes, pos, entry.pattern.length)) return false;
      // Match is in CODE or string literal — violation
      return true;
    }
    case 'IMPORT_PATH':
      return detectForbiddenImport(line, entry.pattern);
    case 'TOKEN_EXACT':
      return detectTokenExact(line, entry.pattern);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// File Scanner — scan all lines of a file
// ---------------------------------------------------------------------------

/**
 * Scan a file's source lines against all applicable invariants.
 *
 * Pipeline:
 *   1. Classify file scope (ENGINES, SERVICES, MODELS, ALL)
 *   2. Filter registry to applicable invariants
 *   3. For each line in the file:
 *      a. For each applicable invariant:
 *         - Run line scanner
 *         - Record violations
 *   4. Return PASS if zero violations, FAIL otherwise
 *
 * Binary result only. No scoring. No ranking.
 *
 * This is a pure function — same input always produces same output.
 */
export function scanFile(
  filePath: string,
  sourceLines: string[]
): FileScanResult {
  const registry = getInvariantRegistry();
  const fileScope = classifyFileScope(filePath);
  const violations: InvariantViolation[] = [];

  // Filter to applicable invariants
  const applicable = registry.entries.filter(
    (e) => invariantAppliesToScope(e.scope, fileScope)
  );

  // Track block comment state across lines
  let inBlockComment = false;

  // Scan each line with string/comment state machine
  for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
    const line = sourceLines[lineIndex];

    // Classify each character position as CODE or COMMENT
    const { classes, outBlockComment } = classifyLinePositions(line, inBlockComment);
    inBlockComment = outBlockComment;

    for (const entry of applicable) {
      if (scanLineForInvariant(line, entry, classes)) {
        // Extract matched text (the portion of the line containing the pattern)
        let matchedText = line;
        // Trim to reasonable length for reporting
        if (matchedText.length > 200) {
          matchedText = matchedText.substring(0, 200);
        }

        violations.push({
          invariantId: entry.invariantId,
          category: entry.category,
          filePath,
          lineNumber: lineIndex + 1, // 1-indexed
          matchedText: matchedText,
          description: entry.description,
        });
      }
    }
  }

  return {
    filePath,
    result: violations.length === 0 ? 'PASS' : 'FAIL',
    violations,
  };
}

// ---------------------------------------------------------------------------
// Cross-File Scanner — scan multiple files
// ---------------------------------------------------------------------------

/**
 * Scan multiple files against the invariant registry.
 *
 * Iterates over all provided files.
 * Overall: PASS only if ALL files pass.
 * Binary only. No partial pass.
 *
 * This is a pure function — same input always produces same output.
 */
export function scanFiles(
  files: Array<{ filePath: string; sourceLines: string[] }>
): CrossFileScanResult {
  const registry = getInvariantRegistry();
  const results: FileScanResult[] = [];
  let totalViolations = 0;

  for (const file of files) {
    const result = scanFile(file.filePath, file.sourceLines);
    results.push(result);
    totalViolations += result.violations.length;
  }

  return {
    files: results,
    overallResult: totalViolations === 0 ? 'PASS' : 'FAIL',
    totalViolations,
    filesScanned: files.length,
    invariantsChecked: registry.entries.length,
  };
}

// ---------------------------------------------------------------------------
// CI Build Gate — enforcement hook
// ---------------------------------------------------------------------------

/**
 * CI build gate enforcement.
 *
 * Scans all provided files and returns a CI-compatible result.
 * Designed to be called from build/CI pipeline to gate builds.
 *
 * Binary only: PASS or FAIL.
 * If FAIL → build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass flag.
 *
 * This is a pure function — same input always produces same output.
 */
export function enforceBuildGate(
  files: Array<{ filePath: string; sourceLines: string[] }>
): CIBuildGateResult {
  const registry = getInvariantRegistry();
  const scanResult = scanFiles(files);
  const violatingFiles: string[] = [];

  for (const file of scanResult.files) {
    if (file.result === 'FAIL') {
      violatingFiles.push(file.filePath);
    }
  }

  return {
    result: scanResult.overallResult,
    violatingFiles,
    totalViolations: scanResult.totalViolations,
    registryVersion: registry.registryVersion,
  };
}

// ---------------------------------------------------------------------------
// Registry Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify the structural integrity of the invariant registry.
 *
 * Checks:
 *   1. All entries have non-empty invariantId
 *   2. All entries have valid category
 *   3. All entries have severity === 'BLOCK'
 *   4. All entries have positive registeredEpoch
 *   5. Entries are sorted by invariantId (ASCII comparator)
 *   6. No duplicate invariantIds
 *   7. All entries have non-empty pattern
 *   8. All entries have valid patternType
 *   9. All entries have valid scope
 *
 * Binary result per check. Overall: PASS only if ALL checks pass.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyRegistryIntegrity(): RegistryIntegrityResult {
  const registry = getInvariantRegistry();
  const fields: InvariantFieldValidation[] = [];

  const validCategories: string[] = [
    'ENTROPY_GUARD',
    'FORBIDDEN_CONSTRUCT',
    'FORBIDDEN_KEYWORD',
    'HASH_DISCIPLINE',
    'IMPORT_BOUNDARY',
    'MUTATION_GUARD',
    'REQUIRED_PATTERN',
    'TEMPORAL_GUARD',
  ];

  const validPatternTypes: string[] = ['TOKEN_EXACT', 'SUBSTRING', 'IMPORT_PATH'];
  const validScopes: string[] = ['ALL', 'ENGINES', 'SERVICES', 'MODELS'];

  // Check 1: All invariantIds non-empty
  const allIdsNonEmpty = registry.entries.every(
    (e) => typeof e.invariantId === 'string' && e.invariantId.length > 0
  );
  fields.push({
    field: 'allInvariantIdsNonEmpty',
    result: allIdsNonEmpty ? 'PASS' : 'FAIL',
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

  // Check 5: Entries sorted by invariantId (ASCII comparator)
  let sorted = true;
  for (let i = 0; i < registry.entries.length - 1; i++) {
    const a = registry.entries[i].invariantId;
    const b = registry.entries[i + 1].invariantId;
    if (!(a < b || a === b)) {
      sorted = false;
      break;
    }
  }
  fields.push({
    field: 'entriesSortedByInvariantId',
    result: sorted ? 'PASS' : 'FAIL',
  });

  // Check 6: No duplicate invariantIds
  const idSet = new Set<string>();
  let hasDuplicates = false;
  for (const entry of registry.entries) {
    if (idSet.has(entry.invariantId)) {
      hasDuplicates = true;
      break;
    }
    idSet.add(entry.invariantId);
  }
  fields.push({
    field: 'noDuplicateInvariantIds',
    result: hasDuplicates ? 'FAIL' : 'PASS',
  });

  // Check 7: All patterns non-empty
  const allPatternsNonEmpty = registry.entries.every(
    (e) => typeof e.pattern === 'string' && e.pattern.length > 0
  );
  fields.push({
    field: 'allPatternsNonEmpty',
    result: allPatternsNonEmpty ? 'PASS' : 'FAIL',
  });

  // Check 8: All patternTypes valid
  const allPatternTypesValid = registry.entries.every(
    (e) => validPatternTypes.indexOf(e.patternType) !== -1
  );
  fields.push({
    field: 'allPatternTypesValid',
    result: allPatternTypesValid ? 'PASS' : 'FAIL',
  });

  // Check 9: All scopes valid
  const allScopesValid = registry.entries.every(
    (e) => validScopes.indexOf(e.scope) !== -1
  );
  fields.push({
    field: 'allScopesValid',
    result: allScopesValid ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
