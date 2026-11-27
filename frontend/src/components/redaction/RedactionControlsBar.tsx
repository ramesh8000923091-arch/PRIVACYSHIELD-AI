import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Badge, Button, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import type { RestoreResult } from '@/services/redaction';
import {
  isRedactionMode,
  type FullMaskVariant,
  type ParsedCsvDocument,
  type RedactionMode,
} from '@/types';
import { RestoreAiReplyPanel } from './RestoreAiReplyPanel';

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
  const copyTimerRef = useRef<number | null>(null);
  const restoreButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'PSEUDONYMIZE' || mappingCount === 0) {
      setRestoreOpen(false);
    }
  }, [mode, mappingCount]);

  const handleCloseRestorePanel = useCallback(() => {
    setRestoreOpen(false);
    restoreButtonRef.current?.focus();
  }, []);

  const disabledReason = isProcessing
    ? 'Wait for local scan to finish'
    : 'Paste text or upload a file first';

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
          >
            <TabsList aria-label="Workspace redaction mode">
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
            <TabsContent
              value="FULL_MASK"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Full Mask policy active.
            </TabsContent>
            <TabsContent
              value="PARTIAL_MASK"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Partial Mask policy active.
            </TabsContent>
            <TabsContent
              value="PSEUDONYMIZE"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Consistent Pseudonymization policy active.
            </TabsContent>
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
                  ref={restoreButtonRef}
                  type="button"
                  variant={restoreOpen ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRestoreOpen((open) => !open)}
                  disabled={mappingCount === 0}
                  aria-expanded={restoreOpen}
                  aria-controls="restore-ai-reply-panel"
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
        <RestoreAiReplyPanel
          aiReplyInput={aiReplyInput}
          mappingCount={mappingCount}
          onInputChange={setAiReplyInput}
          onRestoreAiResponse={onRestoreAiResponse}
          onClose={handleCloseRestorePanel}
        />
      )}
    </div>
  );
}
