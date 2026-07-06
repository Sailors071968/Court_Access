import { Icon } from '../icons/registry';
import { Badge } from '../ui/badge';
import { EmptyState } from '../ui/empty-state';
import { ConfidenceIndicator, CitationIndicator } from '../indicators/indicators';
import { NODE_META, type GraphNode, type KnowledgeGraphData } from './types';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  data: KnowledgeGraphData;
  className?: string;
}

/** Detail / "document" pane for the selected graph node (split-screen right side). */
export function NodeDetailPanel({ node, data, className }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className={className}>
        <EmptyState icon={<Icon name="knowledgeGraph" size={22} />} title="Select a node" description="Click any node to see its evidence citations, confidence, repository source, audit history, and relationships." />
      </div>
    );
  }

  const meta = NODE_META[node.type];
  const relationships = data.edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => {
      const otherId = e.from === node.id ? e.to : e.from;
      const other = data.nodes.find((n) => n.id === otherId);
      return { relation: e.relation, strength: e.strength ?? 0.5, other };
    })
    .filter((r) => r.other);

  return (
    <div className={className}>
      <div className="p-4 space-y-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.color + '22' }}>
            <Icon name={meta.icon} size={18} variant="selected" />
          </span>
          <div>
            <Badge variant="default">{meta.label}</Badge>
            <h3 className="text-base font-semibold text-white mt-1">{node.label}</h3>
          </div>
        </div>

        <dl className="space-y-2.5 text-sm">
          {node.confidence !== undefined && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Confidence</dt>
              <dd><ConfidenceIndicator score={node.confidence} /></dd>
            </div>
          )}
          {node.repositorySource && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Repository</dt>
              <dd className="text-slate-300">{node.repositorySource}</dd>
            </div>
          )}
          {node.timestamp && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Timestamp</dt>
              <dd className="text-slate-300">{new Date(node.timestamp).toLocaleString()}</dd>
            </div>
          )}
        </dl>

        {node.evidenceCitations && node.evidenceCitations.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Evidence Citations</p>
            <div className="flex flex-wrap gap-1.5">
              {node.evidenceCitations.map((c) => (
                <CitationIndicator key={c} source={c} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Relationships ({relationships.length})</p>
          <div className="space-y-1.5">
            {relationships.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.03]">
                <span className="text-sm text-slate-200 truncate">
                  <span className="text-gold-light">{r.relation}</span> · {r.other!.label}
                </span>
                <div className="w-16 h-1.5 rounded-full bg-white/10 flex-shrink-0">
                  <div className="h-full rounded-full bg-gold-light" style={{ width: `${r.strength * 100}%` }} />
                </div>
              </div>
            ))}
            {relationships.length === 0 && <p className="text-sm text-slate-500">No relationships.</p>}
          </div>
        </div>

        {node.auditHistory && node.auditHistory.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Audit History</p>
            <ul className="space-y-1.5">
              {node.auditHistory.map((a, i) => (
                <li key={i} className="text-xs text-slate-400">
                  <span className="text-slate-500">{new Date(a.at).toLocaleString()}</span> — {a.event}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
