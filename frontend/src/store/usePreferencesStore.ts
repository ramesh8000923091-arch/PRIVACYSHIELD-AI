import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ENABLED_CATEGORIES } from '@/constants';
import type { FullMaskVariant, PIIType, RedactionMode } from '@/types';

export type ThemeMode = 'dark' | 'light';

interface PreferencesState {
  theme: ThemeMode;
  defaultRedactionMode: RedactionMode;
  fullMaskVariant: FullMaskVariant;
  enabledCategories: Record<PIIType, boolean>;
  /** Explicit opt-in for retaining RAM pseudonym mappings across documents. Disabled by default. */
  retainMappingsAcrossDocuments: boolean;
  /** Explicit opt-in for anonymous aggregate statistics when Supabase is configured. Disabled by default. */
  telemetryConsent: boolean;
  hasCompletedWalkthrough: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setDefaultRedactionMode: (mode: RedactionMode) => void;
  setFullMaskVariant: (variant: FullMaskVariant) => void;
  toggleCategory: (category: PIIType) => void;
  setAllCategories: (enabled: boolean) => void;
  setRetainMappingsAcrossDocuments: (retain: boolean) => void;
  setTelemetryConsent: (consent: boolean) => void;
  setWalkthroughCompleted: (completed: boolean) => void;
  resetPreferences: () => void;
}

const INITIAL_PREFERENCES = {
  theme: 'dark' as ThemeMode,
  defaultRedactionMode: 'FULL_MASK' as RedactionMode,
  fullMaskVariant: 'CATEGORY_TAG' as FullMaskVariant,
  enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
  retainMappingsAcrossDocuments: false,
  telemetryConsent: false,
  hasCompletedWalkthrough: false,
};

/**
 * Persists strictly non-sensitive UI preferences to localStorage.
 * NEVER stores documents, raw inputs, PII values, or pseudonym mappings.
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...INITIAL_PREFERENCES,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setDefaultRedactionMode: (defaultRedactionMode) => set({ defaultRedactionMode }),
      setFullMaskVariant: (fullMaskVariant) => set({ fullMaskVariant }),
      toggleCategory: (category) =>
        set((state) => ({
          enabledCategories: {
            ...state.enabledCategories,
            [category]: !state.enabledCategories[category],
          },
        })),
      setAllCategories: (enabled) =>
        set({
          enabledCategories: {
            EMAIL: enabled,
            PHONE: enabled,
            IP_ADDRESS: enabled,
            PAN: enabled,
            AADHAAR: enabled,
            CREDIT_CARD: enabled,
          },
        }),
      setRetainMappingsAcrossDocuments: (retainMappingsAcrossDocuments) =>
        set({ retainMappingsAcrossDocuments }),
      setTelemetryConsent: (telemetryConsent) => set({ telemetryConsent }),
      setWalkthroughCompleted: (hasCompletedWalkthrough) => set({ hasCompletedWalkthrough }),
      resetPreferences: () =>
        set({
          ...INITIAL_PREFERENCES,
          enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
        }),
    }),
    {
      name: 'privacyshield:preferences',
      version: 1,
    }
  )
);
