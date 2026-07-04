// ============================================================================
// Program 12 — Investigator Workbench
// Route: /cases/:caseId/investigator-workbench
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Loader2, RefreshCw, Users, ClipboardList, MapPin,
  Camera, Video, Mic, AlertTriangle, Clock, FileText, Plus,
} from 'lucide-react';
import { Card, CardHeader, StatCard } from '../../components/common/Card';
import {
  fetchInvestigatorWorkbench,
  createWitness,
  createLead,
  createFieldNote,
  type InvestigatorWorkbench,
} from '../../services/investigatorApi';

type TabId = 'dashboard' | 'tasks' | 'witnesses' | 'evidence' | 'timeline' | 'notes' | 'gaps';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tasks', label: 'Tasks & Leads' },
  { id: 'witnesses', label: 'Witnesses' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'notes', label: 'Field Notes' },
  { id: 'gaps', label: 'Gaps & Unknowns' },
];

export function InvestigatorWorkbenchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<InvestigatorWorkbench | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [witnessName, setWitnessName] = useState('');
  const [leadTitle, setLeadTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setData(await fetchInvestigatorWorkbench(caseId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin" size={32} /></div>;
  }
  if (error && !data) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
        <p className="text-red-700">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Retry</button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Search size={24} /> Investigator Workbench</h1>
          <p className="text-sm text-gray-500">{data.dashboard.caseTitle} — {data.dashboard.caseNumber}</p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <nav className="flex flex-wrap gap-1 border-b pb-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm rounded-t-lg ${tab === t.id ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<ClipboardList size={20} />} value={data.dashboard.openTasks} label="Open Tasks" />
          <StatCard icon={<Search size={20} />} value={data.dashboard.openLeads} label="Active Leads" />
          <StatCard icon={<Users size={20} />} value={data.dashboard.witnessCount} label="Witnesses" />
          <StatCard icon={<AlertTriangle size={20} />} value={data.dashboard.unknownCount} label="Unknowns" highlight={data.dashboard.unknownCount > 0} />
        </div>
      )}

      {tab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Investigation Tasks" />
            <ul className="space-y-2 text-sm">
              {data.tasks.map((t) => (
                <li key={t.id} className="p-2 bg-gray-50 rounded flex justify-between">
                  <span>{t.title}</span>
                  <span className="text-gray-500">{t.status}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Leads" action={
              <div className="flex gap-2">
                <input value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} placeholder="New lead..." className="px-2 py-1 border rounded text-sm" />
                <button type="button" onClick={() => void createLead(caseId!, { title: leadTitle }).then(() => { setLeadTitle(''); load(); })} className="px-2 py-1 bg-slate-800 text-white rounded text-sm"><Plus size={14} /></button>
              </div>
            } />
            <ul className="space-y-2 text-sm">
              {data.leads.map((l) => (
                <li key={l.id} className="p-2 bg-gray-50 rounded flex justify-between">
                  <span>{l.title}</span>
                  <span className="text-gray-500">{l.status}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'witnesses' && (
        <Card>
          <CardHeader title="Witnesses & Interviews" action={
            <div className="flex gap-2">
              <input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} placeholder="Witness name..." className="px-2 py-1 border rounded text-sm" />
              <button type="button" onClick={() => void createWitness(caseId!, { name: witnessName }).then(() => { setWitnessName(''); load(); })} className="px-2 py-1 bg-slate-800 text-white rounded text-sm"><Plus size={14} /></button>
            </div>
          } />
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Name</th><th>Role</th><th>Interview</th><th>Source</th></tr></thead>
            <tbody>
              {data.witnesses.map((w) => (
                <tr key={w.id} className="border-b border-gray-50">
                  <td className="py-2 font-medium">{w.name}</td>
                  <td>{w.role ?? '—'}</td>
                  <td>{w.interviewStatus}</td>
                  <td className="text-xs text-gray-500">{w.citations.map((c) => `${c.type}:${c.id.slice(0, 6)}`).join(', ') || 'manual'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'evidence' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader title="Photos" /><ul className="text-sm space-y-1">{data.evidenceCollection.photos.map((e) => <li key={e.evidenceId} className="flex items-center gap-1"><Camera size={14} />{e.fileName}</li>)}</ul></Card>
          <Card><CardHeader title="Video" /><ul className="text-sm space-y-1">{data.evidenceCollection.videos.map((e) => <li key={e.evidenceId} className="flex items-center gap-1"><Video size={14} />{e.fileName}</li>)}</ul></Card>
          <Card><CardHeader title="Audio" /><ul className="text-sm space-y-1">{data.evidenceCollection.audio.map((e) => <li key={e.evidenceId} className="flex items-center gap-1"><Mic size={14} />{e.fileName}</li>)}</ul></Card>
          <Card className="md:col-span-3">
            <CardHeader title="Chain of Custody" />
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">File</th><th>Status</th></tr></thead>
              <tbody>
                {data.chainOfCustody.map((c) => (
                  <tr key={c.evidenceId} className="border-b border-gray-50">
                    <td className="py-2">{c.fileName}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'timeline' && (
        <Card>
          <CardHeader title="Case Timeline" />
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {data.timeline.map((e) => (
              <li key={e.id} className={`text-sm p-2 rounded ${e.actor ? 'bg-gray-50' : 'bg-amber-50'}`}>
                <Clock size={14} className="inline mr-1" />
                {e.timestamp ? new Date(e.timestamp).toLocaleString() : 'UNKNOWN time'}
                {e.actor && <span className="font-medium ml-2">{e.actor}:</span>} {e.description}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <CardHeader title="Field Notes" />
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Field observation..." className="w-full h-24 border rounded p-2 text-sm mb-2" />
          <button type="button" onClick={() => void createFieldNote(caseId!, noteText).then(() => { setNoteText(''); load(); })} className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm">Save Note</button>
          <ul className="mt-4 space-y-2">
            {data.fieldNotes.map((n) => (
              <li key={n.id} className="p-3 bg-yellow-50 border border-yellow-100 rounded text-sm">
                <span className="text-xs text-gray-500">{n.noteType}</span>
                <div>{n.content}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'gaps' && (
        <div className="space-y-4">
          <Card><CardHeader title="Recommended Investigation" /><ul className="list-disc list-inside text-sm">{data.recommendedInvestigation.map((r, i) => <li key={i}>{r}</li>)}</ul></Card>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader title="Evidence Gaps" /><ul className="text-sm space-y-1">{data.gaps.evidence.map((g, i) => <li key={i}>{g}</li>)}</ul></Card>
            <Card><CardHeader title="Witness Gaps" /><ul className="text-sm space-y-1">{data.gaps.witness.map((g, i) => <li key={i}>{g}</li>)}</ul></Card>
            <Card><CardHeader title="Timeline Gaps" /><ul className="text-sm space-y-1">{data.gaps.timeline.map((g, i) => <li key={i}>{g}</li>)}</ul></Card>
          </div>
          {data.unknowns.length > 0 && (
            <Card><CardHeader title="Unknowns" /><ul className="list-disc list-inside text-sm text-amber-800">{data.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul></Card>
          )}
        </div>
      )}
    </div>
  );
}
