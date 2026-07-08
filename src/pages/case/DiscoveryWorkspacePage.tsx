// ============================================================================
// CourtAccess — Discovery Workspace & Disclosure Intelligence (Program 79)
// Premium inbound-discovery management over the real DiscoveryItem API.
// Summary, categories, review workflow, Brady/Giglio/Jencks candidate flags,
// search, and cross-subsystem integration. Evidence-governed — flags are
// user-set candidates, never fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, Search, Plus, X, RefreshCw, FileStack, Briefcase, Network, Clock,
  Pencil, CheckCircle2, Flag,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Icon } from '../../components/icons/registry';
import { Badge } from '../../components/ui/badge';
import { listDiscovery, createDiscovery, updateDiscovery, type DiscoveryItem } from '../../services/discoveryApi';

const CATEGORIES: Array<[string, string]> = [
  ['police_report', 'Police Report'], ['supplemental_report', 'Supplemental Report'], ['body_camera', 'Body Camera'],
  ['dash_camera', 'Dash Camera'], ['911_call', '911 Call'], ['cad_log', 'CAD Log'], ['crime_scene_photo', 'Crime Scene Photo'],
  ['crime_scene_video', 'Crime Scene Video'], ['lab_report', 'Lab Report'], ['dna_report', 'DNA Report'],
  ['fingerprint', 'Fingerprint Report'], ['medical', 'Medical Records'], ['autopsy', 'Autopsy Report'],
  ['financial', 'Financial Records'], ['phone_extraction', 'Phone Extraction'], ['cellebrite', 'Cellebrite'],
  ['search_warrant', 'Search Warrant'], ['affidavit', 'Affidavit'], ['subpoena', 'Subpoena'], ['court_order', 'Court Order'],
  ['expert_report', 'Expert Report'], ['brady', 'Brady Material'], ['giglio', 'Giglio Material'], ['jencks', 'Jencks Material'],
  ['custom', 'Custom Discovery'],
];
const CAT_LABEL = Object.fromEntries(CATEGORIES);

const REVIEW_VARIANT: Record<string, 'emerald' | 'gold' | 'slate'> = {
  pending: 'slate', in_review: 'gold', completed: 'emerald',
};

