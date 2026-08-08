// ============================================================================
// Statutory intelligence.
//
// Look up any section of any California code and see what the Legislature
// actually publishes: the text, its place in the code, the act that last
// amended it, and what the compiler read out of it. Every panel links back to
// the official page so the reader can check it rather than trust this.
// ============================================================================

import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, ExternalLink, Loader2, RefreshCw, Scale, Search } from 'lucide-react';
import { authorizedFetch, describeFailure } from '../../services/session';

interface Compilation {
  kind: string;
  kindBasis: string;
  subdivisions: Array<{ label: string; text: string }>;
  mentalStates: Array<{ mentalState: string; basis: string | null; confidence: number }>;
  crossReferences: Array<{ phrase: string; code: string; section: string; kind: string }>;
  definedTerms: Array<{ term: string; definition: string }>;
  punishments: string[];
  exceptions: string[];
  unknowns: Array<{ field: string; reason: string }>;
}

interface Statute {
  code: string;
  section: string;
  officialUrl: string;
  status: string;
  text: string;
  fingerprint: string;
  legislativeNote: string | null;
  hierarchy: Array<{ level: string; heading: string }>;
  compilation: Compilation | null;
  retrievedAt: string;
  source: 'cache' | 'official';
}

interface EngineStatus {
  officialSource: string;
  codesAvailable: number;
  codes: Record<string, string>;
  cache: {
    statutesCached: number;
    currentVersions: number;
    supersededVersions: number;
    cacheHits: number;
    legislativeChangesDetected: number;
    byCode: Record<string, number>;
    compilerVersion: string;
    extractionVersion: string;
  };
  calcrim: { mappings: number; sections: string[] };
}

async function get<T>(path: string): Promise<T> {
  const res = await authorizedFetch(path);
  const body = await res.text();
  if (!res.ok) throw new Error(await describeFailure(res, body));
  return JSON.parse(body) as T;
}

