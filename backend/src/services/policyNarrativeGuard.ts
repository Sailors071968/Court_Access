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
      const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
      result = result.replace(regex, replacement);
    }
    return result;
  }

  /**
   * Check if text contains any forbidden terms.
   */
  static audit(text: string): { clean: boolean; violations: string[] } {
    const found: string[] = [];
    const lower = text.toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      if (lower.includes(term.toLowerCase())) {
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
