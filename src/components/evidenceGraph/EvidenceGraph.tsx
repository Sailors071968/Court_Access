// ============================================
// Court Access — Interactive Evidence Graph
// Phase 117: Evidence Graph + Visualization System
// Uses Cytoscape.js with WebGL rendering
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

export default function EvidenceGraph({
  nodes,
  edges,
  onNodeSelect,
  onNodeExpand,
  selectedNodeId,
  filterTypes,
  highlightRelationships,
  className = '',
}: EvidenceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onNodeExpandRef = useRef(onNodeExpand);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onNodeExpandRef.current = onNodeExpand;
  }, [onNodeExpand]);

  // Filter nodes by type
  const filteredNodes = filterTypes && filterTypes.length > 0
    ? nodes.filter(n => filterTypes.includes(n.type))
    : nodes;

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

    // Run layout
    if (cyNodes.length > 0) {
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        randomize: cyNodes.length > 50,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
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

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />

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
          ⊞
        </button>
      </div>

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
      </div>

      {/* Stats */}
      <div className="absolute top-3 left-3 bg-gray-800/90 rounded px-2 py-1 text-xs text-gray-400">
        {filteredNodes.length} nodes · {filteredEdges.length} edges
      </div>
    </div>
  );
}
