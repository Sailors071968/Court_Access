// ============================================
// Court Access — Evidence Graph API
// Phase 117 + 118: Evidence Graph + Graph Intelligence v2
//
// Endpoints:
// GET /api/cases/:id/graph             — Full case graph
// GET /api/cases/:id/graph/expand      — Expand a node's neighbors
// GET /api/cases/:id/graph/path        — Path queries between entities
// GET /api/cases/:id/graph/intelligence — Graph intelligence insights
// POST /api/cases/:id/graph/intelligence/run — Run intelligence analysis
// GET /api/cases/:id/graph/scores      — Evidence strength scores
// POST /api/cases/:id/graph/scores/run — Run evidence scoring
// GET /api/cases/:id/graph/anomalies   — Timeline anomalies
// POST /api/cases/:id/graph/ai-analysis — Run AI analysis
// GET /api/entities/:id/neighbors      — Entity neighbor lookup
// GET /api/entities/search             — Search graph entities
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { verifyCaseOwnership } from '../middleware/tenantIsolation.js';
import {
  getCaseGraph,
  getEntityNeighbors,
  searchGraphEntities,
  expandNode,
  getGraphStats,
} from '../services/graphService.js';
import { buildCaseGraph } from '../engines/evidenceGraphBuilder.js';
import {
  runGraphIntelligence,
  getStoredInsights,
  detectTimelineAnomalies,
  identifyCentralActors,
  detectEventClusters,
  analyzeEntityFrequency,
  computeRelationshipDensity,
} from '../engines/graphIntelligenceEngine.js';
import {
  scoreAllEvidence,
  getEvidenceScores,
  scoreEntity,
} from '../engines/evidenceStrengthEngine.js';
import {
  runAnalysis,
  getAvailableAnalyses,
} from '../services/aiAnalysisService.js';
import {
  getCached,
  setCached,
  caseGraphKey,
  graphInsightsKey,
  evidenceScoresKey,
  invalidateCaseGraphCache,
} from '../services/graphCacheService.js';

const router = Router();

// All graph routes require authentication
router.use(authenticate);

