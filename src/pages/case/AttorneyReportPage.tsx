// ============================================================================
// CourtAccess — Canonical Premium Attorney Report (Program 88)
// Flagship, repository-backed litigation report. Every section is derived from
// the canonical GET /api/cases/:caseId/attorney-report endpoint. Nothing is
// fabricated: UNKNOWN is displayed wherever repository evidence is insufficient.
// Supports browser view, print layout, and PDF export (browser Save-as-PDF).
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Printer, RefreshCw, AlertTriangle, ShieldCheck, Scale, FileText, Users,
  FolderOpen, Clock, Network, BookOpen, Gauge, Lightbulb, History, Fingerprint, ArrowLeft, Gavel,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { fetchAttorneyReport, type AttorneyReport, type Confidence, type ReportFinding } from '../../services/attorneyReportApi';

const SECTIONS = [
  { id: 'executive-summary', label: 'Executive Summary', icon: ShieldCheck },
  { id: 'case-overview', label: 'Case Overview', icon: FileText },
  { id: 'charges', label: 'Charge Analysis', icon: Scale },
  { id: 'evidence', label: 'Evidence Analysis', icon: FileText },
  { id: 'witnesses', label: 'Witness Analysis', icon: Users },
  { id: 'discovery', label: 'Discovery Analysis', icon: FolderOpen },
  { id: 'timeline', label: 'Timeline Analysis', icon: Clock },
  { id: 'knowledge-graph', label: 'Knowledge Graph', icon: Network },
  { id: 'authorities', label: 'Authority Analysis', icon: BookOpen },
  { id: 'analysis', label: 'Case Analysis', icon: Gauge },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'audit-trail', label: 'Audit Trail', icon: History },
];

function isUnknown(v: string | null | undefined): boolean {
  return !v || v === 'UNKNOWN' || v.startsWith('UNKNOWN');
}

function Val({ value }: { value: string | null | undefined }) {
  if (isUnknown(value)) return <span className="text-amber-400/90 font-medium">UNKNOWN</span>;
  return <span className="text-slate-100">{value}</span>;
}

function ConfidenceBadge({ c }: { c?: Confidence }) {
  if (!c) return null;
  const map: Record<string, { v: 'success' | 'warning' | 'danger' | 'amber' | 'emerald' | 'slate' | 'gold'; t: string }> = {
    HIGH: { v: 'emerald', t: 'HIGH' },
    MEDIUM: { v: 'amber', t: 'MEDIUM' },
    LOW: { v: 'warning', t: 'LOW' },
    UNKNOWN: { v: 'slate', t: 'UNKNOWN' },
    'repository-confirmed': { v: 'emerald', t: 'REPOSITORY-CONFIRMED' },
    'manual-review': { v: 'amber', t: 'MANUAL REVIEW' },
  };
  const m = map[c] ?? { v: 'slate' as const, t: c };
  return <Badge variant={m.v}>{m.t}</Badge>;
}

function Section({ id, title, icon: Icon, meta, children }: { id: string; title: string; icon: React.ElementType; meta?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="report-section scroll-mt-24 ca-panel p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl ca-gradient-gold flex items-center justify-center text-navy shadow-gold">
            <Icon className="w-5 h-5" />
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-50 tracking-tight">{title}</h2>
        </div>
        {meta && <span className="text-xs text-slate-400 font-medium hidden md:inline">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function KV({ label, value, confidence }: { label: string; value: string | null | undefined; confidence?: Confidence }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-navy-800/50 border border-white/5 px-4 py-3">
      <span className="ca-overline text-[10px]">{label}</span>
      <span className="text-sm flex items-center gap-2 flex-wrap"><Val value={value} />{confidence && <ConfidenceBadge c={confidence} />}</span>
    </div>
  );
}

function Citations({ items }: { items: { type: string; id: string; label?: string }[] }) {
  if (!items || items.length === 0) return <span className="text-xs text-amber-400/80">No citation — UNKNOWN</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.slice(0, 8).map((c, i) => (
        <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-navy-700/70 border border-white/10 text-slate-300 font-mono">
          {c.type}:{(c.label ?? c.id).slice(0, 22)}
        </span>
      ))}
      {items.length > 8 && <span className="text-[10px] text-slate-500">+{items.length - 8}</span>}
    </div>
  );
}

