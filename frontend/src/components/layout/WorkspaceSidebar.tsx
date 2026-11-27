import {
  Activity,
  BarChart3,
  FileSearch,
  Lock,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

export type WorkspaceSection =
  'WORKSPACE' | 'DASHBOARD' | 'RESULTS' | 'ACTIVITY' | 'SETTINGS' | 'PRIVACY';

interface WorkspaceSidebarProps {
  activeSection: WorkspaceSection;
  entityCount: number;
  auditCount: number;
  onSelectSection: (section: WorkspaceSection) => void;
}

const SIDEBAR_ITEMS: readonly {
  id: WorkspaceSection;
  label: string;
  icon: typeof BarChart3;
}[] = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: BarChart3 },
  { id: 'WORKSPACE', label: 'Sanitization Workspace', icon: SlidersHorizontal },
  { id: 'RESULTS', label: 'Detection Results', icon: FileSearch },
  { id: 'ACTIVITY', label: 'Activity Log', icon: Activity },
  { id: 'SETTINGS', label: 'Settings', icon: Settings },
  { id: 'PRIVACY', label: 'Privacy Information', icon: Lock },
];

export function WorkspaceSidebar({
  activeSection,
  entityCount,
  auditCount,
  onSelectSection,
}: WorkspaceSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="rounded-xl border border-border-default bg-bg-surface p-3 lg:sticky lg:top-20">
        <div className="mb-3 hidden items-center justify-between border-b border-border-subtle px-2 pb-3 lg:flex">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Workspace Navigation
          </span>
          <ShieldCheck className="h-4 w-4 text-status-verified" aria-hidden="true" />
        </div>

        <nav
          aria-label="Workspace sections"
          className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm cursor-pointer lg:w-full',
                  active
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>

                {item.id === 'RESULTS' && entityCount > 0 && (
                  <Badge variant="primary" className="font-mono text-[10px]">
                    {entityCount}
                  </Badge>
                )}
                {item.id === 'ACTIVITY' && auditCount > 0 && (
                  <Badge variant="default" className="font-mono text-[10px]">
                    {auditCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
