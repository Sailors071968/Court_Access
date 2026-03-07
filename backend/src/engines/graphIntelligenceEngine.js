// ============================================
// Court Access — Graph Intelligence Engine v2
// Phase 118: Graph Intelligence + AI Analysis Layer
//
// Analyzes evidence graph structure to produce insights:
// - Central actor identification (node degree)
// - Event cluster detection
// - Entity frequency analysis
// - Relationship density metrics
// - Timeline anomaly detection
//
// All computations are deterministic and read-only.
// Results stored in graph_insights table.
// ============================================

import prisma from '../services/prismaClient.js';
import {
  getCaseGraph,
  getGraphStats,
  getEntityNeighbors,
} from '../services/graphService.js';

// ---------------------------------------------------------------------------
// Insight Types
// ---------------------------------------------------------------------------

export const INSIGHT_TYPES = {
  CENTRAL_ACTOR: 'central_actor',
  EVENT_CLUSTER: 'event_cluster',
  ENTITY_FREQUENCY: 'entity_frequency',
  RELATIONSHIP_DENSITY: 'relationship_density',
  TIMELINE_ANOMALY: 'timeline_anomaly',
  CONTRADICTION_PATTERN: 'contradiction_pattern',
};

// ---------------------------------------------------------------------------
// 1. Central Actor Analysis
// ---------------------------------------------------------------------------

/**
 * Identify central actors by node degree (connection count).
 * Returns top N most connected person nodes.
 *
 * @param {string} caseId
 * @param {number} topN - Max actors to return (default 10)
 * @returns {Promise<Array<{ nodeId: string, label: string, degree: number, types: string[] }>>}
 */
