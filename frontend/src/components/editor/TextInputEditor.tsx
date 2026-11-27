import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, RotateCcw, RotateCw, ScanSearch, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { countWords } from '@/utils/formatters';

interface TextInputEditorProps {
  value: string;
  isProcessing?: boolean;
  onChange: (next: string) => void;
  onRunDetection: () => void;
  onLoadSample: () => void;
  onLoadSampleCsv: () => void;
  onClear: () => void;
}

export function TextInputEditor({
  value,
  isProcessing = false,
  onChange,
  onRunDetection,
  onLoadSample,
  onLoadSampleCsv,
  onClear,
}: TextInputEditorProps) {
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const lastCommittedRef = useRef(value);

  // Keep undo/redo reference synced when value changes externally (e.g., Sample loaded / Clear)
  useEffect(() => {
    if (value !== lastCommittedRef.current) {
      if (value === '') {
        setUndoStack([]);
        setRedoStack([]);
      } else if (lastCommittedRef.current !== '') {
        setUndoStack((prev) => [...prev.slice(-24), lastCommittedRef.current]);
        setRedoStack([]);
      }
      lastCommittedRef.current = value;
    }
  }, [value]);

  function handleTextChange(next: string) {
    if (next !== lastCommittedRef.current) {
      setUndoStack((prev) => [...prev.slice(-24), lastCommittedRef.current]);
      setRedoStack([]);
      lastCommittedRef.current = next;
    }
    onChange(next);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, value]);
    lastCommittedRef.current = previous;
    onChange(previous);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, value]);
    lastCommittedRef.current = next;
    onChange(next);
  }

  const charCount = value.length;
  const wordCount = countWords(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="primary" onClick={onLoadSample}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Load Sample Data
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onLoadSampleCsv}>
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            Sample CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRunDetection}
            disabled={!value || isProcessing}
            title={!value ? 'Enter or load text to run detection' : 'Run immediate PII scan'}
          >
            <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
            Detect Now
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo edit"
            title={undoStack.length === 0 ? 'Nothing to undo' : 'Undo last edit'}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo edit"
            title={redoStack.length === 0 ? 'Nothing to redo' : 'Redo edit'}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClear}
            disabled={!value}
            aria-label="Clear workspace"
            title={!value ? 'Workspace is already empty' : 'Clear all text and detections from RAM'}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      <label htmlFor="privacyshield-raw-editor" className="sr-only">
        Raw document text input
      </label>
      <textarea
        id="privacyshield-raw-editor"
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder="Paste raw text logs, support tickets, resumes, clinical notes, or CSV rows here. All detection and sanitization execute 100% locally inside your browser — nothing is uploaded."
        className="w-full resize-y rounded-xl border border-border-default bg-bg-canvas p-4 font-mono text-xs leading-6 text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 sm:text-sm"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-4 font-mono">
          <span data-testid="editor-char-count">{charCount.toLocaleString()} chars</span>
          <span data-testid="editor-word-count">{wordCount.toLocaleString()} words</span>
        </div>
        <span className="font-mono text-[11px] text-status-verified">
          Volatile RAM only • Never persisted
        </span>
      </div>
    </div>
  );
}
