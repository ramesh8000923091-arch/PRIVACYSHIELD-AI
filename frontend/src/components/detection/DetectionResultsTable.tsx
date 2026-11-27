import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Badge, Button, Switch } from '@/components/ui';
import { PII_CATEGORIES, PII_CATEGORY_LIST } from '@/constants';
import { countEntitiesByCategory } from '@/services/detection';
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
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Reset temporary raw previews whenever the entity list changes to avoid leaking across documents
  useEffect(() => {
    setRevealedIds(new Set());
  }, [entities]);

  const countsByCategory = useMemo(() => countEntitiesByCategory(entities), [entities]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? entities : entities.filter((e) => e.type === filter)),
    [entities, filter]
  );

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter detections"
      >
        <button
          type="button"
          aria-pressed={filter === 'ALL'}
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
          const count = countsByCategory[cat.type] ?? 0;
          return (
            <button
              key={cat.type}
              type="button"
              aria-pressed={filter === cat.type}
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
        <>
          {/* Mobile card view (zero horizontal scroll, toggle always visible) */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((entity) => {
              const meta = PII_CATEGORIES[entity.type];
              const included = !excludedEntityIds.has(entity.id);
              const revealed = revealedIds.has(entity.id);
              const locLabel = entity.cellLocation
                ? `Row ${entity.cellLocation.row + 1}, Col ${entity.cellLocation.col + 1}`
                : `Chars ${entity.start}–${entity.end}`;

              return (
                <div
                  key={entity.id}
                  className="rounded-xl border border-border-default bg-bg-surface p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-text-muted">
                        {included ? 'Redact' : 'Excluded'}
                      </span>
                      <Switch
                        checked={included}
                        onCheckedChange={() => onToggleExclude(entity.id)}
                        aria-label={`${included ? 'Exclude' : 'Include'} ${meta.label} at ${locLabel}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-xs text-text-primary">
                    <span className="truncate">
                      {revealed ? entity.value : formatSafeEntityPreview(entity.type, entity.value)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => toggleReveal(entity.id)}
                      aria-label={revealed ? 'Hide raw value' : 'Reveal raw value temporarily'}
                    >
                      {revealed ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                    <span className="font-mono">{locLabel}</span>
                    <Badge variant="default" className="font-mono text-[10px]">
                      {entity.validationMethod} ({Math.round(entity.confidence * 100)}%)
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet table view */}
          <div className="hidden overflow-x-auto rounded-xl border border-border-default bg-bg-surface sm:block">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-elevated/70 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  <th scope="col" className="px-4 py-3">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Safe Masked Preview
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Validation
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Redact
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((entity) => {
                  const meta = PII_CATEGORIES[entity.type];
                  const included = !excludedEntityIds.has(entity.id);
                  const revealed = revealedIds.has(entity.id);
                  const locLabel = entity.cellLocation
                    ? `Row ${entity.cellLocation.row + 1}, Col ${entity.cellLocation.col + 1}`
                    : `Chars ${entity.start}–${entity.end}`;

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
                        <div className="flex items-center gap-2">
                          <span>
                            {revealed
                              ? entity.value
                              : formatSafeEntityPreview(entity.type, entity.value)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(entity.id)}
                            aria-label={
                              revealed ? 'Hide raw value' : 'Reveal raw value temporarily'
                            }
                            title={revealed ? 'Mask preview' : 'Temporarily reveal in RAM'}
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                          >
                            {revealed ? (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">{locLabel}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default" className="font-mono text-[10px]">
                          {entity.validationMethod} ({Math.round(entity.confidence * 100)}%)
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Switch
                          checked={included}
                          onCheckedChange={() => onToggleExclude(entity.id)}
                          aria-label={`${included ? 'Exclude' : 'Include'} ${meta.label} at ${locLabel}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
