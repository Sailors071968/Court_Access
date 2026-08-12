// Upload today's roster (or a historical folder) via the hardened bulk import queue.
// Processing runs asynchronously after upload; the browser is not blocked on ingestion.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListOrdered } from 'lucide-react';

import { intelligenceApi, type RosterUpload } from '@/services/inmateIntelligenceApi';
import { BulkImportPanel } from './BulkImportPanel';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes, formatDateTime, statusTone,
} from './shared';

export function UploadFiles() {
  const [uploads, setUploads] = useState<RosterUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterDate, setRosterDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await intelligenceApi.listUploads({ limit: 50 });
      setUploads(result.uploads);
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

  useEffect(() => {
    const busy = uploads.some((u) => u.status === 'processing' || u.status === 'queued');
    if (!busy) return;
    const timer = window.setTimeout(() => void load(false), 2000);
    return () => window.clearTimeout(timer);
  }, [uploads, load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Upload Files"
        subtitle="Client upload queue with fingerprint skip, automatic batch retry, and resumable Import Jobs. Processing continues after you leave this page."
        actions={
          <Link to="/admin/intelligence/import-jobs">
            <Button variant="secondary">
              <ListOrdered className="h-3.5 w-3.5" /> Import Jobs
            </Button>
          </Link>
        }
      />

      <Panel title="Roster date" description="Applied to new Import Jobs started below.">
        <label className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span className="font-medium">Roster date</span>
          <input
            type="date"
            value={rosterDate}
            onChange={(e) => setRosterDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
      </Panel>

      <BulkImportPanel rosterDate={rosterDate} onJobChanged={() => void load(false)} />

      <Panel
        title="Recent uploads"
        description="Files that landed from Import Jobs or the legacy uploader."
        actions={
          <Link to="/admin/intelligence/queue" className="text-xs font-medium text-blue-700 hover:underline">
            Open processing queue
          </Link>
        }
      >
        {error ? <ErrorNotice message={error} onRetry={() => void load(true)} /> : null}
        {loading ? (
          <Loading label="Loading recent uploads" />
        ) : uploads.length === 0 ? (
          <EmptyState title="No uploads yet" detail="Start a bulk import above." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Status</Th>
                <Th>Size</Th>
                <Th>Uploaded</Th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.uploadId} className="border-t border-gray-100">
                  <Td className="font-mono text-xs">{u.filename}</Td>
                  <Td>
                    <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  </Td>
                  <Td className="tabular-nums text-gray-600">{formatBytes(u.sizeBytes)}</Td>
                  <Td className="tabular-nums text-gray-600">{formatDateTime(u.uploadedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