// Map :id param to :caseId for tenant isolation
router.param('id', (req, _res, next, val) => {
  req.params.caseId = val;
  next();
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/graph
// Returns the full evidence graph for a case.
// Query params: ?nodeTypes=Person,Event&relationshipTypes=MENTIONED_IN&limit=500
// ---------------------------------------------------------------------------

router.get('/:id/graph', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { nodeTypes, relationshipTypes, limit, rebuild } = req.query;

    // Optionally rebuild graph from Phase 116 data
    if (rebuild === 'true') {
      const result = await buildCaseGraph(caseId);
      console.log(`[EvidenceGraph] Rebuilt graph for case ${caseId}: ${result.nodesCreated} nodes, ${result.edgesCreated} edges`);
    }

    const graph = await getCaseGraph(caseId, {
      nodeTypes: nodeTypes ? nodeTypes.split(',') : undefined,
      relationshipTypes: relationshipTypes ? relationshipTypes.split(',') : undefined,
      limit: limit ? parseInt(limit, 10) : 500,
    });

    const stats = await getGraphStats(caseId);

    res.json({
      caseId,
      nodes: graph.nodes,
      edges: graph.edges,
      stats,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Graph error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch case graph' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id/graph/expand
// Expand a specific node to load its neighbors (lazy loading).
// Query params: ?nodeId=xxx&nodeTypes=Person&relationshipTypes=MENTIONED_IN
// ---------------------------------------------------------------------------

router.get('/:id/graph/expand', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { nodeId, nodeTypes, relationshipTypes } = req.query;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId query parameter is required' });
    }

    const result = await expandNode(caseId, nodeId, {
      nodeTypes: nodeTypes ? nodeTypes.split(',') : undefined,
      relationshipTypes: relationshipTypes ? relationshipTypes.split(',') : undefined,
    });

    res.json({
      caseId,
      expandedNodeId: nodeId,
      nodes: result.nodes,
      edges: result.edges,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Expand error: ${err.message}`);
    res.status(500).json({ error: 'Failed to expand node' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/entities/:entityId/neighbors
// Get neighbors of a specific entity.
// Query params: ?depth=1&relationshipTypes=MENTIONED_IN,PARTICIPATED_IN
// ---------------------------------------------------------------------------

router.get('/entities/:entityId/neighbors', async (req, res) => {
  try {
    const { entityId } = req.params;
    const { depth, relationshipTypes } = req.query;

    const result = await getEntityNeighbors(entityId, {
      depth: depth ? parseInt(depth, 10) : 1,
      relationshipTypes: relationshipTypes ? relationshipTypes.split(',') : undefined,
    });

    res.json({
      entityId,
      nodes: result.nodes,
      edges: result.edges,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Neighbors error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch entity neighbors' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/entities/search
// Search for entities across the graph.
// Query params: ?q=Officer+Smith&caseId=xxx&type=Person&limit=50
// ---------------------------------------------------------------------------

router.get('/entities/search', async (req, res) => {
  try {
    const { q, caseId, type, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'q query parameter is required' });
    }

    const results = await searchGraphEntities(q, {
      caseId: caseId || undefined,
      type: type || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      query: q,
      results,
      count: results.length,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Search error: ${err.message}`);
    res.status(500).json({ error: 'Failed to search entities' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/path
// Advanced path queries between two entities.
// Query params: ?from=nodeId1&to=nodeId2&maxDepth=5
// ---------------------------------------------------------------------------

router.get('/:id/graph/path', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { from, to, maxDepth } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }

    const depth = maxDepth ? parseInt(maxDepth, 10) : 5;
    const graph = await getCaseGraph(caseId, { limit: 5000 });

    // BFS shortest path
    const adjacency = new Map();
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
      adjacency.get(edge.source).push({ nodeId: edge.target, edge });
      adjacency.get(edge.target).push({ nodeId: edge.source, edge });
    }

    const visited = new Set();
    const queue = [{ nodeId: from, path: [from], edges: [] }];
    visited.add(from);
    let foundPath = null;

    while (queue.length > 0 && !foundPath) {
      const current = queue.shift();
      if (current.path.length > depth) break;

      const neighbors = adjacency.get(current.nodeId) || [];
      for (const neighbor of neighbors) {
        if (neighbor.nodeId === to) {
          foundPath = {
            nodes: [...current.path, to],
            edges: [...current.edges, neighbor.edge],
            length: current.path.length,
          };
          break;
        }
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          queue.push({
            nodeId: neighbor.nodeId,
            path: [...current.path, neighbor.nodeId],
            edges: [...current.edges, neighbor.edge],
          });
        }
      }
    }

    // Resolve node labels
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    res.json({
      caseId,
      from,
      to,
      found: !!foundPath,
      path: foundPath ? {
        nodes: foundPath.nodes.map(id => nodeMap.get(id) || { id, label: id }),
        edges: foundPath.edges,
        length: foundPath.length,
      } : null,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Path query error: ${err.message}`);
    res.status(500).json({ error: 'Failed to execute path query' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/intelligence
// Get stored graph intelligence insights.
// Query params: ?type=central_actor&limit=50
// ---------------------------------------------------------------------------

router.get('/:id/graph/intelligence', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { type, limit } = req.query;

    // Check cache first
    const cacheKey = graphInsightsKey(caseId, type || '');
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const insights = await getStoredInsights(caseId, {
      type: type || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    const result = { caseId, insights, count: insights.length };
    await setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[EvidenceGraph] Intelligence error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch graph insights' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: POST /api/cases/:id/graph/intelligence/run
// Run full graph intelligence analysis.
// ---------------------------------------------------------------------------

router.post('/:id/graph/intelligence/run', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;

    const result = await runGraphIntelligence(caseId);

    // Invalidate cache
    await invalidateCaseGraphCache(caseId);

    res.json({
      caseId,
      insights: result.insights,
      stats: result.stats,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Intelligence run error: ${err.message}`);
    res.status(500).json({ error: 'Failed to run graph intelligence' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/scores
// Get evidence strength scores.
// Query params: ?type=Person&minScore=0.5&limit=100
// ---------------------------------------------------------------------------

router.get('/:id/graph/scores', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { type, minScore, limit } = req.query;

    // Check cache
    const cacheKey = evidenceScoresKey(caseId);
    const cached = await getCached(cacheKey);
    if (cached && !type && !minScore) {
      return res.json({ ...cached, fromCache: true });
    }

    const scores = await getEvidenceScores(caseId, {
      type: type || undefined,
      minScore: minScore ? parseFloat(minScore) : 0,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    const result = { caseId, scores, count: scores.length };
    if (!type && !minScore) {
      await setCached(cacheKey, result);
    }
    res.json(result);
  } catch (err) {
    console.error(`[EvidenceGraph] Scores error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch evidence scores' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: POST /api/cases/:id/graph/scores/run
// Run evidence strength scoring.
// ---------------------------------------------------------------------------

router.post('/:id/graph/scores/run', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const scores = await scoreAllEvidence(caseId);

    await invalidateCaseGraphCache(caseId);

    res.json({
      caseId,
      scores: scores.slice(0, 100),
      total: scores.length,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Scoring run error: ${err.message}`);
    res.status(500).json({ error: 'Failed to run evidence scoring' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/anomalies
// Get timeline anomalies.
// ---------------------------------------------------------------------------

router.get('/:id/graph/anomalies', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const anomalies = await detectTimelineAnomalies(caseId);

    res.json({
      caseId,
      anomalies,
      count: anomalies.length,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] Anomalies error: ${err.message}`);
    res.status(500).json({ error: 'Failed to detect timeline anomalies' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: POST /api/cases/:id/graph/ai-analysis
// Run AI analysis.
// Body: { analysisType: 'case_summary' | 'timeline_analysis' | ... }
// ---------------------------------------------------------------------------

router.post('/:id/graph/ai-analysis', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { analysisType, data } = req.body;

    if (!analysisType) {
      return res.status(400).json({ error: 'analysisType is required' });
    }

    const result = await runAnalysis(caseId, analysisType, data || {});

    res.json({
      caseId,
      ...result,
    });
  } catch (err) {
    console.error(`[EvidenceGraph] AI analysis error: ${err.message}`);
    res.status(500).json({ error: 'Failed to run AI analysis' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/ai-analyses
// Get available AI analysis types.
// ---------------------------------------------------------------------------

router.get('/:id/graph/ai-analyses', verifyCaseOwnership, async (_req, res) => {
  try {
    const analyses = getAvailableAnalyses();
    res.json({ analyses });
  } catch (err) {
    console.error(`[EvidenceGraph] Available analyses error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch available analyses' });
  }
});

// ---------------------------------------------------------------------------
// Phase 118: GET /api/cases/:id/graph/entity-score/:nodeId
// Score a specific entity.
// ---------------------------------------------------------------------------

router.get('/:id/graph/entity-score/:nodeId', verifyCaseOwnership, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { nodeId } = req.params;

    const result = await scoreEntity(caseId, nodeId);
    res.json({ caseId, ...result });
  } catch (err) {
    console.error(`[EvidenceGraph] Entity score error: ${err.message}`);
    res.status(500).json({ error: 'Failed to score entity' });
  }
});

export default router;
