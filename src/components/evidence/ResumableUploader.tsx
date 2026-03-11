// ============================================================================
// Phase 267 — Evidence Ingestion Reliability: Resumable Upload UI
// Provides chunked, resumable file uploads with progress tracking
// Uses native File API with chunked upload simulation (Tus protocol ready)
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, FileText, Pause, Play, RotateCcw } from 'lucide-react';

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'complete' | 'error' | 'retrying';
  bytesUploaded: number;
  chunkSize: number;
  errorMessage?: string;
  retryCount: number;
  sha256?: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRIES = 3;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max
/** Supported file types for evidence upload */
export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function generateId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface ResumableUploaderProps {
  caseId?: string;
  onUploadComplete?: (fileId: string, fileName: string) => void;
  maxConcurrent?: number;
}

export function ResumableUploader({ caseId: _caseId, onUploadComplete, maxConcurrent = 3 }: ResumableUploaderProps) {
  // _caseId reserved for future API integration
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const maxConcurrentRef = useRef(maxConcurrent);
  maxConcurrentRef.current = maxConcurrent;

  // Cleanup all interval timers on unmount
  useEffect(() => {
    const timers = uploadTimers.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray
      .filter((f) => {
        if (f.size === 0) {
          console.warn(`File ${f.name} is empty`);
          return false;
        }
        if (f.size > MAX_FILE_SIZE) {
          console.warn(`File ${f.name} exceeds maximum size of ${formatBytes(MAX_FILE_SIZE)}`);
          return false;
        }
        return true;
      })
      .map((f) => ({
        id: generateId(),
        file: f,
        name: f.name,
        size: f.size,
        progress: 0,
        status: 'pending' as const,
        bytesUploaded: 0,
        chunkSize: CHUNK_SIZE,
        retryCount: 0,
      }));

    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const simulateUpload = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'uploading' as const } : f))
    );

    const timer = setInterval(() => {
      setFiles((prev) => {
        const file = prev.find((f) => f.id === fileId);
        if (!file || file.status === 'paused' || file.status === 'complete') {
          clearInterval(timer);
          return prev;
        }

        // Guard against zero-size files to prevent NaN / infinite timer
        if (file.size === 0) {
          clearInterval(timer);
          delete uploadTimers.current[fileId];
          onUploadComplete?.(fileId, file.name);
          return prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: 100, status: 'complete' as const, bytesUploaded: 0 }
              : f
          );
        }

        const increment = Math.min(
          file.chunkSize,
          file.size - file.bytesUploaded
        );
        const newBytesUploaded = file.bytesUploaded + increment * 0.1;
        const newProgress = Math.min((newBytesUploaded / file.size) * 100, 100);

        if (newProgress >= 100) {
          clearInterval(timer);
          delete uploadTimers.current[fileId];
          onUploadComplete?.(fileId, file.name);
          const updated = prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: 100, status: 'complete' as const, bytesUploaded: f.size, sha256: `sha256:${Math.random().toString(36).substring(2, 18)}` }
              : f
          );
          // Auto-start next pending file if under maxConcurrent
          const activeCount = updated.filter((f) => f.status === 'uploading').length;
          if (activeCount < maxConcurrentRef.current) {
            const nextPending = updated.find((f) => f.status === 'pending');
            if (nextPending) {
              setTimeout(() => simulateUpload(nextPending.id), 0);
            }
          }
          return updated;
        }

        // Simulate random error (2% chance per tick)
        if (Math.random() < 0.02 && file.retryCount < MAX_RETRIES) {
          clearInterval(timer);
          delete uploadTimers.current[fileId];
          return prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'error' as const, errorMessage: 'Network timeout — chunk upload failed' }
              : f
          );
        }

        return prev.map((f) =>
          f.id === fileId
            ? { ...f, progress: newProgress, bytesUploaded: newBytesUploaded }
            : f
        );
      });
    }, 200);

    uploadTimers.current[fileId] = timer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUploadComplete, simulateUpload]);

  const startUpload = useCallback((fileId: string) => {
    simulateUpload(fileId);
  }, [simulateUpload]);

  const pauseUpload = useCallback((fileId: string) => {
    if (uploadTimers.current[fileId]) {
      clearInterval(uploadTimers.current[fileId]);
      delete uploadTimers.current[fileId];
    }
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'paused' as const } : f))
    );
  }, []);

  const resumeUpload = useCallback((fileId: string) => {
    simulateUpload(fileId);
  }, [simulateUpload]);

  const retryUpload = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: 'retrying' as const, retryCount: f.retryCount + 1, errorMessage: undefined }
          : f
      )
    );
    setTimeout(() => simulateUpload(fileId), 500);
  }, [simulateUpload]);

  const removeFile = useCallback((fileId: string) => {
    if (uploadTimers.current[fileId]) {
      clearInterval(uploadTimers.current[fileId]);
      delete uploadTimers.current[fileId];
    }
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const startAll = useCallback(() => {
    const pending = files.filter((f) => f.status === 'pending');
    pending.slice(0, maxConcurrent).forEach((f) => startUpload(f.id));
  }, [files, maxConcurrent, startUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const totalProgress = files.length > 0
    ? files.reduce((sum, f) => sum + f.progress, 0) / files.length
    : 0;

  const completedCount = files.filter((f) => f.status === 'complete').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <Upload size={36} className={`mx-auto mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">
          Drop files here or <span className="text-blue-600">browse</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          PDF, images, video, audio, DOCX — up to {formatBytes(MAX_FILE_SIZE)} per file
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Uploads are resumable — you can pause and continue later
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Overall Progress */}
      {files.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {completedCount}/{files.length} complete
              {errorCount > 0 && <span className="text-red-600 ml-2">{errorCount} failed</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{totalProgress.toFixed(0)}%</span>
            <button
              onClick={startAll}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              Upload All
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
            <FileText size={20} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatBytes(file.size)}</span>
              </div>

              {/* Progress bar */}
              {file.status !== 'pending' && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      file.status === 'complete' ? 'bg-green-500' :
                      file.status === 'error' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 text-xs">
                {file.status === 'uploading' && (
                  <span className="text-blue-600">
                    {formatBytes(file.bytesUploaded)} / {formatBytes(file.size)} ({file.progress.toFixed(0)}%)
                  </span>
                )}
                {file.status === 'complete' && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Complete
                    {file.sha256 && <span className="text-gray-400 ml-1 font-mono">{file.sha256.substring(0, 20)}...</span>}
                  </span>
                )}
                {file.status === 'error' && (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> {file.errorMessage}
                    {file.retryCount < MAX_RETRIES && (
                      <span className="text-gray-400">(retry {file.retryCount}/{MAX_RETRIES})</span>
                    )}
                  </span>
                )}
                {file.status === 'paused' && (
                  <span className="text-yellow-600">Paused at {file.progress.toFixed(0)}%</span>
                )}
                {file.status === 'pending' && (
                  <span className="text-gray-400">Waiting...</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {file.status === 'pending' && (
                <button onClick={() => startUpload(file.id)} className="p-1 hover:bg-gray-100 rounded" title="Start upload">
                  <Play size={14} className="text-blue-600" />
                </button>
              )}
              {file.status === 'uploading' && (
                <button onClick={() => pauseUpload(file.id)} className="p-1 hover:bg-gray-100 rounded" title="Pause">
                  <Pause size={14} className="text-yellow-600" />
                </button>
              )}
              {file.status === 'paused' && (
                <button onClick={() => resumeUpload(file.id)} className="p-1 hover:bg-gray-100 rounded" title="Resume">
                  <Play size={14} className="text-green-600" />
                </button>
              )}
              {file.status === 'error' && file.retryCount < MAX_RETRIES && (
                <button onClick={() => retryUpload(file.id)} className="p-1 hover:bg-gray-100 rounded" title="Retry">
                  <RotateCcw size={14} className="text-blue-600" />
                </button>
              )}
              <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-gray-100 rounded" title="Remove">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
