// ============================================================================
// Timeline Reconstruction Engine — Graph Integration
// Extends the evidence graph with timeline event nodes and relationships.
// Node: TimelineEvent
// Relationships: DESCRIBED_IN, CAPTURED_BY, RELATED_TO, PRECEDES, CONTRADICTS
// ============================================================================

import type { GraphNode, GraphRelationship } from '../evidence/evidenceGraphIntegration.js';

// ---------------------------------------------------------------------------
// Extended Graph Types for Timeline
// ---------------------------------------------------------------------------

export type TimelineGraphNodeType = 'TimelineEvent' | 'CorrelationGroup';

export type TimelineRelationshipType =
  | 'DESCRIBED_IN'   // event described in a text document
  | 'CAPTURED_BY'    // event captured by video evidence
  | 'RELATED_TO'     // event related to another event
  | 'PRECEDES'       // event A happens before event B
  | 'CONTRADICTS';   // event A contradicts event B

export interface TimelineGraphNode extends Omit<GraphNode, 'type'> {
  type: TimelineGraphNodeType;
}

export interface TimelineGraphRelationship extends Omit<GraphRelationship, 'type'> {
  type: TimelineRelationshipType;
}

// ---------------------------------------------------------------------------
// Timeline Event Node Factory
// ---------------------------------------------------------------------------

export function createTimelineEventNode(params: {
  eventId: string;
  eventType: string;
  timestamp: string;
  confidence: number;
  sourceType: string;
  description: string;
  correlationGroup?: string;
}): TimelineGraphNode {
  return {
    id: `timeline-event:${params.eventId}`,
    type: 'TimelineEvent',
    label: `${params.eventType} @ ${params.timestamp}`,
    properties: {
      eventId: params.eventId,
      eventType: params.eventType,
      timestamp: params.timestamp,
      confidence: params.confidence,
      sourceType: params.sourceType,
      description: params.description,
      correlationGroup: params.correlationGroup,
    },
  };
}

export function createCorrelationGroupNode(params: {
  groupId: string;
  eventCount: number;
  primaryEventType: string;
}): TimelineGraphNode {
  return {
    id: `correlation:${params.groupId}`,
    type: 'CorrelationGroup',
    label: `${params.primaryEventType} (${params.eventCount} sources)`,
    properties: {
      groupId: params.groupId,
      eventCount: params.eventCount,
      primaryEventType: params.primaryEventType,
    },
  };
}

// ---------------------------------------------------------------------------
// Timeline Relationship Factories
// ---------------------------------------------------------------------------

export function createDescribedInRelationship(
  eventNodeId: string,
  evidenceNodeId: string,
): TimelineGraphRelationship {
  return {
    fromId: eventNodeId,
    toId: evidenceNodeId,
    type: 'DESCRIBED_IN',
  };
}

export function createCapturedByRelationship(
  eventNodeId: string,
  evidenceNodeId: string,
): TimelineGraphRelationship {
  return {
    fromId: eventNodeId,
    toId: evidenceNodeId,
    type: 'CAPTURED_BY',
  };
}

export function createRelatedToRelationship(
  eventNodeIdA: string,
  eventNodeIdB: string,
  properties?: Record<string, unknown>,
): TimelineGraphRelationship {
  return {
    fromId: eventNodeIdA,
    toId: eventNodeIdB,
    type: 'RELATED_TO',
    properties,
  };
}

export function createPrecedesRelationship(
  earlierEventNodeId: string,
  laterEventNodeId: string,
  timeDifferenceMs?: number,
): TimelineGraphRelationship {
  return {
    fromId: earlierEventNodeId,
    toId: laterEventNodeId,
    type: 'PRECEDES',
    properties: timeDifferenceMs !== undefined ? { timeDifferenceMs } : undefined,
  };
}

export function createContradictsRelationship(
  eventNodeIdA: string,
  eventNodeIdB: string,
  conflictType: string,
  description: string,
): TimelineGraphRelationship {
  return {
    fromId: eventNodeIdA,
    toId: eventNodeIdB,
    type: 'CONTRADICTS',
    properties: { conflictType, description },
  };
}

// ---------------------------------------------------------------------------
// Build Timeline Graph from Events
// ---------------------------------------------------------------------------

export interface TimelineEventData {
  eventId: string;
  eventType: string;
  timestamp: string;
  confidence: number;
  sourceType: string;
  sourceEvidenceId: string | null;
  description: string;
  correlationGroup: string | null;
}

export interface TimelineConflictData {
  eventIdA: string;
  eventIdB: string;
  conflictType: string;
  description: string;
}

export interface TimelineGraphData {
  nodes: TimelineGraphNode[];
  relationships: TimelineGraphRelationship[];
}

export function buildTimelineGraph(params: {
  caseId: string;
  events: TimelineEventData[];
  conflicts?: TimelineConflictData[];
}): TimelineGraphData {
  const nodes: TimelineGraphNode[] = [];
  const relationships: TimelineGraphRelationship[] = [];

  // Track correlation groups
  const correlationGroups = new Map<string, TimelineEventData[]>();

  // Create event nodes
  for (const event of params.events) {
    const eventNode = createTimelineEventNode({
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      confidence: event.confidence,
      sourceType: event.sourceType,
      description: event.description,
      correlationGroup: event.correlationGroup ?? undefined,
    });
    nodes.push(eventNode);

    // Create relationship to source evidence
    if (event.sourceEvidenceId) {
      const evidenceNodeId = `evidence:${event.sourceEvidenceId}`;
      const isVideoSource = ['bodycam', 'dashcam', 'surveillance', 'witness_video'].includes(event.sourceType);
      if (isVideoSource) {
        relationships.push(createCapturedByRelationship(eventNode.id, evidenceNodeId));
      } else {
        relationships.push(createDescribedInRelationship(eventNode.id, evidenceNodeId));
      }
    }

    // Track correlation groups
    if (event.correlationGroup) {
      const group = correlationGroups.get(event.correlationGroup) ?? [];
      group.push(event);
      correlationGroups.set(event.correlationGroup, group);
    }
  }

  // Create PRECEDES relationships for sequential events
  const sortedEvents = [...params.events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];
    const timeDiff = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    relationships.push(
      createPrecedesRelationship(
        `timeline-event:${current.eventId}`,
        `timeline-event:${next.eventId}`,
        timeDiff,
      ),
    );
  }

  // Create correlation group nodes and RELATED_TO relationships
  for (const [groupId, groupEvents] of correlationGroups) {
    if (groupEvents.length < 2) continue;
    const primary = groupEvents[0];
    const groupNode = createCorrelationGroupNode({
      groupId,
      eventCount: groupEvents.length,
      primaryEventType: primary.eventType,
    });
    nodes.push(groupNode);

    for (const event of groupEvents) {
      relationships.push(
        createRelatedToRelationship(
          `timeline-event:${event.eventId}`,
          groupNode.id,
          { correlationGroup: groupId },
        ),
      );
    }
  }

  // Create CONTRADICTS relationships for conflicts
  if (params.conflicts) {
    for (const conflict of params.conflicts) {
      relationships.push(
        createContradictsRelationship(
          `timeline-event:${conflict.eventIdA}`,
          `timeline-event:${conflict.eventIdB}`,
          conflict.conflictType,
          conflict.description,
        ),
      );
    }
  }

  return { nodes, relationships };
}
