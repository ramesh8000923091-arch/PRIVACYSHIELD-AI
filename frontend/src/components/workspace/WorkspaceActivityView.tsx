import { Download, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import type { AuditLogEntry } from '@/types';

interface WorkspaceActivityViewProps {
  entries: readonly AuditLogEntry[];
  onExportSummary: () => void;
  onClearEntries: () => void;
}

export function WorkspaceActivityView({
  entries,
  onExportSummary,
  onClearEntries,
}: WorkspaceActivityViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle as="h2">Safe Local Activity Log</CardTitle>
            <CardDescription>
              Metadata only (timestamps, actions, counts, redaction mode) — zero raw text or PII
              values recorded.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportSummary}
              disabled={entries.length === 0}
              title={
                entries.length === 0
                  ? 'No local activity recorded yet'
                  : 'Export metadata-only JSON summary'
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearEntries}
              disabled={entries.length === 0}
              title={
                entries.length === 0
                  ? 'Activity log is already empty'
                  : 'Clear local activity history'
              }
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear History
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-xs text-text-muted">
            No activity recorded yet. Load sample data or upload a file to see local audit events.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {entry.action}
                    </span>
                    {entry.redactionMode && (
                      <Badge variant="default" className="font-mono text-[10px]">
                        {entry.redactionMode}
                      </Badge>
                    )}
                    {typeof entry.detectedCount === 'number' && (
                      <Badge variant="primary" className="font-mono text-[10px]">
                        {entry.detectedCount} entities
                      </Badge>
                    )}
                  </div>
                  {entry.note && <p className="mt-0.5 text-xs text-text-muted">{entry.note}</p>}
                </div>
                <time dateTime={entry.timestamp} className="font-mono text-[11px] text-text-muted">
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
