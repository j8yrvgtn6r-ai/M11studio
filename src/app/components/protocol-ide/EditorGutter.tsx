import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { EditorGutterIndicator } from '../../domain/protocol/authoring/editorIntegration';
import { cn } from '../ui/utils';

interface EditorGutterProps {
  lineCount: number;
  indicators?: EditorGutterIndicator[];
  showLineNumbers?: boolean;
  className?: string;
}

export function EditorGutter({
  lineCount,
  indicators = [],
  showLineNumbers = false,
  className,
}: EditorGutterProps) {
  const rows = Math.max(lineCount, 1);
  const indicatorByLine = new Map(indicators.map((entry) => [entry.lineNumber, entry]));

  return (
    <div
      className={cn(
        'shrink-0 select-none border-r border-border bg-muted/20 font-mono text-[10px] text-muted-foreground',
        className,
      )}
      data-testid="editor-gutter"
    >
      {Array.from({ length: rows }, (_, index) => {
        const lineNumber = index + 1;
        const indicator = indicatorByLine.get(lineNumber);
        return (
          <div
            key={lineNumber}
            className="flex h-6 items-center gap-1 px-2"
            title={indicator?.message}
            data-testid={`editor-gutter-line-${lineNumber}`}
          >
            {showLineNumbers ? (
              <span className="w-4 text-right tabular-nums">{lineNumber}</span>
            ) : (
              <span className="w-4" />
            )}
            {indicator ? (
              <span data-testid={`editor-gutter-indicator-${indicator.kind}`}>
                {indicator.severity === 'error' ? (
                  <AlertCircle className="h-3 w-3 text-red-500" />
                ) : indicator.severity === 'warning' ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                ) : (
                  <Info className="h-3 w-3 text-sky-500" />
                )}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function countEditorLines(content: string): number {
  const text = content.trim();
  if (!text) {
    return 1;
  }
  return text.split('\n').length;
}
