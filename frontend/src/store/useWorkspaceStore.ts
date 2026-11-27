import { create } from 'zustand';
import type {
  DetectedEntity,
  DetectionAnalytics,
  DiffSegment,
  FullMaskVariant,
  InputSourceType,
  ParsedCsvDocument,
  RedactionMode,
  UploadedFileMeta,
} from '@/types';
import { usePreferencesStore } from './usePreferencesStore';

interface WorkspaceState {
  // Strictly volatile RAM-only document state (NEVER persisted)
  rawText: string;
  /** Exact rawText snapshot that `entities` were detected against (prevents stale-offset leaks). */
  scannedText: string;
  inputSource: InputSourceType;
  uploadedFile: UploadedFileMeta | null;
  parsedCsv: ParsedCsvDocument | null;
  entities: DetectedEntity[];
  excludedEntityIds: Set<string>;
  redactionMode: RedactionMode;
  fullMaskVariant: FullMaskVariant;
  sanitizedText: string;
  diffSegments: DiffSegment[];
  analytics: DetectionAnalytics | null;
  isProcessing: boolean;
  progressPercent: number;
  errorMessage: string | null;
  mappingVersion: number;

  // Actions
  setRawText: (text: string, source?: InputSourceType) => void;
  setDocumentWithFile: (
    text: string,
    source: InputSourceType,
    file: UploadedFileMeta | null,
    csv?: ParsedCsvDocument | null
  ) => void;
  setDetectionResults: (
    entities: DetectedEntity[],
    analytics: DetectionAnalytics | null,
    scannedText?: string
  ) => void;
  setRedactionOutput: (
    sanitizedText: string,
    diffSegments: DiffSegment[],
    analyticsPatch?: Partial<DetectionAnalytics>
  ) => void;
  setRedactionMode: (mode: RedactionMode) => void;
  setFullMaskVariant: (variant: FullMaskVariant) => void;
  toggleEntityExclusion: (entityId: string) => void;
  setProcessing: (isProcessing: boolean, progressPercent?: number) => void;
  setErrorMessage: (message: string | null) => void;
  bumpMappingVersion: () => void;
  resetWorkspace: () => void;
}

const createInitialWorkspaceState = () => {
  const prefs = usePreferencesStore.getState();
  return {
    rawText: '',
    scannedText: '',
    inputSource: 'PASTE' as InputSourceType,
    uploadedFile: null as UploadedFileMeta | null,
    parsedCsv: null as ParsedCsvDocument | null,
    entities: [] as DetectedEntity[],
    excludedEntityIds: new Set<string>(),
    redactionMode: prefs.defaultRedactionMode,
    fullMaskVariant: prefs.fullMaskVariant,
    sanitizedText: '',
    diffSegments: [] as DiffSegment[],
    analytics: null as DetectionAnalytics | null,
    isProcessing: false,
    progressPercent: 0,
    errorMessage: null as string | null,
    mappingVersion: 0,
  };
};

/**
 * Volatile RAM-only store for document content, detected entities, and sanitization results.
 * Intentionally does NOT use any persistence middleware.
 */
export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  ...createInitialWorkspaceState(),

  setRawText: (rawText, source = 'PASTE') =>
    set((state) => ({
      rawText,
      scannedText: '',
      inputSource: source,
      uploadedFile: source === 'PASTE' || source === 'SAMPLE' ? null : state.uploadedFile,
      parsedCsv: source === 'PASTE' || source === 'SAMPLE' ? null : state.parsedCsv,
      entities: [],
      excludedEntityIds: new Set<string>(),
      sanitizedText: '',
      diffSegments: [],
      analytics: null,
      isProcessing: Boolean(rawText),
      progressPercent: rawText ? 5 : 0,
      errorMessage: null,
    })),

  setDocumentWithFile: (rawText, source, uploadedFile, parsedCsv = null) =>
    set({
      rawText,
      scannedText: '',
      inputSource: source,
      uploadedFile,
      parsedCsv,
      entities: [],
      excludedEntityIds: new Set<string>(),
      sanitizedText: '',
      diffSegments: [],
      analytics: null,
      isProcessing: Boolean(rawText),
      progressPercent: rawText ? 15 : 0,
      errorMessage: null,
    }),

  setDetectionResults: (entities, analytics, scannedText) =>
    set((state) => ({
      entities,
      analytics,
      scannedText: scannedText ?? state.rawText,
      excludedEntityIds: new Set<string>(),
    })),

  setRedactionOutput: (sanitizedText, diffSegments, analyticsPatch) =>
    set((state) => ({
      sanitizedText,
      diffSegments,
      analytics:
        state.analytics && analyticsPatch
          ? { ...state.analytics, ...analyticsPatch }
          : state.analytics,
    })),

  setRedactionMode: (redactionMode) => set({ redactionMode }),

  setFullMaskVariant: (fullMaskVariant) => set({ fullMaskVariant }),

  toggleEntityExclusion: (entityId) =>
    set((state) => {
      const next = new Set(state.excludedEntityIds);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return { excludedEntityIds: next };
    }),

  setProcessing: (isProcessing, progressPercent = 0) =>
    set({
      isProcessing,
      progressPercent,
    }),

  setErrorMessage: (errorMessage) => set({ errorMessage }),

  bumpMappingVersion: () => set((state) => ({ mappingVersion: state.mappingVersion + 1 })),

  resetWorkspace: () =>
    set((state) => ({
      ...createInitialWorkspaceState(),
      mappingVersion: state.mappingVersion + 1,
    })),
}));
