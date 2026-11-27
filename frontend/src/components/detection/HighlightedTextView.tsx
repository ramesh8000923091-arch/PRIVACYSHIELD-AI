import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, EyeOff, Info, ShieldAlert, X } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { PII_CATEGORIES } from '@/constants';
import type { DetectedEntity } from '@/types';
import { formatSafeEntityPreview } from '@/utils/safeMaskPreview';

interface HighlightedTextViewProps {
  text: string;
  entities: readonly DetectedEntity[];
  excludedEntityIds: ReadonlySet<string>;
  onToggleExclude: (entityId: string) => void;
}

interface RenderSlice {
  key: string;
  text: string;
  entity?: DetectedEntity;
}

/**
 * Renders original text safely via React text nodes (ZERO dangerouslySetInnerHTML)
 * with interactive color-coded category highlights and an accessible Entity Inspector.
 */
export function HighlightedTextView({
  text,
  entities,
  excludedEntityIds,
  onToggleExclude,
}: HighlightedTextViewProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSelectedEntityId(null);
    lastTriggerRef.current = null;
  }, [text]);

  const closeInspector = useCallback(() => {
    setSelectedEntityId(null);
    lastTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectedEntityId) return;
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeInspector();
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedEntityId, closeInspector]);

  const slices = useMemo<RenderSlice[]>(() => {
    if (!text) return [];
    const sorted = [...entities]
      .filter((e) => !e.cellLocation && e.start >= 0 && e.end > e.start && e.end <= text.length)
      .sort((a, b) => a.start - b.start);

    if (sorted.length === 0) {
      return [{ key: 'plain-all', text }];
    }

    const result: RenderSlice[] = [];
    let cursor = 0;

    for (const entity of sorted) {
      if (entity.start < cursor) continue;
      if (entity.start > cursor) {
        result.push({
          key: `plain-${cursor}`,
          text: text.slice(cursor, entity.start),
        });
      }
      result.push({
        key: entity.id,
        text: text.slice(entity.start, entity.end),
        entity,
      });
      cursor = entity.end;
    }

    if (cursor < text.length) {
      result.push({
        key: `plain-${cursor}`,
        text: text.slice(cursor),
      });
    }

    return result;
  }, [text, entities]);

  const hasHighlightedEntities = useMemo(() => slices.some((s) => Boolean(s.entity)), [slices]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [entities, selectedEntityId]
  );

  if (!text) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-bg-canvas/50 p-6 text-center text-xs text-text-muted">
        Paste text or load sample data to inspect live color-coded PII highlights.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="region"
        tabIndex={0}
        className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border-default bg-bg-canvas p-4 font-mono text-xs leading-6 text-text-secondary sm:text-sm"
        aria-label="Live highlighted sensitive text"
      >
        {slices.map((slice) => {
          if (!slice.entity) {
            return <span key={slice.key}>{slice.text}</span>;
          }

          const entity = slice.entity;
          const meta = PII_CATEGORIES[entity.type];
          const isExcluded = excludedEntityIds.has(entity.id);
          const isSelected = selectedEntityId === entity.id;

          return (
            <button
              key={slice.key}
              type="button"
              aria-pressed={isSelected}
              onClick={(event) => {
                if (isSelected) {
                  setSelectedEntityId(null);
                } else {
                  lastTriggerRef.current = event.currentTarget;
                  setSelectedEntityId(entity.id);
                }
              }}
              title={`${meta.label} (${isExcluded ? 'excluded' : 'will redact'}) — click to inspect`}
              className={`mx-0.5 inline rounded px-1 py-0.5 font-medium transition-all cursor-pointer ${
                isExcluded ? 'opacity-75 line-through' : ''
              } ${isSelected ? 'ring-2 ring-brand-primary' : ''}`}
              style={{
                color: meta.colorVar.fg,
                backgroundColor: meta.colorVar.bg,
                border: `1px ${isExcluded ? 'dashed' : 'solid'} ${meta.colorVar.border}`,
              }}
            >
              {slice.text}
            </button>
          );
        })}
      </div>

      {selectedEntity && (
        <div
          role="region"
          aria-label="Selected entity inspector"
          className="flex flex-col justify-between gap-3 rounded-xl border border-brand-primary/40 bg-bg-elevated/80 p-3.5 sm:flex-row sm:items-center"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Info className="h-4 w-4 text-brand-primary dark:text-blue-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-text-primary">
                {PII_CATEGORIES[selectedEntity.type].label}
              </span>
              <Badge variant="primary" className="font-mono text-[10px]">
                {selectedEntity.validationMethod}
              </Badge>
              <Badge variant="default" className="font-mono text-[10px]">
                Confidence: {Math.round(selectedEntity.confidence * 100)}%
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-text-muted">
              <span>
                Safe Preview:{' '}
                <strong className="text-text-primary">
                  {formatSafeEntityPreview(selectedEntity.type, selectedEntity.value)}
                </strong>
              </span>
              <span>
                Range: [{selectedEntity.start}, {selectedEntity.end})
              </span>
              <span>{PII_CATEGORIES[selectedEntity.type].validationLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={excludedEntityIds.has(selectedEntity.id) ? 'primary' : 'outline'}
              onClick={() => onToggleExclude(selectedEntity.id)}
            >
              {excludedEntityIds.has(selectedEntity.id) ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Include in Redaction
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Exclude from Redaction
                </>
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={closeInspector}
              aria-label="Close entity inspector"
              title="Close inspector (Esc)"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {hasHighlightedEntities && !selectedEntity && (
        <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <ShieldAlert
            className="h-3.5 w-3.5 text-brand-primary dark:text-blue-400"
            aria-hidden="true"
          />
          Click any highlighted value above to inspect its validation method or exclude it from
          redaction.
        </p>
      )}
    </div>
  );
}