export function DiscoveryWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const empty = { title: '', category: 'police_report', sourceAgency: '', receivedDate: '', producedDate: '', notes: '', bradyFlag: false, giglioFlag: false, jencksFlag: false };
  const [form, setForm] = useState<Record<string, string | boolean>>(empty);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try { setItems(await listDiscovery(caseId)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load discovery'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !String(form.title).trim()) return;
    setSaving(true); setAddErr('');
    try {
      await createDiscovery(caseId, {
        title: String(form.title).trim(), category: String(form.category),
        sourceAgency: String(form.sourceAgency) || undefined,
        receivedDate: String(form.receivedDate) || undefined,
        producedDate: String(form.producedDate) || undefined,
        notes: String(form.notes) || undefined,
        bradyFlag: !!form.bradyFlag, giglioFlag: !!form.giglioFlag, jencksFlag: !!form.jencksFlag,
      });
      setForm(empty); setShowAdd(false); await load();
    } catch (err) { setAddErr(err instanceof Error ? err.message : 'Failed to add discovery'); }
    finally { setSaving(false); }
  };

  const act = async (id: string, patch: Partial<DiscoveryItem>) => {
    if (!caseId) return;
    setBusyId(id);
    try { await updateDiscovery(caseId, id, patch); await load(); }
    catch { /* keep prior state */ }
    finally { setBusyId(''); }
  };

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.reviewStatus === 'pending').length;
    const completed = items.filter((i) => i.reviewStatus === 'completed').length;
    const brady = items.filter((i) => i.bradyFlag).length;
    const giglio = items.filter((i) => i.giglioFlag).length;
    const jencks = items.filter((i) => i.jencksFlag).length;
    const health = items.length === 0 ? 'UNKNOWN' : pending > 0 ? 'Review pending' : 'Reviewed';
    return { pending, completed, brady, giglio, jencks, health };
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (reviewFilter !== 'all') list = list.filter((i) => i.reviewStatus === reviewFilter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) =>
      i.title.toLowerCase().includes(q) || (i.sourceAgency ?? '').toLowerCase().includes(q) ||
      (CAT_LABEL[i.category] ?? i.category).toLowerCase().includes(q) || (i.notes ?? '').toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q));
    return list;
  }, [items, reviewFilter, query]);

  const field = 'w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:border-gold-light focus:outline-none';

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Litigation Intelligence"
        title="Discovery Workspace"
        subtitle="Repository-backed criminal discovery — Brady / Giglio / Jencks are evidence-governed candidate flags, never fabricated."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => caseId && navigate(`/cases/${caseId}/attorney-workbench`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Briefcase size={15} /> Workbench</button>
            <button onClick={() => caseId && navigate(`/cases/${caseId}/knowledge-graph`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Network size={15} /> Knowledge Graph</button>
            <button onClick={() => caseId && navigate(`/cases/${caseId}/timeline`)} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><Clock size={15} /> Timeline</button>
            <button onClick={() => { setForm(empty); setShowAdd(true); }} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110"><Plus size={15} /> Add Discovery</button>
            <button onClick={load} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        }
      />

      {showAdd && (
        <form onSubmit={submit} className="rounded-xl border border-gold/20 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gold-light">Add Discovery Item</h3>
            <button type="button" onClick={() => setShowAdd(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X size={15} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="block text-xs text-slate-400 mb-1">Title *</label><input value={String(form.title)} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={field} placeholder="e.g. Arrest Report #2024-1234" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Category</label>
              <select value={String(form.category)} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={field}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Source agency</label><input value={String(form.sourceAgency)} onChange={(e) => setForm((f) => ({ ...f, sourceAgency: e.target.value }))} className={field} placeholder="e.g. SJPD" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Received date</label><input type="date" value={String(form.receivedDate)} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} className={field} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Produced date</label><input type="date" value={String(form.producedDate)} onChange={(e) => setForm((f) => ({ ...f, producedDate: e.target.value }))} className={field} /></div>
            <div className="sm:col-span-2"><label className="block text-xs text-slate-400 mb-1">Notes</label><input value={String(form.notes)} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={field} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            {([['bradyFlag', 'Brady candidate'], ['giglioFlag', 'Giglio candidate'], ['jencksFlag', 'Jencks candidate']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} className="accent-gold-light" /> {l}
              </label>
            ))}
          </div>
          {addErr && <p className="text-xs text-red-300">{addErr}</p>}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save Discovery
          </button>
        </form>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {([
          ['Total', items.length], ['Pending Review', stats.pending], ['Completed', stats.completed],
          ['Brady', stats.brady], ['Giglio', stats.giglio], ['Jencks', stats.jencks],
          ['Categories', new Set(items.map((i) => i.category)).size],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ca-icon-gold text-gold-light"><Icon name="documents" size={16} /></span>
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Health + search + review filter */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search discovery (title, agency, category)…" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-400 mr-1">Discovery Health: <span className="text-slate-200">{stats.health}</span></span>
          {['all', 'pending', 'in_review', 'completed'].map((s) => (
            <button key={s} onClick={() => setReviewFilter(s)} className={`px-3 py-1.5 rounded-full border text-xs capitalize ${reviewFilter === s ? 'border-gold/40 bg-gold/10 text-gold-light' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'}`}>{s.replace(/_/g, ' ')}</button>
          ))}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : error ? (
        <div className="ca-panel p-10 text-center text-red-300">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="ca-panel p-12 text-center">
          <FileStack className="mx-auto text-slate-500 mb-3" size={32} />
          <p className="text-white font-semibold">{items.length === 0 ? 'No discovery logged yet' : 'No matching discovery'}</p>
          <p className="text-sm text-slate-400 mt-1">{items.length === 0 ? 'Add produced discovery items to track review and Brady/Giglio/Jencks candidates — unlimited.' : 'Adjust your search or filter.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((it) => (
            <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{it.title}</p>
                  <p className="text-xs text-slate-400">{CAT_LABEL[it.category] ?? it.category}{it.sourceAgency ? ` · ${it.sourceAgency}` : ''}</p>
                </div>
                <Badge variant={REVIEW_VARIANT[it.reviewStatus] ?? 'slate'} className="capitalize flex-shrink-0">{it.reviewStatus.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {it.bradyFlag && <Badge variant="danger">Brady</Badge>}
                {it.giglioFlag && <Badge variant="danger">Giglio</Badge>}
                {it.jencksFlag && <Badge variant="amber">Jencks</Badge>}
                {it.flags?.map((f) => <Badge key={f} variant="slate" className="capitalize"><Flag size={10} className="mr-1" />{f.replace(/_/g, ' ')}</Badge>)}
                {!it.bradyFlag && !it.giglioFlag && !it.jencksFlag && (it.flags?.length ?? 0) === 0 && <span className="text-[11px] text-slate-500">No flags — candidates UNKNOWN</span>}
              </div>
              {it.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{it.notes}</p>}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                {it.reviewStatus !== 'completed' ? (
                  <button disabled={busyId === it.id} onClick={() => act(it.id, { reviewStatus: 'completed' })} className="text-xs text-slate-300 hover:text-emerald-300 inline-flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={13} /> Mark reviewed</button>
                ) : (
                  <button disabled={busyId === it.id} onClick={() => act(it.id, { reviewStatus: 'pending' })} className="text-xs text-slate-300 hover:text-gold-light inline-flex items-center gap-1 disabled:opacity-50"><Pencil size={13} /> Reopen</button>
                )}
                <button disabled={busyId === it.id} onClick={() => act(it.id, { bradyFlag: !it.bradyFlag })} className="text-xs text-slate-400 hover:text-red-300 inline-flex items-center gap-1 disabled:opacity-50"><Flag size={12} /> {it.bradyFlag ? 'Unflag Brady' : 'Flag Brady'}</button>
                <span className="text-[11px] text-slate-500 ml-auto font-mono">{it.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
