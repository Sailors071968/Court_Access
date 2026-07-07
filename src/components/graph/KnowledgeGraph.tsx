// =============================================================================
// CourtAccess — Knowledge Graph visualization engine (Program 27)
// One reusable, dependency-free graph. SVG edges + HTML node chips inside a
// pan/zoom transform. Supports expand/collapse, pin, filter, clustering,
// relationship strength, selection, and analytics. No duplicated graph code.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, Maximize2, Pin } from 'lucide-react';
import { Icon } from '../icons/registry';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import {
  NODE_META,
  CLUSTER_COLORS,
  type GraphNode,
  type GraphNodeType,
  type KnowledgeGraphData,
} from './types';
import { computeLayout, analyzeGraph, type Point } from './layout';

interface KnowledgeGraphProps {
  data: KnowledgeGraphData;
  height?: number;
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
  /** External highlight (e.g. timeline synchronization). */
  highlightIds?: string[];
  className?: string;
}

export function KnowledgeGraph({
  data,
  height = 520,
  selectedId,
  onSelect,
  highlightIds,
  className,
}: KnowledgeGraphProps) {
  const width = 900;
  const [positions, setPositions] = useState<Map<string, Point>>(new Map());
  const [pinned, setPinned] = useState<Set<string>>(new Set(data.nodes.filter((n) => n.pinned).map((n) => n.id)));
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphNodeType>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const dragRef = useRef<{ id: string | null; startX: number; startY: number; mode: 'node' | 'pan' } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const selected = selectedId !== undefined ? selectedId : internalSel;
  const analytics = useMemo(() => analyzeGraph(data), [data]);

  // Recompute layout when the graph structure changes.
  useEffect(() => {
    const dataWithPins = {
      ...data,
      nodes: data.nodes.map((n) => ({ ...n, pinned: pinned.has(n.id) })),
    };
    setPositions(computeLayout(dataWithPins, width, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes.length, data.edges.length]);

  // Visibility: filter by type + collapse (hide neighbors of collapsed nodes
  // that have no other visible connection).
  const visibleNodeIds = useMemo(() => {
    const collapsedNeighbors = new Set<string>();
    if (collapsed.size > 0) {
      const keep = new Set(data.nodes.map((n) => n.id));
      for (const e of data.edges) {
        if (collapsed.has(e.from)) collapsedNeighbors.add(e.to);
        if (collapsed.has(e.to)) collapsedNeighbors.add(e.from);
      }
      // Only hide neighbors that connect solely to collapsed nodes.
      for (const nb of collapsedNeighbors) {
        const others = data.edges.filter(
          (e) => (e.from === nb || e.to === nb) && !collapsed.has(e.from) && !collapsed.has(e.to),
        );
        if (others.length === 0 && !collapsed.has(nb)) keep.delete(nb);
      }
      return new Set([...keep].filter((id) => !hiddenTypes.has(data.nodes.find((n) => n.id === id)!.type)));
    }
    return new Set(data.nodes.filter((n) => !hiddenTypes.has(n.type)).map((n) => n.id));
  }, [data, hiddenTypes, collapsed]);

  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>();
    for (const e of data.edges) {
      if (e.from === selected) set.add(e.to);
      if (e.to === selected) set.add(e.from);
    }
    return set;
  }, [selected, data.edges]);

  const highlightSet = useMemo(() => new Set(highlightIds ?? []), [highlightIds]);

  const selectNode = (node: GraphNode | null) => {
    setInternalSel(node?.id ?? null);
    onSelect?.(node);
  };

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Pointer handlers for pan + node drag.
  const onPointerDownSurface = (e: React.PointerEvent) => {
    if (e.target === surfaceRef.current) {
      dragRef.current = { id: null, startX: e.clientX - pan.x, startY: e.clientY - pan.y, mode: 'pan' };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'pan') {
      setPan({ x: e.clientX - d.startX, y: e.clientY - d.startY });
    } else if (d.mode === 'node' && d.id) {
      setPositions((prev) => {
        const next = new Map(prev);
        const p = next.get(d.id!);
        if (p) next.set(d.id!, { x: p.x + e.movementX / scale, y: p.y + e.movementY / scale });
        return next;
      });
    }
  };
  const endDrag = () => (dragRef.current = null);

  const startNodeDrag = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, mode: 'node' };
    setPinned((prev) => new Set(prev).add(id));
  };

  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  return (
    <div className={cn('ca-panel overflow-hidden', className)}>
      {/* Analytics + filter toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 flex-1">
          <Icon name="knowledgeGraph" size={18} variant="selected" />
          <h3 className="text-sm font-semibold text-white">Knowledge Graph</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <span>{analytics.nodeCount} nodes</span>
          <span>{analytics.edgeCount} edges</span>
          <span>{analytics.clusterCount} clusters</span>
          <span>density {(analytics.density * 100).toFixed(0)}%</span>
          {analytics.mostConnected && (
            <span className="text-gold-light">hub: {nodeById.get(analytics.mostConnected.id)?.label ?? '—'}</span>
          )}
        </div>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
        {(Object.keys(NODE_META) as GraphNodeType[])
          .filter((t) => data.nodes.some((n) => n.type === t))
          .map((t) => {
            const active = !hiddenTypes.has(t);
            return (
              <button
                key={t}
                onClick={() =>
                  setHiddenTypes((prev) => {
                    const next = new Set(prev);
                    next.has(t) ? next.delete(t) : next.add(t);
                    return next;
                  })
                }
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors',
                  active ? 'border-white/15 text-slate-200' : 'border-white/5 text-slate-300',
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: NODE_META[t].color }} />
                {NODE_META[t].label}
              </button>
            );
          })}
      </div>

      {/* Graph surface */}
      <div className="relative" style={{ height }}>
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
          <button onClick={() => setScale((s) => Math.min(2, s + 0.2))} className="p-1.5 rounded-lg ca-panel text-slate-300 hover:text-white" aria-label="Zoom in"><Plus size={14} /></button>
          <button onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} className="p-1.5 rounded-lg ca-panel text-slate-300 hover:text-white" aria-label="Zoom out"><Minus size={14} /></button>
          <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-lg ca-panel text-slate-300 hover:text-white" aria-label="Reset view"><Maximize2 size={14} /></button>
        </div>

        <div
          ref={surfaceRef}
          onPointerDown={onPointerDownSurface}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          className="absolute inset-0 ca-grid-overlay bg-navy-900/40 cursor-grab active:cursor-grabbing overflow-hidden"
        >
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          >
            {/* Edges */}
            <svg width={width} height={height} className="absolute top-0 left-0 pointer-events-none overflow-visible">
              {data.edges.map((e, i) => {
                const a = positions.get(e.from);
                const b = positions.get(e.to);
                if (!a || !b) return null;
                if (!visibleNodeIds.has(e.from) || !visibleNodeIds.has(e.to)) return null;
                const isActive = selected === e.from || selected === e.to;
                const strength = e.strength ?? 0.5;
                return (
                  <g key={i}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={isActive ? '#eab360' : 'rgba(255,255,255,0.12)'}
                      strokeWidth={1 + strength * 3}
                    />
                    {isActive && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} fill="#eab360" fontSize={9} textAnchor="middle" className="select-none">
                        {e.relation}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {data.nodes.map((node) => {
              if (!visibleNodeIds.has(node.id)) return null;
              const p = positions.get(node.id);
              if (!p) return null;
              const meta = NODE_META[node.type];
              const clusterColor = CLUSTER_COLORS[(analytics.clusterOf.get(node.id) ?? 0) % CLUSTER_COLORS.length];
              const isSel = selected === node.id;
              const isNeighbor = neighborIds.has(node.id);
              const dimmed = selected && !isSel && !isNeighbor;
              const isHighlighted = highlightSet.has(node.id);
              return (
                <button
                  key={node.id}
                  onPointerDown={startNodeDrag(node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(isSel ? null : node);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-opacity',
                    dimmed ? 'opacity-30' : 'opacity-100',
                    isSel ? 'bg-gold/20 text-white shadow-gold' : 'bg-navy-600 text-slate-200 hover:bg-navy-500',
                  )}
                  style={{
                    left: p.x,
                    top: p.y,
                    borderColor: isHighlighted ? '#eab360' : clusterColor,
                    borderWidth: isSel || isHighlighted ? 2 : 1,
                  }}
                  title={`${meta.label}: ${node.label}`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: meta.color + '33' }}>
                    <Icon name={meta.icon} size={11} className="" />
                  </span>
                  <span className="max-w-[10rem] truncate">{node.label}</span>
                  {collapsed.has(node.id) && <Badge variant="default">+</Badge>}
                  {pinned.has(node.id) && <Pin size={10} className="text-gold-light" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected node quick actions */}
      {selected && nodeById.get(selected) && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm text-white">
            <Icon name={NODE_META[nodeById.get(selected)!.type].icon} size={15} variant="selected" />
            {nodeById.get(selected)!.label}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleCollapse(selected)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5">
              {collapsed.has(selected) ? 'Expand' : 'Collapse'}
            </button>
            <button onClick={() => togglePin(selected)} className="text-xs text-slate-400 hover:text-gold-light px-2 py-1 rounded-lg hover:bg-white/5 inline-flex items-center gap-1">
              <Pin size={12} /> {pinned.has(selected) ? 'Unpin' : 'Pin'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
