// ============================================
// Court Access — Case Timeline Visualization
// Phase 117: Evidence Graph + Visualization System
// Interactive timeline with zoom, clustering, event filtering
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
  sourceDocumentId?: string;
  confidence: number;
  displayTime?: string;
}

interface CaseTimelineProps {
  events: TimelineEvent[];
  onEventSelect?: (event: TimelineEvent | null) => void;
  onEventHover?: (event: TimelineEvent | null) => void;
  selectedEventId?: string | null;
  filterTypes?: string[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Event Type Colors
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, string> = {
  arrest: '#EF4444',
  filing: '#8B5CF6',
  hearing: '#3B82F6',
  testimony: '#22C55E',
  evidence: '#F97316',
  incident: '#EC4899',
  rights_advisory: '#06B6D4',
  search: '#EAB308',
};

const EVENT_ICONS: Record<string, string> = {
  arrest: '🚔',
  filing: '📋',
  hearing: '⚖️',
  testimony: '🗣️',
  evidence: '🔍',
  incident: '⚡',
  rights_advisory: '📜',
  search: '🔎',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CaseTimeline({
  events,
  onEventSelect,
  onEventHover,
  selectedEventId,
  filterTypes,
  className = '',
}: CaseTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<'minute' | 'hour' | 'day' | 'month'>('day');

  // Filter events
  const filteredEvents = filterTypes && filterTypes.length > 0
    ? events.filter(e => filterTypes.includes(e.eventType))
    : events;

  // Sort chronologically
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group events by date for clustering (used for future cluster view)
  groupEventsByDate(sortedEvents, zoomLevel);

  const handleZoomIn = useCallback(() => {
    const levels: Array<'minute' | 'hour' | 'day' | 'month'> = ['month', 'day', 'hour', 'minute'];
    const currentIdx = levels.indexOf(zoomLevel);
    if (currentIdx < levels.length - 1) {
      setZoomLevel(levels[currentIdx + 1]);
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    const levels: Array<'minute' | 'hour' | 'day' | 'month'> = ['month', 'day', 'hour', 'minute'];
    const currentIdx = levels.indexOf(zoomLevel);
    if (currentIdx > 0) {
      setZoomLevel(levels[currentIdx - 1]);
    }
  }, [zoomLevel]);

  // Scroll to selected event
  useEffect(() => {
    if (!selectedEventId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-event-id="${selectedEventId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedEventId]);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Timeline</span>
          <span className="text-xs text-gray-500">
            {sortedEvents.length} events
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-xs border border-gray-600"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-xs text-gray-400 px-1 min-w-[40px] text-center">
            {zoomLevel}
          </span>
          <button
            onClick={handleZoomIn}
            className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-xs border border-gray-600"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2"
        style={{ maxHeight: '400px' }}
      >
        {sortedEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No timeline events available
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

            {sortedEvents.map((event) => {
              const isSelected = event.id === selectedEventId;
              const color = EVENT_COLORS[event.eventType] || '#6B7280';
              const icon = EVENT_ICONS[event.eventType] || '•';

              return (
                <div
                  key={event.id}
                  data-event-id={event.id}
                  className={`relative pl-10 pb-4 cursor-pointer transition-all ${
                    isSelected ? 'bg-gray-800/50 -mx-3 px-[52px] rounded' : ''
                  }`}
                  onClick={() => onEventSelect?.(isSelected ? null : event)}
                  onMouseEnter={() => onEventHover?.(event)}
                  onMouseLeave={() => onEventHover?.(null)}
                >
                  {/* Dot on timeline */}
                  <div
                    className={`absolute left-2.5 w-3.5 h-3.5 rounded-full border-2 transition-transform ${
                      isSelected ? 'scale-125' : ''
                    }`}
                    style={{
                      backgroundColor: color,
                      borderColor: isSelected ? '#FBBF24' : '#1F2937',
                      top: '2px',
                    }}
                  />

                  {/* Event content */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: color + '20', color }}
                        >
                          {event.eventType}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(event.timestamp, zoomLevel)}
                        </span>
                        {event.confidence < 0.8 && (
                          <span className="text-xs text-yellow-500" title={`Confidence: ${(event.confidence * 100).toFixed(0)}%`}>
                            ⚠
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 mt-0.5 truncate">
                        {event.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(timestamp: string, zoom: string): string {
  try {
    const date = new Date(timestamp);
    switch (zoom) {
      case 'minute':
        return date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
      case 'hour':
        return date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit',
        });
      case 'day':
        return date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
      case 'month':
        return date.toLocaleString('en-US', {
          month: 'long', year: 'numeric',
        });
      default:
        return date.toLocaleDateString();
    }
  } catch {
    return String(timestamp);
  }
}

function groupEventsByDate(
  events: TimelineEvent[],
  zoom: string
): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const key = getGroupKey(event.timestamp, zoom);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }

  return groups;
}

function getGroupKey(timestamp: string, zoom: string): string {
  try {
    const date = new Date(timestamp);
    switch (zoom) {
      case 'minute':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth()}`;
      default:
        return timestamp;
    }
  } catch {
    return timestamp;
  }
}
