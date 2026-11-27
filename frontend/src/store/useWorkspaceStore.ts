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

interface WorkspaceState {
  // Strictly volatile RAM-only document state (NEVER persisted)
  rawText: string;
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
  setUploadedFile: (file: UploadedFileMeta | null, csv?: ParsedCsvDocument | null) => void;
  setDetectionResults: (entities: DetectedEntity[], analytics: DetectionAnalytics | null) => void;
  setRedactionOutput: (sanitizedText: string, diffSegments: DiffSegment[]) => void;
  setRedactionMode: (mode: RedactionMode) => void;
  setFullMaskVariant: (variant: FullMaskVariant) => void;
  toggleEntityExclusion: (entityId: string) => void;
  setProcessing: (isProcessing: boolean, progressPercent?: number) => void;
  setErrorMessage: (message: string | null) => void;
  bumpMappingVersion: () => void;
  resetWorkspace: () => void;
}

const createInitialWorkspaceState = () => ({
  rawText: '',
  inputSource: 'PASTE' as InputSourceType,
  uploadedFile: null as UploadedFileMeta | null,
  parsedCsv: null as ParsedCsvDocument | null,
  entities: [] as DetectedEntity[],
  excludedEntityIds: new Set<string>(),
  redactionMode: 'FULL_MASK' as RedactionMode,
  fullMaskVariant: 'CATEGORY_TAG' as FullMaskVariant,
  sanitizedText: '',
  diffSegments: [] as DiffSegment[],
  analytics: null as DetectionAnalytics | null,
  isProcessing: false,
  progressPercent: 0,
  errorMessage: null as string | null,
  mappingVersion: 0,
});

/**
 * Volatile RAM-only store for document content, detected entities, and sanitization results.
 * Intentionally does NOT use any persistence middleware.
 */
export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  ...createInitialWorkspaceState(),

  setRawText: (rawText, source = 'PASTE') =>
    set({
      rawText,
      inputSource: source,
      errorMessage: null,
    }),

  setUploadedFile: (uploadedFile, parsedCsv = null) =>
    set({
      uploadedFile,
      parsedCsv,
      errorMessage: null,
    }),

  setDetectionResults: (entities, analytics) =>
    set({
      entities,
      analytics,
      excludedEntityIds: new Set<string>(),
    }),

  setRedactionOutput: (sanitizedText, diffSegments) =>
    set({
      sanitizedText,
      diffSegments,
    }),

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
      redactionMode: state.redactionMode,
      fullMaskVariant: state.fullMaskVariant,
      mappingVersion: state.mappingVersion + 1,
    })),
}));
