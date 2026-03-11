// ============================================================================
// Phase 259 — Legal Neutrality Guard
// CourtAccess must NEVER claim policy violations.
// This guard wraps all AI output.
// ============================================================================

const FORBIDDEN_TERMS = [
  'violation',
  'misconduct',
  'illegal action',
  'policy breach',
  'broke the law',
  'unlawful',
  'criminal behavior',
  'guilty of',
  'committed a crime',
];

const ALLOWED_REPLACEMENTS: Record<string, string> = {
  'violation': 'potential policy inconsistency',
  'misconduct': 'possible deviation from standard procedure',
  'illegal action': 'action requiring further review',
  'policy breach': 'observation regarding policy alignment',
  'broke the law': 'evidence suggests deviation',
  'unlawful': 'potentially inconsistent with established procedure',
  'criminal behavior': 'behavior requiring further analysis',
  'guilty of': 'associated with',
  'committed a crime': 'evidence suggests involvement in',
};

export class PolicyNarrativeGuard {
  /**
   * Sanitize AI-generated text to ensure legal neutrality.
   * Replaces forbidden terms with allowed neutral language.
   */
  static sanitize(text: string): string {
    let result = text;
    for (const [forbidden, replacement] of Object.entries(ALLOWED_REPLACEMENTS)) {
      // Single-word: \b${term}\w*\b to catch plurals/suffixes
      // Multi-word: exact match with \b boundaries (no \w* suffix)
      // e.g. "guilty of" → \bguilty\s+of\b (won't match "guilty officer")
      const words = forbidden.split(/\s+/);
      const pattern = words.length > 1
        ? `\\b${words.join('\\s+')}\\b`
        : `\\b${forbidden}\\w*\\b`;
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, replacement);
    }
    return result;
  }

  /**
   * Check if text contains any forbidden terms.
   */
  static audit(text: string): { clean: boolean; violations: string[] } {
    const found: string[] = [];
    for (const term of FORBIDDEN_TERMS) {
      const words = term.split(/\s+/);
      const pattern = words.length > 1
        ? `\\b${words.join('\\s+')}\\b`
        : `\\b${term}\\w*\\b`;
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(text)) {
        found.push(term);
      }
    }
    return { clean: found.length === 0, violations: found };
  }

  /**
   * Wrap any AI output through the guard before returning to users.
   */
  static guard(aiOutput: string): string {
    return PolicyNarrativeGuard.sanitize(aiOutput);
  }
}
