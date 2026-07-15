// ============================================================================
// Phase 174 — Evidence Synchronization Engine
// Links video timestamps, audio transcripts, policy references, and scene
// reconstruction into a unified event graph. Creates cross-referenced
// evidence nodes for forensic analysis.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceGraph {
  graphId?: string;
  caseId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  clusters: EvidenceCluster[];
  timeline: UnifiedTimelineEntry[];
  summary: GraphSummary;
  createdAt?: Date;
}

export interface EvidenceNode {
  nodeId: string;
  nodeType: EvidenceNodeType;
  timestamp: string;
  sourceId: string;
  sourceType: string;
  content: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export type EvidenceNodeType =
  | 'video_frame'
  | 'audio_transcript'
  | 'policy_reference'
  | 'officer_action'
  | 'subject_action'
  | 'scene_element'
  | 'vision_detection'
  | 'trajectory_event'
  | 'visibility_condition'
  | 'camera_sync_point'
  | 'compliance_finding';

export interface EvidenceEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EvidenceEdgeType;
  strength: number;          // 0-1 correlation strength
  description: string;
  bidirectional: boolean;
}

export type EvidenceEdgeType =
  | 'temporal_sequence'       // A happened before B
  | 'causal_link'            // A caused B
  | 'corroborates'           // A supports B
  | 'contradicts'            // A conflicts with B
  | 'same_moment'            // A and B happened simultaneously
  | 'policy_applies'         // policy rule applies to action
  | 'observed_by'            // camera/observer captured event
  | 'part_of'               // A is part of larger event B
  | 'references';           // A references B

export interface EvidenceCluster {
  clusterId: string;
  clusterName: string;
  nodeIds: string[];
  timestamp: string;
  durationSeconds: number;
  significance: 'routine' | 'notable' | 'significant' | 'critical';
  description: string;
}

export interface UnifiedTimelineEntry {
  timestamp: string;
  masterTimestamp: string;     // normalized
  evidenceNodes: string[];     // node IDs
  description: string;
  sources: string[];           // source types involved
  policyReferences: string[];
  significance: 'routine' | 'notable' | 'significant' | 'critical';
}

export interface GraphSummary {
  totalNodes: number;
  totalEdges: number;
  totalClusters: number;
  timelineEntries: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  coverageDurationSeconds: number;
  criticalMoments: number;
  corroboratedEvents: number;
  contradictedEvents: number;
  policyReferencesLinked: number;
}

// ---------------------------------------------------------------------------
// Evidence source types for ingestion
// ---------------------------------------------------------------------------

export interface VideoEvidence {
  sourceId: string;
  sourceType: 'bodycam' | 'dashcam' | 'surveillance';
  timestamps: Array<{ time: string; description: string; eventType: string }>;
}

export interface AudioTranscript {
  sourceId: string;
  segments: Array<{ time: string; speaker: string; text: string }>;
}

export interface PolicyReference {
  ruleId: string;
  policySection: string;
  ruleText: string;
  applicableActions: string[];
}

