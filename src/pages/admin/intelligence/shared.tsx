// Shared chrome for the New Inmate Intelligence pages.
//
// Eight pages that must look like one subsystem. Kept local to the folder rather
// than promoted to components/common, because these carry assumptions specific to
// this dashboard (a confidence is a percentage, a severity is one of four words) and
// a shared component that has to be told those things every time is not shared.

import { AlertTriangle, Loader2, Printer, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'primary';
}) {
  const tones: Record<string, string> = {
    neutral: 'text-gray-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
    primary: 'text-blue-700',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  title,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  testId?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 disabled:text-gray-400',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {detail ? <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">{detail}</p> : null}
    </div>
  );
}

/** A confidence, shown as a number and coloured by band rather than by threshold. */
export function Confidence({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">—</span>;
  const tone = value >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : value >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
      {value}%
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    bad: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Engineering Law #0 — visually distinguish Fact / Conclusion / Intelligence / UNKNOWN. */
export function TruthBadge({
  category,
}: {
  category: 'verified_fact' | 'verified_conclusion' | 'analytical_intelligence' | 'unknown' | string;
}) {
  switch (category) {
    case 'verified_fact':
      return <Badge tone="good">Fact</Badge>;
    case 'verified_conclusion':
      return <Badge tone="info">Conclusion</Badge>;
    case 'analytical_intelligence':
      return <Badge tone="warn">Intelligence · Not Fact</Badge>;
    case 'unknown':
      return <Badge tone="bad">UNKNOWN</Badge>;
    default:
      return <Badge tone="neutral">{category}</Badge>;
  }
}

export function severityTone(severity: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  switch (severity) {
    case 'critical': return 'bad';
    case 'significant': return 'warn';
    case 'notable': return 'info';
    case 'error': return 'bad';
    case 'warning': return 'warn';
    default: return 'neutral';
  }
}

export function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  switch (status) {
    case 'completed': return 'good';
    case 'failed': return 'bad';
    case 'processing': return 'info';
    case 'queued': return 'warn';
    default: return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
};

/** Dates are shown as the day they describe, not localised into a different one. */
export const formatDay = (iso: string | null): string => (iso ? iso.slice(0, 10) : '—');

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

export const formatMoney = (amount: string | null): string => {
  if (amount === null) return '—';
  const value = Number(amount);
  return Number.isNaN(value)
    ? amount
    : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

/**
 * Print a server-rendered document.
 *
 * Written into a hidden iframe rather than a popup: a popup is blocked by default in
 * most browsers, and an operator whose report silently failed to open has no way to
 * tell that from a report that was empty. The iframe is removed after printing.
 */
export function printHtmlDocument(html: string, onError?: (message: string) => void): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    document.body.removeChild(frame);
    onError?.('The report could not be prepared for printing in this browser.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // The document must have laid out before printing, or the print dialog shows a
  // blank page. A load listener is more reliable than a timeout.
  const print = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Left long enough for the dialog to take its snapshot; removing immediately
      // cancels the print in Safari.
      window.setTimeout(() => {
        if (frame.parentNode) document.body.removeChild(frame);
      }, 2000);
    }
  };

  if (frame.contentWindow.document.readyState === 'complete') print();
  else frame.contentWindow.addEventListener('load', print, { once: true });
}

export function PrintButton({ onClick, label = 'Print' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="secondary" onClick={onClick} testId="print-button">
      <Printer className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

/** A table that scrolls horizontally rather than crushing its columns. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children = null,
  onClick,
  active,
  direction,
  align = 'left',
}: {
  children?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  direction?: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
}) {
  const alignment = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 ${alignment} ${onClick ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick ? (
          <span className={`text-[10px] ${active ? 'text-gray-900' : 'text-gray-300'}`}>
            {active && direction === 'asc' ? '▲' : '▼'}
          </span>
        ) : null}
      </span>
    </th>
  );
}

export function Td({
  children = null,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignment = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={`border-b border-gray-100 px-3 py-2 align-top ${alignment} ${className}`}>{children}</td>;
}
