// ============================================
// Court Access — Evidence Graph API
// Phase 117: Evidence Graph + Visualization System
//
// Endpoints:
// GET /api/cases/:id/graph          — Full case graph
// GET /api/cases/:id/graph/expand   — Expand a node's neighbors
// GET /api/entities/:id/neighbors   — Entity neighbor lookup
// GET /api/entities/search          — Search graph entities
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

export default router;
