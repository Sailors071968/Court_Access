// ============================================================================
// CourtAccess — Knowledge Graph & Litigation Intelligence (Program 75)
// Premium litigation-intelligence workspace over the real, evidence-governed
// case knowledge graph. Interactive graph (pan/zoom/drag/select/filter),
// coverage stats, node-type legend/filters, search, node detail, export JSON.
// Every node/edge originates from the backend builder — never fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Search, Download, RefreshCw, Network, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Icon } from '../../components/icons/registry';
import { KnowledgeGraphWorkspace } from '../../components/graph/KnowledgeGraphWorkspace';
import { NODE_META, type GraphNodeType, type KnowledgeGraphData } from '../../components/graph/types';
import {
  fetchCaseKnowledgeGraph, mapToGraphData, type CaseKnowledgeGraphResponse,
} from '../../services/knowledgeGraphApi';

export function KnowledgeGraphPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [raw, setRaw] = useState<CaseKnowledgeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<Set<GraphNodeType>>(new Set());

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setRaw(await fetchCaseKnowledgeGraph(caseId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  const full = useMemo<KnowledgeGraphData | null>(() => (raw ? mapToGraphData(raw) : null), [raw]);

  // Apply node-type filter; edges are pruned to visible nodes.
  const data = useMemo<KnowledgeGraphData | null>(() => {
    if (!full) return null;
    const nodes = full.nodes.filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: full.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
  }, [full, hidden]);

  const highlightIds = useMemo(() => {
    if (!data || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return data.nodes.filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) || (n.repositorySource ?? '').toLowerCase().includes(q)).map((n) => n.id);
  }, [data, query]);

  const typeCounts = useMemo(() => {
    const m = new Map<GraphNodeType, number>();
    for (const n of full?.nodes ?? []) m.set(n.type, (m.get(n.type) ?? 0) + 1);
    return m;
  }, [full]);

  const toggleType = (t: GraphNodeType) =>
    setHidden((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const exportJson = () => {
    if (!raw) return;
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `knowledge-graph-${caseId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const nodeCount = full?.nodes.length ?? 0;
  const edgeCount = full?.edges.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Litigation Intelligence"
        title="Knowledge Graph"
        subtitle="Every charge, person, evidence item, authority, and timeline event — interconnected and evidence-governed."
        action={
          <div className="flex items-center gap-2">
            <button onClick={exportJson} disabled={!raw} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-50"><Download size={15} /> Export JSON</button>
            <button onClick={load} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        }
      />

      {/* Coverage summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          ['Nodes', nodeCount, 'knowledgeGraph'],
          ['Relationships', edgeCount, 'timeline'],
          ['Charges', typeCounts.get('charge') ?? 0, 'statutes'],
          ['Evidence', typeCounts.get('evidence') ?? 0, 'evidence'],
          ['Authorities', (typeCounts.get('authority') ?? 0) + (typeCounts.get('statute') ?? 0) + (typeCounts.get('calcrim') ?? 0), 'authorities'],
          ['Timeline', typeCounts.get('timeline_event') ?? 0, 'timeline'],
        ] as const).map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ca-icon-gold text-gold-light"><Icon name={icon as never} size={16} /></span>
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search + legend/filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes (name, ID, repository)…" className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).map(([t, c]) => {
            const meta = NODE_META[t];
            const off = hidden.has(t);
            return (
              <button key={t} type="button" onClick={() => toggleType(t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${off ? 'border-white/10 bg-transparent text-slate-500' : 'border-white/10 bg-white/[0.03] text-slate-200'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: off ? '#475569' : meta.color }} />
                {meta.label} ({c})
              </button>
            );
          })}
        </div>
      </div>

      {loading && !raw ? (
        <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : error ? (
        <div className="ca-panel p-10 text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={28} />
          <p className="text-red-300">{error}</p>
        </div>
      ) : data && data.nodes.length > 0 ? (
        <KnowledgeGraphWorkspace data={data} height={620} highlightIds={highlightIds} />
      ) : (
        <div className="ca-panel p-12 text-center">
          <Network className="mx-auto text-slate-500 mb-3" size={32} />
          <p className="text-white font-semibold">No graph nodes yet</p>
          <p className="text-sm text-slate-400 mt-1">Add charges and evidence to this case — the knowledge graph builds automatically from repository-backed data. UNKNOWN until then.</p>
        </div>
      )}

      {highlightIds.length > 0 && <p className="text-xs text-gold-light">{highlightIds.length} node(s) match “{query}”.</p>}
    </div>
  );
}
