// ============================================================================
// Core Evidence System — Evidence Upload Panel (Part 16)
// Presigned URL upload flow: select file → choose type → upload to S3 → register
// ============================================================================

import { useState, useCallback } from 'react';
import { Upload, X, FileText, Film, Camera, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { uploadEvidence, EVIDENCE_TYPES } from '../../services/caseApi';

interface EvidenceUploadPanelProps {
  caseId: string;
  onUploadComplete?: () => void;
  onClose?: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  evidenceType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('video/')) return <Film size={16} className="text-purple-500" />;
  if (mimeType.startsWith('image/')) return <Camera size={16} className="text-green-500" />;
  return <FileText size={16} className="text-blue-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function EvidenceUploadPanel({ caseId, onUploadComplete, onClose }: EvidenceUploadPanelProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      evidenceType: guessEvidenceType(file),
      progress: 0,
      status: 'pending' as const,
    }));
    setUploads((prev) => [...prev, ...newItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const updateType = useCallback((id: string, evidenceType: string) => {
    setUploads((prev) => prev.map((u) => u.id === id ? { ...u, evidenceType } : u));
  }, []);

  const startUpload = useCallback(async () => {
    const pending = uploads.filter((u) => u.status === 'pending');
    for (const item of pending) {
      setUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: 'uploading' } : u));
      try {
        await uploadEvidence({
          caseId,
          file: item.file,
          evidenceType: item.evidenceType,
          onProgress: (percent) => {
            setUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, progress: percent } : u));
          },
        });
        setUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: 'complete', progress: 100 } : u));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: 'error', error: errorMsg } : u));
      }
    }
    onUploadComplete?.();
  }, [uploads, caseId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const pendingCount = uploads.filter((u) => u.status === 'pending').length;
  const completedCount = uploads.filter((u) => u.status === 'complete').length;
  const hasErrors = uploads.some((u) => u.status === 'error');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Upload Evidence</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Files upload directly to secure storage via presigned URLs
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div className="p-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 mb-2">
            Drag & drop evidence files here, or{' '}
            <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
              browse
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.avi,.webm,.mpeg"
              />
            </label>
          </p>
          <p className="text-xs text-gray-400">
            PDF, images, video files supported. Max 500 MB per file (10 GB for video).
          </p>
        </div>

        {/* Upload Queue */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {uploads.length} file{uploads.length !== 1 ? 's' : ''} selected
                {completedCount > 0 && ` (${completedCount} complete)`}
              </p>
              {pendingCount > 0 && (
                <button
                  onClick={startUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {uploads.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                {getFileIcon(item.file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(item.file.size)}</p>
                  {item.status === 'uploading' && (
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {item.error}
                    </p>
                  )}
                </div>

                {/* Evidence Type Selector */}
                {item.status === 'pending' && (
                  <select
                    value={item.evidenceType}
                    onChange={(e) => updateType(item.id, e.target.value)}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                  >
                    {EVIDENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                )}

                {/* Status Icons */}
                {item.status === 'uploading' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                {item.status === 'complete' && <CheckCircle size={16} className="text-green-500" />}
                {item.status === 'error' && <AlertTriangle size={16} className="text-red-500" />}

                {/* Remove Button */}
                {(item.status === 'pending' || item.status === 'error') && (
                  <button
                    onClick={() => removeFile(item.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Validation Info */}
        {hasErrors && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs text-red-700">
              Some files failed to upload. Multiplexed discovery documents (multiple logical pages per physical page)
              are not accepted. Transcripts allow up to 4-up format.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: guess evidence type from file
// ---------------------------------------------------------------------------

function guessEvidenceType(file: File): string {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const name = file.name.toLowerCase();

  if (['mp4', 'mov', 'avi', 'webm', 'mpeg'].includes(ext)) {
    if (name.includes('bodycam') || name.includes('body_cam') || name.includes('bwc')) return 'bodycam';
    if (name.includes('dashcam') || name.includes('dash_cam') || name.includes('mvr')) return 'dashcam';
    return 'witness_video';
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(ext)) return 'photo';

  if (name.includes('transcript')) return 'transcript';
  if (name.includes('police') || name.includes('incident')) return 'police_report';
  if (name.includes('dispatch')) return 'dispatch_log';
  if (name.includes('forensic')) return 'forensic_report';
  if (name.includes('autopsy')) return 'autopsy_report';

  return 'other_document';
}
