// ============================================================================
// Phase 8 — Graph Intelligence Layer
// Neo4j-compatible graph schema for relationship storage.
// Defines node types, edge types, and graph construction from
// extracted events and detected contradictions.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  ExtractedEvent,
  Contradiction,
  GraphNodeType,
  GraphEdgeType,
  GraphNode,
  GraphEdge,
  ContradictionGraph,
} from './types.ts';
import { getEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// Node Construction
// ---------------------------------------------------------------------------

/**
 * Extract unique actors from events and create graph nodes.
 */
function buildActorNodes(events: ExtractedEvent[]): GraphNode[] {
  const actorMap = new Map<string, GraphNode>();

  for (const ev of events) {
    if (!ev.actor) continue;

    const key = ev.actor.toLowerCase();
    if (actorMap.has(key)) continue;

    let nodeType: GraphNodeType;
    switch (ev.actorRole) {
      case 'officer':
      case 'k9_handler':
        nodeType = 'Officer';
        break;
      case 'suspect':
        nodeType = 'Suspect';
        break;
      case 'witness':
        nodeType = 'Witness';
        break;
      default:
        nodeType = 'Witness'; // Default for unknown roles
    }

    actorMap.set(key, {
      nodeId: uuidv4(),
      type: nodeType,
      label: ev.actor,
      properties: {
        role: ev.actorRole,
        firstSeen: ev.timestamp ?? '',
        sourceEvidenceId: ev.sourceEvidenceId,
      },
    });
  }

  return Array.from(actorMap.values());
}

/**
 * Extract unique locations from events and create graph nodes.
 */
function buildLocationNodes(events: ExtractedEvent[]): GraphNode[] {
  const locationMap = new Map<string, GraphNode>();

  for (const ev of events) {
    if (!ev.location) continue;

    const key = ev.location.toLowerCase();
    if (locationMap.has(key)) continue;

    locationMap.set(key, {
      nodeId: uuidv4(),
      type: 'Location',
      label: ev.location,
      properties: {
        firstMentioned: ev.timestamp ?? '',
        sourceEvidenceId: ev.sourceEvidenceId,
      },
    });
  }

  return Array.from(locationMap.values());
}

/**
 * Create event nodes from extracted events.
 */
function buildEventNodes(events: ExtractedEvent[]): GraphNode[] {
  return events.map((ev) => {
    const eventDef = getEventType(ev.eventType);
    return {
      nodeId: ev.eventId,
      type: 'Event' as GraphNodeType,
      label: eventDef?.eventName ?? ev.eventType,
      properties: {
        eventType: ev.eventType,
        category: eventDef?.category ?? 'unknown',
        timestamp: ev.timestamp ?? '',
        confidence: ev.confidence,
        extractionMethod: ev.extractionMethod,
        sourceEvidenceId: ev.sourceEvidenceId,
      },
    };
  });
}

/**
 * Create evidence source nodes.
 */
function buildEvidenceNodes(events: ExtractedEvent[]): GraphNode[] {
  const evidenceMap = new Map<string, GraphNode>();

  for (const ev of events) {
    if (evidenceMap.has(ev.sourceEvidenceId)) continue;

    let evidenceType = 'Unknown';
    switch (ev.extractionMethod) {
      case 'REPORT_NLP':
        evidenceType = 'Officer Report';
        break;
      case 'TRANSCRIPT_NLP':
        evidenceType = 'Transcript';
        break;
      case 'VIDEO_ACTION_DETECTION':
        evidenceType = 'Video Footage';
        break;
      case 'CAD_IMPORT':
        evidenceType = 'CAD/Dispatch Log';
        break;
      case 'AUDIO_TRANSCRIPT_ANALYSIS':
        evidenceType = 'Audio Recording';
        break;
    }

    evidenceMap.set(ev.sourceEvidenceId, {
      nodeId: ev.sourceEvidenceId,
      type: 'Evidence' as GraphNodeType,
      label: evidenceType,
      properties: {
        evidenceType,
        extractionMethod: ev.extractionMethod,
      },
    });
  }

  return Array.from(evidenceMap.values());
}

/**
 * Create contradiction nodes.
 */
function buildContradictionNodes(contradictions: Contradiction[]): GraphNode[] {
  return contradictions.map((c) => ({
    nodeId: c.contradictionId,
    type: 'Contradiction' as GraphNodeType,
    label: c.contradictionType.replace(/_/g, ' '),
    properties: {
      contradictionType: c.contradictionType,
      confidence: c.confidence,
      description: c.description,
      timeRangeStart: c.timeRangeStart ?? '',
      timeRangeEnd: c.timeRangeEnd ?? '',
    },
  }));
}

// ---------------------------------------------------------------------------
// Edge Construction
// ---------------------------------------------------------------------------

/**
 * Build edges connecting actors to the events they participated in.
 */
function buildActorEventEdges(
  events: ExtractedEvent[],
  actorNodes: GraphNode[],
  _eventNodes: GraphNode[],
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const actorLookup = new Map<string, string>();

  for (const node of actorNodes) {
    actorLookup.set(node.label.toLowerCase(), node.nodeId);
  }

  for (const ev of events) {
    if (!ev.actor) continue;
    const actorNodeId = actorLookup.get(ev.actor.toLowerCase());
    if (!actorNodeId) continue;

    const edgeType: GraphEdgeType = ev.actorRole === 'witness' ? 'OBSERVED' : 'PERFORMED';

    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: actorNodeId,
      targetNodeId: ev.eventId,
      type: edgeType,
      properties: {
        role: ev.actorRole,
        confidence: ev.confidence,
      },
    });
  }

  return edges;
}

