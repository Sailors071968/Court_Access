import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-navy-800 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'ca-gradient-gold text-navy shadow-gold hover:brightness-110 active:scale-[0.98]',
        secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/15 backdrop-blur-sm',
        outline: 'border border-white/15 bg-transparent hover:bg-white/5 text-white',
        ghost: 'hover:bg-white/5 text-slate-300 hover:text-white',
        navy: 'bg-navy-600 hover:bg-navy-500 text-white border border-white/10',
        danger: 'bg-red-500/90 hover:bg-red-500 text-white',
        link: 'text-gold-light underline-offset-4 hover:underline p-0 h-auto',
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
