import { useRef } from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

/** Accessible, keyboard-navigable tab strip (dark-mode first). */
export function Tabs({ tabs, activeId, onChange, variant = 'underline', className }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 overflow-x-auto',
        variant === 'underline' && 'border-b border-white/10',
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKey(e, i)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'underline'
                ? cn(
                    'px-4 py-3 border-b-2 -mb-px',
                    active
                      ? 'border-gold-light text-gold-light'
                      : 'border-transparent text-slate-400 hover:text-white',
                  )
                : cn(
                    'px-4 py-2 rounded-lg',
                    active ? 'bg-gold/10 text-gold-light border border-gold/20' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  ),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
