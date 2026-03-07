// ============================================
// Court Access — Entity Inspector Panel
// Phase 117: Evidence Graph + Visualization System
// Displays entity details, linked events, related evidence,
// contradictions, and statements when a node is selected.
// ============================================

import { useState } from 'react';
import type { GraphNode, GraphEdge } from './EvidenceGraph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityInspectorProps {
  selectedNode: GraphNode | null;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onNavigateToNode?: (nodeId: string) => void;
  onNavigateToDocument?: (documentId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EntityInspector({
  selectedNode,
  edges,
  allNodes,
  onNavigateToNode,
  onNavigateToDocument,
  className = '',
}: EntityInspectorProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'connections' | 'evidence' | 'contradictions'>('details');

  if (!selectedNode) {
    return (
      <div className={`bg-gray-900 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500 p-4">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm">Select a node to inspect</p>
          <p className="text-xs mt-1">Click a node in the graph</p>
        </div>
      </div>
    );
  }

  // Get connected edges
  const connectedEdges = edges.filter(
    e => e.source === selectedNode.id || e.target === selectedNode.id
  );

  // Get connected nodes
  const connectedNodeIds = new Set<string>();
  for (const edge of connectedEdges) {
    if (edge.source !== selectedNode.id) connectedNodeIds.add(edge.source);
    if (edge.target !== selectedNode.id) connectedNodeIds.add(edge.target);
  }
  const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id));

  // Get contradiction edges
  const contradictions = connectedEdges.filter(e => e.type === 'CONTRADICTS');

  // Get document connections
  const documentNodes = connectedNodes.filter(n => n.type === 'Document');

  // Group connections by relationship type
  const connectionsByType: Record<string, Array<{ node: GraphNode; edge: GraphEdge }>> = {};
  for (const edge of connectedEdges) {
    const neighborId = edge.source === selectedNode.id ? edge.target : edge.source;
    const neighbor = allNodes.find(n => n.id === neighborId);
    if (!neighbor) continue;

    if (!connectionsByType[edge.type]) {
      connectionsByType[edge.type] = [];
    }
    connectionsByType[edge.type].push({ node: neighbor, edge });
  }

  const NODE_COLORS: Record<string, string> = {
    Person: '#3B82F6',
    Event: '#F97316',
    Document: '#8B5CF6',
    Statement: '#22C55E',
    Evidence: '#EF4444',
    Location: '#EAB308',
    Organization: '#06B6D4',
  };

  const color = NODE_COLORS[selectedNode.type] || '#6B7280';

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'connections' as const, label: `Links (${connectedNodes.length})` },
    { id: 'evidence' as const, label: `Docs (${documentNodes.length})` },
    { id: 'contradictions' as const, label: `Issues (${contradictions.length})` },
  ];

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-white truncate">
              {selectedNode.label}
            </h3>
            <p className="text-xs text-gray-400">{selectedNode.type}</p>
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {selectedNode.connectionCount} links
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: '350px' }}>
        {activeTab === 'details' && (
          <div className="space-y-3">
            <MetadataSection title="Entity Metadata" metadata={selectedNode.metadata} />
            <div className="text-xs text-gray-500">
              Created: {new Date(selectedNode.createdAt).toLocaleString()}
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="space-y-3">
            {Object.entries(connectionsByType).map(([relType, connections]) => (
              <div key={relType}>
                <h4 className="text-xs font-medium text-gray-400 mb-1">
                  {relType.replace(/_/g, ' ')} ({connections.length})
                </h4>
                <div className="space-y-1">
                  {connections.map(({ node, edge }) => (
                    <button
                      key={node.id}
                      onClick={() => onNavigateToNode?.(node.id)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-left transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: NODE_COLORS[node.type] || '#6B7280' }}
                      />
                      <span className="text-xs text-gray-300 truncate flex-1">
                        {node.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(edge.confidence * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(connectionsByType).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No connections</p>
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-1">
            {documentNodes.map(doc => (
              <button
                key={doc.id}
                onClick={() => {
                  const docId = (doc.metadata as Record<string, string>)?.documentId;
                  if (docId) onNavigateToDocument?.(docId);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-left transition-colors"
              >
                <span className="text-sm">📄</span>
                <span className="text-xs text-gray-300 truncate flex-1">
                  {doc.label}
                </span>
              </button>
            ))}
            {documentNodes.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No linked documents</p>
            )}
          </div>
        )}

        {activeTab === 'contradictions' && (
          <div className="space-y-2">
            {contradictions.map(edge => {
              const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
              const otherNode = allNodes.find(n => n.id === otherId);
              const meta = edge.metadata as Record<string, string>;
              return (
                <div
                  key={edge.id}
                  className="bg-red-900/20 border border-red-800/30 rounded p-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-red-400 font-medium">
                      Contradiction
                    </span>
                    <span className="text-xs text-gray-500">
                      {(edge.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  {meta?.description && (
                    <p className="text-xs text-gray-400 mb-1">{meta.description}</p>
                  )}
                  {otherNode && (
                    <button
                      onClick={() => onNavigateToNode?.(otherNode.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      → {otherNode.label}
                    </button>
                  )}
                </div>
              );
            })}
            {contradictions.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No contradictions detected</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetadataSection({ title, metadata }: { title: string; metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  if (entries.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-400 mb-1">{title}</h4>
        <p className="text-xs text-gray-500">No metadata available</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-400 mb-1">{title}</h4>
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-gray-500">{key}</span>
            <span className="text-gray-300 truncate ml-2" style={{ maxWidth: '60%' }}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
