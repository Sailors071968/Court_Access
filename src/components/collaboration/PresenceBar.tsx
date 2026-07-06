import { cn } from '../../lib/utils';
import { ROLE_LABELS, type Collaborator } from './types';

interface PresenceBarProps {
  collaborators: Collaborator[];
  className?: string;
}

/** Presence + typing indicators. Renders from provided state (wire to realtime later). */
export function PresenceBar({ collaborators, className }: PresenceBarProps) {
  const online = collaborators.filter((c) => c.online);
  const typing = collaborators.filter((c) => c.typing);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex -space-x-2">
        {online.slice(0, 6).map((c) => (
          <span
            key={c.userId}
            title={`${c.name} · ${ROLE_LABELS[c.role]}`}
            className="relative w-8 h-8 rounded-full ca-gradient-gold flex items-center justify-center ring-2 ring-navy-800"
          >
            <span className="text-navy text-xs font-bold">{c.name.charAt(0)}</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-navy-800" />
          </span>
        ))}
        {online.length > 6 && (
          <span className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center ring-2 ring-navy-800 text-xs text-slate-300">
            +{online.length - 6}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-400">
        {online.length > 0 ? `${online.length} online` : 'No one online'}
        {typing.length > 0 && (
          <span className="ml-2 text-gold-light animate-pulse-soft">
            {typing.map((t) => t.name.split(' ')[0]).join(', ')} typing…
          </span>
        )}
      </div>
    </div>
  );
}
