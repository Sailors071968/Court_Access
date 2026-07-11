// =============================================================================
// CourtAccess — Knowledge Graph layout & analytics (Program 27)
// Dependency-free Fruchterman-Reingold force layout + graph analytics.
// Deterministic (seeded) so the same graph always renders identically.
// =============================================================================

import type { KnowledgeGraphData } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Seeded pseudo-random for deterministic initial placement. */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function computeLayout(
  data: KnowledgeGraphData,
  width = 800,
  height = 520,
  iterations = 300,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  const nodes = data.nodes;
  const n = nodes.length;
  if (n === 0) return positions;

  const rand = seeded(1337);
  const area = width * height;
  const k = Math.sqrt(area / n); // ideal edge length
  const cx = width / 2;
  const cy = height / 2;

  // Deterministic initial positions on a spiral.
  nodes.forEach((node, i) => {
    const angle = i * 2.399963; // golden angle
    const radius = k * 0.6 * Math.sqrt(i + 1) + rand() * 20;
    positions.set(node.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  });

  const disp = new Map<string, Point>();
  let temperature = width / 10;
  const cool = temperature / (iterations + 1);

  for (let iter = 0; iter < iterations; iter++) {
    nodes.forEach((v) => disp.set(v.id, { x: 0, y: 0 }));

    // Repulsive forces (all pairs).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = positions.get(nodes[i].id)!;
        const b = positions.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rep = (k * k) / dist;
        dx = (dx / dist) * rep;
        dy = (dy / dist) * rep;
        const da = disp.get(nodes[i].id)!;
        const db = disp.get(nodes[j].id)!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    // Attractive forces (edges).
    for (const e of data.edges) {
      const a = positions.get(e.from);
      const b = positions.get(e.to);
      if (!a || !b) continue;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const attr = (dist * dist) / k;
      dx = (dx / dist) * attr;
      dy = (dy / dist) * attr;
      const da = disp.get(e.from)!;
      const db = disp.get(e.to)!;
      da.x -= dx;
      da.y -= dy;
      db.x += dx;
      db.y += dy;
    }

    // Apply displacement, capped by temperature; keep pinned nodes fixed.
    for (const node of nodes) {
      if (node.pinned) continue;
      const d = disp.get(node.id)!;
      const len = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const p = positions.get(node.id)!;
      p.x += (d.x / len) * Math.min(len, temperature);
      p.y += (d.y / len) * Math.min(len, temperature);
      p.x = Math.max(30, Math.min(width - 30, p.x));
      p.y = Math.max(30, Math.min(height - 30, p.y));
    }
    temperature -= cool;
  }

  return positions;
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  density: number; // 0–1
  clusterCount: number;
  clusterOf: Map<string, number>;
  degree: Map<string, number>;
  mostConnected: { id: string; degree: number } | null;
}

/** Connected-component clustering + degree centrality + density. */
export function analyzeGraph(data: KnowledgeGraphData): GraphAnalytics {
  const degree = new Map<string, number>();
  data.nodes.forEach((n) => degree.set(n.id, 0));
  const adjacency = new Map<string, string[]>();
  data.nodes.forEach((n) => adjacency.set(n.id, []));

  for (const e of data.edges) {
    if (!degree.has(e.from) || !degree.has(e.to)) continue;
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    adjacency.get(e.from)!.push(e.to);
    adjacency.get(e.to)!.push(e.from);
  }

  // Connected components (BFS).
  const clusterOf = new Map<string, number>();
  let cluster = 0;
  for (const node of data.nodes) {
    if (clusterOf.has(node.id)) continue;
    const queue = [node.id];
    clusterOf.set(node.id, cluster);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adjacency.get(cur) ?? []) {
        if (!clusterOf.has(nb)) {
          clusterOf.set(nb, cluster);
          queue.push(nb);
        }
      }
    }
    cluster++;
  }

  let mostConnected: { id: string; degree: number } | null = null;
  degree.forEach((d, id) => {
    if (!mostConnected || d > mostConnected.degree) mostConnected = { id, degree: d };
  });

  const n = data.nodes.length;
  const maxEdges = (n * (n - 1)) / 2;
  const density = maxEdges > 0 ? data.edges.length / maxEdges : 0;

  return {
    nodeCount: n,
    edgeCount: data.edges.length,
    density,
    clusterCount: cluster,
    clusterOf,
    degree,
    mostConnected,
  };
}
