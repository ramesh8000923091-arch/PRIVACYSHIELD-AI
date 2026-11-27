import { Link } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { isSupabaseConfigured } from '@/services/supabase';

export function Footer() {
  return (
    <footer className="border-t border-border-default bg-bg-surface/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
              <img src="/logo.svg" alt="" className="h-7 w-7" />
              <span className="text-base font-bold text-text-primary">
                PrivacyShield <span className="text-brand-primary dark:text-blue-400">AI</span>
              </span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-text-muted">
              Deterministic client-side PII detection, classification, and data sanitization
              platform. Built so sensitive logs, CSV exports, and documents never leave your
              browser.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <PrivacyBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-elevated px-2.5 py-0.5 font-mono text-[11px] text-text-secondary">
                <Lock
                  className="h-3 w-3 text-brand-primary dark:text-blue-400"
                  aria-hidden="true"
                />
                {isSupabaseConfigured ? 'Optional Metadata Sync Enabled' : 'Local-Only Mode'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
              Platform
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <Link to="/workspace" className="transition-colors hover:text-text-primary">
                  Sanitization Workspace
                </Link>
              </li>
              <li>
                <Link to="/history" className="transition-colors hover:text-text-primary">
                  Local Activity Log
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-text-primary">
                  Privacy Verification
                </Link>
              </li>
              <li>
                <Link to="/#features" className="transition-colors hover:text-text-primary">
                  Supported PII Categories
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
              Architecture
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <Link to="/#how-it-works" className="transition-colors hover:text-text-primary">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/#modes" className="transition-colors hover:text-text-primary">
                  Redaction Modes
                </Link>
              </li>
              <li>
                <Link to="/#security" className="transition-colors hover:text-text-primary">
                  Security Guarantees
                </Link>
              </li>
              <li>
                <Link to="/#faq" className="transition-colors hover:text-text-primary">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 text-xs text-text-muted sm:flex-row sm:items-center">
          <p>
            PrivacyShield AI — Zero raw document transmission. All built-in sample data is strictly
            synthetic.
          </p>
          <p className="inline-flex items-center gap-1.5 font-mono text-status-verified">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Browser RAM Trust Boundary Active
          </p>
        </div>
      </div>
    </footer>
  );
}
