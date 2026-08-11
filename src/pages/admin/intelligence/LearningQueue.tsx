// Learning Queue — every operator discrepancy stays open until NIIS reproduces it.
// Engineering surface (Priority 1–2); not the staff revenue report.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import {
  intelligenceApi,
  type LearningQueueItem,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th,
} from './shared';

export function LearningQueue() {
  const [items, setItems] = useState<LearningQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await intelligenceApi.learningQueue({
        facility: 'sacramento',
        status: status || undefined,
        limit: 200,
      });
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Learning Queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (itemId: string, next: 'in_progress' | 'fixed' | 'verified_regression') => {
    setBusyId(itemId);
    try {
      await intelligenceApi.updateLearningQueueItem(itemId, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[100rem] space-y-5">
      <PageHeader
        title="Learning Queue"
        subtitle="No discrepancy is discarded. Each item is a defect until NIIS reproduces the verified result."
        actions={
          <>
            <select
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="fixed">Fixed</option>
              <option value="verified_regression">Verified regression</option>
            </select>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to="/admin/intelligence">
              <Button variant="secondary">Morning board</Button>
            </Link>
          </>
        }
      />

      {loading ? <Loading label="Loading Learning Queue" /> : null}
      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <Panel title={`${total} item(s)`} description="Sacramento continuous validation defects.">
          {items.length === 0 ? (
            <EmptyState
              title="Queue clear for this filter"
              detail="When manual verification disagrees with NIIS, defects appear here automatically."
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Inmate</Th>
                  <Th>Error</Th>
                  <Th>Root cause</Th>
                  <Th>Status</Th>
                  <Th>Evidence</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.itemId} className="border-t border-gray-100">
                    <Td>{item.date}</Td>
                    <Td>
                      <span className="font-medium text-gray-900">{item.inmate}</span>
                      {item.why ? <p className="mt-0.5 text-xs text-gray-500">{item.why}</p> : null}
                    </Td>
                    <Td>
                      <Badge tone={item.errorType === 'missed_new' ? 'bad' : 'warn'}>
                        {item.errorType}
                      </Badge>
                    </Td>
                    <Td>{item.rootCause}</Td>
                    <Td>{item.status}</Td>
                    <Td>
                      <p className="max-w-xs truncate text-xs text-gray-600" title={item.evidence ?? undefined}>
                        {item.evidence ?? item.stage ?? '—'}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {item.status === 'open' ? (
                          <Button
                            variant="secondary"
                            disabled={busyId === item.itemId}
                            onClick={() => void mark(item.itemId, 'in_progress')}
                          >
                            Start
                          </Button>
                        ) : null}
                        {item.status === 'in_progress' || item.status === 'open' ? (
                          <Button
                            variant="secondary"
                            disabled={busyId === item.itemId}
                            onClick={() => void mark(item.itemId, 'fixed')}
                          >
                            Mark fixed
                          </Button>
                        ) : null}
                        {item.status === 'fixed' ? (
                          <Button
                            variant="primary"
                            disabled={busyId === item.itemId}
                            onClick={() => void mark(item.itemId, 'verified_regression')}
                          >
                            Verify regression
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
