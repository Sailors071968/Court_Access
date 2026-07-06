// ============================================================================
// CourtAccess — Document Workspace (Program 29)
// Beautiful reading + AI extraction experience on the design system.
// Split-screen reader + analysis, document compare, minimal distractions.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Columns, Download } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { SearchBar } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { SplitPane } from '../../components/layout/split-pane';
import { EvidenceStatus } from '../../components/indicators/indicators';
import { DocumentReader } from '../../components/document/DocumentReader';
import { DocumentAnalysisPanel } from '../../components/document/DocumentAnalysisPanel';
import { mediaKind } from '../../components/evidence/MediaPreview';
import { fetchCaseEvidence, type ApiEvidence } from '../../services/caseApi';
import { cn } from '../../lib/utils';

export function DocumentsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [docs, setDocs] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchCaseEvidence(caseId).catch(() => []);
        const documents = (data ?? []).filter((e) => {
          const kind = mediaKind(e.fileName, e.mimeType);
          return kind === 'pdf' || kind === 'text' || kind === 'image' || kind === 'other';
        });
        if (!cancelled) {
          setDocs(documents);
          setSelectedId(documents[0]?.evidenceId ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const filtered = useMemo(
    () => docs.filter((d) => !search || d.fileName.toLowerCase().includes(search.toLowerCase())),
    [docs, search],
  );

  const selected = docs.find((d) => d.evidenceId === selectedId) ?? null;
  const compareDoc = docs.find((d) => d.evidenceId === compareId) ?? null;

  if (loading) return <Spinner label="Loading documents…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Workspace"
        overline="Documents"
        subtitle={`${docs.length} document${docs.length === 1 ? '' : 's'}`}
        action={
          selected && (
            <div className="flex items-center gap-3">
              <Button
                variant={compareMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setCompareMode((v) => !v)}
              >
                <Columns size={14} /> Compare
              </Button>
              <Button variant="secondary" size="sm">
                <Download size={14} /> Export
              </Button>
            </div>
          )
        }
      />

      {docs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="documents" size={24} />}
            title="No documents yet"
            description="Upload discovery in the Evidence tab to begin OCR, AI extraction, and citation mapping."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6">
          {/* Document list rail */}
          <div className="space-y-3">
            <SearchBar placeholder="Find document…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="space-y-1.5">
              {filtered.map((d) => {
                const isActive = d.evidenceId === selectedId;
                return (
                  <button
                    key={d.evidenceId}
                    onClick={() => (compareMode ? setCompareId(d.evidenceId) : setSelectedId(d.evidenceId))}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left border transition-colors',
                      isActive ? 'bg-gold/10 border-gold/25' : 'border-transparent hover:bg-white/5',
                    )}
                  >
                    <Icon name="documents" size={15} variant={isActive ? 'selected' : 'default'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white truncate">{d.fileName}</span>
                      <span className="mt-1 block"><EvidenceStatus status={d.processingStatus} /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reader + analysis */}
          {selected && (
            <Card padding="none" className="h-[36rem] overflow-hidden">
              {compareMode && compareDoc ? (
                <SplitPane
                  left={<DocumentReader evidence={selected} className="h-full" />}
                  right={<DocumentReader evidence={compareDoc} className="h-full" />}
                />
              ) : (
                <SplitPane
                  initialLeftPercent={60}
                  left={<DocumentReader evidence={selected} className="h-full" />}
                  right={<DocumentAnalysisPanel evidence={selected} className="h-full overflow-y-auto bg-navy-900/40" />}
                />
              )}
            </Card>
          )}

          {compareMode && !compareDoc && (
            <Card>
              <EmptyState icon={<Icon name="documents" size={22} />} title="Pick a document to compare" description="Select a second document from the list to view side-by-side." />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
