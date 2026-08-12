// The processing queue: live progress through the six stages.
//
// Polls every second and a half while anything is active, and stops when nothing is.
// The stage names are the ones the ingestion engine reports, not a decoration — a
// progress bar that advances on a timer tells the operator nothing about whether the
// import is stuck.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

import { intelligenceApi, type RosterUpload } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatDateTime, formatDuration, statusTone,
} from './shared';

/** The stages an operator is shown, in order. `uploading` is already done by the
 *  time a row exists, so it is always complete — shown anyway, because the spec
 *  lists it and an operator reading a five-step list wonders where the upload went. */
const STAGES = ['uploading', 'parsing', 'normalizing', 'matching', 'saving', 'complete'] as const;
type Stage = (typeof STAGES)[number];

export function ProcessingQueue() {
  const [active, setActive] = useState<RosterUpload[]>([]);
  const [recent, setRecent] = useState<RosterUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await intelligenceApi.queue();
      setActive(result.active);
      setRecent(result.recent);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The processing queue could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const busy = active.some((u) => u.status === 'processing' || u.status === 'queued');
    if (!busy) return;
    const timer = window.setTimeout(() => void load(false), 1500);
    return () => window.clearTimeout(timer);
  }, [active, load]);

  const start = async () => {
    setProcessing(true);
    setError(null);
    try {
      await intelligenceApi.process();
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing could not be started.');
    } finally {
      setProcessing(false);
    }
  };

  const waiting = active.filter((u) => u.status === 'uploaded');

  if (loading) return <Loading label="Loading the processing queue" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Processing queue"
        subtitle="Live progress. Files are processed one at a time, CSV before PDF."
        actions={
          waiting.length > 0 ? (
            <Button variant="primary" onClick={() => void start()} disabled={processing}>
              {processing ? 'Starting…' : `Process ${waiting.length} waiting file${waiting.length === 1 ? '' : 's'}`}
            </Button>
          ) : null
        }
      />

      {error ? <ErrorNotice message={error} onRetry={() => void load(true)} /> : null}

      <Panel title="In progress" description="Anything uploaded but not yet finished.">
        {active.length === 0 ? (
          <EmptyState
            title="Nothing in the queue"
            detail="Every uploaded file has been processed."
          />
        ) : (
          <div className="space-y-4">
            {active.map((upload) => (
              <ProgressCard key={upload.uploadId} upload={upload} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recently finished" description="The last twenty runs.">
        {recent.length === 0 ? (
          <EmptyState title="Nothing has finished yet" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Roster date</Th>
                <Th>Status</Th>
                <Th align="right">Records</Th>
                <Th align="right">Duration</Th>
                <Th>Finished</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {recent.map((upload) => (
                <tr key={upload.uploadId}>
                  <Td className="font-medium text-gray-900">{upload.filename}</Td>
                  <Td>{upload.rosterDate ?? '—'}</Td>
                  <Td>
                    <Badge tone={statusTone(upload.status)}>{upload.status}</Badge>
                    {upload.failureReason ? (
                      <span className="mt-1 block max-w-md text-xs text-red-600">{upload.failureReason}</span>
                    ) : null}
                  </Td>
                  <Td align="right" className="tabular-nums">{upload.counts?.total ?? '—'}</Td>
                  <Td align="right">{formatDuration(upload.durationMs)}</Td>
                  <Td>{formatDateTime(upload.processedAt)}</Td>
                  <Td>
                    {upload.batchId ? (
                      <Link
                        to="/admin/intelligence/import-history"
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        View import
                      </Link>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function ProgressCard({ upload }: { upload: RosterUpload }) {
  const currentStage = resolveStage(upload);
  const currentIndex = STAGES.indexOf(currentStage);
  const failed = upload.status === 'failed';

  const percent = upload.progressTotal && upload.progressTotal > 0 && upload.progressDone !== null
    ? Math.min(100, Math.round((upload.progressDone / upload.progressTotal) * 100))
    : null;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{upload.filename}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {upload.fileKind.toUpperCase()} · roster {upload.rosterDate ?? 'unspecified'} · uploaded{' '}
            {formatDateTime(upload.uploadedAt)}
          </p>
        </div>
        <Badge tone={statusTone(upload.status)}>{upload.status}</Badge>
      </div>

      <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {STAGES.map((stage, index) => {
          const done = !failed && index < currentIndex;
          const current = !failed && index === currentIndex;
          return (
            <li key={stage} className="flex items-center gap-1.5 text-xs">
              {failed && index === currentIndex ? (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              ) : done || currentStage === 'complete' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-gray-300" />
              )}
              <span
                className={
                  current ? 'font-semibold text-gray-900'
                    : done || currentStage === 'complete' ? 'text-gray-600'
                    : 'text-gray-400'
                }
              >
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </span>
            </li>
          );
        })}
      </ol>

      {percent !== null && upload.status === 'processing' ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            {upload.progressDone} of {upload.progressTotal} rows
          </p>
        </div>
      ) : null}

      {upload.status === 'uploaded' ? (
        <p className="mt-3 text-xs text-gray-500">Waiting. Press Process Import to begin.</p>
      ) : null}
      {upload.failureReason ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{upload.failureReason}</p>
      ) : null}
    </div>
  );
}

/**
 * Which stage to highlight.
 *
 * `concluding` is a real ingestion stage but not one of the six the operator was
 * promised, so it is shown as `saving` — the work it does is the batch-level writes.
 * A seventh box would be more accurate and less useful.
 */
function resolveStage(upload: RosterUpload): Stage {
  if (upload.status === 'uploaded') return 'uploading';
  if (upload.status === 'queued') return 'uploading';
  if (upload.status === 'completed') return 'complete';
  const stage = upload.stage;
  if (stage === 'concluding') return 'saving';
  if (stage && (STAGES as readonly string[]).includes(stage)) return stage as Stage;
  return 'parsing';
}

export default ProcessingQueue;
