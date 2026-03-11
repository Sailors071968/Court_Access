// ============================================
// Court Access — Doctrine Rule Store
// In-memory store for doctrine rules with
// persistence-ready interface for PostgreSQL.
// ============================================

import { createHash } from 'node:crypto';
import type {
  DoctrineRule,
  DoctrineCategory,
  DoctrineStats,
  ParsedDoctrineChunk,
} from './types.ts';
import { generateDoctrineId } from './doctrinePdfParser.ts';

// ---------------------------------------------------------------------------
// In-Memory Doctrine Store
// ---------------------------------------------------------------------------

class DoctrineStore {
  private rules: Map<string, DoctrineRule> = new Map();
  private hashIndex: Map<string, string> = new Map(); // contentHash -> doctrineId
  private categoryIndex: Map<DoctrineCategory, Set<string>> = new Map();
  private domainIndex: Map<string, Set<string>> = new Map();
  private chapterIndex: Map<string, Set<string>> = new Map();
  private topicIndex: Map<string, Set<string>> = new Map();
  private sourceIndex: Map<string, Set<string>> = new Map();
  private nextIdByCategorySource: Map<string, number> = new Map();

  // -----------------------------------------------------------------------
  // CRUD Operations
  // -----------------------------------------------------------------------

  /**
   * Insert a doctrine rule from a parsed chunk.
   * Returns the created rule, or null if duplicate.
   */
  insertFromChunk(chunk: ParsedDoctrineChunk): DoctrineRule | null {
    const hash = this.contentHash(chunk.rule);

    // Check for duplicate
    if (this.hashIndex.has(hash)) {
      return null;
    }

    // Generate doctrine ID
    const key = `${chunk.source}:${chunk.category}`;
    const nextId = (this.nextIdByCategorySource.get(key) ?? 0) + 1;
    this.nextIdByCategorySource.set(key, nextId);
    const doctrineId = generateDoctrineId(chunk.source, chunk.category, nextId);

    const rule: DoctrineRule = {
      doctrineId,
      sourceType: 'POST',
      sourceName: chunk.source,
      sourceVersion: '5.0',
      domain: 'Laws of Arrest',
      chapter: chunk.chapter,
      topic: chunk.topic,
      ruleText: chunk.rule,
      explanation: chunk.explanation,
      legalImplication: chunk.legalImplication,
      category: chunk.category,
      keywords: chunk.keywords,
      contentHash: hash,
    };

    this.rules.set(doctrineId, rule);
    this.hashIndex.set(hash, doctrineId);

    // Update indexes
    this.addToIndex(this.categoryIndex, rule.category, doctrineId);
    this.addToIndex(this.domainIndex, rule.domain, doctrineId);
    this.addToIndex(this.chapterIndex, rule.chapter, doctrineId);
    this.addToIndex(this.topicIndex, rule.topic, doctrineId);
    this.addToIndex(this.sourceIndex, rule.sourceName, doctrineId);

    return rule;
  }

  /**
   * Insert a pre-built doctrine rule directly.
   */
  insertRule(rule: DoctrineRule): boolean {
    if (this.rules.has(rule.doctrineId) || this.hashIndex.has(rule.contentHash)) {
      return false;
    }

    this.rules.set(rule.doctrineId, rule);
    this.hashIndex.set(rule.contentHash, rule.doctrineId);
    this.addToIndex(this.categoryIndex, rule.category, rule.doctrineId);
    this.addToIndex(this.domainIndex, rule.domain, rule.doctrineId);
    this.addToIndex(this.chapterIndex, rule.chapter, rule.doctrineId);
    this.addToIndex(this.topicIndex, rule.topic, rule.doctrineId);
    this.addToIndex(this.sourceIndex, rule.sourceName, rule.doctrineId);
    return true;
  }

  /**
   * Get a doctrine rule by ID.
   */
  getById(doctrineId: string): DoctrineRule | undefined {
    return this.rules.get(doctrineId);
  }

  /**
   * Get all doctrine rules.
   */
  getAll(): DoctrineRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category.
   */
  getByCategory(category: DoctrineCategory): DoctrineRule[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Get rules by chapter.
   */
  getByChapter(chapter: string): DoctrineRule[] {
    const ids = this.chapterIndex.get(chapter);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Get rules by topic.
   */
  getByTopic(topic: string): DoctrineRule[] {
    const ids = this.topicIndex.get(topic);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Get rules by source.
   */
  getBySource(sourceName: string): DoctrineRule[] {
    const ids = this.sourceIndex.get(sourceName);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Search rules by text query (keyword matching).
   */
  search(query: string, maxResults: number = 20): DoctrineRule[] {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (terms.length === 0) return [];

    const scored: Array<{ rule: DoctrineRule; score: number }> = [];

    for (const rule of this.rules.values()) {
      let score = 0;
      const searchText = `${rule.ruleText} ${rule.explanation ?? ''} ${rule.topic} ${rule.chapter} ${rule.keywords.join(' ')}`.toLowerCase();

      for (const term of terms) {
        if (searchText.includes(term)) score += 1;
        if (rule.topic.toLowerCase().includes(term)) score += 2;
        if (rule.keywords.some((kw) => kw.includes(term))) score += 1.5;
      }

      if (score > 0) {
        scored.push({ rule, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.rule);
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  getStats(): DoctrineStats {
    const rulesByCategory: Record<string, number> = {};
    const rulesBySource: Record<string, number> = {};
    const rulesByDomain: Record<string, number> = {};

    for (const [cat, ids] of this.categoryIndex) {
      rulesByCategory[cat] = ids.size;
    }
    for (const [src, ids] of this.sourceIndex) {
      rulesBySource[src] = ids.size;
    }
    for (const [dom, ids] of this.domainIndex) {
      rulesByDomain[dom] = ids.size;
    }

    return {
      totalRules: this.rules.size,
      totalEmbeddings: 0, // Updated by embedding pipeline
      rulesByCategory,
      rulesBySource,
      rulesByDomain,
      totalMatches: 0,
      lastIngestionAt: null,
    };
  }

  /** Total number of rules stored */
  get size(): number {
    return this.rules.size;
  }

  /** Clear all rules */
  clear(): void {
    this.rules.clear();
    this.hashIndex.clear();
    this.categoryIndex.clear();
    this.domainIndex.clear();
    this.chapterIndex.clear();
    this.topicIndex.clear();
    this.sourceIndex.clear();
    this.nextIdByCategorySource.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private contentHash(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  private addToIndex<K>(index: Map<K, Set<string>>, key: K, doctrineId: string): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(doctrineId);
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const doctrineStore = new DoctrineStore();
