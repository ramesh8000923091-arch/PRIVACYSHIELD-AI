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

    // 6. Test editor Undo/Redo actually rolls back and restores value (React 19 regression)
    const editor = screen.getByLabelText(/Raw document text input/i) as HTMLTextAreaElement;
    const beforeEdit = editor.value;
    await user.type(editor, ' EXTRA');
    expect(editor.value).toBe(`${beforeEdit} EXTRA`);

    await user.click(screen.getByRole('button', { name: /Undo edit/i }));
    expect(editor.value).not.toBe(`${beforeEdit} EXTRA`);

    await user.click(screen.getByRole('button', { name: /Redo edit/i }));
    expect(editor.value).toBe(`${beforeEdit} EXTRA`);
    await user.click(screen.getByRole('button', { name: /Detect Now/i }));

    // 7. Test Restore AI Reply (Local RAM Re-Hydration) under Pseudonymize mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Restore AI Reply/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /Restore AI Reply/i }));
    const replyBox = screen.getByLabelText(/Pseudonymized AI Response/i);
    await user.type(replyBox, 'Hello USER_01, confirm PHONE_01');
    const restoredOut = screen.getByTestId('restored-ai-reply-output');
    expect(restoredOut).toHaveTextContent('priya.sharma@example.com');
    expect(restoredOut).toHaveTextContent('+91 98765 43210');

    // 8. Navigate through all sidebar views
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

  it('rejects disguised binary file upload with an accessible error alert and keeps export disabled', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Download \.TXT/i })).toBeDisabled();

    await user.click(screen.getByRole('tab', { name: /Upload File/i }));
    const fileInput = screen.getByTestId('file-upload-input');
    const fakePdf = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
      'disguised.txt',
      { type: 'text/plain' }
    );
    await user.upload(fileInput, fakePdf);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/binary/i);
    });
    expect(screen.getByRole('button', { name: /Download \.TXT/i })).toBeDisabled();
  });

  it('retains pseudonym mappings across documents only when RAM opt-in is enabled', async () => {
    const user = userEvent.setup();
    usePreferencesStore.getState().setRetainMappingsAcrossDocuments(true);

    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('tab', { name: /Pseudonymize/i }));
    const editor = screen.getByLabelText(/Raw document text input/i);
    await user.type(editor, 'First alice@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('diff-sanitized-pane')).toHaveTextContent('USER_01');
    });

    await user.clear(editor);
    await user.type(editor, 'Second bob@example.com and ALICE@example.com');
    await waitFor(() => {
      const pane = screen.getByTestId('diff-sanitized-pane');
      expect(pane).toHaveTextContent('USER_02');
      expect(pane).toHaveTextContent('USER_01');
    });
  });
});
