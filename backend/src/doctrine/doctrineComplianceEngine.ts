// ============================================
// Court Access — Doctrine Compliance Engine
// Matches evidence text against training doctrine
// to detect potential violations.
// ============================================

import type {
  DoctrineRule,
  DoctrineMatch,
  DoctrineComplianceResult,
  DoctrineFlagType,
  DoctrineSearchOptions,
} from './types.ts';
import { doctrineStore } from './doctrineStore.ts';
import { doctrineEmbeddingPipeline } from './doctrineEmbeddingPipeline.ts';

// ---------------------------------------------------------------------------
// Flag Thresholds
// ---------------------------------------------------------------------------

const VIOLATION_THRESHOLD = 0.80;
const CONCERN_THRESHOLD = 0.60;

// ---------------------------------------------------------------------------
// Violation Indicator Patterns
// ---------------------------------------------------------------------------

const VIOLATION_INDICATORS = [
  // LD-15: Laws of Arrest
  /(?:no|without|lack(?:ing|ed)?)\s+(?:reasonable\s+)?suspicion/i,
  /(?:no|without|lack(?:ing|ed)?)\s+probable\s+cause/i,
  /(?:did\s+not|didn't|failed\s+to)\s+(?:read|give|provide|administer)\s+miranda/i,
  /miranda\s+(?:rights?\s+)?(?:were|was)?\s*(?:not|never)\s+(?:read|given|provided|administered)/i,
  /(?:did\s+not|didn't|failed\s+to)\s+(?:obtain|get|secure)\s+(?:a\s+)?(?:warrant|consent)/i,
  /(?:looked?\s+)?(?:nervous|suspicious)\s+(?:only|alone|just)/i,
  /(?:mere|just\s+a)\s+hunch/i,
  /(?:racial|ethnic)\s+(?:profiling|basis|appearance)/i,
  /(?:coerced?|forced?|threatened?|intimidated?)\s+(?:confession|statement|admission)/i,
  /(?:easy\s+way\s+or\s+the?\s+hard\s+way|do\s+this\s+the\s+(?:easy|hard))/i,
  /(?:excessive|unnecessary|unreasonable)\s+force/i,
  /(?:prolonged|extended|unreasonable)\s+detention/i,
  /(?:searched|search(?:ing)?)\s+(?:him|her|them|the\s+\w+\s+)?(?:without|before)\s+(?:consent|warrant|permission|stating|asking)/i,
  /(?:continued|continues|kept)\s+(?:questioning|interrogating|to\s+question)/i,
  /(?:i\s+(?:want|said\s+i\s+want)|request(?:ed)?)\s+(?:a\s+)?(?:lawyer|attorney)/i,
  // LD-16: Search & Seizure violations
  /(?:no|without|lack(?:ing|ed)?)\s+(?:a\s+)?warrant/i,
  /without\s+(?:obtaining\s+)?(?:a\s+)?(?:warrant|consent)/i,
  /(?:exceeded|beyond|exceeding)\s+(?:the\s+)?scope\s+(?:of\s+)?(?:warrant|consent|search|stop)/i,
  /stale\s+(?:information|probable\s+cause|warrant)/i,
  // LD-17: Evidence presentation violations
  /(?:break|gap|missing)\s+(?:in\s+)?(?:the\s+)?chain\s+of\s+custody/i,
  /chain\s+of\s+custody\s+(?:had|has|showed?|with)\s+(?:a\s+)?(?:gap|break|lapse)/i,
  /tamper(?:ed|ing)?\s+(?:with\s+)?evidence/i,
  // LD-18: Report writing violations
  /(?:false|misleading|inaccurate)\s+(?:statement|report|information)/i,
  /(?:omitted|excluded|left\s+out)\s+(?:exculpatory|favorable|relevant)/i,
  /(?:altered|backdated|modified)\s+(?:the\s+)?report/i,
  /(?:subjective)\s+(?:language|description|statement)/i,
  // LD-20: Use of force violations
  /(?:shot|fired)\s+(?:at\s+)?(?:unarmed|fleeing|restrained)/i,
  /(?:unarmed|fleeing)\s+(?:and\s+)?(?:was\s+)?(?:shot|killed|fired)/i,
  /(?:choke|chokehold|carotid|neck\s+restraint)/i,
  /(?:force|struck|hit|tased)\s+(?:the\s+)?(?:\w+\s+)*(?:while\s+)?(?:handcuffed|restrained|compliant)/i,
  /struck\s+(?:the\s+)?(?:\w+\s+){0,3}(?:handcuffed|restrained|compliant)/i,
  /(?:failed\s+to|did\s+not)\s+(?:de-escalate|intervene|provide\s+medical)/i,
  // LD-24: Evidence handling violations
  /(?:contaminated|cross-contaminated|degraded)\s+evidence/i,
  /(?:improperly|incorrectly)\s+(?:packaged|stored|labeled|collected)/i,
  /evidence\s+(?:was\s+)?(?:improperly|incorrectly)\s+(?:packaged|stored|labeled|collected)/i,
  // LD-30: Crime scene violations
  /(?:compromised|unsecured|contaminated)\s+(?:crime\s+)?scene/i,
  /(?:crime\s+)?scene\s+(?:was\s+)?(?:compromised|unsecured|contaminated)/i,
  /(?:failed\s+to|did\s+not)\s+(?:secure|preserve|document)\s+(?:the\s+)?(?:scene|evidence)/i,
  /without\s+(?:proper\s+)?(?:protocols?|procedures?)/i,
];

const CONCERN_INDICATORS = [
  // LD-15: Laws of Arrest concerns
  /(?:officer\s+)?(?:believed|thought|felt|suspected)/i,
  /(?:appeared\s+to\s+be|seemed|appeared)\s+(?:nervous|agitated|evasive)/i,
  /(?:appeared\s+)(?:nervous|agitated|suspicious)/i,
  /(?:high[- ]crime|known\s+crime)\s+area/i,
  /(?:furtive|evasive)\s+(?:movement|gesture|behavior)/i,
  /(?:consented|agreed)\s+(?:to|after)\s+(?:questioning|search)/i,
  /(?:voluntary|voluntarily)\s+(?:provided|gave|offered)/i,
  /(?:grabbed|seized|took\s+hold)/i,
  /(?:officer\s+)?(?:seemed|appeared)\s+(?:aggressive|hostile)/i,
  // LD-16: Search & Seizure concerns
  /(?:extended|prolonged)\s+(?:the\s+)?(?:traffic\s+)?stop/i,
  /(?:inventory|administrative)\s+search/i,
  /pat\s+(?:search|down)\s+without/i,
  // LD-17: Evidence presentation concerns
  /(?:inconsistent|contradictory)\s+(?:testimony|statement|report)/i,
  /(?:unable|could\s+not)\s+(?:recall|remember|identify)/i,
  // LD-18: Report writing concerns
  /(?:subjective|vague|general)\s+(?:language|statement|description)/i,
  // LD-20: Use of force concerns
  /(?:significant|substantial|considerable)\s+force/i,
  /(?:mental\s+health|psychiatric)\s+(?:crisis|episode|condition)/i,
  // LD-24: Evidence handling concerns
  /(?:delayed|late)\s+(?:collection|processing|packaging)/i,
  // LD-30: Crime scene concerns
  /(?:multiple|numerous)\s+(?:people|persons|officers)\s+(?:entered|accessed|walked)/i,
  /(?:scene|evidence)\s+(?:was\s+)?(?:compromised|contaminated)/i,
  /(?:wasn't|was\s+not)\s+doing\s+anything\s+wrong/i,
];

// ---------------------------------------------------------------------------
// Doctrine Compliance Engine
// ---------------------------------------------------------------------------

export class DoctrineComplianceEngine {
  /**
   * Analyze evidence text against all stored doctrine rules.
   * Returns a full compliance result with violations, concerns, and compliant matches.
   */
  static async analyzeCompliance(
    evidenceText: string,
    options?: DoctrineSearchOptions,
  ): Promise<DoctrineComplianceResult> {
    // Get candidate rules
    let candidateRules: DoctrineRule[];
    if (options?.category) {
      candidateRules = doctrineStore.getByCategory(options.category);
    } else {
      candidateRules = doctrineStore.getAll();
    }

    if (options?.chapter) {
      candidateRules = candidateRules.filter((r) => r.chapter === options.chapter);
    }
    if (options?.domain) {
      candidateRules = candidateRules.filter((r) => r.domain === options.domain);
    }

    // Compute similarity scores
    const queryEmbedding = await doctrineEmbeddingPipeline.embedText(evidenceText);
    const matches: DoctrineMatch[] = [];
    const minSimilarity = options?.minSimilarity ?? 0.3;

    for (const rule of candidateRules) {
      const ruleEmbedding = doctrineEmbeddingPipeline.getEmbedding(rule.doctrineId);
      if (!ruleEmbedding) continue;

      const similarityScore = doctrineEmbeddingPipeline.cosineSimilarity(
        queryEmbedding,
        ruleEmbedding,
      );

      if (similarityScore < minSimilarity) continue;

      // Determine flag type based on similarity + violation indicators
      const flagType = DoctrineComplianceEngine.determineFlagType(
        evidenceText,
        rule,
        similarityScore,
      );

      const flagDescription = DoctrineComplianceEngine.generateFlagDescription(
        rule,
        flagType,
        similarityScore,
      );

      matches.push({
        doctrineRule: rule,
        similarityScore,
        flagType,
        flagDescription,
      });
    }

    // Sort by similarity score descending
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Apply max results
    const maxResults = options?.maxResults ?? 20;
    const topMatches = matches.slice(0, maxResults);

    const violations = topMatches.filter((m) => m.flagType === 'violation');
    const concerns = topMatches.filter((m) => m.flagType === 'concern');
    const compliant = topMatches.filter((m) => m.flagType === 'compliant');

    const overallCompliance = violations.length > 0
      ? 'violations'
      : concerns.length > 0
        ? 'concerns'
        : 'compliant';

    return {
      evidenceText,
      matches: topMatches,
      totalRulesChecked: candidateRules.length,
      violations,
      concerns,
      compliant,
      overallCompliance,
      analyzedAt: new Date(),
    };
  }

  /**
   * Quick scan: check if evidence text triggers any doctrine violations.
   * Returns only violations and concerns, no compliant matches.
   */
  static async quickScan(
    evidenceText: string,
  ): Promise<{ violations: DoctrineMatch[]; concerns: DoctrineMatch[] }> {
    const result = await DoctrineComplianceEngine.analyzeCompliance(evidenceText, {
      maxResults: 10,
      minSimilarity: 0.5,
    });
    return {
      violations: result.violations,
      concerns: result.concerns,
    };
  }

  /**
   * Batch analyze multiple evidence texts.
   */
  static async batchAnalyze(
    texts: string[],
    options?: DoctrineSearchOptions,
  ): Promise<DoctrineComplianceResult[]> {
    const results: DoctrineComplianceResult[] = [];
    for (const text of texts) {
      results.push(await DoctrineComplianceEngine.analyzeCompliance(text, options));
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Determine the flag type based on evidence text analysis.
   */
  private static determineFlagType(
    evidenceText: string,
    rule: DoctrineRule,
    similarityScore: number,
  ): DoctrineFlagType {
    // Check for explicit violation indicators in the evidence
    const hasViolationIndicator = VIOLATION_INDICATORS.some((p) => p.test(evidenceText));
    const hasConcernIndicator = CONCERN_INDICATORS.some((p) => p.test(evidenceText));

    // Compute keyword overlap between evidence and rule for relevance boosting
    const keywordOverlap = DoctrineComplianceEngine.computeKeywordOverlap(evidenceText, rule);

    // Effective similarity: boost by keyword overlap for more accurate flagging
    // This compensates for demo/deterministic embeddings that produce lower similarity
    const effectiveSimilarity = Math.min(1.0, similarityScore + keywordOverlap * 0.3);

    // High effective similarity + violation indicator = violation
    if (effectiveSimilarity >= VIOLATION_THRESHOLD && hasViolationIndicator) {
      return 'violation';
    }

    // Medium effective similarity + violation indicator = concern
    if (effectiveSimilarity >= CONCERN_THRESHOLD && hasViolationIndicator) {
      return 'concern';
    }

    // High effective similarity + concern indicator = concern
    if (effectiveSimilarity >= VIOLATION_THRESHOLD && hasConcernIndicator) {
      return 'concern';
    }

    // Check for negative/contradictory language against the rule
    const ruleNegation = DoctrineComplianceEngine.detectRuleNegation(evidenceText, rule);
    if (ruleNegation && effectiveSimilarity >= CONCERN_THRESHOLD) {
      return 'violation';
    }

    // Moderate similarity + violation indicator + keyword overlap = concern
    // Requires keyword overlap to ensure the rule is topically relevant to the violation
    if (similarityScore >= 0.4 && hasViolationIndicator && keywordOverlap > 0) {
      return 'concern';
    }

    // Any keyword overlap + violation indicator = concern
    if (keywordOverlap >= 0.15 && hasViolationIndicator) {
      return 'concern';
    }

    // Moderate similarity + concern indicator + keyword overlap = concern
    if (similarityScore >= 0.4 && hasConcernIndicator && keywordOverlap > 0) {
      return 'concern';
    }

    // Keyword overlap + concern indicator = concern
    if (keywordOverlap >= 0.2 && hasConcernIndicator && similarityScore >= 0.3) {
      return 'concern';
    }

    // High effective similarity without indicators = compliant (rule is relevant)
    if (effectiveSimilarity >= CONCERN_THRESHOLD) {
      return hasConcernIndicator ? 'concern' : 'compliant';
    }

    return 'compliant';
  }

  /**
   * Compute keyword overlap ratio between evidence text and a doctrine rule.
   * Returns 0-1 indicating what fraction of rule keywords appear in the evidence.
   */
  private static computeKeywordOverlap(evidenceText: string, rule: DoctrineRule): number {
    if (rule.keywords.length === 0) return 0;
    const lowerEvidence = evidenceText.toLowerCase();
    const matchCount = rule.keywords.filter((kw) =>
      lowerEvidence.includes(kw.toLowerCase()),
    ).length;
    return matchCount / rule.keywords.length;
  }

  /**
   * Check if the evidence text contradicts the doctrine rule.
   */
  private static detectRuleNegation(evidenceText: string, rule: DoctrineRule): boolean {
    const lowerEvidence = evidenceText.toLowerCase();
    const lowerRule = rule.ruleText.toLowerCase();

    // If rule says "must" or "required" and evidence says "did not"
    if (/(?:must|shall|required|requires)/.test(lowerRule)) {
      if (/(?:did\s+not|didn't|failed\s+to|never|without)/.test(lowerEvidence)) {
        // Check if the subject matter overlaps
        const ruleKeywords = rule.keywords;
        const evidenceHasKeyword = ruleKeywords.some((kw) =>
          lowerEvidence.includes(kw.toLowerCase()),
        );
        if (evidenceHasKeyword) return true;
      }
    }

    return false;
  }

  /**
   * Generate a human-readable flag description.
   */
  private static generateFlagDescription(
    rule: DoctrineRule,
    flagType: DoctrineFlagType,
    similarityScore: number,
  ): string {
    const pct = Math.round(similarityScore * 100);

    switch (flagType) {
      case 'violation':
        return `Potential ${rule.category} doctrine violation: ${rule.topic}. ` +
          `Training doctrine states: "${rule.ruleText.slice(0, 120)}..." ` +
          `(${pct}% relevance). ${rule.legalImplication ?? ''}`;

      case 'concern':
        return `${rule.category} compliance concern: ${rule.topic}. ` +
          `Related doctrine: "${rule.ruleText.slice(0, 100)}..." ` +
          `(${pct}% relevance). Review recommended.`;

      case 'compliant':
        return `Evidence aligns with ${rule.category} doctrine: ${rule.topic}. ` +
          `(${pct}% relevance)`;
    }
  }
}
