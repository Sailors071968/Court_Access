import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

const baseField =
  'w-full rounded-xl border border-white/10 bg-navy-900/60 text-sm text-white placeholder:text-slate-500 transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 disabled:opacity-50';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(baseField, 'px-4 py-2.5', error && 'border-red-500/50 focus:ring-red-500/40', className)}
          {...props}
        />
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const areaId = id ?? props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={areaId} className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={Boolean(error)}
          className={cn(baseField, 'px-4 py-2.5 min-h-[96px] resize-y', error && 'border-red-500/50', className)}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function SearchBar({ className, onSearch, ...props }: SearchBarProps) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        type="search"
        className={cn(baseField, 'pl-10 pr-4 py-2.5', className)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) onSearch((e.target as HTMLInputElement).value);
        }}
        {...props}
      />
    </div>
  );
}
