// ============================================
// Court Access — Graph Enrichment Engine
// Phase 145: Enrich evidence graph with derived
// relationships and metadata
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Enrich the evidence graph with derived relationships.
 * @param {string} caseId
 * @returns {{ nodes: object[], edges: object[], summary: object }}
 */
export async function enrichEvidenceGraph(caseId) {
  console.log(`[GraphEnrichment] Enriching graph for case ${caseId}`);

  const [facts, correlations, witnesses, impacts, conflicts, registry] = await Promise.all([
    prisma.extractedFact.findMany({ where: { caseId } }),
    prisma.factCorrelation.findMany({ where: { caseId } }),
    prisma.witnessReliability.findMany({ where: { caseId } }),
    prisma.evidenceImpactScore.findMany({ where: { caseId } }),
    prisma.timelineConflict.findMany({ where: { caseId } }),
    prisma.evidenceRegistry.findMany({ where: { caseId } }),
  ]);

  const nodes = [];
  const edges = [];

  // Evidence nodes
  for (const ev of registry) {
    const impact = impacts.find(i => i.evidenceId === ev.evidenceId);
    nodes.push({
      id: ev.evidenceId,
      type: 'evidence',
      label: ev.originalFilename,
      category: ev.evidenceType,
      impactScore: impact?.overallImpactScore || 0,
      impactLevel: impact?.impactLevel || 'unknown',
      metadata: { fileHash: ev.fileHash, source: ev.source },
    });
  }

  // Person nodes from facts
  const persons = new Map();
  for (const fact of facts) {
    if (fact.factType === 'PERSON' && fact.normalizedValue) {
      if (!persons.has(fact.normalizedValue)) {
        const witness = witnesses.find(w => w.witnessName.toLowerCase() === fact.normalizedValue.toLowerCase());
        persons.set(fact.normalizedValue, {
          id: `person:${fact.normalizedValue}`,
          type: 'person',
          label: fact.normalizedValue,
          credibilityScore: witness?.credibilityScore || null,
          mentionCount: 0,
          documentIds: new Set(),
        });
      }
      const p = persons.get(fact.normalizedValue);
      p.mentionCount++;
      p.documentIds.add(fact.documentId);
    }
  }
  for (const [, p] of persons) {
    nodes.push({
      id: p.id,
      type: p.type,
      label: p.label,
      credibilityScore: p.credibilityScore,
      mentionCount: p.mentionCount,
      metadata: { documentIds: [...p.documentIds] },
    });

    // Edges: person → evidence (mentioned in)
    for (const docId of p.documentIds) {
      edges.push({
        source: p.id,
        target: docId,
        type: 'mentioned_in',
        weight: 1,
      });
    }
  }

  // Correlation edges
  for (const corr of correlations) {
    edges.push({
      source: corr.factAId,
      target: corr.factBId,
      type: corr.correlationType,
      weight: corr.confidenceScore,
      metadata: { correlationId: corr.id },
    });
  }

  // Conflict edges
  for (const conflict of conflicts) {
    edges.push({
      source: conflict.eventAId,
      target: conflict.eventBId,
      type: 'conflict',
      subtype: conflict.conflictType,
      weight: conflict.severity === 'critical' ? 1 : conflict.severity === 'high' ? 0.8 : 0.5,
      metadata: { conflictId: conflict.id, severity: conflict.severity },
    });
  }

  // Store enriched graph
  const graph = await prisma.enrichedGraph.upsert({
    where: { caseId },
    create: {
      caseId,
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      metadata: {
        enrichedAt: new Date().toISOString(),
        factCount: facts.length,
        correlationCount: correlations.length,
        conflictCount: conflicts.length,
      },
    },
    update: {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      metadata: {
        enrichedAt: new Date().toISOString(),
        factCount: facts.length,
        correlationCount: correlations.length,
        conflictCount: conflicts.length,
      },
    },
  });

  console.log(`[GraphEnrichment] Graph enriched: ${nodes.length} nodes, ${edges.length} edges`);

  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: groupBy(nodes, 'type'),
      edgeTypes: groupBy(edges, 'type'),
    },
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export async function getCaseEnrichedGraph(caseId) {
  return prisma.enrichedGraph.findUnique({ where: { caseId } });
}
