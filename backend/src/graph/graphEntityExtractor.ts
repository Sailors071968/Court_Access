// ============================================
// Court Access — Graph Entity Extractor
// Extracts legal entities from document text using
// pattern-based NLP for deterministic extraction.
// ============================================

import { createHash } from 'node:crypto';
import type {
  ExtractedEntity,
  ExtractedRelationship,
  DocumentExtractionResult,
  GraphNodeType,
  GraphRelationshipType,
} from './types.ts';

// ---------------------------------------------------------------------------
// Entity Extraction Patterns
// ---------------------------------------------------------------------------

interface ExtractionPattern {
  type: GraphNodeType;
  patterns: RegExp[];
  /** Property extractor from regex match */
  extractProperties: (match: RegExpMatchArray) => Record<string, string | number | boolean | null>;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Statute references: "Penal Code § 187", "Cal. Evid. Code § 352"
  {
    type: 'Statute',
    patterns: [
      /(?:(?:California|Cal\.?)\s+)?(?:Penal|Evidence|Civil|Vehicle|Health\s+(?:&|and)\s+Safety|Government|Business\s+(?:&|and)\s+Professions?|Family|Welfare\s+(?:&|and)\s+Institutions?|Labor)\s+Code\s+(?:§|section|Section|sec\.?)\s*(\d+(?:\.\d+)?(?:\([a-z]\))?)/gi,
      /(?:U\.?S\.?C\.?|United\s+States\s+Code)\s+(?:§|section|Section|sec\.?)\s*(\d+)/gi,
      /(?:Code\s+of\s+(?:Civil|Criminal)\s+Procedure)\s+(?:§|section|Section)\s*(\d+(?:\.\d+)?)/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      sectionNumber: match[1] ?? null,
      fullReference: match[0].trim(),
    }),
  },

  // Policy references: "CHP Policy 100.3", "Department Policy No. 5.01"
  {
    type: 'Policy',
    patterns: [
      /(?:CHP|Department|Agency|LAPD|SFPD)\s+Policy\s+(?:No\.?\s*)?(\d+(?:\.\d+)?(?:\.\d+)?)/gi,
      /(?:General\s+Order|Standing\s+Order|Administrative\s+Order)\s+(?:No\.?\s*)?(\d+(?:-\d+)?)/gi,
      /(?:Standard\s+Operating\s+Procedure|SOP)\s+(?:No\.?\s*)?(\d+(?:\.\d+)?)/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      policyNumber: match[1] ?? null,
      fullReference: match[0].trim(),
    }),
  },

  // Case law references: "People v. Smith (2020)", "Smith v. Jones, 123 Cal.App.4th 456"
  {
    type: 'CaseLaw',
    patterns: [
      /([A-Z][a-z]+(?:\s+et\s+al\.?)?)\s+v\.\s+([A-Z][a-z]+(?:\s+et\s+al\.?)?)\s*(?:\((\d{4})\))?/g,
      /(\d+)\s+(?:Cal\.?\s*(?:App\.?)?\s*(?:\d+(?:th|st|nd|rd))?|F\.?\s*(?:\d+(?:th|st|nd|rd))?|U\.?S\.?)\s+(\d+)/g,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      plaintiff: match[1] ?? null,
      defendant: match[2] ?? null,
      year: match[3] ?? null,
      fullCitation: match[0].trim(),
    }),
  },

  // Officer references: "Officer Smith", "Sergeant Johnson", "Detective Brown"
  {
    type: 'Officer',
    patterns: [
      /(?:Officer|Sergeant|Sgt\.?|Detective|Det\.?|Lieutenant|Lt\.?|Captain|Cpt\.?|Chief|Deputy|Corporal|Cpl\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      rank: match[0].split(/\s+/)[0].replace(/\.$/, ''),
      fullName: match[1] ?? null,
    }),
  },

  // Person references (witnesses, defendants): "Mr. Smith", "Ms. Johnson", "Defendant Brown"
  {
    type: 'Person',
    patterns: [
      /(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Defendant|Plaintiff|Witness|Victim|Complainant|Appellant|Respondent)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      role: match[0].split(/\s+/)[0].replace(/\.$/, ''),
      fullName: match[1] ?? null,
    }),
  },

  // Agency references: "California Highway Patrol", "Los Angeles Police Department"
  {
    type: 'Agency',
    patterns: [
      /(?:California\s+Highway\s+Patrol|CHP|Los\s+Angeles\s+Police\s+Department|LAPD|San\s+Francisco\s+Police\s+Department|SFPD|FBI|DEA|ATF|Department\s+of\s+Justice|DOJ|District\s+Attorney(?:'s)?\s+Office)/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      fullName: match[0].trim(),
    }),
  },

  // Evidence references: "Exhibit 12", "Evidence Item 5", "Bodycam footage"
  {
    type: 'Evidence',
    patterns: [
      /(?:Exhibit|Evidence\s+Item|Item\s+of\s+Evidence)\s+(?:No\.?\s*)?(\d+[A-Za-z]?)/gi,
      /(?:bodycam|body\s+cam(?:era)?|dash\s*cam(?:era)?|surveillance|video|audio|photograph|DNA|fingerprint|ballistic|forensic)\s+(?:footage|recording|evidence|report|analysis|results?)/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      exhibitNumber: match[1] ?? null,
      evidenceType: match[0].trim(),
    }),
  },

  // Event references: "on January 15, 2023", "the incident on 08/15/2023"
  {
    type: 'Event',
    patterns: [
      /(?:incident|event|arrest|shooting|pursuit|traffic\s+stop|investigation|search|seizure|interview|interrogation)\s+(?:on|of|dated?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,
      /(?:incident|event|arrest|shooting|pursuit|traffic\s+stop)\s+(?:on|of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      eventType: match[0].split(/\s+(?:on|of|dated?)/i)[0].trim(),
      date: match[1] ?? null,
    }),
  },

  // Legal claims: "Fourth Amendment violation", "due process", "excessive force"
  {
    type: 'LegalClaim',
    patterns: [
      /(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|Thirteenth|Fourteenth|Fifteenth)\s+Amendment\s+(?:violation|claim|right|protection)/gi,
      /(?:excessive\s+force|false\s+arrest|false\s+imprisonment|malicious\s+prosecution|wrongful\s+death|deliberate\s+indifference|qualified\s+immunity|unreasonable\s+search|unreasonable\s+seizure|due\s+process\s+violation|equal\s+protection\s+violation|Brady\s+violation|Miranda\s+violation)/gi,
    ],
    extractProperties: (match: RegExpMatchArray) => ({
      claimType: match[0].trim(),
    }),
  },
];

