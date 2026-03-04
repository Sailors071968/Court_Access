// ============================================
// Court Access — Upload Discovery Materials Tab
// Connected to real backend API
// ============================================

import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, FileText, CheckCircle, MoreHorizontal, Eye, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useDocuments, useDocumentUpload } from '../../hooks/useApi';

export function DocumentsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading, refetch } = useDocuments(caseId);
  const { upload, isUploading } = useDocumentUpload();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!caseId) return;
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await upload(caseId, file);
    }
    refetch();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!caseId || !e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      await upload(caseId, file);
    }
    refetch();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Analyzed';
      case 'processing': return 'Processing';
      case 'failed': return 'Failed';
      default: return 'Pending';
    }
  };

  const allDocs = documents || [];
  const analyzed = allDocs.filter(d => d.analysisStatus === 'completed').length;
  const processing = allDocs.filter(d => d.analysisStatus === 'processing').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload Discovery Materials</h2>
          <p className="text-sm text-gray-500 mt-1">Securely add digital evidence, documents, and multimedia for analysis.</p>
          <p className="text-sm text-gray-400">Supported formats: PDF, TXT, DOCX.</p>
        </div>
        <span className="text-sm text-gray-500">
          {allDocs.length} files uploaded, {analyzed} analyzed{processing > 0 ? `, ${processing} processing` : ''}
        </span>
      </div>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-amber-300 bg-amber-50/30'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600 font-medium">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload size={40} className="mx-auto mb-4 text-gray-400" />
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">PDF</span>
              <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded">TXT</span>
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded">DOCX</span>
            </div>
            <p className="text-gray-600 font-medium">Drag & Drop files here or Click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              id="file-upload"
              multiple
              accept=".pdf,.txt,.docx"
              onChange={handleFileSelect}
            />
            <label htmlFor="file-upload" className="mt-4 inline-block px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors">
              Browse Files
            </label>
          </>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading documents...</span>
        </div>
      )}

      {/* Recently Uploaded Files */}
      {!isLoading && allDocs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
          <div className="space-y-3">
            {allDocs.map((doc) => (
              <Card key={doc.id} padding="sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()} | {statusLabel(doc.analysisStatus)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {doc.analysisStatus === 'completed' && (
                      <CheckCircle size={20} className="text-green-500" />
                    )}
                    {doc.analysisStatus === 'processing' && (
                      <div className="flex items-center gap-2 text-amber-600 text-sm">
                        <span className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                        Processing...
                      </div>
                    )}
                    {doc.analysisStatus === 'pending' && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Queued
                      </div>
                    )}
                    {doc.analysisStatus === 'failed' && (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertCircle size={16} />
                        Failed
                      </div>
                    )}
                    {doc.analysisStatus === 'completed' && (
                      <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 inline-flex items-center gap-1">
                        <Eye size={12} /> View Analysis
                      </button>
                    )}
                    <button className="p-1 text-gray-400 hover:text-gray-600" aria-label="More options">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isLoading && allDocs.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No documents uploaded yet. Upload files to begin analysis.</p>
        </div>
      )}
    </div>
  );
}
