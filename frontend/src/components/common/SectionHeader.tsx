import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
  className?: string;
  action?: ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  action,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' && 'mx-auto max-w-3xl items-center text-center',
        className
      )}
    >
      <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden="true" />
        {eyebrow}
      </span>
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
          align === 'center' && 'sm:flex-col sm:items-center'
        )}
      >
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        {action}
      </div>
      <p
        className={cn(
          'text-sm leading-relaxed text-text-secondary sm:text-base',
          align === 'left' && 'max-w-2xl'
        )}
      >
        {description}
      </p>
    </div>
  );
}
