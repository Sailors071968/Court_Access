// ============================================
// Court Access — Doctrine Ingestion Service
// Orchestrates PDF parsing, storage, and
// embedding generation for doctrine rules.
// ============================================

import type { DoctrineIngestionResult } from './types.ts';
import { parseDoctrineText } from './doctrinePdfParser.ts';
import { doctrineStore } from './doctrineStore.ts';
import { doctrineEmbeddingPipeline } from './doctrineEmbeddingPipeline.ts';
import { LD15_DOCTRINE_RULES } from './doctrineSeedData.ts';
import { LD16_DOCTRINE_RULES } from './seedLD16.ts';
import { LD17_DOCTRINE_RULES } from './seedLD17.ts';
import { LD18_DOCTRINE_RULES } from './seedLD18.ts';
import { LD20_DOCTRINE_RULES } from './seedLD20.ts';
import { LD21_DOCTRINE_RULES } from './seedLD21.ts';
import { LD24_DOCTRINE_RULES } from './seedLD24.ts';
import { LD30_DOCTRINE_RULES } from './seedLD30.ts';

// ---------------------------------------------------------------------------
// All seed data sources in ingestion order
// ---------------------------------------------------------------------------

const ALL_SEED_SOURCES = [
  { name: 'POST LD-15', rules: LD15_DOCTRINE_RULES },
  { name: 'POST LD-16', rules: LD16_DOCTRINE_RULES },
  { name: 'POST LD-17', rules: LD17_DOCTRINE_RULES },
  { name: 'POST LD-18', rules: LD18_DOCTRINE_RULES },
  { name: 'POST LD-20', rules: LD20_DOCTRINE_RULES },
  { name: 'POST LD-21', rules: LD21_DOCTRINE_RULES },
  { name: 'POST LD-24', rules: LD24_DOCTRINE_RULES },
  { name: 'POST LD-30', rules: LD30_DOCTRINE_RULES },
];

// ---------------------------------------------------------------------------
// Doctrine Ingestion Service
// ---------------------------------------------------------------------------

export class DoctrineIngestionService {
  /**
   * Ingest doctrine rules from raw text extracted from a PDF.
   */
  static async ingestFromText(
    rawText: string,
    sourceName: string,
  ): Promise<DoctrineIngestionResult> {
    const startTime = Date.now();
    const errors: Array<{ chunk: string; error: string }> = [];

    // Parse text into structured chunks
    const chunks = parseDoctrineText(rawText, sourceName);

    let rulesCreated = 0;
    let rulesDuplicate = 0;
    const newRules = [];

    for (const chunk of chunks) {
      try {
        const rule = doctrineStore.insertFromChunk(chunk);
        if (rule) {
          rulesCreated++;
          newRules.push(rule);
        } else {
          rulesDuplicate++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ chunk: chunk.rule.slice(0, 80), error: message });
      }
    }

    // Generate embeddings for new rules
    let embeddingsGenerated = 0;
    if (newRules.length > 0) {
      embeddingsGenerated = await doctrineEmbeddingPipeline.generateEmbeddings(newRules);
    }

    return {
      sourceName,
      totalChunks: chunks.length,
      rulesCreated,
      rulesDuplicate,
      embeddingsGenerated,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Ingest pre-built doctrine chunks (e.g., seed data).
   */
  static async ingestFromChunks(
    chunks: Array<{ source: string; chapter: string; topic: string; rule: string; explanation: string; legalImplication: string; category: string; keywords: string[] }>,
    sourceName: string,
  ): Promise<DoctrineIngestionResult> {
    const startTime = Date.now();
    const errors: Array<{ chunk: string; error: string }> = [];

    let rulesCreated = 0;
    let rulesDuplicate = 0;
    const newRules = [];

    for (const chunk of chunks) {
      try {
        const rule = doctrineStore.insertFromChunk(chunk as Parameters<typeof doctrineStore.insertFromChunk>[0]);
        if (rule) {
          rulesCreated++;
          newRules.push(rule);
        } else {
          rulesDuplicate++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ chunk: chunk.rule.slice(0, 80), error: message });
      }
    }

    // Generate embeddings for new rules
    let embeddingsGenerated = 0;
    if (newRules.length > 0) {
      embeddingsGenerated = await doctrineEmbeddingPipeline.generateEmbeddings(newRules);
    }

    return {
      sourceName,
      totalChunks: chunks.length,
      rulesCreated,
      rulesDuplicate,
      embeddingsGenerated,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Load the built-in LD-15 seed data only.
   */
  static async loadSeedData(): Promise<DoctrineIngestionResult> {
    return DoctrineIngestionService.ingestFromChunks(LD15_DOCTRINE_RULES, 'POST LD-15');
  }

  /**
   * Load ALL seed data from every available learning domain.
   * Returns a combined result summarizing all domains ingested.
   */
  static async loadAllSeedData(): Promise<DoctrineIngestionResult> {
    const startTime = Date.now();
    let totalRulesCreated = 0;
    let totalRulesDuplicate = 0;
    let totalEmbeddings = 0;
    let totalChunks = 0;
    const allErrors: Array<{ chunk: string; error: string }> = [];

    for (const { name, rules } of ALL_SEED_SOURCES) {
      const result = await DoctrineIngestionService.ingestFromChunks(rules, name);
      totalChunks += result.totalChunks;
      totalRulesCreated += result.rulesCreated;
      totalRulesDuplicate += result.rulesDuplicate;
      totalEmbeddings += result.embeddingsGenerated;
      allErrors.push(...result.errors);
    }

    return {
      sourceName: 'POST LD-15/16/17/18/20/21/24/30 (All Domains)',
      totalChunks,
      rulesCreated: totalRulesCreated,
      rulesDuplicate: totalRulesDuplicate,
      embeddingsGenerated: totalEmbeddings,
      durationMs: Date.now() - startTime,
      errors: allErrors,
    };
  }

  /**
   * Load a specific learning domain by its code (e.g., 'LD-16').
   */
  static async loadDomainSeedData(domainCode: string): Promise<DoctrineIngestionResult | null> {
    const source = ALL_SEED_SOURCES.find((s) => s.name.includes(domainCode));
    if (!source) return null;
    return DoctrineIngestionService.ingestFromChunks(source.rules, source.name);
  }

  /**
   * Get list of all available seed data domains.
   */
  static getAvailableDomains(): Array<{ name: string; ruleCount: number }> {
    return ALL_SEED_SOURCES.map((s) => ({ name: s.name, ruleCount: s.rules.length }));
  }

  /**
   * Check if seed data has already been loaded.
   */
  static isSeedDataLoaded(): boolean {
    return doctrineStore.getBySource('POST LD-15').length > 0;
  }

  /**
   * Check if all domains have been loaded.
   */
  static isAllSeedDataLoaded(): boolean {
    return ALL_SEED_SOURCES.every((s) => doctrineStore.getBySource(s.name).length > 0);
  }
}
