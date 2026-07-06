import { cn } from '../../lib/utils';

type ProgressTone = 'gold' | 'emerald' | 'blue' | 'red' | 'violet';

const TONE_FILL: Record<ProgressTone, string> = {
  gold: 'bg-gold-light',
  emerald: 'bg-emerald-400',
  blue: 'bg-blue-400',
  red: 'bg-red-400',
  violet: 'bg-violet-400',
};

const TONE_STROKE: Record<ProgressTone, string> = {
  gold: '#eab360',
  emerald: '#34d399',
  blue: '#60a5fa',
  red: '#f87171',
  violet: '#a78bfa',
};

interface ProgressBarProps {
  value: number; // 0–100
  tone?: ProgressTone;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressBar({ value, tone = 'gold', label, showValue, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-slate-400">{label}</span>}
          {showValue && <span className="text-white font-medium tabular-nums">{pct}%</span>}
        </div>
      )}
      <div
        className="h-2 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full transition-all duration-500', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  tone?: ProgressTone;
  label?: string;
  sublabel?: string;
  className?: string;
}

/** Circular progress gauge (case strength / confidence). */
export function ProgressRing({ value, size = 112, tone = 'gold', label, sublabel, className }: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white tabular-nums">{label ?? `${pct}%`}</span>
        {sublabel && <span className="text-[10px] font-semibold text-gold-light uppercase tracking-wide">{sublabel}</span>}
      </div>
    </div>
  );
}
