// ============================================================================
// Phase 61 — Animation Tools
// Timeline-based animation system for scene reenactments.
// Supports vehicle movement, suspect movement, officer movement.
// ============================================================================

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnimationKeyframe {
  id: string;
  markerId: string;
  time: number; // seconds from start
  position: [number, number, number];
  rotation?: number;
  label?: string;
}

export interface AnimationTimeline {
  id: string;
  name: string;
  duration: number; // total seconds
  keyframes: AnimationKeyframe[];
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
}

interface AnimationToolsProps {
  timeline: AnimationTimeline;
  markerLabels: Record<string, string>; // markerId -> label
  onUpdateTimeline: (timeline: AnimationTimeline) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onAddKeyframe: (keyframe: Omit<AnimationKeyframe, 'id'>) => void;
  onRemoveKeyframe: (id: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateId(): string {
  return `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimationTools({
  timeline,
  markerLabels,
  onUpdateTimeline,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onAddKeyframe,
  onRemoveKeyframe,
  className = '',
}: AnimationToolsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string>('');

  const handleSpeedChange = (speed: number) => {
    onUpdateTimeline({ ...timeline, playbackSpeed: speed });
  };

  const handleDurationChange = (duration: number) => {
    onUpdateTimeline({ ...timeline, duration: Math.max(1, duration) });
  };

  const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
  const markerIds = Object.keys(markerLabels);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Animation Timeline
        </h3>
        <div className="flex items-center gap-2">
          {timeline.isPlaying && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Transport Controls */}
          <div className="pt-3">
            <div className="flex items-center justify-center gap-3 mb-3">
              <button
                onClick={onStop}
                className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                title="Stop"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>
              {timeline.isPlaying ? (
                <button
                  onClick={onPause}
                  className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  title="Pause"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" />
                    <rect x="14" y="5" width="4" height="14" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={onPlay}
                  className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  title="Play"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="8,5 19,12 8,19" />
                  </svg>
                </button>
              )}
            </div>

            {/* Timeline Scrubber */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{formatTime(timeline.currentTime)}</span>
                <span>{formatTime(timeline.duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={timeline.duration}
                step={0.1}
                value={timeline.currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              {/* Keyframe markers on timeline */}
              <div className="relative h-3 mt-1">
                {sortedKeyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full transform -translate-x-1"
                    style={{ left: `${(kf.time / timeline.duration) * 100}%` }}
                    title={`${markerLabels[kf.markerId] ?? 'Marker'} @ ${formatTime(kf.time)}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Speed Control */}
          <div className="border-t border-gray-700 pt-3 mt-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Playback Speed</p>
            <div className="flex gap-1">
              {[0.25, 0.5, 1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`flex-1 py-1 text-xs rounded transition-colors ${
                    timeline.playbackSpeed === speed
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Duration Setting */}
          <div className="border-t border-gray-700 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Duration (sec)</p>
              <input
                type="number"
                min={1}
                max={300}
                value={timeline.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10))}
                className="w-16 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Keyframes List */}
          <div className="border-t border-gray-700 pt-3 mt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Keyframes ({sortedKeyframes.length})
            </p>
            {sortedKeyframes.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No keyframes yet. Add markers and set keyframes to create animations.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {sortedKeyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className="flex items-center justify-between py-1 px-2 bg-gray-750 rounded text-xs group hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{formatTime(kf.time)}</span>
                      <span className="text-gray-300">{markerLabels[kf.markerId] ?? 'Marker'}</span>
                      {kf.label && <span className="text-gray-500">({kf.label})</span>}
                    </div>
                    <button
                      onClick={() => onRemoveKeyframe(kf.id)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation Interpolation Engine
// ---------------------------------------------------------------------------

/**
 * Interpolate marker positions at a given time based on keyframes.
 * Returns a map of markerId -> interpolated position.
 */
export function interpolatePositions(
  keyframes: AnimationKeyframe[],
  currentTime: number,
): Map<string, [number, number, number]> {
  const result = new Map<string, [number, number, number]>();

  // Group keyframes by markerId
  const grouped = new Map<string, AnimationKeyframe[]>();
  for (const kf of keyframes) {
    const existing = grouped.get(kf.markerId) ?? [];
    existing.push(kf);
    grouped.set(kf.markerId, existing);
  }

  // For each marker, interpolate between keyframes
  for (const [markerId, markerKfs] of grouped) {
    const sorted = [...markerKfs].sort((a, b) => a.time - b.time);

    if (sorted.length === 0) continue;

    // Before first keyframe
    if (currentTime <= sorted[0].time) {
      result.set(markerId, sorted[0].position);
      continue;
    }

    // After last keyframe
    if (currentTime >= sorted[sorted.length - 1].time) {
      result.set(markerId, sorted[sorted.length - 1].position);
      continue;
    }

    // Find surrounding keyframes
    for (let i = 0; i < sorted.length - 1; i++) {
      const prev = sorted[i];
      const next = sorted[i + 1];

      if (currentTime >= prev.time && currentTime <= next.time) {
        const t = (currentTime - prev.time) / (next.time - prev.time);
        // Linear interpolation
        const position: [number, number, number] = [
          prev.position[0] + (next.position[0] - prev.position[0]) * t,
          prev.position[1] + (next.position[1] - prev.position[1]) * t,
          prev.position[2] + (next.position[2] - prev.position[2]) * t,
        ];
        result.set(markerId, position);
        break;
      }
    }
  }

  return result;
}
