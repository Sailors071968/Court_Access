// ============================================================================
// Actor Resolution Engine — Deterministic Actor Identity System
// ============================================================================
//
// PURPOSE: Centralized actor identity resolution that replaces string-based
// actor names with deterministic actorId references. All timeline events
// reference actors by ID, ensuring consistent identity across sources.
//
// FLOW:
//   1. Regex extraction produces ExtractedActor (raw text only)
//   2. resolveActor() maps raw text → Actor.id via deterministic matching
//   3. TimelineEvent stores actorId (never raw strings)
//
// MATCHING PRIORITY (deterministic, no AI):
//   1. Overlay data (badge number + name) — highest confidence
//   2. Report structured names (rank + surname)
//   3. Witness statement attributions
//   4. Fallback = unknown_actor_X (tracked)
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Actor types in the system */
export type ActorType = 'officer' | 'subject' | 'witness' | 'dispatcher' | 'forensic_tech' | 'unknown';

/** Confidence level of actor identification */
export type ActorConfidence = 'overlay' | 'structured_name' | 'statement_attribution' | 'category_inferred' | 'unknown';

/**
 * Centralized Actor Registry entry — the source of truth for actor identity.
 * Every unique person in a case gets exactly one Actor record.
 */
export interface Actor {
  /** Unique actor identifier (e.g. "actor_1", "actor_2") */
  id: string;
  /** Canonical display name (e.g. "Officer Martinez") */
  canonicalName: string;
  /** Actor role type */
  type: ActorType;
  /** All known aliases that resolve to this actor (e.g. ["Officer Martinez", "Ofc. Martinez", "Martinez #412"]) */
  aliases: string[];
  /** Source document IDs where this actor was identified */
  sources: string[];
  /** Badge number if known */
  badgeNumber: string | null;
  /** How this actor was identified */
  confidence: ActorConfidence;
}

/**
 * Raw extraction result from regex — NOT used directly in timeline events.
 * Must pass through resolveActor() to get an Actor.id.
 */
export interface ExtractedActor {
  /** Raw text as found in the document (e.g. "Ofc. Martinez", "Badge #412") */
  rawText: string;
  /** Inferred type from extraction context */
  inferredType: ActorType;
  /** Source document where this was extracted */
  sourceDocumentId: string;
  /** Extraction confidence */
  confidence: ActorConfidence;
  /** Badge number if extracted */
  badgeNumber: string | null;
}

/**
 * Validation report entry for actor dedup verification
 */
export interface ActorValidationEntry {
  actorId: string;
  canonicalName: string;
  type: ActorType;
  aliasCount: number;
  aliases: string[];
  sourceCount: number;
  sources: string[];
  confidence: ActorConfidence;
}

/**
 * Full validation report
 */
export interface ActorValidationReport {
  totalActors: number;
  totalUnknownActors: number;
  actors: ActorValidationEntry[];
  duplicatesDetected: number;
  mergesPerformed: number;
}

// ---------------------------------------------------------------------------
// Actor Registry — in-memory store, one per case analysis
// ---------------------------------------------------------------------------

export class ActorRegistry {
  private actors: Map<string, Actor> = new Map();
  private nextId = 1;
  private nextUnknownId = 1;
  private mergesPerformed = 0;

  // ---------------------------------------------------------------------------
  // Normalization — deterministic string canonicalization
  // ---------------------------------------------------------------------------

