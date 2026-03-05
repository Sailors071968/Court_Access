// ============================================
// Court Access — Upcoming Hearings Dashboard Widget
// Shows hearings within the next 14 days with
// countdown badge, case name, and courthouse info.
// ============================================

import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Bell } from 'lucide-react';
import { Card } from './Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UpcomingHearing {
  id: string;
  caseId: string;
  caseName: string | null;
  hearingName: string;
  hearingDatetime: string;
  courthouseName: string;
  courthouseAddress: string;
  department: string;
}

function daysUntil(datetime: string): number {
  const now = new Date();
  const target = new Date(datetime);
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(datetime: string): string {
  return new Date(datetime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function CountdownBadge({ days }: { days: number }) {
  let bg = 'bg-green-100 text-green-800';
  if (days <= 1) bg = 'bg-red-100 text-red-800';
  else if (days <= 3) bg = 'bg-amber-100 text-amber-800';
  else if (days <= 7) bg = 'bg-blue-100 text-blue-800';

  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`;

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg}`}>
      {label}
    </span>
  );
}

export function UpcomingHearingsWidget() {
  const [hearings, setHearings] = useState<UpcomingHearing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUpcoming() {
      try {
        const res = await fetch(`${API_BASE}/api/hearings/upcoming`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setHearings(data.hearings || []);
      } catch {
        // Silently fail — widget is informational
        if (!cancelled) setHearings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUpcoming();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Hearings</h2>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Hearings</h2>
        </div>
        <span className="text-xs text-gray-400">Next 14 days</span>
      </div>

      {hearings.length === 0 ? (
        <div className="text-center py-6">
          <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No upcoming hearings</p>
          <p className="text-xs text-gray-400 mt-1">Hearings within 14 days will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hearings.map((hearing) => {
            const days = daysUntil(hearing.hearingDatetime);
            return (
              <div
                key={hearing.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{hearing.hearingName}</p>
                    <CountdownBadge days={days} />
                  </div>
                  {hearing.caseName && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{hearing.caseName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(hearing.hearingDatetime)} at {formatTime(hearing.hearingDatetime)}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                      <MapPin size={10} />
                      {hearing.courthouseName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
