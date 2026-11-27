import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { useAuditLogStore, usePreferencesStore } from '@/store';

describe('Phase 3 — Landing Page & Design System', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuditLogStore.getState().clearEntries();
    usePreferencesStore.getState().resetPreferences();
  });

  it('renders hero heading, exact subtitle, and working primary/secondary CTAs', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Your Data\. Your Privacy\. Our Priority\./i
    );
    expect(
      screen.getByText(
        /Detect, classify and sanitize sensitive information instantly\. Privacy-first processing that keeps your data inside your browser\./i
      )
    ).toBeInTheDocument();

    const startLink = screen.getByRole('link', { name: /Start Sanitizing/i });
    expect(startLink).toHaveAttribute('href', '/workspace');
    expect(screen.getByRole('button', { name: /Explore Features/i })).toBeInTheDocument();
  });

  it('updates interactive hero preview across scenarios and redaction modes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const preview = within(
      screen.getByLabelText(/Interactive PrivacyShield sanitization preview/i)
    );
    const sanitizedPane = preview.getByTestId('hero-preview-sanitized');
    expect(sanitizedPane).toHaveTextContent('USER_01');

    await user.click(preview.getByRole('tab', { name: /^Full Mask$/i }));
    expect(sanitizedPane).toHaveTextContent('[REDACTED_EMAIL]');

    await user.click(preview.getByRole('tab', { name: /^Partial$/i }));
    expect(sanitizedPane).toHaveTextContent('pr**@example.com');
    expect(sanitizedPane).toHaveTextContent('192.168.xxx.xxx');

    await user.click(preview.getByRole('button', { name: 'Customer CSV' }));
    expect(sanitizedPane).toHaveTextContent('XXXX XXXX 0128');
  });

  it('toggles FAQ accordion items with accessible aria-expanded state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const secondQuestion = screen.getByRole('button', {
      name: /How does Consistent Pseudonymization work/i,
    });
    expect(secondQuestion).toHaveAttribute('aria-expanded', 'false');

    await user.click(secondQuestion);
    expect(secondQuestion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/volatile browser RAM only/i)).toBeInTheDocument();
  });

  it('displays real local application statistics without fabricated counts', () => {
    useAuditLogStore.getState().addEntry({
      action: 'SANITIZATION_COMPLETED',
      detectedCount: 4,
      redactedCount: 4,
      redactionMode: 'FULL_MASK',
      status: 'SUCCESS',
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText(/Zero Fabricated Numbers/i)).toBeInTheDocument();
    expect(screen.getByText(/1 sanitizations • 4 entities counted locally/i)).toBeInTheDocument();
  });

  it('runs the live Privacy Verification Module from the landing page', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const rerunBtn = screen.getByRole('button', { name: /Re-run Privacy Check/i });
    await user.click(rerunBtn);
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
  });
});
