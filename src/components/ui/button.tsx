import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gold-light hover:bg-gold text-navy shadow-gold hover:shadow-lg active:scale-[0.98]',
        secondary:
          'bg-white/10 hover:bg-white/15 text-white border border-white/15 backdrop-blur-sm',
        outline:
          'border border-slate-200 bg-white hover:bg-slate-50 text-navy hover:border-slate-300',
        ghost: 'hover:bg-slate-100 text-navy',
        navy: 'bg-navy hover:bg-navy-light text-white shadow-card hover:shadow-elevated',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        link: 'text-gold underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-sm',
        lg: 'h-13 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
