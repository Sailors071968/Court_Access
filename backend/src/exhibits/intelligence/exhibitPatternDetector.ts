// ============================================
// Court Access — Exhibit Pattern Detector
// Analyzes the evidence graph for patterns that
// would make powerful trial exhibits.
// ============================================

import { createHash } from 'node:crypto';
import type {
  DetectedPattern,
  PatternScoringFactors,
  TimelineGap,
  ChainOfCustodyIssue,
  EvidenceCluster,
  NarrativeConflictGroup,
} from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PatternDetectorConfig {
  /** Minimum timeline gap in minutes to flag (default: 5) */
  minTimelineGapMinutes: number;
  /** Minimum cluster size to flag as exhibit-worthy (default: 3) */
  minClusterSize: number;
  /** Minimum conflict group size (default: 2) */
  minConflictGroupSize: number;
  /** Maximum patterns to return per category (default: 50) */
  maxPatternsPerCategory: number;
}

const DEFAULT_CONFIG: PatternDetectorConfig = {
  minTimelineGapMinutes: 5,
  minClusterSize: 3,
  minConflictGroupSize: 2,
  maxPatternsPerCategory: 50,
};

// ---------------------------------------------------------------------------
// Input Data Structures (from graph/conflict modules)
// ---------------------------------------------------------------------------

export interface TimelineEventInput {
  id: string;
  description: string;
  timestamp: Date;
  source: string;
  speakerId: string;
  sourceDocumentId: string;
}

export interface StatementInput {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole: string;
  content: string;
  sourceDocumentId: string;
}

export interface ConflictInput {
  id: string;
  conflictType: string;
  description: string;
  severityScore: number;
  sourceNodeIds: string[];
  targetNodeIds: string[];
  evidenceIds: string[];
}

export interface EvidenceNodeInput {
  id: string;
  name: string;
  type: string;
  connectedNodeIds: string[];
  confidence: number;
}

export interface CustodyRecordInput {
  id: string;
  evidenceId: string;
  handler: string;
  timestamp: Date;
  location: string;
  signature: boolean;
}

// ---------------------------------------------------------------------------
// Pattern Detection Input — all data needed for analysis
// ---------------------------------------------------------------------------

export interface PatternDetectionInput {
  caseId: string;
  timelineEvents: TimelineEventInput[];
  statements: StatementInput[];
  conflicts: ConflictInput[];
  evidenceNodes: EvidenceNodeInput[];
  custodyRecords: CustodyRecordInput[];
}

// ---------------------------------------------------------------------------
// Exhibit Pattern Detector
// ---------------------------------------------------------------------------

export class ExhibitPatternDetector {
  private readonly config: PatternDetectorConfig;

  constructor(config?: Partial<PatternDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run all pattern detectors against the case data.
   * Returns all detected patterns across all categories.
   */
  detectPatterns(input: PatternDetectionInput): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 1. Timeline gaps
    const timelineGaps = this.detectTimelineGaps(input.timelineEvents, input.caseId);
    patterns.push(...timelineGaps);

    // 2. Testimony contradictions
    const contradictions = this.detectTestimonyContradictions(
      input.statements,
      input.conflicts,
      input.caseId,
    );
    patterns.push(...contradictions);

    // 3. Officer movement reconstruction
    const officerMovements = this.detectOfficerMovementPatterns(
      input.timelineEvents,
      input.caseId,
    );
    patterns.push(...officerMovements);

    // 4. Chain of custody issues
    const custodyIssues = this.detectChainOfCustodyIssues(
      input.custodyRecords,
      input.caseId,
    );
    patterns.push(...custodyIssues);

    // 5. Evidence relationship clusters
    const clusters = this.detectEvidenceClusters(
      input.evidenceNodes,
      input.caseId,
    );
    patterns.push(...clusters);

    // 6. Narrative conflict clusters
    const conflictGroups = this.detectNarrativeConflictClusters(
      input.conflicts,
      input.caseId,
    );
    patterns.push(...conflictGroups);

    return patterns;
  }

  // -----------------------------------------------------------------------
  // 1. Timeline Gap Detection
  // -----------------------------------------------------------------------

