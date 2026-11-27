import { useRef, useState } from 'react';
import { CheckCircle2, Columns2, Eye, Link2, Table2 } from 'lucide-react';
import { Badge, Switch } from '@/components/ui';
import { PII_CATEGORIES } from '@/constants';
import type { DiffSegment, ParsedCsvDocument } from '@/types';

interface SideBySideDiffViewProps {
  rawText: string;
  sanitizedText: string;
  diffSegments: readonly DiffSegment[];
  redactedCount: number;
  excludedCount: number;
  parsedCsv: ParsedCsvDocument | null;
  sanitizedCsvRows: readonly (readonly string[])[];
}

export function SideBySideDiffView({
  rawText,
  sanitizedText,
  diffSegments,
  redactedCount,
  excludedCount,
  parsedCsv,
  sanitizedCsvRows,
}: SideBySideDiffViewProps) {
  const [syncScroll, setSyncScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'DIFF' | 'CSV_TABLE'>('DIFF');

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const activeScrollerRef = useRef<'left' | 'right' | null>(null);

  function handleScroll(source: 'left' | 'right') {
    if (!syncScroll) return;
    if (activeScrollerRef.current && activeScrollerRef.current !== source) {
      return;
    }

    const fromEl = source === 'left' ? leftRef.current : rightRef.current;
    const toEl = source === 'left' ? rightRef.current : leftRef.current;
    if (!fromEl || !toEl) return;

    activeScrollerRef.current = source;
    const maxFrom = fromEl.scrollHeight - fromEl.clientHeight;
    const ratio = maxFrom > 0 ? fromEl.scrollTop / maxFrom : 0;
    const maxTo = toEl.scrollHeight - toEl.clientHeight;
    toEl.scrollTop = ratio * maxTo;

    window.requestAnimationFrame(() => {
      activeScrollerRef.current = null;
    });
  }

  if (!rawText) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-default bg-bg-surface/50 px-6 py-14 text-center">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-default bg-bg-elevated text-text-muted">
          <Columns2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary">Side-by-Side Comparison Ready</h3>
          <p className="max-w-md text-xs text-text-muted">
            Paste text, upload a .txt or .csv file, or click Load Sample Data above to inspect
            original vs. sanitized output side by side.
          </p>
        </div>
      </div>
    );
  }

  const showCsvTable = Boolean(
    parsedCsv && sanitizedCsvRows.length > 0 && viewMode === 'CSV_TABLE'
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-surface">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-bg-elevated/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Columns2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">Side-by-Side Comparison</h3>
          <Badge variant="verified" className="font-mono text-[11px]">
            {redactedCount} redacted
          </Badge>
          {excludedCount > 0 && (
            <Badge variant="warning" className="font-mono text-[11px]">
              {excludedCount} excluded
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {parsedCsv && sanitizedCsvRows.length > 0 && (
            <div className="inline-flex rounded-lg border border-border-default bg-bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('DIFF')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                  viewMode === 'DIFF'
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                Text Diff
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CSV_TABLE')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                  viewMode === 'CSV_TABLE'
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                Sanitized CSV Table
              </button>
            </div>
          )}

          {!showCsvTable && (
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <Link2 className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              <span>Sync scroll</span>
              <Switch
                checked={syncScroll}
                onCheckedChange={setSyncScroll}
                aria-label="Synchronize side-by-side scrolling"
              />
            </label>
          )}
        </div>
      </div>

      {showCsvTable ? (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-bg-elevated">
              <tr>
                {(sanitizedCsvRows[0] ?? []).map((header, idx) => (
                  <th
                    key={idx}
                    className="border-b border-border-default px-3 py-2.5 font-semibold text-text-primary"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sanitizedCsvRows.slice(1).map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-bg-elevated/40">
                  {row.map((cell, colIdx) => (
                    <td key={colIdx} className="px-3 py-2 text-text-secondary">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid divide-y divide-border-default lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {/* LEFT: ORIGINAL TEXT */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-text-secondary">
                <Eye className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
                Original Text
              </span>
              <span
                className="font-mono text-[11px] text-text-muted"
                data-testid="diff-original-chars"
              >
                {rawText.length.toLocaleString()} chars
              </span>
            </div>
            <div
              ref={leftRef}
              onScroll={() => handleScroll('left')}
              data-testid="diff-original-pane"
              className="max-h-[420px] min-h-[220px] overflow-auto whitespace-pre-wrap break-words bg-bg-canvas/70 p-4 font-mono text-xs leading-6 text-text-secondary sm:text-sm"
            >
              {!parsedCsv && diffSegments.length > 0
                ? diffSegments.map((seg) => {
                    if (seg.kind === 'unchanged' || !seg.entityType) {
                      return <span key={seg.id}>{seg.originalText}</span>;
                    }
                    const meta = PII_CATEGORIES[seg.entityType];
                    return (
                      <span
                        key={seg.id}
                        className="rounded px-1 py-0.5 font-medium"
                        style={{
                          color: meta.colorVar.fg,
                          backgroundColor: meta.colorVar.bg,
                          border: `1px ${seg.kind === 'excluded' ? 'dashed' : 'solid'} ${meta.colorVar.border}`,
                        }}
                      >
                        {seg.originalText}
                      </span>
                    );
                  })
                : rawText}
            </div>
          </div>

          {/* RIGHT: SANITIZED TEXT */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-status-verified">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Sanitized Text
              </span>
              <span
                className="font-mono text-[11px] text-text-muted"
                data-testid="diff-sanitized-chars"
              >
                {sanitizedText.length.toLocaleString()} chars
              </span>
            </div>
            <div
              ref={rightRef}
              onScroll={() => handleScroll('right')}
              data-testid="diff-sanitized-pane"
              className="max-h-[420px] min-h-[220px] overflow-auto whitespace-pre-wrap break-words bg-bg-canvas/70 p-4 font-mono text-xs leading-6 text-text-secondary sm:text-sm"
            >
              {!parsedCsv && diffSegments.length > 0
                ? diffSegments.map((seg) => {
                    if (seg.kind === 'unchanged') {
                      return <span key={seg.id}>{seg.sanitizedText}</span>;
                    }
                    if (seg.kind === 'excluded') {
                      return (
                        <span
                          key={seg.id}
                          className="rounded border border-dashed border-status-warning/50 bg-status-warning/10 px-1 py-0.5 text-status-warning"
                          title="Excluded from redaction by user"
                        >
                          {seg.sanitizedText}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={seg.id}
                        className="rounded border border-status-verified/40 bg-status-verified/15 px-1 py-0.5 font-semibold text-status-verified"
                      >
                        {seg.sanitizedText}
                      </span>
                    );
                  })
                : sanitizedText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
