import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Download, ShieldCheck, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { exportSafeAuditLogSummary } from '@/services/export';
import { useAuditLogStore } from '@/store';
import type { AuditAction } from '@/types';

export function HistoryPage() {
  const entries = useAuditLogStore((state) => state.entries);
  const clearEntries = useAuditLogStore((state) => state.clearEntries);
  const [actionFilter, setActionFilter] = useState<AuditAction | 'ALL'>('ALL');
  const [exportedFile, setExportedFile] = useState<string | null>(null);
  const exportTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current !== null) {
        window.clearTimeout(exportTimerRef.current);
      }
    };
  }, []);

  const filtered = useMemo(
    () => (actionFilter === 'ALL' ? entries : entries.filter((e) => e.action === actionFilter)),
    [entries, actionFilter]
  );

  const uniqueActions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))), [entries]);

  function handleExport() {
    const file = exportSafeAuditLogSummary(entries);
    setExportedFile(file);
    if (exportTimerRef.current !== null) {
      window.clearTimeout(exportTimerRef.current);
    }
    exportTimerRef.current = window.setTimeout(() => {
      setExportedFile(null);
      exportTimerRef.current = null;
    }, 3000);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Local Activity &amp; Audit Log
            </h1>
            <Badge variant="verified" className="font-mono text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Metadata Only — Zero PII Stored
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Records local timestamps, actions, entity counts, and redaction modes. Raw text,
            sensitive values, and pseudonym mappings are never logged.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={entries.length === 0}
            title={
              entries.length === 0
                ? 'No local activity recorded yet'
                : 'Export metadata-only JSON summary'
            }
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export Safe Summary
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearEntries}
            disabled={entries.length === 0}
            title={entries.length === 0 ? 'History is already empty' : 'Clear local audit log'}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear History
          </Button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {exportedFile && (
          <div className="mb-4 rounded-lg border border-status-verified/40 bg-status-verified/10 px-4 py-2.5 text-xs text-status-verified">
            Exported sanitized audit summary as <code className="font-mono">{exportedFile}</code>.
          </div>
        )}
      </div>

      {uniqueActions.length > 0 && (
        <div
          role="group"
          aria-label="Filter activity by action"
          className="mb-4 flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            aria-pressed={actionFilter === 'ALL'}
            onClick={() => setActionFilter('ALL')}
            className={`cursor-pointer rounded-full px-3 py-1 font-mono text-xs font-medium ${
              actionFilter === 'ALL'
                ? 'bg-brand-primary text-white'
                : 'border border-border-default bg-bg-surface text-text-secondary'
            }`}
          >
            All ({entries.length})
          </button>
          {uniqueActions.map((action) => (
            <button
              key={action}
              type="button"
              aria-pressed={actionFilter === action}
              onClick={() => setActionFilter(action)}
              className={`cursor-pointer rounded-full px-3 py-1 font-mono text-xs font-medium ${
                actionFilter === action
                  ? 'bg-brand-primary text-white'
                  : 'border border-border-default bg-bg-surface text-text-secondary'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Recorded Events ({filtered.length})
          </CardTitle>
          <CardDescription>
            Stored locally in browser storage via strict Zod schema validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-text-muted">No local activity events recorded yet.</p>
              <Button asChild size="sm">
                <Link to="/workspace">
                  Open Sanitization Workspace
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-2.5 sm:hidden">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border-subtle bg-bg-elevated/40 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {entry.action}
                      </span>
                      <Badge
                        variant={entry.status === 'SUCCESS' ? 'verified' : 'warning'}
                        className="font-mono text-[10px]"
                      >
                        {entry.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-muted">
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      {entry.redactionMode && (
                        <Badge variant="default" className="font-mono text-[10px]">
                          {entry.redactionMode}
                        </Badge>
                      )}
                      {typeof entry.detectedCount === 'number' && (
                        <span>{entry.detectedCount} entities</span>
                      )}
                    </div>
                    {entry.note && <p className="mt-1.5 text-xs text-text-muted">{entry.note}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop/tablet table layout */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border-default font-mono text-[11px] uppercase tracking-wider text-text-muted">
                      <th scope="col" className="py-2.5 pr-4">
                        Timestamp
                      </th>
                      <th scope="col" className="py-2.5 pr-4">
                        Action
                      </th>
                      <th scope="col" className="py-2.5 pr-4">
                        Mode
                      </th>
                      <th scope="col" className="py-2.5 pr-4">
                        Entities
                      </th>
                      <th scope="col" className="py-2.5 pr-4">
                        Status
                      </th>
                      <th scope="col" className="py-2.5">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filtered.map((entry) => (
                      <tr key={entry.id} className="hover:bg-bg-elevated/40">
                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-text-muted">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs font-semibold text-text-primary">
                          {entry.action}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          {entry.redactionMode ? (
                            <Badge variant="default" className="font-mono text-[10px]">
                              {entry.redactionMode}
                            </Badge>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-text-secondary">
                          {typeof entry.detectedCount === 'number' ? entry.detectedCount : '—'}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <Badge
                            variant={entry.status === 'SUCCESS' ? 'verified' : 'warning'}
                            className="font-mono text-[10px]"
                          >
                            {entry.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-text-muted">{entry.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
