import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { LIMITS, PII_CATEGORY_LIST } from '@/constants';
import { runPrivacyVerification, SafeSupabaseStatisticsPayloadSchema } from '@/services/privacy';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';

describe('Phase 2 — Project Setup, Stores & Privacy Verification Foundation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useWorkspaceStore.getState().resetWorkspace();
    useAuditLogStore.getState().clearEntries();
    usePreferencesStore.getState().resetPreferences();
  });

  it('defines all six required PII categories and approved performance limits', () => {
    expect(PII_CATEGORY_LIST).toHaveLength(6);
    expect(PII_CATEGORY_LIST.map((c) => c.type)).toEqual([
      'EMAIL',
      'PHONE',
      'IP_ADDRESS',
      'PAN',
      'AADHAAR',
      'CREDIT_CARD',
    ]);
    expect(LIMITS.MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(LIMITS.WORKER_TEXT_THRESHOLD_BYTES).toBe(50 * 1024);
    expect(LIMITS.WORKER_CSV_ROW_THRESHOLD).toBe(500);
  });

  it('defaults to Local-Only Mode and opt-in disabled preferences', () => {
    expect(isSupabaseConfigured).toBe(false);
    const prefs = usePreferencesStore.getState();
    expect(prefs.retainMappingsAcrossDocuments).toBe(false);
    expect(prefs.telemetryConsent).toBe(false);
    expect(prefs.theme).toBe('dark');
  });

  it('keeps workspace raw document strictly in RAM and never writes it to browser storage', () => {
    const syntheticSecret = 'sensitive.synthetic.user@example.test';
    useWorkspaceStore.getState().setRawText(`Contact ${syntheticSecret}`);

    const report = runPrivacyVerification({
      sensitiveSamples: [syntheticSecret],
    });

    expect(report.overallPassed).toBe(true);
    expect(report.localOnlyMode).toBe(true);
    expect(window.localStorage.getItem('privacyshield:workspace')).toBeNull();
  });

  it('detects sensitive leaks if a caller erroneously writes raw data to localStorage', () => {
    const syntheticToken = 'ABCDE1234F';
    window.localStorage.setItem('accidental-leak', syntheticToken);

    const report = runPrivacyVerification({
      sensitiveSamples: [syntheticToken],
    });

    expect(report.overallPassed).toBe(false);
    const lsCheck = report.checks.find((c) => c.surface === 'LOCAL_STORAGE');
    expect(lsCheck?.passed).toBe(false);
  });

  it('rejects any extra or raw text fields in Supabase statistics payload validation', () => {
    const valid = SafeSupabaseStatisticsPayloadSchema.safeParse({
      email_count: 2,
      phone_count: 1,
      ip_count: 0,
      pan_count: 1,
      aadhaar_count: 0,
      credit_card_count: 1,
      total_entities: 5,
      redaction_mode: 'FULL_MASK',
    });
    expect(valid.success).toBe(true);

    const invalidWithRawText = SafeSupabaseStatisticsPayloadSchema.safeParse({
      email_count: 1,
      phone_count: 0,
      ip_count: 0,
      pan_count: 0,
      aadhaar_count: 0,
      credit_card_count: 0,
      total_entities: 1,
      redaction_mode: 'FULL_MASK',
      raw_text: 'should never be accepted',
    });
    expect(invalidWithRawText.success).toBe(false);
  });

  it('renders application routes cleanly without errors', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText(/Your Data\. Your Privacy\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/100% Client-Side Processing/i).length).toBeGreaterThan(0);
  });

  it('renders the privacy verification route cleanly', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText(/Privacy Architecture & Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/All Checks Passed/i)).toBeInTheDocument();
  });
});
