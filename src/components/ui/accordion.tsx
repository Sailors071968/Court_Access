import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenIds?: string[];
  allowMultiple?: boolean;
  className?: string;
}

/** Accessible accordion with keyboard + reduced-motion friendly transitions. */
export function Accordion({ items, defaultOpenIds = [], allowMultiple = true, className }: AccordionProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpenIds));

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn('divide-y divide-white/5 rounded-xl ca-panel overflow-hidden', className)}>
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-white">
                {item.icon}
                {item.title}
              </span>
              <ChevronDown
                size={16}
                className={cn('text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')}
              />
            </button>
            {isOpen && <div className="px-5 pb-5 text-sm text-slate-300 animate-fade-in">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