// ---------------------------------------------------------------------------
// Relationship Extraction Patterns
// ---------------------------------------------------------------------------

interface RelationshipPattern {
  type: GraphRelationshipType;
  pattern: RegExp;
  sourceType: GraphNodeType;
  targetType: GraphNodeType;
}

const RELATIONSHIP_PATTERNS: RelationshipPattern[] = [
  // "violated [Policy/Statute]"
  {
    type: 'VIOLATES',
    pattern: /(?:violat(?:ed|es|ing|ion\s+of))/gi,
    sourceType: 'Officer',
    targetType: 'Policy',
  },
  // "supports [claim/evidence]"
  {
    type: 'SUPPORTS',
    pattern: /(?:support(?:s|ed|ing)|corroborat(?:es|ed|ing)|confirm(?:s|ed|ing))/gi,
    sourceType: 'Evidence',
    targetType: 'LegalClaim',
  },
  // "refutes [claim/testimony]"
  {
    type: 'REFUTES',
    pattern: /(?:refut(?:es|ed|ing)|contradict(?:s|ed|ing)|disproving|disproves)/gi,
    sourceType: 'Evidence',
    targetType: 'LegalClaim',
  },
  // "references [statute/policy]"
  {
    type: 'REFERENCES',
    pattern: /(?:referenc(?:es|ed|ing)|cit(?:es|ed|ing)|pursuant\s+to|under)/gi,
    sourceType: 'CaseLaw',
    targetType: 'Statute',
  },
  // "mentions [person/officer]"
  {
    type: 'MENTIONS',
    pattern: /(?:mention(?:s|ed|ing)|identif(?:ies|ied|ying)|nam(?:es|ed|ing))/gi,
    sourceType: 'Evidence',
    targetType: 'Person',
  },
  // "establishes [fact/claim]"
  {
    type: 'ESTABLISHES',
    pattern: /(?:establish(?:es|ed|ing)|prov(?:es|ed|ing)|demonstrat(?:es|ed|ing))/gi,
    sourceType: 'Evidence',
    targetType: 'LegalClaim',
  },
];

// ---------------------------------------------------------------------------
// Entity Extractor
// ---------------------------------------------------------------------------

export class GraphEntityExtractor {

  /**
   * Extract entities and relationships from a document.
   */
  extract(
    documentId: string,
    tenantId: string,
    content: string,
    documentType: string,
  ): DocumentExtractionResult {
    const start = performance.now();

    const entities = this.extractEntities(content, documentType);
    const relationships = this.extractRelationships(content, entities);

    const durationMs = Math.round(performance.now() - start);

    return {
      documentId,
      tenantId,
      entities,
      relationships,
      extractionDurationMs: durationMs,
      entityCount: entities.length,
      relationshipCount: relationships.length,
    };
  }

