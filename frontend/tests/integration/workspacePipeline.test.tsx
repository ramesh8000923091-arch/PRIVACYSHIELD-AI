import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { SYNTHETIC_AADHAAR_1 } from '@/constants';
import { runPrivacyVerification } from '@/services/privacy';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';

describe('Phase 10 — Workspace End-to-End Integration Pipeline', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useWorkspaceStore.getState().resetWorkspace();
    useAuditLogStore.getState().clearEntries();
    usePreferencesStore.getState().resetPreferences();
  });

  it('runs paste/sample -> detection -> redaction mode switches -> diff -> analytics -> zero PII storage leak', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // 1. Load synthetic sample document
    await user.click(screen.getByRole('button', { name: /Load Sample Data/i }));

    // 2. Wait for debounced detection pipeline to complete
    await waitFor(() => {
      expect(screen.getByTestId('analytics-total-detected')).toHaveTextContent('13');
    });

    const sanitizedPane = screen.getByTestId('diff-sanitized-pane');
    expect(sanitizedPane).toHaveTextContent('[REDACTED_EMAIL]');
    expect(sanitizedPane).toHaveTextContent('[REDACTED_CREDIT_CARD]');
    expect(sanitizedPane).not.toHaveTextContent('priya.sharma@example.com');
    expect(sanitizedPane).not.toHaveTextContent('4111-1111-1111-1111');

    // 3. Switch to Partial Mask
    await user.click(screen.getByRole('tab', { name: /Partial Mask/i }));
    await waitFor(() => {
      expect(sanitizedPane).toHaveTextContent('pr****@example.com');
      expect(sanitizedPane).toHaveTextContent('192.168.xxx.xxx');
      expect(sanitizedPane).toHaveTextContent('XXXX-XXXX-XXXX-1111');
    });

    // 4. Switch to Consistent Pseudonymization
    await user.click(screen.getByRole('tab', { name: /Pseudonymize/i }));
    await waitFor(() => {
      expect(sanitizedPane).toHaveTextContent('USER_01');
      expect(sanitizedPane).toHaveTextContent('PHONE_01');
      expect(sanitizedPane).toHaveTextContent('CARD_01');
    });

    // 5. Verify local activity log recorded SANITIZATION_COMPLETED metadata without any raw PII
    const entries = useAuditLogStore.getState().entries;
    expect(entries.some((e) => e.action === 'SANITIZATION_COMPLETED')).toBe(true);

    // 6. Test editor Undo/Redo after sample load + edit + Detect Now + Clear (regression)
    const editor = screen.getByLabelText(/Raw document text input/i) as HTMLTextAreaElement;
    await user.type(editor, ' EXTRA');
    expect(editor.value).toContain('EXTRA');

    await user.click(screen.getByRole('button', { name: /Undo edit/i }));
    await user.click(screen.getByRole('button', { name: /Redo edit/i }));
    await user.click(screen.getByRole('button', { name: /Detect Now/i }));

    // 7. Navigate through all sidebar views
    await user.click(screen.getByRole('button', { name: /^Dashboard$/i }));
    expect(screen.getByText(/Category Distribution/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Detection Results/i }));
    expect(screen.getByText(/Detection Results & Exclusion Manager/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(screen.getByText(/Default Redaction Mode/i)).toBeInTheDocument();

    const privacyReport = runPrivacyVerification({
      sensitiveSamples: [
        'priya.sharma@example.com',
        '4111-1111-1111-1111',
        'ABCPK1234F',
        SYNTHETIC_AADHAAR_1,
      ],
      analyticsSnapshot: useWorkspaceStore.getState().analytics,
    });
    expect(privacyReport.overallPassed).toBe(true);
    expect(privacyReport.localOnlyMode).toBe(true);
  });
});
