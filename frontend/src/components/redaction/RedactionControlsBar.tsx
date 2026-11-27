import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  EyeOff,
  FileJson,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import type { RestoreResult } from '@/services/redaction';
import type { FullMaskVariant, ParsedCsvDocument, RedactionMode } from '@/types';

interface RedactionControlsBarProps {
  mode: RedactionMode;
  fullMaskVariant: FullMaskVariant;
  mappingCount: number;
  isOutputReady: boolean;
  isProcessing?: boolean;
  parsedCsv: ParsedCsvDocument | null;
  onModeChange: (mode: RedactionMode) => void;
  onFullMaskVariantChange: (variant: FullMaskVariant) => void;
  onResetMappings: () => void;
  onCopySanitized: () => Promise<boolean>;
  onDownloadTxt: () => void;
  onDownloadCsv: () => void;
  onDownloadReport: () => void;
  onRestoreAiResponse?: (pseudonymizedReply: string) => RestoreResult;
}

function isRedactionMode(value: string): value is RedactionMode {
  return value === 'FULL_MASK' || value === 'PARTIAL_MASK' || value === 'PSEUDONYMIZE';
}

export function RedactionControlsBar({
  mode,
  fullMaskVariant,
  mappingCount,
  isOutputReady,
  isProcessing = false,
  parsedCsv,
  onModeChange,
  onFullMaskVariantChange,
  onResetMappings,
  onCopySanitized,
  onDownloadTxt,
  onDownloadCsv,
  onDownloadReport,
  onRestoreAiResponse,
}: RedactionControlsBarProps) {
  const [copied, setCopied] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [aiReplyInput, setAiReplyInput] = useState('');
  const [restoredCopied, setRestoredCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const restoredCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (restoredCopyTimerRef.current !== null) {
        window.clearTimeout(restoredCopyTimerRef.current);
      }
    };
  }, []);

  const disabledReason = isProcessing
    ? 'Wait for local scan to finish'
    : 'Paste text or upload a file first';

  const restoreResult =
    restoreOpen && onRestoreAiResponse && aiReplyInput && mappingCount > 0
      ? onRestoreAiResponse(aiReplyInput)
      : null;

  async function handleCopyClick() {
    const ok = await onCopySanitized();
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1800);
  }

  async function handleCopyRestored() {
    if (!restoreResult?.restoredText || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(restoreResult.restoredText);
      setRestoredCopied(true);
      if (restoredCopyTimerRef.current !== null) {
        window.clearTimeout(restoredCopyTimerRef.current);
      }
      restoredCopyTimerRef.current = window.setTimeout(() => {
        setRestoredCopied(false);
        restoredCopyTimerRef.current = null;
      }, 1800);
    } catch {
      // Ignore clipboard rejection in restricted contexts
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (isRedactionMode(value)) {
                onModeChange(value);
              }
            }}
            aria-label="Workspace redaction mode"
          >
            <TabsList>
              <TabsTrigger value="FULL_MASK">
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                Full Mask
              </TabsTrigger>
              <TabsTrigger value="PARTIAL_MASK">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Partial Mask
              </TabsTrigger>
              <TabsTrigger value="PSEUDONYMIZE">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Pseudonymize
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'FULL_MASK' && (
            <label
              htmlFor="generic-mask-switch"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-1.5 text-xs text-text-secondary"
            >
              <Switch
                id="generic-mask-switch"
                checked={fullMaskVariant === 'GENERIC'}
                onCheckedChange={(checked) =>
                  onFullMaskVariantChange(checked ? 'GENERIC' : 'CATEGORY_TAG')
                }
                aria-label="Use generic [REDACTED] placeholder"
              />
              <span>Generic [REDACTED]</span>
            </label>
          )}

          {mode === 'PSEUDONYMIZE' && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[11px]">
                RAM Mappings: {mappingCount}
              </Badge>
              {onRestoreAiResponse && (
                <Button
                  type="button"
                  variant={restoreOpen ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRestoreOpen((open) => !open)}
                  disabled={mappingCount === 0}
                  aria-expanded={restoreOpen}
                  title={
                    mappingCount === 0
                      ? 'Scan text in Pseudonymize mode first to create volatile RAM tokens'
                      : 'Paste an AI response containing pseudonym tokens to restore originals locally in RAM'
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Restore AI Reply
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onResetMappings();
                  setRestoreOpen(false);
                  setAiReplyInput('');
                }}
                disabled={mappingCount === 0}
                title={mappingCount === 0 ? 'No active RAM mappings to reset' : undefined}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset Mappings
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleCopyClick();
            }}
            disabled={!isOutputReady}
            title={!isOutputReady ? disabledReason : 'Copy sanitized output to clipboard'}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-status-verified" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Output
              </>
            )}
          </Button>

          {parsedCsv ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onDownloadCsv}
              disabled={!isOutputReady}
              title={!isOutputReady ? disabledReason : 'Download sanitized .csv file'}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download .CSV
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onDownloadTxt}
              disabled={!isOutputReady}
              title={!isOutputReady ? disabledReason : 'Download sanitized .txt file'}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download .TXT
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDownloadReport}
            disabled={!isOutputReady}
            title={
              !isOutputReady ? disabledReason : 'Export safe JSON privacy summary (zero PII values)'
            }
          >
            <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
            Privacy Report
          </Button>
        </div>
      </div>

      {mode === 'PSEUDONYMIZE' && restoreOpen && onRestoreAiResponse && (
        <div
          data-testid="restore-ai-reply-panel"
          className="rounded-lg border border-brand-secondary/35 bg-bg-elevated/50 p-4"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Local RAM Re-Hydration — Restore AI Reply
              </p>
              <p className="text-[11px] text-text-muted">
                Paste an LLM response containing tokens like{' '}
                <code className="font-mono">USER_01</code> or{' '}
                <code className="font-mono">PHONE_01</code> to restore original values strictly in
                volatile browser RAM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRestoreOpen(false)}
              className="rounded p-1 text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary cursor-pointer"
              aria-label="Close Restore AI Reply panel"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="ai-reply-input"
                className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted"
              >
                Pseudonymized AI Response
              </label>
              <textarea
                id="ai-reply-input"
                value={aiReplyInput}
                onChange={(e) => setAiReplyInput(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="Paste AI reply here, e.g.: Hi USER_01, please confirm your callback number PHONE_01..."
                className="w-full resize-y rounded-lg border border-border-default bg-bg-canvas/85 p-3 font-mono text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-status-verified">
                  Restored Locally (RAM Only)
                </span>
                <div className="flex items-center gap-2">
                  {restoreResult && (
                    <Badge variant="verified" className="font-mono text-[10px]">
                      {restoreResult.restoredCount} token
                      {restoreResult.restoredCount === 1 ? '' : 's'} restored
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleCopyRestored();
                    }}
                    disabled={!restoreResult?.restoredText}
                    className="h-6 px-2 text-[11px]"
                  >
                    {restoredCopied ? 'Copied' : 'Copy Restored'}
                  </Button>
                </div>
              </div>
              <pre
                data-testid="restored-ai-reply-output"
                className="min-h-[6.5rem] whitespace-pre-wrap break-words rounded-lg border border-status-verified/30 bg-bg-canvas/85 p-3 font-mono text-xs leading-relaxed text-text-primary"
              >
                {restoreResult?.restoredText ||
                  'Restored output will appear here once you paste a pseudonymized reply.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
