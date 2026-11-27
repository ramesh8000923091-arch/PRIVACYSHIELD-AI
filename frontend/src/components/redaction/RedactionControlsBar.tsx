import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  EyeOff,
  FileJson,
  KeyRound,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Badge, Button, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import type { FullMaskVariant, ParsedCsvDocument, RedactionMode } from '@/types';

interface RedactionControlsBarProps {
  mode: RedactionMode;
  fullMaskVariant: FullMaskVariant;
  mappingCount: number;
  hasSanitizedOutput: boolean;
  parsedCsv: ParsedCsvDocument | null;
  onModeChange: (mode: RedactionMode) => void;
  onFullMaskVariantChange: (variant: FullMaskVariant) => void;
  onResetMappings: () => void;
  onCopySanitized: () => void;
  onDownloadTxt: () => void;
  onDownloadCsv: () => void;
  onDownloadReport: () => void;
}

export function RedactionControlsBar({
  mode,
  fullMaskVariant,
  mappingCount,
  hasSanitizedOutput,
  parsedCsv,
  onModeChange,
  onFullMaskVariantChange,
  onResetMappings,
  onCopySanitized,
  onDownloadTxt,
  onDownloadCsv,
  onDownloadReport,
}: RedactionControlsBarProps) {
  const [copied, setCopied] = useState(false);

  function handleCopyClick() {
    onCopySanitized();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={mode}
            onValueChange={(value) => onModeChange(value as RedactionMode)}
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
            <label className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-1.5 text-xs text-text-secondary cursor-pointer">
              <Switch
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
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[11px]">
                RAM Mappings: {mappingCount}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetMappings}
                disabled={mappingCount === 0}
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
            onClick={handleCopyClick}
            disabled={!hasSanitizedOutput}
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
              disabled={!hasSanitizedOutput}
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
              disabled={!hasSanitizedOutput}
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
            disabled={!hasSanitizedOutput}
            title="Export safe JSON privacy summary (zero PII values)"
          >
            <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
            Privacy Report
          </Button>
        </div>
      </div>
    </div>
  );
}
