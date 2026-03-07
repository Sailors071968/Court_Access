// ============================================
// Court Access — Document Intelligence Viewer
// Phase 117: Evidence Graph + Visualization System
// Extends the document viewer with entity overlay highlighting.
// Clicking an entity focuses the graph node and highlights timeline events.
// ============================================

import { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedEntity {
  id: string;
  entityType: string;
  entityValue: string;
  confidence: number;
  sourceContext: string;
  startOffset?: number;
  endOffset?: number;
}

interface DocumentIntelligenceViewerProps {
  documentId: string;
  documentName: string;
  documentText: string;
  entities: DetectedEntity[];
  onEntityClick?: (entity: DetectedEntity) => void;
  onEntityHover?: (entity: DetectedEntity | null) => void;
  highlightedEntityId?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Entity Type Colors (matching graph node colors)
// ---------------------------------------------------------------------------

const ENTITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  person: { bg: 'bg-blue-900/30', text: 'text-blue-300', border: 'border-blue-500' },
  date: { bg: 'bg-orange-900/30', text: 'text-orange-300', border: 'border-orange-500' },
  location: { bg: 'bg-yellow-900/30', text: 'text-yellow-300', border: 'border-yellow-500' },
  phone: { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-500' },
  case_number: { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-500' },
  agency: { bg: 'bg-cyan-900/30', text: 'text-cyan-300', border: 'border-cyan-500' },
  evidence_ref: { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-500' },
};

const ENTITY_ICONS: Record<string, string> = {
  person: '👤',
  date: '📅',
  location: '📍',
  phone: '📞',
  case_number: '📋',
  agency: '🏢',
  evidence_ref: '🔍',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentIntelligenceViewer({
  documentId,
  documentName,
  documentText,
  entities,
  onEntityClick,
  onEntityHover,
  highlightedEntityId,
  className = '',
}: DocumentIntelligenceViewerProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Filter entities by type
  const filteredEntities = activeFilter
    ? entities.filter(e => e.entityType === activeFilter)
    : entities;

  // Count entities by type
  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) {
      counts[e.entityType] = (counts[e.entityType] || 0) + 1;
    }
    return counts;
  }, [entities]);

  // Build highlighted text
  const highlightedText = useMemo(() => {
    if (!showOverlay || filteredEntities.length === 0) {
      return documentText;
    }

    // Sort entities by value length (longest first for proper replacement)
    const sorted = [...filteredEntities].sort(
      (a, b) => b.entityValue.length - a.entityValue.length
    );

    let result = documentText;

    for (const entity of sorted) {
      const escapedValue = entity.entityValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedValue}\\b`, 'gi');

      result = result.replace(regex, (match) => {
        return `{{ENTITY:${entity.id}:${entity.entityType}:${match}}}`;
      });
    }

    return result;
  }, [documentText, filteredEntities, showOverlay]);

  // Render text with entity highlights
  const renderHighlightedText = () => {
    const parts = highlightedText.split(/({{ENTITY:[^}]+}})/g);

    return parts.map((part, idx) => {
      const entityMatch = part.match(/{{ENTITY:([^:]+):([^:]+):(.+)}}/);
      if (!entityMatch) {
        return <span key={idx}>{part}</span>;
      }

      const [, entityId, entityType, entityText] = entityMatch;
      const entity = filteredEntities.find(e => e.id === entityId);
      const colors = ENTITY_COLORS[entityType] || { bg: 'bg-gray-700/30', text: 'text-gray-300', border: 'border-gray-500' };
      const isHighlighted = highlightedEntityId === entityId;

      return (
        <span
          key={idx}
          className={`inline-block px-0.5 rounded cursor-pointer border-b-2 transition-all ${colors.bg} ${colors.text} ${
            isHighlighted ? `${colors.border} ring-1 ring-yellow-400` : 'border-transparent'
          }`}
          onClick={() => entity && onEntityClick?.(entity)}
          onMouseEnter={() => entity && onEntityHover?.(entity)}
          onMouseLeave={() => onEntityHover?.(null)}
          title={`${entityType}: ${entityText} (${((entity?.confidence || 0) * 100).toFixed(0)}% confidence)`}
        >
          {entityText}
        </span>
      );
    });
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">📄</span>
            <span className="text-sm font-medium text-white truncate">
              {documentName}
            </span>
            <span className="text-xs text-gray-500">
              {entities.length} entities
            </span>
            <span className="text-xs text-gray-600" title={documentId}>
              ID: {documentId.substring(0, 8)}
            </span>
          </div>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showOverlay
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300'
            }`}
          >
            {showOverlay ? 'Hide' : 'Show'} Entities
          </button>
        </div>
      </div>

      {/* Entity Type Filter Bar */}
      {showOverlay && entities.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-1.5 bg-gray-800/50 border-b border-gray-700">
          <button
            onClick={() => setActiveFilter(null)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              !activeFilter
                ? 'border-white text-white bg-gray-700'
                : 'border-gray-600 text-gray-500'
            }`}
          >
            All ({entities.length})
          </button>
          {Object.entries(entityCounts).map(([type, count]) => {
            const colors = ENTITY_COLORS[type];
            const icon = ENTITY_ICONS[type] || '•';
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(activeFilter === type ? null : type)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  activeFilter === type
                    ? `${colors?.border || 'border-gray-500'} ${colors?.text || 'text-gray-300'} bg-gray-700`
                    : 'border-gray-600 text-gray-500'
                }`}
              >
                {icon} {type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
        {documentText ? (
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
            {showOverlay && filteredEntities.length > 0
              ? renderHighlightedText()
              : documentText
            }
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No document text available
          </div>
        )}
      </div>

      {/* Entity Summary Footer */}
      {showOverlay && filteredEntities.length > 0 && (
        <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {Object.entries(entityCounts).slice(0, 4).map(([type, count]) => (
              <span key={type} className="flex items-center gap-1">
                <span>{ENTITY_ICONS[type] || '•'}</span>
                {count} {type}s
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
