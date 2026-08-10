// Client-side upload queue for large historical imports.
// Fingerprints files, creates an Import Job, uploads in chunks with retry,
// and resumes by matching sha256 when the same folder is re-selected.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, RefreshCw, Upload } from 'lucide-react';

import { intelligenceApi, type ImportJob, type ImportJobDecision } from '@/services/inmateIntelligenceApi';
import { hashFiles } from './fileHash';
import { Badge, Button, ErrorNotice, Panel, formatBytes, statusTone } from './shared';

const CHUNK = 25;
const MAX_RETRIES = 3;
const ACTIVE_JOB_KEY = 'niis.activeImportJobId';

type QueuePhase = 'idle' | 'hashing' | 'creating' | 'uploading' | 'processing' | 'done' | 'error';

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatSpeed(bytesPerSec: number | null): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '—';
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

export function BulkImportPanel({
  rosterDate,
  onJobChanged,
}: {
  rosterDate: string;
  onJobChanged?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<QueuePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [decisions, setDecisions] = useState<ImportJobDecision[]>([]);
  const [hashDone, setHashDone] = useState(0);
  const [hashTotal, setHashTotal] = useState(0);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const filesByHash = useRef<Map<string, File>>(new Map());
  const uploadStartedAt = useRef<number | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Resume polling for an active job after refresh.
  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!saved) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = await intelligenceApi.importJob(saved);
        if (cancelled) return;
        setJob(j);
        if (['uploading', 'queued', 'processing'].includes(j.status)) {
          setPhase(j.status === 'uploading' ? 'uploading' : 'processing');
        } else if (j.status === 'completed') {
          setPhase('done');
          localStorage.removeItem(ACTIVE_JOB_KEY);
        }
      } catch {
        localStorage.removeItem(ACTIVE_JOB_KEY);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Poll job while work is in flight.
  useEffect(() => {
    if (!job) return;
    if (!['uploading', 'queued', 'processing'].includes(job.status) && phase !== 'uploading') return;
    const timer = window.setInterval(() => {
      void intelligenceApi.importJob(job.jobId).then((j) => {
        setJob(j);
        onJobChanged?.();
        if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
          setPhase(j.status === 'completed' ? 'done' : 'error');
          if (j.status !== 'completed') setError(j.failureReason ?? `Job ${j.status}`);
          localStorage.removeItem(ACTIVE_JOB_KEY);
        } else if (j.status === 'processing' || j.status === 'queued') {
          setPhase('processing');
        }
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job?.jobId, job?.status, phase, onJobChanged]);

  const runUploadQueue = useCallback(async (jobId: string, toUpload: ImportJobDecision[]) => {
    setPhase('uploading');
    uploadStartedAt.current = Date.now();
    let sent = 0;

    const pending = [...toUpload];
    let batchIndex = 0;

    while (pending.length > 0) {
      while (pausedRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const slice = pending.splice(0, CHUNK);
      const items = slice
        .map((d) => {
          const file = filesByHash.current.get(d.sha256);
          return file ? { jobFileId: d.jobFileId, file } : null;
        })
        .filter((x): x is { jobFileId: string; file: File } => Boolean(x));

      if (items.length === 0) {
        batchIndex += 1;
        continue;
      }

      setBatchLabel(`Batch ${batchIndex + 1} (${items.length} file${items.length === 1 ? '' : 's'})`);
      setCurrentUpload(items[0]!.file.name);

      let attempt = 0;
      let ok = false;
      while (attempt < MAX_RETRIES && !ok) {
        attempt += 1;
        try {
          const result = await intelligenceApi.uploadImportJobBatch(jobId, items, batchIndex);
          setJob(result.job);
          const batchBytes = items.reduce((s, i) => s + i.file.size, 0);
          sent += batchBytes;
          const elapsed = (Date.now() - (uploadStartedAt.current ?? Date.now())) / 1000;
          const bps = elapsed > 0 ? sent / elapsed : null;
          setSpeed(bps);
          const jobNow = result.job;
          const remainingBytes = Math.max(0, jobNow.totalBytes - jobNow.uploadedBytes);
          setEtaSec(bps && bps > 0 ? remainingBytes / bps : null);
          if (result.rejected.length > 0 && result.accepted.length === 0) {
            throw new Error(result.rejected.map((r) => r.reason).join('; '));
          }
          ok = true;
          if (result.autoProcessStarted) setPhase('processing');
        } catch (err) {
          if (attempt >= MAX_RETRIES) {
            // Re-queue this batch for a later manual retry via resume.
            throw err instanceof Error ? err : new Error('Batch upload failed');
          }
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      batchIndex += 1;
      onJobChanged?.();
    }

    setCurrentUpload(null);
    setBatchLabel(null);
    const finalJob = await intelligenceApi.importJob(jobId);
    setJob(finalJob);
    if (finalJob.filesUploaded > 0 && finalJob.autoProcess) {
      // Server may already have started; ensure process if upload finished with leftovers.
      if (finalJob.status === 'queued' || finalJob.filesUploaded > 0 && finalJob.filesProcessing === 0 && finalJob.filesCompleted === 0) {
        try {
          await intelligenceApi.processImportJob(jobId);
        } catch {
          // Already processing is fine.
        }
      }
      setPhase('processing');
    } else if (finalJob.status === 'completed') {
      setPhase('done');
      localStorage.removeItem(ACTIVE_JOB_KEY);
    } else {
      setPhase('done');
    }
  }, [onJobChanged]);

  const startWithFiles = async (fileList: File[]) => {
    const rosterFiles = fileList.filter((f) => /\.(csv|pdf)$/i.test(f.name));
    if (rosterFiles.length === 0) {
      setError('Select CSV or PDF roster files.');
      return;
    }
    setError(null);
    setPhase('hashing');
    setHashDone(0);
    setHashTotal(rosterFiles.length);
    filesByHash.current = new Map();

    try {
      const hashed = await hashFiles(rosterFiles, (done, total) => {
        setHashDone(done);
        setHashTotal(total);
      });
      for (const h of hashed) filesByHash.current.set(h.sha256, h.file);

      setPhase('creating');
      const created = await intelligenceApi.createImportJob({
        facility: 'sacramento',
        rosterDate,
        label: `${hashed.length} file import`,
        autoProcess: true,
        files: hashed.map((h) => ({
          name: h.file.name,
          sizeBytes: h.sizeBytes,
          sha256: h.sha256,
        })),
      });
      setJob(created.job);
      setDecisions(created.decisions);
      localStorage.setItem(ACTIVE_JOB_KEY, created.job.jobId);

      const toUpload = created.decisions.filter((d) => d.action === 'upload');
      if (toUpload.length === 0) {
        setPhase('done');
        localStorage.removeItem(ACTIVE_JOB_KEY);
        onJobChanged?.();
        return;
      }
      await runUploadQueue(created.job.jobId, toUpload);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const resume = async () => {
    if (!job) return;
    setError(null);
    setPhase('hashing');
    try {
      const pending = await intelligenceApi.importJobPending(job.jobId);
      if (pending.files.length === 0) {
        await intelligenceApi.processImportJob(job.jobId);
        setPhase('processing');
        return;
      }
      // Need the user to re-select files so we have File handles.
      fileInput.current?.click();
      // Mark that the next selection is a resume for this job.
      (fileInput.current as HTMLInputElement & { dataset: DOMStringMap }).dataset.resume = '1';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume.');
      setPhase('error');
    }
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = [...(event.target.files ?? [])];
    const isResume = event.target.dataset.resume === '1';
    event.target.dataset.resume = '';
    if (fileInput.current) fileInput.current.value = '';

    if (!isResume || !job) {
      await startWithFiles(list);
      return;
    }

    // Resume path: hash selection, match pending sha256s, upload only those.
    setPhase('hashing');
    try {
      const hashed = await hashFiles(list.filter((f) => /\.(csv|pdf)$/i.test(f.name)), (d, t) => {
        setHashDone(d);
        setHashTotal(t);
      });
      filesByHash.current = new Map(hashed.map((h) => [h.sha256, h.file]));
      const pending = await intelligenceApi.importJobPending(job.jobId);
      const decisionsResume: ImportJobDecision[] = pending.files
        .filter((f) => filesByHash.current.has(f.sha256))
        .map((f) => ({
          name: f.originalName,
          sha256: f.sha256,
          action: 'upload' as const,
          jobFileId: f.jobFileId,
        }));
      const missing = pending.files.length - decisionsResume.length;
      if (missing > 0) {
        setError(
          `${missing} pending file(s) were not in the folder you selected. ` +
          `Matched ${decisionsResume.length}; select the original folder to finish.`,
        );
      }
      if (decisionsResume.length === 0) {
        setPhase('error');
        return;
      }
      localStorage.setItem(ACTIVE_JOB_KEY, job.jobId);
      await runUploadQueue(job.jobId, decisionsResume);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Resume failed.');
    }
  };

  const skipped = decisions.filter((d) => d.action === 'skip_duplicate').length;
  const total = job?.totalFiles ?? hashTotal;
  const uploaded = job
    ? job.filesUploaded + job.filesSkippedDuplicate + job.filesCompleted + job.filesFailedProcessing + job.filesQueued + job.filesProcessing
    : hashDone;
  const remaining = job
    ? job.filesPending + job.filesFailedUpload + job.filesUploading
    : Math.max(0, hashTotal - hashDone);

  return (
    <Panel
      title="Bulk import queue"
      description="Fingerprints files first, skips duplicates, uploads in batches of 25 with automatic retry, and resumes after a browser close."
      actions={
        <div className="flex items-center gap-2">
          {phase === 'uploading' ? (
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? 'Resume queue' : 'Pause'}
            </Button>
          ) : null}
          {job && (job.filesPending > 0 || job.filesFailedUpload > 0) && phase !== 'uploading' && phase !== 'hashing' ? (
            <Button variant="secondary" onClick={() => void resume()}>
              <RefreshCw className="h-3.5 w-3.5" /> Resume upload
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={phase === 'hashing' || phase === 'uploading' || phase === 'creating'}>
            <Upload className="h-3.5 w-3.5" />
            {phase === 'idle' || phase === 'done' || phase === 'error' ? 'Choose folder / files' : 'Busy…'}
          </Button>
        </div>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.pdf"
        multiple
        className="hidden"
        // @ts-expect-error webkitdirectory is widely supported for folder pick
        webkitdirectory=""
        onChange={(e) => void onFileChange(e)}
      />
      {/* Also allow plain multi-file without directory */}
      <div className="mb-3">
        <button
          type="button"
          className="text-xs text-blue-700 underline"
          onClick={() => {
            if (!fileInput.current) return;
            fileInput.current.removeAttribute('webkitdirectory');
            fileInput.current.click();
            // restore for next folder pick
            queueMicrotask(() => fileInput.current?.setAttribute('webkitdirectory', ''));
          }}
        >
          Or choose individual files
        </button>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total files" value={String(total)} />
        <Metric label="Uploaded / skipped" value={String(uploaded)} />
        <Metric label="Remaining" value={String(remaining)} />
        <Metric label="Phase" value={paused && phase === 'uploading' ? 'paused' : phase} />
        <Metric label="Current file" value={currentUpload ?? job?.currentFilename ?? '—'} />
        <Metric label="Batch" value={batchLabel ?? '—'} />
        <Metric label="Upload speed" value={formatSpeed(speed)} />
        <Metric label="Est. remaining" value={formatEta(etaSec)} />
      </div>

      {phase === 'hashing' ? (
        <p className="mt-3 text-sm text-gray-600">
          Fingerprinting files… {hashDone} / {hashTotal}
        </p>
      ) : null}

      {job ? (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
            <span className="font-medium">{job.label}</span>
            <span className="text-xs text-gray-500">{formatBytes(job.uploadedBytes)} / {formatBytes(job.totalBytes)}</span>
            <span className="text-xs text-gray-500">{job.progressPercent}%</span>
            {skipped > 0 ? (
              <span className="text-xs text-amber-700">{skipped} already imported — skipped</span>
            ) : null}
            <Link className="ml-auto text-xs font-medium text-blue-700 hover:underline" to={`/admin/intelligence/import-jobs/${job.jobId}`}>
              Open job detail
            </Link>
          </div>
          {job.metrics ? (
            <p className="mt-1 text-xs text-gray-500">
              Throughput: {job.metrics.filesPerMinute ?? '—'} files/min · {job.metrics.rowsPerSecond ?? '—'} rows/s · queue depth {job.metrics.importQueueDepth}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          Drop a folder of Sacramento CSV/PDF rosters. Duplicates are detected by fingerprint before upload.
        </p>
      )}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900" title={value}>{value}</p>
    </div>
  );
}
