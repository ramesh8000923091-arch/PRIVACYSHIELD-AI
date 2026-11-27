import { useEffect, useMemo, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { WorkspaceActivityView } from '@/components/workspace/WorkspaceActivityView';
import { WorkspacePrivacyView } from '@/components/workspace/WorkspacePrivacyView';
import { WorkspaceSettingsView } from '@/components/workspace/WorkspaceSettingsView';
import { WorkspaceStatusBanners } from '@/components/workspace/WorkspaceStatusBanners';
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
import type { RedactionMode } from '@/types';

export function WorkspacePage() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('WORKSPACE');
  const [inputTab, setInputTab] = useState<'PASTE' | 'UPLOAD'>('PASTE');

  const pipeline = useSanitizationPipeline();

  const theme = usePreferencesStore((s) => s.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  const defaultRedactionMode = usePreferencesStore((s) => s.defaultRedactionMode);
  const setDefaultRedactionMode = usePreferencesStore((s) => s.setDefaultRedactionMode);
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
  const { loadSampleText, cancelProcessing, isProcessing } = pipeline;
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        loadSampleText();
      } else if (event.key === 'Escape' && isProcessing) {
        cancelProcessing();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadSampleText, cancelProcessing, isProcessing]);

  const countsByCategory = useMemo(
    () => pipeline.analytics?.countsByCategory ?? createEmptyCategoryCounts(),
    [pipeline.analytics]
  );

  async function handleCopySanitized(): Promise<boolean> {
    if (!pipeline.isOutputReady || !pipeline.sanitizedText) return false;
    if (!navigator.clipboard?.writeText) {
      pipeline.showToast('Clipboard API is unavailable in this browser context.', 'error');
      return false;
    }
    try {
      await navigator.clipboard.writeText(pipeline.sanitizedText);
      pipeline.showToast('Sanitized output copied to clipboard.');
      return true;
    } catch {
      pipeline.showToast('Unable to write to clipboard. Check browser permissions.', 'error');
      return false;
    }
  }

  function handleDownload(format: 'txt' | 'csv') {
    if (!pipeline.isOutputReady || !pipeline.sanitizedText) return;
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
    if (!pipeline.isOutputReady || !pipeline.analytics) return;
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

  function handleDefaultModeChange(mode: RedactionMode) {
    setDefaultRedactionMode(mode);
    pipeline.handleModeChange(mode);
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

      <WorkspaceStatusBanners
        toast={pipeline.toast}
        onDismissToast={pipeline.dismissToast}
        errorMessage={pipeline.errorMessage}
        onDismissError={() => pipeline.setErrorMessage(null)}
        isProcessing={pipeline.isProcessing}
        progressPercent={pipeline.progressPercent}
      />

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
                <Tabs
                  value={inputTab}
                  onValueChange={(v) => {
                    if (v === 'PASTE' || v === 'UPLOAD') {
                      setInputTab(v);
                    }
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <CardTitle as="h2">1. Document Input</CardTitle>
                        <CardDescription>
                          Choose direct paste or local .txt / .csv file upload
                        </CardDescription>
                      </div>
                      <TabsList aria-label="Document input method">
                        <TabsTrigger value="PASTE">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Paste Text
                        </TabsTrigger>
                        <TabsTrigger value="UPLOAD">
                          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                          Upload File
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TabsContent
                      value="PASTE"
                      forceMount
                      className="mt-0 data-[state=inactive]:hidden"
                    >
                      <TextInputEditor
                        value={pipeline.rawText}
                        inputSource={pipeline.inputSource}
                        isProcessing={pipeline.isProcessing}
                        onChange={(next) => {
                          pipeline.setRawText(next, 'PASTE');
                        }}
                        onRunDetection={pipeline.runManualScan}
                        onLoadSample={pipeline.loadSampleText}
                        onLoadSampleCsv={pipeline.loadSampleCsv}
                        onClear={pipeline.handleClearWorkspace}
                      />
                    </TabsContent>
                    <TabsContent
                      value="UPLOAD"
                      forceMount
                      className="mt-0 data-[state=inactive]:hidden"
                    >
                      <FileUploadZone
                        uploadedFile={pipeline.uploadedFile}
                        parsedCsv={pipeline.parsedCsv}
                        isProcessing={pipeline.isProcessing}
                        progressPercent={pipeline.progressPercent}
                        showInlineProgress={false}
                        onFileSelect={pipeline.handleFileUpload}
                        onRemoveFile={pipeline.handleClearWorkspace}
                      />
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              {/* Category Toggles & Live Highlighting */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <CardTitle as="h2">2. Live PII Classification &amp; Highlighting</CardTitle>
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
                        className="cursor-pointer font-semibold text-blue-700 underline dark:text-blue-300"
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
                isOutputReady={pipeline.isOutputReady}
                isProcessing={pipeline.isProcessing}
                parsedCsv={pipeline.parsedCsv}
                onModeChange={pipeline.handleModeChange}
                onFullMaskVariantChange={pipeline.setFullMaskVariant}
                onResetMappings={pipeline.handleResetMappings}
                onCopySanitized={handleCopySanitized}
                onDownloadTxt={() => handleDownload('txt')}
                onDownloadCsv={() => handleDownload('csv')}
                onDownloadReport={handleDownloadPrivacyReport}
                onRestoreAiResponse={pipeline.restoreAiResponse}
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
                redactedCellKeys={pipeline.redactedCellKeys}
                excludedCellKeys={pipeline.excludedCellKeys}
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
                <CardTitle as="h2">Detection Results &amp; Exclusion Manager</CardTitle>
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
            <WorkspaceActivityView
              entries={auditEntries}
              onExportSummary={handleExportAuditSummary}
              onClearEntries={clearAuditEntries}
            />
          )}

          {/* VIEW 5: WORKSPACE SETTINGS */}
          {activeSection === 'SETTINGS' && (
            <WorkspaceSettingsView
              theme={theme}
              onToggleTheme={toggleTheme}
              defaultRedactionMode={defaultRedactionMode}
              onDefaultModeChange={handleDefaultModeChange}
              retainMappingsAcrossDocuments={retainMappingsAcrossDocuments}
              onRetainMappingsChange={setRetainMappingsAcrossDocuments}
              telemetryConsent={telemetryConsent}
              onTelemetryConsentChange={setTelemetryConsent}
              enabledCategories={enabledCategories}
              onToggleCategory={toggleCategory}
            />
          )}

          {/* VIEW 6: PRIVACY INFORMATION */}
          {activeSection === 'PRIVACY' && <WorkspacePrivacyView />}
        </div>
      </div>
    </div>
  );
}
