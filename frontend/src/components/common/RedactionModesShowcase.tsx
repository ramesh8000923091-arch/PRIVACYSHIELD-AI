import { useState } from 'react';
import { Check, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { PII_CATEGORIES } from '@/constants';
import { isRedactionMode, type PIIType, type RedactionMode } from '@/types';

interface ModeRow {
  type: PIIType;
  label: string;
  original: string;
  fullTag: string;
  fullGeneric: string;
  partial: string;
  pseudonym: string;
  policyNote: string;
}

const MODE_COMPARISON_ROWS: readonly ModeRow[] = [
  {
    type: 'EMAIL',
    label: 'Email',
    original: 'anuj@example.com',
    fullTag: '[REDACTED_EMAIL]',
    fullGeneric: '[REDACTED]',
    partial: 'an**@example.com',
    pseudonym: 'USER_01',
    policyNote: 'Retains first 2 local-part chars + domain',
  },
  {
    type: 'PHONE',
    label: 'Phone (India)',
    original: '+91 9876543210',
    fullTag: '[REDACTED_PHONE]',
    fullGeneric: '[REDACTED]',
    partial: 'XXXXXX3210',
    pseudonym: 'PHONE_01',
    policyNote: 'Retains last 4 digits only',
  },
  {
    type: 'IP_ADDRESS',
    label: 'IPv4 Address',
    original: '192.168.42.19',
    fullTag: '[REDACTED_IP_ADDRESS]',
    fullGeneric: '[REDACTED]',
    partial: '192.168.xxx.xxx',
    pseudonym: 'IP_01',
    policyNote: 'Preserves /16 prefix; masks host octets',
  },
  {
    type: 'IP_ADDRESS',
    label: 'IPv6 Address',
    original: '2001:0db8:85a3::7334',
    fullTag: '[REDACTED_IP_ADDRESS]',
    fullGeneric: '[REDACTED]',
    partial: '2001:0db8:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx',
    pseudonym: 'IP_02',
    policyNote: 'Preserves first 2 hextets; masks interface ID',
  },
  {
    type: 'PAN',
    label: 'Indian PAN',
    original: 'ABCPK1234F',
    fullTag: '[REDACTED_PAN]',
    fullGeneric: '[REDACTED]',
    partial: 'XXXXX1234X',
    pseudonym: 'PAN_01',
    policyNote: 'Masks letters & check char; retains numeric core',
  },
  {
    type: 'AADHAAR',
    label: 'Aadhaar',
    original: '2345 6789 0128',
    fullTag: '[REDACTED_AADHAAR]',
    fullGeneric: '[REDACTED]',
    partial: 'XXXX XXXX 0128',
    pseudonym: 'AADHAAR_01',
    policyNote: 'Retains last 4 digits only',
  },
  {
    type: 'CREDIT_CARD',
    label: 'Credit Card',
    original: '4111-1111-1111-1111',
    fullTag: '[REDACTED_CREDIT_CARD]',
    fullGeneric: '[REDACTED]',
    partial: 'XXXX-XXXX-XXXX-1111',
    pseudonym: 'CARD_01',
    policyNote: 'Retains last 4 digits (Luhn-verified)',
  },
];

const MODE_DESCRIPTIONS: Record<
  RedactionMode,
  {
    title: string;
    subtitle: string;
    highlights: readonly string[];
  }
> = {
  FULL_MASK: {
    title: 'Mode A — Full Mask',
    subtitle:
      'Completely removes sensitive values with structured category tokens or a uniform [REDACTED] marker for maximum compliance safety.',
    highlights: [
      'Zero character leakage from original sensitive values',
      'Supports category-specific tags or generic [REDACTED] output',
      'Ideal for public bug reports, compliance exports, and external sharing',
    ],
  },
  PARTIAL_MASK: {
    title: 'Mode B — Partial Mask',
    subtitle:
      'Retains strictly bounded verification hints (such as last 4 digits or /16 network prefix) so support and security teams can cross-reference records safely.',
    highlights: [
      'Never exposes a complete sensitive identifier',
      'Explicit IPv4 (/16 prefix) & IPv6 (2-hextet prefix) masking policy',
      'Balances human auditability with strict data minimization',
    ],
  },
  PSEUDONYMIZE: {
    title: 'Mode C — Consistent Pseudonymization',
    subtitle:
      'Maps identical normalized entities to deterministic placeholders (USER_01, PHONE_01) throughout the document — preserving relational integrity for analytics and debugging.',
    highlights: [
      'Repeated values always resolve to the exact same placeholder',
      'Mappings exist exclusively in volatile RAM — never uploaded to Supabase',
      'Automatically resets on new documents unless explicitly opted in',
    ],
  },
};

export function RedactionModesShowcase() {
  const [activeMode, setActiveMode] = useState<RedactionMode>('FULL_MASK');
  const [useGenericToken, setUseGenericToken] = useState(false);

  const info = MODE_DESCRIPTIONS[activeMode];

  return (
    <Tabs
      value={activeMode}
      onValueChange={(value) => {
        if (isRedactionMode(value)) {
          setActiveMode(value);
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <TabsList
          aria-label="Redaction mode comparison"
          className="grid w-full grid-cols-3 sm:w-auto"
        >
          <TabsTrigger value="FULL_MASK" className="px-4 py-2 text-xs sm:text-sm">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Full Mask
          </TabsTrigger>
          <TabsTrigger value="PARTIAL_MASK" className="px-4 py-2 text-xs sm:text-sm">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Partial Mask
          </TabsTrigger>
          <TabsTrigger value="PSEUDONYMIZE" className="px-4 py-2 text-xs sm:text-sm">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Pseudonymize
          </TabsTrigger>
        </TabsList>

        {activeMode === 'FULL_MASK' && (
          <label
            htmlFor="showcase-generic-token"
            className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-xs font-medium text-text-secondary"
          >
            <Switch
              id="showcase-generic-token"
              checked={useGenericToken}
              onCheckedChange={setUseGenericToken}
              aria-label="Toggle generic redacted token"
            />
            <span>Use generic [REDACTED] token</span>
          </label>
        )}
      </div>

      {(['FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYMIZE'] as const).map((modeKey) => (
        <TabsContent key={modeKey} value={modeKey} className="mt-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
                <div className="space-y-4">
                  <Badge variant="primary" className="font-mono text-[11px]">
                    {modeKey}
                  </Badge>
                  <h3 className="text-xl font-bold text-text-primary">{info.title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{info.subtitle}</p>
                  <ul className="space-y-2.5 pt-2">
                    {info.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-text-secondary"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-status-verified"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {modeKey === 'PSEUDONYMIZE' && (
                  <div className="rounded-lg border border-brand-secondary/30 bg-brand-secondary/10 p-3.5 font-mono text-xs leading-relaxed text-text-secondary">
                    <p className="mb-1.5 font-semibold text-violet-700 dark:text-violet-300">
                      Consistency Example:
                    </p>
                    <p>Contact anuj@example.com → Contact USER_01</p>
                    <p>Email ANUJ@EXAMPLE.COM → Email USER_01</p>
                    <p>CC priya@example.com → CC USER_02</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden lg:col-span-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-bg-elevated/70 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                      <th scope="col" className="px-4 py-3">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Synthetic Input
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Sanitized Output
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {MODE_COMPARISON_ROWS.map((row) => {
                      const meta = PII_CATEGORIES[row.type];
                      const output =
                        modeKey === 'FULL_MASK'
                          ? useGenericToken
                            ? row.fullGeneric
                            : row.fullTag
                          : modeKey === 'PARTIAL_MASK'
                            ? row.partial
                            : row.pseudonym;

                      return (
                        <tr key={row.label} className="transition-colors hover:bg-bg-elevated/40">
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-medium"
                              style={{
                                color: meta.colorVar.fg,
                                backgroundColor: meta.colorVar.bg,
                                border: `1px solid ${meta.colorVar.border}`,
                              }}
                            >
                              {row.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-text-muted">
                            {row.original}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              {output}
                            </div>
                            {modeKey === 'PARTIAL_MASK' && (
                              <div className="mt-0.5 text-[11px] text-text-muted">
                                {row.policyNote}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
