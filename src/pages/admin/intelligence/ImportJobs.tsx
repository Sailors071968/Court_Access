// Import Jobs dashboard — pending through completed/failed/cancelled with metrics.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Play } from 'lucide-react';

import {
  intelligenceApi,
  type ImportJob,
  type ImportJobFile,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes, formatDateTime, statusTone,
} from './shared';

const STATUS_TABS = [
  'all',
  'pending',
  'uploading',
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function fileStatusLabel(status: string): string {
  if (status === 'skipped_duplicate') return 'Already Imported · Skipped';
  return status;
}

export function ImportJobs() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('all');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await intelligenceApi.listImportJobs({
        status: status === 'all' ? undefined : status,
        limit: 100,
      });
      setJobs(res.jobs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import jobs could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load(true);
    const t = window.setInterval(() => void load(false), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import Jobs"
        subtitle="Track bulk roster imports: upload queue, async processing, and throughput metrics."
        actions={
          <Link to="/admin/intelligence/upload">
            <Button variant="primary">New import</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              status === s
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <Panel>
        {error ? <ErrorNotice message={error} onRetry={() => void load(true)} /> : null}
        {loading && jobs.length === 0 ? (
          <Loading label="Loading import jobs" />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No import jobs yet"
            detail="Start a bulk import from Upload Files."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Status</Th>
                <Th>Files</Th>
                <Th>Rows</Th>
                <Th>Upload</Th>
                <Th>Process</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId} className="border-t border-gray-100 hover:bg-gray-50/80">
                  <Td>
                    <Link
                      to={`/admin/intelligence/import-jobs/${j.jobId}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {j.label || j.jobId.slice(0, 8)}
                    </Link>
                    <div className="mt-0.5 text-xs text-gray-500">{formatDateTime(j.createdAt)}</div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                  </Td>
                  <Td className="text-gray-700">
                    {j.filesCompleted + j.filesSkippedDuplicate}/{j.totalFiles}
                    {j.filesSkippedDuplicate > 0 ? (
                      <span className="text-gray-500"> · {j.filesSkippedDuplicate} skipped</span>
                    ) : null}
                    {j.filesFailedUpload + j.filesFailedProcessing > 0 ? (
                      <span className="text-red-600">
                        {' '}
                        · {j.filesFailedUpload + j.filesFailedProcessing} failed
                      </span>
                    ) : null}
                  </Td>
                  <Td className="tabular-nums text-gray-700">
                    {(j.metrics?.totalRowsRead ?? 0).toLocaleString()}
                  </Td>
                  <Td className="text-gray-600">{fmtDuration(j.metrics?.uploadDurationMs)}</Td>
                  <Td className="text-gray-600">{fmtDuration(j.metrics?.processingDurationMs)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

export function ImportJobDetail() {
  const { jobId = '' } = useParams();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [files, setFiles] = useState<ImportJobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!jobId) return;
    if (showSpinner) setLoading(true);
    try {
      const [j, f] = await Promise.all([
        intelligenceApi.importJob(jobId),
        intelligenceApi.importJobFiles(jobId, { limit: 2000 }),
      ]);
      setJob(j);
      setFiles(f.files);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import job could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load(true);
    const t = window.setInterval(() => void load(false), 3000);
    return () => window.clearInterval(t);
  }, [load]);

  if (loading && !job) {
    return <Loading label="Loading import job" />;
  }
  if (!job) {
    return <ErrorNotice message={error ?? 'Import job not found.'} />;
  }

  const m = job.metrics;

  return (
    <div className="space-y-4">
      <PageHeader
        title={job.label || 'Import job'}
        subtitle={`Status: ${job.status} · ${job.filesCompleted}/${job.totalFiles} processed · ${job.filesSkippedDuplicate} skipped`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/intelligence/import-jobs">
              <Button variant="secondary">
                <ArrowLeft className="h-3.5 w-3.5" /> All jobs
              </Button>
            </Link>
            {(job.status === 'queued' || job.status === 'uploading' || job.filesUploaded > 0) && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await intelligenceApi.processImportJob(job.jobId);
                    await load(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not start processing.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Play className="h-3.5 w-3.5" /> Start processing
              </Button>
            )}
            {['pending', 'uploading', 'queued', 'processing'].includes(job.status) ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await intelligenceApi.cancelImportJob(job.jobId);
                    await load(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not cancel.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Ban className="h-3.5 w-3.5" /> Cancel
              </Button>
            ) : null}
            <Link to="/admin/intelligence/upload">
              <Button variant="secondary">Resume / continue upload</Button>
            </Link>
          </div>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Files/min', m?.filesPerMinute?.toFixed(1) ?? '—'],
          ['Rows/sec', m?.rowsPerSecond?.toFixed(1) ?? '—'],
          ['Parser rows/sec', m?.parserThroughputRowsPerSec?.toFixed(1) ?? '—'],
          ['Avg file size', m?.averageFileSizeBytes != null ? formatBytes(m.averageFileSizeBytes) : '—'],
          ['Queue depth', String(m?.importQueueDepth ?? '—')],
          ['Upload', fmtDuration(m?.uploadDurationMs)],
          ['Processing', fmtDuration(m?.processingDurationMs)],
          ['Progress', `${job.progressPercent}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="mt-0.5 text-lg font-semibold text-gray-900">{v}</div>
          </div>
        ))}
      </div>

      <Panel title="Files" description={`${files.length} file row${files.length === 1 ? '' : 's'} in this job.`}>
        <TableShell>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Status</Th>
              <Th>Size</Th>
              <Th>Rows</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.jobFileId} className="border-t border-gray-100">
                <Td className="font-mono text-xs text-gray-800">{f.originalName}</Td>
                <Td>
                  <Badge tone={statusTone(f.status === 'skipped_duplicate' ? 'skipped' : f.status)}>
                    {fileStatusLabel(f.status)}
                  </Badge>
                </Td>
                <Td className="tabular-nums text-gray-600">{formatBytes(f.sizeBytes)}</Td>
                <Td className="tabular-nums text-gray-600">{f.rowsRead ?? '—'}</Td>
                <Td className="max-w-xs truncate text-xs text-gray-500">
                  {f.error || f.sha256.slice(0, 12)}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>
    </div>
  );
}
