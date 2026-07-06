// ============================================
// Court Access — Activity / Case Timeline Tab
// Uses the unified Timeline Engine (Program 26).
// ============================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/page-header';
import { TimelineEngine, fromApiTimelineEvents, type TimelineEvent } from '../../components/timeline';
import { fetchTimelineEvents, type ApiTimelineEvent } from '../../services/caseApi';

export function ActivityPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data: ApiTimelineEvent[] = await fetchTimelineEvents(caseId).catch(() => []);
        if (!cancelled) setEvents(fromApiTimelineEvents(data ?? []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Case Timeline" overline="Activity" subtitle="Complete, citation-backed audit of case events" />
      <TimelineEngine events={events} variant="case" loading={loading} />
    </div>
  );
}
