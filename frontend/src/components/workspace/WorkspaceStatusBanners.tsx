import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage } from '@/hooks/useToast';

interface WorkspaceStatusBannersProps {
  toast: ToastMessage | null;
  onDismissToast: () => void;
  errorMessage: string | null;
  onDismissError: () => void;
  isProcessing: boolean;
  progressPercent: number;
}

export function WorkspaceStatusBanners({
  toast,
  onDismissToast,
  errorMessage,
  onDismissError,
  isProcessing,
  progressPercent,
}: WorkspaceStatusBannersProps) {
  return (
    <>
      {/* Persistent Live Status Region for Toast Feedback */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            className={`mb-4 flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium ${
              toast.tone === 'error'
                ? 'border-status-danger/40 bg-status-danger/10 text-red-700 dark:text-red-300'
                : toast.tone === 'info'
                  ? 'border-brand-primary/40 bg-brand-primary/10 text-blue-700 dark:text-blue-300'
                  : 'border-status-verified/40 bg-status-verified/10 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {toast.tone === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : toast.tone === 'info' ? (
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {toast.text}
            </span>
            <button
              type="button"
              onClick={onDismissToast}
              aria-label="Dismiss notification"
              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded opacity-80 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Workspace-wide Error / Warning Banner (visible across Paste and Upload tabs) */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-xs text-red-700 dark:text-red-300"
        >
          <span className="inline-flex items-start gap-2 pt-0.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error alert"
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded opacity-80 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Inline Scanning Progress Bar */}
      {isProcessing && (
        <div
          role="progressbar"
          aria-label="Local PII scan progress"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mb-4 rounded-xl border border-brand-primary/30 bg-bg-surface px-4 py-2.5"
        >
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-text-secondary">
            <span>Scanning document locally in browser memory...</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-brand-primary transition-[width] duration-150"
              style={{ width: `${Math.max(8, progressPercent)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
