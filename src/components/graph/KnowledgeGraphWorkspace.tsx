import { useState } from 'react';
import { KnowledgeGraph } from './KnowledgeGraph';
import { NodeDetailPanel } from './NodeDetailPanel';
import { SplitPane } from '../layout/split-pane';
import type { GraphNode, KnowledgeGraphData } from './types';
import { cn } from '../../lib/utils';

interface KnowledgeGraphWorkspaceProps {
  data: KnowledgeGraphData;
  height?: number;
  /** Node IDs to highlight (e.g. from timeline synchronization). */
  highlightIds?: string[];
  className?: string;
}

/**
 * Split-screen knowledge-graph workspace: interactive graph on the left,
 * node detail / document viewer on the right. Reuses SplitPane + the engine.
 */
export function KnowledgeGraphWorkspace({ data, height = 560, highlightIds, className }: KnowledgeGraphWorkspaceProps) {
  const [selected, setSelected] = useState<GraphNode | null>(null);

  return (
    <div className={cn('ca-panel overflow-hidden', className)} style={{ height }}>
      <SplitPane
        initialLeftPercent={62}
        left={
          <KnowledgeGraph
            data={data}
            height={height}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            highlightIds={highlightIds}
            className="!rounded-none !border-0 !shadow-none h-full"
          />
        }
        right={<NodeDetailPanel node={selected} data={data} className="h-full overflow-y-auto bg-navy-900/40" />}
      />
    </div>
  );
}
