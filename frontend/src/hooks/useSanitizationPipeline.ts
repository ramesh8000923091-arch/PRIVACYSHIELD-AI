import { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_CSV_TEXT, SAMPLE_DOCUMENT_TEXT } from '@/constants';
import { parseCsvContent, redactCsvDocument } from '@/services/csv';
import { countEntitiesByCategory, detectCsvAsync, detectPIIAsync } from '@/services/detection';
import { applyRedaction, PseudonymMapper, type RestoreResult } from '@/services/redaction';
import { submitConsentedAggregateStats } from '@/services/supabase';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';
import type {
  DetectionAnalytics,
  InputSourceType,
  ParsedCsvDocument,
  RedactionMode,
} from '@/types';
import {
  containsBinaryNullBytes,
  validateUploadedFile,
  validateUtf8TextBytes,
} from '@/utils/fileValidation';
import { countWords } from '@/utils/formatters';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'info' | 'error';
}

/**
 * Volatile RAM-only singleton mapper kept in JS memory (never persisted to storage).
 * Survives SPA navigation when the user explicitly opts in to cross-document retention,
 * and is purged immediately on clear, reset, disabling retention, or tab close.
 */
const volatileSessionMapper = new PseudonymMapper();

export function resetVolatileSessionMapper(): void {
  volatileSessionMapper.reset();
}