  private detectTimelineGaps(
    events: TimelineEventInput[],
    caseId: string,
  ): DetectedPattern[] {
    if (events.length < 2) return [];

    const sorted = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const patterns: DetectedPattern[] = [];

    for (let i = 0; i < sorted.length - 1 && patterns.length < this.config.maxPatternsPerCategory; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const gapMs = next.timestamp.getTime() - current.timestamp.getTime();
      const gapMinutes = gapMs / 60_000;

      if (gapMinutes >= this.config.minTimelineGapMinutes) {
        const gap: TimelineGap = {
          beforeEvent: {
            id: current.id,
            description: current.description,
            timestamp: current.timestamp,
            source: current.source,
          },
          afterEvent: {
            id: next.id,
            description: next.description,
            timestamp: next.timestamp,
            source: next.source,
          },
          gapMinutes,
        };

        const patternId = this.hashId(`timeline-gap:${current.id}:${next.id}:${caseId}`);

        patterns.push({
          id: patternId,
          patternType: 'timeline_comparison',
          summary: `${Math.round(gapMinutes)}-minute timeline gap detected`,
          details:
            `Gap between "${current.description}" (${current.source}) at ` +
            `${current.timestamp.toISOString()} and "${next.description}" ` +
            `(${next.source}) at ${next.timestamp.toISOString()}. ` +
            `A timeline comparison exhibit could help a jury visualize ` +
            `the ${Math.round(gapMinutes)}-minute unexplained gap.`,
          evidenceIds: [current.id, next.id],
          conflictIds: [],
          caseId,
          rawFactors: this.scoreTimelineGap(gap),
          detectedAt: new Date(),
        });
      }
    }

    return patterns;
  }

  private scoreTimelineGap(gap: TimelineGap): PatternScoringFactors {
    // Larger gaps are more suspicious
    const gapNormalized = Math.min(gap.gapMinutes / 60, 1.0);
    return {
      conflictSeverity: gapNormalized * 0.8,
      evidenceImportance: 0.7,
      juryClarityImpact: 0.9, // Timeline exhibits are very clear for juries
      noveltyFactor: gapNormalized > 0.5 ? 0.8 : 0.4,
    };
  }

  // -----------------------------------------------------------------------
  // 2. Testimony Contradiction Detection
  // -----------------------------------------------------------------------

  private detectTestimonyContradictions(
    statements: StatementInput[],
    conflicts: ConflictInput[],
    caseId: string,
  ): DetectedPattern[] {
    // Use existing conflicts that are testimony-related
    const testimonyConflicts = conflicts.filter(
      c => c.conflictType === 'testimony' || c.conflictType === 'evidence',
    );

    const patterns: DetectedPattern[] = [];

    for (const conflict of testimonyConflicts) {
      if (patterns.length >= this.config.maxPatternsPerCategory) break;

      const patternId = this.hashId(`testimony-contradiction:${conflict.id}:${caseId}`);

      // Find related statements
      const relatedStatements = statements.filter(
        s => conflict.sourceNodeIds.includes(s.id) || conflict.targetNodeIds.includes(s.id),
      );

      const speakerNames = relatedStatements.map(s => s.speakerName).filter(Boolean);
      const speakerLabel = speakerNames.length > 0
        ? speakerNames.join(' vs ')
        : 'Multiple sources';

      patterns.push({
        id: patternId,
        patternType: 'testimony_vs_transcript',
        summary: `Testimony contradiction: ${speakerLabel}`,
        details:
          `${conflict.description} ` +
          `A comparison chart showing the contradicting testimony side-by-side ` +
          `would help a jury understand the inconsistency.`,
        evidenceIds: conflict.evidenceIds,
        conflictIds: [conflict.id],
        caseId,
        rawFactors: {
          conflictSeverity: conflict.severityScore,
          evidenceImportance: 0.8,
          juryClarityImpact: 0.85,
          noveltyFactor: 0.5,
        },
        detectedAt: new Date(),
      });
    }

    return patterns;
  }

  // -----------------------------------------------------------------------
  // 3. Officer Movement Reconstruction
  // -----------------------------------------------------------------------

  private detectOfficerMovementPatterns(
    events: TimelineEventInput[],
    caseId: string,
  ): DetectedPattern[] {
    // Group events by officer speakers
    const officerEvents = new Map<string, TimelineEventInput[]>();
    for (const event of events) {
      // Heuristic: speakers with "officer" in the ID or common officer identifiers
      const list = officerEvents.get(event.speakerId) ?? [];
      list.push(event);
      officerEvents.set(event.speakerId, list);
    }

    const patterns: DetectedPattern[] = [];

    for (const [speakerId, speakerEvents] of officerEvents) {
      if (patterns.length >= this.config.maxPatternsPerCategory) break;
      if (speakerEvents.length < 3) continue; // Need at least 3 events for a meaningful movement map

      const sorted = [...speakerEvents].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      const timeSpanMinutes =
        (sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime()) / 60_000;

      if (timeSpanMinutes < 5) continue; // Too short to be meaningful

      const patternId = this.hashId(`officer-movement:${speakerId}:${caseId}`);
      const eventIds = sorted.map(e => e.id);

      patterns.push({
        id: patternId,
        patternType: 'officer_movement_map',
        summary: `Officer movement reconstruction: ${speakerId} (${sorted.length} events over ${Math.round(timeSpanMinutes)} min)`,
        details:
          `Officer "${speakerId}" has ${sorted.length} timestamped events ` +
          `spanning ${Math.round(timeSpanMinutes)} minutes. An officer movement ` +
          `map could reconstruct their actions and identify gaps or inconsistencies.`,
        evidenceIds: eventIds,
        conflictIds: [],
        caseId,
        rawFactors: {
          conflictSeverity: 0.3,
          evidenceImportance: 0.7,
          juryClarityImpact: 0.8,
          noveltyFactor: 0.6,
        },
        detectedAt: new Date(),
      });
    }

    return patterns;
  }

