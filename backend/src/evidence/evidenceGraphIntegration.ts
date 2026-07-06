// ============================================================================
// Core Evidence System — Evidence Graph Integration (Part 13)
// Creates graph nodes and relationships for evidence entities.
// Nodes: Case, Evidence, VideoSegment, DocumentPage, Event
// Relationships: BELONGS_TO, PART_OF, CAPTURES
// ============================================================================

// ---------------------------------------------------------------------------
// Graph Node Types
// ---------------------------------------------------------------------------

export type GraphNodeType = 'Case' | 'Evidence' | 'VideoSegment' | 'DocumentPage' | 'Event';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  fromId: string;
  toId: string;
  type: 'BELONGS_TO' | 'PART_OF' | 'CAPTURES';
  properties?: Record<string, unknown>;
}

export interface EvidenceGraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// ---------------------------------------------------------------------------
// Graph Node Factories
// ---------------------------------------------------------------------------

export function createCaseNode(params: {
  caseId: string;
  title: string;
  caseNumber: string;
  tenantId: string;
}): GraphNode {
  return {
    id: `case:${params.caseId}`,
    type: 'Case',
    label: params.title,
    properties: {
      caseId: params.caseId,
      caseNumber: params.caseNumber,
      tenantId: params.tenantId,
    },
  };
}

export function createEvidenceNode(params: {
  evidenceId: string;
  fileName: string;
  evidenceType: string;
  caseId: string;
  tenantId: string;
}): GraphNode {
  return {
    id: `evidence:${params.evidenceId}`,
    type: 'Evidence',
    label: params.fileName,
    properties: {
      evidenceId: params.evidenceId,
      evidenceType: params.evidenceType,
      caseId: params.caseId,
      tenantId: params.tenantId,
    },
  };
}

export function createVideoSegmentNode(params: {
  segmentId: string;
  evidenceId: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  s3Key: string;
}): GraphNode {
  return {
    id: `segment:${params.segmentId}`,
    type: 'VideoSegment',
    label: `Segment ${params.segmentIndex + 1} (${params.startTime}s-${params.endTime}s)`,
    properties: {
      segmentId: params.segmentId,
      evidenceId: params.evidenceId,
      segmentIndex: params.segmentIndex,
      startTime: params.startTime,
      endTime: params.endTime,
      s3Key: params.s3Key,
    },
  };
}

export function createDocumentPageNode(params: {
  pageId: string;
  evidenceId: string;
  pageIndex: number;
  logicalPageCount: number;
}): GraphNode {
  return {
    id: `page:${params.pageId}`,
    type: 'DocumentPage',
    label: `Page ${params.pageIndex + 1}`,
    properties: {
      pageId: params.pageId,
      evidenceId: params.evidenceId,
      pageIndex: params.pageIndex,
      logicalPageCount: params.logicalPageCount,
    },
  };
}

export function createEventNode(params: {
  eventId: string;
  eventType: string;
  timestamp: string;
  description: string;
  confidence: number;
}): GraphNode {
  return {
    id: `event:${params.eventId}`,
    type: 'Event',
    label: params.description,
    properties: {
      eventId: params.eventId,
      eventType: params.eventType,
      timestamp: params.timestamp,
      confidence: params.confidence,
    },
  };
}

// ---------------------------------------------------------------------------
// Graph Relationship Factories
// ---------------------------------------------------------------------------

export function createBelongsToRelationship(
  evidenceNodeId: string,
  caseNodeId: string,
): GraphRelationship {
  return {
    fromId: evidenceNodeId,
    toId: caseNodeId,
    type: 'BELONGS_TO',
  };
}

export function createPartOfRelationship(
  childNodeId: string,
  parentNodeId: string,
): GraphRelationship {
  return {
    fromId: childNodeId,
    toId: parentNodeId,
    type: 'PART_OF',
  };
}

export function createCapturesRelationship(
  segmentNodeId: string,
  eventNodeId: string,
  properties?: Record<string, unknown>,
): GraphRelationship {
  return {
    fromId: segmentNodeId,
    toId: eventNodeId,
    type: 'CAPTURES',
    properties,
  };
}

// ---------------------------------------------------------------------------
// Build Evidence Graph for a Case
// ---------------------------------------------------------------------------

/**
 * Build a complete evidence graph for a case.
 * This creates all nodes and relationships from the provided evidence data.
 */
export function buildEvidenceGraph(params: {
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  tenantId: string;
  evidence: Array<{
    evidenceId: string;
    fileName: string;
    evidenceType: string;
    segments?: Array<{
      segmentId: string;
      segmentIndex: number;
      startTime: number;
      endTime: number;
      s3Key: string;
    }>;
    pages?: Array<{
      pageId: string;
      pageIndex: number;
      logicalPageCount: number;
    }>;
  }>;
}): EvidenceGraphData {
  const nodes: GraphNode[] = [];
  const relationships: GraphRelationship[] = [];

  // Create case node
  const caseNode = createCaseNode({
    caseId: params.caseId,
    title: params.caseTitle,
    caseNumber: params.caseNumber,
    tenantId: params.tenantId,
  });
  nodes.push(caseNode);

  // Create evidence nodes and relationships
  for (const ev of params.evidence) {
    const evidenceNode = createEvidenceNode({
      evidenceId: ev.evidenceId,
      fileName: ev.fileName,
      evidenceType: ev.evidenceType,
      caseId: params.caseId,
      tenantId: params.tenantId,
    });
    nodes.push(evidenceNode);
    relationships.push(createBelongsToRelationship(evidenceNode.id, caseNode.id));

    // Video segments
    if (ev.segments) {
      for (const seg of ev.segments) {
        const segNode = createVideoSegmentNode({
          segmentId: seg.segmentId,
          evidenceId: ev.evidenceId,
          segmentIndex: seg.segmentIndex,
          startTime: seg.startTime,
          endTime: seg.endTime,
          s3Key: seg.s3Key,
        });
        nodes.push(segNode);
        relationships.push(createPartOfRelationship(segNode.id, evidenceNode.id));
      }
    }

    // Document pages
    if (ev.pages) {
      for (const page of ev.pages) {
        const pageNode = createDocumentPageNode({
          pageId: page.pageId,
          evidenceId: ev.evidenceId,
          pageIndex: page.pageIndex,
          logicalPageCount: page.logicalPageCount,
        });
        nodes.push(pageNode);
        relationships.push(createPartOfRelationship(pageNode.id, evidenceNode.id));
      }
    }
  }

  return { nodes, relationships };
}