/**
 * Build DERIVED_FROM edges connecting events to their evidence sources.
 * Each event is derived from a specific piece of evidence.
 */
function buildEventEvidenceEdges(events: ExtractedEvent[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const ev of events) {
    // DERIVED_FROM: Event was extracted from this evidence
    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: ev.eventId,
      targetNodeId: ev.sourceEvidenceId,
      type: 'DERIVED_FROM' as GraphEdgeType,
      properties: {
        extractionMethod: ev.extractionMethod,
        confidence: ev.confidence,
        sourceTextSpan: ev.sourceTextSpan ?? '',
        sourceConfidence: ev.sourceConfidence ?? ev.confidence,
      },
    });

    // RECORDED_BY: Evidence records this event (reverse relationship)
    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: ev.eventId,
      targetNodeId: ev.sourceEvidenceId,
      type: 'RECORDED_BY' as GraphEdgeType,
      properties: {
        extractionMethod: ev.extractionMethod,
        confidence: ev.confidence,
      },
    });
  }

  return edges;
}

/**
 * Build edges connecting events to locations.
 */
function buildEventLocationEdges(
  events: ExtractedEvent[],
  locationNodes: GraphNode[],
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const locationLookup = new Map<string, string>();

  for (const node of locationNodes) {
    locationLookup.set(node.label.toLowerCase(), node.nodeId);
  }

  for (const ev of events) {
    if (!ev.location) continue;
    const locationNodeId = locationLookup.get(ev.location.toLowerCase());
    if (!locationNodeId) continue;

    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: ev.eventId,
      targetNodeId: locationNodeId,
      type: 'LOCATED_AT' as GraphEdgeType,
      properties: {},
    });
  }

  return edges;
}

/**
 * Build temporal sequence edges between events.
 */
function buildTemporalEdges(events: ExtractedEvent[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  // Sort events by timestamp
  const sorted = [...events]
    .filter((e) => e.timestamp)
    .sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

  for (let i = 0; i < sorted.length - 1; i++) {
    // Only connect events from the same case
    if (sorted[i].caseId !== sorted[i + 1].caseId) continue;

    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: sorted[i].eventId,
      targetNodeId: sorted[i + 1].eventId,
      type: 'PRECEDED_BY' as GraphEdgeType,
      properties: {
        timeDelta: '', // Would be calculated from timestamps
      },
    });
  }

  return edges;
}

/**
 * Build contradiction edges connecting contradicted events.
 */
