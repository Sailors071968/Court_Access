// ============================================================================
// CourtAccess — Witness Workspace & Credibility Intelligence (Program 78)
// Premium witness intelligence center over the real CaseWitness API.
// Summary by type, credibility/interview/statement status, search, unlimited
// witness management, and cross-subsystem integration. Credibility findings are
// evidence-governed — UNKNOWN until supported, never fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, Search, Plus, X, RefreshCw, Users, Briefcase, Network, Clock,
  ShieldQuestion, Pencil,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Icon } from '../../components/icons/registry';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { listWitnesses, createWitness, updateWitness, type Witness } from '../../services/witnessApi';

const WITNESS_TYPES: Array<[string, string]> = [
  ['civilian', 'Civilian Witness'], ['victim', 'Victim'], ['law_enforcement', 'Law Enforcement Officer'],
  ['expert', 'Expert Witness'], ['confidential_informant', 'Confidential Informant'], ['custodian', 'Custodian of Records'],
  ['medical', 'Medical Personnel'], ['crime_lab', 'Crime Lab Personnel'], ['operator_911', '911 Operator'],
  ['dispatcher', 'Dispatcher'], ['forensic_examiner', 'Digital Forensic Examiner'], ['private_investigator', 'Private Investigator'],
  ['defense_investigator', 'Defense Investigator'], ['custom', 'Custom'],
];
const TYPE_LABEL = Object.fromEntries(WITNESS_TYPES);

const STATUS_VARIANT: Record<string, 'emerald' | 'amber' | 'slate' | 'gold' | 'info'> = {
  identified: 'slate', contacted: 'info', interviewed: 'emerald', unavailable: 'amber',
};
const INTERVIEW_VARIANT: Record<string, 'emerald' | 'amber' | 'slate' | 'gold'> = {
  not_scheduled: 'slate', scheduled: 'gold', completed: 'emerald', declined: 'amber',
};

