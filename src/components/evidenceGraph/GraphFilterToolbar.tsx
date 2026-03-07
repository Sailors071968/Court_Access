// ============================================
// Court Access — Graph Filter Toolbar
// Phase 117 + 118: Evidence Graph + Graph Intelligence v2
//
// Phase 118 additions:
// - Date range filter
// - Confidence score filter
// - Entity breadcrumbs
// ============================================

import { useState } from 'react';

const NODE_TYPES = [
  { id: 'Person', label: 'Person', icon: '👤', color: '#3B82F6' },
  { id: 'Event', label: 'Event', icon: '📅', color: '#F97316' },
  { id: 'Document', label: 'Document', icon: '📄', color: '#8B5CF6' },
  { id: 'Statement', label: 'Statement', icon: '💬', color: '#22C55E' },
  { id: 'Evidence', label: 'Evidence', icon: '🔍', color: '#EF4444' },
  { id: 'Location', label: 'Location', icon: '📍', color: '#EAB308' },
  { id: 'Organization', label: 'Organization', icon: '🏢', color: '#06B6D4' },
];

const RELATIONSHIP_TYPES = [
  'PARTICIPATED_IN',
  'MENTIONED_IN',
  'REFERENCED_BY',
  'TESTIFIED_ABOUT',
  'COLLECTED_BY',
  'OCCURRED_AT',
  'RELATED_TO',
  'CONTRADICTS',
];

interface GraphFilterToolbarProps {
  activeNodeTypes: string[];
  activeRelTypes: string[];
  onNodeTypesChange: (types: string[]) => void;
  onRelTypesChange: (types: string[]) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  // Phase 118: Extended filters
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  confidenceThreshold?: number;
  onConfidenceChange?: (threshold: number) => void;
  breadcrumbs?: Array<{ id: string; label: string }>;
  onBreadcrumbClick?: (id: string) => void;
}

export default function GraphFilterToolbar({
  activeNodeTypes,
  activeRelTypes,
  onNodeTypesChange,
  onRelTypesChange,
  onSearchChange,
  searchQuery,
  dateRange,
  onDateRangeChange,
  confidenceThreshold,
  onConfidenceChange,
  breadcrumbs,
  onBreadcrumbClick,
}: GraphFilterToolbarProps) {
  const [showRelFilters, setShowRelFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleNodeType = (type: string) => {
    if (activeNodeTypes.includes(type)) {
      onNodeTypesChange(activeNodeTypes.filter(t => t !== type));
    } else {
      onNodeTypesChange([...activeNodeTypes, type]);
    }
  };

  const toggleRelType = (type: string) => {
    if (activeRelTypes.includes(type)) {
      onRelTypesChange(activeRelTypes.filter(t => t !== type));
    } else {
      onRelTypesChange([...activeRelTypes, type]);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
      {/* Search */}
      <div className="flex items-center gap-3 mb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search entities..."
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => setShowRelFilters(!showRelFilters)}
          className={`text-xs px-2 py-1.5 rounded border ${
            showRelFilters
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Relationships
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`text-xs px-2 py-1.5 rounded border ${
            showAdvanced
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Node Type Filters */}
      <div className="flex flex-wrap gap-1.5">
        {NODE_TYPES.map(nt => {
          const isActive = activeNodeTypes.length === 0 || activeNodeTypes.includes(nt.id);
          return (
            <button
              key={nt.id}
              onClick={() => toggleNodeType(nt.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                isActive
                  ? 'border-current text-white'
                  : 'border-gray-600 text-gray-500 opacity-50'
              }`}
              style={{ borderColor: isActive ? nt.color : undefined }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isActive ? nt.color : '#6B7280' }}
              />
              {nt.icon} {nt.label}
            </button>
          );
        })}
      </div>

      {/* Relationship Type Filters */}
      {showRelFilters && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-700">
          {RELATIONSHIP_TYPES.map(rt => {
            const isActive = activeRelTypes.length === 0 || activeRelTypes.includes(rt);
            return (
              <button
                key={rt}
                onClick={() => toggleRelType(rt)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  isActive
                    ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20'
                    : 'border-gray-600 text-gray-500 bg-gray-800'
                }`}
              >
                {rt.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}

      {/* Phase 118: Advanced Filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-700">
          {/* Date Range */}
          {onDateRangeChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Date:</span>
              <input
                type="date"
                value={dateRange?.start || ''}
                onChange={(e) => onDateRangeChange({ start: e.target.value, end: dateRange?.end || '' })}
                className="bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={dateRange?.end || ''}
                onChange={(e) => onDateRangeChange({ start: dateRange?.start || '', end: e.target.value })}
                className="bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white"
              />
            </div>
          )}

          {/* Confidence Threshold */}
          {onConfidenceChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Min confidence:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={(confidenceThreshold || 0) * 100}
                onChange={(e) => onConfidenceChange(parseInt(e.target.value, 10) / 100)}
                className="w-20 h-1 accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-8">{Math.round((confidenceThreshold || 0) * 100)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Phase 118: Entity Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700 overflow-x-auto">
          <span className="text-xs text-gray-500 shrink-0">Path:</span>
          {breadcrumbs.map((bc, idx) => (
            <span key={bc.id} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <span className="text-gray-600 text-xs">&rarr;</span>}
              <button
                onClick={() => onBreadcrumbClick?.(bc.id)}
                className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-24"
              >
                {bc.label}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
