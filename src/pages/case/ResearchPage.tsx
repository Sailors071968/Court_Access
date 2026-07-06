// ============================================
// Court Access — Knowledge Graph & Research Tab
// Uses the reusable Knowledge Graph engine (Program 27).
// ============================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { KnowledgeGraphWorkspace } from '../../components/graph/KnowledgeGraphWorkspace';
import { SAMPLE_GRAPH, fromWorkbenchGraph } from '../../components/graph/adapters';
import type { KnowledgeGraphData } from '../../components/graph/types';
import { fetchWorkbench } from '../../services/workbenchApi';

export function ResearchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  // Production starts empty; demo data only in development.
  const [data, setData] = useState<KnowledgeGraphData>(
    import.meta.env.DEV ? SAMPLE_GRAPH : { nodes: [], edges: [] },
  );

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        const bundle = await fetchWorkbench(caseId);
        const graph = bundle?.evidenceWorkbench?.graph;
        if (!cancelled && graph && graph.nodes?.length) {
          setData(fromWorkbenchGraph(graph));
        }
      } catch {
        // fall back to the representative sample graph
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Graph"
        overline="Intelligence"
        subtitle="Explore how evidence, people, charges, authorities, and events connect."
      />
      {data.nodes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="knowledgeGraph" size={24} />}
            title="Knowledge graph not yet built"
            description="Process case evidence to extract entities and relationships. The graph populates from the repository — no sample data is shown."
          />
        </Card>
      ) : (
        <KnowledgeGraphWorkspace data={data} />
      )}
    </div>
  );
}