export function WitnessWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Witness | null>(null);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const empty = { name: '', witnessType: 'civilian', role: '', agency: '', employer: '', contactPhone: '', contactEmail: '', status: 'identified', interviewStatus: 'not_scheduled', notes: '' };
  const [form, setForm] = useState<Record<string, string>>(empty);

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try { setWitnesses(await listWitnesses(caseId)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load witnesses'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  const openCreate = () => { setEditing(null); setForm(empty); setAddErr(''); setShowAdd(true); };
  const openEdit = (w: Witness) => {
    setEditing(w);
    setForm({ name: w.name, witnessType: w.witnessType ?? 'civilian', role: w.role ?? '', agency: w.agency ?? '', employer: w.employer ?? '', contactPhone: w.contactPhone ?? '', contactEmail: w.contactEmail ?? '', status: w.status, interviewStatus: w.interviewStatus, notes: w.notes ?? '' });
    setAddErr(''); setShowAdd(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !form.name.trim()) return;
    setSaving(true); setAddErr('');
    try {
      if (editing) await updateWitness(caseId, editing.id, form);
      else await createWitness(caseId, form);
      setShowAdd(false); setEditing(null); setForm(empty);
      await load();
    } catch (err) { setAddErr(err instanceof Error ? err.message : 'Failed to save witness'); }
    finally { setSaving(false); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of witnesses) { const t = w.witnessType ?? 'civilian'; c[t] = (c[t] ?? 0) + 1; }
    const interviewed = witnesses.filter((w) => w.interviewStatus === 'completed').length;
    const unavailable = witnesses.filter((w) => w.status === 'unavailable').length;
    return { c, interviewed, unavailable };
  }, [witnesses]);

  const filtered = useMemo(() => {
    let list = witnesses;
    if (typeFilter !== 'all') list = list.filter((w) => (w.witnessType ?? 'civilian') === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((w) =>
      w.name.toLowerCase().includes(q) || (w.agency ?? '').toLowerCase().includes(q) ||
      (w.employer ?? '').toLowerCase().includes(q) || (w.role ?? '').toLowerCase().includes(q) ||
      (w.notes ?? '').toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
    return list;
  }, [witnesses, typeFilter, query]);

  const field = 'w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none';

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Litigation Intelligence"
        title="Witness Workspace"
        subtitle="Evidence-governed witness intelligence — credibility findings are UNKNOWN until supported by evidence."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => caseId && navigate(`/cases/${caseId}/attorney-workbench`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Briefcase size={15} /> Workbench</button>
            <button onClick={() => caseId && navigate(`/cases/${caseId}/knowledge-graph`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Network size={15} /> Knowledge Graph</button>
            <button onClick={() => caseId && navigate(`/cases/${caseId}/timeline`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Clock size={15} /> Timeline</button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110"><Plus size={15} /> Add Witness</button>
            <button onClick={load} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        }
      />

      {showAdd && (
        <form onSubmit={submit} className="rounded-xl border border-gold/20 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gold-light">{editing ? 'Edit Witness' : 'Add Witness'}</h3>
            <button type="button" onClick={() => setShowAdd(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X size={15} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-400 mb-1">Full name *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={field} placeholder="e.g. Jane Doe" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Witness type</label>
              <select value={form.witnessType} onChange={(e) => setForm((f) => ({ ...f, witnessType: e.target.value }))} className={field}>
                {WITNESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Role in case</label><input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={field} placeholder="e.g. Eyewitness" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Agency</label><input value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} className={field} placeholder="e.g. SJPD" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Employer</label><input value={form.employer} onChange={(e) => setForm((f) => ({ ...f, employer: e.target.value }))} className={field} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Phone</label><input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={field} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Email</label><input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className={field} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={field}>
                {['identified', 'contacted', 'interviewed', 'unavailable'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Interview status</label>
              <select value={form.interviewStatus} onChange={(e) => setForm((f) => ({ ...f, interviewStatus: e.target.value }))} className={field}>
                {['not_scheduled', 'scheduled', 'completed', 'declined'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="block text-xs text-slate-400 mb-1">Notes</label><input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={field} placeholder="Interview notes…" /></div>
          </div>
          {addErr && <p className="text-xs text-red-300">{addErr}</p>}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {editing ? 'Save Changes' : 'Save Witness'}
          </button>
        </form>
      )}

      {/* Witness summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {([
          ['Total', witnesses.length],
          ['Civilian', counts.c.civilian ?? 0],
          ['Law Enforcement', counts.c.law_enforcement ?? 0],
          ['Expert', counts.c.expert ?? 0],
          ['Victim', counts.c.victim ?? 0],
          ['Interviewed', counts.interviewed],
          ['Unavailable', counts.unavailable],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ca-icon-gold text-gold-light"><Icon name="witness" size={16} /></span>
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search + type filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search witnesses (name, agency, role)…" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-full border text-xs ${typeFilter === 'all' ? 'border-gold/40 bg-gold/10 text-gold-light' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'}`}>All</button>
          {WITNESS_TYPES.filter(([v]) => (counts.c[v] ?? 0) > 0).map(([v, l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1.5 rounded-full border text-xs ${typeFilter === v ? 'border-gold/40 bg-gold/10 text-gold-light' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'}`}>{l} ({counts.c[v]})</button>
          ))}
        </div>
      </div>

      {loading && witnesses.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : error ? (
        <div className="ca-panel p-10 text-center text-red-300">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="ca-panel p-12 text-center">
          <Users className="mx-auto text-slate-500 mb-3" size={32} />
          <p className="text-white font-semibold">{witnesses.length === 0 ? 'No witnesses yet' : 'No matching witnesses'}</p>
          <p className="text-sm text-slate-400 mt-1">{witnesses.length === 0 ? 'Add witnesses to build credibility intelligence — there is no limit.' : 'Adjust your search or filter.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((w) => (
            <div key={w.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={w.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{w.name}</p>
                    <p className="text-xs text-slate-400 truncate">{TYPE_LABEL[w.witnessType ?? 'civilian'] ?? w.witnessType}{w.role ? ` · ${w.role}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg text-slate-400 hover:text-gold-light hover:bg-white/5" aria-label="Edit"><Pencil size={14} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <Badge variant={STATUS_VARIANT[w.status] ?? 'slate'} className="capitalize">{w.status}</Badge>
                <Badge variant={INTERVIEW_VARIANT[w.interviewStatus] ?? 'slate'} className="capitalize">interview: {w.interviewStatus.replace(/_/g, ' ')}</Badge>
                <Badge variant="slate"><ShieldQuestion size={11} className="mr-1" />credibility: {w.credibilityStatus ?? 'UNKNOWN'}</Badge>
              </div>
              {(w.agency || w.employer || w.contactPhone || w.contactEmail) && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-3">
                  {w.agency && <div><dt className="text-slate-500">Agency</dt><dd className="text-slate-300">{w.agency}</dd></div>}
                  {w.employer && <div><dt className="text-slate-500">Employer</dt><dd className="text-slate-300">{w.employer}</dd></div>}
                  {w.contactPhone && <div><dt className="text-slate-500">Phone</dt><dd className="text-slate-300">{w.contactPhone}</dd></div>}
                  {w.contactEmail && <div><dt className="text-slate-500">Email</dt><dd className="text-slate-300 truncate">{w.contactEmail}</dd></div>}
                </dl>
              )}
              {w.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{w.notes}</p>}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                <button onClick={() => caseId && navigate(`/cases/${caseId}/knowledge-graph`)} className="text-xs text-slate-400 hover:text-gold-light inline-flex items-center gap-1"><Network size={12} /> Graph</button>
                <button onClick={() => caseId && navigate(`/cases/${caseId}/timeline`)} className="text-xs text-slate-400 hover:text-gold-light inline-flex items-center gap-1"><Clock size={12} /> Timeline</button>
                <span className="text-[11px] text-slate-500 ml-auto font-mono">{w.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
