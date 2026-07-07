import { Icon, type IconName } from '../icons/registry';
import { EmptyState } from '../ui/empty-state';
import type { ActivityItem } from './types';

const TYPE_ICON: Record<NonNullable<ActivityItem['type']>, IconName> = {
  comment: 'messages',
  task: 'tasks',
  evidence: 'evidence',
  approval: 'humanReview',
  request: 'discovery',
  system: 'settings',
};

export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  if (items.length === 0) {
    return <EmptyState icon={<Icon name="notifications" size={20} />} title="No activity yet" description="Collaboration activity appears here." className={className} />;
  }
  return (
    <div className={className}>
      <div className="relative pl-6">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
        {items.map((item) => (
          <div key={item.id} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full ca-icon-gold flex items-center justify-center">
              <Icon name={TYPE_ICON[item.type ?? 'system']} size={8} className="text-gold-light" />
            </span>
            <p className="text-sm text-slate-200">
              <span className="font-medium text-white">{item.actor}</span> {item.action}
              {item.target && <span className="text-gold-light"> {item.target}</span>}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{item.at}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
