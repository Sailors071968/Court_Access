// ============================================
// Court Access — Evidence Graph Builder Engine
// Phase 117: Evidence Graph + Visualization System
//
// Converts Phase 116 engine outputs into graph nodes and relationships.
// Inputs: DocumentEntity, CaseEvent, TranscriptStatement, EvidenceConflict
// All graph updates are idempotent (MERGE semantics).
// ============================================

import prisma from '../services/prismaClient.js';
import {
  createNode,
  createRelationship,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
} from '../services/graphService.js';

// ---------------------------------------------------------------------------
// Build Graph from Phase 116 Data
// ---------------------------------------------------------------------------

/**
 * Build or update the full evidence graph for a case.
 * Idempotent — safe to call multiple times.
 *
 * @param {string} caseId
 * @returns {Promise<{ nodesCreated: number, edgesCreated: number }>}
 */
export async function buildCaseGraph(caseId) {
  let nodesCreated = 0;
  let edgesCreated = 0;

  // 1. Build nodes from DocumentEntity records
  const entityResult = await buildEntityNodes(caseId);
  nodesCreated += entityResult.nodesCreated;
  edgesCreated += entityResult.edgesCreated;

  // 2. Build nodes from CaseEvent records
  const eventResult = await buildEventNodes(caseId);
  nodesCreated += eventResult.nodesCreated;
  edgesCreated += eventResult.edgesCreated;

  // 3. Build nodes from TranscriptStatement records
  const statementResult = await buildStatementNodes(caseId);
  nodesCreated += statementResult.nodesCreated;
  edgesCreated += statementResult.edgesCreated;

  // 4. Build conflict relationships from EvidenceConflict records
  const conflictResult = await buildConflictRelationships(caseId);
  edgesCreated += conflictResult.edgesCreated;

  // 5. Build document nodes
  const docResult = await buildDocumentNodes(caseId);
  nodesCreated += docResult.nodesCreated;

  return { nodesCreated, edgesCreated };
}

/**
 * Update graph when a new document is added to a case.
 * Idempotent — processes only the specified document.
 *
 * @param {string} caseId
 * @param {string} documentId
 * @returns {Promise<{ nodesCreated: number, edgesCreated: number }>}
 */
export async function updateGraphForDocument(caseId, documentId) {
  let nodesCreated = 0;
  let edgesCreated = 0;

  // Create document node
  await createNode({
    id: `doc-${documentId}`,
    type: NODE_TYPES.DOCUMENT,
    caseId,
    label: `Document ${documentId.substring(0, 8)}`,
    metadata: { documentId },
  });
  nodesCreated++;

  // Process entities for this document
  const entities = await prisma.documentEntity.findMany({
    where: { documentId, caseId },
  });

  for (const entity of entities) {
    const nodeId = getEntityNodeId(entity);
    const nodeType = mapEntityTypeToNodeType(entity.entityType);

    await createNode({
      id: nodeId,
      type: nodeType,
      caseId,
      label: entity.entityValue,
      metadata: {
        entityType: entity.entityType,
        confidence: entity.confidence,
        sourceContext: entity.sourceContext,
      },
    });
    nodesCreated++;

    // Link entity to document
    await createRelationship({
      sourceNode: nodeId,
      targetNode: `doc-${documentId}`,
      relationshipType: RELATIONSHIP_TYPES.MENTIONED_IN,
      confidenceScore: entity.confidence,
      sourceDocument: documentId,
    });
    edgesCreated++;
  }

  // Process events linked to this document
  const events = await prisma.caseEvent.findMany({
    where: { sourceDocumentId: documentId, caseId },
  });

  for (const event of events) {
    const eventNodeId = `event-${event.id}`;
    await createNode({
      id: eventNodeId,
      type: NODE_TYPES.EVENT,
      caseId,
      label: event.description.substring(0, 80),
      metadata: {
        eventType: event.eventType,
        timestamp: event.timestamp,
        confidence: event.confidence,
      },
    });
    nodesCreated++;

    // Link event to document
    await createRelationship({
      sourceNode: eventNodeId,
      targetNode: `doc-${documentId}`,
      relationshipType: RELATIONSHIP_TYPES.REFERENCED_BY,
      confidenceScore: event.confidence,
      sourceDocument: documentId,
    });
    edgesCreated++;
  }

  return { nodesCreated, edgesCreated };
}

