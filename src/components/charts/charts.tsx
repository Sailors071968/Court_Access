// =============================================================================
// CourtAccess — Lightweight SVG chart wrappers (Program 18)
// Dependency-free, dark-mode-first. For heavier charts, wrap recharts here later.
// =============================================================================

import { cn } from '../../lib/utils';

const GOLD = '#eab360';

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({
  data,
  width = 240,
  height = 64,
  stroke = GOLD,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((d, i) => `${i * step},${height - ((d - min) / range) * (height - 8) - 4}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('w-full', className)} preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id="ca-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ca-spark-fill)" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────
export function BarChart({
  data,
  height = 120,
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn('flex items-end gap-2', className)} style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
          <div
            className="w-full rounded-t-md bg-gold-light/70 hover:bg-gold-light transition-colors"
            style={{ height: `${(d.value / max) * (height - 24)}px` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[10px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────
const DONUT_COLORS = ['#eab360', '#60a5fa', '#a78bfa', '#34d399', '#f87171'];

export function DonutChart({
  data,
  size = 140,
  className,
}: {
  data: { label: string; value: number }[];
  size?: number;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90 flex-shrink-0">
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumference;
          const seg = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={12}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <ul className="space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            {d.label}
            <span className="text-slate-400 tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Containers for graph / timeline visualizations ───────────────────────────
export function KnowledgeGraphContainer({
  children,
  height = 420,
  toolbar,
  className,
}: {
  children: React.ReactNode;
  height?: number;
  toolbar?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ca-panel overflow-hidden', className)}>
      {toolbar && <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">{toolbar}</div>}
      <div className="relative ca-grid-overlay bg-navy-900/50" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export function TimelineContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('ca-panel p-5', className)}>{children}</div>;
}
