// ============================================
// Court Access — Upload Discovery Materials Tab
// Wired to canonical caseApi upload + processing pipeline
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, Film, Image, CheckCircle, MoreHorizontal, Eye,
  Loader2, AlertCircle, X,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import {
  fetchCaseEvidence,
  uploadEvidenceDirect,
  pollEvidenceProcessing,
  EVIDENCE_TYPES,
  formatFileSize,
  mapProcessingStatusForDisplay,
  isEvidenceProcessingComplete,
  type ApiEvidence,
} from '../../services/caseApi';

type DisplayStatus = 'analyzed' | 'processing' | 'pending' | 'failed';

interface DisplayFile {
  id: string;
  name: string;
  size: string;
  date: string;
  status: DisplayStatus;
  error: string | null;
  type: 'pdf' | 'mp4' | 'jpg' | 'other';
}

function inferFileType(fileName: string, mimeType: string | null): DisplayFile['type'] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf';
  if (lower.match(/\.(mp4|mov|avi)$/) || mimeType?.startsWith('video/')) return 'mp4';
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/) || mimeType?.startsWith('image/')) return 'jpg';
  return 'other';
}

function toDisplayFile(ev: ApiEvidence): DisplayFile {
  return {
    id: ev.evidenceId,
    name: ev.fileName,
    size: formatFileSize(ev.size),
    date: new Date(ev.uploadedAt).toLocaleString(),
    status: mapProcessingStatusForDisplay(ev.processingStatus),
    error: ev.processingError,
    type: inferFileType(ev.fileName, ev.mimeType),
  };
}

export function DocumentsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<DisplayFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState('other_document');

  const refreshEvidence = useCallback(async () => {
    if (!caseId) return;
    const data = await fetchCaseEvidence(caseId);
    setUploads(data.map(toDisplayFile));
    return data;
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchCaseEvidence(caseId);
        if (!cancelled) {
          setUploads(data.map(toDisplayFile));
          // Resume polling for in-flight uploads from a prior session
          for (const ev of data) {
            if (!isEvidenceProcessingComplete(ev.processingStatus)) {
              void pollEvidenceProcessing(ev.evidenceId, {
                onUpdate: (updated) => {
                  if (!cancelled) {
                    setUploads((prev) =>
                      prev.map((f) => (f.id === updated.evidenceId ? toDisplayFile(updated) : f)),
                    );
                  }
                },
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load documents');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleUploadFile = async (file: File) => {
    if (!caseId || uploading) return;

    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      const newEvidence = await uploadEvidenceDirect({
        caseId,
        file,
        evidenceType,
        onProgress: setUploadProgress,
      });

      setUploads((prev) => [toDisplayFile(newEvidence), ...prev]);

      const finalEvidence = await pollEvidenceProcessing(newEvidence.evidenceId, {
        onUpdate: (ev) => {
          setUploads((prev) =>
            prev.map((f) => (f.id === ev.evidenceId ? toDisplayFile(ev) : f)),
          );
        },
      });

      setUploads((prev) =>
        prev.map((f) => (f.id === finalEvidence.evidenceId ? toDisplayFile(finalEvidence) : f)),
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      await refreshEvidence().catch(() => {});
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUploadFile(file);
  };

  const fileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'mp4': return <Film size={20} className="text-blue-500" />;
      case 'jpg': return <Image size={20} className="text-green-500" />;
      default: return <FileText size={20} className="text-gray-500" />;
    }
  };

  if (!caseId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No case selected. Open a case to upload discovery materials.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload Discovery Materials</h2>
          <p className="text-sm text-gray-500 mt-1">
            Securely add digital evidence, documents, and multimedia for OCR and analysis.
          </p>
          <p className="text-sm text-gray-400">Supported formats: PDF, MP4, JPG/PNG.</p>
        </div>
        {uploads.length > 0 && (
          <span className="text-sm text-gray-500">{uploads.length} file{uploads.length !== 1 ? 's' : ''} uploaded</span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} />
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto" aria-label="Dismiss upload error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-amber-300 bg-amber-50/30'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Upload size={40} className="mx-auto mb-4 text-gray-400" />
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">PDF</span>
          <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded">MP4</span>
          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded">JPG/PNG</span>
        </div>
        <p className="text-gray-600 font-medium">Drag &amp; Drop files here or click to browse</p>

        <div className="mt-4 max-w-xs mx-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Document Type</label>
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            disabled={uploading}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          id="file-upload"
          accept=".pdf,.mp4,.mov,.jpg,.jpeg,.png,.doc,.docx"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadFile(file);
          }}
        />
        <label
          htmlFor="file-upload"
          className={`mt-4 inline-block px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? `Uploading ${uploadProgress}%...` : 'Browse Files'}
        </label>

        {uploading && (
          <div className="mt-4 max-w-md mx-auto">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            {uploadProgress >= 100 && (
              <p className="text-sm text-blue-600 mt-2 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Running OCR and text extraction...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recently Uploaded Files */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Uploaded Files</h3>

        {loading && (
          <div className="text-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Loading documents...</p>
          </div>
        )}

        {!loading && uploads.length === 0 && (
          <p className="text-center text-gray-500 py-8 text-sm">No documents uploaded yet.</p>
        )}

        <div className="space-y-3">
          {uploads.map((file) => (
            <Card key={file.id} padding="sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {fileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {file.size} | {file.date} |{' '}
                    {file.status === 'analyzed' ? 'Analyzed' :
                      file.status === 'processing' ? 'Processing (OCR)' :
                      file.status === 'failed' ? 'Failed' : 'Pending'}
                  </p>
                  {file.error && file.status !== 'processing' && (
                    <p className="text-xs text-amber-600 mt-0.5">{file.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {file.status === 'analyzed' && (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                  {file.status === 'processing' && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </div>
                  )}
                  {file.status === 'failed' && (
                    <AlertCircle size={20} className="text-red-500" />
                  )}
                  {file.status === 'analyzed' ? (
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 inline-flex items-center gap-1">
                      <Eye size={12} /> View
                    </button>
                  ) : null}
                  <button className="p-1 text-gray-400 hover:text-gray-600" aria-label="More options">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
