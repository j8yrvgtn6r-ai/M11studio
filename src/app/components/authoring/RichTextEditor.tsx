import { useCallback, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  editorKey?: string;
  onBlurCommit?: (value: string) => void;
  'data-testid'?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function isEmptyHtml(html: string): boolean {
  return stripHtml(html).length === 0;
}

function isPlainTextValue(value: string): boolean {
  return Boolean(value.trim()) && !/<[a-z][\s\S]*>/i.test(value);
}

function editorContentMatches(node: HTMLDivElement, value: string): boolean {
  if (!value.trim()) {
    return isEmptyHtml(node.innerHTML);
  }
  if (isPlainTextValue(value)) {
    return (node.textContent ?? '').trim() === value.trim();
  }
  return stripHtml(node.innerHTML) === stripHtml(value);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  editorKey,
  onBlurCommit,
  'data-testid': dataTestId = 'rich-text-editor',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    const node = editorRef.current;
    if (!node || editorContentMatches(node, value)) {
      lastEmitted.current = value;
      return;
    }
    if (isPlainTextValue(value)) {
      node.textContent = value;
    } else {
      node.innerHTML = value || '';
    }
    lastEmitted.current = value;
  }, [value, editorKey]);

  const emitChange = useCallback(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }
    const html = isEmptyHtml(node.innerHTML) ? '' : node.innerHTML;
    if (html !== lastEmitted.current) {
      lastEmitted.current = html;
      onChange(html);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const html = isEmptyHtml(node.innerHTML) ? '' : node.innerHTML;
    lastEmitted.current = html;
    onChange(html);
    onBlurCommit?.(html);
  }, [onBlurCommit, onChange, readOnly]);

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  return (
    <div className={cn('space-y-2', className)} data-testid={dataTestId}>
      {!readOnly ? (
        <div
          className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1 text-foreground"
          data-testid={`${dataTestId}-toolbar`}
        >
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('bold')} aria-label="Bold">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('italic')} aria-label="Italic">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('underline')} aria-label="Underline">
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('insertUnorderedList')} aria-label="Bulleted list">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('insertOrderedList')} aria-label="Numbered list">
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('formatBlock', 'h3')} aria-label="Heading">
            <Type className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('formatBlock', 'p')} aria-label="Paragraph">
            <span className="text-[10px] font-semibold">P</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('undo')} aria-label="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 px-0 text-foreground" onClick={() => runCommand('redo')} aria-label="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={cn(
          'min-h-[240px] rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground caret-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input/30',
          readOnly && 'bg-muted/20',
        )}
        data-placeholder={placeholder}
        data-testid={`${dataTestId}-surface`}
        onInput={readOnly ? undefined : emitChange}
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
  if (!value.trim()) {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>No content authored yet.</p>;
  }
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground', className)}
      data-testid="rich-text-readonly-view"
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
