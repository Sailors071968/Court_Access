// ============================================================================
// Gold Standard Certification — administrator console.
//
// Walks an administrator from a folder of delivered discovery through import,
// inventory, classification, a certification run and regression comparison,
// without touching a command line. The server enforces that only
// administrators can reach any of it.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Archive, CheckCircle2, ChevronRight, Clock, Database,
  FileSearch, FolderInput, History, Loader2, PlayCircle, Scale, ShieldCheck, XCircle,
} from 'lucide-react';
import {
  certificationApi,
  type Inventory,
  type ImportResult,
  type ModuleStatus,
  type PreviewResult,
  type Regression,
  type RunHistoryEntry,
  type RunResult,
} from '../../services/certificationApi';

type Step = 'corpora' | 'import' | 'inventory' | 'results' | 'history';

const STEPS: Array<{ id: Step; label: string; icon: React.ReactNode }> = [
  { id: 'corpora', label: 'Corpora', icon: <Database size={15} /> },
  { id: 'import', label: 'Import', icon: <FolderInput size={15} /> },
  { id: 'inventory', label: 'Inventory', icon: <FileSearch size={15} /> },
  { id: 'results', label: 'Results', icon: <Scale size={15} /> },
  { id: 'history', label: 'History & Regression', icon: <History size={15} /> },
];

function bytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'bad' | 'good' }) {
  const colour =
    tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${colour}`}>{value}</p>
    </div>
  );
}

function Notice({ kind, title, children }: { kind: 'error' | 'warn' | 'info'; title: string; children?: React.ReactNode }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }[kind];
  const Icon = kind === 'error' ? XCircle : kind === 'warn' ? AlertTriangle : ShieldCheck;
  return (
    <div className={`border rounded-xl p-4 flex items-start gap-2 ${styles}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="text-xs mt-1 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function GoldStandardCertification() {
  const [step, setStep] = useState<Step>('corpora');
  const [status, setStatus] = useState<ModuleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sourceDirectory, setSourceDirectory] = useState('');
  const [reference, setReference] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await certificationApi.status());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the certification module.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const guard = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The operation failed.');
    } finally {
      setBusy(null);
    }
  };

  const openInventory = (id: string) =>
    guard('inventory', async () => {
      setSelectedCaseId(id);
      setInventory(await certificationApi.inventory(id));
      setStep('inventory');
    });

  const openHistory = (id: string) =>
    guard('history', async () => {
      setSelectedCaseId(id);
      const res = await certificationApi.runs(id);
      setHistory(res.runs);
      setStep('history');
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-indigo-600" />
            Gold Standard Certification
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Import authorized discovery, certify the platform against it, and compare every release to the last.
          </p>
        </div>
        {status && (
          <div className="text-right text-xs text-gray-500 flex-shrink-0">
            <p>{status.corpora} corpora · {status.totalRuns} runs</p>
            <p>{status.documentClasses} document classes</p>
          </div>
        )}
      </div>

      <Notice kind="info" title="Administrator-only module">
        Certification corpora contain real criminal discovery authorized for validation use. This module is not
        visible to attorneys, investigators, paralegals, defendants, family members, office administrators,
        experts or consultants. Imported originals are never modified.
      </Notice>

      {/* Step rail */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                step === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-0.5" />}
          </div>
        ))}
      </div>

      {error && <Notice kind="error" title="That did not work">{error}</Notice>}

      {/* ---------------------------------------------------------------- */}
      {step === 'corpora' && (
        <div className="space-y-4">
          {!status ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-10 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading certification corpora…
            </div>
          ) : status.cases.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
              <Database size={44} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-600 font-medium">No certification corpora yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Import the first authorized case to establish the baseline that future releases are measured against.
              </p>
              <button
                onClick={() => setStep('import')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Import certification case
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => setStep('import')}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  Import certification case
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Corpus</th>
                      <th className="px-4 py-3">Files</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Runs</th>
                      <th className="px-4 py-3">Fingerprint</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {status.cases.map((c) => (
                      <tr key={c.certificationCaseId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.reference}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{c.label}</p>
                          <p className="text-xs text-gray-500">{new Date(c.importedAt).toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{c.fileCount}</td>
                        <td className="px-4 py-3 text-gray-700">{bytes(Number(c.totalBytes))}</td>
                        <td className="px-4 py-3 text-gray-700">{c.runCount}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {c.corpusHash ? c.corpusHash.slice(0, 12) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => void openInventory(c.certificationCaseId)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3"
                          >
                            Inventory
                          </button>
                          <button
                            onClick={() => void openHistory(c.certificationCaseId)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 'import' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Import certification case</h2>
              <p className="text-sm text-gray-500 mt-1">
                Point at the folder holding the discovery exactly as counsel delivered it. Nested folders and ZIP
                archives are read through; nothing in the folder is modified.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Reference</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="GS-001"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Label</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="People v. Doe — certification corpus"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">Source folder on the server</span>
              <input
                value={sourceDirectory}
                onChange={(e) => setSourceDirectory(e.target.value)}
                placeholder="/srv/courtaccess/certification/GS-001"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">Notes (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                disabled={!sourceDirectory || busy !== null}
                onClick={() =>
                  void guard('preview', async () => {
                    setPreview(await certificationApi.preview(sourceDirectory));
                    setImported(null);
                  })
                }
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                {busy === 'preview' ? <Loader2 size={15} className="animate-spin" /> : <FileSearch size={15} />}
                Preview folder
              </button>
              <button
                disabled={!preview || !reference || !label || busy !== null}
                onClick={() =>
                  void guard('import', async () => {
                    const res = await certificationApi.import({ reference, label, description, sourceDirectory });
                    setImported(res);
                    await loadStatus();
                    setSelectedCaseId(res.certificationCaseId);
                    setInventory(await certificationApi.inventory(res.certificationCaseId));
                    setStep('inventory');
                  })
                }
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {busy === 'import' ? <Loader2 size={15} className="animate-spin" /> : <FolderInput size={15} />}
                Import
              </button>
            </div>
          </div>

          {preview && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {preview.fileCount} file(s), {bytes(preview.totalBytes)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.byExtension)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ext, n]) => (
                    <span key={ext} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">
                      .{ext} × {n}
                    </span>
                  ))}
              </div>
              {preview.warnings.length > 0 && (
                <Notice kind="warn" title={`${preview.warnings.length} item(s) need attention`}>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {preview.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </Notice>
              )}
              <div className="max-h-72 overflow-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {preview.files.slice(0, 200).map((f) => (
                      <tr key={f.relativePath}>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{f.relativePath}</td>
                        <td className="px-3 py-1.5 text-gray-500 text-right whitespace-nowrap">{bytes(f.sizeBytes)}</td>
                        <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">
                          {f.fromArchive ? <span className="flex items-center gap-1"><Archive size={11} /> in archive</span> : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {imported && (
            <Notice kind="info" title={`Imported as ${imported.reference}`}>
              {imported.ingested} ingested, {imported.duplicates} duplicate(s) skipped, {imported.failed} failed.
              Corpus fingerprint {imported.corpusHash.slice(0, 16)}.
            </Notice>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 'inventory' && (
        <div className="space-y-4">
          {!inventory ? (
            <p className="text-sm text-gray-500 py-10 text-center">Select a corpus from the Corpora tab.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Stat label="Files" value={inventory.totals.files} />
                <Stat label="Size" value={bytes(inventory.totals.bytes)} />
                <Stat label="Documents" value={inventory.totals.documents} />
                <Stat label="Video" value={inventory.totals.videos} />
                <Stat label="Audio" value={inventory.totals.audio} />
                <Stat label="Images" value={inventory.totals.images} />
                <Stat label="Ingested" value={inventory.totals.ingested} tone="good" />
                <Stat label="Duplicates" value={inventory.totals.duplicates} tone={inventory.totals.duplicates ? 'warn' : undefined} />
                <Stat label="Failed" value={inventory.totals.failed} tone={inventory.totals.failed ? 'bad' : undefined} />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Document classification</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(inventory.byClassification)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, n]) => (
                      <span
                        key={cls}
                        className={`text-xs rounded-full px-2.5 py-1 ${
                          cls === 'unknown' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {cls.replace(/_/g, ' ')} × {n}
                      </span>
                    ))}
                </div>
                {(inventory.byClassification.unknown ?? 0) > 0 && (
                  <p className="text-xs text-gray-500 mt-3">
                    {inventory.byClassification.unknown} file(s) could not be classified from their contents and are
                    reported as unknown rather than assigned a type on a guess.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  disabled={busy !== null || !selectedCaseId}
                  onClick={() =>
                    void guard('run', async () => {
                      const res = await certificationApi.run(selectedCaseId!);
                      setRunResult(res);
                      setStep('results');
                    })
                  }
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {busy === 'run' ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
                  Run certification
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-500 uppercase tracking-wide sticky top-0">
                      <tr>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Classification</th>
                        <th className="px-3 py-2">SHA-256</th>
                        <th className="px-3 py-2">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventory.files.map((f) => (
                        <tr key={f.certificationFileId} className="align-top">
                          <td className="px-3 py-2">
                            <p className="font-mono text-gray-700">{f.relativePath}</p>
                            <p className="text-gray-400">{bytes(Number(f.sizeBytes))}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span className={f.classification === 'unknown' ? 'text-amber-700' : 'text-gray-800'}>
                              {f.classification.replace(/_/g, ' ')}
                            </span>
                            {f.classification !== 'unknown' && (
                              <p className="text-gray-400">{Math.round(f.classificationConfidence * 100)}% confidence</p>
                            )}
                            {f.classificationBasis && (
                              <p className="text-gray-400 mt-0.5 max-w-md">{f.classificationBasis}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-400">{f.sha256.slice(0, 12)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                f.ingestStatus === 'ingested'
                                  ? 'text-emerald-700'
                                  : f.ingestStatus === 'failed'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }
                            >
                              {f.ingestStatus}
                            </span>
                            {f.ingestMessage && <p className="text-gray-500 mt-0.5 max-w-md">{f.ingestMessage}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 'results' && (
        <div className="space-y-4">
          {!runResult ? (
            <p className="text-sm text-gray-500 py-10 text-center">Run a certification from the Inventory tab.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Documents with text" value={runResult.metrics.extraction.documentsWithText} />
                <Stat label="Pages indexed" value={runResult.metrics.extraction.totalPages} />
                <Stat label="Timeline events" value={runResult.metrics.repositories.timelineEvents} />
                <Stat label="Graph nodes" value={runResult.metrics.knowledgeGraph.nodes} />
                <Stat label="Classified" value={runResult.metrics.classification.classified} />
                <Stat
                  label="Unclassified"
                  value={runResult.metrics.classification.unknown}
                  tone={runResult.metrics.classification.unknown ? 'warn' : undefined}
                />
                <Stat
                  label="Below OCR threshold"
                  value={runResult.metrics.ocr.belowConfidenceThreshold}
                  tone={runResult.metrics.ocr.belowConfidenceThreshold ? 'warn' : undefined}
                />
                <Stat
                  label="Failures"
                  value={runResult.metrics.failures.length}
                  tone={runResult.metrics.failures.length ? 'bad' : 'good'}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">CALCRIM and mens rea</h3>
                  <dl className="text-xs space-y-1.5 text-gray-700">
                    <div className="flex justify-between"><dt>Counts with an instruction</dt><dd>{runResult.metrics.calcrim.chargesAnalysed}</dd></div>
                    <div className="flex justify-between"><dt>Counts with no instruction</dt><dd>{runResult.metrics.calcrim.chargesUnmapped}</dd></div>
                    <div className="flex justify-between"><dt>Elements supported by evidence</dt><dd>{runResult.metrics.calcrim.elementsSupported} / {runResult.metrics.calcrim.elementsTotal}</dd></div>
                    <div className="flex justify-between"><dt>Mens rea resolved</dt><dd>{runResult.metrics.mensRea.resolved} ({runResult.metrics.mensRea.unknown} unknown)</dd></div>
                    <div className="flex justify-between"><dt>Contradictions flagged</dt><dd>{runResult.metrics.contradictions.detected}</dd></div>
                  </dl>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Repositories</h3>
                  <dl className="text-xs space-y-1.5 text-gray-700">
                    <div className="flex justify-between"><dt>Evidence records</dt><dd>{runResult.metrics.repositories.evidence}</dd></div>
                    <div className="flex justify-between"><dt>Indexed chunks</dt><dd>{runResult.metrics.repositories.evidenceChunks}</dd></div>
                    <div className="flex justify-between"><dt>Extracted events</dt><dd>{runResult.metrics.repositories.evidenceEvents}</dd></div>
                    <div className="flex justify-between"><dt>Distinct actors</dt><dd>{runResult.metrics.knowledgeGraph.actors}</dd></div>
                    <div className="flex justify-between"><dt>Source documents cited</dt><dd>{runResult.metrics.knowledgeGraph.sourceDocuments}</dd></div>
                  </dl>
                </div>
              </div>

              {runResult.metrics.failures.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 p-5">
                  <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <XCircle size={15} /> Processing failures ({runResult.metrics.failures.length})
                  </h3>
                  <ul className="text-xs space-y-2">
                    {runResult.metrics.failures.map((f, i) => (
                      <li key={i} className="border-l-2 border-red-200 pl-3">
                        <p className="font-medium text-gray-900">{f.file} — {f.stage}</p>
                        <p className="text-gray-600">{f.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {runResult.metrics.unknowns.length > 0 && (
                <div className="bg-white rounded-xl border border-amber-200 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={15} /> Recorded as UNKNOWN ({runResult.metrics.unknowns.length})
                  </h3>
                  <ul className="text-xs space-y-2">
                    {runResult.metrics.unknowns.map((u, i) => (
                      <li key={i} className="border-l-2 border-amber-200 pl-3">
                        <p className="font-medium text-gray-900">{u.subject}</p>
                        <p className="text-gray-600">{u.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {runResult.regressions && runResult.regressions.length > 0 && (
                <RegressionList regressions={runResult.regressions} />
              )}
              {runResult.regressions === null && (
                <Notice kind="info" title="Baseline established">
                  This is the first run for this corpus, so there is nothing to compare it against. Future runs are
                  measured against it.
                </Notice>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 py-10 text-center">Select a corpus from the Corpora tab to see its history.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">Build</th>
                    <th className="px-4 py-3">Pages</th>
                    <th className="px-4 py-3">Events</th>
                    <th className="px-4 py-3">Differences</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((r) => {
                    const regressionCount = (r.regressions ?? []).filter((x) => x.severity === 'regression').length;
                    return (
                      <tr key={r.certificationRunId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-gray-900 flex items-center gap-1.5">
                            <Clock size={12} className="text-gray-400" />
                            {new Date(r.startedAt).toLocaleString()}
                          </p>
                          {r.isBaseline && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5 mt-1 inline-block">
                              baseline
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {r.gitCommit ? r.gitCommit.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.metrics?.extraction.totalPages ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.metrics?.repositories.timelineEvents ?? '—'}</td>
                        <td className="px-4 py-3">
                          {regressionCount > 0 ? (
                            <span className="text-red-700 flex items-center gap-1 text-xs">
                              <XCircle size={12} /> {regressionCount} regression
                            </span>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-1 text-xs">
                              <CheckCircle2 size={12} /> none
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!r.isBaseline && r.status === 'completed' && (
                            <button
                              onClick={() =>
                                void guard('baseline', async () => {
                                  await certificationApi.setBaseline(r.certificationRunId);
                                  const res = await certificationApi.runs(selectedCaseId!);
                                  setHistory(res.runs);
                                })
                              }
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Make baseline
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {history.some((r) => (r.regressions ?? []).length > 0) && (
            <RegressionList regressions={history.flatMap((r) => r.regressions ?? [])} />
          )}
        </div>
      )}
    </div>
  );
}

function RegressionList({ regressions }: { regressions: Regression[] }) {
  const bySeverity = {
    regression: regressions.filter((r) => r.severity === 'regression'),
    change: regressions.filter((r) => r.severity === 'change'),
    improvement: regressions.filter((r) => r.severity === 'improvement'),
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Comparison against the baseline</h3>
      {(['regression', 'change', 'improvement'] as const).map((sev) =>
        bySeverity[sev].length === 0 ? null : (
          <div key={sev}>
            <p
              className={`text-xs font-medium uppercase tracking-wide mb-1.5 ${
                sev === 'regression' ? 'text-red-700' : sev === 'change' ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {sev === 'regression' ? 'Regressions' : sev === 'change' ? 'Changes' : 'Improvements'} ({bySeverity[sev].length})
            </p>
            <ul className="text-xs space-y-1.5">
              {bySeverity[sev].map((r, i) => (
                <li key={`${r.metric}-${i}`} className="flex items-start gap-2">
                  <span className="font-mono text-gray-400 flex-shrink-0">{r.metric}</span>
                  <span className="text-gray-700">{r.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

export default GoldStandardCertification;
