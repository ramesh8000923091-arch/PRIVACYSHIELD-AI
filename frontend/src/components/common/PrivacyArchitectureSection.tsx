import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Laptop,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { runPrivacyVerification } from '@/services/privacy';
import { isSupabaseConfigured } from '@/services/supabase';
import { useWorkspaceStore } from '@/store';
import type { PrivacyVerificationReport } from '@/types';

export function PrivacyArchitectureSection() {
  const entities = useWorkspaceStore((s) => s.entities);
  const uploadedFile = useWorkspaceStore((s) => s.uploadedFile);
  const analytics = useWorkspaceStore((s) => s.analytics);

  const buildReport = useCallback((): PrivacyVerificationReport => {
    const sensitiveSamples = [
      ...entities.map((entity) => entity.value),
      ...(uploadedFile?.name ? [uploadedFile.name] : []),
    ];
    return runPrivacyVerification({
      sensitiveSamples,
      analyticsSnapshot: analytics,
    });
  }, [entities, uploadedFile, analytics]);

  const [report, setReport] = useState<PrivacyVerificationReport>(() => buildReport());

  useEffect(() => {
    setReport(buildReport());
  }, [buildReport]);

  function handleRunVerification() {
    setReport(buildReport());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Architecture Trust Zones */}
      <div className="space-y-4 lg:col-span-7">
        <Card className="border-status-verified/35 bg-bg-surface">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Laptop className="h-4 w-4 text-status-verified" aria-hidden="true" />
                Browser RAM Trust Zone
              </CardTitle>
              <Badge variant="verified" className="font-mono text-[11px]">
                100% LOCAL EXECUTION
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border-subtle bg-bg-elevated/60 p-3.5">
              <Cpu className="mb-2 h-4 w-4 text-brand-primary" aria-hidden="true" />
              <p className="text-xs font-semibold text-text-primary">Detection & Validation</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Sync engine (&lt; 50 KB) + isolated Web Worker (&ge; 50 KB) running Luhn &amp;
                Verhoeff checksums.
              </p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-elevated/60 p-3.5">
              <Lock className="mb-2 h-4 w-4 text-brand-secondary" aria-hidden="true" />
              <p className="text-xs font-semibold text-text-primary">Volatile RAM State</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Raw text, CSV cells, detected values, and pseudonym maps vanish on reset or tab
                close.
              </p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-elevated/60 p-3.5">
              <HardDrive className="mb-2 h-4 w-4 text-status-verified" aria-hidden="true" />
              <p className="text-xs font-semibold text-text-primary">Local Blob Export</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Generates sanitized .txt &amp; .csv files via browser Blob APIs and revokes object
                URLs immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-default bg-bg-surface/80">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                Optional External Boundary (Supabase Metadata Only)
              </CardTitle>
              <Badge variant="default" className="font-mono text-[11px]">
                {isSupabaseConfigured ? 'OPT-IN CONFIGURED' : 'LOCAL-ONLY MODE ACTIVE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-status-verified/25 bg-status-verified/10 p-3.5">
              <p className="font-mono font-semibold text-status-verified">
                PERMITTED (OPT-IN ONLY)
              </p>
              <ul className="mt-2 space-y-1 text-text-secondary">
                <li>• Theme &amp; default redaction mode preference</li>
                <li>• Consented aggregate integer entity counts</li>
                <li>• Protected by Row Level Security &amp; strict Zod schemas</li>
              </ul>
            </div>
            <div className="rounded-lg border border-status-danger/25 bg-status-danger/10 p-3.5">
              <p className="font-mono font-semibold text-status-danger">STRICTLY FORBIDDEN</p>
              <ul className="mt-2 space-y-1 text-text-secondary">
                <li>• Raw documents, pasted text, or uploaded files</li>
                <li>• Detected emails, phones, IPs, PANs, Aadhaar, cards</li>
                <li>• Pseudonymization lookup tables or filenames</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Privacy Verification Module Panel */}
      <Card className="flex flex-col justify-between lg:col-span-5">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-status-verified" aria-hidden="true" />
              Live Privacy Verification
            </CardTitle>
            <Badge variant={report.overallPassed ? 'verified' : 'danger'}>
              {report.overallPassed ? 'VERIFIED' : 'ALERT'}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Executes the Privacy Verification Module directly against your active browser session.
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          <div className="space-y-2">
            {report.checks.map((check) => (
              <div
                key={check.surface}
                className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-text-primary">
                    {check.surface}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{check.details}</p>
                </div>
                {check.passed ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-verified"
                    aria-label={`${check.surface} passed`}
                  />
                ) : (
                  <XCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-danger"
                    aria-label={`${check.surface} failed`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
            <span className="font-mono text-[10px] text-text-muted">
              Checked: {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleRunVerification}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-run Privacy Check
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
