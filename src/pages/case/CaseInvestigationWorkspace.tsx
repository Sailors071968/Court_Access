// ============================================
// Court Access — Investigation Workspace
// Phase 117 + 118: Evidence Graph + Graph Intelligence v2
//
// Layout:
// -------------------------------------------------
// |    Evidence Graph    |   AI Insight Panel     |
// -------------------------------------------------
// | Timeline | Document Viewer | Entity Inspector |
// -------------------------------------------------
//
// Phase 118 additions:
// - AI Insight Panel (right side of graph)
// - Intelligence dashboard link
// - Keyboard shortcuts (F, E, T, D)
// - Entity breadcrumbs
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import EvidenceGraph from '../../components/evidenceGraph/EvidenceGraph';
import GraphFilterToolbar from '../../components/evidenceGraph/GraphFilterToolbar';
import EntityInspector from '../../components/evidenceGraph/EntityInspector';
import DocumentIntelligenceViewer from '../../components/evidenceGraph/DocumentIntelligenceViewer';
import AIInsightPanel from '../../components/evidenceGraph/AIInsightPanel';
import CaseTimeline from '../../components/caseTimeline/CaseTimeline';
import type { GraphNode, GraphEdge } from '../../components/evidenceGraph/EvidenceGraph';
import type { TimelineEvent } from '../../components/caseTimeline/CaseTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphResponse {
  caseId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    typeCounts: Record<string, number>;
    relationshipTypeCounts: Record<string, number>;
  };
}

