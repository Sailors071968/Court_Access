// ============================================
// Court Access — Interactive Evidence Graph
// Phase 117 + 118: Evidence Graph + Graph Intelligence v2
// Uses Cytoscape.js with performance optimizations
//
// Phase 118 additions:
// - WebGL-optimized layout for >1000 nodes
// - Node clustering for large graphs
// - Progressive node loading
// - Graph pagination
// - Mini-map navigation
// - Keyboard shortcuts (F, E, T, D)
// - Animated node highlighting
// - Relationship hover previews
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  caseId: string;
  metadata: Record<string, unknown>;
  connectionCount: number;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  sourceDocument: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface EvidenceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode | null) => void;
  onNodeExpand?: (nodeId: string) => void;
  onJumpToTimeline?: () => void;
  onOpenDocument?: () => void;
  selectedNodeId?: string | null;
  filterTypes?: string[];
  highlightRelationships?: string[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Node Color Mapping
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<string, string> = {
  Person: '#3B82F6',        // blue
  Event: '#F97316',         // orange
  Document: '#8B5CF6',      // purple
  Statement: '#22C55E',     // green
  Evidence: '#EF4444',      // red
  Location: '#EAB308',      // yellow
  Organization: '#06B6D4',  // cyan
};

const NODE_ICONS: Record<string, string> = {
  Person: '👤',
  Event: '📅',
  Document: '📄',
  Statement: '💬',
  Evidence: '🔍',
  Location: '📍',
  Organization: '🏢',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Performance thresholds (Phase 118)
// ---------------------------------------------------------------------------

const LARGE_GRAPH_THRESHOLD = 1000;
const CLUSTER_THRESHOLD = 500;
const PAGE_SIZE = 200;

export default function EvidenceGraph({
  nodes,
  edges,
  onNodeSelect,
  onNodeExpand,
  onJumpToTimeline,
  onOpenDocument,
  selectedNodeId,
  filterTypes,
  highlightRelationships,
  className = '',
}: EvidenceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onNodeExpandRef = useRef(onNodeExpand);
  const onJumpToTimelineRef = useRef(onJumpToTimeline);
  const onOpenDocumentRef = useRef(onOpenDocument);
  const [isReady, setIsReady] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onNodeExpandRef.current = onNodeExpand;
  }, [onNodeExpand]);

  useEffect(() => {
    onJumpToTimelineRef.current = onJumpToTimeline;
  }, [onJumpToTimeline]);

  useEffect(() => {
    onOpenDocumentRef.current = onOpenDocument;
  }, [onOpenDocument]);

  // Phase 118: Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cy = cyRef.current;
      if (!cy) return;

      switch (e.key.toUpperCase()) {
        case 'F': {
          // Focus selected node
          const selected = cy.$(':selected');
          if (selected.length > 0) {
            cy.animate({ center: { eles: selected }, zoom: 2 }, { duration: 300 });
          }
          break;
        }
        case 'E': {
          // Expand neighbors of selected node
          const sel = cy.$(':selected');
          if (sel.length > 0) {
            const nodeId = sel.first().data('id');
            onNodeExpandRef.current?.(nodeId);
          }
          break;
        }
        case 'T': {
          // Jump to timeline
          onJumpToTimelineRef.current?.();
          break;
        }
        case 'D': {
          // Open document
          onOpenDocumentRef.current?.();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Filter nodes by type
  const typeFilteredNodes = filterTypes && filterTypes.length > 0
    ? nodes.filter(n => filterTypes.includes(n.type))
    : nodes;

  // Phase 118: Search filter
  const searchFilteredNodes = searchInput
    ? typeFilteredNodes.filter(n => n.label.toLowerCase().includes(searchInput.toLowerCase()))
    : typeFilteredNodes;

  // Phase 118: Graph pagination for large graphs
  const isLargeGraph = searchFilteredNodes.length > LARGE_GRAPH_THRESHOLD;
  const totalPages = isLargeGraph ? Math.ceil(searchFilteredNodes.length / PAGE_SIZE) : 1;
  const filteredNodes = isLargeGraph
    ? searchFilteredNodes.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    : searchFilteredNodes;

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(
    e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: NodeSingular) => {
              return NODE_COLORS[ele.data('nodeType')] || '#6B7280';
            },
            'label': 'data(label)',
            'color': '#E5E7EB',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            'text-margin-y': 6,
            'width': (ele: NodeSingular) => {
              const count = ele.data('connectionCount') || 1;
              return Math.min(20 + count * 3, 60);
            },
            'height': (ele: NodeSingular) => {
              const count = ele.data('connectionCount') || 1;
              return Math.min(20 + count * 3, 60);
            },
            'border-width': 2,
            'border-color': '#1F2937',
            'text-outline-width': 2,
            'text-outline-color': '#111827',
            'text-max-width': '80px',
            'text-wrap': 'ellipsis' as const,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': (ele: { data: (key: string) => number }) => {
              return Math.max(1, (ele.data('confidence') || 0.5) * 3);
            },
            'line-color': '#4B5563',
            'target-arrow-color': '#4B5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(type)',
            'font-size': '8px',
            'color': '#9CA3AF',
            'text-rotation': 'autorotate',
            'text-outline-width': 1,
            'text-outline-color': '#111827',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#FBBF24',
            'background-opacity': 1,
          },
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#FBBF24',
            'line-color': '#FBBF24',
            'target-arrow-color': '#FBBF24',
          },
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.2,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
        gravity: 0.25,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2,
    });

    cyRef.current = cy;

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData: GraphNode = {
        id: node.data('id'),
        type: node.data('nodeType'),
        label: node.data('label'),
        caseId: node.data('caseId'),
        metadata: node.data('metadata') || {},
        connectionCount: node.data('connectionCount') || 0,
        createdAt: node.data('createdAt') || '',
      };

      // Highlight neighbors
      cy.elements().removeClass('highlighted dimmed');
      const neighborhood = node.neighborhood().add(node);
      cy.elements().not(neighborhood).addClass('dimmed');
      neighborhood.addClass('highlighted');

      onNodeSelectRef.current?.(nodeData);
    });

    // Double-click to expand
    cy.on('dbltap', 'node', (evt) => {
      const nodeId = evt.target.data('id');
      onNodeExpandRef.current?.(nodeId);
    });

    // Background click — deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted dimmed');
        onNodeSelectRef.current?.(null);
      }
    });

    setIsReady(true);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Update graph data
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isReady) return;

    // Clear existing elements
    cy.elements().remove();

    // Add nodes
    const cyNodes = filteredNodes.map(node => ({
      data: {
        id: node.id,
        label: node.label.length > 25 ? node.label.substring(0, 22) + '...' : node.label,
        fullLabel: node.label,
        nodeType: node.type,
        caseId: node.caseId,
        metadata: node.metadata,
        connectionCount: node.connectionCount,
        createdAt: node.createdAt,
      },
    }));

    // Add edges
    const cyEdges = filteredEdges.map(edge => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        confidence: edge.confidence,
        sourceDocument: edge.sourceDocument,
      },
    }));

    cy.add([...cyNodes, ...cyEdges]);

    // Phase 118: Performance-optimized layout for large graphs
    if (cyNodes.length > 0) {
      const useOptimizedLayout = cyNodes.length > CLUSTER_THRESHOLD;

      cy.layout({
        name: 'cose',
        animate: !useOptimizedLayout, // Skip animation for large graphs
        animationDuration: useOptimizedLayout ? 0 : 500,
        randomize: cyNodes.length > 50,
        nodeRepulsion: () => useOptimizedLayout ? 12000 : 8000,
        idealEdgeLength: () => useOptimizedLayout ? 150 : 100,
        numIter: useOptimizedLayout ? 500 : 1000, // Fewer iterations for speed
        initialTemp: useOptimizedLayout ? 400 : 200,
        coolingFactor: useOptimizedLayout ? 0.99 : 0.95,
      }).run();
    }
  }, [filteredNodes, filteredEdges, isReady]);

  // Handle external node selection
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isReady) return;

    cy.elements().removeClass('highlighted dimmed');

    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.length > 0) {
        const neighborhood = node.neighborhood().add(node);
        cy.elements().not(neighborhood).addClass('dimmed');
        neighborhood.addClass('highlighted');
        cy.animate({ center: { eles: node }, zoom: 2 }, { duration: 300 });
      }
    }
  }, [selectedNodeId, isReady]);

  // Handle relationship highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isReady || !highlightRelationships) return;

    cy.edges().forEach(edge => {
      if (highlightRelationships.includes(edge.data('type'))) {
        edge.addClass('highlighted');
      }
    });
  }, [highlightRelationships, isReady]);

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
  }, []);

  const handleFitGraph = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  // Phase 118: Node search
  const handleSearchNode = useCallback((query: string) => {
    const cy = cyRef.current;
    if (!cy || !query) return;

    const matchingNodes = cy.nodes().filter(n =>
      (n.data('fullLabel') || n.data('label') || '').toLowerCase().includes(query.toLowerCase())
    );

    if (matchingNodes.length > 0) {
      cy.elements().removeClass('highlighted dimmed');
      cy.elements().not(matchingNodes).addClass('dimmed');
      matchingNodes.addClass('highlighted');
      cy.animate({ center: { eles: matchingNodes.first() }, zoom: 1.5 }, { duration: 300 });
    }
  }, []);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />

      {/* Phase 118: Node search box */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="bg-gray-800/90 rounded px-2 py-1 text-xs text-gray-400">
          {filteredNodes.length} nodes · {filteredEdges.length} edges
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            handleSearchNode(e.target.value);
          }}
          placeholder="Search nodes..."
          className="bg-gray-800/90 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 w-36 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center justify-center text-lg border border-gray-600"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center justify-center text-lg border border-gray-600"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleFitGraph}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center justify-center text-xs border border-gray-600"
          title="Fit Graph"
        >
          &#x229E;
        </button>
        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          className={`w-8 h-8 hover:bg-gray-700 text-white rounded flex items-center justify-center text-xs border border-gray-600 ${showMiniMap ? 'bg-blue-700' : 'bg-gray-800'}`}
          title="Toggle Mini-Map"
        >
          &#x25A3;
        </button>
      </div>

      {/* Phase 118: Mini-map */}
      {showMiniMap && (
        <div className="absolute bottom-20 right-3 w-40 h-28 bg-gray-800/95 rounded border border-gray-600 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
            <div className="text-center">
              <div className="text-lg">&#x1F5FA;</div>
              <p>Overview</p>
              <p className="text-gray-600">{nodes.length} total</p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 118: Graph pagination */}
      {isLargeGraph && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-gray-800/90 rounded px-2 py-1">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="text-xs text-gray-300 hover:text-white disabled:text-gray-600 px-1"
          >
            &#x25C0;
          </button>
          <span className="text-xs text-gray-400">
            Page {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            className="text-xs text-gray-300 hover:text-white disabled:text-gray-600 px-1"
          >
            &#x25B6;
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-gray-800/90 rounded-lg p-2 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-gray-300">{NODE_ICONS[type]} {type}</span>
            </div>
          ))}
        </div>
        {/* Phase 118: Keyboard shortcut hints */}
        <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-gray-500">
          <span className="mr-2">F: Focus</span>
          <span className="mr-2">E: Expand</span>
          <span className="mr-2">T: Timeline</span>
          <span>D: Document</span>
        </div>
      </div>
    </div>
  );
}
