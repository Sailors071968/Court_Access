// ============================================================================
// Legal Advice Filter Engine
// Requirement #3: Scan all analysis output text for language that could be
// inferred as legal advice. Replace with neutral, analytical alternatives.
//
// This engine ensures CourtAccess NEVER provides legal advice.
// All output is framed as analytical observation, not recommendation.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterResult {
  originalText: string;
  filteredText: string;
  replacementsApplied: number;
  flaggedPhrases: FlaggedPhrase[];
}

export interface FlaggedPhrase {
  original: string;
  replacement: string;
  position: number;
  category: 'directive' | 'recommendation' | 'opinion' | 'conclusion' | 'guarantee';
}

// ---------------------------------------------------------------------------
// Legal Advice Pattern Database
// Organized by category for clear tracking and auditability.
// ---------------------------------------------------------------------------

const LEGAL_ADVICE_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
  category: FlaggedPhrase['category'];
}> = [
  // --- Directive language ("you should", "you must", "you need to") ---
  { pattern: /\byou should\b/gi, replacement: 'defense professionals may consider whether to', category: 'directive' },
  { pattern: /\byou must\b/gi, replacement: 'it may be appropriate to', category: 'directive' },
  { pattern: /\byou need to\b/gi, replacement: 'consideration could be given to', category: 'directive' },
  { pattern: /\byou have to\b/gi, replacement: 'it may warrant evaluation whether to', category: 'directive' },
  { pattern: /\byou are required to\b/gi, replacement: 'applicable rules may require', category: 'directive' },
  { pattern: /\bthe attorney should\b/gi, replacement: 'the attorney may evaluate whether to', category: 'directive' },
  { pattern: /\bthe defense should\b/gi, replacement: 'the defense may consider whether to', category: 'directive' },
  { pattern: /\bcounsel should\b/gi, replacement: 'counsel may evaluate whether to', category: 'directive' },
  { pattern: /\bthe lawyer should\b/gi, replacement: 'the lawyer may consider whether to', category: 'directive' },
  { pattern: /\bimmediately file\b/gi, replacement: 'consider evaluating the merits of filing', category: 'directive' },
  { pattern: /\bmust file\b/gi, replacement: 'may wish to evaluate filing', category: 'directive' },
  { pattern: /\bshould file\b/gi, replacement: 'could evaluate filing', category: 'directive' },
  { pattern: /\bneed to file\b/gi, replacement: 'may consider filing', category: 'directive' },

  // --- Recommendation language ---
  { pattern: /\bwe recommend\b/gi, replacement: 'the evidence may support consideration of', category: 'recommendation' },
  { pattern: /\bit is recommended\b/gi, replacement: 'the evidence may warrant evaluation of', category: 'recommendation' },
  { pattern: /\bour recommendation is\b/gi, replacement: 'the analytical findings indicate', category: 'recommendation' },
  { pattern: /\bstrongly recommend\b/gi, replacement: 'the evidence prominently indicates', category: 'recommendation' },
  { pattern: /\bwe advise\b/gi, replacement: 'the analysis indicates', category: 'recommendation' },
  { pattern: /\bit is advised\b/gi, replacement: 'the evidence suggests consideration of', category: 'recommendation' },
  { pattern: /\bour advice is\b/gi, replacement: 'the analytical observation is', category: 'recommendation' },
  { pattern: /\bbest course of action\b/gi, replacement: 'potential avenue for professional evaluation', category: 'recommendation' },
  { pattern: /\bthe best strategy\b/gi, replacement: 'one potential approach based on evidence', category: 'recommendation' },
  { pattern: /\bthe recommended approach\b/gi, replacement: 'one analytical observation based on evidence', category: 'recommendation' },

  // --- Opinion language ---
  { pattern: /\bin our opinion\b/gi, replacement: 'based on the evidence analyzed', category: 'opinion' },
  { pattern: /\bin our view\b/gi, replacement: 'from an analytical perspective', category: 'opinion' },
  { pattern: /\bwe believe\b/gi, replacement: 'the evidence indicates', category: 'opinion' },
  { pattern: /\bwe think\b/gi, replacement: 'the evidence suggests', category: 'opinion' },
  { pattern: /\bit is our position\b/gi, replacement: 'the analytical findings show', category: 'opinion' },
  { pattern: /\bwe conclude\b/gi, replacement: 'the evidence documents indicate', category: 'opinion' },
  { pattern: /\bwe find that\b/gi, replacement: 'the evidence documents reflect that', category: 'opinion' },

  // --- Conclusory language ---
  { pattern: /\bthis proves\b/gi, replacement: 'this evidence is consistent with', category: 'conclusion' },
  { pattern: /\bthis establishes\b/gi, replacement: 'this evidence may support', category: 'conclusion' },
  { pattern: /\bthis demonstrates\b/gi, replacement: 'this evidence reflects', category: 'conclusion' },
  { pattern: /\bclearly guilty\b/gi, replacement: 'evidence the prosecution may cite', category: 'conclusion' },
  { pattern: /\bclearly innocent\b/gi, replacement: 'evidence that may support defense arguments', category: 'conclusion' },
  { pattern: /\bwill win\b/gi, replacement: 'may be relevant to', category: 'conclusion' },
  { pattern: /\bwill lose\b/gi, replacement: 'may present challenges regarding', category: 'conclusion' },
  { pattern: /\bguaranteed to\b/gi, replacement: 'the evidence may support', category: 'guarantee' },
  { pattern: /\bwill definitely\b/gi, replacement: 'may potentially', category: 'guarantee' },
  { pattern: /\bwill certainly\b/gi, replacement: 'may', category: 'guarantee' },
  { pattern: /\bis guaranteed\b/gi, replacement: 'is supported by the evidence', category: 'guarantee' },
  { pattern: /\bwill succeed\b/gi, replacement: 'may have merit based on the evidence', category: 'guarantee' },
  { pattern: /\bwill fail\b/gi, replacement: 'may face challenges', category: 'guarantee' },
  { pattern: /\bthe court will\b/gi, replacement: 'the court may', category: 'guarantee' },
  { pattern: /\bthe judge will\b/gi, replacement: 'the court may', category: 'guarantee' },
  { pattern: /\bthe jury will\b/gi, replacement: 'the jury may', category: 'guarantee' },
];

