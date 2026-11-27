import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'local-processing',
    question: 'Does any of my pasted text or uploaded file ever leave my browser?',
    answer:
      'No. All PII detection, Luhn and Verhoeff checksum validation, highlighting, redaction, side-by-side diff generation, and file export run 100% inside your browser’s JavaScript engine and Web Workers. You can verify zero outbound document traffic at any time in your browser DevTools Network tab.',
  },
  {
    id: 'pseudonymization-reset',
    question: 'How does Consistent Pseudonymization work and when are mappings cleared?',
    answer:
      'Normalized sensitive values (such as lowercased emails or canonical 10-digit Indian mobile numbers) are mapped to deterministic category tokens like USER_01 and PHONE_01 inside volatile browser RAM only. Mappings are never written to browser storage or external servers and automatically reset when you load a new document, click Reset Mappings, clear the workspace, or reload the tab.',
  },
  {
    id: 'aadhaar-pan-scope',
    question: 'Does PrivacyShield AI verify Aadhaar or PAN numbers with government databases?',
    answer:
      'No. PrivacyShield AI performs deterministic structural and mathematical validation only — Verhoeff checksum plus leading-digit [2–9] rules for Aadhaar-like 12-digit numbers, and 10-character structural format validation (including entity-type code and name initial) for PAN. It never queries UIDAI or Income Tax Department APIs.',
  },
  {
    id: 'csv-integrity',
    question:
      'Will sanitizing a CSV file break columns, delimiters, or commas inside quoted fields?',
    answer:
      'No. CSV uploads are parsed using PapaParse with cell-level sanitization. Detection runs independently per cell so adjacent columns never merge into false matches, and export reconstructs valid CSV syntax while preserving headers, delimiters, and quoted fields.',
  },
  {
    id: 'supabase-optional',
    question: 'Is Supabase required to use PrivacyShield AI?',
    answer:
      'No. PrivacyShield AI operates in Local-Only Mode by default when no Supabase credentials are configured. Optional Supabase integration is strictly limited to authenticated UI preferences and explicitly consented aggregate integer counts — never raw text, filenames, or PII values.',
  },
  {
    id: 'large-files',
    question: 'How does PrivacyShield AI handle large logs or CSV datasets without freezing?',
    answer:
      'Documents below 50 KB process synchronously in a few milliseconds. Inputs at or above 50 KB (or CSVs exceeding 500 rows) automatically offload to a dedicated browser Web Worker with progress tracking and cancellation support, with uploads capped at 10 MB to protect browser memory.',
  },
];

export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  function toggleItem(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <div className="divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-bg-surface">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `faq-panel-${item.id}`;
        const buttonId = `faq-trigger-${item.id}`;

        return (
          <div key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated/60 sm:text-base cursor-pointer"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-text-muted transition-transform duration-200',
                    isOpen && 'rotate-180 text-brand-primary'
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="border-t border-border-subtle bg-bg-elevated/30 px-5 py-4 text-sm leading-relaxed text-text-secondary"
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
