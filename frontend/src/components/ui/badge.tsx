import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border-default bg-bg-elevated text-text-secondary',
        verified: 'border-status-verified/40 bg-status-verified/15 text-status-verified',
        primary: 'border-brand-primary/40 bg-brand-primary/15 text-brand-primary',
        secondary: 'border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary',
        warning: 'border-status-warning/40 bg-status-warning/15 text-status-warning',
        danger: 'border-status-danger/40 bg-status-danger/15 text-status-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
