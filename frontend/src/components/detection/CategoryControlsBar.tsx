import { PII_CATEGORY_LIST } from '@/constants';
import type { PIIType } from '@/types';
import { cn } from '@/utils/cn';

interface CategoryControlsBarProps {
  enabledCategories: Record<PIIType, boolean>;
  countsByCategory: Record<PIIType, number>;
  onToggleCategory: (category: PIIType) => void;
}

export function CategoryControlsBar({
  enabledCategories,
  countsByCategory,
  onToggleCategory,
}: CategoryControlsBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="PII category detection toggles and legend"
    >
      {PII_CATEGORY_LIST.map((category) => {
        const enabled = enabledCategories[category.type];
        const count = countsByCategory[category.type] ?? 0;

        return (
          <button
            key={category.type}
            type="button"
            aria-pressed={enabled}
            onClick={() => onToggleCategory(category.type)}
            title={`${enabled ? 'Disable' : 'Enable'} ${category.label} detection (${category.validationLabel})`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium transition-opacity cursor-pointer',
              !enabled && 'opacity-75 line-through'
            )}
            style={{
              color: category.colorVar.fg,
              backgroundColor: category.colorVar.bg,
              border: `1px ${enabled ? 'solid' : 'dashed'} ${category.colorVar.border}`,
            }}
          >
            <span>{category.shortLabel}</span>
            <span className="rounded-full bg-bg-canvas/80 px-1.5 py-0.5 text-[10px] font-bold">
              {enabled ? count : 'OFF'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
