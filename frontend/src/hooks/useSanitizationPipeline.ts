import { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_CSV_TEXT, SAMPLE_DOCUMENT_TEXT } from '@/constants';
import { parseCsvContent, sanitizeCsvDocument } from '@/services/csv';
import { countEntitiesByCategory, detectPIIAsync } from '@/services/detection';
import { applyRedaction, PseudonymMapper } from '@/services/redaction';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';
import type {
  DetectionAnalytics,
  InputSourceType,
  ParsedCsvDocument,
  RedactionMode,
} from '@/types';
import { containsBinaryNullBytes, validateUploadedFile } from '@/utils/fileValidation';
import { countWords } from '@/utils/formatters';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'info' | 'error';
}

export function useSanitizationPipeline() {
  const mapperRef = useRef<PseudonymMapper>(new PseudonymMapper());
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProcessedTextRef = useRef<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sanitizedCsvRows, setSanitizedCsvRows] = useState<string[][]>([]);
  const [mappingCount, setMappingCount] = useState(0);

  const enabledCategories = usePreferencesStore((s) => s.enabledCategories);
  const retainMappingsAcrossDocuments = usePreferencesStore((s) => s.retainMappingsAcrossDocuments);

  const rawText = useWorkspaceStore((s) => s.rawText);
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

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3500);
  }, []);

  // Run detection whenever rawText, parsedCsv, or enabledCategories changes
  useEffect(() => {
    if (!rawText) {
      setDetectionResults([], null);
      setRedactionOutput('', []);
      setSanitizedCsvRows([]);
      setProcessing(false, 0);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let cancelled = false;
    const isNewDocument = rawText !== lastProcessedTextRef.current;

    async function runScan() {
      setProcessing(true, 10);
      setErrorMessage(null);

      try {
        if (parsedCsv) {
          const startedAt = performance.now();
          const tempMapper = new PseudonymMapper();
          const csvPreview = sanitizeCsvDocument(
            parsedCsv,
            { enabledCategories },
            {
              mode: useWorkspaceStore.getState().redactionMode,
              fullMaskVariant: useWorkspaceStore.getState().fullMaskVariant,
              excludedEntityIds: new Set(),
            },
            tempMapper
          );
          if (cancelled) return;

          const durationMs = Math.max(0, Number((performance.now() - startedAt).toFixed(2)));
          const nextAnalytics: DetectionAnalytics = {
            totalDetected: csvPreview.entities.length,
            totalRedacted: csvPreview.redactedCount,
            totalExcluded: 0,
            countsByCategory: csvPreview.countsByCategory,
            originalCharCount: rawText.length,
            sanitizedCharCount: csvPreview.sanitizedCsvText.length,
            originalWordCount: countWords(rawText),
            sanitizedWordCount: countWords(csvPreview.sanitizedCsvText),
            processingTimeMs: durationMs,
            usedWorker: false,
            isSanitized: true,
          };

          setDetectionResults(csvPreview.entities, nextAnalytics);
          setProcessing(false, 100);
          if (isNewDocument) {
            lastProcessedTextRef.current = rawText;
            addAuditEntry({
              action: 'DETECTION_COMPLETED',
              detectedCount: csvPreview.entities.length,
              redactionMode: useWorkspaceStore.getState().redactionMode,
              status: 'SUCCESS',
              note: 'CSV cell-level scan completed locally',
            });
          }
          return;
        }

        const summary = await detectPIIAsync({
          text: rawText,
          options: { enabledCategories },
          signal: controller.signal,
          onProgress: (percent) => {
            if (!cancelled) setProcessing(true, percent);
          },
        });

        if (cancelled) return;

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

        setDetectionResults(summary.entities, nextAnalytics);
        setProcessing(false, 100);

        if (isNewDocument) {
          lastProcessedTextRef.current = rawText;
          addAuditEntry({
            action: 'DETECTION_COMPLETED',
            detectedCount: summary.totalDetected,
            redactionMode: useWorkspaceStore.getState().redactionMode,
            status: 'SUCCESS',
            note: summary.usedWorker
              ? 'Processed in isolated browser Web Worker'
              : 'Processed synchronously in browser RAM',
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (!cancelled) {
          setProcessing(false, 0);
          setErrorMessage('Could not complete PII scan. Please review your input and try again.');
        }
      }
    }

    const timer = window.setTimeout(runScan, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    rawText,
    parsedCsv,
    enabledCategories,
    setDetectionResults,
    setRedactionOutput,
    setProcessing,
    setErrorMessage,
    addAuditEntry,
  ]);

  // Apply redaction reactively whenever entities, mode, variant, exclusions, or mappingVersion change
  useEffect(() => {
    if (!rawText) {
      setRedactionOutput('', []);
      setSanitizedCsvRows([]);
      setMappingCount(mapperRef.current.getTotalMappings());
      return;
    }

    if (!retainMappingsAcrossDocuments) {
      mapperRef.current.reset();
    }

    if (parsedCsv) {
      const csvResult = sanitizeCsvDocument(
        parsedCsv,
        { enabledCategories },
        { mode: redactionMode, fullMaskVariant, excludedEntityIds },
        mapperRef.current
      );

      setSanitizedCsvRows(csvResult.sanitizedRows);

      // Build plain diff segments on raw text lines for unified SideBySideDiff viewing
      const rawLineDiff = applyRedaction(rawText, [], {
        mode: redactionMode,
        fullMaskVariant,
        excludedEntityIds,
      });
      setRedactionOutput(csvResult.sanitizedCsvText, rawLineDiff.diffSegments);
      setMappingCount(mapperRef.current.getTotalMappings());

      const currentAnalytics = useWorkspaceStore.getState().analytics;
      if (currentAnalytics) {
        useWorkspaceStore.setState({
          analytics: {
            ...currentAnalytics,
            totalDetected: csvResult.entities.length,
            totalRedacted: csvResult.redactedCount,
            totalExcluded: csvResult.excludedCount,
            countsByCategory: csvResult.countsByCategory,
            sanitizedCharCount: csvResult.sanitizedCsvText.length,
            sanitizedWordCount: countWords(csvResult.sanitizedCsvText),
            isSanitized: csvResult.redactedCount > 0 || csvResult.entities.length === 0,
          },
        });
      }
      return;
    }

    const output = applyRedaction(
      rawText,
      entities,
      { mode: redactionMode, fullMaskVariant, excludedEntityIds },
      mapperRef.current
    );

    setSanitizedCsvRows([]);
    setRedactionOutput(output.sanitizedText, output.diffSegments);
    setMappingCount(mapperRef.current.getTotalMappings());

    const currentAnalytics = useWorkspaceStore.getState().analytics;
    if (currentAnalytics) {
      useWorkspaceStore.setState({
        analytics: {
          ...currentAnalytics,
          totalDetected: entities.length,
          totalRedacted: output.redactedCount,
          totalExcluded: output.excludedCount,
          countsByCategory: countEntitiesByCategory(entities),
          originalCharCount: rawText.length,
          sanitizedCharCount: output.sanitizedText.length,
          originalWordCount: countWords(rawText),
          sanitizedWordCount: countWords(output.sanitizedText),
          isSanitized: output.redactedCount > 0 || entities.length === 0,
        },
      });
    }
  }, [
    rawText,
    parsedCsv,
    entities,
    redactionMode,
    fullMaskVariant,
    excludedEntityIds,
    enabledCategories,
    retainMappingsAcrossDocuments,
    mappingVersion,
    setRedactionOutput,
  ]);

  const loadSampleText = useCallback(() => {
    if (!retainMappingsAcrossDocuments) {
      mapperRef.current.reset();
    }
    setUploadedFile(null, null);
    setRawText(SAMPLE_DOCUMENT_TEXT, 'SAMPLE');
    addAuditEntry({
      action: 'SAMPLE_DATA_LOADED',
      redactionMode: useWorkspaceStore.getState().redactionMode,
      status: 'SUCCESS',
      note: 'Loaded synthetic multi-category test document',
    });
    showToast('Loaded synthetic sample document with all 6 PII categories.');
  }, [retainMappingsAcrossDocuments, setUploadedFile, setRawText, addAuditEntry, showToast]);

  const loadSampleCsv = useCallback(() => {
    if (!retainMappingsAcrossDocuments) {
      mapperRef.current.reset();
    }
    const parsed = parseCsvContent(
      SAMPLE_CSV_TEXT,
      'synthetic-customers.csv',
      SAMPLE_CSV_TEXT.length
    );
    setUploadedFile(
      {
        name: 'synthetic-customers.csv',
        sizeBytes: SAMPLE_CSV_TEXT.length,
        extension: '.csv',
        mimeType: 'text/csv',
      },
      parsed.document
    );
    setRawText(SAMPLE_CSV_TEXT, 'CSV_FILE');
    addAuditEntry({
      action: 'SAMPLE_DATA_LOADED',
      redactionMode: useWorkspaceStore.getState().redactionMode,
      status: 'SUCCESS',
      note: 'Loaded synthetic customer CSV dataset',
    });
    showToast('Loaded synthetic CSV dataset (preserving quoted fields & columns).');
  }, [retainMappingsAcrossDocuments, setUploadedFile, setRawText, addAuditEntry, showToast]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validation = validateUploadedFile(file);
      if (!validation.valid || !validation.extension) {
        setErrorMessage(validation.error ?? 'Invalid file.');
        showToast(validation.error ?? 'Invalid file.', 'error');
        return;
      }

      setProcessing(true, 20);
      setErrorMessage(null);

      try {
        const text = await file.text();
        if (containsBinaryNullBytes(text)) {
          setProcessing(false, 0);
          const msg = 'File appears to contain binary data and cannot be processed as text.';
          setErrorMessage(msg);
          showToast(msg, 'error');
          return;
        }

        if (!retainMappingsAcrossDocuments) {
          mapperRef.current.reset();
        }

        let csvDoc: ParsedCsvDocument | null = null;
        let sourceType: InputSourceType = 'TXT_FILE';

        if (validation.extension === '.csv') {
          const parsed = parseCsvContent(text, file.name, file.size);
          csvDoc = parsed.document;
          sourceType = 'CSV_FILE';
        }

        setUploadedFile(
          {
            name: file.name,
            sizeBytes: file.size,
            extension: validation.extension,
            mimeType: file.type || (validation.extension === '.csv' ? 'text/csv' : 'text/plain'),
          },
          csvDoc
        );
        setRawText(text, sourceType);

        addAuditEntry({
          action: 'FILE_SELECTED',
          redactionMode: useWorkspaceStore.getState().redactionMode,
          status: 'SUCCESS',
          note: `Loaded local ${validation.extension} file (${Math.ceil(file.size / 1024)} KB)`,
        });
        showToast(`Loaded ${file.name} locally in browser RAM.`);
      } catch {
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
      setUploadedFile,
      setRawText,
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
    mapperRef.current.reset();
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
    abortControllerRef.current?.abort();
    mapperRef.current.reset();
    lastProcessedTextRef.current = '';
    resetWorkspace();
    setSanitizedCsvRows([]);
    setMappingCount(0);
    addAuditEntry({
      action: 'WORKSPACE_CLEARED',
      status: 'SUCCESS',
      note: 'Cleared raw text, detections, and mappings from RAM',
    });
    showToast('Workspace cleared from browser memory.', 'info');
  }, [resetWorkspace, addAuditEntry, showToast]);

  const cancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    setProcessing(false, 0);
    showToast('Background scan cancelled.', 'info');
  }, [setProcessing, showToast]);

  return {
    rawText,
    inputSource,
    uploadedFile,
    parsedCsv,
    sanitizedCsvRows,
    entities,
    excludedEntityIds,
    redactionMode,
    fullMaskVariant,
    sanitizedText,
    diffSegments,
    analytics,
    isProcessing,
    progressPercent,
    errorMessage,
    mappingCount,
    toast,
    setRawText,
    setUploadedFile,
    setFullMaskVariant,
    toggleEntityExclusion,
    loadSampleText,
    loadSampleCsv,
    handleFileUpload,
    handleModeChange,
    handleResetMappings,
    handleClearWorkspace,
    cancelProcessing,
    showToast,
  };
}