interface DetectedEntity {
  id: string;
  entityType: string;
  entityValue: string;
  confidence: number;
  sourceContext: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchWithAuth(url: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CaseInvestigationWorkspace() {
  const { caseId } = useParams<{ caseId: string }>();

  // Graph state
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [graphStats, setGraphStats] = useState<GraphResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterNodeTypes, setFilterNodeTypes] = useState<string[]>([]);
  const [filterRelTypes, setFilterRelTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  // Document viewer state
  const [viewerDocument, setViewerDocument] = useState<{
    id: string;
    name: string;
    text: string;
    entities: DetectedEntity[];
  } | null>(null);

  // Phase 118: AI panel state
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; label: string }>>([]);
  const timelinePanelRef = useRef<HTMLDivElement>(null);

  // Load graph data
  const loadGraph = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    try {
      const data: GraphResponse = await fetchWithAuth(
        `/api/cases/${caseId}/graph?rebuild=true`
      );
      setNodes(data.nodes);
      setEdges(data.edges);
      setGraphStats(data.stats);
    } catch (err) {
      console.error('[Workspace] Failed to load graph:', err);
      setError('Failed to load evidence graph. The graph will be built as documents are processed.');
      // Set empty state so UI still renders
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Load timeline data
  const loadTimeline = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await fetchWithAuth(`/api/cases/${caseId}/timeline`);
      const events: TimelineEvent[] = (data.events || []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        timestamp: e.timestamp as string,
        eventType: e.eventType as string,
        description: e.description as string,
        sourceDocumentId: e.sourceDocumentId as string | undefined,
        confidence: (e.confidence as number) || 1.0,
        displayTime: e.displayTime as string | undefined,
      }));
      setTimelineEvents(events);
    } catch (err) {
      console.error('[Workspace] Failed to load timeline:', err);
      setTimelineEvents([]);
    }
  }, [caseId]);

  useEffect(() => {
    loadGraph();
    loadTimeline();
  }, [loadGraph, loadTimeline]);

  // Handle node selection in graph
  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);

    // If event node selected, highlight in timeline
    if (node?.type === 'Event' && node.metadata) {
      const meta = node.metadata as Record<string, string>;
      if (meta.eventId) {
        setSelectedEventId(meta.eventId);
      }
    }
  }, []);

  // Handle node expand (lazy loading)
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    if (!caseId) return;
    try {
      const data = await fetchWithAuth(
        `/api/cases/${caseId}/graph/expand?nodeId=${encodeURIComponent(nodeId)}`
      );

      // Merge new nodes and edges
      setNodes(prev => {
        const existing = new Set(prev.map(n => n.id));
        const newNodes = (data.nodes || []).filter((n: GraphNode) => !existing.has(n.id));
        return [...prev, ...newNodes];
      });
      setEdges(prev => {
        const existing = new Set(prev.map(e => e.id));
        const newEdges = (data.edges || []).filter((e: GraphEdge) => !existing.has(e.id));
        return [...prev, ...newEdges];
      });
    } catch (err) {
      console.error('[Workspace] Failed to expand node:', err);
    }
  }, [caseId]);

  // Handle timeline event selection
  const handleTimelineEventSelect = useCallback((event: TimelineEvent | null) => {
    if (event) {
      setSelectedEventId(event.id);
      // Find corresponding graph node
      const eventNode = nodes.find(
        n => n.type === 'Event' && n.id === `event-${event.id}`
      );
      if (eventNode) {
        setSelectedNode(eventNode);
      }
    } else {
      setSelectedEventId(null);
    }
  }, [nodes]);

  // Handle navigation to a node
  const handleNavigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      // Phase 118: Update breadcrumbs
      setBreadcrumbs(prev => {
        const existing = prev.findIndex(bc => bc.id === nodeId);
        if (existing >= 0) return prev.slice(0, existing + 1);
        return [...prev.slice(-4), { id: node.id, label: node.label }];
      });
    }
  }, [nodes]);

  // Phase 118: Jump to timeline panel
  const handleJumpToTimeline = useCallback(() => {
    timelinePanelRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Phase 118: Open document for selected node
  const handleOpenDocument = useCallback(() => {
    if (selectedNode?.type === 'Document') {
      handleNavigateToDocument(selectedNode.id.replace('document-', ''));
    }
  }, [selectedNode, handleNavigateToDocument]);

  // Handle navigation to a document
  const handleNavigateToDocument = useCallback(async (documentId: string) => {
    if (!caseId) return;
    try {
      const entities = await fetchWithAuth(
        `/api/cases/${caseId}/entities?documentId=${encodeURIComponent(documentId)}`
      );
      setViewerDocument({
        id: documentId,
        name: `Document ${documentId.substring(0, 8)}`,
        text: '', // Document text would be fetched from storage
        entities: (entities.entities || []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          entityType: e.entityType as string,
          entityValue: e.entityValue as string,
          confidence: (e.confidence as number) || 1.0,
          sourceContext: (e.sourceContext as string) || '',
        })),
      });
    } catch (err) {
      console.error('[Workspace] Failed to load document:', err);
    }
  }, [caseId]);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Investigation Workspace</h1>
          {graphStats && (
            <span className="text-xs text-gray-500">
              {graphStats.nodeCount} nodes · {graphStats.edgeCount} relationships
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/app/cases/${caseId}/intelligence`}
            className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
          >
            Intelligence Dashboard
          </Link>
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              showAIPanel
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            AI Panel
          </button>
          <button
            onClick={loadGraph}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh Graph'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <GraphFilterToolbar
        activeNodeTypes={filterNodeTypes}
        activeRelTypes={filterRelTypes}
        onNodeTypesChange={setFilterNodeTypes}
        onRelTypesChange={setFilterRelTypes}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleNavigateToNode}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Row: Evidence Graph + AI Panel */}
        <div className="flex-1 min-h-[300px] flex">
          {/* Graph area */}
          <div className={showAIPanel ? 'flex-1' : 'w-full'}>
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 p-8">
                <div className="text-3xl mb-3">🔬</div>
                <p className="text-sm mb-2">{error}</p>
                <button
                  onClick={loadGraph}
                  className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="animate-spin text-2xl mb-2">⚙️</div>
                <p className="text-sm">Building evidence graph...</p>
              </div>
            </div>
          ) : (
            <EvidenceGraph
              nodes={nodes}
              edges={edges}
              onNodeSelect={handleNodeSelect}
              onNodeExpand={handleNodeExpand}
              onJumpToTimeline={handleJumpToTimeline}
              onOpenDocument={handleOpenDocument}
              selectedNodeId={selectedNode?.id || null}
              filterTypes={filterNodeTypes.length > 0 ? filterNodeTypes : undefined}
              highlightRelationships={filterRelTypes.length > 0 ? filterRelTypes : undefined}
              className="h-full"
            />
          )}
          </div>

          {/* Phase 118: AI Insight Panel */}
          {showAIPanel && caseId && (
            <div className="w-72 border-l border-gray-800">
              <AIInsightPanel
                caseId={caseId}
                selectedNodeId={selectedNode?.id || null}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Bottom Row: Timeline | Document Viewer | Entity Inspector */}
        <div className="grid grid-cols-3 gap-px bg-gray-800 border-t border-gray-700" style={{ height: '45%', minHeight: '280px' }}>
          {/* Timeline Panel */}
          <div ref={timelinePanelRef} className="bg-gray-950 overflow-hidden">
            <CaseTimeline
              events={timelineEvents}
              onEventSelect={handleTimelineEventSelect}
              selectedEventId={selectedEventId}
              className="h-full"
            />
          </div>

          {/* Document Viewer Panel */}
          <div className="bg-gray-950 overflow-hidden">
            {viewerDocument ? (
              <DocumentIntelligenceViewer
                documentId={viewerDocument.id}
                documentName={viewerDocument.name}
                documentText={viewerDocument.text}
                entities={viewerDocument.entities}
                onEntityClick={(entity) => {
                  // Navigate to entity's graph node
                  const nodeId = `${entity.entityType}-${caseId}-${entity.entityValue.toLowerCase().replace(/\s+/g, '_')}`;
                  handleNavigateToNode(nodeId);
                }}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center p-4">
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-sm">Select a document node</p>
                  <p className="text-xs mt-1">Click a purple document node in the graph</p>
                </div>
              </div>
            )}
          </div>

          {/* Entity Inspector Panel */}
          <div className="bg-gray-950 overflow-hidden">
            <EntityInspector
              selectedNode={selectedNode}
              edges={edges}
              allNodes={nodes}
              onNavigateToNode={handleNavigateToNode}
              onNavigateToDocument={handleNavigateToDocument}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