function FindingRow({ f }: { f: ReportFinding }) {
  return (
    <div className="rounded-xl bg-navy-800/40 border border-white/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs ca-overline text-[10px]">{f.label}</div>
          <div className="text-sm text-slate-100 mt-0.5">{f.value}</div>
          {f.note && <div className="text-xs text-slate-400 mt-1">{f.note}</div>}
        </div>
        <div className="flex-shrink-0"><ConfidenceBadge c={f.confidence} /></div>
      </div>
      <Citations items={f.citations} />
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-slate-400 italic">{text}</p>;
}

export function AttorneyReportPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [report, setReport] = useState<AttorneyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setReport(await fetchAttorneyReport(caseId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attorney report');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);

  const generatedLabel = useMemo(
    () => (report ? new Date(report.generatedAt).toLocaleString() : ''),
    [report],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold-light" />
        <p>Assembling repository-backed attorney report…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <div>
          <p className="text-lg font-semibold text-slate-100">Unable to generate report</p>
          <p className="text-sm text-slate-400 mt-1">{error ?? 'No report data available.'}</p>
        </div>
        <Button onClick={() => void load()} variant="secondary"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
      </div>
    );
  }

  const es = report.executiveSummary;
  const co = report.caseOverview;

  return (
    <div className="report-root max-w-6xl mx-auto pb-16">
      {/* ---- Print-only cover / branding ---- */}
      <div className="report-cover hidden print:block mb-8">
        <div className="text-3xl font-bold tracking-tight">CourtAccess</div>
        <div className="ca-overline mt-1">Truth · Evidence · Justice</div>
        <h1 className="text-4xl font-bold mt-8">Attorney Report</h1>
        <p className="text-lg mt-2">{es.caseTitle} · {es.caseNumber}</p>
        <p className="text-sm mt-6 text-slate-600">Generated {generatedLabel}</p>
        <p className="text-xs mt-1 text-slate-500 font-mono">Reproducibility hash: {report.reproducibilityHash.slice(0, 32)}…</p>
        <p className="text-xs mt-8 text-slate-500 max-w-xl">Every section of this report is derived from repository-backed intelligence. UNKNOWN is shown wherever repository evidence is insufficient. This report does not constitute legal advice or a legal conclusion.</p>
      </div>

      {/* ---- Screen header hero ---- */}
      <div className="print:hidden mb-6">
        <Link to={`/cases/${caseId}/overview`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to case overview
        </Link>
        <div className="ca-panel p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.06] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="ca-overline">Canonical Attorney Report · v{report.reportVersion}</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mt-1 tracking-tight truncate">{es.caseTitle}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="gold">{es.caseNumber}</Badge>
                <Badge variant="navy">{es.status}</Badge>
                <Badge variant="slate">{es.phase}</Badge>
                <span className="text-xs text-slate-400">Generated {generatedLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />Regenerate</Button>
              <Button variant="primary" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Export PDF / Print</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Table of contents ---- */}
      <nav className="report-toc ca-panel p-5 mb-8">
        <div className="ca-overline mb-3">Table of Contents</div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm list-decimal list-inside">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-slate-300 hover:text-gold-light transition-colors">{s.label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {/* ===== 1. Executive Summary ===== */}
        <Section id="executive-summary" title="Executive Summary" icon={ShieldCheck} meta={`Repository ${es.repositoryVersion}`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KV label="Case Title" value={es.caseTitle} />
            <KV label="Case Number" value={es.caseNumber} />
            <KV label="Court" value={es.court} />
            <KV label="Judge" value={es.judge} />
            <KV label="Status" value={es.status} />
            <KV label="Repository Version" value={es.repositoryVersion} />
            <KV label="Knowledge Graph" value={es.knowledgeGraphStatus} />
            <KV label="Repository Integrity" value={es.repositoryIntegrity} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { l: 'Charges', v: es.chargeCount },
              { l: 'Evidence', v: es.evidenceCount },
              { l: 'Witnesses', v: es.witnessCount },
              { l: 'Discovery', v: es.discoveryCount },
              { l: 'Timeline Events', v: es.timelineEventCount },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-navy-800/60 border border-white/5 px-4 py-3 text-center">
                <div className="text-2xl font-bold text-gold-light">{s.v}</div>
                <div className="ca-overline text-[10px] mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== 2. Case Overview ===== */}
        <Section id="case-overview" title="Case Overview" icon={FileText}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KV label="Client" value={co.client} />
            <KV label="Jurisdiction" value={co.jurisdiction} />
            <KV label="County" value={co.county} />
            <KV label="Case Type" value={co.caseType} />
            <KV label="Prosecutor" value={co.prosecutor} />
            <KV label="Defense Team" value={co.defenseTeam.length ? co.defenseTeam.join(', ') : 'UNKNOWN'} />
            <KV label="Filing Date" value={co.filingDate ? new Date(co.filingDate).toLocaleDateString() : 'UNKNOWN'} />
            <KV label="Trial Date" value={co.trialDate ? new Date(co.trialDate).toLocaleDateString() : 'UNKNOWN'} />
            <KV label="Next Hearing" value={co.nextHearing ? new Date(co.nextHearing).toLocaleString() : 'UNKNOWN'} />
          </div>
          {co.notes && <p className="text-sm text-slate-300 mt-4 rounded-xl bg-navy-800/40 border border-white/5 px-4 py-3">{co.notes}</p>}
        </Section>

        {/* ===== 3. Charge Analysis ===== */}
        <Section id="charges" title="Charge Analysis" icon={Scale} meta={`${report.charges.length} charge(s)`}>
          {report.charges.length === 0 ? (
            <EmptyNote text="No charges recorded for this case — charge analysis is UNKNOWN." />
          ) : (
            <div className="space-y-5">
              {report.charges.map((c) => (
                <div key={c.chargeId} className="rounded-2xl border border-white/10 bg-navy-800/40 p-5 report-charge">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-slate-50">{c.code} {c.section}</span>
                        {c.isPrimary && <Badge variant="gold">PRIMARY</Badge>}
                        {c.isEnhancement && <Badge variant="amber">ENHANCEMENT</Badge>}
                        {c.dismissed && <Badge variant="slate">DISMISSED</Badge>}
                        {c.countNumber != null && <Badge variant="navy">Count {c.countNumber}</Badge>}
                      </div>
                      <div className="text-sm text-slate-300 mt-1"><Val value={c.offenseTitle} /></div>
                    </div>
                    <ConfidenceBadge c={c.repositoryConfidence} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <KV label="Classification" value={c.classification} />
                    <KV label="Repository Offense ID" value={c.offenseId} />
                    <KV label="Repository Verified" value={c.repositoryVerified ? 'yes' : 'UNKNOWN'} />
                    <KV label="Manual Review" value={c.manualReviewRequired ? 'required' : 'not flagged'} />
                  </div>

                  {/* Elements */}
                  <div className="mt-4">
                    <div className="ca-overline text-[10px] mb-2">Elements</div>
                    {c.elements.length === 0 ? <EmptyNote text="No repository elements — UNKNOWN." /> : (
                      <div className="space-y-1.5">
                        {c.elements.map((el, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 text-sm rounded-lg bg-navy-900/40 px-3 py-2">
                            <span className="text-slate-200">{el.label}{el.required && <span className="text-gold-light ml-1">*</span>}</span>
                            <span className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-slate-400">{el.status}</span>
                              <ConfidenceBadge c={el.confidence} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <ChargeList title="Mens Rea" items={c.mensRea.map((m) => `${m.type}${m.terms.length ? ` (${m.terms.join(', ')})` : ''}`)} />
                    <ChargeList title="CALCRIM" items={c.calcrim.map((k) => `${k.instructionNumber} — ${k.title}`)} />
                    <ChargeList title="Known Enhancements" items={c.enhancements} />
                    <ChargeList title="Known Defenses" items={c.defenses} />
                    <ChargeList title="Known Exceptions" items={c.exceptions} />
                    <ChargeList title="Known Immunities" items={c.immunities} />
                    <ChargeList title="Sentencing References" items={c.sentencing} />
                    <ChargeList title="Authorities" items={c.authorities.map((a) => `${a.type}: ${a.citation}`)} />
                  </div>

                  {c.unknowns.length > 0 && (
                    <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                      <div className="ca-overline text-[10px] text-amber-400 mb-1">Open Repository Questions</div>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                        {c.unknowns.slice(0, 6).map((u, i) => <li key={i}>{u}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ===== 4. Evidence Analysis ===== */}
        <Section id="evidence" title="Evidence Analysis" icon={FileText} meta={`${report.evidence.total} item(s) · ${report.evidence.hashCoverage}`}>
          {report.evidence.total === 0 ? (
            <EmptyNote text="No evidence uploaded — evidence analysis is UNKNOWN." />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KV label="Total" value={String(report.evidence.total)} />
                <KV label="Hash Coverage" value={report.evidence.hashCoverage} />
                <KV label="Processing Pending" value={String(report.evidence.processingPending)} />
                <KV label="Duplicates" value={String(report.evidence.duplicates.length)} />
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm report-table">
                  <thead className="bg-navy-800/70 text-slate-300">
                    <tr>
                      {['File', 'Type', 'SHA-256', 'OCR / Processing', 'Chain of Custody', 'Timeline', 'Confidence'].map((h) => (
                        <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.evidence.items.map((e) => (
                      <tr key={e.evidenceId} className="border-t border-white/5">
                        <td className="px-3 py-2 text-slate-100 max-w-[220px] truncate">{e.fileName}</td>
                        <td className="px-3 py-2 text-slate-300">{e.evidenceType}</td>
                        <td className="px-3 py-2 font-mono text-xs">{e.sha256 ? e.sha256.slice(0, 12) + '…' : <span className="text-amber-400">UNKNOWN</span>}</td>
                        <td className="px-3 py-2 text-slate-300">{e.processingStatus}</td>
                        <td className="px-3 py-2">{isUnknown(e.chainOfCustody) ? <span className="text-amber-400">UNKNOWN</span> : e.chainOfCustody}</td>
                        <td className="px-3 py-2">{e.timelineLinked ? <Badge variant="emerald">linked</Badge> : <span className="text-slate-500 text-xs">—</span>}</td>
                        <td className="px-3 py-2"><ConfidenceBadge c={e.confidence} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.evidence.duplicates.length > 0 && (
                <div className="mt-4">
                  <div className="ca-overline text-[10px] mb-2">Potential Duplicate Evidence</div>
                  {report.evidence.duplicates.map((d, i) => (
                    <div key={i} className="text-xs text-slate-300 rounded-lg bg-navy-800/40 px-3 py-2 mb-1">{d.reason}: {d.evidenceIds.join(', ')}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ===== 5. Witness Analysis ===== */}
        <Section id="witnesses" title="Witness Analysis" icon={Users} meta={`${report.witnesses.total} witness(es)`}>
          {report.witnesses.total === 0 ? (
            <EmptyNote text="No witnesses recorded — witness analysis is UNKNOWN." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm report-table">
                <thead className="bg-navy-800/70 text-slate-300">
                  <tr>{['Name', 'Type', 'Role / Agency', 'Status', 'Interview', 'Credibility', 'Repository Support'].map((h) => <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.witnesses.items.map((w) => (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-100">{w.name}</td>
                      <td className="px-3 py-2"><Val value={w.witnessType} /></td>
                      <td className="px-3 py-2 text-slate-300">{[isUnknown(w.role) ? null : w.role, w.agency].filter(Boolean).join(' · ') || <span className="text-amber-400">UNKNOWN</span>}</td>
                      <td className="px-3 py-2 text-slate-300">{w.status}</td>
                      <td className="px-3 py-2 text-slate-300">{w.interviewStatus}</td>
                      <td className="px-3 py-2"><Val value={w.credibilityStatus} /></td>
                      <td className="px-3 py-2"><Val value={w.repositorySupport} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.witnesses.gaps.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="ca-overline text-[10px]">Witness Gaps (repository-derived)</div>
              {report.witnesses.gaps.map((f) => <FindingRow key={f.id} f={f} />)}
            </div>
          )}
        </Section>

        {/* ===== 6. Discovery Analysis ===== */}
        <Section id="discovery" title="Discovery Analysis" icon={FolderOpen} meta={`${report.discovery.total} item(s)`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <KV label="Total" value={String(report.discovery.total)} />
            <KV label="Received" value={String(report.discovery.received)} />
            <KV label="Potential Brady" value={String(report.discovery.bradyCount)} />
            <KV label="Potential Giglio" value={String(report.discovery.giglioCount)} />
            <KV label="Potential Jencks" value={String(report.discovery.jencksCount)} />
          </div>
          <p className="text-xs text-amber-400/80 mb-3">Brady / Giglio / Jencks classifications are attorney-entered flags requiring human review — never auto-determined.</p>
          {report.discovery.total === 0 ? (
            <EmptyNote text="No discovery items recorded — discovery analysis is UNKNOWN." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm report-table">
                <thead className="bg-navy-800/70 text-slate-300">
                  <tr>{['Title', 'Category', 'Source', 'Received', 'Review', 'Flags'].map((h) => <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.discovery.items.map((d) => (
                    <tr key={d.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-100 max-w-[220px] truncate">{d.title}</td>
                      <td className="px-3 py-2 text-slate-300">{d.category}</td>
                      <td className="px-3 py-2 text-slate-300">{d.sourceAgency || <span className="text-amber-400">UNKNOWN</span>}</td>
                      <td className="px-3 py-2 text-slate-300">{d.receivedDate ? new Date(d.receivedDate).toLocaleDateString() : <span className="text-amber-400">UNKNOWN</span>}</td>
                      <td className="px-3 py-2 text-slate-300">{d.reviewStatus}</td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {d.bradyFlag && <Badge variant="danger">Brady</Badge>}
                          {d.giglioFlag && <Badge variant="warning">Giglio</Badge>}
                          {d.jencksFlag && <Badge variant="amber">Jencks</Badge>}
                          {!d.bradyFlag && !d.giglioFlag && !d.jencksFlag && <span className="text-slate-500 text-xs">—</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ===== 7. Timeline Analysis ===== */}
        <Section id="timeline" title="Timeline Analysis" icon={Clock} meta={`${report.timeline.eventCount} event(s) · ${report.timeline.conflictCount} conflict(s)`}>
          {report.timeline.eventCount === 0 ? (
            <EmptyNote text="No timeline events recorded — timeline analysis is UNKNOWN." />
          ) : (
            <div className="space-y-2">
              {report.timeline.events.slice(0, 60).map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-lg bg-navy-800/40 px-3 py-2 border border-white/5">
                  <div className="w-40 flex-shrink-0 text-xs text-slate-400">
                    {t.timestamp ? new Date(t.timestamp).toLocaleString() : (t.timeText || <span className="text-amber-400">UNKNOWN</span>)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{t.description}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{[t.actor, t.location, t.sourceType].filter(Boolean).join(' · ')}</div>
                  </div>
                  {t.conflictFlag && <Badge variant="danger">conflict</Badge>}
                </div>
              ))}
              {report.timeline.events.length > 60 && <p className="text-xs text-slate-500">Showing first 60 of {report.timeline.events.length} events.</p>}
            </div>
          )}
          {report.timeline.gaps.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="ca-overline text-[10px]">Timeline Gaps (repository-derived)</div>
              {report.timeline.gaps.map((f) => <FindingRow key={f.id} f={f} />)}
            </div>
          )}
        </Section>

        {/* ===== 8. Knowledge Graph ===== */}
        <Section id="knowledge-graph" title="Knowledge Graph" icon={Network} meta={`status: ${report.knowledgeGraph.status}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KV label="Status" value={report.knowledgeGraph.status} />
            <KV label="Nodes" value={String(report.knowledgeGraph.nodeCount)} />
            <KV label="Edges" value={String(report.knowledgeGraph.edgeCount)} />
            <KV label="Node Types" value={String(Object.keys(report.knowledgeGraph.byType).length)} />
          </div>
          {Object.keys(report.knowledgeGraph.byType).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(report.knowledgeGraph.byType).map(([t, n]) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-lg bg-navy-800/60 border border-white/10 text-slate-300">{t}: <span className="text-gold-light font-semibold">{n}</span></span>
              ))}
            </div>
          )}
          <Link to={`/cases/${caseId}/knowledge-graph`} className="print:hidden inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline mt-4">
            <Network className="w-4 h-4" /> Open interactive knowledge graph
          </Link>
        </Section>

        {/* ===== 9. Authority Analysis ===== */}
        <Section id="authorities" title="Authority Analysis" icon={BookOpen}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="ca-overline text-[10px] mb-2">California Statutes</div>
              {report.authorities.statutes.length === 0 ? <EmptyNote text="UNKNOWN — no repository statute match." /> : (
                <ul className="text-sm text-slate-200 space-y-1">
                  {report.authorities.statutes.map((s, i) => <li key={i}>{s.code} {s.section} — {s.title}</li>)}
                </ul>
              )}
            </div>
            <div>
              <div className="ca-overline text-[10px] mb-2">CALCRIM References</div>
              {report.authorities.calcrim.length === 0 ? <EmptyNote text="UNKNOWN — no derived CALCRIM links." /> : (
                <ul className="text-sm text-slate-200 space-y-1">
                  {report.authorities.calcrim.map((c, i) => <li key={i}>{c.instructionNumber} — {c.title}</li>)}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="ca-overline text-[10px] mb-2">Provider Availability</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {report.authorities.providerAvailability.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-navy-800/40 px-3 py-2 border border-white/5">
                  <span className="text-slate-300">{p.provider}</span>
                  <Val value={p.status} />
                </div>
              ))}
            </div>
          </div>
          {report.authorities.citations.length > 0 && (
            <div className="mt-4">
              <div className="ca-overline text-[10px] mb-2">Repository Citations</div>
              <ul className="text-sm text-slate-200 space-y-1">
                {report.authorities.citations.slice(0, 20).map((c, i) => <li key={i}>{c.type}: {c.citation}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* ===== 10. Case Analysis ===== */}
        <Section id="analysis" title="Case Analysis" icon={Gauge}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <FindingRow f={report.analysis.caseStrength} />
            <FindingRow f={report.analysis.evidenceConfidence} />
            <FindingRow f={report.analysis.repositoryCompleteness} />
          </div>
          <AnalysisGroup title="Missing Elements" items={report.analysis.missingElements} empty="No missing elements detected in the repository element matrices." />
          <AnalysisGroup title="Contradictions" items={report.analysis.contradictions} empty="No repository-backed contradictions detected." />
          <AnalysisGroup title="Repository Gaps" items={report.analysis.repositoryGaps} empty="No repository gaps flagged." />
          {report.analysis.humanReviewItems.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
              <div className="ca-overline text-[10px] text-amber-400 mb-1">Human Review Required</div>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                {report.analysis.humanReviewItems.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* ===== 11. Recommendations ===== */}
        <Section id="recommendations" title="Recommendations" icon={Lightbulb}>
          <p className="text-xs text-amber-400/80 mb-4">Recommendations are repository-derived prompts for attorney action — not legal strategy or conclusions.</p>
          <AnalysisGroup title="Additional Evidence Needed" items={report.recommendations.additionalEvidence} empty="No additional evidence needs flagged by the repository." />
          <AnalysisGroup title="Witness Follow-up" items={report.recommendations.witnessFollowUp} empty="No witness follow-up flagged." />
          <AnalysisGroup title="Discovery Requests" items={report.recommendations.discoveryRequests} empty="No discovery requests flagged." />
          <AnalysisGroup title="Repository Research" items={report.recommendations.repositoryResearch} empty="No repository research flagged." />
          <AnalysisGroup title="Potential Motion Topics" items={report.recommendations.potentialMotionTopics} empty="No potential motion topics flagged." />
          <Link to={`/cases/${caseId}/motions`} className="print:hidden inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline mt-3">
            <Gavel className="w-4 h-4" /> Draft a motion in the Motion Builder
          </Link>
          {report.recommendations.manualReview.length > 0 && (
            <div className="mt-4 rounded-xl bg-navy-800/40 border border-white/5 px-4 py-3">
              <div className="ca-overline text-[10px] mb-1">Manual Review</div>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                {report.recommendations.manualReview.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* ===== 12. Audit Trail ===== */}
        <Section id="audit-trail" title="Audit Trail" icon={History} meta={report.reproducibilityHash.slice(0, 16) + '…'}>
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-300">
            <Fingerprint className="w-4 h-4 text-gold-light" />
            <span className="font-mono text-xs break-all">Reproducibility hash: {report.reproducibilityHash}</span>
          </div>
          <div className="space-y-1.5">
            {report.auditTrail.slice(0, 40).map((a, i) => (
              <div key={i} className="text-xs rounded-lg bg-navy-800/40 border border-white/5 px-3 py-2">
                <span className="text-slate-500">{new Date(a.generatedAt).toLocaleString()}</span>
                <span className="text-gold-light mx-2">{a.source}</span>
                <span className="text-slate-300">{a.reasoning}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <p className="report-footer text-center text-xs text-slate-500 mt-10">
        CourtAccess · Canonical Attorney Report v{report.reportVersion} · Generated {generatedLabel} · Repository-backed · Not legal advice
      </p>
    </div>
  );
}

function ChargeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="ca-overline text-[10px] mb-1.5">{title}</div>
      {items.length === 0 ? (
        <span className="text-xs text-amber-400/80">UNKNOWN</span>
      ) : (
        <ul className="text-sm text-slate-200 space-y-0.5 list-disc list-inside">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  );
}

function AnalysisGroup({ title, items, empty }: { title: string; items: ReportFinding[]; empty: string }) {
  return (
    <div className="mt-4">
      <div className="ca-overline text-[10px] mb-2">{title} <span className="text-slate-500">({items.length})</span></div>
      {items.length === 0 ? <EmptyNote text={empty} /> : (
        <div className="space-y-2">{items.map((f) => <FindingRow key={f.id} f={f} />)}</div>
      )}
    </div>
  );
}
