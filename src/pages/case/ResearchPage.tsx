// ============================================
// Court Access — Knowledge Graph & Research Tab
// Uses the reusable Knowledge Graph engine (Program 27).
// ============================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/page-header';
import { KnowledgeGraphWorkspace } from '../../components/graph/KnowledgeGraphWorkspace';
import { SAMPLE_GRAPH, fromWorkbenchGraph } from '../../components/graph/adapters';
import type { KnowledgeGraphData } from '../../components/graph/types';
import { fetchWorkbench } from '../../services/workbenchApi';

export function ResearchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<KnowledgeGraphData>(SAMPLE_GRAPH);

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
      <KnowledgeGraphWorkspace data={data} />
    </div>
  );
}
