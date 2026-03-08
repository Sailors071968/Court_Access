// ============================================
// Court Access — Exhibit Suggestion Engine
// Orchestrates the full pipeline:
//   Evidence Graph Update → Pattern Detection →
//   Exhibit Idea Generation → Priority Scoring →
//   Store Suggested Exhibit
// Includes BullMQ worker for background processing.
// ============================================

import { Queue, Worker } from 'bullmq';
import type { Job, ConnectionOptions } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import { ExhibitPatternDetector } from './exhibitPatternDetector.ts';
import type { PatternDetectionInput } from './exhibitPatternDetector.ts';
import { ExhibitIdeaGenerator } from './exhibitIdeaGenerator.ts';
import { ExhibitPriorityScorer } from './exhibitPriorityScorer.ts';
import type {
  ExhibitSuggestionJobPayload,
  SuggestionEngineResult,
  ExhibitIdea,
} from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SuggestionEngineConfig {
  /** Redis connection options for BullMQ */
  redisConnection: ConnectionOptions;
  /** Maximum ideas to store per case per run (default: 20) */
  maxIdeasPerRun: number;
  /** Queue name (default: exhibit-suggestion-queue) */
  queueName: string;
  /** Worker concurrency (default: 3) */
  workerConcurrency: number;
}

const DEFAULT_CONFIG: Omit<SuggestionEngineConfig, 'redisConnection'> = {
  maxIdeasPerRun: 20,
  queueName: 'exhibit-suggestion-queue',
  workerConcurrency: 3,
};

// ---------------------------------------------------------------------------
// Exhibit Suggestion Engine
// ---------------------------------------------------------------------------

export class ExhibitSuggestionEngine {
  private readonly config: SuggestionEngineConfig;
  private readonly patternDetector: ExhibitPatternDetector;
  private readonly ideaGenerator: ExhibitIdeaGenerator;
  private readonly priorityScorer: ExhibitPriorityScorer;
  private readonly prisma: PrismaClient;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(prisma: PrismaClient, config: SuggestionEngineConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.prisma = prisma;
    this.patternDetector = new ExhibitPatternDetector();
    this.ideaGenerator = new ExhibitIdeaGenerator();
    this.priorityScorer = new ExhibitPriorityScorer();
  }

  // -----------------------------------------------------------------------
  // Queue Management
  // -----------------------------------------------------------------------

  /**
   * Initialize the BullMQ queue and worker.
   * Call this on server startup.
   */
  async start(): Promise<void> {
    this.queue = new Queue(this.config.queueName, {
      connection: this.config.redisConnection,
    });

    this.worker = new Worker(
      this.config.queueName,
      async (job: Job<ExhibitSuggestionJobPayload>) => {
        return this.processJob(job.data);
      },
      {
        connection: this.config.redisConnection,
        concurrency: this.config.workerConcurrency,
      },
    );

    this.worker.on('failed', (_job, err) => {
      console.error(`[ExhibitSuggestionEngine] Job failed:`, err.message);
    });
  }

  /**
   * Gracefully shut down the queue and worker.
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  /**
   * Enqueue a suggestion job for background processing.
   */
  async enqueue(payload: ExhibitSuggestionJobPayload): Promise<string> {
    if (!this.queue) {
      throw new Error('ExhibitSuggestionEngine not started. Call start() first.');
    }

    const job = await this.queue.add('analyze', payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return job.id ?? 'unknown';
  }

  // -----------------------------------------------------------------------
  // Pipeline Execution
  // -----------------------------------------------------------------------

  /**
   * Run the full suggestion pipeline for a case.
   * Can be called directly (synchronous) or via the queue worker.
   */
  async processJob(payload: ExhibitSuggestionJobPayload): Promise<SuggestionEngineResult> {
    const startTime = Date.now();
    const { caseId } = payload;

    // 1. Gather case data from the database
    const input = await this.gatherCaseData(caseId);

    // 2. Detect patterns
    const patterns = this.patternDetector.detectPatterns(input);

    // 3. Generate exhibit ideas
    const rawIdeas = this.ideaGenerator.generateIdeas(patterns);

    // 4. Score and rank
    const scoredIdeas = this.priorityScorer.scoreAndRank(rawIdeas, patterns);

    // 5. Dedup against existing suggestions
    const newIdeas = await this.dedup(caseId, scoredIdeas);

    // 6. Store (capped)
    const toStore = newIdeas.slice(0, this.config.maxIdeasPerRun);
    await this.storeIdeas(toStore);

    const durationMs = Date.now() - startTime;

    return {
      caseId,
      triggerEvent: payload.triggerEvent,
      patternsDetected: patterns.length,
      ideasGenerated: rawIdeas.length,
      ideasStored: toStore.length,
      durationMs,
    };
  }

  // -----------------------------------------------------------------------
  // Data Gathering
  // -----------------------------------------------------------------------

  /**
   * Gather all relevant case data for pattern detection.
   * In production this queries the graph database and Prisma tables.
   * Currently structured to work with the existing schema.
   */
  private async gatherCaseData(caseId: string): Promise<PatternDetectionInput> {
    // Query existing suggested exhibits to inform dedup
    // The actual graph data would come from Neo4j in production.
    // For now, return an empty structure that the engine can process.
    // The pattern detector handles empty arrays gracefully.

    return {
      caseId,
      timelineEvents: [],
      statements: [],
      conflicts: [],
      evidenceNodes: [],
      custodyRecords: [],
    };
  }

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------

  /**
   * Filter out ideas that already exist as suggestions for this case.
   * Dedup is based on exhibit type + overlapping evidence IDs.
   */
  private async dedup(caseId: string, ideas: ExhibitIdea[]): Promise<ExhibitIdea[]> {
    const existing = await this.prisma.suggestedExhibitIdea.findMany({
      where: { caseId, status: { not: 'dismissed' } },
      select: { exhibitType: true, evidenceIds: true },
    });

    return ideas.filter(idea => {
      // Check if an existing suggestion has the same type and overlapping evidence
      const isDuplicate = existing.some(
        (e: { exhibitType: string; evidenceIds: string[] }) =>
          e.exhibitType === idea.exhibitType &&
          this.arraysOverlap(e.evidenceIds, idea.evidenceIds),
      );
      return !isDuplicate;
    });
  }

  // -----------------------------------------------------------------------
  // Storage
  // -----------------------------------------------------------------------

  /**
   * Store scored exhibit ideas in the database.
   */
  private async storeIdeas(ideas: ExhibitIdea[]): Promise<void> {
    if (ideas.length === 0) return;

    await this.prisma.suggestedExhibitIdea.createMany({
      data: ideas.map(idea => ({
        id: idea.id,
        caseId: idea.caseId,
        title: idea.title,
        description: idea.description,
        exhibitType: idea.exhibitType,
        evidenceIds: idea.evidenceIds,
        conflictIds: idea.conflictIds,
        priorityScore: idea.priorityScore,
        status: idea.status,
      })),
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private arraysOverlap(a: string[], b: string[]): boolean {
    const setB = new Set(b);
    return a.some(item => setB.has(item));
  }
}