  /**
   * Normalize a name for comparison. Deterministic, no AI.
   * Strips ranks/titles, normalizes whitespace, lowercases.
   */
  private normalizeName(raw: string): string {
    return raw
      .trim()
      .replace(/\b(?:Officer|Deputy|Sergeant|Sgt\.?|Lieutenant|Lt\.?|Detective|Det\.?|Corporal|Cpl\.?|Captain|Capt\.?|Chief|Commander|Trooper|Agent|Inspector|Ofc\.?)\s*/gi, '')
      .replace(/\b(?:Witness|Bystander|Complainant|Caller|Reporting\s+Party)\s*/gi, '')
      .replace(/\s*(?:#\d+|Badge\s*#?\d+)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Extract badge number from raw text if present.
   */
  private extractBadgeNumber(raw: string): string | null {
    const match = raw.match(/#(\d+)|Badge\s*#?(\d+)/i);
    if (match) {
      return match[1] ?? match[2] ?? null;
    }
    return null;
  }

  /**
   * Extract surname (last word of the normalized name).
   */
  private extractSurname(normalized: string): string {
    const parts = normalized.split(' ').filter(Boolean);
    return parts[parts.length - 1] ?? normalized;
  }

  // ---------------------------------------------------------------------------
  // Deterministic Matching — find existing actor for a raw text input
  // ---------------------------------------------------------------------------

  /**
   * Find an existing actor that matches the given extracted actor.
   * Uses deterministic matching rules in priority order:
   *   1. Badge number match (highest confidence)
   *   2. Exact normalized name match
   *   3. Surname match within same type
   */
  private findMatch(extracted: ExtractedActor): Actor | null {
    const badge = extracted.badgeNumber ?? this.extractBadgeNumber(extracted.rawText);
    const normalized = this.normalizeName(extracted.rawText);
    const surname = this.extractSurname(normalized);

    // Priority 1: Badge number match
    if (badge) {
      for (const actor of this.actors.values()) {
        if (actor.badgeNumber === badge) {
          return actor;
        }
      }
    }

    // Priority 2: Exact normalized name match against any alias
    // GUARD: Do NOT merge by name when both parties have different badge numbers.
    for (const actor of this.actors.values()) {
      if (badge && actor.badgeNumber && badge !== actor.badgeNumber) continue;
      for (const alias of actor.aliases) {
        if (this.normalizeName(alias) === normalized && normalized.length > 0) {
          return actor;
        }
      }
    }

    // Priority 3: Surname match within same type (only if surname is 3+ chars)
    // GUARD: Do NOT merge by surname when both parties have different badge numbers.
    // "Officer Martinez Badge #412" and "Officer Martinez Badge #876" are different people.
    if (surname.length >= 3 && extracted.inferredType !== 'unknown') {
      for (const actor of this.actors.values()) {
        if (actor.type !== extracted.inferredType) continue;
        // Badge conflict guard: if both have badges and they differ, skip
        if (badge && actor.badgeNumber && badge !== actor.badgeNumber) continue;
        for (const alias of actor.aliases) {
          const aliasSurname = this.extractSurname(this.normalizeName(alias));
          if (aliasSurname === surname && aliasSurname.length >= 3) {
            return actor;
          }
        }
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Resolve an extracted actor to a registry Actor.id.
   * If no match exists, creates a new Actor entry.
   * If a match is found, merges aliases and sources.
   */
  resolveActor(extracted: ExtractedActor): string {
    // Skip empty/trivial extractions
    if (!extracted.rawText || extracted.rawText.trim().length === 0) {
      return this.getOrCreateUnknown(extracted.sourceDocumentId);
    }

    const existing = this.findMatch(extracted);

    if (existing) {
      // Merge: add alias if not already present
      if (!existing.aliases.includes(extracted.rawText)) {
        existing.aliases.push(extracted.rawText);
        this.mergesPerformed++;
      }
      // Merge: add source if not already present
      if (!existing.sources.includes(extracted.sourceDocumentId)) {
        existing.sources.push(extracted.sourceDocumentId);
      }
      // Upgrade badge number if we have one now
      const badge = extracted.badgeNumber ?? this.extractBadgeNumber(extracted.rawText);
      if (badge && !existing.badgeNumber) {
        existing.badgeNumber = badge;
      }
      // Upgrade confidence if higher
      if (this.confidenceRank(extracted.confidence) < this.confidenceRank(existing.confidence)) {
        existing.confidence = extracted.confidence;
      }
      return existing.id;
    }

    // No match — create new actor
    const badge = extracted.badgeNumber ?? this.extractBadgeNumber(extracted.rawText);
    const id = `actor_${this.nextId++}`;
    const canonicalName = this.buildCanonicalName(extracted.rawText, extracted.inferredType);

    const actor: Actor = {
      id,
      canonicalName,
      type: extracted.inferredType,
      aliases: [extracted.rawText],
      sources: [extracted.sourceDocumentId],
      badgeNumber: badge,
      confidence: extracted.confidence,
    };

    this.actors.set(id, actor);
    return id;
  }

  /**
   * Get or create an unknown actor for tracking.
   */
  private getOrCreateUnknown(sourceDocumentId: string): string {
    const id = `unknown_actor_${this.nextUnknownId++}`;
    const actor: Actor = {
      id,
      canonicalName: `Unknown Actor ${this.nextUnknownId - 1}`,
      type: 'unknown',
      aliases: [],
      sources: [sourceDocumentId],
      badgeNumber: null,
      confidence: 'unknown',
    };
    this.actors.set(id, actor);
    return id;
  }

  /**
   * Build a canonical display name from raw text and type.
   */
  private buildCanonicalName(rawText: string, type: ActorType): string {
    const normalized = this.normalizeName(rawText);
    if (!normalized || normalized.length === 0) {
      return type === 'unknown' ? 'Unknown' : `Unknown ${type}`;
    }

    // Capitalize each word
    const capitalized = normalized
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    switch (type) {
      case 'officer':
        return `Officer ${capitalized}`;
      case 'witness':
        return `Witness ${capitalized}`;
      case 'subject':
        return 'Subject';
      case 'dispatcher':
        return 'Dispatch';
      case 'forensic_tech':
        return `Forensic Tech ${capitalized}`;
      default:
        return capitalized || 'Unknown';
    }
  }

  /**
   * Rank confidence levels (lower = higher confidence).
   */
  private confidenceRank(c: ActorConfidence): number {
    switch (c) {
      case 'overlay': return 0;
      case 'structured_name': return 1;
      case 'statement_attribution': return 2;
      case 'category_inferred': return 3;
      case 'unknown': return 4;
    }
  }

  /**
   * Get an actor by ID.
   */
  getActor(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  /**
   * Get all actors in the registry.
   */
  getAllActors(): Actor[] {
    return Array.from(this.actors.values());
  }

  /**
   * Get canonical name for an actor ID.
   */
  getCanonicalName(id: string): string {
    return this.actors.get(id)?.canonicalName ?? 'Unknown';
  }

  /**
   * Get actor type for an actor ID.
   */
  getActorType(id: string): ActorType {
    return this.actors.get(id)?.type ?? 'unknown';
  }

  /**
   * Generate a validation report for the entire registry.
   */
  generateValidationReport(): ActorValidationReport {
    const actors: ActorValidationEntry[] = [];
    let totalUnknown = 0;

    for (const actor of this.actors.values()) {
      if (actor.type === 'unknown' || actor.id.startsWith('unknown_actor_')) {
        totalUnknown++;
      }
      actors.push({
        actorId: actor.id,
        canonicalName: actor.canonicalName,
        type: actor.type,
        aliasCount: actor.aliases.length,
        aliases: [...actor.aliases],
        sourceCount: actor.sources.length,
        sources: [...actor.sources],
        confidence: actor.confidence,
      });
    }

    // Check for potential duplicates that weren't merged
    let duplicatesDetected = 0;
    const actorList = Array.from(this.actors.values());
    for (let i = 0; i < actorList.length; i++) {
      for (let j = i + 1; j < actorList.length; j++) {
        const a = actorList[i];
        const b = actorList[j];
        if (a.type === b.type && a.type !== 'unknown') {
          // Check if any aliases share a surname
          for (const aliasA of a.aliases) {
            for (const aliasB of b.aliases) {
              const surnameA = this.extractSurname(this.normalizeName(aliasA));
              const surnameB = this.extractSurname(this.normalizeName(aliasB));
              if (surnameA === surnameB && surnameA.length >= 3) {
                duplicatesDetected++;
              }
            }
          }
        }
      }
    }

    return {
      totalActors: this.actors.size,
      totalUnknownActors: totalUnknown,
      actors,
      duplicatesDetected,
      mergesPerformed: this.mergesPerformed,
    };
  }
}

// ---------------------------------------------------------------------------
// Extraction functions — produce ExtractedActor from raw text
// ---------------------------------------------------------------------------

const OFFICER_PATTERNS = [
  /\b(?:Officer|Deputy|Sergeant|Sgt\.?|Lieutenant|Lt\.?|Detective|Det\.?|Corporal|Cpl\.?|Captain|Capt\.?|Chief|Commander|Trooper|Agent|Inspector)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /\b(?!Badge\b)([A-Z][a-z]{2,})\s*(?:#(\d+)|Badge\s*#?(\d+))/g,
  /\bOfc\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /\bBadge\s*#?(\d+)/g,
];

const WITNESS_PATTERNS = [
  /\b(?:Witness|Bystander|Complainant|Caller|Reporting\s+Party)\s+(?:\u2014\s*)?([A-Z][a-z]+(?:\s+[A-Z]\.?\s*[A-Za-z]*)?)\b/g,
  /\bWitness\s+Statement\s*(?:\u2014|-)\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*[A-Za-z]*)?)\b/g,
];

const SUBJECT_PATTERNS = [
  /\b(?:suspect|defendant|subject|individual|arrestee)\b/i,
];

const DISPATCH_PATTERNS = [
  /\b(?:dispatch|dispatcher|911|CAD|communications?)\b/i,
];

const FORENSIC_PATTERNS = [
  /\b(?:forensic|lab|toxicology|DNA|fingerprint|medical examiner|coroner|pathologist|technician|analyst)\b/i,
];

/**
 * Extract all actor mentions from a text block.
 * Returns ExtractedActor[] — these are raw extractions that MUST be
 * resolved through ActorRegistry.resolveActor() before use.
 */
export function extractActors(
  text: string,
  category: 'officer_action' | 'subject_action' | 'procedural' | 'evidentiary' | 'witness' | 'forensic',
  sourceDocumentId: string,
): ExtractedActor[] {
  const results: ExtractedActor[] = [];
  const seen = new Set<string>();

  // Try officer name extraction
  for (const pattern of OFFICER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      const badgeNum = match[2] ?? match[3] ?? null;
      // Badge-only pattern (4th pattern) — produces badge without name
      const isBadgeOnly = !name && badgeNum;
      const key = isBadgeOnly ? `badge_${badgeNum}` : name?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        if (isBadgeOnly) {
          // Badge-only extraction — no name, just badge number
          results.push({
            rawText: `Badge #${badgeNum}`,
            inferredType: 'officer',
            sourceDocumentId,
            confidence: 'overlay',
            badgeNumber: badgeNum,
          });
        } else if (name) {
          results.push({
            rawText: badgeNum ? `${name} #${badgeNum}` : `Officer ${name}`,
            inferredType: 'officer',
            sourceDocumentId,
            confidence: badgeNum ? 'overlay' : 'structured_name',
            badgeNumber: badgeNum,
          });
        }
      }
    }
  }

  // Try witness name extraction
  for (const pattern of WITNESS_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push({
          rawText: `Witness ${name}`,
          inferredType: 'witness',
          sourceDocumentId,
          confidence: 'statement_attribution',
          badgeNumber: null,
        });
      }
    }
  }

  // If no named actors found, try standalone capitalized surname extraction.
  // This catches bare surnames like "Martinez applied force..." in officer_action contexts.
  if (results.length === 0 && (category === 'officer_action' || category === 'witness')) {
    const surnamePattern = /\b([A-Z][a-z]{2,})\b/g;
    let surnameMatch: RegExpExecArray | null;
    // Common words to exclude from surname extraction
    const EXCLUDED_WORDS = new Set([
      'the', 'and', 'was', 'were', 'has', 'had', 'been', 'being',
      'this', 'that', 'with', 'from', 'into', 'onto', 'upon',
      'after', 'before', 'during', 'while', 'until', 'when',
      'where', 'which', 'their', 'there', 'here', 'then', 'than',
      'both', 'each', 'every', 'some', 'any', 'all', 'most',
      'other', 'another', 'such', 'what', 'about', 'between',
      'through', 'because', 'since', 'also', 'only', 'just',
      'very', 'still', 'already', 'even', 'back', 'over',
      // Common verbs/words that start sentences
      'applied', 'arrived', 'approached', 'asked', 'began',
      'called', 'came', 'completed', 'confirmed', 'continued',
      'described', 'entered', 'exited', 'found', 'gave',
      'heard', 'indicated', 'left', 'made', 'noted',
      'observed', 'ordered', 'placed', 'pulled', 'pushed',
      'reported', 'responded', 'said', 'saw', 'searched',
      'seized', 'shot', 'showed', 'started', 'stated',
      'stopped', 'struck', 'took', 'told', 'turned', 'used',
      // Common nouns
      'officer', 'sergeant', 'deputy', 'detective', 'subject',
      'suspect', 'witness', 'victim', 'dispatch', 'badge',
      'force', 'arrest', 'scene', 'vehicle', 'unit',
      'evidence', 'report', 'incident', 'area', 'street',
    ]);
    while ((surnameMatch = surnamePattern.exec(text)) !== null) {
      const word = surnameMatch[1];
      if (word && !EXCLUDED_WORDS.has(word.toLowerCase()) && !seen.has(word.toLowerCase())) {
        seen.add(word.toLowerCase());
        const inferredType = category === 'officer_action' ? 'officer' : 'witness';
        results.push({
          rawText: inferredType === 'officer' ? `Officer ${word}` : `Witness ${word}`,
          inferredType,
          sourceDocumentId,
          confidence: 'category_inferred',
          badgeNumber: null,
        });
      }
    }
  }

  // If still no named actors found, fall back to category-based inference
  if (results.length === 0) {
    if (category === 'officer_action' || OFFICER_PATTERNS.some(p => { p.lastIndex = 0; return p.test(text); })) {
      results.push({
        rawText: 'Officer (unidentified)',
        inferredType: 'officer',
        sourceDocumentId,
        confidence: 'category_inferred',
        badgeNumber: null,
      });
    } else if (category === 'subject_action' || SUBJECT_PATTERNS.some(p => p.test(text))) {
      results.push({
        rawText: 'Subject',
        inferredType: 'subject',
        sourceDocumentId,
        confidence: 'category_inferred',
        badgeNumber: null,
      });
    } else if (category === 'witness' || WITNESS_PATTERNS.some(p => { p.lastIndex = 0; return p.test(text); })) {
      results.push({
        rawText: 'Witness (unidentified)',
        inferredType: 'witness',
        sourceDocumentId,
        confidence: 'category_inferred',
        badgeNumber: null,
      });
    } else if (DISPATCH_PATTERNS.some(p => p.test(text))) {
      results.push({
        rawText: 'Dispatch',
        inferredType: 'dispatcher',
        sourceDocumentId,
        confidence: 'category_inferred',
        badgeNumber: null,
      });
    } else if (category === 'forensic' || FORENSIC_PATTERNS.some(p => p.test(text))) {
      results.push({
        rawText: 'Forensic Technician',
        inferredType: 'forensic_tech',
        sourceDocumentId,
        confidence: 'category_inferred',
        badgeNumber: null,
      });
    }
    // If still nothing — results stays empty, caller must use unknown
  }

  return results;
}
