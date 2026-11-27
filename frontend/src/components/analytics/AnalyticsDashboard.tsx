import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CheckCircle2, Cpu, Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { PII_CATEGORY_LIST } from '@/constants';
import type { DetectionAnalytics, RedactionMode } from '@/types';

interface AnalyticsDashboardProps {
  analytics: DetectionAnalytics | null;
  redactionMode: RedactionMode;
  onDownloadReport: () => void;
}

export function AnalyticsDashboard({
  analytics,
  redactionMode,
  onDownloadReport,
}: AnalyticsDashboardProps) {
  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Activity className="h-8 w-8 text-text-muted" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">No Active Scan Metrics Yet</h3>
            <p className="max-w-md text-xs text-text-muted">
              Paste text, upload a file, or load sample data in the workspace to view real entity
              detection counts, distribution charts, and before/after telemetry.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = PII_CATEGORY_LIST.map((cat) => ({
    name: cat.shortLabel,
    fullName: cat.label,
    count: analytics.countsByCategory[cat.type] ?? 0,
    color: cat.chartHex,
  }));

  const statusSafe = analytics.totalDetected === 0 || analytics.totalRedacted > 0;

  return (
    <div className="space-y-6">
      {/* Top KPI summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="font-mono text-xs text-text-muted">TOTAL DETECTED</p>
            <p
              className="mt-1.5 font-mono text-3xl font-bold text-text-primary"
              data-testid="analytics-total-detected"
            >
              {analytics.totalDetected}
            </p>
            <p className="mt-1 text-xs text-text-muted">Across 6 deterministic detectors</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-mono text-xs text-text-muted">TOTAL REDACTED</p>
            <p
              className="mt-1.5 font-mono text-3xl font-bold text-status-verified"
              data-testid="analytics-total-redacted"
            >
              {analytics.totalRedacted}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {analytics.totalExcluded > 0
                ? `${analytics.totalExcluded} excluded by user`
                : `Mode: ${redactionMode}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-mono text-xs text-text-muted">SANITIZATION STATUS</p>
            <div className="mt-2 flex items-center gap-2">
              {statusSafe ? (
                <Badge variant="verified" className="text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Sanitized Locally
                </Badge>
              ) : (
                <Badge variant="warning" className="text-xs">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  All Entities Excluded
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-text-muted">Zero bytes sent externally</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-mono text-xs text-text-muted">ENGINE PERFORMANCE</p>
            <p className="mt-1.5 font-mono text-3xl font-bold text-brand-primary">
              {analytics.processingTimeMs} ms
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              {analytics.usedWorker ? 'Web Worker Thread' : 'Sync Browser RAM'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Before/After breakdown */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>Actual detected entities by PII category</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onDownloadReport}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export Safe Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 min-h-[256px] w-full min-w-[200px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={200}
                minHeight={240}
                initialDimension={{ width: 480, height: 256 }}
              >
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border-default)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border-default)' }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--bg-elevated)', opacity: 0.45 }}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '0.5rem',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Detection Breakdown &amp; Before/After</CardTitle>
            <CardDescription>Exact counts without exposing raw sensitive values</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {PII_CATEGORY_LIST.map((cat) => (
                <div
                  key={cat.type}
                  className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated/40 px-3 py-2"
                >
                  <span className="text-xs font-medium text-text-secondary">{cat.shortLabel}</span>
                  <span
                    className="rounded px-2 py-0.5 font-mono text-xs font-bold"
                    style={{
                      color: cat.colorVar.fg,
                      backgroundColor: cat.colorVar.bg,
                    }}
                  >
                    {analytics.countsByCategory[cat.type] ?? 0}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-canvas/70 p-3.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Original Length</span>
                <span className="text-text-primary">
                  {analytics.originalCharCount.toLocaleString()} chars (
                  {analytics.originalWordCount} words)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Sanitized Length</span>
                <span className="text-status-verified">
                  {analytics.sanitizedCharCount.toLocaleString()} chars (
                  {analytics.sanitizedWordCount} words)
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="inline-flex items-center gap-1.5 text-status-verified">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Privacy Guarantee
                </span>
                <span className="text-text-secondary">100% Client-Side</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
