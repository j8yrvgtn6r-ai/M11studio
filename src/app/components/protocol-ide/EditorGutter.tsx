import type { EditorGutterIndicator } from '../../domain/protocol/authoring/editorIntegration';
import { cn } from '../ui/utils';

interface EditorGutterProps {
  lineCount: number;
  indicators?: EditorGutterIndicator[];
  showLineNumbers?: boolean;
  className?: string;
  onIndicatorClick?: (indicator: EditorGutterIndicator) => void;
}

const severityMarkerClass: Record<EditorGutterIndicator['severity'], string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export function EditorGutter({
  lineCount,
  indicators = [],
  showLineNumbers = true,
  className,
  onIndicatorClick,
}: EditorGutterProps) {
  const rows = Math.max(lineCount, 1);
  const indicatorByLine = new Map<number, EditorGutterIndicator>();
  for (const indicator of indicators) {
    const existing = indicatorByLine.get(indicator.lineNumber);
    if (!existing || rank(indicator.severity) > rank(existing.severity)) {
      indicatorByLine.set(indicator.lineNumber, indicator);
    }
  }

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
              <span className="w-5 text-right tabular-nums">{lineNumber}</span>
            ) : (
              <span className="w-5" />
            )}
            {indicator ? (
              <button
                type="button"
                className="inline-flex items-center"
                data-testid={`editor-gutter-indicator-${indicator.kind}`}
                onClick={() => onIndicatorClick?.(indicator)}
                title={indicator.message}
              >
                <span className={cn('h-2 w-2 rounded-full', severityMarkerClass[indicator.severity])} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function rank(severity: EditorGutterIndicator['severity']): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    default:
      return 1;
  }
}

export function countEditorLines(content: string): number {
  const text = content.trim();
  if (!text) {
    return 1;
  }
  return text.split('\n').length;
}