// ---------------------------------------------------------------------------
// Node Builders
// ---------------------------------------------------------------------------

async function buildEntityNodes(caseId) {
  let nodesCreated = 0;
  let edgesCreated = 0;

  const entities = await prisma.documentEntity.findMany({
    where: { caseId },
  });

  // Deduplicate by normalized value
  const seen = new Set();

  for (const entity of entities) {
    const nodeId = getEntityNodeId(entity);
    const nodeType = mapEntityTypeToNodeType(entity.entityType);

    if (!seen.has(nodeId)) {
      seen.add(nodeId);
      await createNode({
        id: nodeId,
        type: nodeType,
        caseId,
        label: entity.entityValue,
        metadata: {
          entityType: entity.entityType,
          confidence: entity.confidence,
          sourceContext: entity.sourceContext,
        },
      });
      nodesCreated++;
    }

    // Link entity to its document
    await createRelationship({
      sourceNode: nodeId,
      targetNode: `doc-${entity.documentId}`,
      relationshipType: RELATIONSHIP_TYPES.MENTIONED_IN,
      confidenceScore: entity.confidence,
      sourceDocument: entity.documentId,
    });
    edgesCreated++;
  }

  return { nodesCreated, edgesCreated };
}

async function buildEventNodes(caseId) {
  let nodesCreated = 0;
  let edgesCreated = 0;

  const events = await prisma.caseEvent.findMany({
    where: { caseId },
  });

  for (const event of events) {
    const eventNodeId = `event-${event.id}`;

    await createNode({
      id: eventNodeId,
      type: NODE_TYPES.EVENT,
      caseId,
      label: event.description.substring(0, 80),
      metadata: {
        eventType: event.eventType,
        timestamp: event.timestamp,
        confidence: event.confidence,
        metadata: event.metadata,
      },
    });
    nodesCreated++;

    // Link event to source document
    if (event.sourceDocumentId) {
      await createRelationship({
        sourceNode: eventNodeId,
        targetNode: `doc-${event.sourceDocumentId}`,
        relationshipType: RELATIONSHIP_TYPES.REFERENCED_BY,
        confidenceScore: event.confidence,
        sourceDocument: event.sourceDocumentId,
      });
      edgesCreated++;
    }

    // Link persons mentioned in event description to event
    // (cross-reference with entity nodes)
    const personNodes = findPersonNodesInText(caseId, event.description);
    for (const personNodeId of personNodes) {
      await createRelationship({
        sourceNode: personNodeId,
        targetNode: eventNodeId,
        relationshipType: RELATIONSHIP_TYPES.PARTICIPATED_IN,
        confidenceScore: 0.7,
        sourceDocument: event.sourceDocumentId,
      });
      edgesCreated++;
    }

    // Link events to locations mentioned in event description
    const locationNodes = findLocationNodesInText(caseId, event.description);
    for (const locationNodeId of locationNodes) {
      await createRelationship({
        sourceNode: eventNodeId,
        targetNode: locationNodeId,
        relationshipType: RELATIONSHIP_TYPES.OCCURRED_AT,
        confidenceScore: 0.7,
        sourceDocument: event.sourceDocumentId,
      });
      edgesCreated++;
    }
  }

  return { nodesCreated, edgesCreated };
}

