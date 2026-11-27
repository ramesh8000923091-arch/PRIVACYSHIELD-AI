import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

interface PrivacyBadgeProps {
  className?: string;
}

export function PrivacyBadge({ className }: PrivacyBadgeProps) {
  return (
    <Badge
      variant="verified"
      className={cn('font-mono text-[11px] tracking-tight', className)}
      title="All PII detection, classification, redaction, and export execute strictly in browser RAM."
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>100% Client-Side Processing</span>
    </Badge>
  );
}
