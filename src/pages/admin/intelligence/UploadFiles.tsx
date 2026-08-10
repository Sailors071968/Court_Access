// Upload today's roster, then process it.
//
// The two actions are on one page because they are one task: an operator who has
// just uploaded two files wants to press Process Import without navigating. Process
// Import with nothing selected processes everything waiting, which is what that
// operator means.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Play, Trash2, Upload } from 'lucide-react';

import { intelligenceApi, type RosterUpload } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes, formatDateTime, statusTone,
} from './shared';

const ACCEPTED = '.csv,.pdf';

export function UploadFiles() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<RosterUpload[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejections, setRejections] = useState<{ filename: string; reason: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rosterDate, setRosterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      // List page shows recent files; separately count everything still waiting so
      // Process Import is not greyed out when waiting rows fall outside the first page.
      const [result, waitingPage] = await Promise.all([
        intelligenceApi.listUploads({ limit: 100 }),
        intelligenceApi.listUploads({ limit: 1, status: 'uploaded' }),
      ]);
      setUploads(result.uploads);
      setWaitingCount(waitingPage.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The uploads could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Keep the list live while anything is processing, so the operator sees the stage
  // change without reloading.
  useEffect(() => {
    const busy = uploads.some((u) => u.status === 'processing' || u.status === 'queued');
    if (!busy) return;
    const timer = window.setTimeout(() => void load(false), 2000);
    return () => window.clearTimeout(timer);
  }, [uploads, load]);

  const send = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(files.length > 25 ? `Uploading 0 of ${files.length}…` : null);
    setNotice(null);
    setRejections([]);
    setError(null);
    try {
      const result = await intelligenceApi.upload(files, {
        facility: 'sacramento',
        rosterDate,
        onChunk: (done, total) => {
          setUploadProgress(total > 25 ? `Uploading ${done} of ${total}…` : null);
        },
      });
      setRejections(result.rejected);

      const duplicates = result.accepted.filter((a) => a.duplicateOf);
      const parts: string[] = [];
      if (result.accepted.length > 0) {
        parts.push(`${result.accepted.length} file${result.accepted.length === 1 ? '' : 's'} stored.`);
        parts.push('Process Import is enabled for files still in “uploaded” status.');
      } else {
        parts.push('No files were stored.');
      }
      if (duplicates.length > 0) {
        // Worth saying rather than hiding: re-uploading the same bytes is usually a
        // mistake, and processing them is a no-op the operator would misread as a
        // quiet day at the jail.
        parts.push(
          `${duplicates.length} of them ${duplicates.length === 1 ? 'has' : 'have'} identical content to a file already uploaded, so processing will report no new records.`,
        );
      }
      setNotice(parts.join(' '));
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed.');
      // Refresh anyway — earlier chunks may have landed before the failure.
      await load(false);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const process = async () => {
    setProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await intelligenceApi.process();
      const messages: string[] = [];
      if (result.started.length > 0) {
        messages.push(`Processing ${result.started.length} file${result.started.length === 1 ? '' : 's'}.`);
      }
      for (const skip of result.skipped) messages.push(skip.reason);
      setNotice(messages.join(' '));
      await load(false);
      if (result.started.length > 0) navigate('/admin/intelligence/queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing could not be started.');
    } finally {
      setProcessing(false);
    }
  };

  const remove = async (uploadId: string) => {
    try {
      await intelligenceApi.deleteUpload(uploadId);
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be removed.');
    }
  };

  // Prefer the dedicated waiting total: the list page can omit older uploaded rows.
  const waitingOnPage = uploads.filter((u) => u.status === 'uploaded').length;
  const waiting = waitingCount > 0 ? waitingCount : waitingOnPage;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Upload files"
        subtitle="Sacramento County CSV and PDF rosters. Files are stored the moment they arrive, before anything is parsed."
        actions={
          <Button
            variant="primary"
            onClick={() => void process()}
            disabled={processing || waiting === 0}
            testId="process-import"
            title={waiting === 0 ? 'Upload a roster first' : `Process ${waiting} waiting file(s)`}
          >
            <Play className="h-3.5 w-3.5" />
            {processing ? 'Starting…' : `Process Import${waiting > 0 ? ` (${waiting})` : ''}`}
          </Button>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>
      ) : null}
      {rejections.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Some files were not stored:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {rejections.map((r) => (
              <li key={r.filename}>
                <span className="font-medium">{r.filename}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Roster date</span>
            <input
              type="date"
              value={rosterDate}
              onChange={(event) => setRosterDate(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              data-testid="roster-date"
            />
            <span className="mt-1 block text-xs text-gray-500">
              The day the roster describes, which decides which parser profile reads it.
            </span>
          </label>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void send([...event.dataTransfer.files]);
          }}
          className={`mt-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <Upload className="mx-auto h-6 w-6 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Drop the CSV and PDF here</p>
          <p className="mt-1 text-xs text-gray-500">
            Or choose them. Large folders are uploaded in batches of 25 so the request is not rejected.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            data-testid="file-input"
            onChange={(event) => void send([...(event.target.files ?? [])])}
          />
          <div className="mt-4">
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? (uploadProgress ?? 'Uploading…') : 'Choose files'}
            </Button>
          </div>
          {waiting === 0 && !uploading ? (
            <p className="mt-3 text-xs text-gray-500">
              Process Import stays disabled until at least one file reaches status “uploaded”.
              If a large drop never appears in the list, the browser request was rejected before storage —
              try again after a refresh; bulk uploads are now chunked.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Uploaded files"
        description="Everything uploaded, whether processed or not."
      >
        {loading ? (
          <Loading label="Loading uploads" />
        ) : uploads.length === 0 ? (
          <EmptyState
            title="Nothing uploaded yet"
            detail="Upload today's Sacramento County roster to begin."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Roster date</Th>
                <Th align="right">Size</Th>
                <Th>Uploaded by</Th>
                <Th>Upload time</Th>
                <Th>Status</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.uploadId}>
                  <Td>
                    <span className="flex items-center gap-2">
                      {upload.fileKind === 'pdf' ? (
                        <FileText className="h-4 w-4 shrink-0 text-red-400" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                      <span className="font-medium text-gray-900">{upload.filename}</span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-gray-400">
                      {upload.sha256.slice(0, 16)}…
                    </span>
                  </Td>
                  <Td>{upload.rosterDate ?? '—'}</Td>
                  <Td align="right">{formatBytes(upload.sizeBytes)}</Td>
                  <Td>{upload.uploadedByName ?? '—'}</Td>
                  <Td>{formatDateTime(upload.uploadedAt)}</Td>
                  <Td>
                    <Badge tone={statusTone(upload.status)}>
                      {upload.status === 'processing' && upload.stage ? upload.stage : upload.status}
                    </Badge>
                    {upload.failureReason ? (
                      <span className="mt-1 block max-w-md text-xs text-red-600">{upload.failureReason}</span>
                    ) : null}
                  </Td>
                  <Td align="right">
                    {upload.batchId ? (
                      <span
                        className="text-xs text-gray-400"
                        title="A processed file is the evidence behind the intelligence drawn from it and cannot be removed."
                      >
                        processed
                      </span>
                    ) : (
                      <Button variant="danger" onClick={() => void remove(upload.uploadId)}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
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

export default UploadFiles;
