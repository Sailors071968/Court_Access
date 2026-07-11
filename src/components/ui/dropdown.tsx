import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
  buttonClassName?: string;
}

/** Accessible menu/select dropdown; closes on outside click + Escape. */
export function Dropdown({
  options,
  value,
  placeholder = 'Select…',
  onChange,
  align = 'left',
  className,
  buttonClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-navy-900/60 px-4 py-2.5 text-sm text-white hover:border-white/20 transition-colors min-w-[10rem]',
          buttonClassName,
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon}
          <span className={cn(!selected && 'text-slate-500')}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute z-40 mt-2 min-w-full ca-panel shadow-elevated p-1 max-h-64 overflow-auto animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                  opt.value === value ? 'bg-gold/10 text-gold-light' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
