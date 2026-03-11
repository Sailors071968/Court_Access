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
  /(?:did\s+not|didn't|failed\s+to)\s+(?:obtain|get|secure)\s+(?:a\s+)?(?:warrant|consent)/i,
  /(?:looked?\s+)?(?:nervous|suspicious)\s+(?:only|alone|just)/i,
  /(?:mere|just\s+a)\s+hunch/i,
  /(?:racial|ethnic)\s+(?:profiling|basis|appearance)/i,
  /(?:coerced?|forced?|threatened?|intimidated?)\s+(?:confession|statement|admission)/i,
  /(?:excessive|unnecessary|unreasonable)\s+force/i,
  /(?:prolonged|extended|unreasonable)\s+detention/i,
  /(?:searched|searched\s+without)\s+(?:consent|warrant|authority)/i,
  /(?:continued|kept)\s+(?:questioning|interrogating)\s+(?:after|despite)/i,
  // LD-16: Search & Seizure violations
  /(?:no|without|lack(?:ing|ed)?)\s+(?:a\s+)?warrant/i,
  /(?:exceeded|beyond)\s+(?:the\s+)?scope\s+(?:of\s+)?(?:warrant|consent|search)/i,
  /stale\s+(?:information|probable\s+cause|warrant)/i,
  // LD-17: Evidence presentation violations
  /(?:break|gap|missing)\s+(?:in\s+)?chain\s+of\s+custody/i,
  /tamper(?:ed|ing)?\s+(?:with\s+)?evidence/i,
  // LD-18: Report writing violations
  /(?:false|misleading|inaccurate)\s+(?:statement|report|information)/i,
  /(?:omitted|excluded|left\s+out)\s+(?:exculpatory|favorable|relevant)/i,
  /(?:altered|backdated|modified)\s+(?:the\s+)?report/i,
  // LD-20: Use of force violations
  /(?:shot|fired)\s+(?:at\s+)?(?:unarmed|fleeing|restrained)/i,
  /(?:choke|chokehold|carotid|neck\s+restraint)/i,
  /(?:force|struck|hit|tased)\s+(?:while\s+)?(?:handcuffed|restrained|compliant)/i,
  /(?:failed\s+to|did\s+not)\s+(?:de-escalate|intervene|provide\s+medical)/i,
  // LD-24: Evidence handling violations
  /(?:contaminated|cross-contaminated|degraded)\s+evidence/i,
  /(?:improperly|incorrectly)\s+(?:packaged|stored|labeled|collected)/i,
  // LD-30: Crime scene violations
  /(?:compromised|unsecured|contaminated)\s+(?:crime\s+)?scene/i,
  /(?:failed\s+to|did\s+not)\s+(?:secure|preserve|document)\s+(?:the\s+)?(?:scene|evidence)/i,
];

const CONCERN_INDICATORS = [
  // LD-15: Laws of Arrest concerns
  /(?:officer\s+)?(?:believed|thought|felt|suspected)/i,
  /(?:appeared\s+to\s+be|seemed)\s+(?:nervous|agitated|evasive)/i,
  /(?:high[- ]crime|known\s+crime)\s+area/i,
  /(?:furtive|evasive)\s+(?:movement|gesture|behavior)/i,
  /(?:consented|agreed)\s+(?:to|after)\s+(?:questioning|search)/i,
  /(?:voluntary|voluntarily)\s+(?:provided|gave|offered)/i,
  // LD-16: Search & Seizure concerns
  /(?:extended|prolonged)\s+(?:the\s+)?(?:traffic\s+)?stop/i,
  /(?:inventory|administrative)\s+search/i,
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

    // High similarity + violation indicator = violation
    if (similarityScore >= VIOLATION_THRESHOLD && hasViolationIndicator) {
      return 'violation';
    }

    // Medium similarity + violation indicator = concern
    if (similarityScore >= CONCERN_THRESHOLD && hasViolationIndicator) {
      return 'concern';
    }

    // High similarity + concern indicator = concern
    if (similarityScore >= VIOLATION_THRESHOLD && hasConcernIndicator) {
      return 'concern';
    }

    // Check for negative/contradictory language against the rule
    const ruleNegation = DoctrineComplianceEngine.detectRuleNegation(evidenceText, rule);
    if (ruleNegation && similarityScore >= CONCERN_THRESHOLD) {
      return 'violation';
    }

    // High similarity without indicators = compliant (rule is relevant)
    if (similarityScore >= CONCERN_THRESHOLD) {
      return hasConcernIndicator ? 'concern' : 'compliant';
    }

    return 'compliant';
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