export async function identifyCentralActors(caseId, topN = 10) {
  const graph = await getCaseGraph(caseId, { limit: 5000 });

  // Build adjacency counts
  const degreeMap = new Map();
  for (const edge of graph.edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  }

  // Filter to person nodes and sort by degree
  const personNodes = graph.nodes
    .filter(n => n.type === 'Person')
    .map(n => ({
      nodeId: n.id,
      label: n.label,
      degree: degreeMap.get(n.id) || 0,
      connectionCount: n.connectionCount || 0,
      metadata: n.metadata,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, topN);

  // Determine relationship types for each actor
  const actorsWithTypes = personNodes.map(actor => {
    const relTypes = new Set();
    for (const edge of graph.edges) {
      if (edge.source === actor.nodeId || edge.target === actor.nodeId) {
        relTypes.add(edge.type);
      }
    }
    return { ...actor, relationshipTypes: Array.from(relTypes) };
  });

  return actorsWithTypes;
}

// ---------------------------------------------------------------------------
// 2. Event Cluster Detection
// ---------------------------------------------------------------------------

/**
 * Detect clusters of events that are closely related in time or by shared entities.
 *
 * @param {string} caseId
 * @returns {Promise<Array<{ clusterId: string, events: Array, sharedEntities: Array, timespan: object }>>}
 */
export async function detectEventClusters(caseId) {
  const graph = await getCaseGraph(caseId, { nodeTypes: ['Event'], limit: 2000 });

  const eventNodes = graph.nodes.filter(n => n.type === 'Event');
  if (eventNodes.length === 0) return [];

  // Sort events by timestamp
  const sorted = eventNodes
    .filter(e => e.metadata && e.metadata.timestamp)
    .sort((a, b) => {
      const ta = new Date(a.metadata.timestamp).getTime();
      const tb = new Date(b.metadata.timestamp).getTime();
      return ta - tb;
    });

  // Group events within 24-hour windows
  const clusters = [];
  let currentCluster = [];
  const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  for (let i = 0; i < sorted.length; i++) {
    if (currentCluster.length === 0) {
      currentCluster.push(sorted[i]);
      continue;
    }

    const lastTime = new Date(currentCluster[currentCluster.length - 1].metadata.timestamp).getTime();
    const currTime = new Date(sorted[i].metadata.timestamp).getTime();

    if (currTime - lastTime <= WINDOW_MS) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(currentCluster);
      }
      currentCluster = [sorted[i]];
    }
  }
  if (currentCluster.length >= 2) {
    clusters.push(currentCluster);
  }

  // Find shared entities for each cluster
  return clusters.map((cluster, idx) => {
    const clusterNodeIds = new Set(cluster.map(n => n.id));
    const sharedEntities = new Set();

    for (const edge of graph.edges) {
      if (clusterNodeIds.has(edge.source) || clusterNodeIds.has(edge.target)) {
        const otherId = clusterNodeIds.has(edge.source) ? edge.target : edge.source;
        const otherNode = graph.nodes.find(n => n.id === otherId);
        if (otherNode && otherNode.type === 'Person') {
          sharedEntities.add(otherNode.label);
        }
      }
    }

    const timestamps = cluster
      .map(e => new Date(e.metadata.timestamp).getTime())
      .filter(t => !isNaN(t));

    return {
      clusterId: `cluster-${caseId}-${idx}`,
      eventCount: cluster.length,
      events: cluster.map(e => ({ id: e.id, label: e.label, timestamp: e.metadata.timestamp })),
      sharedEntities: Array.from(sharedEntities),
      timespan: {
        start: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
        end: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
        durationHours: timestamps.length >= 2
          ? Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60))
          : 0,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Entity Frequency Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze how frequently each entity appears across documents.
 *
 * @param {string} caseId
 * @returns {Promise<Array<{ entity: string, type: string, frequency: number, documents: string[] }>>}
 */
export async function analyzeEntityFrequency(caseId) {
  const graph = await getCaseGraph(caseId, { limit: 5000 });

  const entityFreq = new Map();

  for (const node of graph.nodes) {
    if (node.type === 'Document') continue;

    // Count document connections
    const docs = new Set();
    for (const edge of graph.edges) {
      if (edge.type === 'MENTIONED_IN' || edge.type === 'REFERENCED_BY') {
        if (edge.source === node.id) docs.add(edge.target);
        if (edge.target === node.id) docs.add(edge.source);
      }
    }

    if (docs.size > 0) {
      entityFreq.set(node.id, {
        entity: node.label,
        type: node.type,
        frequency: docs.size,
        documents: Array.from(docs),
        connectionCount: node.connectionCount || 0,
      });
    }
  }

  return Array.from(entityFreq.values())
    .sort((a, b) => b.frequency - a.frequency);
}

// ---------------------------------------------------------------------------
// 4. Relationship Density Metrics
// ---------------------------------------------------------------------------

/**
 * Compute relationship density metrics for the graph.
 *
 * @param {string} caseId
 * @returns {Promise<object>}
 */
export async function computeRelationshipDensity(caseId) {
  const stats = await getGraphStats(caseId);
  const graph = await getCaseGraph(caseId, { limit: 5000 });

  const nodeCount = stats.nodeCount || 0;
  const edgeCount = stats.edgeCount || 0;

  // Max possible edges in an undirected graph: n*(n-1)/2
  const maxEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0;
  const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

  // Compute per-type density
  const typeMetrics = {};
  for (const [type, count] of Object.entries(stats.typeCounts || {})) {
    const typeNodes = graph.nodes.filter(n => n.type === type);
    const typeEdgeCount = graph.edges.filter(
      e => typeNodes.some(n => n.id === e.source) || typeNodes.some(n => n.id === e.target)
    ).length;

    typeMetrics[type] = {
      nodeCount: count,
      edgeCount: typeEdgeCount,
      avgDegree: count > 0 ? Math.round((typeEdgeCount / count) * 100) / 100 : 0,
    };
  }

  return {
    nodeCount,
    edgeCount,
    density: Math.round(density * 10000) / 10000,
    relationshipTypeCounts: stats.relationshipTypeCounts || {},
    typeMetrics,
    averageDegree: nodeCount > 0 ? Math.round((2 * edgeCount / nodeCount) * 100) / 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 5. Timeline Anomaly Detection
// ---------------------------------------------------------------------------

/**
 * Detect timeline anomalies: gaps, conflicts, duplicate timestamps.
 *
 * @param {string} caseId
 * @returns {Promise<Array<{ type: string, description: string, severity: string, details: object }>>}
 */
export async function detectTimelineAnomalies(caseId) {
  const graph = await getCaseGraph(caseId, { nodeTypes: ['Event'], limit: 2000 });
  const anomalies = [];

  const events = graph.nodes
    .filter(n => n.type === 'Event' && n.metadata && n.metadata.timestamp)
    .map(n => ({
      id: n.id,
      label: n.label,
      timestamp: new Date(n.metadata.timestamp),
      rawTimestamp: n.metadata.timestamp,
    }))
    .filter(e => !isNaN(e.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Detect gaps > 24 hours
  for (let i = 1; i < events.length; i++) {
    const gapMs = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
    const gapHours = gapMs / (1000 * 60 * 60);

    if (gapHours > 24) {
      anomalies.push({
        type: 'timeline_gap',
        description: `${Math.round(gapHours)}h gap between "${events[i - 1].label}" and "${events[i].label}"`,
        severity: gapHours > 72 ? 'high' : gapHours > 48 ? 'medium' : 'low',
        details: {
          afterEvent: events[i - 1].id,
          afterTime: events[i - 1].rawTimestamp,
          beforeEvent: events[i].id,
          beforeTime: events[i].rawTimestamp,
          gapHours: Math.round(gapHours),
        },
      });
    }
  }

  // Detect duplicate timestamps
  const timestampMap = new Map();
  for (const event of events) {
    const key = event.rawTimestamp;
    if (!timestampMap.has(key)) {
      timestampMap.set(key, []);
    }
    timestampMap.get(key).push(event);
  }

  for (const [timestamp, dupes] of timestampMap) {
    if (dupes.length > 1) {
      anomalies.push({
        type: 'duplicate_timestamp',
        description: `${dupes.length} events share timestamp ${timestamp}`,
        severity: 'medium',
        details: {
          timestamp,
          eventIds: dupes.map(e => e.id),
          eventLabels: dupes.map(e => e.label),
        },
      });
    }
  }

  // Detect conflicts via CONTRADICTS edges
  const allGraph = await getCaseGraph(caseId, { limit: 5000 });
  const contradictions = allGraph.edges.filter(e => e.type === 'CONTRADICTS');
  for (const edge of contradictions) {
    anomalies.push({
      type: 'event_conflict',
      description: `Contradiction detected between ${edge.source} and ${edge.target}`,
      severity: edge.confidence > 0.8 ? 'high' : 'medium',
      details: {
        sourceId: edge.source,
        targetId: edge.target,
        confidence: edge.confidence,
        metadata: edge.metadata,
      },
    });
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// 6. Run Full Analysis
// ---------------------------------------------------------------------------

/**
 * Run full graph intelligence analysis and store results.
 *
 * @param {string} caseId
 * @returns {Promise<{ insights: Array, stats: object }>}
 */
export async function runGraphIntelligence(caseId) {
  const insights = [];

  // Central actors
  const actors = await identifyCentralActors(caseId);
  for (const actor of actors) {
    insights.push({
      caseId,
      insightType: INSIGHT_TYPES.CENTRAL_ACTOR,
      description: `${actor.label} appears in ${actor.degree} connections (${actor.relationshipTypes.join(', ')})`,
      confidenceScore: Math.min(actor.degree / 20, 1.0),
      metadata: actor,
    });
  }

  // Event clusters
  const clusters = await detectEventClusters(caseId);
  for (const cluster of clusters) {
    insights.push({
      caseId,
      insightType: INSIGHT_TYPES.EVENT_CLUSTER,
      description: `${cluster.eventCount} events clustered within ${cluster.timespan.durationHours}h${cluster.sharedEntities.length > 0 ? `, shared entities: ${cluster.sharedEntities.join(', ')}` : ''}`,
      confidenceScore: Math.min(cluster.eventCount / 10, 1.0),
      metadata: cluster,
    });
  }

  // Entity frequency
  const frequencies = await analyzeEntityFrequency(caseId);
  for (const freq of frequencies.slice(0, 20)) {
    insights.push({
      caseId,
      insightType: INSIGHT_TYPES.ENTITY_FREQUENCY,
      description: `${freq.entity} (${freq.type}) appears in ${freq.frequency} documents`,
      confidenceScore: Math.min(freq.frequency / 15, 1.0),
      metadata: freq,
    });
  }

  // Relationship density
  const density = await computeRelationshipDensity(caseId);
  insights.push({
    caseId,
    insightType: INSIGHT_TYPES.RELATIONSHIP_DENSITY,
    description: `Graph density: ${density.density}, avg degree: ${density.averageDegree}, ${density.nodeCount} nodes, ${density.edgeCount} edges`,
    confidenceScore: 1.0,
    metadata: density,
  });

  // Timeline anomalies
  const anomalies = await detectTimelineAnomalies(caseId);
  for (const anomaly of anomalies) {
    insights.push({
      caseId,
      insightType: INSIGHT_TYPES.TIMELINE_ANOMALY,
      description: anomaly.description,
      confidenceScore: anomaly.severity === 'high' ? 0.9 : anomaly.severity === 'medium' ? 0.7 : 0.5,
      metadata: { ...anomaly.details, severity: anomaly.severity, anomalyType: anomaly.type },
    });
  }

  // Store insights in database
  const storedInsights = [];
  for (const insight of insights) {
    try {
      const stored = await prisma.graphInsight.create({
        data: {
          caseId: insight.caseId,
          insightType: insight.insightType,
          description: insight.description,
          confidenceScore: insight.confidenceScore,
          metadata: insight.metadata,
        },
      });
      storedInsights.push(stored);
    } catch (err) {
      // Table may not exist yet — store in memory
      storedInsights.push({ ...insight, id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    }
  }

  return {
    insights: storedInsights,
    stats: {
      centralActors: actors.length,
      eventClusters: clusters.length,
      entityFrequencies: frequencies.length,
      timelineAnomalies: anomalies.length,
      totalInsights: storedInsights.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Get Stored Insights
// ---------------------------------------------------------------------------

/**
 * Retrieve stored insights for a case.
 *
 * @param {string} caseId
 * @param {object} options
 * @param {string} options.type - Filter by insight type
 * @param {number} options.limit - Max results
 * @returns {Promise<Array>}
 */
export async function getStoredInsights(caseId, options = {}) {
  const { type, limit = 100 } = options;

  try {
    const where = { caseId };
    if (type) where.insightType = type;

    return await prisma.graphInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    // Table may not exist — return empty
    return [];
  }
}
