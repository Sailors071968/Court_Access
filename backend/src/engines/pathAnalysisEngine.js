// ============================================
// Court Access — Path Analysis Engine
// Phase 146: Analyze evidence paths and connections
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Analyze paths between evidence items in the graph.
 * @param {string} caseId
 * @param {string} sourceId - Starting node ID
 * @param {string} targetId - Target node ID
 * @returns {{ paths: object[], shortestPath: object, summary: object }}
 */
export async function analyzeEvidencePaths(caseId, sourceId, targetId) {
  console.log(`[PathAnalysis] Finding paths from ${sourceId} to ${targetId} in case ${caseId}`);

  const graph = await prisma.enrichedGraph.findUnique({ where: { caseId } });
  if (!graph) throw new Error(`No enriched graph found for case ${caseId}`);

  const adjacency = buildAdjacencyList(graph.edges);
  const paths = findAllPaths(adjacency, sourceId, targetId, 5);

  const scoredPaths = paths.map(path => ({
    nodes: path,
    length: path.length - 1,
    edges: getPathEdges(graph.edges, path),
    strength: calculatePathStrength(graph.edges, path),
  }));

  scoredPaths.sort((a, b) => b.strength - a.strength);

  const result = {
    caseId,
    sourceId,
    targetId,
    paths: scoredPaths,
    shortestPath: scoredPaths.length > 0 ? scoredPaths.reduce((min, p) => p.length < min.length ? p : min) : null,
    strongestPath: scoredPaths.length > 0 ? scoredPaths[0] : null,
    summary: {
      totalPaths: scoredPaths.length,
      shortestLength: scoredPaths.length > 0 ? Math.min(...scoredPaths.map(p => p.length)) : -1,
      avgStrength: scoredPaths.length > 0
        ? Math.round((scoredPaths.reduce((s, p) => s + p.strength, 0) / scoredPaths.length) * 100) / 100
        : 0,
    },
  };

  // Store analysis
  await prisma.pathAnalysis.create({
    data: {
      caseId,
      sourceId,
      targetId,
      paths: scoredPaths,
      shortestPathLength: result.summary.shortestLength,
      strongestPathStrength: scoredPaths.length > 0 ? scoredPaths[0].strength : 0,
      metadata: result.summary,
    },
  });

  return result;
}

function buildAdjacencyList(edges) {
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source).push(edge.target);
    adj.get(edge.target).push(edge.source);
  }
  return adj;
}

function findAllPaths(adjacency, source, target, maxDepth) {
  const paths = [];
  const visited = new Set();

  function dfs(current, path) {
    if (path.length > maxDepth) return;
    if (current === target) {
      paths.push([...path]);
      return;
    }

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor, path);
      path.pop();
      visited.delete(neighbor);
    }
  }

  visited.add(source);
  dfs(source, [source]);
  return paths;
}

function getPathEdges(allEdges, path) {
  const edges = [];
  for (let i = 0; i < path.length - 1; i++) {
    const edge = allEdges.find(e =>
      (e.source === path[i] && e.target === path[i + 1]) ||
      (e.target === path[i] && e.source === path[i + 1])
    );
    if (edge) edges.push(edge);
  }
  return edges;
}

function calculatePathStrength(allEdges, path) {
  const edges = getPathEdges(allEdges, path);
  if (edges.length === 0) return 0;
  const avgWeight = edges.reduce((sum, e) => sum + (e.weight || 0.5), 0) / edges.length;
  const lengthPenalty = 1 / path.length;
  return Math.round(avgWeight * lengthPenalty * 100) / 100;
}

/**
 * Find all connections for a specific evidence item.
 * @param {string} caseId
 * @param {string} nodeId
 * @returns {{ connections: object[], summary: object }}
 */
export async function findNodeConnections(caseId, nodeId) {
  const graph = await prisma.enrichedGraph.findUnique({ where: { caseId } });
  if (!graph) return { connections: [], summary: { total: 0 } };

  const connections = graph.edges.filter(e => e.source === nodeId || e.target === nodeId);
  return {
    connections,
    summary: {
      total: connections.length,
      byType: connections.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}
