import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import type { RestoreResult } from '@/services/redaction';

interface RestoreAiReplyPanelProps {
  aiReplyInput: string;
  mappingCount: number;
  onInputChange: (value: string) => void;
  onRestoreAiResponse: (pseudonymizedReply: string) => RestoreResult;
  onClose: () => void;
}

export function RestoreAiReplyPanel({
  aiReplyInput,
  mappingCount,
  onInputChange,
  onRestoreAiResponse,
  onClose,
}: RestoreAiReplyPanelProps) {
  const [restoredCopied, setRestoredCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const restoredCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (restoredCopyTimerRef.current !== null) {
        window.clearTimeout(restoredCopyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const restoreResult = useMemo(() => {
    if (!aiReplyInput || mappingCount === 0) return null;
    return onRestoreAiResponse(aiReplyInput);
  }, [aiReplyInput, mappingCount, onRestoreAiResponse]);

  async function handleCopyRestored() {
    if (!restoreResult?.restoredText) return;
    if (!navigator.clipboard?.writeText) {
      setCopyError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(restoreResult.restoredText);
      setCopyError(false);
      setRestoredCopied(true);
      if (restoredCopyTimerRef.current !== null) {
        window.clearTimeout(restoredCopyTimerRef.current);
      }
      restoredCopyTimerRef.current = window.setTimeout(() => {
        setRestoredCopied(false);
        restoredCopyTimerRef.current = null;
      }, 1800);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div
      id="restore-ai-reply-panel"
      role="region"
      aria-label="Local RAM Re-Hydration — Restore AI Reply"
      data-testid="restore-ai-reply-panel"
      className="rounded-lg border border-brand-secondary/35 bg-bg-elevated/50 p-4"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text-primary">
            Local RAM Re-Hydration — Restore AI Reply
          </p>
          <p className="text-[11px] text-text-muted">
            Paste an LLM response containing tokens like <code className="font-mono">USER_01</code>{' '}
            or <code className="font-mono">PHONE_01</code> to restore original values strictly in
            volatile browser RAM.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
          aria-label="Close Restore AI Reply panel"
          title="Close panel (Esc)"
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
            onChange={(e) => onInputChange(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="Paste AI reply here, e.g.: Hi USER_01, please confirm your callback number PHONE_01..."
            className="w-full resize-y rounded-lg border border-border-default bg-bg-canvas/85 p-3 font-mono text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
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
                className="h-7 px-2.5 text-[11px]"
              >
                {restoredCopied ? 'Copied' : 'Copy Restored'}
              </Button>
            </div>
          </div>
          <pre
            tabIndex={0}
            aria-live="polite"
            data-testid="restored-ai-reply-output"
            className="min-h-[6.5rem] whitespace-pre-wrap break-words rounded-lg border border-status-verified/30 bg-bg-canvas/85 p-3 font-mono text-xs leading-relaxed text-text-primary"
          >
            {restoreResult?.restoredText ||
              'Restored output will appear here once you paste a pseudonymized reply.'}
          </pre>
          {copyError && (
            <p role="alert" className="text-[11px] text-red-700 dark:text-red-300">
              Clipboard write failed. Select and copy the restored output manually.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
