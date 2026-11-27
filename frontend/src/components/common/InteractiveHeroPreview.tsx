import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, ShieldCheck, Terminal } from 'lucide-react';
import { Badge, Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { PII_CATEGORIES } from '@/constants';
import type { PIIType, RedactionMode } from '@/types';

interface PreviewSegment {
  text: string;
  piiType?: PIIType;
  partial?: string;
  pseudonym?: string;
}

interface PreviewScenario {
  id: string;
  label: string;
  filename: string;
  segments: readonly PreviewSegment[];
}

/**
 * Strictly synthetic scenarios used to demonstrate live client-side masking modes.
 * Contains zero real personal data.
 */
const PREVIEW_SCENARIOS: readonly PreviewScenario[] = [
  {
    id: 'ticket',
    label: 'Support Ticket',
    filename: 'ticket-4092.txt',
    segments: [
      { text: 'Ticket #4092 — Escalation for ' },
      {
        text: 'priya.sharma@example.com',
        piiType: 'EMAIL',
        partial: 'pr****@example.com',
        pseudonym: 'USER_01',
      },
      { text: '\nCallback: ' },
      {
        text: '+91 98765 43210',
        piiType: 'PHONE',
        partial: 'XXXXXX3210',
        pseudonym: 'PHONE_01',
      },
      { text: ' | Source IP: ' },
      {
        text: '192.168.42.19',
        piiType: 'IP_ADDRESS',
        partial: '192.168.xxx.xxx',
        pseudonym: 'IP_01',
      },
      { text: '\nKYC Ref PAN: ' },
      {
        text: 'ABCPK1234F',
        piiType: 'PAN',
        partial: 'XXXXX1234X',
        pseudonym: 'PAN_01',
      },
      { text: ' | Test Card: ' },
      {
        text: '4111-1111-1111-1111',
        piiType: 'CREDIT_CARD',
        partial: 'XXXX-XXXX-XXXX-1111',
        pseudonym: 'CARD_01',
      },
      { text: '\nFollow-up requested by ' },
      {
        text: 'priya.sharma@example.com',
        piiType: 'EMAIL',
        partial: 'pr****@example.com',
        pseudonym: 'USER_01',
      },
      { text: '.' },
    ],
  },
  {
    id: 'logs',
    label: 'Server Log',
    filename: 'auth-gateway.log',
    segments: [
      { text: '[2026-11-27 09:14:02] WARN auth.failed user=' },
      {
        text: 'devops.audit@example.org',
        piiType: 'EMAIL',
        partial: 'de****@example.org',
        pseudonym: 'USER_01',
      },
      { text: '\nclient_ipv4=' },
      {
        text: '10.24.180.52',
        piiType: 'IP_ADDRESS',
        partial: '10.24.xxx.xxx',
        pseudonym: 'IP_01',
      },
      { text: ' edge_ipv6=' },
      {
        text: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        piiType: 'IP_ADDRESS',
        partial: '2001:0db8:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx',
        pseudonym: 'IP_02',
      },
      { text: '\nsms_otp_target=' },
      {
        text: '9820112233',
        piiType: 'PHONE',
        partial: 'XXXXXX2233',
        pseudonym: 'PHONE_01',
      },
    ],
  },
  {
    id: 'csv',
    label: 'Customer CSV',
    filename: 'customers-sample.csv',
    segments: [
      { text: 'id,email,aadhaar_ref,pan\n101,' },
      {
        text: 'rohan.verma@example.net',
        piiType: 'EMAIL',
        partial: 'ro****@example.net',
        pseudonym: 'USER_01',
      },
      { text: ',' },
      {
        text: '2345 6789 0128',
        piiType: 'AADHAAR',
        partial: 'XXXX XXXX 0128',
        pseudonym: 'AADHAAR_01',
      },
      { text: ',' },
      {
        text: 'BZVPM5678K',
        piiType: 'PAN',
        partial: 'XXXXX5678X',
        pseudonym: 'PAN_01',
      },
      { text: '\n102,' },
      {
        text: 'rohan.verma@example.net',
        piiType: 'EMAIL',
        partial: 'ro****@example.net',
        pseudonym: 'USER_01',
      },
      { text: ',' },
      {
        text: '3456 7890 1231',
        piiType: 'AADHAAR',
        partial: 'XXXX XXXX 1231',
        pseudonym: 'AADHAAR_02',
      },
      { text: ',' },
      {
        text: 'AAACA4321D',
        piiType: 'PAN',
        partial: 'XXXXX4321X',
        pseudonym: 'PAN_02',
      },
    ],
  },
];

function isRedactionMode(value: string): value is RedactionMode {
  return value === 'FULL_MASK' || value === 'PARTIAL_MASK' || value === 'PSEUDONYMIZE';
}

function getRedactedReplacement(segment: PreviewSegment, mode: RedactionMode): string {
  if (!segment.piiType) return segment.text;
  if (mode === 'FULL_MASK') {
    return PII_CATEGORIES[segment.piiType].fullMaskToken;
  }
  if (mode === 'PARTIAL_MASK') {
    return segment.partial ?? PII_CATEGORIES[segment.piiType].fullMaskToken;
  }
  return segment.pseudonym ?? PII_CATEGORIES[segment.piiType].fullMaskToken;
}

export function InteractiveHeroPreview() {
  const [scenarioId, setScenarioId] = useState<string>(PREVIEW_SCENARIOS[0].id);
  const [mode, setMode] = useState<RedactionMode>('PSEUDONYMIZE');

  const scenario = useMemo(
    () => PREVIEW_SCENARIOS.find((item) => item.id === scenarioId) ?? PREVIEW_SCENARIOS[0],
    [scenarioId]
  );

  const entitySummary = useMemo(() => {
    const counts = new Map<PIIType, number>();
    let total = 0;
    for (const seg of scenario.segments) {
      if (seg.piiType) {
        total += 1;
        counts.set(seg.piiType, (counts.get(seg.piiType) ?? 0) + 1);
      }
    }
    return { total, entries: Array.from(counts.entries()) };
  }, [scenario]);

  return (
    <div
      className="glass-panel relative overflow-hidden rounded-2xl shadow-lg"
      style={{ boxShadow: 'var(--shadow-md), var(--shadow-glow-blue)' }}
      aria-label="Interactive PrivacyShield sanitization preview"
    >
      {/* Window chrome bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-bg-elevated/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-status-danger/80" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-warning/80" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-verified/80" aria-hidden="true" />
          <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary">
            <Terminal className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
            {scenario.filename}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="verified" className="font-mono text-[10px]">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />0 KB Uploaded
          </Badge>
          <span className="font-mono text-[11px] text-text-muted">
            {entitySummary.total} entities
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col gap-3 border-b border-border-subtle bg-bg-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Sample scenario"
        >
          {PREVIEW_SCENARIOS.map((item) => {
            const active = item.id === scenario.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setScenarioId(item.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-brand-primary/15 text-brand-primary dark:text-blue-400 ring-1 ring-brand-primary/40'
                    : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            if (isRedactionMode(value)) {
              setMode(value);
            }
          }}
          aria-label="Preview redaction mode"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="FULL_MASK">Full Mask</TabsTrigger>
            <TabsTrigger value="PARTIAL_MASK">Partial</TabsTrigger>
            <TabsTrigger value="PSEUDONYMIZE">Pseudonymize</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Side-by-side live comparison preview */}
      <div className="grid divide-y divide-border-subtle lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {/* Detected Original */}
        <div className="flex min-w-0 flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <Eye className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
              Detected PII (Synthetic)
            </span>
            <span className="font-mono text-[10px] text-text-muted">RAM ONLY</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border-subtle bg-bg-canvas/85 p-3.5 font-mono text-xs leading-6 text-text-secondary">
            {scenario.segments.map((seg, idx) => {
              if (!seg.piiType) {
                return <span key={idx}>{seg.text}</span>;
              }
              const meta = PII_CATEGORIES[seg.piiType];
              return (
                <span
                  key={idx}
                  title={`${meta.label} (${meta.validationLabel})`}
                  className="rounded px-1 py-0.5 font-medium"
                  style={{
                    color: meta.colorVar.fg,
                    backgroundColor: meta.colorVar.bg,
                    border: `1px solid ${meta.colorVar.border}`,
                  }}
                >
                  {seg.text}
                </span>
              );
            })}
          </pre>
        </div>

        {/* Sanitized Output */}
        <div className="flex min-w-0 flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-status-verified">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Sanitized Output
            </span>
            <span className="font-mono text-[10px] text-brand-secondary">{mode}</span>
          </div>
          <pre
            data-testid="hero-preview-sanitized"
            className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-status-verified/25 bg-bg-canvas/85 p-3.5 font-mono text-xs leading-6 text-text-secondary"
          >
            {scenario.segments.map((seg, idx) => {
              if (!seg.piiType) {
                return <span key={idx}>{seg.text}</span>;
              }
              return (
                <span
                  key={idx}
                  className="rounded border border-status-verified/40 bg-status-verified/15 px-1 py-0.5 font-semibold text-status-verified"
                >
                  {getRedactedReplacement(seg, mode)}
                </span>
              );
            })}
          </pre>
        </div>
      </div>

      {/* Category breakdown footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-bg-elevated/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {entitySummary.entries.map(([type, count]) => {
            const meta = PII_CATEGORIES[type];
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
                style={{
                  color: meta.colorVar.fg,
                  backgroundColor: meta.colorVar.bg,
                  border: `1px solid ${meta.colorVar.border}`,
                }}
              >
                {meta.shortLabel}: {count}
              </span>
            );
          })}
        </div>

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-brand-primary dark:text-blue-400"
        >
          <Link to="/workspace">
            Try in Workspace
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
