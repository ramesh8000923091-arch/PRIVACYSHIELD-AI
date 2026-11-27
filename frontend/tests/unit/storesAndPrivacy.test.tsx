import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { runPrivacyVerification } from '@/services/privacy';
import { submitConsentedAggregateStats } from '@/services/supabase';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';
import type { DetectionAnalytics } from '@/types';

function CrashingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Synthetic test failure');
  }
  return <div>Recovered safely</div>;
}

describe('Stores, ErrorBoundary & Negative Privacy Verification Audit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuditLogStore.getState().clearEntries();
    usePreferencesStore.getState().resetPreferences();
    useWorkspaceStore.getState().resetWorkspace();
  });

  it('renders privacy-safe ErrorBoundary fallback on crash and recovers cleanly', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary>
        <CrashingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong locally/i)).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic test failure/i)).not.toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <CrashingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole('button', { name: /Reset Workspace & Recover/i }));
    expect(screen.getByText('Recovered safely')).toBeInTheDocument();

    consoleErrSpy.mockRestore();
  });

  it('enforces the 200-entry cap on useAuditLogStore', () => {
    const addEntry = useAuditLogStore.getState().addEntry;
    for (let i = 0; i < 215; i += 1) {
      addEntry({
        action: 'DETECTION_COMPLETED',
        detectedCount: 1,
        status: 'SUCCESS',
      });
    }
    expect(useAuditLogStore.getState().entries).toHaveLength(200);
  });

  it('syncs workspace default mode from preferences and resets cleanly on atomic setRawText', () => {
    usePreferencesStore.getState().setDefaultRedactionMode('PARTIAL_MASK');
    useWorkspaceStore.getState().resetWorkspace();
    expect(useWorkspaceStore.getState().redactionMode).toBe('PARTIAL_MASK');

    useWorkspaceStore.getState().setRawText('Email: test@example.com', 'PASTE');
    const state = useWorkspaceStore.getState();
    expect(state.isProcessing).toBe(true);
    expect(state.scannedText).toBe('');
    expect(state.sanitizedText).toBe('');
    expect(state.uploadedFile).toBeNull();
  });

  it('fails LOCAL_STORAGE verification when an unauthorized app key or corrupted audit JSON exists', () => {
    window.localStorage.setItem('privacyshield:raw-dump', 'some value');
    const report1 = runPrivacyVerification();
    const lsCheck1 = report1.checks.find((c) => c.surface === 'LOCAL_STORAGE');
    expect(lsCheck1?.passed).toBe(false);
    expect(report1.overallPassed).toBe(false);

    window.localStorage.clear();
    window.localStorage.setItem(
      'privacyshield:audit-log',
      JSON.stringify({ state: { entries: [{ badField: 'raw pii' }] } })
    );
    const report2 = runPrivacyVerification();
    const lsCheck2 = report2.checks.find((c) => c.surface === 'LOCAL_STORAGE');
    expect(lsCheck2?.passed).toBe(false);
  });

  it('fails SESSION_STORAGE, ANALYTICS, CONSOLE, and NETWORK checks when canaries leak', () => {
    const canary = 'secret.canary@example.com';
    window.sessionStorage.setItem('temp_leak', canary);

    const pollutedAnalytics = {
      totalDetected: 1,
      totalRedacted: 1,
      totalExcluded: 0,
      countsByCategory: {
        EMAIL: 1,
        PHONE: 0,
        IP_ADDRESS: 0,
        PAN: 0,
        AADHAAR: 0,
        CREDIT_CARD: 0,
      },
      originalCharCount: 25,
      sanitizedCharCount: 16,
      originalWordCount: 1,
      sanitizedWordCount: 1,
      processingTimeMs: 1,
      usedWorker: false,
      isSanitized: true,
      leakedValue: canary,
    } as unknown as DetectionAnalytics;

    const report = runPrivacyVerification({
      sensitiveSamples: [canary],
      analyticsSnapshot: pollutedAnalytics,
      capturedConsoleMessages: [`debug ${canary}`],
      outboundPayloads: [`POST /api ${canary}`],
    });

    expect(report.overallPassed).toBe(false);
    expect(report.checks.find((c) => c.surface === 'SESSION_STORAGE')?.passed).toBe(false);
    expect(report.checks.find((c) => c.surface === 'ANALYTICS')?.passed).toBe(false);
    expect(report.checks.find((c) => c.surface === 'CONSOLE')?.passed).toBe(false);
    expect(report.checks.find((c) => c.surface === 'NETWORK')?.passed).toBe(false);
  });

  it('blocks Supabase aggregate stats submission when consent is false or in Local-Only Mode', async () => {
    const analytics: DetectionAnalytics = {
      totalDetected: 1,
      totalRedacted: 1,
      totalExcluded: 0,
      countsByCategory: {
        EMAIL: 1,
        PHONE: 0,
        IP_ADDRESS: 0,
        PAN: 0,
        AADHAAR: 0,
        CREDIT_CARD: 0,
      },
      originalCharCount: 20,
      sanitizedCharCount: 16,
      originalWordCount: 2,
      sanitizedWordCount: 2,
      processingTimeMs: 1.2,
      usedWorker: false,
      isSanitized: true,
    };

    const noConsent = await submitConsentedAggregateStats(analytics, 'FULL_MASK', false);
    expect(noConsent.synced).toBe(false);
    expect(noConsent.reason).toBe('consent-not-granted');

    const localOnly = await submitConsentedAggregateStats(analytics, 'FULL_MASK', true);
    expect(localOnly.synced).toBe(false);
    expect(localOnly.reason).toBe('local-only-mode');
  });
});
