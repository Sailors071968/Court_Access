// ============================================
// Court Access — Graph-Fact Integration Service
// Phase E: Integrate verified facts into the evidence graph
// ============================================

import prisma from './prismaClient.js';

/**
 * Integrate verified facts into the evidence graph.
 * @param {string} caseId
 * @returns {{ nodes: number, edges: number, summary: object }}
 */
export async function integrateFactsIntoGraph(caseId) {
  console.log(`[GraphFactIntegration] Integrating facts into graph for case ${caseId}`);

  const graph = await prisma.enrichedGraph.findUnique({ where: { caseId } });
  if (!graph) {
    console.warn(`[GraphFactIntegration] No enriched graph found for case ${caseId}`);
    return { nodes: 0, edges: 0, summary: { error: 'No enriched graph' } };
  }

  const verifiedFacts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { in: ['verified', 'corroborated'] } },
  });

  const corroborations = await prisma.factCorroborationRecord.findMany({
    where: { caseId },
  });

  const existingNodes = graph.nodes || [];
  const existingEdges = graph.edges || [];
  const existingNodeIds = new Set(existingNodes.map(n => n.id));

  const newNodes = [];
  const newEdges = [];

  // Add verified fact nodes
  for (const fact of verifiedFacts) {
    const nodeId = `vfact:${fact.id}`;
    if (existingNodeIds.has(nodeId)) continue;

    newNodes.push({
      id: nodeId,
      type: 'verified_fact',
      label: fact.factText.substring(0, 80),
      factType: fact.factType,
      confidence: fact.confidence,
      verificationStatus: fact.verificationStatus,
      metadata: {
        documentId: fact.documentId,
        page: fact.page,
        line: fact.line,
        speaker: fact.speaker,
      },
    });

    // Edge: fact → document
    if (fact.documentId && existingNodeIds.has(fact.documentId)) {
      newEdges.push({
        source: nodeId,
        target: fact.documentId,
        type: 'extracted_from',
        weight: fact.confidence,
      });
    }

    // Edge: fact → person (speaker)
    if (fact.speaker) {
      const personId = `person:${fact.speaker}`;
      if (existingNodeIds.has(personId)) {
        newEdges.push({
          source: nodeId,
          target: personId,
          type: 'stated_by',
          weight: fact.confidence,
        });
      }
    }
  }

  // Add corroboration edges
  for (const corr of corroborations) {
    const factIds = corr.corroboratingFactIds || [];
    for (let i = 0; i < factIds.length; i++) {
      for (let j = i + 1; j < factIds.length; j++) {
        newEdges.push({
          source: `vfact:${factIds[i]}`,
          target: `vfact:${factIds[j]}`,
          type: 'corroborates',
          weight: corr.corroborationStrength,
        });
      }
    }
  }

  // Update graph
  const updatedNodes = [...existingNodes, ...newNodes];
  const updatedEdges = [...existingEdges, ...newEdges];

  await prisma.enrichedGraph.update({
    where: { caseId },
    data: {
      nodes: updatedNodes,
      edges: updatedEdges,
      nodeCount: updatedNodes.length,
      edgeCount: updatedEdges.length,
      metadata: {
        ...graph.metadata,
        lastFactIntegration: new Date().toISOString(),
        verifiedFactNodes: newNodes.length,
        corroborationEdges: newEdges.filter(e => e.type === 'corroborates').length,
      },
    },
  });

  console.log(`[GraphFactIntegration] Added ${newNodes.length} nodes and ${newEdges.length} edges`);

  return {
    nodes: newNodes.length,
    edges: newEdges.length,
    summary: {
      existingNodes: existingNodes.length,
      existingEdges: existingEdges.length,
      newNodes: newNodes.length,
      newEdges: newEdges.length,
      totalNodes: updatedNodes.length,
      totalEdges: updatedEdges.length,
    },
  };
}