export interface SceneReconstructionData {
  sceneId: string;
  elements: Array<{ elementId: string; type: string; position: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Core synchronization engine
// ---------------------------------------------------------------------------

/**
 * Build a unified evidence graph from multiple evidence sources.
 */
export function buildEvidenceGraph(
  caseId: string,
  videoSources: VideoEvidence[],
  audioTranscripts: AudioTranscript[],
  policyRefs: PolicyReference[],
  sceneData?: SceneReconstructionData,
  visionEvents?: Array<{ timestamp: string; category: string; confidence: number; description: string }>,
): EvidenceGraph {
  const nodes: EvidenceNode[] = [];
  const edges: EvidenceEdge[] = [];
  let nodeCounter = 0;
  let edgeCounter = 0;

  const nodeId = () => `node-${++nodeCounter}`;
  const edgeId = () => `edge-${++edgeCounter}`;

  // Phase 1: Ingest video evidence as nodes
  for (const video of videoSources) {
    for (const ts of video.timestamps) {
      nodes.push({
        nodeId: nodeId(),
        nodeType: ts.eventType.includes('officer') ? 'officer_action' : 'video_frame',
        timestamp: ts.time,
        sourceId: video.sourceId,
        sourceType: video.sourceType,
        content: ts.description,
        confidence: 0.85,
      });
    }
  }

  // Phase 2: Ingest audio transcripts as nodes
  for (const audio of audioTranscripts) {
    for (const seg of audio.segments) {
      nodes.push({
        nodeId: nodeId(),
        nodeType: 'audio_transcript',
        timestamp: seg.time,
        sourceId: audio.sourceId,
        sourceType: 'audio',
        content: `[${seg.speaker}]: ${seg.text}`,
        confidence: 0.80,
      });
    }
  }

  // Phase 3: Ingest policy references as nodes
  for (const policy of policyRefs) {
    nodes.push({
      nodeId: nodeId(),
      nodeType: 'policy_reference',
      timestamp: '00:00:00',
      sourceId: policy.ruleId,
      sourceType: 'policy',
      content: `${policy.policySection}: ${policy.ruleText}`,
      confidence: 1.0,
      metadata: { applicableActions: policy.applicableActions },
    });
  }

  // Phase 4: Ingest scene elements as nodes
  if (sceneData) {
    for (const element of sceneData.elements) {
      nodes.push({
        nodeId: nodeId(),
        nodeType: 'scene_element',
        timestamp: '00:00:00',
        sourceId: sceneData.sceneId,
        sourceType: 'scene_reconstruction',
        content: element.description,
        confidence: 0.90,
        metadata: { position: element.position, elementType: element.type },
      });
    }
  }

  // Phase 5: Ingest vision events as nodes
  if (visionEvents) {
    for (const ve of visionEvents) {
      nodes.push({
        nodeId: nodeId(),
        nodeType: 'vision_detection',
        timestamp: ve.timestamp,
        sourceId: 'vision-analysis',
        sourceType: 'vision',
        content: ve.description,
        confidence: ve.confidence,
        metadata: { category: ve.category },
      });
    }
  }

  // Phase 6: Build edges — temporal sequences
  const timedNodes = nodes
    .filter(n => n.timestamp !== '00:00:00')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (let i = 0; i < timedNodes.length - 1; i++) {
    const current = timedNodes[i];
    const next = timedNodes[i + 1];
    if (current.timestamp === next.timestamp) {
      edges.push({
        edgeId: edgeId(),
        sourceNodeId: current.nodeId,
        targetNodeId: next.nodeId,
        edgeType: 'same_moment',
        strength: 0.90,
        description: `Simultaneous events at ${current.timestamp}`,
        bidirectional: true,
      });
    } else {
      edges.push({
        edgeId: edgeId(),
        sourceNodeId: current.nodeId,
        targetNodeId: next.nodeId,
        edgeType: 'temporal_sequence',
        strength: 0.85,
        description: `${current.timestamp} → ${next.timestamp}`,
        bidirectional: false,
      });
    }
  }

  // Phase 7: Build edges — corroboration between video and audio at same timestamps
  for (const videoNode of nodes.filter(n => n.nodeType === 'video_frame' || n.nodeType === 'officer_action')) {
    for (const audioNode of nodes.filter(n => n.nodeType === 'audio_transcript')) {
      if (timestampsMatch(videoNode.timestamp, audioNode.timestamp, 3)) {
        edges.push({
          edgeId: edgeId(),
          sourceNodeId: videoNode.nodeId,
          targetNodeId: audioNode.nodeId,
          edgeType: 'corroborates',
          strength: 0.75,
          description: `Video and audio match at ~${videoNode.timestamp}`,
          bidirectional: true,
        });
      }
    }
  }

  // Phase 8: Build edges — policy applies to actions
  for (const policyNode of nodes.filter(n => n.nodeType === 'policy_reference')) {
    const applicableActions = (policyNode.metadata?.applicableActions as string[]) ?? [];
    for (const actionNode of nodes.filter(n =>
      n.nodeType === 'officer_action' || n.nodeType === 'video_frame')) {
      for (const action of applicableActions) {
        if (actionNode.content.toLowerCase().includes(action.toLowerCase())) {
          edges.push({
            edgeId: edgeId(),
            sourceNodeId: policyNode.nodeId,
            targetNodeId: actionNode.nodeId,
            edgeType: 'policy_applies',
            strength: 0.70,
            description: `Policy applies to detected action: ${action}`,
            bidirectional: false,
          });
        }
      }
    }
  }

  // Phase 9: Build edges — vision corroboration
  for (const visionNode of nodes.filter(n => n.nodeType === 'vision_detection')) {
    for (const actionNode of nodes.filter(n => n.nodeType === 'officer_action')) {
      if (timestampsMatch(visionNode.timestamp, actionNode.timestamp, 2)) {
        edges.push({
          edgeId: edgeId(),
          sourceNodeId: visionNode.nodeId,
          targetNodeId: actionNode.nodeId,
          edgeType: 'corroborates',
          strength: 0.80,
          description: `Vision detection corroborates action at ~${visionNode.timestamp}`,
          bidirectional: true,
        });
      }
    }
  }

  // Phase 10: Build clusters — group events by time proximity
  const clusters = buildClusters(timedNodes, edges);

  // Phase 11: Build unified timeline
  const timeline = buildUnifiedTimeline(nodes, edges, policyRefs);

  // Summary
  const nodesByType: Record<string, number> = {};
  for (const n of nodes) {
    nodesByType[n.nodeType] = (nodesByType[n.nodeType] ?? 0) + 1;
  }
  const edgesByType: Record<string, number> = {};
  for (const e of edges) {
    edgesByType[e.edgeType] = (edgesByType[e.edgeType] ?? 0) + 1;
  }

  const summary: GraphSummary = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalClusters: clusters.length,
    timelineEntries: timeline.length,
    nodesByType,
    edgesByType,
    coverageDurationSeconds: calculateDuration(timedNodes),
    criticalMoments: clusters.filter(c => c.significance === 'critical').length,
    corroboratedEvents: edges.filter(e => e.edgeType === 'corroborates').length,
    contradictedEvents: edges.filter(e => e.edgeType === 'contradicts').length,
    policyReferencesLinked: edges.filter(e => e.edgeType === 'policy_applies').length,
  };

  return { caseId, nodes, edges, clusters, timeline, summary };
}

/**
 * Store evidence graph in database
 */
export async function storeEvidenceGraph(graph: EvidenceGraph): Promise<string> {
  const record = await prisma.evidenceGraph.create({
    data: {
      caseId: graph.caseId,
      nodes: JSON.stringify(graph.nodes),
      edges: JSON.stringify(graph.edges),
      clusters: JSON.stringify(graph.clusters),
      timeline: JSON.stringify(graph.timeline),
      summary: JSON.stringify(graph.summary),
    },
  });
  return record.graphId;
}

/**
 * Get evidence graphs for a case
 */
export async function getCaseEvidenceGraphs(caseId: string) {
  return prisma.evidenceGraph.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function timestampsMatch(tsA: string, tsB: string, toleranceSeconds: number): boolean {
  const a = parseTimestampToSeconds(tsA);
  const b = parseTimestampToSeconds(tsB);
  return Math.abs(a - b) <= toleranceSeconds;
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function calculateDuration(timedNodes: EvidenceNode[]): number {
  if (timedNodes.length === 0) return 0;
  const first = parseTimestampToSeconds(timedNodes[0].timestamp);
  const last = parseTimestampToSeconds(timedNodes[timedNodes.length - 1].timestamp);
  return last - first;
}

function buildClusters(
  timedNodes: EvidenceNode[],
  edges: EvidenceEdge[],
): EvidenceCluster[] {
  const clusters: EvidenceCluster[] = [];
  const clusterThresholdSeconds = 5;
  let currentCluster: EvidenceNode[] = [];
  let clusterCounter = 0;

  for (const node of timedNodes) {
    if (currentCluster.length === 0) {
      currentCluster.push(node);
      continue;
    }

    const lastTs = parseTimestampToSeconds(currentCluster[currentCluster.length - 1].timestamp);
    const currentTs = parseTimestampToSeconds(node.timestamp);

    if (currentTs - lastTs <= clusterThresholdSeconds) {
      currentCluster.push(node);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(createCluster(++clusterCounter, currentCluster, edges));
      }
      currentCluster = [node];
    }
  }

  if (currentCluster.length >= 2) {
    clusters.push(createCluster(++clusterCounter, currentCluster, edges));
  }

  return clusters;
}

function createCluster(
  index: number,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): EvidenceCluster {
  const startTs = parseTimestampToSeconds(nodes[0].timestamp);
  const endTs = parseTimestampToSeconds(nodes[nodes.length - 1].timestamp);

  // Determine significance based on node types
  const hasForce = nodes.some(n =>
    n.content.toLowerCase().includes('force') ||
    n.content.toLowerCase().includes('weapon') ||
    n.content.toLowerCase().includes('restraint'));
  const hasPolicyLink = edges.some(e =>
    e.edgeType === 'policy_applies' &&
    nodes.some(n => n.nodeId === e.targetNodeId));

  let significance: EvidenceCluster['significance'] = 'routine';
  if (hasForce && hasPolicyLink) significance = 'critical';
  else if (hasForce) significance = 'significant';
  else if (nodes.length > 3) significance = 'notable';

  return {
    clusterId: `cluster-${index}`,
    clusterName: `Event Cluster ${index}`,
    nodeIds: nodes.map(n => n.nodeId),
    timestamp: nodes[0].timestamp,
    durationSeconds: endTs - startTs,
    significance,
    description: nodes.map(n => n.content).join('; ').substring(0, 200),
  };
}

function buildUnifiedTimeline(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  _policyRefs: PolicyReference[],
): UnifiedTimelineEntry[] {
  const timeMap = new Map<string, UnifiedTimelineEntry>();
  const timedNodes = nodes.filter(n => n.timestamp !== '00:00:00');

  for (const node of timedNodes) {
    const key = node.timestamp;
    const existing = timeMap.get(key);

    if (existing) {
      existing.evidenceNodes.push(node.nodeId);
      if (!existing.sources.includes(node.sourceType)) {
        existing.sources.push(node.sourceType);
      }
      existing.description += `; ${node.content}`;
    } else {
      // Find applicable policy references
      const applicablePolicies: string[] = [];
      for (const edge of edges) {
        if (edge.edgeType === 'policy_applies' && edge.targetNodeId === node.nodeId) {
          const policyNode = nodes.find(n => n.nodeId === edge.sourceNodeId);
          if (policyNode) applicablePolicies.push(policyNode.content.substring(0, 80));
        }
      }

      const hasForce = node.content.toLowerCase().includes('force') ||
        node.content.toLowerCase().includes('weapon');
      const significance: UnifiedTimelineEntry['significance'] =
        hasForce ? 'critical' : applicablePolicies.length > 0 ? 'significant' : 'routine';

      timeMap.set(key, {
        timestamp: key,
        masterTimestamp: key,
        evidenceNodes: [node.nodeId],
        description: node.content,
        sources: [node.sourceType],
        policyReferences: applicablePolicies,
        significance,
      });
    }
  }

  return Array.from(timeMap.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
