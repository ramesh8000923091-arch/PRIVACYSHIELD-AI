import { useRef, useState } from 'react';
import { FileSpreadsheet, FileText, UploadCloud, X } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { LIMITS } from '@/constants';
import type { ParsedCsvDocument, UploadedFileMeta } from '@/types';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/formatters';

interface FileUploadZoneProps {
  uploadedFile: UploadedFileMeta | null;
  parsedCsv: ParsedCsvDocument | null;
  isProcessing: boolean;
  progressPercent: number;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
}

export function FileUploadZone({
  uploadedFile,
  parsedCsv,
  isProcessing,
  progressPercent,
  onFileSelect,
  onRemoveFile,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const maxMb = Math.round(LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024));

  function handleFiles(files: FileList | null) {
    if (isProcessing || !files || files.length === 0) return;
    onFileSelect(files[0]);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isProcessing) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isProcessing && 'opacity-65 pointer-events-none',
          isDragging
            ? 'border-brand-primary bg-brand-primary/10'
            : 'border-border-default bg-bg-canvas/70 hover:border-brand-primary/60 hover:bg-bg-elevated/40'
        )}
      >
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border-default bg-bg-elevated text-brand-primary dark:text-blue-400">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">
            Drag and drop your file here, or browse locally
          </p>
          <p className="text-xs text-text-muted">
            Supports <code className="font-mono text-text-secondary">.txt</code> and{' '}
            <code className="font-mono text-text-secondary">.csv</code> up to {maxMb} MB • UTF-8
            validated strictly inside your browser
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isProcessing}
          onClick={() => inputRef.current?.click()}
          title={
            isProcessing ? 'Wait for active scan to finish' : 'Choose a local .txt or .csv file'
          }
        >
          Browse Local Files
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          className="hidden"
          disabled={isProcessing}
          data-testid="file-upload-input"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {isProcessing && (
        <div
          role="progressbar"
          aria-label="Local browser scan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          className="space-y-1.5 rounded-lg border border-brand-primary/30 bg-brand-primary/10 p-3"
        >
          <div className="flex items-center justify-between font-mono text-xs text-brand-primary dark:text-blue-400">
            <span>Scanning locally in browser…</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full bg-brand-primary transition-all duration-150"
              style={{ width: `${Math.max(10, progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {uploadedFile && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-verified/35 bg-status-verified/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {uploadedFile.extension === '.csv' ? (
              <FileSpreadsheet
                className="h-5 w-5 shrink-0 text-status-verified"
                aria-hidden="true"
              />
            ) : (
              <FileText className="h-5 w-5 shrink-0 text-status-verified" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-text-primary">
                {uploadedFile.name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                <span>{formatBytes(uploadedFile.sizeBytes)}</span>
                {parsedCsv && (
                  <Badge variant="verified" className="font-mono text-[10px]">
                    {parsedCsv.rows.length} rows × {parsedCsv.headers.length} cols
                    {parsedCsv.delimiter !== ','
                      ? ` (${parsedCsv.delimiter === '\t' ? 'TAB' : parsedCsv.delimiter})`
                      : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemoveFile}
            aria-label="Remove uploaded file"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
