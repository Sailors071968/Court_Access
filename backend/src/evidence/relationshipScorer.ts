// ============================================
// Court Access — Relationship Scorer
// Multi-factor deterministic scoring for
// evidence-to-entity relationships.
// ============================================

import type { ExtractedEntity } from '../graph/types.ts';
import type {
  ScoringFactors,
  ScoringWeights,
  RelationshipScore,
} from './types.ts';
import {
  DEFAULT_SCORING_WEIGHTS,
  CONFIDENCE_THRESHOLD,
} from './types.ts';
import type { EmbeddingService } from './embeddingService.ts';

// ---------------------------------------------------------------------------
// Legal reference patterns for legalReferenceStrength scoring
// ---------------------------------------------------------------------------

const LEGAL_REF_PATTERNS: ReadonlyArray<{ pattern: RegExp; weight: number }> = [
  // Statute citations: "42 U.S.C. ss 1983", "18 USC 242"
  { pattern: /\d+\s*U\.?S\.?C\.?\s*(?:§|ss?|[Ss]ection)\s*\d+/gi, weight: 1.0 },
  // Case citations: "Miranda v. Arizona, 384 U.S. 436 (1966)"
  { pattern: /\b[A-Z][a-z]+\s+v\.\s+[A-Z][a-z]+/g, weight: 0.9 },
  // Policy references: "Policy 4.01", "Department Policy No. 123"
  { pattern: /\b[Pp]olicy\s+(?:No\.?\s*)?\d+(?:\.\d+)*/g, weight: 0.8 },
  // Section references: "Section 7.3", "ss 1983"
  { pattern: /(?:§|[Ss]ection)\s*\d+(?:\.\d+)*/g, weight: 0.7 },
  // Amendment references: "Fourth Amendment", "14th Amendment"
  { pattern: /(?:\d+(?:st|nd|rd|th)|[A-Z][a-z]+)\s+[Aa]mendment/g, weight: 0.85 },
  // CFR references: "28 C.F.R. ss 35.130"
  { pattern: /\d+\s*C\.?F\.?R\.?\s*(?:§|ss?|[Ss]ection)\s*\d+/gi, weight: 0.95 },
];

// ---------------------------------------------------------------------------
// RelationshipScorer
// ---------------------------------------------------------------------------

export class RelationshipScorer {
  private readonly weights: ScoringWeights;
  private readonly threshold: number;
  private readonly embeddingService: EmbeddingService;

  constructor(
    embeddingService: EmbeddingService,
    weights?: Partial<ScoringWeights>,
    threshold?: number,
  ) {
    this.embeddingService = embeddingService;
    this.threshold = threshold ?? CONFIDENCE_THRESHOLD;

    if (weights) {
      const merged = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
      const sum =
        merged.semanticSimilarity +
        merged.entityCoOccurrence +
        merged.documentProximity +
        merged.legalReferenceStrength;
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(
          `Scoring weights must sum to 1.0, got ${sum.toFixed(4)}`,
        );
      }
      this.weights = merged;
    } else {
      this.weights = { ...DEFAULT_SCORING_WEIGHTS };
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Score a candidate relationship between an evidence entity and a target entity.
   *
   * @param evidenceText  - Text content of the evidence node
   * @param targetText    - Text content / name of the target node
   * @param sourceText    - Full source document text (for proximity + co-occurrence)
   * @param evidenceEntity - Extracted entity for the evidence
   * @param targetEntity   - Extracted entity for the target
   * @param tenantId       - Tenant isolation
   */
  async scoreRelationship(
    evidenceText: string,
    targetText: string,
    sourceText: string,
    evidenceEntity: ExtractedEntity,
    targetEntity: ExtractedEntity,
    tenantId: string,
  ): Promise<RelationshipScore> {
    const [semanticSimilarity, entityCoOccurrence, documentProximity, legalReferenceStrength] =
      await Promise.all([
        this.computeSemanticSimilarity(evidenceText, targetText, tenantId),
        Promise.resolve(this.computeEntityCoOccurrence(evidenceEntity, targetEntity, sourceText)),
        Promise.resolve(this.computeDocumentProximity(evidenceEntity, targetEntity)),
        Promise.resolve(this.computeLegalReferenceStrength(sourceText, targetEntity)),
      ]);

    const factors: ScoringFactors = {
      semanticSimilarity,
      entityCoOccurrence,
      documentProximity,
      legalReferenceStrength,
    };

    const score =
      factors.semanticSimilarity * this.weights.semanticSimilarity +
      factors.entityCoOccurrence * this.weights.entityCoOccurrence +
      factors.documentProximity * this.weights.documentProximity +
      factors.legalReferenceStrength * this.weights.legalReferenceStrength;

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      factors,
      weights: { ...this.weights },
      meetsThreshold: score >= this.threshold,
    };
  }

