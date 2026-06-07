import { useCallback, useEffect, useRef } from 'react';
import {
  hasRichFormatting,
  isEmptyRichText,
  normalizeEditorOutput,
  normalizeStoredRichText,
  storedValueToEditorDom,
} from '../../domain/protocol/authoring/richTextContent';
import { cn } from '../ui/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  editorKey?: string;
  onBlurCommit?: (value: string) => void;
  ideMode?: boolean;
  hideToolbar?: boolean;
  highlightQuery?: string;
  surfaceRef?: React.RefObject<HTMLDivElement | null>;
  'data-testid'?: string;
}

function editorDomMatches(node: HTMLDivElement, value: string): boolean {
  const normalized = normalizeStoredRichText(value);
  if (!normalized.trim()) {
    return isEmptyRichText(node.innerHTML) && !(node.textContent ?? '').trim();
  }
  if (hasRichFormatting(normalized)) {
    return normalizeEditorOutput(node.innerHTML) === normalized;
  }
  return (node.textContent ?? '').replace(/\u00a0/g, ' ') === normalized.replace(/\u00a0/g, ' ');
}

function writeEditorDom(node: HTMLDivElement, value: string): void {
  const domValue = storedValueToEditorDom(value);
  if (!domValue.trim()) {
    node.textContent = '';
    return;
  }
  if (hasRichFormatting(domValue)) {
    node.innerHTML = domValue;
    return;
  }
  node.textContent = domValue;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  editorKey,
  onBlurCommit,
  ideMode = false,
  hideToolbar = false,
  highlightQuery,
  surfaceRef,
  'data-testid': dataTestId = 'rich-text-editor',
}: RichTextEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const editorRef = surfaceRef ?? internalRef;
  const lastEmitted = useRef(normalizeStoredRichText(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) {
      lastEmitted.current = normalizeStoredRichText(value);
      return;
    }
    const normalized = normalizeStoredRichText(value);
    if (isFocusedRef.current || editorDomMatches(node, normalized)) {
      lastEmitted.current = normalized;
      return;
    }
    writeEditorDom(node, normalized);
    lastEmitted.current = normalized;
  }, [value, editorKey, editorRef]);

  const emitChange = useCallback(() => {
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const normalized = normalizeEditorOutput(node.innerHTML);
    if (normalized !== lastEmitted.current) {
      lastEmitted.current = normalized;
      onChange(normalized);
    }
  }, [onChange, readOnly, editorRef]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const normalized = normalizeEditorOutput(node.innerHTML);
    lastEmitted.current = normalized;
    onChange(normalized);
    onBlurCommit?.(normalized);
  }, [onBlurCommit, onChange, readOnly, editorRef]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  if (hideToolbar && readOnly) {
    // read-only path unchanged
  }

  return (
    <div className={cn('space-y-2', className)} data-testid={dataTestId}>
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={cn(
          'min-h-[240px] px-3 py-2 text-sm leading-6 text-foreground caret-foreground',
          ideMode
            ? 'bg-transparent font-mono focus:outline-none'
            : 'rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input/30',
          readOnly && !ideMode && 'bg-muted/20',
          highlightQuery && 'ring-1 ring-amber-500/40',
        )}
        data-placeholder={placeholder}
        data-testid={`${dataTestId}-surface`}
        data-highlight-query={highlightQuery || undefined}
        onInput={readOnly ? undefined : emitChange}
        onFocus={readOnly ? undefined : handleFocus}
        onBlur={readOnly ? undefined : handleBlur}
      />
      {!readOnly && placeholder ? (
        <style>{`
          [data-testid="${dataTestId}-surface"]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
          }
        `}</style>
      ) : null}
    </div>
  );
}

export function RichTextReadOnlyView({ value, className }: { value: string; className?: string }) {
  const normalized = normalizeStoredRichText(value);
  if (!normalized.trim()) {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>No content authored yet.</p>;
  }
  if (hasRichFormatting(normalized)) {
    return (
      <div
        className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-foreground', className)}
        data-testid="rich-text-readonly-view"
        dangerouslySetInnerHTML={{ __html: normalized }}
      />
    );
  }
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-foreground', className)}
      data-testid="rich-text-readonly-view"
    >
      {normalized}
    </div>
  );
}
