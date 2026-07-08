// ============================================================================
// CourtAccess — Case Intake workflow (Complete Case Intake & Litigation
// Foundation Program). Replaces the legacy Create Case modal with a full,
// repository-backed intake: case information + unlimited criminal charges with
// a California code selector, searchable section selector, and automatic
// offense population. Repository data is real; UNKNOWN where coverage is
// incomplete — never fabricated.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Plus, Trash2, Search, Loader2, ChevronDown, CheckCircle2, ShieldCheck,
  ScrollText, AlertTriangle, Scale, BookOpen, Network,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { createCase, type ApiCase, type IntakeCharge, CASE_TYPES } from '../../services/caseApi';
import { getCaCodes, searchSections, getStatuteIntelligence, type RepoCode, type RepoSection } from '../../services/legislativeApi';

interface ChargeDraft extends IntakeCharge {
  key: string;
  citation?: string;
  expanded?: boolean;
  loadingIntel?: boolean;
  elementsCount?: number;
  defensesCount?: number;
  calcrimCount?: number;
  manualReview?: boolean;
  unknowns?: string[];
}

let counter = 0;
const newCharge = (): ChargeDraft => ({ key: `c${++counter}`, code: '', section: '', countNumber: undefined, isPrimary: false });

const field = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-light focus:ring-1 focus:ring-gold-light';
const label = 'block text-sm font-medium text-slate-200 mb-1.5';