async function buildStatementNodes(caseId) {
  let nodesCreated = 0;
  let edgesCreated = 0;

  const statements = await prisma.transcriptStatement.findMany({
    where: { caseId },
  });

  for (const stmt of statements) {
    const stmtNodeId = `stmt-${stmt.id}`;

    await createNode({
      id: stmtNodeId,
      type: NODE_TYPES.STATEMENT,
      caseId,
      label: `${stmt.speaker}: "${stmt.statementText.substring(0, 60)}..."`,
      metadata: {
        speaker: stmt.speaker,
        statementType: stmt.statementType,
        lineNumber: stmt.lineNumber,
        confidence: stmt.confidence,
        transcriptId: stmt.transcriptId,
      },
    });
    nodesCreated++;

    // Create person node for speaker
    const speakerNodeId = `person-${caseId}-${stmt.speaker.toLowerCase().replace(/\s+/g, '_')}`;
    await createNode({
      id: speakerNodeId,
      type: NODE_TYPES.PERSON,
      caseId,
      label: stmt.speaker,
      metadata: { role: 'speaker' },
    });

    // Link speaker to statement
    await createRelationship({
      sourceNode: speakerNodeId,
      targetNode: stmtNodeId,
      relationshipType: RELATIONSHIP_TYPES.TESTIFIED_ABOUT,
      confidenceScore: stmt.confidence,
      sourceDocument: stmt.transcriptId,
    });
    edgesCreated++;

    // Link statement to transcript document
    await createRelationship({
      sourceNode: stmtNodeId,
      targetNode: `doc-${stmt.transcriptId}`,
      relationshipType: RELATIONSHIP_TYPES.REFERENCED_BY,
      confidenceScore: stmt.confidence,
      sourceDocument: stmt.transcriptId,
    });
    edgesCreated++;
  }

  return { nodesCreated, edgesCreated };
}

async function buildConflictRelationships(caseId) {
  let edgesCreated = 0;

  const conflicts = await prisma.evidenceConflict.findMany({
    where: { caseId },
  });

  for (const conflict of conflicts) {
    // Link the two conflicting documents
    await createRelationship({
      sourceNode: `doc-${conflict.documentA}`,
      targetNode: `doc-${conflict.documentB}`,
      relationshipType: RELATIONSHIP_TYPES.CONTRADICTS,
      confidenceScore: conflict.confidence,
      metadata: {
        entity: conflict.entity,
        conflictType: conflict.conflictType,
        description: conflict.description,
      },
    });
    edgesCreated++;
  }

  return { edgesCreated };
}

async function buildDocumentNodes(caseId) {
  let nodesCreated = 0;

  // Get unique document IDs from entities
  const entityDocs = await prisma.documentEntity.findMany({
    where: { caseId },
    select: { documentId: true },
    distinct: ['documentId'],
  });

  // Get unique document IDs from events
  const eventDocs = await prisma.caseEvent.findMany({
    where: { caseId, sourceDocumentId: { not: null } },
    select: { sourceDocumentId: true },
    distinct: ['sourceDocumentId'],
  });

  // Get unique document IDs from statements
  const stmtDocs = await prisma.transcriptStatement.findMany({
    where: { caseId },
    select: { transcriptId: true },
    distinct: ['transcriptId'],
  });

  const allDocIds = new Set([
    ...entityDocs.map(d => d.documentId),
    ...eventDocs.map(d => d.sourceDocumentId).filter(Boolean),
    ...stmtDocs.map(d => d.transcriptId),
  ]);

  for (const docId of allDocIds) {
    await createNode({
      id: `doc-${docId}`,
      type: NODE_TYPES.DOCUMENT,
      caseId,
      label: `Document ${docId.substring(0, 8)}`,
      metadata: { documentId: docId },
    });
    nodesCreated++;
  }

  return { nodesCreated };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntityNodeId(entity) {
  const normalized = entity.entityValue.toLowerCase().replace(/\s+/g, '_');
  return `${entity.entityType}-${entity.caseId}-${normalized}`;
}

function mapEntityTypeToNodeType(entityType) {
  const mapping = {
    person: NODE_TYPES.PERSON,
    date: NODE_TYPES.EVENT,
    location: NODE_TYPES.LOCATION,
    phone: NODE_TYPES.EVIDENCE,
    case_number: NODE_TYPES.EVIDENCE,
    agency: NODE_TYPES.ORGANIZATION,
    evidence_ref: NODE_TYPES.EVIDENCE,
  };
  return mapping[entityType] || NODE_TYPES.EVIDENCE;
}

/**
 * Find person nodes already in the graph whose labels appear in the given text.
 * Uses searchGraphEntities from graphService for cross-referencing.
 */
function findPersonNodesInText(_caseId, _text) {
  // Phase 117: Cross-reference is handled at the graph query level.
  // Full text-to-node matching will be enhanced in Phase 118 with NER.
  return [];
}

/**
 * Find location nodes already in the graph whose labels appear in the given text.
 */
function findLocationNodesInText(_caseId, _text) {
  // Phase 117: Cross-reference is handled at the graph query level.
  // Full text-to-node matching will be enhanced in Phase 118 with NER.
  return [];
}