  // -----------------------------------------------------------------------
  // 4. Chain of Custody Issues
  // -----------------------------------------------------------------------

  private detectChainOfCustodyIssues(
    records: CustodyRecordInput[],
    caseId: string,
  ): DetectedPattern[] {
    if (records.length < 2) return [];

    const patterns: DetectedPattern[] = [];

    // Group by evidence item
    const byEvidence = new Map<string, CustodyRecordInput[]>();
    for (const record of records) {
      const list = byEvidence.get(record.evidenceId) ?? [];
      list.push(record);
      byEvidence.set(record.evidenceId, list);
    }

    for (const [evidenceId, evidenceRecords] of byEvidence) {
      if (patterns.length >= this.config.maxPatternsPerCategory) break;

      const sorted = [...evidenceRecords].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      const issues: ChainOfCustodyIssue[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const record = sorted[i];

        // Missing signature
        if (!record.signature) {
          issues.push({
            evidenceId,
            issueDescription: `Missing transfer signature by ${record.handler} at ${record.timestamp.toISOString()}`,
            issueType: 'missing_signature',
          });
        }

        // Time gap between transfers
        if (i > 0) {
          const prev = sorted[i - 1];
          const gapHours = (record.timestamp.getTime() - prev.timestamp.getTime()) / 3_600_000;
          if (gapHours > 24) {
            issues.push({
              evidenceId,
              issueDescription: `${Math.round(gapHours)}-hour gap between custody transfers`,
              issueType: 'time_gap',
            });
          }
        }
      }

      if (issues.length > 0) {
        const patternId = this.hashId(`custody-issue:${evidenceId}:${caseId}`);
        patterns.push({
          id: patternId,
          patternType: 'chain_of_custody_flow',
          summary: `Chain of custody issue: ${issues.length} problem(s) with evidence ${evidenceId}`,
          details:
            `Evidence item "${evidenceId}" has ${issues.length} chain of custody issue(s): ` +
            issues.map(i => i.issueDescription).join('; ') +
            `. A chain of custody flow diagram would expose these gaps to the jury.`,
          evidenceIds: [evidenceId],
          conflictIds: [],
          caseId,
          rawFactors: {
            conflictSeverity: Math.min(issues.length * 0.3, 1.0),
            evidenceImportance: 0.9,
            juryClarityImpact: 0.85,
            noveltyFactor: 0.7,
          },
          detectedAt: new Date(),
        });
      }
    }

    return patterns;
  }

  // -----------------------------------------------------------------------
  // 5. Evidence Relationship Clusters
  // -----------------------------------------------------------------------

  private detectEvidenceClusters(
    nodes: EvidenceNodeInput[],
    caseId: string,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Find nodes with high connectivity
    for (const node of nodes) {
      if (patterns.length >= this.config.maxPatternsPerCategory) break;

      if (node.connectedNodeIds.length >= this.config.minClusterSize) {
        const cluster: EvidenceCluster = {
          centralNodeId: node.id,
          connectedNodeIds: node.connectedNodeIds,
          avgConfidence: node.confidence,
          theme: `Evidence cluster around "${node.name}"`,
        };

        const patternId = this.hashId(`evidence-cluster:${node.id}:${caseId}`);

        patterns.push({
          id: patternId,
          patternType: 'evidence_relationship_graph',
          summary: `Evidence cluster: ${node.connectedNodeIds.length + 1} connected items around "${node.name}"`,
          details:
            `Evidence node "${node.name}" is connected to ${node.connectedNodeIds.length} ` +
            `other nodes with average confidence ${(cluster.avgConfidence * 100).toFixed(0)}%. ` +
            `An evidence relationship graph would show the jury how these pieces connect.`,
          evidenceIds: [node.id, ...node.connectedNodeIds],
          conflictIds: [],
          caseId,
          rawFactors: {
            conflictSeverity: 0.2,
            evidenceImportance: Math.min(node.connectedNodeIds.length / 10, 1.0),
            juryClarityImpact: 0.75,
            noveltyFactor: node.connectedNodeIds.length > 5 ? 0.8 : 0.4,
          },
          detectedAt: new Date(),
        });
      }
    }

    return patterns;
  }

