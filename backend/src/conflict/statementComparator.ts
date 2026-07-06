// ============================================
// Court Access — Statement Comparator
// Compares officer statements vs. witness testimony
// to detect factual, temporal, spatial, and
// quantitative contradictions.
// ============================================

import { createHash } from 'node:crypto';
import type {
  Statement,
  StatementComparisonResult,
  DetectedConflict,
  ConflictScoringFactors,
} from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface StatementComparatorConfig {
  /** Similarity threshold below which statements are considered contradictory (0.0–1.0) */
  contradictionThreshold: number;
  /** Minimum statement length to analyze (skip very short fragments) */
  minStatementLength: number;
  /** Maximum statements to compare (n^2 guard) */
  maxStatementsToCompare: number;
  /** Whether to detect cross-role contradictions only (officer vs witness) */
  crossRoleOnly: boolean;
}

const DEFAULT_CONFIG: StatementComparatorConfig = {
  contradictionThreshold: 0.3,
  minStatementLength: 20,
  maxStatementsToCompare: 10_000,
  crossRoleOnly: false,
};

// ---------------------------------------------------------------------------
// Negation & Contradiction Patterns
// ---------------------------------------------------------------------------

const NEGATION_PAIRS: ReadonlyArray<[RegExp, RegExp]> = [
  [/\bdid\b/i, /\bdid not\b|didn't\b/i],
  [/\bwas\b/i, /\bwas not\b|wasn't\b/i],
  [/\bsaw\b/i, /\bdid not see\b|didn't see\b|never saw\b/i],
  [/\bpresent\b/i, /\bnot present\b|absent\b/i],
  [/\bbefore\b/i, /\bafter\b/i],
  [/\bleft\b/i, /\bright\b/i],
  [/\bnorth\b/i, /\bsouth\b/i],
  [/\beast\b/i, /\bwest\b/i],
  [/\byes\b/i, /\bno\b/i],
  [/\barmed\b/i, /\bunarmed\b/i],
  [/\bcompliant\b/i, /\bresist(?:ing|ed)?\b|non-compliant\b/i],
];

const QUANTITATIVE_PATTERN = /\b(\d+(?:\.\d+)?)\s*(minutes?|hours?|feet|meters?|people|officers?|shots?|times?)\b/gi;

// ---------------------------------------------------------------------------
// Statement Comparator
// ---------------------------------------------------------------------------

export class StatementComparator {
  private readonly config: StatementComparatorConfig;

  constructor(config?: Partial<StatementComparatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Compare all statements pairwise and detect contradictions.
   */
  compareStatements(
    statements: Statement[],
    tenantId: string,
  ): { comparisons: StatementComparisonResult[]; detectedConflicts: DetectedConflict[] } {
    const filtered = statements
      .filter(s => s.content.length >= this.config.minStatementLength)
      .slice(0, this.config.maxStatementsToCompare);

    const comparisons: StatementComparisonResult[] = [];
    const detectedConflicts: DetectedConflict[] = [];

    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i];
        const b = filtered[j];

        // If cross-role only, skip same-role comparisons
        if (this.config.crossRoleOnly && a.speakerRole === b.speakerRole) continue;

        const result = this.comparePair(a, b);
        if (result.isContradiction) {
          comparisons.push(result);
          detectedConflicts.push(this.toDetectedConflict(result, tenantId));
        }
      }
    }

    return { comparisons, detectedConflicts };
  }

  // -----------------------------------------------------------------------
  // Pair Comparison
  // -----------------------------------------------------------------------

  /**
   * Compare two statements for contradictions.
   */
  private comparePair(a: Statement, b: Statement): StatementComparisonResult {
    const contradictions: StatementComparisonResult['contradictions'] = [];

    // 1. Check negation-based contradictions
    const negationHits = this.detectNegationContradictions(a.content, b.content);
    contradictions.push(...negationHits);

    // 2. Check quantitative contradictions
    const quantHits = this.detectQuantitativeContradictions(a.content, b.content);
    contradictions.push(...quantHits);

    // 3. Check temporal contradictions (before/after inversions)
    const temporalHits = this.detectTemporalContradictions(a.content, b.content);
    contradictions.push(...temporalHits);

    // Compute similarity (token-overlap based)
    const similarity = this.computeSimilarity(a.content, b.content);

    // A contradiction exists if we found specific patterns OR similarity is very low
    // on topically-related statements
    const isContradiction =
      contradictions.length > 0 ||
      (similarity < this.config.contradictionThreshold && this.topicallyRelated(a.content, b.content));

    return {
      statementA: a,
      statementB: b,
      similarity,
      isContradiction,
      contradictions,
    };
  }

  // -----------------------------------------------------------------------
  // Contradiction Detectors
  // -----------------------------------------------------------------------

  private detectNegationContradictions(
    textA: string,
    textB: string,
  ): StatementComparisonResult['contradictions'] {
    const hits: StatementComparisonResult['contradictions'] = [];

    for (const [positive, negative] of NEGATION_PAIRS) {
      const aHasPositive = positive.test(textA);
      const bHasNegative = negative.test(textB);
      const aHasNegative = negative.test(textA);
      const bHasPositive = positive.test(textB);

      if ((aHasPositive && bHasNegative) || (aHasNegative && bHasPositive)) {
        const matchA = textA.match(aHasPositive ? positive : negative);
        const matchB = textB.match(bHasNegative ? negative : positive);
        hits.push({
          fragmentA: matchA ? matchA[0] : textA.slice(0, 50),
          fragmentB: matchB ? matchB[0] : textB.slice(0, 50),
          category: 'factual',
        });
      }
    }

    return hits;
  }

  private detectQuantitativeContradictions(
    textA: string,
    textB: string,
  ): StatementComparisonResult['contradictions'] {
    const hits: StatementComparisonResult['contradictions'] = [];

    const extractQuantities = (text: string): Map<string, number[]> => {
      const quantities = new Map<string, number[]>();
      let match: RegExpExecArray | null;
      const pattern = new RegExp(QUANTITATIVE_PATTERN.source, 'gi');
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase().replace(/s$/, '');
        const existing = quantities.get(unit) ?? [];
        existing.push(value);
        quantities.set(unit, existing);
      }
      return quantities;
    };

    const qA = extractQuantities(textA);
    const qB = extractQuantities(textB);

    for (const [unit, valuesA] of qA) {
      const valuesB = qB.get(unit);
      if (!valuesB) continue;

      for (const va of valuesA) {
        for (const vb of valuesB) {
          // Flag if quantities differ by more than 50%
          const ratio = Math.abs(va - vb) / Math.max(va, vb, 1);
          if (ratio > 0.5) {
            hits.push({
              fragmentA: `${va} ${unit}`,
              fragmentB: `${vb} ${unit}`,
              category: 'quantitative',
            });
          }
        }
      }
    }

    return hits;
  }

  private detectTemporalContradictions(
    textA: string,
    textB: string,
  ): StatementComparisonResult['contradictions'] {
    const hits: StatementComparisonResult['contradictions'] = [];

    // Simple before/after inversion detection
    const beforeAfterPattern = /(\w+(?:\s+\w+)?)\s+(before|after)\s+(\w+(?:\s+\w+)?)/gi;

    const extractOrdering = (text: string): Array<{ first: string; second: string }> => {
      const orderings: Array<{ first: string; second: string }> = [];
      let match: RegExpExecArray | null;
      const pattern = new RegExp(beforeAfterPattern.source, 'gi');
      while ((match = pattern.exec(text)) !== null) {
        const relation = match[2].toLowerCase();
        if (relation === 'before') {
          orderings.push({ first: match[1].toLowerCase(), second: match[3].toLowerCase() });
        } else {
          orderings.push({ first: match[3].toLowerCase(), second: match[1].toLowerCase() });
        }
      }
      return orderings;
    };

    const orderingsA = extractOrdering(textA);
    const orderingsB = extractOrdering(textB);

    for (const oa of orderingsA) {
      for (const ob of orderingsB) {
        // Detect inversion: A says X before Y, B says Y before X
        if (
          this.fuzzyMatch(oa.first, ob.second) &&
          this.fuzzyMatch(oa.second, ob.first)
        ) {
          hits.push({
            fragmentA: `${oa.first} before ${oa.second}`,
            fragmentB: `${ob.first} before ${ob.second}`,
            category: 'temporal',
          });
        }
      }
    }

    return hits;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private computeSimilarity(a: string, b: string): number {
    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const setB = new Set(tokensB);
    let overlap = 0;
    for (const t of tokensA) {
      if (setB.has(t)) overlap++;
    }
    return (2 * overlap) / (tokensA.length + tokensB.length);
  }

  private topicallyRelated(a: string, b: string): boolean {
    return this.computeSimilarity(a, b) >= 0.2;
  }

  private fuzzyMatch(a: string, b: string): boolean {
    const na = a.trim().toLowerCase();
    const nb = b.trim().toLowerCase();
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'was', 'were', 'are', 'been', 'be',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
      'that', 'this', 'these', 'those', 'it', 'its', 'i', 'he',
      'she', 'they', 'we', 'my', 'his', 'her', 'their', 'our',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t));
  }

  /**
   * Convert a StatementComparisonResult to a DetectedConflict.
   */
  private toDetectedConflict(
    result: StatementComparisonResult,
    tenantId: string,
  ): DetectedConflict {
    const a = result.statementA;
    const b = result.statementB;

    // Score based on number and types of contradictions
    const contradictionCount = result.contradictions.length;
    const hasFactual = result.contradictions.some(c => c.category === 'factual');
    const hasTemporal = result.contradictions.some(c => c.category === 'temporal');
    // hasQuantitative available for future scoring refinement
    void result.contradictions.some(c => c.category === 'quantitative');

    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: hasTemporal ? 0.8 : 0.2,
      evidenceReliability: this.roleReliability(a.speakerRole, b.speakerRole),
      policyViolationWeight: hasFactual ? 0.6 : 0.1,
      supportingSourceCount: a.speakerId === b.speakerId ? 1 : 2,
    };

    const severityScore =
      factors.temporalContradictionStrength * 0.35 +
      factors.evidenceReliability * 0.25 +
      factors.policyViolationWeight * 0.25 +
      Math.min(factors.supportingSourceCount / 5, 1.0) * 0.15;

    const id = createHash('sha256')
      .update(`testimony:${a.id}:${b.id}:${tenantId}`)
      .digest('hex')
      .slice(0, 16);

    const categoryList = result.contradictions
      .map(c => c.category)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ');

    return {
      id: `conflict-${id}`,
      conflictType: 'testimony',
      description:
        `Testimony contradiction between ${a.speakerRole} "${a.speakerName}" and ` +
        `${b.speakerRole} "${b.speakerName}": ${contradictionCount} contradictions ` +
        `found (${categoryList})`,
      severity: {
        severityScore: Math.min(1.0, Math.max(0.0, severityScore)),
        severity: this.scoreToBand(severityScore),
        factors,
        weights: {
          temporalContradictionStrength: 0.35,
          evidenceReliability: 0.25,
          policyViolationWeight: 0.25,
          supportingSourceCount: 0.15,
        },
      },
      sourceNodeIds: [a.id],
      targetNodeIds: [b.id],
      evidenceIds: [],
      tenantId,
      sourceDocumentIds: [a.sourceDocumentId, b.sourceDocumentId].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ),
      detectedAt: new Date(),
    };
  }

  /**
   * Compute evidence reliability based on speaker roles.
   * Officer vs. witness contradictions are weighted higher.
   */
  private roleReliability(roleA: string, roleB: string): number {
    const isOfficer = roleA === 'officer' || roleB === 'officer';
    const isWitness = roleA === 'witness' || roleB === 'witness';
    const isExpert = roleA === 'expert' || roleB === 'expert';

    if (isOfficer && isWitness) return 0.9;  // high reliability — official vs civilian
    if (isExpert) return 0.85;                // expert testimony carries weight
    if (isOfficer) return 0.8;                // officer-only contradictions
    return 0.6;                               // witness-only or defendant
  }

  private scoreToBand(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.85) return 'critical';
    if (score >= 0.65) return 'high';
    if (score >= 0.40) return 'medium';
    return 'low';
  }
}
