import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Info,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { PrivacyArchitectureSection } from '@/components/common/PrivacyArchitectureSection';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { CategoryControlsBar } from '@/components/detection/CategoryControlsBar';
import { DetectionResultsTable } from '@/components/detection/DetectionResultsTable';
import { HighlightedTextView } from '@/components/detection/HighlightedTextView';
import { FileUploadZone } from '@/components/editor/FileUploadZone';
import { TextInputEditor } from '@/components/editor/TextInputEditor';
import { WorkspaceSidebar, type WorkspaceSection } from '@/components/layout/WorkspaceSidebar';
import { RedactionControlsBar } from '@/components/redaction/RedactionControlsBar';
import { SideBySideDiffView } from '@/components/redaction/SideBySideDiffView';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { PII_CATEGORY_LIST } from '@/constants';
import { useSanitizationPipeline } from '@/hooks/useSanitizationPipeline';
import { createEmptyCategoryCounts } from '@/services/detection';
import {
  createSafePrivacyReport,
  downloadJsonReport,
  downloadSanitizedFile,
  exportSafeAuditLogSummary,
} from '@/services/export';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuditLogStore, usePreferencesStore } from '@/store';

export function WorkspacePage() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('WORKSPACE');
  const [inputTab, setInputTab] = useState<'PASTE' | 'UPLOAD'>('PASTE');

  const pipeline = useSanitizationPipeline();

  const theme = usePreferencesStore((s) => s.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  const enabledCategories = usePreferencesStore((s) => s.enabledCategories);
  const toggleCategory = usePreferencesStore((s) => s.toggleCategory);
  const retainMappingsAcrossDocuments = usePreferencesStore((s) => s.retainMappingsAcrossDocuments);
  const setRetainMappingsAcrossDocuments = usePreferencesStore(
    (s) => s.setRetainMappingsAcrossDocuments
  );
  const telemetryConsent = usePreferencesStore((s) => s.telemetryConsent);
  const setTelemetryConsent = usePreferencesStore((s) => s.setTelemetryConsent);

  const auditEntries = useAuditLogStore((s) => s.entries);
  const addAuditEntry = useAuditLogStore((s) => s.addEntry);
  const clearAuditEntries = useAuditLogStore((s) => s.clearEntries);

  // Keyboard shortcuts: Ctrl/Cmd+Shift+L loads sample data, Escape cancels background scan
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        pipeline.loadSampleText();
      } else if (event.key === 'Escape' && pipeline.isProcessing) {
        pipeline.cancelProcessing();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pipeline]);

  const countsByCategory = pipeline.analytics?.countsByCategory ?? createEmptyCategoryCounts();

  function handleCopySanitized() {
    if (!pipeline.sanitizedText) return;
    navigator.clipboard?.writeText(pipeline.sanitizedText).catch(() => {});
    pipeline.showToast('Sanitized output copied to clipboard.');
  }

  function handleDownload(format: 'txt' | 'csv') {
    if (!pipeline.sanitizedText) return;
    const savedName = downloadSanitizedFile(
      pipeline.sanitizedText,
      format,
      pipeline.uploadedFile?.name
    );
    addAuditEntry({
      action: 'FILE_DOWNLOADED',
      detectedCount: pipeline.entities.length,
      redactedCount: pipeline.analytics?.totalRedacted ?? 0,
      redactionMode: pipeline.redactionMode,
      status: 'SUCCESS',
      note: `Downloaded sanitized .${format} via browser Blob API`,
    });
    pipeline.showToast(`Downloaded ${savedName} cleanly.`);
  }

  function handleDownloadPrivacyReport() {
    if (!pipeline.analytics) return;
    const report = createSafePrivacyReport(pipeline.analytics, pipeline.redactionMode);
    const name = downloadJsonReport(report, 'privacyshield-privacy-report');
    addAuditEntry({
      action: 'PRIVACY_REPORT_EXPORTED',
      detectedCount: pipeline.analytics.totalDetected,
      redactedCount: pipeline.analytics.totalRedacted,
      redactionMode: pipeline.redactionMode,
      status: 'SUCCESS',
      note: 'Exported zero-PII local privacy summary JSON',
    });
    pipeline.showToast(`Saved safe report ${name}.`);
  }

  function handleExportAuditSummary() {
    const name = exportSafeAuditLogSummary(auditEntries);
    pipeline.showToast(`Exported ${name}.`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Workspace Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Sanitization Workspace
            </h1>
            <PrivacyBadge />
          </div>
          <p className="mt-1 text-xs text-text-muted sm:text-sm">
            Paste text or upload .txt/.csv files. Every scan, checksum, diff, and export runs in
            volatile browser RAM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="font-mono text-[11px]">
            {isSupabaseConfigured ? 'Supabase Optional Sync' : 'Local-Only Mode'}
          </Badge>
          {pipeline.isProcessing && (
            <Button type="button" variant="outline" size="sm" onClick={pipeline.cancelProcessing}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel ({pipeline.progressPercent}%)
            </Button>
          )}
        </div>
      </div>

      {/* Live Toast Feedback */}
      {pipeline.toast && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            pipeline.toast.tone === 'error'
              ? 'border-status-danger/40 bg-status-danger/10 text-status-danger'
              : pipeline.toast.tone === 'info'
                ? 'border-brand-primary/40 bg-brand-primary/10 text-brand-primary'
                : 'border-status-verified/40 bg-status-verified/10 text-status-verified'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {pipeline.toast.tone === 'info' ? (
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {pipeline.toast.text}
          </span>
        </div>
      )}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <WorkspaceSidebar
          activeSection={activeSection}
          entityCount={pipeline.entities.length}
          auditCount={auditEntries.length}
          onSelectSection={setActiveSection}
        />

        <div className="min-w-0 flex-1 space-y-6">
          {/* VIEW 1: PRIMARY SANITIZATION WORKSPACE */}
          {activeSection === 'WORKSPACE' && (
            <>
              {/* Input Card (Paste Text | Upload .txt / .csv) */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <CardTitle>1. Document Input</CardTitle>
                      <CardDescription>
                        Choose direct paste or local .txt / .csv file upload
                      </CardDescription>
                    </div>
                    <Tabs
                      value={inputTab}
                      onValueChange={(v) => setInputTab(v as 'PASTE' | 'UPLOAD')}
                    >
                      <TabsList>
                        <TabsTrigger value="PASTE">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Paste Text
                        </TabsTrigger>
                        <TabsTrigger value="UPLOAD">
                          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                          Upload File
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={inputTab}>
                    <TabsContent value="PASTE" className="mt-0">
                      <TextInputEditor
                        value={pipeline.rawText}
                        onChange={(next) => {
                          pipeline.setUploadedFile(null, null);
                          pipeline.setRawText(next, 'PASTE');
                        }}
                        onLoadSample={pipeline.loadSampleText}
                        onLoadSampleCsv={pipeline.loadSampleCsv}
                        onClear={pipeline.handleClearWorkspace}
                      />
                    </TabsContent>
                    <TabsContent value="UPLOAD" className="mt-0">
                      <FileUploadZone
                        uploadedFile={pipeline.uploadedFile}
                        parsedCsv={pipeline.parsedCsv}
                        isProcessing={pipeline.isProcessing}
                        progressPercent={pipeline.progressPercent}
                        errorMessage={pipeline.errorMessage}
                        onFileSelect={pipeline.handleFileUpload}
                        onRemoveFile={pipeline.handleClearWorkspace}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Category Toggles & Live Highlighting */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <CardTitle>2. Live PII Classification &amp; Highlighting</CardTitle>
                      <CardDescription>
                        Toggle categories or click any highlighted entity to inspect and exclude
                      </CardDescription>
                    </div>
                    <Badge variant="primary" className="self-start font-mono text-xs sm:self-auto">
                      {pipeline.entities.length} detected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CategoryControlsBar
                    enabledCategories={enabledCategories}
                    countsByCategory={countsByCategory}
                    onToggleCategory={toggleCategory}
                  />

                  {!pipeline.parsedCsv ? (
                    <HighlightedTextView
                      text={pipeline.rawText}
                      entities={pipeline.entities}
                      excludedEntityIds={pipeline.excludedEntityIds}
                      onToggleExclude={pipeline.toggleEntityExclusion}
                    />
                  ) : (
                    <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-xs text-text-secondary">
                      CSV cell-level detection is active ({pipeline.parsedCsv.rows.length} rows ×{' '}
                      {pipeline.parsedCsv.headers.length} columns). Open{' '}
                      <button
                        type="button"
                        onClick={() => setActiveSection('RESULTS')}
                        className="font-semibold text-brand-primary underline cursor-pointer"
                      >
                        Detection Results
                      </button>{' '}
                      to inspect or exclude individual CSV cell entities.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Redaction Controls + Export */}
              <RedactionControlsBar
                mode={pipeline.redactionMode}
                fullMaskVariant={pipeline.fullMaskVariant}
                mappingCount={pipeline.mappingCount}
                hasSanitizedOutput={Boolean(pipeline.sanitizedText)}
                parsedCsv={pipeline.parsedCsv}
                onModeChange={pipeline.handleModeChange}
                onFullMaskVariantChange={pipeline.setFullMaskVariant}
                onResetMappings={pipeline.handleResetMappings}
                onCopySanitized={handleCopySanitized}
                onDownloadTxt={() => handleDownload('txt')}
                onDownloadCsv={() => handleDownload('csv')}
                onDownloadReport={handleDownloadPrivacyReport}
              />

              {/* Side-by-Side Diff Viewer */}
              <SideBySideDiffView
                rawText={pipeline.rawText}
                sanitizedText={pipeline.sanitizedText}
                diffSegments={pipeline.diffSegments}
                redactedCount={pipeline.analytics?.totalRedacted ?? 0}
                excludedCount={pipeline.analytics?.totalExcluded ?? 0}
                parsedCsv={pipeline.parsedCsv}
                sanitizedCsvRows={pipeline.sanitizedCsvRows}
              />

              {/* Compact Analytics Preview below Diff when data exists */}
              {pipeline.analytics && (
                <AnalyticsDashboard
                  analytics={pipeline.analytics}
                  redactionMode={pipeline.redactionMode}
                  onDownloadReport={handleDownloadPrivacyReport}
                />
              )}
            </>
          )}

          {/* VIEW 2: ANALYTICS DASHBOARD */}
          {activeSection === 'DASHBOARD' && (
            <AnalyticsDashboard
              analytics={pipeline.analytics}
              redactionMode={pipeline.redactionMode}
              onDownloadReport={handleDownloadPrivacyReport}
            />
          )}

          {/* VIEW 3: DETECTION RESULTS INSPECTOR */}
          {activeSection === 'RESULTS' && (
            <Card>
              <CardHeader>
                <CardTitle>Detection Results &amp; Exclusion Manager</CardTitle>
                <CardDescription>
                  Complete sensitive values remain masked in this panel. Toggle any item to exclude
                  or include it from redaction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DetectionResultsTable
                  entities={pipeline.entities}
                  excludedEntityIds={pipeline.excludedEntityIds}
                  onToggleExclude={pipeline.toggleEntityExclusion}
                />
              </CardContent>
            </Card>
          )}

          {/* VIEW 4: LOCAL ACTIVITY LOG */}
          {activeSection === 'ACTIVITY' && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Safe Local Activity Log</CardTitle>
                    <CardDescription>
                      Metadata only (timestamps, actions, counts, redaction mode) — zero raw text or
                      PII values recorded.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportAuditSummary}
                      disabled={auditEntries.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Export JSON
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAuditEntries}
                      disabled={auditEntries.length === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear History
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {auditEntries.length === 0 ? (
                  <p className="py-8 text-center text-xs text-text-muted">
                    No activity recorded yet. Load sample data or upload a file to see local audit
                    events.
                  </p>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {auditEntries.map((entry) => (
                      <div
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
                          {entry.note && (
                            <p className="mt-0.5 text-xs text-text-muted">{entry.note}</p>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-text-muted">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* VIEW 5: WORKSPACE SETTINGS */}
          {activeSection === 'SETTINGS' && (
            <Card>
              <CardHeader>
                <CardTitle>Workspace &amp; Privacy Settings</CardTitle>
                <CardDescription>
                  Preferences are stored locally without any document content.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Dark Cybersecurity Theme
                    </p>
                    <p className="text-xs text-text-muted">
                      Switch between dark navy and crisp light workspace appearance.
                    </p>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                    aria-label="Toggle dark theme"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Retain Pseudonym Mappings Across Documents (RAM Opt-In)
                    </p>
                    <p className="text-xs text-text-muted">
                      Disabled by default so each new document resets tokens cleanly. Still strictly
                      volatile RAM only.
                    </p>
                  </div>
                  <Switch
                    checked={retainMappingsAcrossDocuments}
                    onCheckedChange={setRetainMappingsAcrossDocuments}
                    aria-label="Retain pseudonym mappings across documents in RAM"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Opt-In Anonymous Aggregate Statistics (Supabase Only)
                    </p>
                    <p className="text-xs text-text-muted">
                      {isSupabaseConfigured
                        ? 'Sends non-sensitive integer counts only when enabled.'
                        : 'Local-Only Mode active — Supabase credentials are not configured.'}
                    </p>
                  </div>
                  <Switch
                    checked={telemetryConsent}
                    onCheckedChange={setTelemetryConsent}
                    disabled={!isSupabaseConfigured}
                    aria-label="Opt-in anonymous aggregate statistics"
                  />
                </div>

                <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-canvas/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Enabled PII Detectors
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PII_CATEGORY_LIST.map((cat) => (
                      <label
                        key={cat.type}
                        className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-xs cursor-pointer"
                      >
                        <span className="font-medium text-text-primary">{cat.label}</span>
                        <Switch
                          checked={enabledCategories[cat.type]}
                          onCheckedChange={() => toggleCategory(cat.type)}
                          aria-label={`Enable ${cat.label} detector`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border-subtle bg-bg-canvas/60 p-4 font-mono text-xs text-text-muted">
                  <p className="mb-1.5 font-semibold text-text-primary">Keyboard Shortcuts</p>
                  <p>• Ctrl/Cmd + Shift + L — Load Synthetic Sample Data</p>
                  <p>• Esc — Cancel active background Web Worker scan</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* VIEW 6: PRIVACY INFORMATION */}
          {activeSection === 'PRIVACY' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-status-verified" aria-hidden="true" />
                    Client-Side Privacy Architecture
                  </CardTitle>
                  <CardDescription>
                    Every detection, validation checksum, diff comparison, and file download runs
                    exclusively inside your browser.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PrivacyArchitectureSection />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