export function useSanitizationPipeline() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const uploadSeqRef = useRef(0);
  const lastAuditedTextRef = useRef<string>('');

  const [scanNonce, setScanNonce] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sanitizedCsvRows, setSanitizedCsvRows] = useState<string[][]>([]);
  const [redactedCellKeys, setRedactedCellKeys] = useState<Set<string>>(new Set());
  const [excludedCellKeys, setExcludedCellKeys] = useState<Set<string>>(new Set());
  const [mappingCount, setMappingCount] = useState(() => volatileSessionMapper.getTotalMappings());

  const enabledCategories = usePreferencesStore((s) => s.enabledCategories);
  const retainMappingsAcrossDocuments = usePreferencesStore((s) => s.retainMappingsAcrossDocuments);
  const telemetryConsent = usePreferencesStore((s) => s.telemetryConsent);

  const rawText = useWorkspaceStore((s) => s.rawText);
  const scannedText = useWorkspaceStore((s) => s.scannedText);
  const inputSource = useWorkspaceStore((s) => s.inputSource);
  const uploadedFile = useWorkspaceStore((s) => s.uploadedFile);
  const parsedCsv = useWorkspaceStore((s) => s.parsedCsv);
  const entities = useWorkspaceStore((s) => s.entities);
  const excludedEntityIds = useWorkspaceStore((s) => s.excludedEntityIds);
  const redactionMode = useWorkspaceStore((s) => s.redactionMode);
  const fullMaskVariant = useWorkspaceStore((s) => s.fullMaskVariant);
  const sanitizedText = useWorkspaceStore((s) => s.sanitizedText);
  const diffSegments = useWorkspaceStore((s) => s.diffSegments);
  const analytics = useWorkspaceStore((s) => s.analytics);
  const isProcessing = useWorkspaceStore((s) => s.isProcessing);
  const progressPercent = useWorkspaceStore((s) => s.progressPercent);
  const errorMessage = useWorkspaceStore((s) => s.errorMessage);
  const mappingVersion = useWorkspaceStore((s) => s.mappingVersion);

  const setRawText = useWorkspaceStore((s) => s.setRawText);
  const setDocumentWithFile = useWorkspaceStore((s) => s.setDocumentWithFile);
  const setUploadedFile = useWorkspaceStore((s) => s.setUploadedFile);
  const setDetectionResults = useWorkspaceStore((s) => s.setDetectionResults);
  const setRedactionOutput = useWorkspaceStore((s) => s.setRedactionOutput);
  const setRedactionMode = useWorkspaceStore((s) => s.setRedactionMode);
  const setFullMaskVariant = useWorkspaceStore((s) => s.setFullMaskVariant);
  const toggleEntityExclusion = useWorkspaceStore((s) => s.toggleEntityExclusion);
  const setProcessing = useWorkspaceStore((s) => s.setProcessing);
  const setErrorMessage = useWorkspaceStore((s) => s.setErrorMessage);
  const bumpMappingVersion = useWorkspaceStore((s) => s.bumpMappingVersion);
  const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace);

  const addAuditEntry = useAuditLogStore((s) => s.addEntry);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  // Purge RAM mappings immediately whenever cross-document retention is disabled
  useEffect(() => {
    if (!retainMappingsAcrossDocuments) {
      volatileSessionMapper.reset();
      setMappingCount(0);
    }
  }, [retainMappingsAcrossDocuments]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = Date.now();
    setToast({ id, text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  // Effect 1: Detection (sync for small inputs, isolated Web Worker for >= 50KB or > 500 CSV rows)
  useEffect(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortControllerRef.current?.abort();

    if (!rawText) {
      if (!retainMappingsAcrossDocuments) {
        volatileSessionMapper.reset();
        setMappingCount(0);
      }
      setDetectionResults([], null, '');
      setRedactionOutput('', []);
      setSanitizedCsvRows([]);
      setRedactedCellKeys(new Set());
      setExcludedCellKeys(new Set());
      setProcessing(false, 0);
      lastAuditedTextRef.current = '';
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let cancelled = false;
    const isNewDocument = rawText !== lastAuditedTextRef.current;

    // Immediately lock exports while debounced re-scan (e.g. category toggle) is pending
    setProcessing(true, 10);

    async function runScan() {
      if (cancelled || controller.signal.aborted) return;
      setProcessing(true, 20);
      if (!useWorkspaceStore.getState().errorMessage?.startsWith('CSV syntax warning')) {
        setErrorMessage(null);
      }

      try {
        const summary = parsedCsv
          ? await detectCsvAsync({
              csvDoc: parsedCsv,
              options: { enabledCategories },
              signal: controller.signal,
              onProgress: (percent) => {
                if (!cancelled && !controller.signal.aborted) {
                  setProcessing(true, Math.max(20, percent));
                }
              },
            })
          : await detectPIIAsync({
              text: rawText,
              options: { enabledCategories },
              signal: controller.signal,
              onProgress: (percent) => {
                if (!cancelled && !controller.signal.aborted) {
                  setProcessing(true, Math.max(20, percent));
                }
              },
            });

        if (cancelled || controller.signal.aborted) return;

        const nextAnalytics: DetectionAnalytics = {
          totalDetected: summary.totalDetected,
          totalRedacted: summary.totalDetected,
          totalExcluded: 0,
          countsByCategory: summary.countsByCategory,
          originalCharCount: rawText.length,
          sanitizedCharCount: rawText.length,
          originalWordCount: countWords(rawText),
          sanitizedWordCount: countWords(rawText),
          processingTimeMs: summary.durationMs,
          usedWorker: summary.usedWorker,
          isSanitized: true,
        };

        setDetectionResults(summary.entities, nextAnalytics, rawText);
        setProcessing(false, 100);

        if (isNewDocument) {
          lastAuditedTextRef.current = rawText;
          const activeMode = useWorkspaceStore.getState().redactionMode;
          addAuditEntry({
            action: 'SANITIZATION_COMPLETED',
            detectedCount: summary.totalDetected,
            redactedCount: summary.totalDetected,
            redactionMode: activeMode,
            status: 'SUCCESS',
            note: summary.usedWorker
              ? parsedCsv
                ? 'CSV processed in isolated browser Web Worker'
                : 'Processed in isolated browser Web Worker'
              : parsedCsv
                ? 'CSV cell-level scan completed in browser RAM'
                : 'Processed synchronously in browser RAM',
          });

          if (telemetryConsent) {
            void submitConsentedAggregateStats(nextAnalytics, activeMode, true);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (!cancelled) setProcessing(false, 0);
          return;
        }
        if (!cancelled) {
          setProcessing(false, 0);
          setErrorMessage('Could not complete PII scan. Please review your input and try again.');
        }
      }
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runScan();
    }, 120);

    return () => {
      cancelled = true;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      controller.abort();
    };
  }, [
    rawText,
    parsedCsv,
    enabledCategories,
    scanNonce,
    retainMappingsAcrossDocuments,
    telemetryConsent,
    setDetectionResults,
    setRedactionOutput,
    setProcessing,
    setErrorMessage,
    addAuditEntry,
  ]);

  // Effect 2: Redaction (runs ONLY once `scannedText === rawText` and `!isProcessing`, preventing stale leaks!)
  useEffect(() => {
    if (!rawText) {
      return;
    }
    if (isProcessing || scannedText !== rawText) {
      return;
    }

    if (!retainMappingsAcrossDocuments) {
      volatileSessionMapper.reset();
    }

    if (parsedCsv) {
      const csvResult = redactCsvDocument(
        parsedCsv,
        entities,
        { mode: redactionMode, fullMaskVariant, excludedEntityIds },
        volatileSessionMapper
      );

      setSanitizedCsvRows(csvResult.sanitizedRows);
      setRedactedCellKeys(csvResult.redactedCellKeys);
      setExcludedCellKeys(csvResult.excludedCellKeys);
      setRedactionOutput(csvResult.sanitizedCsvText, csvResult.diffSegments, {
        totalDetected: entities.length,
        totalRedacted: csvResult.redactedCount,
        totalExcluded: csvResult.excludedCount,
        countsByCategory: csvResult.countsByCategory,
        sanitizedCharCount: csvResult.sanitizedCsvText.length,
        sanitizedWordCount: countWords(csvResult.sanitizedCsvText),
        isSanitized: csvResult.redactedCount > 0 || entities.length === 0,
      });
      setMappingCount(volatileSessionMapper.getTotalMappings());
      return;
    }

    const output = applyRedaction(
      rawText,
      entities,
      { mode: redactionMode, fullMaskVariant, excludedEntityIds },
      volatileSessionMapper
    );

    setSanitizedCsvRows([]);
    setRedactedCellKeys(new Set());
    setExcludedCellKeys(new Set());
    setRedactionOutput(output.sanitizedText, output.diffSegments, {
      totalDetected: entities.length,
      totalRedacted: output.redactedCount,
      totalExcluded: output.excludedCount,
      countsByCategory: countEntitiesByCategory(entities),
      originalCharCount: rawText.length,
      sanitizedCharCount: output.sanitizedText.length,
      originalWordCount: countWords(rawText),
      sanitizedWordCount: countWords(output.sanitizedText),
      isSanitized: output.redactedCount > 0 || entities.length === 0,
    });
    setMappingCount(volatileSessionMapper.getTotalMappings());
  }, [
    rawText,
    scannedText,
    isProcessing,
    parsedCsv,
    entities,
    redactionMode,
    fullMaskVariant,
    excludedEntityIds,
    retainMappingsAcrossDocuments,
    mappingVersion,
    setRedactionOutput,
  ]);

  const loadSampleText = useCallback(() => {
    uploadSeqRef.current += 1;
    if (!retainMappingsAcrossDocuments) {
      volatileSessionMapper.reset();
      setMappingCount(0);
    }
    setDocumentWithFile(SAMPLE_DOCUMENT_TEXT, 'SAMPLE', null, null);
    addAuditEntry({
      action: 'SAMPLE_DATA_LOADED',
      redactionMode: useWorkspaceStore.getState().redactionMode,
      status: 'SUCCESS',
      note: 'Loaded synthetic multi-category test document',
    });
    showToast('Loaded synthetic sample document with all 6 PII categories.');
  }, [retainMappingsAcrossDocuments, setDocumentWithFile, addAuditEntry, showToast]);

  const loadSampleCsv = useCallback(() => {
    uploadSeqRef.current += 1;
    if (!retainMappingsAcrossDocuments) {
      volatileSessionMapper.reset();
      setMappingCount(0);
    }
    const byteLength = new TextEncoder().encode(SAMPLE_CSV_TEXT).byteLength;
    const parsed = parseCsvContent(SAMPLE_CSV_TEXT, 'synthetic-customers.csv', byteLength);
    setDocumentWithFile(
      SAMPLE_CSV_TEXT,
      'CSV_FILE',
      {
        name: 'synthetic-customers.csv',
        sizeBytes: byteLength,
        extension: '.csv',
        mimeType: 'text/csv',
      },
      parsed.document
    );
    addAuditEntry({
      action: 'SAMPLE_DATA_LOADED',
      redactionMode: useWorkspaceStore.getState().redactionMode,
      status: 'SUCCESS',
      note: 'Loaded synthetic customer CSV dataset',
    });
    showToast('Loaded synthetic CSV dataset (preserving quoted fields & columns).');
  }, [retainMappingsAcrossDocuments, setDocumentWithFile, addAuditEntry, showToast]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validation = validateUploadedFile(file);
      if (!validation.valid || !validation.extension) {
        setErrorMessage(validation.error ?? 'Invalid file.');
        showToast(validation.error ?? 'Invalid file.', 'error');
        return;
      }

      const currentSeq = ++uploadSeqRef.current;
      setProcessing(true, 10);
      setErrorMessage(null);

      try {
        const binaryCheck = await validateUtf8TextBytes(file);
        if (currentSeq !== uploadSeqRef.current) return;
        if (!binaryCheck.valid) {
          setProcessing(false, 0);
          const msg = binaryCheck.error ?? 'Unsupported binary content.';
          setErrorMessage(msg);
          showToast(msg, 'error');
          return;
        }

        const text = await file.text();
        if (currentSeq !== uploadSeqRef.current) return;

        if (containsBinaryNullBytes(text)) {
          setProcessing(false, 0);
          const msg = 'File appears to contain binary data and cannot be processed as text.';
          setErrorMessage(msg);
          showToast(msg, 'error');
          return;
        }

        if (!retainMappingsAcrossDocuments) {
          volatileSessionMapper.reset();
          setMappingCount(0);
        }

        let csvDoc: ParsedCsvDocument | null = null;
        let sourceType: InputSourceType = 'TXT_FILE';
        let csvWarningNote: string | null = null;

        if (validation.extension === '.csv') {
          const parsed = parseCsvContent(text, file.name, file.size);
          csvDoc = parsed.document;
          sourceType = 'CSV_FILE';
          if (parsed.warnings.length > 0) {
            csvWarningNote = `CSV syntax warning (${parsed.warnings[0]}). Verify table alignment before export.`;
          }
        }

        setDocumentWithFile(
          text,
          sourceType,
          {
            name: file.name,
            sizeBytes: file.size,
            extension: validation.extension,
            mimeType: file.type || (validation.extension === '.csv' ? 'text/csv' : 'text/plain'),
          },
          csvDoc
        );

        if (csvWarningNote) {
          setErrorMessage(csvWarningNote);
        }

        addAuditEntry({
          action: 'FILE_SELECTED',
          redactionMode: useWorkspaceStore.getState().redactionMode,
          status: csvWarningNote ? 'WARNING' : 'SUCCESS',
          note: `Loaded local ${validation.extension} file (${Math.max(1, Math.ceil(file.size / 1024))} KB)`,
        });
        showToast(
          csvWarningNote
            ? `Loaded ${file.name} with CSV formatting warnings.`
            : `Loaded ${file.name} locally in browser RAM.`,
          csvWarningNote ? 'info' : 'success'
        );
      } catch {
        if (currentSeq !== uploadSeqRef.current) return;
        setProcessing(false, 0);
        const msg = 'Unable to read the selected file locally.';
        setErrorMessage(msg);
        showToast(msg, 'error');
      }
    },
    [
      retainMappingsAcrossDocuments,
      setErrorMessage,
      setProcessing,
      setDocumentWithFile,
      addAuditEntry,
      showToast,
    ]
  );

  const handleModeChange = useCallback(
    (mode: RedactionMode) => {
      setRedactionMode(mode);
      addAuditEntry({
        action: 'REDACTION_MODE_CHANGED',
        redactionMode: mode,
        detectedCount: useWorkspaceStore.getState().entities.length,
        status: 'SUCCESS',
        note: `Switched redaction policy to ${mode}`,
      });
    },
    [setRedactionMode, addAuditEntry]
  );

  const handleResetMappings = useCallback(() => {
    volatileSessionMapper.reset();
    bumpMappingVersion();
    setMappingCount(0);
    addAuditEntry({
      action: 'MAPPINGS_RESET',
      redactionMode: useWorkspaceStore.getState().redactionMode,
      status: 'SUCCESS',
      note: 'Cleared volatile RAM pseudonymization map',
    });
    showToast('RAM pseudonymization mappings cleared.', 'info');
  }, [bumpMappingVersion, addAuditEntry, showToast]);

  const handleClearWorkspace = useCallback(() => {
    uploadSeqRef.current += 1;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortControllerRef.current?.abort();
    volatileSessionMapper.reset();
    lastAuditedTextRef.current = '';
    resetWorkspace();
    setSanitizedCsvRows([]);
    setRedactedCellKeys(new Set());
    setExcludedCellKeys(new Set());
    setMappingCount(0);
    addAuditEntry({
      action: 'WORKSPACE_CLEARED',
      status: 'SUCCESS',
      note: 'Cleared raw text, detections, and mappings from RAM',
    });
    showToast('Workspace cleared from browser memory.', 'info');
  }, [resetWorkspace, addAuditEntry, showToast]);

  const runManualScan = useCallback(() => {
    if (!useWorkspaceStore.getState().rawText) return;
    lastAuditedTextRef.current = '';
    setScanNonce((n) => n + 1);
    showToast('Re-scanned document locally in browser RAM.');
  }, [showToast]);

  const cancelProcessing = useCallback(() => {
    uploadSeqRef.current += 1;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortControllerRef.current?.abort();
    setProcessing(false, 0);
    showToast('Background scan cancelled.', 'info');
  }, [setProcessing, showToast]);

  const restoreAiResponse = useCallback((pseudonymizedReply: string): RestoreResult => {
    return volatileSessionMapper.restoreText(pseudonymizedReply);
  }, []);

  const isOutputReady =
    !isProcessing && Boolean(sanitizedText) && Boolean(rawText) && scannedText === rawText;

  return {
    rawText,
    scannedText,
    inputSource,
    uploadedFile,
    parsedCsv,
    sanitizedCsvRows,
    redactedCellKeys,
    excludedCellKeys,
    entities,
    excludedEntityIds,
    redactionMode,
    fullMaskVariant,
    sanitizedText,
    diffSegments,
    analytics,
    isProcessing,
    isOutputReady,
    progressPercent,
    errorMessage,
    mappingCount,
    toast,
    setRawText,
    setUploadedFile,
    setErrorMessage,
    setFullMaskVariant,
    toggleEntityExclusion,
    loadSampleText,
    loadSampleCsv,
    handleFileUpload,
    handleModeChange,
    handleResetMappings,
    handleClearWorkspace,
    runManualScan,
    cancelProcessing,
    restoreAiResponse,
    showToast,
    dismissToast,
  };
}
