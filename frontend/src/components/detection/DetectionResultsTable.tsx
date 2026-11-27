import { useMemo, useState } from 'react';
import { Badge, Switch } from '@/components/ui';
import { PII_CATEGORIES, PII_CATEGORY_LIST } from '@/constants';
import type { DetectedEntity, PIIType } from '@/types';
import { formatSafeEntityPreview } from '@/utils/safeMaskPreview';

interface DetectionResultsTableProps {
  entities: readonly DetectedEntity[];
  excludedEntityIds: ReadonlySet<string>;
  onToggleExclude: (entityId: string) => void;
}

export function DetectionResultsTable({
  entities,
  excludedEntityIds,
  onToggleExclude,
}: DetectionResultsTableProps) {
  const [filter, setFilter] = useState<PIIType | 'ALL'>('ALL');

  const filtered = useMemo(
    () => (filter === 'ALL' ? entities : entities.filter((e) => e.type === filter)),
    [entities, filter]
  );

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter detections"
      >
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`rounded-full px-3 py-1 font-mono text-xs font-medium cursor-pointer ${
            filter === 'ALL'
              ? 'bg-brand-primary text-white'
              : 'border border-border-default bg-bg-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          All ({entities.length})
        </button>
        {PII_CATEGORY_LIST.map((cat) => {
          const count = entities.filter((e) => e.type === cat.type).length;
          return (
            <button
              key={cat.type}
              type="button"
              onClick={() => setFilter(cat.type)}
              className={`rounded-full px-3 py-1 font-mono text-xs font-medium cursor-pointer ${
                filter === cat.type
                  ? 'bg-brand-primary text-white'
                  : 'border border-border-default bg-bg-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat.shortLabel} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-bg-canvas/50 p-10 text-center text-sm text-text-muted">
          No detected entities match the active filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-default bg-bg-surface">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated/70 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Safe Masked Preview</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Validation</th>
                <th className="px-4 py-3 text-right">Redact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((entity) => {
                const meta = PII_CATEGORIES[entity.type];
                const included = !excludedEntityIds.has(entity.id);

                return (
                  <tr key={entity.id} className="hover:bg-bg-elevated/40">
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-medium"
                        style={{
                          color: meta.colorVar.fg,
                          backgroundColor: meta.colorVar.bg,
                          border: `1px solid ${meta.colorVar.border}`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-primary">
                      {formatSafeEntityPreview(entity.type, entity.value)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {entity.cellLocation
                        ? `Row ${entity.cellLocation.row + 1}, Col ${entity.cellLocation.col + 1}`
                        : `Chars ${entity.start}–${entity.end}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default" className="font-mono text-[10px]">
                        {entity.validationMethod} ({Math.round(entity.confidence * 100)}%)
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Switch
                        checked={included}
                        onCheckedChange={() => onToggleExclude(entity.id)}
                        aria-label={`${included ? 'Exclude' : 'Include'} ${meta.label} at position ${entity.start}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
