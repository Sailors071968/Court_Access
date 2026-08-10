// Import Inspection Mode.
//
// Drop a Sacramento export in and find out what would happen, without anything
// happening. This is the screen to open when a file arrives from a new source or the
// county changes its format — before pressing Process Import and discovering the
// answer the expensive way.
//
// The layout puts the verdict first, then the reasons, then the columns. An operator
// wants to know "can I import this" in one glance and "why not" in the next; the
// column table is for the person who is going to fix the mapping.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Upload, XCircle } from 'lucide-react';

import {
  intelligenceApi,
  type ColumnFinding,
  type InspectionReport,
  type InspectionSummaryRow,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes, formatDateTime,
} from './shared';

export function ImportInspection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [history, setHistory] = useState<InspectionSummaryRow[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const result = await intelligenceApi.inspections({ limit: 25 });
      setHistory(result.inspections);
    } catch {
      // The history is context, not the point of the screen. A failure here must not
      // hide a report the operator is reading.
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const inspect = async (files: File[]) => {
    if (files.length === 0) return;
    setInspecting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await intelligenceApi.inspect(files, { facility: 'sacramento' });
      setReports(result.inspections);
      if (result.rejected.length > 0) {
        setNotice(result.rejected.map((r) => `${r.filename}: ${r.reason}`).join(' '));
      }
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be inspected.');
    } finally {
      setInspecting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const publish = async (report: InspectionReport) => {
    if (!report.inspectionId) return;
    setPublishing(report.inspectionId);
    setError(null);
    try {
      const result = await intelligenceApi.publishFromInspection(report.inspectionId);
      setNotice(result.message);
      // Re-inspecting is the confirmation step: the operator should see the same file
      // read completely before importing it.
      setReports([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The profile version could not be published.');
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <PageHeader
        title="Import inspection"
        subtitle="Analyse a Sacramento export without importing it. Nothing is written to the repository — no batch, no booking, no person."
      />

      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>
      ) : null}

      <Panel>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void inspect([...event.dataTransfer.files]);
          }}
          className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <FileSearch className="mx-auto h-6 w-6 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Drop a CSV or PDF here to inspect it</p>
          <p className="mt-1 text-xs text-gray-500">
            The file is read, described, and deleted. Use this for a file from a new source, or when the county
            changes its format.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.pdf"
            multiple
            className="hidden"
            data-testid="inspect-file-input"
            onChange={(event) => void inspect([...(event.target.files ?? [])])}
          />
          <div className="mt-4">
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={inspecting} testId="inspect-choose">
              <Upload className="h-3.5 w-3.5" /> {inspecting ? 'Inspecting…' : 'Choose a file'}
            </Button>
          </div>
        </div>
      </Panel>

      {inspecting ? <Loading label="Reading the file" /> : null}

      {reports.map((report) => (
        <ReportView
          key={report.file.sha256}
          report={report}
          onPublish={() => void publish(report)}
          publishing={publishing === report.inspectionId}
        />
      ))}

      <Panel title="Recent inspections" description="Every file that has been looked at, whether or not it was imported.">
        {history.length === 0 ? (
          <EmptyState title="Nothing inspected yet" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Type</Th>
                <Th align="right">Size</Th>
                <Th>Profile</Th>
                <Th>Verdict</Th>
                <Th align="right">Confidence</Th>
                <Th>Inspected</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.inspectionId}>
                  <Td className="font-medium text-gray-900">{row.filename}</Td>
                  <Td className="uppercase text-gray-500">{row.fileKind}</Td>
                  <Td align="right">{formatBytes(row.sizeBytes)}</Td>
                  <Td>{row.profileVersion !== null ? `v${row.profileVersion}` : 'no profile'}</Td>
                  <Td><VerdictBadge verdict={row.verdict} /></Td>
                  <Td align="right" className="tabular-nums">{row.parserConfidence}%</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(row.inspectedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'would_import') return <Badge tone="good">Would import</Badge>;
  if (verdict === 'would_import_with_warnings') return <Badge tone="warn">Would import with warnings</Badge>;
  return <Badge tone="bad">Would be refused</Badge>;
}

function ReportView({
  report,
  onPublish,
  publishing,
}: {
  report: InspectionReport;
  onPublish: () => void;
  publishing: boolean;
}) {
  const { compatibility, summary, structure, profile } = report;
  const isPdf = report.file.kind === 'pdf';

  const Icon = compatibility.verdict === 'would_import' ? CheckCircle2
    : compatibility.verdict === 'would_import_with_warnings' ? AlertTriangle
    : XCircle;
  const tone = compatibility.verdict === 'would_import' ? 'text-emerald-600'
    : compatibility.verdict === 'would_import_with_warnings' ? 'text-amber-600'
    : 'text-red-600';

  return (
    <Panel
      title={report.file.filename}
      description={`${formatBytes(report.file.sizeBytes)} · ${report.file.kind.toUpperCase()} · sha256 ${report.file.sha256.slice(0, 16)}… · read with ${
        profile.isFallback ? 'the compiled-in map' : `profile v${profile.version}`}`}
      actions={
        report.suggestedProfileUpdate ? (
          <Button variant="primary" onClick={onPublish} disabled={publishing} testId="publish-from-inspection">
            {publishing ? 'Publishing…' : `Publish v${(profile.version ?? 0) + 1} with ${report.suggestedProfileUpdate.addedAliases.length} mapping(s)`}
          </Button>
        ) : null
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {compatibility.verdict === 'would_import' ? 'This file would import.'
              : compatibility.verdict === 'would_import_with_warnings' ? 'This file would import, with warnings.'
              : 'This file would be refused.'}
            <span className="ml-2 font-normal text-gray-500">
              Parser confidence {compatibility.parserConfidence}%
            </span>
          </p>
          <ul className="mt-2 space-y-1">
            {compatibility.reasons.map((reason, index) => (
              <li key={index} className="text-sm text-gray-700">— {reason}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Rows sampled" value={structure.rowsSampled} />
        <Figure label="Recognised columns" value={summary.recognized.length} />
        <Figure label="Unknown columns" value={summary.unknown.length} tone={summary.unknown.length > 0 ? 'warn' : 'neutral'} />
        <Figure label="Duplicated" value={summary.duplicated.length} tone={summary.duplicated.length > 0 ? 'bad' : 'neutral'} />
      </div>

      {structure.encodingWarnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {structure.encodingWarnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      ) : null}

      {isPdf ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900">Document structure</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Pair label="Pages" value={String(structure.pageCount ?? '—')} />
            <Pair label="Text layer" value={structure.hasTextLayer ? 'present' : 'absent'} />
            <Pair label="Would use OCR" value={structure.ocrWouldBeUsed ? 'yes' : 'no'} />
          </dl>
          {structure.sampleLines && structure.sampleLines.length > 0 ? (
            <>
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                First lines of extracted text
              </h4>
              <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
                {structure.sampleLines.join('\n')}
              </pre>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No text could be extracted. Either the PDF is a scan with no text layer, or it is not a roster.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900">Columns</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Each column described from its values, not its header — because the header is what changes when a
            county alters its export. A suggestion is an offer; nothing is mapped until a profile version is
            published.
          </p>
          <TableShell>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Header</Th>
                <Th>Looks like</Th>
                <Th>Sample values</Th>
                <Th>Mapped to</Th>
                <Th>Suggestion</Th>
              </tr>
            </thead>
            <tbody>
              {report.columns.map((column) => (
                <ColumnRow key={`${column.position}-${column.header}`} column={column} />
              ))}
            </tbody>
          </TableShell>
        </div>
      )}

      {structure.ragged.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          {structure.ragged.length} row(s) have a different field count from the header and would be skipped
          rather than realigned: line{structure.ragged.length === 1 ? '' : 's'}{' '}
          {structure.ragged.slice(0, 8).map((r) => r.line).join(', ')}.
        </p>
      ) : null}
    </Panel>
  );
}

function ColumnRow({ column }: { column: ColumnFinding }) {
  const best = column.suggestions[0];
  return (
    <tr className={column.typeMismatch ? 'bg-amber-50/50' : undefined}>
      <Td align="right" className="tabular-nums text-gray-400">{column.position}</Td>
      <Td>
        <span className="font-medium text-gray-900">{column.header}</span>
        {column.duplicate ? <Badge tone="bad">duplicate</Badge> : null}
      </Td>
      <Td>
        <span className="text-gray-900">{column.inference.type.replace(/_/g, ' ')}</span>
        <span className="ml-1 text-xs text-gray-400">{column.inference.confidence}%</span>
        <span className="mt-0.5 block max-w-xs text-xs text-gray-500">{column.inference.rationale}</span>
      </Td>
      <Td>
        {column.inference.statistics.samples.length === 0 ? (
          <span className="text-xs italic text-gray-400">empty in every sampled row</span>
        ) : (
          <span className="font-mono text-[11px] text-gray-700">
            {column.inference.statistics.samples.slice(0, 4).join(' · ')}
          </span>
        )}
        <span className="mt-0.5 block text-xs text-gray-400">
          {column.inference.statistics.rowsPopulated}/{column.inference.statistics.rowsSeen} populated
          {column.inference.statistics.looksUnique ? ' · all distinct' : ''}
        </span>
      </Td>
      <Td>
        {column.mappedTo ? (
          <Badge tone="good">{column.mappedTo}</Badge>
        ) : (
          <span className="text-xs text-gray-400">not mapped</span>
        )}
        {column.typeMismatch ? (
          <span className="mt-1 block max-w-xs text-xs text-amber-800">{column.typeMismatch}</span>
        ) : null}
      </Td>
      <Td>
        {column.mappedTo ? (
          <span className="text-xs text-gray-400">—</span>
        ) : best ? (
          <>
            <Badge tone={best.confidence >= 65 ? 'info' : 'neutral'}>
              {best.field} · {best.confidence}%
            </Badge>
            <span className="mt-0.5 block max-w-xs text-xs text-gray-500">{best.reason}</span>
            {column.suggestions.length > 1 ? (
              <span className="mt-0.5 block text-xs text-gray-400">
                or {column.suggestions.slice(1).map((s) => `${s.field} (${s.confidence}%)`).join(', ')}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-gray-400">nothing recognisable</span>
        )}
      </Td>
    </tr>
  );
}

function Figure({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'warn' | 'bad' }) {
  const colours = { neutral: 'text-gray-900', warn: 'text-amber-700', bad: 'text-red-700' };
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${colours[tone]}`}>{value}</p>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value}</dd>
    </div>
  );
}

export default ImportInspection;