  // -----------------------------------------------------------------------
  // 6. Narrative Conflict Clusters
  // -----------------------------------------------------------------------

  private detectNarrativeConflictClusters(
    conflicts: ConflictInput[],
    caseId: string,
  ): DetectedPattern[] {
    if (conflicts.length < this.config.minConflictGroupSize) return [];

    const patterns: DetectedPattern[] = [];

    // Group conflicts by shared node IDs (conflicts about the same entities)
    const groups = this.groupConflictsBySharedNodes(conflicts);

    for (const group of groups) {
      if (patterns.length >= this.config.maxPatternsPerCategory) break;

      if (group.conflictIds.length >= this.config.minConflictGroupSize) {
        const patternId = this.hashId(
          `narrative-conflict-group:${group.conflictIds.join(':')}:${caseId}`,
        );

        const allEvidenceIds = conflicts
          .filter(c => group.conflictIds.includes(c.id))
          .flatMap(c => c.evidenceIds);
        const uniqueEvidenceIds = [...new Set(allEvidenceIds)];

        patterns.push({
          id: patternId,
          patternType: 'narrative_conflict_visualization',
          summary: `Narrative conflict cluster: ${group.conflictIds.length} related conflicts`,
          details:
            `${group.conflictIds.length} conflicts relate to "${group.eventDescription}". ` +
            `Average severity: ${(group.avgSeverity * 100).toFixed(0)}%. ` +
            `A narrative conflict visualization would show the jury how multiple ` +
            `inconsistencies compound around this event.`,
          evidenceIds: uniqueEvidenceIds,
          conflictIds: group.conflictIds,
          caseId,
          rawFactors: {
            conflictSeverity: group.avgSeverity,
            evidenceImportance: 0.8,
            juryClarityImpact: 0.7,
            noveltyFactor: group.conflictIds.length > 3 ? 0.9 : 0.5,
          },
          detectedAt: new Date(),
        });
      }
    }

    return patterns;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private groupConflictsBySharedNodes(conflicts: ConflictInput[]): NarrativeConflictGroup[] {
    // Union-Find to correctly group transitively connected conflicts.
    // Two conflicts belong in the same group if they share any node,
    // even indirectly through intermediate conflicts.

    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    const find = (x: string): string => {
      let root = x;
      while (parent.get(root) !== root) {
        root = parent.get(root)!;
      }
      // Path compression
      let current = x;
      while (current !== root) {
        const next = parent.get(current)!;
        parent.set(current, root);
        current = next;
      }
      return root;
    };

    const union = (a: string, b: string): void => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA === rootB) return;
      const rankA = rank.get(rootA) ?? 0;
      const rankB = rank.get(rootB) ?? 0;
      if (rankA < rankB) {
        parent.set(rootA, rootB);
      } else if (rankA > rankB) {
        parent.set(rootB, rootA);
      } else {
        parent.set(rootB, rootA);
        rank.set(rootA, rankA + 1);
      }
    };

    // Initialize each conflict as its own set
    for (const conflict of conflicts) {
      parent.set(conflict.id, conflict.id);
      rank.set(conflict.id, 0);
    }

    // Build node → conflict ID mapping
    const nodeToConflicts = new Map<string, string[]>();
    for (const conflict of conflicts) {
      const allNodes = [...conflict.sourceNodeIds, ...conflict.targetNodeIds];
      for (const node of allNodes) {
        const list = nodeToConflicts.get(node) ?? [];
        list.push(conflict.id);
        nodeToConflicts.set(node, list);
      }
    }

    // Union conflicts that share any node
    for (const [, conflictIds] of nodeToConflicts) {
      for (let i = 1; i < conflictIds.length; i++) {
        union(conflictIds[0], conflictIds[i]);
      }
    }

    // Collect groups by root
    const groupMap = new Map<string, string[]>();
    for (const conflict of conflicts) {
      const root = find(conflict.id);
      const list = groupMap.get(root) ?? [];
      list.push(conflict.id);
      groupMap.set(root, list);
    }

    // Convert to NarrativeConflictGroup, filtering by minimum size
    const groups: NarrativeConflictGroup[] = [];
    for (const [, memberIds] of groupMap) {
      if (memberIds.length >= this.config.minConflictGroupSize) {
        const groupConflicts = conflicts.filter(c => memberIds.includes(c.id));
        const avgSeverity = groupConflicts.reduce((sum, c) => sum + c.severityScore, 0) / groupConflicts.length;

        groups.push({
          eventDescription: groupConflicts[0].description.slice(0, 100),
          conflictIds: memberIds,
          avgSeverity,
        });
      }
    }

    return groups;
  }

  private hashId(input: string): string {
    return `pattern-${createHash('sha256').update(input).digest('hex').slice(0, 16)}`;
  }
}
