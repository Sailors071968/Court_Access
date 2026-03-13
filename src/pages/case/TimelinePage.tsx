// ============================================================================
// Timeline Reconstruction Engine — Interactive Timeline Viewer
// Route: /cases/:caseId/timeline
// Features: vertical timeline axis, event filters, source evidence links,
//           contradiction highlights, stacked evidence layers
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchTimeline,
  fetchTimelineConflicts,
  rebuildTimeline,
  type ApiTimelineEvent,
  type ApiCaseTimeline,
  type ApiTimelineConflict,
} from '../../services/caseApi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<string, string> = {
  officer_arrival: 'Officer Arrival',
  gunshot: 'Gunshot',
  vehicle_stop: 'Vehicle Stop',
  foot_pursuit: 'Foot Pursuit',
  taser_deployment: 'Taser Deployment',
  use_of_force: 'Use of Force',
  '911_call': '911 Call',
  dispatch: 'Dispatch',
  witness_observation: 'Witness Observation',
  arrest: 'Arrest',
  miranda: 'Miranda Rights',
  search: 'Search',
  seizure: 'Seizure',
  medical: 'Medical',
  statement: 'Statement',
  person_detected: 'Person Detected',
  vehicle_detected: 'Vehicle Detected',
  audio_spike: 'Audio Spike',
  scene_change: 'Scene Change',
  light_activation: 'Emergency Lights',
  door_open: 'Door Open',
  exit_vehicle: 'Exit Vehicle',
  handcuff: 'Handcuff',
  weapon_drawn: 'Weapon Drawn',
  other: 'Other',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  police_report: 'Police Report',
  witness_statement: 'Witness Statement',
  bodycam: 'Body Camera',
  dashcam: 'Dashcam',
  surveillance: 'Surveillance',
  cad_log: 'CAD Log',
  transcript: 'Transcript',
  '911_call': '911 Call',
  investigator_report: 'Investigator Report',
  correlated: 'Correlated',
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  police_report: 'bg-blue-100 text-blue-800 border-blue-200',
  witness_statement: 'bg-purple-100 text-purple-800 border-purple-200',
  bodycam: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  dashcam: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  surveillance: 'bg-teal-100 text-teal-800 border-teal-200',
  cad_log: 'bg-amber-100 text-amber-800 border-amber-200',
  transcript: 'bg-gray-100 text-gray-800 border-gray-200',
  '911_call': 'bg-red-100 text-red-800 border-red-200',
  investigator_report: 'bg-green-100 text-green-800 border-green-200',
  correlated: 'bg-orange-100 text-orange-800 border-orange-200',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  officer_arrival: '\u{1F46E}',
  gunshot: '\u{1F4A5}',
  vehicle_stop: '\u{1F697}',
  foot_pursuit: '\u{1F3C3}',
  taser_deployment: '\u26A1',
  use_of_force: '\u26A0\uFE0F',
  '911_call': '\u{1F4DE}',
  dispatch: '\u{1F4E1}',
  witness_observation: '\u{1F441}\uFE0F',
  arrest: '\u{1F6A8}',
  miranda: '\u2696\uFE0F',
  search: '\u{1F50D}',
  seizure: '\u{1F4E6}',
  medical: '\u{1F691}',
  statement: '\u{1F4DD}',
  other: '\u{1F4CC}',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-amber-600';
  return 'text-red-500';
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimelineStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    building: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function EventCard({
  event,
  isConflict,
}: {
  event: ApiTimelineEvent;
  isConflict: boolean;
}) {
  const icon = EVENT_TYPE_ICONS[event.eventType] ?? EVENT_TYPE_ICONS.other;
  const sourceColor = SOURCE_TYPE_COLORS[event.sourceType] ?? 'bg-gray-100 text-gray-800 border-gray-200';
  const confidenceColor = getConfidenceColor(event.confidence);

  return (
    <div
      className={`relative pl-8 pb-6 ${isConflict ? 'border-l-2 border-red-400' : 'border-l-2 border-gray-200'}`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 ${
          isConflict
            ? 'bg-red-500 border-red-300'
            : 'bg-white border-blue-500'
        }`}
      />

      <div
        className={`ml-4 p-4 rounded-lg border ${
          isConflict ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
        } shadow-sm hover:shadow-md transition-shadow`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" role="img" aria-label={event.eventType}>
              {icon}
            </span>
            <span className="font-semibold text-gray-900">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </span>
            {isConflict && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">
                CONFLICT
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-gray-600">{formatTime(event.timestamp)}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 mb-2">{event.description}</p>

        {/* Metadata row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${sourceColor}`}>
            {SOURCE_TYPE_LABELS[event.sourceType] ?? event.sourceType}
          </span>
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {(event.confidence * 100).toFixed(0)}% confidence
          </span>
          {event.correlationGroup && (
            <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs">
              Correlated
            </span>
          )}
        </div>

        {/* Raw text excerpt */}
        {event.rawText && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500 italic truncate">
            &ldquo;{event.rawText}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: ApiTimelineConflict }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-600 font-bold text-sm">
          {conflict.conflictType.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{conflict.description}</p>
      <div className="grid grid-cols-2 gap-3">
        {conflict.eventA && (
          <div className="p-2 bg-white rounded border border-red-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Source A</div>
            <div className="text-sm font-medium">{EVENT_TYPE_LABELS[conflict.eventA.eventType] ?? conflict.eventA.eventType}</div>
            <div className="text-xs text-gray-500">{SOURCE_TYPE_LABELS[conflict.eventA.sourceType] ?? conflict.eventA.sourceType}</div>
            <div className="text-xs font-mono mt-1">{formatTime(conflict.eventA.timestamp)}</div>
          </div>
        )}
        {conflict.eventB && (
          <div className="p-2 bg-white rounded border border-red-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Source B</div>
            <div className="text-sm font-medium">{EVENT_TYPE_LABELS[conflict.eventB.eventType] ?? conflict.eventB.eventType}</div>
            <div className="text-xs text-gray-500">{SOURCE_TYPE_LABELS[conflict.eventB.sourceType] ?? conflict.eventB.sourceType}</div>
            <div className="text-xs font-mono mt-1">{formatTime(conflict.eventB.timestamp)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">{'\u{1F4C5}'}</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Timeline Events Yet</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Upload evidence (police reports, bodycam video, witness statements, CAD logs) to this case.
        The Timeline Reconstruction Engine will automatically extract events and build a chronological timeline.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();

  const [timeline, setTimeline] = useState<ApiCaseTimeline | null>(null);
  const [events, setEvents] = useState<ApiTimelineEvent[]>([]);
  const [conflicts, setConflicts] = useState<ApiTimelineConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  // Filters
  const [filterSourceType, setFilterSourceType] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterMinConfidence, setFilterMinConfidence] = useState<number>(0);
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  // Conflict event IDs for highlighting
  const [conflictEventIds, setConflictEventIds] = useState<Set<string>>(new Set());

  const loadTimeline = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [timelineData, conflictData] = await Promise.all([
        fetchTimeline(caseId),
        fetchTimelineConflicts(caseId),
      ]);
      setTimeline(timelineData.timeline);
      setEvents(timelineData.events);
      setConflicts(conflictData.conflicts);

      // Build conflict event ID set
      const ids = new Set<string>();
      for (const c of conflictData.conflicts) {
        if (c.eventA) ids.add(c.eventA.eventId);
        if (c.eventB) ids.add(c.eventB.eventId);
      }
      setConflictEventIds(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleRebuild = async () => {
    if (!caseId) return;
    setRebuilding(true);
    try {
      await rebuildTimeline(caseId);
      // Reload after a brief delay to let the worker process
      setTimeout(() => {
        loadTimeline();
        setRebuilding(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rebuild timeline');
      setRebuilding(false);
    }
  };

  // Apply filters
  const filteredEvents = events.filter((e) => {
    if (filterSourceType && e.sourceType !== filterSourceType) return false;
    if (filterEventType && e.eventType !== filterEventType) return false;
    if (e.confidence < filterMinConfidence) return false;
    if (showConflictsOnly && !conflictEventIds.has(e.eventId)) return false;
    return true;
  });

  // Group events by date for the timeline axis
  const eventsByDate = new Map<string, ApiTimelineEvent[]>();
  for (const event of filteredEvents) {
    const dateKey = formatDate(event.timestamp);
    const group = eventsByDate.get(dateKey) ?? [];
    group.push(event);
    eventsByDate.set(dateKey, group);
  }

  // Unique source types and event types for filter dropdowns
  const uniqueSourceTypes = [...new Set(events.map((e) => e.sourceType))].sort();
  const uniqueEventTypes = [...new Set(events.map((e) => e.eventType))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <strong>Error:</strong> {error}
        <button
          onClick={loadTimeline}
          className="ml-4 text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Case Timeline</h2>
          <p className="text-sm text-gray-500 mt-1">
            AI-reconstructed chronological timeline from all evidence sources
          </p>
        </div>
        <div className="flex items-center gap-3">
          {timeline && <TimelineStatusBadge status={timeline.status} />}
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {rebuilding ? 'Rebuilding...' : 'Rebuild Timeline'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {timeline && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{timeline.eventCount}</div>
            <div className="text-xs text-gray-500 mt-1">Total Events</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{uniqueSourceTypes.length}</div>
            <div className="text-xs text-gray-500 mt-1">Evidence Sources</div>
          </div>
          <div className={`p-4 rounded-lg border shadow-sm ${timeline.conflictCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <div className={`text-2xl font-bold ${timeline.conflictCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {timeline.conflictCount}
            </div>
            <div className="text-xs text-gray-500 mt-1">Conflicts Detected</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">
              {timeline.builtAt ? formatDate(timeline.builtAt) : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Last Built</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-700">Filters:</span>

          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All Sources</option>
            {uniqueSourceTypes.map((st) => (
              <option key={st} value={st}>
                {SOURCE_TYPE_LABELS[st] ?? st}
              </option>
            ))}
          </select>

          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All Event Types</option>
            {uniqueEventTypes.map((et) => (
              <option key={et} value={et}>
                {EVENT_TYPE_LABELS[et] ?? et}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Min Confidence:</label>
            <input
              type="range"
              min={0}
              max={100}
              value={filterMinConfidence * 100}
              onChange={(e) => setFilterMinConfidence(parseInt(e.target.value, 10) / 100)}
              className="w-24"
            />
            <span className="text-xs font-mono text-gray-500 w-8">{(filterMinConfidence * 100).toFixed(0)}%</span>
          </div>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showConflictsOnly}
              onChange={(e) => setShowConflictsOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Conflicts only
          </label>

          <span className="ml-auto text-xs text-gray-400">
            {filteredEvents.length} of {events.length} events
          </span>
        </div>
      )}

      {/* Conflicts Panel */}
      {conflicts.length > 0 && !showConflictsOnly && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
            Timeline Conflicts ({conflicts.length})
          </h3>
          <div className="space-y-2">
            {conflicts.map((conflict, i) => (
              <ConflictCard key={i} conflict={conflict} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <EmptyTimeline />
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No events match the current filters. Try adjusting your filters.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(eventsByDate.entries()).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                  {dateLabel}
                </h3>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{dateEvents.length} events</span>
              </div>

              {/* Event cards */}
              <div className="ml-1.5">
                {dateEvents.map((event) => (
                  <EventCard
                    key={event.eventId}
                    event={event}
                    isConflict={conflictEventIds.has(event.eventId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidence Source Legend */}
      {events.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Evidence Source Legend</h4>
          <div className="flex flex-wrap gap-2">
            {uniqueSourceTypes.map((st) => (
              <span
                key={st}
                className={`px-2 py-1 rounded text-xs font-medium border ${SOURCE_TYPE_COLORS[st] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}
              >
                {SOURCE_TYPE_LABELS[st] ?? st}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