export function CaseIntakeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: ApiCase) => void }) {
  // Phase 1 — case information
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [caseType, setCaseType] = useState('felony');
  const [court, setCourt] = useState('');
  const [department, setDepartment] = useState('');
  const [judge, setJudge] = useState('');
  const [prosecutor, setProsecutor] = useState('');
  const [defenseAttorney, setDefenseAttorney] = useState('');
  const [county, setCounty] = useState('');
  const [filingDate, setFilingDate] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [trialDate, setTrialDate] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');

  // Phase 2 — charges
  const [charges, setCharges] = useState<ChargeDraft[]>([newCharge()]);
  const [codes, setCodes] = useState<RepoCode[]>([]);
  const [codesError, setCodesError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getCaCodes().then(setCodes).catch(() => setCodesError('California code repository unavailable.'));
  }, []);

  const patchCharge = (key: string, patch: Partial<ChargeDraft>) =>
    setCharges((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const addCharge = () => setCharges((cs) => [...cs, newCharge()]);
  const removeCharge = (key: string) => setCharges((cs) => (cs.length === 1 ? cs : cs.filter((c) => c.key !== key)));

  const duplicateCounts = useMemo(() => {
    const nums = charges.map((c) => c.countNumber).filter((n): n is number => typeof n === 'number');
    return nums.length !== new Set(nums).size;
  }, [charges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !caseNumber || !jurisdiction) return;
    if (duplicateCounts) { setFormError('Duplicate charge count numbers are not allowed.'); return; }
    const incomplete = charges.find((c) => (c.code || c.section) && (!c.code || !c.section));
    if (incomplete) { setFormError('Every charge needs both a California code and a section.'); return; }

    const payloadCharges: IntakeCharge[] = charges
      .filter((c) => c.code && c.section)
      .map((c, i) => ({
        code: c.code, section: c.section, title: c.title,
        countNumber: c.countNumber ?? i + 1,
        isPrimary: c.isPrimary, isAttempt: c.isAttempt, isEnhancement: c.isEnhancement,
        dismissed: c.dismissed, severity: c.severity, offenseId: c.offenseId,
        classification: c.classification, repositoryVerified: c.repositoryVerified,
        calcrimAvailable: c.calcrimAvailable, notes: c.notes,
      }));

    try {
      setSubmitting(true);
      setFormError(null);
      const created = await createCase({
        title, caseNumber, jurisdiction, caseType,
        court: court || undefined, department: department || undefined, judge: judge || undefined,
        prosecutor: prosecutor || undefined, defenseAttorney: defenseAttorney || undefined,
        county: county || undefined, filingDate: filingDate || undefined, hearingDate: hearingDate || undefined,
        trialDate: trialDate || undefined, status, notes: notes || undefined,
        charges: payloadCharges,
      });
      onCreated(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  const validCharges = charges.filter((c) => c.code && c.section).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-navy-800 border border-white/10 rounded-2xl shadow-elevated max-w-3xl w-full my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-navy-800 rounded-t-2xl z-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light">Case Intake</p>
            <h2 className="text-xl font-bold text-white tracking-tight">New Criminal Case</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-8">
          {formError && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-2.5 rounded-xl text-sm">{formError}</div>}

          {/* Phase 1 — Case Information */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Case Information</h3>
            <div>
              <label className={label} htmlFor="ci-title">Case Title *</label>
              <input id="ci-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., People v. Smith" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={label} htmlFor="ci-num">Case Number *</label><input id="ci-num" className={field} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required placeholder="2024-CF-001234" /></div>
              <div>
                <label className={label} htmlFor="ci-type">Case Type</label>
                <select id="ci-type" className={field} value={caseType} onChange={(e) => setCaseType(e.target.value)}>
                  {CASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className={label} htmlFor="ci-jur">Jurisdiction *</label><input id="ci-jur" className={field} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} required placeholder="e.g., California Superior Court" /></div>
              <div><label className={label} htmlFor="ci-county">County</label><input id="ci-county" className={field} value={county} onChange={(e) => setCounty(e.target.value)} placeholder="e.g., Santa Clara" /></div>
              <div><label className={label} htmlFor="ci-court">Court</label><input id="ci-court" className={field} value={court} onChange={(e) => setCourt(e.target.value)} placeholder="e.g., Hall of Justice" /></div>
              <div><label className={label} htmlFor="ci-dept">Court Department</label><input id="ci-dept" className={field} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Dept. 24" /></div>
              <div><label className={label} htmlFor="ci-judge">Judge</label><input id="ci-judge" className={field} value={judge} onChange={(e) => setJudge(e.target.value)} placeholder="e.g., Hon. A. Wilson" /></div>
              <div><label className={label} htmlFor="ci-status">Status</label>
                <select id="ci-status" className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option><option value="pending">Pending</option><option value="closed">Closed</option><option value="archived">Archived</option>
                </select>
              </div>
              <div><label className={label} htmlFor="ci-pros">Prosecutor</label><input id="ci-pros" className={field} value={prosecutor} onChange={(e) => setProsecutor(e.target.value)} placeholder="e.g., DDA J. Rivera" /></div>
              <div><label className={label} htmlFor="ci-def">Defense Attorney</label><input id="ci-def" className={field} value={defenseAttorney} onChange={(e) => setDefenseAttorney(e.target.value)} placeholder="e.g., counsel of record" /></div>
              <div><label className={label} htmlFor="ci-filing">Filing Date</label><input id="ci-filing" type="date" className={field} value={filingDate} onChange={(e) => setFilingDate(e.target.value)} /></div>
              <div><label className={label} htmlFor="ci-hearing">Hearing Date</label><input id="ci-hearing" type="date" className={field} value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} /></div>
              <div><label className={label} htmlFor="ci-trial">Trial Date</label><input id="ci-trial" type="date" className={field} value={trialDate} onChange={(e) => setTrialDate(e.target.value)} /></div>
            </div>
            <div><label className={label} htmlFor="ci-notes">Notes</label><textarea id="ci-notes" className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Intake notes…" /></div>
          </section>

          {/* Phase 2-5,8 — Charges */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Criminal Charges <span className="text-slate-500 normal-case font-normal">({validCharges} added)</span></h3>
              {codesError && <span className="text-xs text-amber-300">{codesError}</span>}
            </div>
            {duplicateCounts && <div className="text-xs text-amber-300 flex items-center gap-1"><AlertTriangle size={13} /> Duplicate count numbers detected.</div>}

            <div className="space-y-3">
              {charges.map((c, idx) => (
                <ChargeCard
                  key={c.key}
                  charge={c}
                  index={idx}
                  codes={codes}
                  onPatch={(p) => patchCharge(c.key, p)}
                  onRemove={() => removeCharge(c.key)}
                  canRemove={charges.length > 1}
                />
              ))}
            </div>

            <button type="button" onClick={addCharge} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-gold/30 text-gold-light hover:bg-gold/10">
              <Plus size={15} /> Add Charge
            </button>
          </section>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 sticky bottom-0 bg-navy-800 py-4 -mx-6 px-6 rounded-b-2xl">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Network size={13} className="text-gold-light" /> On save, the Knowledge Graph, Timeline & Attorney Workbench initialize from these charges.</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white">Cancel</button>
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 disabled:opacity-60">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Create Case
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charge card — code selector, searchable section selector, auto-population
// ---------------------------------------------------------------------------

function ChargeCard({ charge, index, codes, onPatch, onRemove, canRemove }: {
  charge: ChargeDraft; index: number; codes: RepoCode[];
  onPatch: (p: Partial<ChargeDraft>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepoSection[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!charge.code || query.trim().length === 0) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchSections(charge.code, query.trim()));
        setOpen(true);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, charge.code]);

  const selectSection = async (s: RepoSection) => {
    setOpen(false);
    setQuery('');
    onPatch({
      section: s.section, citation: s.citation, title: s.title ?? undefined,
      classification: s.classification, repositoryVerified: true, loadingIntel: true,
    });
    try {
      const intel = await getStatuteIntelligence(s.code, s.section);
      if (intel) {
        const calcrim = Array.isArray(intel.calcrim) ? intel.calcrim : (intel.calcrimLinks as unknown[] | undefined) ?? [];
        const elements = Array.isArray(intel.elements) ? intel.elements : [];
        const defenses = Array.isArray(intel.defenses) ? intel.defenses : [];
        onPatch({
          loadingIntel: false,
          calcrimAvailable: calcrim.length > 0,
          calcrimCount: calcrim.length,
          elementsCount: elements.length,
          defensesCount: defenses.length,
          offenseId: (intel.offenseId as string) ?? (intel.statute as { id?: string })?.id ?? undefined,
          manualReview: !!(intel.manualReviewRequired),
          unknowns: Array.isArray(intel.unknowns) ? (intel.unknowns as string[]) : [],
        });
      } else {
        onPatch({ loadingIntel: false, unknowns: ['Repository coverage incomplete — offense metadata UNKNOWN'] });
      }
    } catch {
      onPatch({ loadingIntel: false, unknowns: ['Repository lookup failed — manual review required'] });
    }
  };

  const codeName = codes.find((c) => c.code === charge.code)?.name;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="navy">Count {charge.countNumber ?? index + 1}</Badge>
          {charge.code && <Badge variant="gold">{charge.code}</Badge>}
          {charge.section && <Badge variant="default">§ {charge.section}</Badge>}
          {charge.classification && charge.classification !== 'UNKNOWN' && <Badge variant="info">{String(charge.classification).replace(/_/g, ' ')}</Badge>}
          {charge.repositoryVerified && <Badge variant="emerald"><ShieldCheck size={11} className="mr-1" />Repository verified</Badge>}
          {charge.calcrimAvailable && <Badge variant="gold"><BookOpen size={11} className="mr-1" />CALCRIM ({charge.calcrimCount})</Badge>}
          {charge.repositoryVerified && <Badge variant="info"><Network size={11} className="mr-1" />Knowledge Graph</Badge>}
          {charge.isPrimary && <Badge variant="warning">Primary</Badge>}
          {charge.dismissed && <Badge variant="slate">Dismissed</Badge>}
        </div>
        {canRemove && <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-white/5" aria-label="Remove charge"><Trash2 size={15} /></button>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">California Code</label>
          <select className={field} value={charge.code} onChange={(e) => onPatch({ code: e.target.value, section: '', citation: undefined, title: undefined, classification: undefined, repositoryVerified: false, calcrimAvailable: false })}>
            <option value="">Select a code…</option>
            {codes.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code}) · {c.sectionCount}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="block text-xs text-slate-400 mb-1">Section</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={field + ' pl-9'}
              disabled={!charge.code}
              value={charge.section && !query ? `${charge.section}` : query}
              onChange={(e) => { setQuery(e.target.value); if (charge.section) onPatch({ section: '', repositoryVerified: false }); }}
              onFocus={() => results.length && setOpen(true)}
              placeholder={charge.code ? 'Type e.g. 459, 23152…' : 'Select a code first'}
            />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
          </div>
          {open && results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-navy-700 shadow-elevated">
              {results.map((s) => (
                <button key={`${s.code}-${s.section}`} type="button" onClick={() => selectSection(s)} className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gold-light">{s.citation}</span>
                    {s.classification !== 'UNKNOWN' && <span className="text-[10px] text-slate-400">{s.classification.replace(/_/g, ' ')}</span>}
                  </div>
                  {s.title && <p className="text-xs text-slate-400 truncate">{s.title}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {charge.loadingIntel && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading repository offense data…</p>}

      {(charge.repositoryVerified || charge.section) && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 text-xs space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Offense title</span><p className="text-slate-200">{charge.title || 'UNKNOWN'}</p></div>
            <div><span className="text-slate-500">Repository offense ID</span><p className="text-slate-300 font-mono">{charge.offenseId ? charge.offenseId.slice(0, 12) + '…' : 'UNKNOWN'}</p></div>
            <div><span className="text-slate-500">Classification</span><p className="text-slate-200">{charge.classification && charge.classification !== 'UNKNOWN' ? charge.classification.replace(/_/g, ' ') : 'UNKNOWN'}</p></div>
            <div><span className="text-slate-500">Elements / Defenses / CALCRIM</span><p className="text-slate-200">{charge.elementsCount ?? 0} / {charge.defensesCount ?? 0} / {charge.calcrimCount ?? 0}</p></div>
          </div>
          {charge.manualReview && <p className="text-amber-300 flex items-center gap-1"><AlertTriangle size={12} /> Manual review required.</p>}
          {charge.unknowns && charge.unknowns.length > 0 && <p className="text-slate-400">Repository notes: {charge.unknowns.join('; ')}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Count Number</label>
          <input type="number" min={1} className={field} value={charge.countNumber ?? ''} onChange={(e) => onPatch({ countNumber: e.target.value ? parseInt(e.target.value, 10) : undefined })} placeholder={String(index + 1)} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <input className={field} value={charge.notes ?? ''} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Charge notes…" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        {([['isPrimary', 'Primary charge'], ['isAttempt', 'Attempt'], ['isEnhancement', 'Enhancement'], ['dismissed', 'Dismissed']] as const).map(([k, lbl]) => (
          <label key={k} className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input type="checkbox" checked={!!charge[k]} onChange={(e) => onPatch({ [k]: e.target.checked })} className="accent-gold-light" />
            {lbl}
          </label>
        ))}
      </div>
    </div>
  );
}
