// ============================================
// Court Access — Activity / Timeline Tab
// ============================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Clock, Loader2, User } from 'lucide-react';
import { fetchTimelineEvents, type ApiTimelineEvent } from '../../services/caseApi';

export function ActivityPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [events, setEvents] = useState<ApiTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchTimelineEvents(caseId).catch(() => []);
        if (!cancelled) setEvents(data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Activity Timeline</h2>
        <p className="text-sm text-gray-500 mt-1">Complete audit log of case events</p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading timeline...</p>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No timeline events yet. Upload evidence and process the case to generate a timeline.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {events.map((event) => (
              <div key={event.eventId} className="flex gap-4 relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-blue-100 text-blue-600">
                  <Clock size={20} />
                </div>
                <Card className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{event.description}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {event.actor && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <User size={12} /> {event.actor}
                          </span>
                        )}
                        {event.action && (
                          <span className="text-xs text-gray-500">{event.action}</span>
                        )}
                        {event.target && (
                          <span className="text-xs text-blue-600 font-medium">{event.target}</span>
                        )}
                      </div>
                      {event.confidence !== undefined && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                          event.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                          event.confidence >= 0.6 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {Math.round(event.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {event.canonicalTimestamp || event.timestampSource || '—'}
                    </span>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
