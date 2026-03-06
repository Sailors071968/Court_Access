// ============================================
// Court Access — Phase A: Evidence Timeline Page
// Chronological event display with filtering.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Filter, Plus, Trash2, Calendar, FileText, Mic, Video, Image, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { apiFetch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string;
  sourceEvidenceId: string | null;
  sourceType: string;
  eventType: string;
  eventDescription: string;
  confidenceScore: number;
  metadata: Record<string, string>;
  createdAt: string;
}

const SOURCE_TYPE_ICONS: Record<string, typeof FileText> = {
  document_date: FileText,
  document_content: FileText,
  audio_transcript: Mic,
  video_transcript: Video,
  video_frame: Video,
  image_exif: Image,
  manual: Calendar,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  document_date: 'Document',
  document_content: 'Document',
  audio_transcript: 'Audio',
  video_transcript: 'Video',
  video_frame: 'Video Frame',
  image_exif: 'Image EXIF',
  manual: 'Manual Entry',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  filing: 'bg-amber-100 text-amber-700',
  incident: 'bg-red-100 text-red-700',
  testimony: 'bg-green-100 text-green-700',
  evidence_collected: 'bg-slate-100 text-slate-700',
  court_action: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-600',
};

// ---------------------------------------------------------------------------
// Add Event Form
// ---------------------------------------------------------------------------

function AddEventForm({
  caseId,
  onCreated,
  onCancel,
}: {
  caseId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [timestamp, setTimestamp] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('other');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!timestamp || !description) return;
    setSaving(true);
    try {
      await apiFetch(`/api/timeline/${caseId}`, {
        method: 'POST',
        body: JSON.stringify({
          timestamp: new Date(timestamp).toISOString(),
          eventDescription: description,
          eventType,
          sourceType: 'manual',
        }),
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Timeline Event</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time *</label>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.keys(EVENT_TYPE_COLORS).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe the event..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !timestamp || !description}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Add Event'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeline Event Card
// ---------------------------------------------------------------------------

function TimelineEventCard({
  event,
  onDelete,
}: {
  event: TimelineEvent;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SOURCE_TYPE_ICONS[event.sourceType] || Calendar;
  const typeColor = EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.other;
  const date = new Date(event.timestamp);

  return (
    <div className="flex gap-4 group">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm mt-1.5" />
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
      </div>

      {/* Event content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-xs text-gray-400">
                {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <p className="text-sm text-gray-900 leading-relaxed">{event.eventDescription}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                {event.eventType.replace(/_/g, ' ')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Icon size={10} />
                {SOURCE_TYPE_LABELS[event.sourceType] || event.sourceType}
              </span>
              {event.confidenceScore < 1.0 && (
                <span className="text-xs text-gray-400">
                  ({Math.round(event.confidenceScore * 100)}% confidence)
                </span>
              )}
            </div>

            {expanded && event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">Metadata</p>
                {Object.entries(event.metadata).map(([k, v]) => (
                  <div key={k} className="text-xs text-gray-600">
                    <span className="font-medium">{k}:</span> {String(v)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Toggle details"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {event.sourceType === 'manual' && (
              <button
                onClick={() => onDelete(event.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                aria-label="Delete event"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Timeline Page
// ---------------------------------------------------------------------------

export function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');

  const fetchEvents = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('eventType', filterType);
      if (filterSource) params.set('sourceType', filterSource);

      const res = await apiFetch(`/api/timeline/${caseId}?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, filterType, filterSource]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async (eventId: string) => {
    if (!caseId) return;
    try {
      await apiFetch(`/api/timeline/${caseId}/${eventId}`, { method: 'DELETE' });
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // Group events by date
  const groupedEvents: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const dateKey = new Date(event.timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
    groupedEvents[dateKey].push(event);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Evidence Timeline
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''} reconstructed from evidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Refresh timeline"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter size={12} />
          Filters:
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Event Types</option>
          {Object.keys(EVENT_TYPE_COLORS).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sources</option>
          {Object.keys(SOURCE_TYPE_LABELS).map((s) => (
            <option key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Add Event Form */}
      {showAddForm && caseId && (
        <AddEventForm
          caseId={caseId}
          onCreated={() => { setShowAddForm(false); fetchEvents(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading timeline...</div>
      ) : events.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No timeline events yet.</p>
            <p className="text-gray-400 text-xs mt-1">Upload evidence to auto-extract events, or add events manually.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{month}</h3>
              <div className="space-y-0">
                {monthEvents.map((event) => (
                  <TimelineEventCard key={event.id} event={event} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
