// ============================================================================
// CourtAccess — Timeline Intelligence & Event Reconstruction (Program 76)
// Premium litigation timeline over the real, evidence-governed timeline API.
// Summary stats, category filters, search, the unified TimelineEngine (zoom /
// group / overlay / expand), conflict intelligence, and Export JSON.
// Every event traces to supporting evidence; UNKNOWN where unsupported.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Search, Download, RefreshCw, Clock, AlertTriangle, Network, ArrowLeft, Plus, X } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Icon } from '../../components/icons/registry';
import { TimelineEngine } from '../../components/timeline/TimelineEngine';
import { fromApiTimelineEvents } from '../../components/timeline/adapters';
import {
  fetchTimelineEvents, fetchTimelineConflicts, createTimelineEvent,
  type ApiTimelineEvent, type ApiTimelineConflict,
} from '../../services/caseApi';

// Best-effort classification of a free-form eventType into a litigation bucket.
function bucketOf(category: string | undefined): 'evidence' | 'witness' | 'charge' | 'court' | 'investigation' | 'other' {
  const c = (category ?? '').toLowerCase();
  if (/(evidence|upload|forensic|collect|seiz|warrant|bodycam|dashcam)/.test(c)) return 'evidence';
  if (/(witness|interview|statement|testimony)/.test(c)) return 'witness';
  if (/(charge|arrest|booking|arraign|charging)/.test(c)) return 'charge';
  if (/(court|hearing|trial|verdict|sentenc|motion|appeal|arraign|prelim)/.test(c)) return 'court';
  if (/(investig|dispatch|911|call|officer|search|research)/.test(c)) return 'investigation';
  return 'other';
}

