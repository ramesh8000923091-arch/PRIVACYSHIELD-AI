import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { usePrivacyVerificationReport } from '@/hooks';
import { resetVolatileSessionMapper } from '@/hooks/useSanitizationPipeline';
import { useAuditLogStore, usePreferencesStore, useWorkspaceStore } from '@/store';

export function AboutPage() {
  const clearAudit = useAuditLogStore((s) => s.clearEntries);
  const resetPrefs = usePreferencesStore((s) => s.resetPreferences);
  const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace);
  const { report, refreshReport } = usePrivacyVerificationReport();
  const [clearedBanner, setClearedBanner] = useState(false);
  const bannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  function handleClearAllLocalState() {
    resetVolatileSessionMapper();
    resetWorkspace();
    clearAudit();
    resetPrefs();
    refreshReport();
    setClearedBanner(true);
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setClearedBanner(false);
      bannerTimerRef.current = null;
    }, 3000);
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle as="h1" className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-status-verified" aria-hidden="true" />
              Privacy Architecture &amp; Verification
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={report.overallPassed ? 'verified' : 'danger'}>
                {report.overallPassed ? 'All Checks Passed' : 'Verification Alert'}
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={refreshReport}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Re-verify
              </Button>
            </div>
          </div>
          <CardDescription>
            Runtime audit powered by the PrivacyShield AI Privacy Verification Module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.checks.map((check) => (
            <div
              key={check.surface}
              className="flex flex-col justify-between gap-1 rounded-lg border border-border-subtle bg-bg-elevated/60 px-4 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-mono text-xs font-semibold text-text-primary">{check.surface}</p>
                <p className="text-xs text-text-muted">{check.details}</p>
              </div>
              <Badge variant={check.passed ? 'verified' : 'danger'}>
                {check.passed ? 'VERIFIED' : 'FAILED'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">What Is Processed Locally</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            <p>
              All raw text pasting, .txt/.csv file reading, PapaParse CSV parsing, six modular PII
              detectors (Email, Indian Phone, IPv4/IPv6, PAN structure, Aadhaar Verhoeff checksum,
              Credit Card Luhn checksum), live highlighting, side-by-side diffs, and Blob file
              exports run 100% locally inside your browser.
            </p>
            <p className="text-xs text-text-muted">
              Inputs &ge; 50 KB automatically offload to a dedicated browser Web Worker.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">What Is Never Stored or Sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            <p>
              Original pasted text, uploaded files, filenames, detected emails, phone numbers, IP
              addresses, PAN numbers, Aadhaar numbers, credit card numbers, and pseudonymization
              lookup tables are NEVER written to localStorage, sessionStorage, console logs, or
              Supabase.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">How Consistent Pseudonymization Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            <p>
              Normalized values map deterministically to tokens (e.g., USER_01, PHONE_01, CARD_01)
              inside volatile browser RAM only. Mappings automatically reset when you load a new
              document/sample, click Reset Mappings, clear the workspace, or reload the tab.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Optional Supabase &amp; Local Reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <p>
              Without Supabase credentials, PrivacyShield AI runs in Local-Only Mode. When
              configured and explicitly opted in, only theme preferences and non-sensitive integer
              counts are synced under Row Level Security.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleClearAllLocalState}>
                Clear Local Activity &amp; Reset Preferences
              </Button>
              <div role="status" aria-live="polite">
                {clearedBanner && (
                  <span className="font-mono text-xs text-status-verified">
                    Local activity and volatile RAM mappings cleared.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
