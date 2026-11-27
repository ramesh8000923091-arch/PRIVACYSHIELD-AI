import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { LIMITS } from '@/constants';
import { AuditLogEntrySchema, type AuditLogEntry, type AuditLogInput } from '@/types';

interface AuditLogState {
  entries: AuditLogEntry[];
  addEntry: (input: AuditLogInput) => AuditLogEntry;
  clearEntries: () => void;
}

function generateAuditId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Local-first activity log store.
 * Every entry is validated via strict Zod schema on write AND rehydration
 * to ensure zero raw text or PII values are stored.
 */
export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (input) => {
        const validated = AuditLogEntrySchema.parse({
          id: generateAuditId(),
          timestamp: new Date().toISOString(),
          action: input.action,
          detectedCount: input.detectedCount,
          redactedCount: input.redactedCount,
          redactionMode: input.redactionMode,
          status: input.status,
          note: input.note,
        });

        set((state) => ({
          entries: [validated, ...state.entries].slice(0, LIMITS.MAX_AUDIT_LOG_ENTRIES),
        }));

        return validated;
      },

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'privacyshield:audit-log',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const parsed = z.array(AuditLogEntrySchema).safeParse(state.entries);
        if (!parsed.success) {
          state.entries = [];
        }
      },
    }
  )
);