// ---------------------------------------------------------------------------
// Filter Functions
// ---------------------------------------------------------------------------

/**
 * Scan and filter analysis text for legal advice language.
 * Returns the filtered text with all replacements applied.
 */
export function filterLegalAdviceLanguage(text: string): FilterResult {
  let filteredText = text;
  const flaggedPhrases: FlaggedPhrase[] = [];

  for (const { pattern, replacement, category } of LEGAL_ADVICE_PATTERNS) {
    const matches = filteredText.match(pattern);
    if (matches) {
      for (const match of matches) {
        const position = filteredText.indexOf(match);
        flaggedPhrases.push({
          original: match,
          replacement,
          position,
          category,
        });
      }
      filteredText = filteredText.replace(pattern, replacement);
    }
  }

  return {
    originalText: text,
    filteredText,
    replacementsApplied: flaggedPhrases.length,
    flaggedPhrases,
  };
}

/**
 * Check if text contains any legal advice language patterns.
 * Returns true if the text is clean (no legal advice detected).
 */
export function isTextFreeOfLegalAdvice(text: string): boolean {
  const lower = text.toLowerCase();
  return !LEGAL_ADVICE_PATTERNS.some(({ pattern }) => new RegExp(pattern.source, pattern.flags).test(lower));
}

/**
 * Apply legal advice filter to an array of text strings.
 * Useful for batch-filtering analysis results.
 */
export function filterAnalysisOutputs(texts: string[]): FilterResult[] {
  return texts.map(text => filterLegalAdviceLanguage(text));
}

/**
 * Generate a compliance report for a set of analysis texts.
 * Shows total violations found and categories.
 */
export function generateComplianceReport(texts: string[]): {
  totalTextsScanned: number;
  totalViolationsFound: number;
  violationsByCategory: Record<string, number>;
  allTextsCompliant: boolean;
} {
  const results = filterAnalysisOutputs(texts);
  const violationsByCategory: Record<string, number> = {};

  for (const result of results) {
    for (const phrase of result.flaggedPhrases) {
      violationsByCategory[phrase.category] = (violationsByCategory[phrase.category] ?? 0) + 1;
    }
  }

  const totalViolations = results.reduce((sum, r) => sum + r.replacementsApplied, 0);

  return {
    totalTextsScanned: texts.length,
    totalViolationsFound: totalViolations,
    violationsByCategory,
    allTextsCompliant: totalViolations === 0,
  };
}
