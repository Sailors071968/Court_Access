import { UserPlus, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Icon } from '../icons/registry';
import { ROLE_LABELS, type Collaborator, type CollaboratorRole } from './types';
import { cn } from '../../lib/utils';

const ROLE_ICON: Record<CollaboratorRole, Parameters<typeof Icon>[0]['name']> = {
  attorney: 'attorney',
  secretary: 'documents',
  client: 'defendant',
  investigator: 'investigator',
  expert: 'witness',
  paralegal: 'tasks',
  family: 'defendant',
  admin: 'permissions',
};

interface CollaboratorListProps {
  collaborators: Collaborator[];
  onInvite?: () => void;
  onEditPermissions?: (c: Collaborator) => void;
  className?: string;
}

/**
 * Unlimited collaborators with role + permission display.
 * Authorization changes route through the existing permission engine via callbacks.
 */
export function CollaboratorList({ collaborators, onInvite, onEditPermissions, className }: CollaboratorListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Collaborators ({collaborators.length})</h3>
        {onInvite && (
          <Button variant="secondary" size="sm" onClick={onInvite}>
            <UserPlus size={14} /> Invite
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {collaborators.map((c) => (
          <div key={c.userId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative w-9 h-9 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center flex-shrink-0">
                <Icon name={ROLE_ICON[c.role]} size={16} />
                {c.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-navy-800" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="gold">{ROLE_LABELS[c.role]}</Badge>
                  {c.permissions && c.permissions.length > 0 && (
                    <span className="text-[11px] text-slate-400">{c.permissions.length} permissions</span>
                  )}
                </div>
              </div>
            </div>
            {onEditPermissions && (
              <button onClick={() => onEditPermissions(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-gold-light hover:bg-white/5" aria-label="Edit permissions">
                <Shield size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
