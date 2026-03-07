// ============================================
// Court Access — Graph Filter Toolbar
// Phase 117: Evidence Graph + Visualization System
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
}

export default function GraphFilterToolbar({
  activeNodeTypes,
  activeRelTypes,
  onNodeTypesChange,
  onRelTypesChange,
  onSearchChange,
  searchQuery,
}: GraphFilterToolbarProps) {
  const [showRelFilters, setShowRelFilters] = useState(false);

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
    </div>
  );
}