export function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [apiEvents, setApiEvents] = useState<ApiTimelineEvent[]>([]);
  const [apiConflicts, setApiConflicts] = useState<ApiTimelineConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<string>('all');

  // Create Event ("Custom Event") form
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [form, setForm] = useState({ description: '', timestamp: '', eventType: 'custom', actor: '', location: '' });

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [ev, cf] = await Promise.all([
        fetchTimelineEvents(caseId),
        fetchTimelineConflicts(caseId).catch(() => []),
      ]);
      setApiEvents(ev);
      setApiConflicts(cf);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !form.description.trim()) return;
    setSaving(true); setAddErr('');
    try {
      await createTimelineEvent(caseId, {
        description: form.description.trim(),
        timestamp: form.timestamp || undefined,
        eventType: form.eventType || undefined,
        actor: form.actor || undefined,
        location: form.location || undefined,
      });
      setForm({ description: '', timestamp: '', eventType: 'custom', actor: '', location: '' });
      setShowAdd(false);
      await load();
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const events = useMemo(() => fromApiTimelineEvents(apiEvents), [apiEvents]);
  const conflicts = apiConflicts;

  const stats = useMemo(() => {
    const b = { evidence: 0, witness: 0, charge: 0, court: 0, investigation: 0, other: 0 };
    let unknown = 0;
    for (const e of events) {
      b[bucketOf(e.category)] += 1;
      if (e.isUnknown || !e.timestamp) unknown += 1;
    }
    const dated = events.length - unknown;
    const health = events.length === 0 ? 'UNKNOWN' : conflicts.length > 0 ? 'Conflicts' : unknown > 0 ? 'Gaps' : 'Consistent';
    return { ...b, unknown, dated, health };
  }, [events, conflicts]);

  const filtered = useMemo(() => {
    let list = events;
    if (bucket !== 'all') list = list.filter((e) => bucketOf(e.category) === bucket);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.actor ?? '').toLowerCase().includes(q) ||
      (e.category ?? '').toLowerCase().includes(q) ||
      (e.timestamp ?? '').toLowerCase().includes(q));
    return list;
  }, [events, bucket, query]);

  const exportJson = () => {
    const payload = { caseId, totalEvents: apiEvents.length, events: apiEvents, conflicts: apiConflicts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `timeline-${caseId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const BUCKETS: Array<[string, string]> = [
    ['all', 'All'], ['evidence', 'Evidence'], ['witness', 'Witness'], ['charge', 'Charge'],
    ['court', 'Court'], ['investigation', 'Investigation'], ['other', 'Other'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Litigation Intelligence"
        title="Timeline Intelligence"
        subtitle="Evidence-governed chronological reconstruction — every event traces back to supporting evidence."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => caseId && navigate(`/cases/${caseId}/attorney-workbench`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><ArrowLeft size={15} /> Workbench</button>
            <button onClick={() => caseId && navigate(`/cases/${caseId}/knowledge-graph`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Network size={15} /> Knowledge Graph</button>
            <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110"><Plus size={15} /> Add Event</button>
            <button onClick={exportJson} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Download size={15} /> Export JSON</button>
            <button onClick={load} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        }
      />

      {showAdd && (
        <form onSubmit={submitEvent} className="rounded-xl border border-gold/20 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gold-light">Add Timeline Event</h3>
            <button type="button" onClick={() => setShowAdd(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X size={15} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description *</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required placeholder="What happened…" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event type</label>
              <select value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none">
                {['incident', '911_call', 'dispatch', 'officer_arrival', 'investigation', 'interview', 'statement', 'evidence_collection', 'search_warrant', 'arrest', 'booking', 'charging', 'arraignment', 'preliminary_hearing', 'motion_filing', 'discovery', 'trial', 'verdict', 'sentencing', 'appeal', 'attorney_note', 'custom'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date &amp; time (leave blank = UNKNOWN)</label>
              <input type="datetime-local" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Participant / actor</label>
              <input value={form.actor} onChange={(e) => setForm((f) => ({ ...f, actor: e.target.value }))} placeholder="e.g. Officer Diaz" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. 4th & Main" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none" />
            </div>
          </div>
          {addErr && <p className="text-xs text-red-300">{addErr}</p>}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save Event
          </button>
        </form>
      )}

      {/* Timeline summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {([
          ['Total Events', events.length, 'timeline'],
          ['Evidence', stats.evidence, 'evidence'],
          ['Witness', stats.witness, 'witness'],
          ['Charge', stats.charge, 'statutes'],
          ['Court', stats.court, 'court'],
          ['Investigation', stats.investigation, 'search'],
          ['Unknown Time', stats.unknown, 'unknown'],
        ] as const).map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ca-icon-gold text-gold-light"><Icon name={icon as never} size={16} /></span>
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline status chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Chronology:</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${stats.health === 'Consistent' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : stats.health === 'Conflicts' ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>Timeline Health: {stats.health}</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-300"><Clock size={12} className="text-gold-light" /> {stats.dated} dated · {stats.unknown} UNKNOWN time</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conflicts.length > 0 ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}><AlertTriangle size={12} /> {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</span>
      </div>

      {/* Search + category filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events (date, actor, evidence, type)…" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {BUCKETS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setBucket(id)}
              className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${bucket === id ? 'border-gold/40 bg-gold/10 text-gold-light' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conflict intelligence (Phase 6) */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 space-y-2">
          <h3 className="text-sm font-semibold text-red-300 flex items-center gap-2"><AlertTriangle size={15} /> Chronology Conflicts ({conflicts.length})</h3>
          <ul className="space-y-1.5">
            {conflicts.map((c, i) => (
              <li key={c.conflictId ?? i} className="text-xs text-slate-300">
                <span className="text-red-300 font-medium capitalize">{c.type.replace(/_/g, ' ')}{c.severity ? ` · ${c.severity}` : ''}:</span> {c.description}
                {c.eventIds?.length > 0 && <span className="text-slate-500"> ({c.eventIds.length} events)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && apiEvents.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : error ? (
        <div className="ca-panel p-10 text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={28} />
          <p className="text-red-300">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="ca-panel p-12 text-center">
          <Clock className="mx-auto text-slate-500 mb-3" size={32} />
          <p className="text-white font-semibold">No timeline events yet</p>
          <p className="text-sm text-slate-400 mt-1">Upload evidence and process the case — timeline events are extracted from evidence. UNKNOWN until then.</p>
        </div>
      ) : (
        <TimelineEngine events={filtered} variant="case" title={`${filtered.length} event${filtered.length === 1 ? '' : 's'}`} />
      )}
    </div>
  );
}