  /**
   * Extract entities from document content.
   */
  private extractEntities(content: string, _documentType: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    for (const patternDef of EXTRACTION_PATTERNS) {
      for (const regex of patternDef.patterns) {
        // Reset regex state for global patterns
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const canonicalName = this.canonicalize(patternDef.type, match[0]);
          const dedupKey = `${patternDef.type}:${canonicalName}`;

          if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            entities.push({
              type: patternDef.type,
              name: match[0].trim(),
              canonicalName,
              properties: patternDef.extractProperties(match),
              startOffset: match.index,
              endOffset: match.index + match[0].length,
              offsets: [{ start: match.index, end: match.index + match[0].length }],
            });
          } else {
            // Append this occurrence's offset to the existing entity
            const existing = entities.find(
              e => e.type === patternDef.type && e.canonicalName === canonicalName,
            );
            if (existing) {
              existing.offsets.push({ start: match.index, end: match.index + match[0].length });
            }
          }
        }
      }
    }

    return entities;
  }

  /**
   * Extract relationships between entities based on proximity and context.
   */
  private extractRelationships(
    content: string,
    entities: ExtractedEntity[],
  ): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];
    const seen = new Set<string>();

    for (const relPattern of RELATIONSHIP_PATTERNS) {
      relPattern.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = relPattern.pattern.exec(content)) !== null) {
        const matchPos = match.index;

        // Find nearest source entity of the expected type within a window
        const sourceEntity = this.findNearestEntity(
          entities,
          matchPos,
          relPattern.sourceType,
          500, // character window
        );

        // Find nearest target entity of the expected type within a window
        const targetEntity = this.findNearestEntity(
          entities,
          matchPos,
          relPattern.targetType,
          500,
        );

        if (sourceEntity && targetEntity) {
          const dedupKey = `${relPattern.type}:${sourceEntity.canonicalName}:${targetEntity.canonicalName}`;
          if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            relationships.push({
              type: relPattern.type,
              sourceEntityName: sourceEntity.canonicalName,
              targetEntityName: targetEntity.canonicalName,
              sourceEntityType: relPattern.sourceType,
              targetEntityType: relPattern.targetType,
              confidence: this.computeConfidence(matchPos, sourceEntity, targetEntity),
              properties: {
                matchContext: content.slice(
                  Math.max(0, matchPos - 50),
                  Math.min(content.length, matchPos + match[0].length + 50),
                ).trim(),
              },
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Find the nearest entity of a given type within a character window.
   */
  private findNearestEntity(
    entities: ExtractedEntity[],
    position: number,
    type: GraphNodeType,
    windowSize: number,
  ): ExtractedEntity | null {
    let nearest: ExtractedEntity | null = null;
    let minDistance = Infinity;

    for (const entity of entities) {
      if (entity.type !== type) continue;

      // Check all occurrence offsets for the closest match
      for (const offset of entity.offsets) {
        const distance = Math.min(
          Math.abs(offset.start - position),
          Math.abs(offset.end - position),
        );

        if (distance < windowSize && distance < minDistance) {
          minDistance = distance;
          nearest = entity;
        }
      }
    }

    return nearest;
  }

  /**
   * Compute confidence score based on proximity between entities and the relationship keyword.
   */
  private computeConfidence(
    matchPos: number,
    source: ExtractedEntity,
    target: ExtractedEntity,
  ): number {
    // Use closest occurrence offset for each entity
    let sourceDistance = Infinity;
    for (const offset of source.offsets) {
      const d = Math.min(Math.abs(offset.start - matchPos), Math.abs(offset.end - matchPos));
      if (d < sourceDistance) sourceDistance = d;
    }
    let targetDistance = Infinity;
    for (const offset of target.offsets) {
      const d = Math.min(Math.abs(offset.start - matchPos), Math.abs(offset.end - matchPos));
      if (d < targetDistance) targetDistance = d;
    }

    // Closer entities = higher confidence, max 1.0, decays with distance
    const avgDistance = (sourceDistance + targetDistance) / 2;
    const confidence = Math.max(0.1, 1.0 - (avgDistance / 500));
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Canonicalize an entity name for dedup and graph merging.
   */
  private canonicalize(type: GraphNodeType, rawName: string): string {
    let normalized = rawName.trim().toLowerCase();

    // Remove common prefixes based on type
    if (type === 'Officer') {
      normalized = normalized.replace(
        /^(?:officer|sergeant|sgt\.?|detective|det\.?|lieutenant|lt\.?|captain|cpt\.?|chief|deputy|corporal|cpl\.?)\s+/i,
        '',
      );
    }

    if (type === 'Person') {
      normalized = normalized.replace(
        /^(?:mr\.?|mrs\.?|ms\.?|dr\.?|defendant|plaintiff|witness|victim|complainant|appellant|respondent)\s+/i,
        '',
      );
    }

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Generate a deterministic entity ID from type + canonical name + tenant.
   */
  static generateEntityId(type: GraphNodeType, canonicalName: string, tenantId: string): string {
    const hash = createHash('sha256')
      .update(`${type}:${canonicalName}:${tenantId}`)
      .digest('hex')
      .slice(0, 16);
    return `${type.toLowerCase()}-${hash}`;
  }
}
