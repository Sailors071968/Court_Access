// ============================================
// Court Access — Upload Discovery Materials Tab
// ============================================

import { useState, useEffect } from 'react';
import { Upload, FileText, Film, Image, CheckCircle, MoreHorizontal, Eye } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { loadPanel } from '../../services/authedFetch';
import { Card } from '../../components/common/Card';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  date: string;
  status: 'analyzed' | 'processing' | 'pending';
  type: 'pdf' | 'mp4' | 'jpg';
}



function extensionOf(fileName: string): UploadedFile['type'] {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return 'mp4';
  if (['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'webp'].includes(ext)) return 'jpg';
  return 'pdf';
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    async function fetchUploads() {
      // The case's evidence list is the real source for this panel. It
      // previously requested /api/evidence/uploads, which does not exist and
      // collides with GET /api/evidence/:evidenceId, so the panel was always
      // empty.
      const { data, unavailableReason: reason } = await loadPanel<{
        evidence?: Array<{
          evidenceId: string;
          fileName: string;
          size: string | number;
          uploadedAt: string;
          processingStatus: string;
        }>;
      }>(`/cases/${caseId}/evidence`, 'Uploaded documents');

      setUnavailableReason(reason);
      if (data?.evidence) {
        setUploads(
          data.evidence.map((e) => ({
            id: e.evidenceId,
            name: e.fileName,
            size: formatSize(Number(e.size)),
            date: new Date(e.uploadedAt).toLocaleDateString(),
            status:
              e.processingStatus === 'analyzed'
                ? 'analyzed'
                : e.processingStatus === 'failed'
                  ? 'pending'
                  : 'processing',
            type: extensionOf(e.fileName),
          })),
        );
      }
    }
    fetchUploads();
  }, [caseId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const fileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'mp4': return <Film size={20} className="text-blue-500" />;
      case 'jpg': return <Image size={20} className="text-green-500" />;
      default: return <FileText size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload Discovery Materials</h2>
          <p className="text-sm text-gray-500 mt-1">Securely add digital evidence, documents, and multimedia for analysis.</p>
          <p className="text-sm text-gray-400">Supported formats: PDF, MP4, JPG/PNG.</p>
        </div>
        {uploads.length > 0 && <span className="text-sm text-gray-500">Status: {uploads.length} files uploaded</span>}
      </div>

      {unavailableReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-800">The uploaded document list could not be loaded</p>
          <p className="text-xs text-red-700 mt-1">{unavailableReason}</p>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-amber-300 bg-amber-50/30'
        }`}
      >
        <Upload size={40} className="mx-auto mb-4 text-gray-400" />
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">PDF</span>
          <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded">MP4</span>
          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded">JPG/PNG</span>
        </div>
        <p className="text-gray-600 font-medium">Drag & Drop files here or Click to browse</p>
        <input type="file" className="hidden" id="file-upload" multiple accept=".pdf,.mp4,.jpg,.jpeg,.png" />
        <label htmlFor="file-upload" className="mt-4 inline-block px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors">
          Browse Files
        </label>
      </div>

      {/* Recently Uploaded Files */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Uploaded Files</h3>
        <div className="space-y-3">
          {uploads.map((file) => (
            <Card key={file.id} padding="sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {fileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{file.size} | {file.date} | {file.status === 'analyzed' ? 'Analyzed' : file.status === 'processing' ? 'Processing' : 'Pending'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {file.status === 'analyzed' && (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                  {file.status === 'processing' && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <span className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                      Processing...
                    </div>
                  )}
                  {file.status === 'analyzed' ? (
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 inline-flex items-center gap-1">
                      <Eye size={12} /> View Analysis
                    </button>
                  ) : file.status === 'processing' ? (
                    <button className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300">
                      Cancel
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
