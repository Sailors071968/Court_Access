// ============================================================================
// Certification upload portal.
//
// Select discovery from the operator's own machine — drag a folder in, or
// browse for files — watch it upload with real progress, review what arrived
// before committing, then follow the pipeline stage by stage. No shell, no
// SFTP, no server-side file handling.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, FileUp, FolderUp, Loader2, Pause, Play,
  RotateCcw, Upload, XCircle,
} from 'lucide-react';
import {
  UploadController,
  collectFromDataTransfer,
  collectFromInput,
  formatBytes,
  formatDuration,
  type SelectedFile,
  type UploadProgress,
} from '../../services/uploadClient';
import { certificationApi, type UploadPreview, type UploadSessionStatus } from '../../services/certificationApi';

type Phase = 'select' | 'uploading' | 'preview' | 'processing' | 'done';

interface Props {
  onCertified?: (certificationCaseId: string) => void;
}

export function CertificationUploadPortal({ onCertified }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [label, setLabel] = useState('');
  const [selection, setSelection] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [paused, setPaused] = useState(false);
  const controllerRef = useRef<UploadController | null>(null);
  const sessionRef = useRef<string | null>(null);

  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [status, setStatus] = useState<UploadSessionStatus | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const totalBytes = selection.reduce((s, f) => s + f.file.size, 0);

  // ---------------------------------------------------------------- selection
  const addSelection = useCallback((files: SelectedFile[]) => {
    setError(null);
    setSelection((prev) => {
      const seen = new Set(prev.map((p) => p.relativePath));
      return [...prev, ...files.filter((f) => !seen.has(f.relativePath))];
    });
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!e.dataTransfer?.items) return;
      setScanning(true);
      try {
        addSelection(await collectFromDataTransfer(e.dataTransfer.items, e.dataTransfer.files));
      } catch {
        setError('The dropped items could not be read. Try the Select buttons instead.');
      } finally {
        setScanning(false);
      }
    },
    [addSelection],
  );

  // ---------------------------------------------------------------- uploading
  const startUpload = async () => {
    if (!reference.trim() || !label.trim()) {
      setError('A reference and a label are needed before the upload can start.');
      return;
    }
    if (selection.length === 0) {
      setError('Select the discovery to upload first.');
      return;
    }

    setError(null);
    try {
      const created = await certificationApi.createUpload({
        reference: reference.trim(),
        label: label.trim(),
        fileCount: selection.length,
        totalBytes,
      });
      sessionRef.current = created.uploadSessionId;

      const controller = new UploadController({
        uploadSessionId: created.uploadSessionId,
        chunkBytes: created.chunkBytes,
        files: selection,
        onProgress: setProgress,
      });
      controllerRef.current = controller;
      setPhase('uploading');

      const outcome = await controller.run();
      if (outcome.completed) {
        await loadPreview(created.uploadSessionId);
      } else if (outcome.failed.length > 0) {
        setError(
          `${outcome.failed.length} file(s) did not upload. Use Retry failed to send them again; ` +
            'everything already received is kept.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload could not be started.');
      setPhase('select');
    }
  };

  const resumeUpload = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setPaused(false);
    const outcome = await controller.run();
    if (outcome.completed && sessionRef.current) await loadPreview(sessionRef.current);
  };

  const retryFailed = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setError(null);
    controller.retryFailed();
    await resumeUpload();
  };

  const cancelUpload = async () => {
    controllerRef.current?.cancel();
    if (sessionRef.current) await certificationApi.cancelUpload(sessionRef.current).catch(() => {});
    controllerRef.current = null;
    sessionRef.current = null;
    setProgress(null);
    setPhase('select');
  };

  // ------------------------------------------------------------------ preview
  const loadPreview = async (sessionId: string) => {
    try {
      setPreview(await certificationApi.uploadPreview(sessionId));
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The uploaded files could not be reviewed.');
    }
  };

  // --------------------------------------------------------------- processing
  const commit = async () => {
    if (!sessionRef.current) return;
    setError(null);
    try {
      await certificationApi.commitUpload(sessionRef.current);
      setPhase('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing could not be started.');
    }
  };

  useEffect(() => {
    if (phase !== 'processing' || !sessionRef.current) return;
    const id = sessionRef.current;
    let stop = false;

    const poll = async () => {
      while (!stop) {
        try {
          const s = await certificationApi.uploadStatus(id);
          setStatus(s);
          if (s.status === 'completed') {
            setPhase('done');
            if (s.certificationCaseId) onCertified?.(s.certificationCaseId);
            return;
          }
          if (s.status === 'failed') {
            setError(s.error ?? 'Processing failed.');
            setPhase('done');
            return;
          }
        } catch {
          // A transient poll failure is not a processing failure; keep going.
        }
        await new Promise((r) => setTimeout(r, 750));
      }
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [phase, onCertified]);

  // --------------------------------------------------------------------- view
  const pct = progress && progress.totalBytes > 0 ? (progress.sentBytes / progress.totalBytes) * 100 : 0;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ------------------------------------------------------------ select */}
      {phase === 'select' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import certification case</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select the discovery from this computer. Folders keep their structure, ZIP archives are read
              through, and nothing on your machine is modified.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Reference</span>
              <input
                data-testid="upload-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="GS-001"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Label</span>
              <input
                data-testid="upload-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="People v. Doe — certification corpus"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div
            data-testid="upload-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            {scanning ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Loader2 size={16} className="animate-spin" /> Reading the folder…
              </div>
            ) : (
              <>
                <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Drag &amp; drop discovery here</p>
                <p className="text-xs text-gray-500 mt-1">
                  A whole folder, individual files, ZIP archives, video and audio
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    data-testid="select-files"
                    onClick={() => fileInput.current?.click()}
                    className="px-4 py-2 border border-gray-300 bg-white text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileUp size={15} /> Select Discovery
                  </button>
                  <button
                    data-testid="select-folder"
                    onClick={() => folderInput.current?.click()}
                    className="px-4 py-2 border border-gray-300 bg-white text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FolderUp size={15} /> Select Folder
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && addSelection(collectFromInput(e.target.files))}
            />
            <input
              ref={folderInput}
              type="file"
              multiple
              hidden
              // Non-standard but supported in Chrome, Edge and Safari; this is
              // what makes "select a folder" possible from a browser.
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => e.target.files && addSelection(collectFromInput(e.target.files))}
            />
          </div>

          {selection.length > 0 && (
            <div className="space-y-3" data-testid="selection-summary">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{selection.length}</span> file(s) selected,{' '}
                  {formatBytes(totalBytes)}
                </p>
                <button onClick={() => setSelection([])} className="text-xs text-gray-500 hover:text-gray-700">
                  Clear
                </button>
              </div>
              <div className="max-h-52 overflow-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {selection.slice(0, 300).map((f) => (
                      <tr key={f.relativePath}>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{f.relativePath}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap">
                          {formatBytes(f.file.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                data-testid="start-upload"
                onClick={() => void startUpload()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Upload size={15} /> Upload {selection.length} file(s)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- uploading */}
      {phase === 'uploading' && progress && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5" data-testid="upload-progress">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Uploading discovery</h2>
              <p className="text-sm text-gray-500 mt-0.5 font-mono truncate max-w-xl">
                {progress.currentFile ?? 'Preparing…'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!paused ? (
                <button
                  data-testid="pause-upload"
                  onClick={() => {
                    controllerRef.current?.pause();
                    setPaused(true);
                  }}
                  className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Pause size={14} /> Pause
                </button>
              ) : (
                <button
                  data-testid="resume-upload"
                  onClick={() => void resumeUpload()}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Play size={14} /> Resume
                </button>
              )}
              <button
                data-testid="retry-upload"
                onClick={() => void retryFailed()}
                className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Retry failed
              </button>
              <button
                data-testid="cancel-upload"
                onClick={() => void cancelUpload()}
                className="px-3 py-1.5 border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          </div>

          <div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-xs">
              <Metric label="Overall" value={`${pct.toFixed(1)}%`} />
              <Metric label="Transferred" value={`${formatBytes(progress.sentBytes)} / ${formatBytes(progress.totalBytes)}`} />
              <Metric label="Speed" value={progress.bytesPerSecond ? `${formatBytes(progress.bytesPerSecond)}/s` : '—'} />
              <Metric label="Time remaining" value={formatDuration(progress.secondsRemaining)} />
              <Metric label="Files remaining" value={String(progress.filesRemaining)} />
            </div>
          </div>

          <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                {progress.files.map((f) => (
                  <tr key={f.relativePath}>
                    <td className="px-3 py-1.5 font-mono text-gray-600 truncate max-w-md">{f.relativePath}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-right whitespace-nowrap">
                      {formatBytes(f.sent)} / {formatBytes(f.size)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {f.status === 'complete' ? (
                        <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={11} /> done</span>
                      ) : f.status === 'failed' ? (
                        <span className="text-red-700" title={f.error}>failed</span>
                      ) : f.status === 'uploading' ? (
                        <span className="text-indigo-700">sending</span>
                      ) : (
                        <span className="text-gray-400">queued</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ preview */}
      {phase === 'preview' && preview && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5" data-testid="upload-preview">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Review before processing</h2>
            <p className="text-sm text-gray-500 mt-1">
              {preview.fileCount} file(s), {formatBytes(preview.totalBytes)} received. Nothing has been
              processed yet.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Documents" value={String(preview.detected.documents)} />
            <Metric label="Videos" value={String(preview.detected.videos)} />
            <Metric label="Audio" value={String(preview.detected.audio)} />
            <Metric label="Images" value={String(preview.detected.images)} />
            <Metric label="Pages" value={String(preview.detected.totalPages)} />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Estimated processing time</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Metric label="OCR and extraction" value={formatDuration(preview.estimate.ocrSeconds)} />
              <Metric label="Media" value={formatDuration(preview.estimate.mediaSeconds)} />
              <Metric label="Analysis" value={formatDuration(preview.estimate.analysisSeconds)} />
              <Metric label="Total" value={formatDuration(preview.estimate.totalSeconds)} />
            </div>
            <p className="text-xs text-gray-500 mt-3">{preview.estimate.basis}</p>
          </div>

          {preview.unmeasured.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={13} /> {preview.unmeasured.length} file(s) could not be measured
              </p>
              <ul className="text-xs text-amber-700 mt-2 space-y-1">
                {preview.unmeasured.slice(0, 6).map((u) => (
                  <li key={u.file}>
                    <span className="font-mono">{u.file}</span> — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              data-testid="confirm-processing"
              onClick={() => void commit()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Confirm and process
            </button>
            <button
              onClick={() => void cancelUpload()}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              Discard upload
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- processing */}
      {(phase === 'processing' || phase === 'done') && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4" data-testid="processing-dashboard">
          <div className="flex items-center gap-2">
            {phase === 'processing' ? (
              <Loader2 size={18} className="animate-spin text-indigo-600" />
            ) : status?.status === 'failed' ? (
              <XCircle size={18} className="text-red-600" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-600" />
            )}
            <h2 className="text-base font-semibold text-gray-900">
              {phase === 'processing' ? 'Processing discovery' : status?.status === 'failed' ? 'Processing failed' : 'Certification complete'}
            </h2>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">{status?.stage ?? 'Starting…'}</p>
            {status?.stageDetail && <p className="text-xs text-gray-500 mt-0.5 font-mono">{status.stageDetail}</p>}
          </div>

          {status && status.progressTotal > 0 && (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, (status.progressCurrent / status.progressTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {status.progressCurrent} of {status.progressTotal}
              </p>
            </div>
          )}

          <ol className="text-xs space-y-1.5">
            {['Reading the delivery', 'Ingesting discovery', 'Fingerprinting the corpus', 'Building repositories', 'Certification complete'].map(
              (s) => {
                const reached = status?.stage === s || phase === 'done';
                return (
                  <li key={s} className={`flex items-center gap-2 ${reached ? 'text-gray-900' : 'text-gray-400'}`}>
                    {status?.stage === s ? (
                      <Loader2 size={11} className="animate-spin text-indigo-600" />
                    ) : (
                      <span className={`h-1.5 w-1.5 rounded-full ${reached ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    )}
                    {s}
                  </li>
                );
              },
            )}
          </ol>

          {status?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800">{status.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

export default CertificationUploadPortal;
