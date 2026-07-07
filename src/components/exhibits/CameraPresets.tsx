// ============================================================================
// Phase 60 — Camera View Presets
// Preset camera angles for courtroom exhibit viewing.
// Officers perspective, bird's eye, street level, vehicle viewpoint.
// Users can also save custom camera views.
// ============================================================================

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface SavedCameraView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  createdAt: string;
}

interface CameraPresetsProps {
  onSelectPreset: (preset: CameraPreset) => void;
  onSaveView?: (name: string) => void;
  savedViews: SavedCameraView[];
  onLoadView?: (view: SavedCameraView) => void;
  onDeleteView?: (id: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Built-in Presets
// ---------------------------------------------------------------------------

const BUILT_IN_PRESETS: CameraPreset[] = [
  {
    name: "Bird's Eye View",
    position: [0, 250, 0.1],
    target: [0, 0, 0],
  },
  {
    name: 'Officer Perspective',
    position: [10, 1.7, 10],
    target: [0, 1.7, 0],
  },
  {
    name: 'Street Level',
    position: [50, 2, 0],
    target: [0, 2, 0],
  },
  {
    name: 'Vehicle Viewpoint',
    position: [20, 1.2, 15],
    target: [0, 1.2, 0],
  },
  {
    name: 'North Facing',
    position: [0, 80, 120],
    target: [0, 0, 0],
  },
  {
    name: 'South Facing',
    position: [0, 80, -120],
    target: [0, 0, 0],
  },
  {
    name: 'East Facing',
    position: [120, 80, 0],
    target: [0, 0, 0],
  },
  {
    name: 'West Facing',
    position: [-120, 80, 0],
    target: [0, 0, 0],
  },
  {
    name: 'Aerial Angle',
    position: [80, 120, 80],
    target: [0, 0, 0],
  },
  {
    name: 'Close-Up',
    position: [15, 10, 15],
    target: [0, 0, 0],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CameraPresets({
  onSelectPreset,
  onSaveView,
  savedViews,
  onLoadView,
  onDeleteView,
  className = '',
}: CameraPresetsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    if (!saveName.trim() || !onSaveView) return;
    onSaveView(saveName.trim());
    setSaveName('');
    setShowSaveInput(false);
  };

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Camera Views
        </h3>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Built-in Presets */}
          <div className="pt-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Preset Views</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BUILT_IN_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => onSelectPreset(preset)}
                  className="py-1.5 px-2 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors text-left"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Save Current View */}
          {onSaveView && (
            <div className="border-t border-gray-700 pt-3 mt-3">
              {showSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="View name..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gold-light"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="w-full py-1.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                >
                  Save Current View
                </button>
              )}
            </div>
          )}

          {/* Saved Views */}
          {savedViews.length > 0 && (
            <div className="border-t border-gray-700 pt-3 mt-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Saved Views</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-750 rounded group hover:bg-gray-700"
                  >
                    <button
                      onClick={() => onLoadView?.(view)}
                      className="text-xs text-gray-300 hover:text-white flex-1 text-left"
                    >
                      {view.name}
                    </button>
                    {onDeleteView && (
                      <button
                        onClick={() => onDeleteView(view.id)}
                        className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
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