function buildContradictionEdges(contradictions: Contradiction[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const c of contradictions) {
    // Edge from eventA → contradiction
    edges.push({
      edgeId: uuidv4(),
      sourceNodeId: c.eventA,
      targetNodeId: c.contradictionId,
      type: 'CONTRADICTS' as GraphEdgeType,
      properties: {
        contradictionType: c.contradictionType,
        confidence: c.confidence,
      },
    });

    // Edge from eventB → contradiction (if different from eventA)
    if (c.eventB !== c.eventA) {
      edges.push({
        edgeId: uuidv4(),
        sourceNodeId: c.eventB,
        targetNodeId: c.contradictionId,
        type: 'CONTRADICTS' as GraphEdgeType,
        properties: {
          contradictionType: c.contradictionType,
          confidence: c.confidence,
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Public API — Graph Construction
// ---------------------------------------------------------------------------

/**
 * Build a complete contradiction graph for a case.
 */
export function buildContradictionGraph(
  caseId: string,
  events: ExtractedEvent[],
  contradictions: Contradiction[],
): ContradictionGraph {
  const caseEvents = events.filter((e) => e.caseId === caseId);
  const caseContradictions = contradictions.filter((c) => c.caseId === caseId);

  // Build all node types
  const actorNodes = buildActorNodes(caseEvents);
  const locationNodes = buildLocationNodes(caseEvents);
  const eventNodes = buildEventNodes(caseEvents);
  const evidenceNodes = buildEvidenceNodes(caseEvents);
  const contradictionNodes = buildContradictionNodes(caseContradictions);

  const allNodes = [
    ...actorNodes,
    ...locationNodes,
    ...eventNodes,
    ...evidenceNodes,
    ...contradictionNodes,
  ];

  // Build all edge types
  const actorEventEdges = buildActorEventEdges(caseEvents, actorNodes, eventNodes);
  const eventEvidenceEdges = buildEventEvidenceEdges(caseEvents);
  const eventLocationEdges = buildEventLocationEdges(caseEvents, locationNodes);
  const temporalEdges = buildTemporalEdges(caseEvents);
  const contradictionEdges = buildContradictionEdges(caseContradictions);

  const allEdges = [
    ...actorEventEdges,
    ...eventEvidenceEdges,
    ...eventLocationEdges,
    ...temporalEdges,
    ...contradictionEdges,
  ];

  // Build contradiction clusters
  const clusters = buildContradictionClusters(caseContradictions);

  return {
    caseId,
    nodes: allNodes,
    edges: allEdges,
    contradictionClusters: clusters,
  };
}

/**
 * Group related contradictions into clusters for visualization.
 */
function buildContradictionClusters(
  contradictions: Contradiction[],
): ContradictionGraph['contradictionClusters'] {
  const typeGroups = new Map<string, Contradiction[]>();

  for (const c of contradictions) {
    const group = typeGroups.get(c.contradictionType) ?? [];
    group.push(c);
    typeGroups.set(c.contradictionType, group);
  }

  return Array.from(typeGroups.entries()).map(([type, items]) => ({
    clusterId: uuidv4(),
    type,
    contradictionIds: items.map((c) => c.contradictionId),
    severity: Math.max(...items.map((c) => c.confidence)),
  }));
}

/**
 * Generate Cypher queries for Neo4j import (for future Neo4j integration).
 */
export function generateCypherStatements(graph: ContradictionGraph): string[] {
  const statements: string[] = [];

  // Create nodes
  for (const node of graph.nodes) {
    const propsStr = Object.entries(node.properties)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');

    statements.push(
      `CREATE (n:${node.type} {nodeId: ${JSON.stringify(node.nodeId)}, label: ${JSON.stringify(node.label)}, ${propsStr}})`,
    );
  }

  // Create edges
  for (const edge of graph.edges) {
    const propsStr = Object.entries(edge.properties)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');

    statements.push(
      `MATCH (a {nodeId: ${JSON.stringify(edge.sourceNodeId)}}), (b {nodeId: ${JSON.stringify(edge.targetNodeId)}}) CREATE (a)-[:${edge.type} {edgeId: ${JSON.stringify(edge.edgeId)}, ${propsStr}}]->(b)`,
    );
  }

  return statements;
}