export function StatutoryIntelligence() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [code, setCode] = useState('PEN');
  const [section, setSection] = useState('459');
  const [statute, setStatute] = useState<Statute | null>(null);
  const [calcrim, setCalcrim] = useState<{ status: string; instruction: string | null; reason: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void get<EngineStatus>('/api/law/status').then(setStatus).catch(() => {});
  }, []);

  const lookup = async (refresh = false) => {
    setLoading(true);
    setError(null);
    setStatute(null);
    setCalcrim(null);
    try {
      const result = await get<{ statute: Statute }>(
        `/api/law/statute/${encodeURIComponent(code)}/${encodeURIComponent(section)}${refresh ? '?refresh=true' : ''}`,
      );
      setStatute(result.statute);
      await get<{ calcrim: typeof calcrim }>(`/api/law/calcrim/${encodeURIComponent(code)}/${encodeURIComponent(section)}`)
        .then((r) => setCalcrim(r.calcrim))
        .catch(() => {});
      void get<EngineStatus>('/api/law/status').then(setStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The section could not be retrieved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="statutory-intelligence">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Scale size={20} className="text-indigo-600" /> Statutory Intelligence
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          California law read from{' '}
          <a href="https://leginfo.legislature.ca.gov/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            leginfo.legislature.ca.gov
          </a>
          , the Legislature's own publication. Nothing here is a stored definition.
        </p>
      </div>

      {/* Lookup ------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Code</span>
            <select
              data-testid="law-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
            >
              {Object.entries(status?.codes ?? { PEN: 'Penal Code' }).map(([abbr, name]) => (
                <option key={abbr} value={abbr}>
                  {name} ({abbr})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Section</span>
            <input
              data-testid="law-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void lookup()}
              className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
            />
          </label>
          <button
            data-testid="law-lookup"
            onClick={() => void lookup()}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Retrieve
          </button>
          <button
            onClick={() => void lookup(true)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            title="Re-read from the official source rather than the cache"
          >
            <RefreshCw size={14} /> Refresh from source
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2" data-testid="law-error">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-900">{error}</p>
        </div>
      )}

      {/* Statute ----------------------------------------------------------- */}
      {statute && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="law-result">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">
                {statute.code} {statute.section}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {statute.hierarchy.map((h) => h.heading).join(' › ')}
              </p>
            </div>
            <a
              href={statute.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Official source <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
            <Fact label="Legislative version" value={statute.legislativeNote ?? 'Not published'} />
            <Fact label="Fingerprint" value={statute.fingerprint.slice(0, 20)} mono />
            <Fact label="Retrieved" value={new Date(statute.retrievedAt).toLocaleString()} />
            <Fact label="Served from" value={statute.source === 'cache' ? 'verified cache' : 'official source'} />
          </div>

          {statute.status === 'repealed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              This section has been repealed. It cannot support a charge.
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Statutory text as published</p>
            <pre className="text-xs text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-72 overflow-auto font-sans">
              {statute.text}
            </pre>
          </div>

          {statute.compilation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="Provision">
                <p className="text-sm text-gray-900 capitalize">{statute.compilation.kind.replace('_', ' ')}</p>
                <p className="text-xs text-gray-500 mt-1">{statute.compilation.kindBasis}</p>
              </Panel>

              <Panel title="Mental state">
                {statute.compilation.mentalStates.map((m, i) => (
                  <div key={i} className="mb-2">
                    <p className="text-sm text-gray-900 capitalize">{m.mentalState.replace('_', ' ')}</p>
                    {m.basis && <p className="text-xs text-gray-500 mt-0.5 italic">“{m.basis}”</p>}
                  </div>
                ))}
              </Panel>

              {statute.compilation.crossReferences.length > 0 && (
                <Panel title={`Depends on ${statute.compilation.crossReferences.length} other section(s)`}>
                  <ul className="text-xs space-y-1">
                    {statute.compilation.crossReferences.map((x, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            setCode(x.code);
                            setSection(x.section.replace(/\.$/, ''));
                          }}
                          className="text-indigo-600 hover:underline font-mono"
                        >
                          {x.code} {x.section}
                        </button>
                        <span className="text-gray-500"> — {x.kind}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {statute.compilation.definedTerms.length > 0 && (
                <Panel title="Terms this section defines">
                  {statute.compilation.definedTerms.map((d, i) => (
                    <p key={i} className="text-xs mb-1">
                      <span className="font-medium text-gray-900">{d.term}</span>{' '}
                      <span className="text-gray-600">{d.definition.slice(0, 200)}</span>
                    </p>
                  ))}
                </Panel>
              )}

              {calcrim && (
                <Panel title="CALCRIM">
                  {calcrim.status === 'mapped' ? (
                    <p className="text-sm text-gray-900">{calcrim.instruction}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">UNKNOWN</p>
                      <p className="text-xs text-gray-500 mt-1">{calcrim.reason}</p>
                    </>
                  )}
                </Panel>
              )}

              {statute.compilation.unknowns.length > 0 && (
                <Panel title="Not determined from the text">
                  {statute.compilation.unknowns.map((u, i) => (
                    <p key={i} className="text-xs mb-1.5">
                      <span className="font-medium text-gray-900">{u.field}</span>{' '}
                      <span className="text-gray-600">{u.reason}</span>
                    </p>
                  ))}
                </Panel>
              )}
            </div>
          )}
        </div>
      )}

      {/* Engine status ------------------------------------------------------ */}
      {status && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <BookOpen size={16} /> Engine
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <Fact label="Codes reachable" value={String(status.codesAvailable)} />
            <Fact label="Sections cached" value={String(status.cache.currentVersions)} />
            <Fact label="Superseded versions" value={String(status.cache.supersededVersions)} />
            <Fact label="Cache hits" value={String(status.cache.cacheHits)} />
            <Fact label="Changes detected" value={String(status.cache.legislativeChangesDetected)} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Compiler {status.cache.compilerVersion}, extraction {status.cache.extractionVersion}.{' '}
            {status.calcrim.mappings} verified CALCRIM correspondences; a charge outside them returns UNKNOWN.
          </p>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-gray-900 mt-0.5 ${mono ? 'font-mono text-[11px]' : 'text-xs'}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-700 mb-2">{title}</p>
      {children}
    </div>
  );
}

export default StatutoryIntelligence;
