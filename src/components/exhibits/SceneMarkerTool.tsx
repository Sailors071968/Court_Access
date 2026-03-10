// ============================================================================
// Phase 59 — Evidence Marker System
// Allows attorneys to place markers on the 3D scene: officer location,
// suspect location, vehicle location, evidence location.
// Marker types: pin, number, evidence icon.
// ============================================================================

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneMarker {
  id: string;
  type: 'pin' | 'number' | 'evidence';
  label: string;
  position: [number, number, number];
  color: string;
  number?: number;
}

export type MarkerPreset = {
  id: string;
  label: string;
  type: 'pin' | 'number' | 'evidence';
  color: string;
  icon: string;
};

interface SceneMarkerToolProps {
  markers: SceneMarker[];
  onAddMarker: (marker: Omit<SceneMarker, 'id'>) => void;
  onRemoveMarker: (id: string) => void;
  onUpdateMarker: (id: string, updates: Partial<SceneMarker>) => void;
  onClearAll: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Preset Markers
// ---------------------------------------------------------------------------

const MARKER_PRESETS: MarkerPreset[] = [
  { id: 'officer', label: 'Officer Location', type: 'pin', color: '#1a1a6c', icon: 'badge' },
  { id: 'suspect', label: 'Suspect Location', type: 'pin', color: '#cc3333', icon: 'person' },
  { id: 'vehicle', label: 'Vehicle Location', type: 'pin', color: '#336633', icon: 'car' },
  { id: 'evidence', label: 'Evidence Location', type: 'evidence', color: '#cc8800', icon: 'search' },
  { id: 'witness', label: 'Witness Location', type: 'pin', color: '#6633cc', icon: 'eye' },
  { id: 'camera', label: 'Camera / Bodycam', type: 'pin', color: '#333333', icon: 'camera' },
];

const MARKER_COLORS = [
  { value: '#cc3333', label: 'Red' },
  { value: '#3333cc', label: 'Blue' },
  { value: '#33cc33', label: 'Green' },
  { value: '#cc8800', label: 'Orange' },
  { value: '#6633cc', label: 'Purple' },
  { value: '#333333', label: 'Black' },
  { value: '#1a1a6c', label: 'Navy' },
  { value: '#cc33cc', label: 'Pink' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SceneMarkerTool({
  markers,
  onAddMarker,
  onRemoveMarker,
  onUpdateMarker,
  onClearAll,
  className = '',
}: SceneMarkerToolProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState('#cc3333');
  const [customType, setCustomType] = useState<'pin' | 'number' | 'evidence'>('pin');
  const [placementMode, setPlacementMode] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handlePresetClick = (preset: MarkerPreset) => {
    // Place marker at a default position (center of scene, slightly offset per marker count)
    const offset = markers.length * 5;
    onAddMarker({
      type: preset.type,
      label: preset.label,
      position: [offset - 15, 0, offset - 15],
      color: preset.color,
      number: preset.type === 'number' ? markers.length + 1 : undefined,
    });
  };

  const handleCustomAdd = () => {
    if (!customLabel.trim()) return;
    const offset = markers.length * 5;
    onAddMarker({
      type: customType,
      label: customLabel.trim(),
      position: [offset - 15, 0, offset - 15],
      color: customColor,
      number: customType === 'number' ? markers.length + 1 : undefined,
    });
    setCustomLabel('');
  };

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Evidence Markers ({markers.length})
        </h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Quick Add Presets */}
          <div className="pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Add</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MARKER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: preset.color }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Marker */}
          <div className="border-t border-gray-700 pt-3 mt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Custom Marker</p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Marker label..."
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
              />
              <div className="flex gap-2">
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as 'pin' | 'number' | 'evidence')}
                  className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="pin">Pin Marker</option>
                  <option value="number">Number Marker</option>
                  <option value="evidence">Evidence Icon</option>
                </select>
                <div className="flex gap-1">
                  {MARKER_COLORS.slice(0, 4).map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCustomColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        customColor === c.value ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleCustomAdd}
                disabled={!customLabel.trim()}
                className="w-full py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
              >
                Add Marker
              </button>
            </div>
          </div>

          {/* Placed Markers List */}
          {markers.length > 0 && (
            <div className="border-t border-gray-700 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Placed Markers</p>
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {markers.map((marker, idx) => (
                  <div
                    key={marker.id}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-750 rounded group hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: marker.color }}
                      />
                      <span className="text-xs text-gray-300">
                        {marker.number != null && <span className="text-gray-500 mr-1">#{marker.number}</span>}
                        {marker.label}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveMarker(marker.id)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
