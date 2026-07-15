// ============================================================================
// Court Access — Provenance Badge
// Enforces the Engineering Constitution's labeling: every intelligence surface
// must declare whether it is Repository-Backed, an Illustrative Demonstration,
// or UNKNOWN (repository coverage incomplete). Never present illustrative
// content as if it were repository-backed.
// ============================================================================

import { Database, FlaskConical, HelpCircle } from 'lucide-react';

export type Provenance = 'repository' | 'illustrative' | 'unknown';

const CONFIG: Record<Provenance, { label: string; cls: string; icon: typeof Database }> = {
  repository: {
    label: 'Repository-Backed',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Database,
  },
  illustrative: {
    label: 'Illustrative Demonstration',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: FlaskConical,
  },
  unknown: {
    label: 'UNKNOWN',
    cls: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: HelpCircle,
  },
};

export function ProvenanceBadge({ kind, note }: { kind: Provenance; note?: string }) {
  const { label, cls, icon: Icon } = CONFIG[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
      title={note ?? label}
    >
      <Icon size={13} />
      {label}
      {note && <span className="font-normal opacity-80">· {note}</span>}
    </span>
  );
}
