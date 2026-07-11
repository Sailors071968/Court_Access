import { UserPlus, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { ROLE_LABELS, type Collaborator } from './types';
import { cn } from '../../lib/utils';

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
              <Avatar name={c.name} src={c.avatarUrl} size="sm" online={c.online} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="gold">{c.customRole ?? ROLE_LABELS[c.role] ?? c.role}</Badge>
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