  /**
   * Score multiple candidate relationships in bulk.
   * Pre-fetches all embeddings in a single batch for efficiency.
   */
  async scoreRelationships(
    evidenceText: string,
    targets: Array<{
      targetText: string;
      sourceText: string;
      evidenceEntity: ExtractedEntity;
      targetEntity: ExtractedEntity;
    }>,
    tenantId: string,
  ): Promise<RelationshipScore[]> {
    // Pre-fetch all embeddings in one batch
    const allTexts = [evidenceText, ...targets.map((t) => t.targetText)];
    const allEmbeddings = await this.embeddingService.getEmbeddings(
      allTexts,
      tenantId,
    );
    const evidenceEmbedding = allEmbeddings[0];

    const results: RelationshipScore[] = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const targetEmbedding = allEmbeddings[i + 1];

      // Normalize from [-1,1] to [0,1] to match computeSemanticSimilarity
      const semanticSimilarity = (this.embeddingService.cosineSimilarity(
        evidenceEmbedding,
        targetEmbedding,
      ) + 1) / 2;

      const entityCoOccurrence = this.computeEntityCoOccurrence(
        target.evidenceEntity,
        target.targetEntity,
        target.sourceText,
      );

      const documentProximity = this.computeDocumentProximity(
        target.evidenceEntity,
        target.targetEntity,
      );

      const legalReferenceStrength = this.computeLegalReferenceStrength(
        target.sourceText,
        target.targetEntity,
      );

      const factors: ScoringFactors = {
        semanticSimilarity,
        entityCoOccurrence,
        documentProximity,
        legalReferenceStrength,
      };

      const score =
        factors.semanticSimilarity * this.weights.semanticSimilarity +
        factors.entityCoOccurrence * this.weights.entityCoOccurrence +
        factors.documentProximity * this.weights.documentProximity +
        factors.legalReferenceStrength * this.weights.legalReferenceStrength;

      results.push({
        score: Math.min(1.0, Math.max(0.0, score)),
        factors,
        weights: { ...this.weights },
        meetsThreshold: score >= this.threshold,
      });
    }

    return results;
  }

  /** Expose threshold for external use */
  get confidenceThreshold(): number {
    return this.threshold;
  }

  // -----------------------------------------------------------------------
  // Factor Computation — private
  // -----------------------------------------------------------------------

  /**
   * Factor 1: Semantic Similarity (weight 0.40)
   * Cosine similarity between OpenAI embeddings of evidence and target text.
   */
  private async computeSemanticSimilarity(
    evidenceText: string,
    targetText: string,
    tenantId: string,
  ): Promise<number> {
    const [evidenceEmbedding, targetEmbedding] =
      await this.embeddingService.getEmbeddings(
        [evidenceText, targetText],
        tenantId,
      );
    const similarity = this.embeddingService.cosineSimilarity(
      evidenceEmbedding,
      targetEmbedding,
    );
    // Normalize from [-1,1] to [0,1]
    return (similarity + 1) / 2;
  }

  /**
   * Factor 2: Entity Co-occurrence (weight 0.25)
   * Counts how many times the target entity's name appears within proximity
   * windows of the evidence entity in the source text.
   */
  private computeEntityCoOccurrence(
    evidenceEntity: ExtractedEntity,
    targetEntity: ExtractedEntity,
    sourceText: string,
  ): number {
    const lowerSource = sourceText.toLowerCase();
    const targetName = targetEntity.canonicalName.toLowerCase();
    const windowSize = 500; // characters

    let coOccurrences = 0;
    const maxCoOccurrences = 10; // cap for normalization

    for (const offset of evidenceEntity.offsets) {
      const windowStart = Math.max(0, offset.start - windowSize);
      const windowEnd = Math.min(lowerSource.length, offset.end + windowSize);
      const window = lowerSource.slice(windowStart, windowEnd);

      // Count occurrences of target entity name in window
      let searchPos = 0;
      while (true) {
        const idx = window.indexOf(targetName, searchPos);
        if (idx === -1) break;
        coOccurrences++;
        searchPos = idx + 1;
      }
    }

    return Math.min(coOccurrences / maxCoOccurrences, 1.0);
  }

  /**
   * Factor 3: Document Proximity (weight 0.20)
   * Inverse of the minimum character distance between entity offsets.
   * Closer entities score higher.
   */
  private computeDocumentProximity(
    evidenceEntity: ExtractedEntity,
    targetEntity: ExtractedEntity,
  ): number {
    if (evidenceEntity.offsets.length === 0 || targetEntity.offsets.length === 0) {
      return 0;
    }

    let minDistance = Infinity;
    for (const evOffset of evidenceEntity.offsets) {
      for (const tgtOffset of targetEntity.offsets) {
        // Distance between closest edges
        const distance = Math.min(
          Math.abs(evOffset.start - tgtOffset.end),
          Math.abs(tgtOffset.start - evOffset.end),
          Math.abs(evOffset.start - tgtOffset.start),
        );
        minDistance = Math.min(minDistance, distance);
      }
    }

    if (minDistance === Infinity) return 0;

    // Decay function: score = 1 / (1 + distance/200)
    // At distance 0 -> 1.0, distance 200 -> 0.5, distance 1000 -> 0.17
    const decayFactor = 200;
    return 1 / (1 + minDistance / decayFactor);
  }

  /**
   * Factor 4: Legal Reference Strength (weight 0.15)
   * Scans source text for legal citation patterns that mention the target entity.
   */
  private computeLegalReferenceStrength(
    sourceText: string,
    targetEntity: ExtractedEntity,
  ): number {
    const targetName = targetEntity.canonicalName.toLowerCase();
    let totalStrength = 0;
    let matchCount = 0;
    const maxMatches = 5;

    for (const { pattern, weight } of LEGAL_REF_PATTERNS) {
      // Reset regex state
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(sourceText)) !== null) {
        // Check if this legal reference is near the target entity
        const refStart = match.index;
        const refEnd = refStart + match[0].length;

        // Check if target entity appears within 300 chars of this reference
        const contextStart = Math.max(0, refStart - 300);
        const contextEnd = Math.min(sourceText.length, refEnd + 300);
        const context = sourceText.slice(contextStart, contextEnd).toLowerCase();

        if (context.includes(targetName)) {
          totalStrength += weight;
          matchCount++;
          if (matchCount >= maxMatches) break;
        }
      }
      if (matchCount >= maxMatches) break;
    }

    // Normalize: 1 match at weight 1.0 = 0.5, 2+ matches scale toward 1.0
    return matchCount === 0 ? 0 : Math.min(totalStrength / 2, 1.0);
  }
}
