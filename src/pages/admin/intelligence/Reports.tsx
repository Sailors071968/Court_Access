// Report approval.
//
// A report moves forward only, and the document never changes. Printing is the state
// that matters: it is the moment a conclusion left the building on paper, so after that
// a correction has to be a new report saying what it supersedes rather than a quiet edit.
//
// The screen states that rather than assuming the operator knows it, because the
// difference between "fix the report" and "issue a corrected one" is the difference
// between an auditable record and a rewritten one.

import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, FileText, Printer, Archive } from 'lucide-react';

import { intelligenceApi, type ReportRecord } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatDateTime, printHtmlDocument,
} from './shared';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'printed', label: 'Printed' },
  { value: 'archived', label: 'Archived' },
];

export function Reports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.reportList({ state: filter || undefined, limit: 50 });
      setReports(result.reports);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The reports could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (report: ReportRecord, state: string, note?: string) => {
    setBusy(report.reportId);
    setError(null);
    setNotice(null);
    try {
      const result = await intelligenceApi.setReportState(report.reportId, state, note);
      setNotice(
        state === 'printed'
          ? `Recorded as printed (${result.printCount} time${result.printCount === 1 ? '' : 's'}). A correction now has to be a new report that says what it supersedes.`
          : `Report is now ${result.state}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report state could not be changed.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Print, then record the print.
   *
   * In that order: recording a print that never happened would put a report into a state
   * a correction cannot be made from, on the strength of a dialogue the operator may
   * have cancelled. The state is recorded because the print was attempted, which is the
   * honest claim available from a browser.
   */
  const printReport = async (report: ReportRecord) => {
    setBusy(report.reportId);
    setError(null);
    try {
      const html = await intelligenceApi.report({});
      printHtmlDocument(html, setError);
      if (report.approvalState === 'approved') {
        await intelligenceApi.setReportState(report.reportId, 'printed');
        setNotice('Sent to the printer and recorded as printed.');
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be printed.');
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      // Generating produces a draft; nothing is approved by being created.
      await intelligenceApi.report({});
      setNotice("Today's report has been generated as a draft. Review it, approve it, then print.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[95rem] space-y-6">
      <PageHeader
        title="Intelligence reports"
        subtitle="Draft → reviewed → approved → printed → archived. The document never changes; a correction is a new report that says what it supersedes."
        actions={
          <>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <Button variant="primary" onClick={() => void generate()} disabled={generating} testId="generate-report">
              <FileText className="h-3.5 w-3.5" /> {generating ? 'Generating…' : "Generate today's report"}
            </Button>
          </>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      ) : null}

      <Panel>
        {loading ? (
          <Loading label="Loading reports" />
        ) : reports.length === 0 ? (
          <EmptyState
            title={filter ? `No ${filter} reports` : 'No reports generated yet'}
            detail="Generate today's report once the roster has been imported."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>State</Th>
                <Th align="right">Rows</Th>
                <Th>Generated</Th>
                <Th>Reviewed</Th>
                <Th>Approved</Th>
                <Th>Printed</Th>
                <Th>Note</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.reportId}>
                  <Td><StateBadge state={report.approvalState} /></Td>
                  <Td align="right" className="tabular-nums">{report.rowCount}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDateTime(report.generatedAt)}
                    <span className="block text-gray-400">{report.generatedById}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {report.reviewedAt ? (
                      <>
                        {formatDateTime(report.reviewedAt)}
                        <span className="block text-gray-400">{report.reviewedById}</span>
                      </>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {report.approvedAt ? (
                      <>
                        {formatDateTime(report.approvedAt)}
                        <span className="block text-gray-400">{report.approvedById}</span>
                      </>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {report.printedAt ? (
                      <>
                        {formatDateTime(report.printedAt)}
                        <span className="block text-gray-400">{report.printCount}× by {report.printedById}</span>
                      </>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td className="max-w-xs text-xs text-gray-600">{report.approvalNote ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {report.approvalState === 'draft' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void move(report, 'reviewed')}
                          disabled={busy === report.reportId}
                        >
                          <Eye className="h-3.5 w-3.5" /> Mark reviewed
                        </Button>
                      ) : null}
                      {report.approvalState === 'reviewed' ? (
                        <Button
                          variant="primary"
                          onClick={() => void move(report, 'approved', window.prompt('Approval note (optional)') ?? undefined)}
                          disabled={busy === report.reportId}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                      ) : null}
                      {report.approvalState === 'approved' || report.approvalState === 'printed' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void printReport(report)}
                          disabled={busy === report.reportId}
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
                        </Button>
                      ) : null}
                      {report.approvalState !== 'archived' ? (
                        <Button
                          variant="ghost"
                          onClick={() => void move(report, 'archived')}
                          disabled={busy === report.reportId}
                          title="Archive: keeps the report as a historical record and stops it changing state again"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel title="Why the states matter">
        <ul className="space-y-1.5 text-sm text-gray-700">
          <li><strong>Draft</strong> — generated, nobody has looked at it.</li>
          <li><strong>Reviewed</strong> — someone read it against the roster.</li>
          <li><strong>Approved</strong> — someone is willing to act on it. Stored with who and when.</li>
          <li>
            <strong>Printed</strong> — it left the building on paper. After this a correction has to be a new
            report that says what it supersedes; the printed document is not edited.
          </li>
          <li><strong>Archived</strong> — a permanent historical record. It does not change state again.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          A draft cannot skip to printed, and returning a report to draft requires a reason and clears the
          approval — an approval that survived a rejection would claim someone signed off on a document that was
          then sent back.
        </p>
      </Panel>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const tones: Record<string, 'neutral' | 'info' | 'good' | 'warn'> = {
    draft: 'neutral', reviewed: 'info', approved: 'good', printed: 'good', archived: 'neutral',
  };
  return <Badge tone={tones[state] ?? 'neutral'}>{state}</Badge>;
}

export default Reports;
