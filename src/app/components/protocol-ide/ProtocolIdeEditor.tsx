import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorGutterIndicator, LineDiagnostic, SectionValidationSummary } from '../../domain/protocol/authoring/editorIntegration';
import { buildLineDiagnostics } from '../../domain/protocol/authoring/editorIntegration';
import type { DiagnosticScrollTarget } from '../../domain/protocol/authoring/lineDiagnostics';
import { offsetFromLineColumn } from '../../domain/protocol/authoring/lineDiagnostics';
import { normalizeEditorOutput } from '../../domain/protocol/authoring/richTextContent';
import type { AutosaveStatus } from '../StatusBar';
import { RichTextEditor } from '../authoring/RichTextEditor';
import { EditorGutter, countEditorLines } from './EditorGutter';
import { InsertImageReferenceDialog } from './InsertImageReferenceDialog';
import { ProtocolIdeToolbar } from './ProtocolIdeToolbar';
import { SectionEditorStatusBar } from './SectionEditorStatusBar';
import { cn } from '../ui/utils';

export interface ProtocolIdeEditorProps {
  value: string;
  onChange: (value: string) => void;
  editorKey?: string;
  placeholder?: string;
  readOnly?: boolean;
  sectionId?: string;
  sectionState: string;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  validationSummary: SectionValidationSummary;
  dependencyCount: number;
  gutterIndicators?: EditorGutterIndicator[];
  lineDiagnostics?: LineDiagnostic[];
  highlightQuery?: string;
  onValidate?: () => void;
  validateDisabled?: boolean;
  validateRunning?: boolean;
  onFind?: () => void;
  onReplace?: () => void;
  onTerminologyAccepted?: () => void;
  diagnosticScrollTarget?: DiagnosticScrollTarget | null;
  onDiagnosticScrollComplete?: () => void;
  'data-testid'?: string;
}

export function ProtocolIdeEditor({
  value,
  onChange,
  editorKey,
  placeholder,
  readOnly = false,
  sectionId,
  sectionState,
  autosaveStatus,
  lastSaved,
  validationSummary,
  dependencyCount,
  gutterIndicators = [],
  lineDiagnostics: lineDiagnosticsProp,
  highlightQuery,
  onValidate,
  validateDisabled,
  validateRunning,
  onFind,
  onReplace,
  onTerminologyAccepted,
  diagnosticScrollTarget = null,
  onDiagnosticScrollComplete,
  'data-testid': dataTestId = 'protocol-ide-editor',
}: ProtocolIdeEditorProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!diagnosticScrollTarget || diagnosticScrollTarget.sectionId !== sectionId) {
      return;
    }
    const offset =
      typeof diagnosticScrollTarget.startOffset === 'number'
        ? diagnosticScrollTarget.startOffset
        : offsetFromLineColumn(value, diagnosticScrollTarget.lineNumber);
    setScrollToOffset(offset);
    onDiagnosticScrollComplete?.();
  }, [diagnosticScrollTarget, onDiagnosticScrollComplete, sectionId, value]);

  const lineDiagnostics = useMemo(() => {
    if (lineDiagnosticsProp) {
      return lineDiagnosticsProp;
    }
    if (!sectionId) {
      return [];
    }
    return buildLineDiagnostics({ sectionId, content: value });
  }, [lineDiagnosticsProp, sectionId, value]);

  const runOnSurface = useCallback((fn: (surface: HTMLDivElement) => void) => {
    const surface = surfaceRef.current ?? document.querySelector<HTMLDivElement>(`[data-testid="${dataTestId}-inner-surface"]`);
    if (surface) {
      surface.focus();
      fn(surface);
      onChange(normalizeEditorOutput(surface.innerHTML));
    }
  }, [dataTestId, onChange]);

  const handleUndo = () => runOnSurface(() => document.execCommand('undo'));
  const handleRedo = () => runOnSurface(() => document.execCommand('redo'));
  const handleBulletedList = () => runOnSurface(() => document.execCommand('insertUnorderedList'));
  const handleNumberedList = () => runOnSurface(() => document.execCommand('insertOrderedList'));

  const handleInsertTable = () => {
    runOnSurface((surface) => {
      document.execCommand(
        'insertHTML',
        false,
        '<table><tbody><tr><td>Column A</td><td>Column B</td></tr><tr><td></td><td></td></tr></tbody></table>',
      );
      void surface;
    });
  };

  const handleInsertLink = () => {
    const url = window.prompt('Link URL');
    if (!url?.trim()) {
      return;
    }
    runOnSurface(() => document.execCommand('createLink', false, url.trim()));
  };

  const handleInsertImageReference = () => setImageDialogOpen(true);

  const handleGutterClick = (indicator: EditorGutterIndicator) => {
    if (typeof indicator.startOffset === 'number') {
      setScrollToOffset(indicator.startOffset);
    }
  };

  const lineCount = countEditorLines(value);

  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-card')} data-testid={dataTestId}>
      {!readOnly ? (
        <div className="border-b border-border p-1.5">
          <ProtocolIdeToolbar
            onUndo={handleUndo}
            onRedo={handleRedo}
            onBulletedList={handleBulletedList}
            onNumberedList={handleNumberedList}
            onInsertTable={handleInsertTable}
            onInsertLink={handleInsertLink}
            onInsertImageReference={handleInsertImageReference}
            onValidate={onValidate}
            validateDisabled={validateDisabled}
            validateRunning={validateRunning}
            onFind={onFind}
            onReplace={onReplace}
          />
        </div>
      ) : null}

      <InsertImageReferenceDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={(token) => {
          runOnSurface((surface) => {
            document.execCommand('insertText', false, token);
            void surface;
          });
        }}
      />

      <div className="flex min-h-[240px]">
        {!readOnly ? (
          <EditorGutter
            lineCount={lineCount}
            indicators={gutterIndicators}
            showLineNumbers
            onIndicatorClick={handleGutterClick}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <RichTextEditor
            value={value}
            onChange={onChange}
            editorKey={editorKey}
            placeholder={placeholder}
            readOnly={readOnly}
            ideMode
            highlightQuery={highlightQuery}
            hideToolbar
            surfaceRef={surfaceRef}
            lineDiagnostics={lineDiagnostics}
            sectionId={sectionId}
            onTerminologyAccepted={onTerminologyAccepted}
            scrollToOffset={scrollToOffset}
            data-testid={`${dataTestId}-inner`}
          />
        </div>
      </div>

      {!readOnly ? (
        <SectionEditorStatusBar
          sectionState={sectionState}
          autosaveStatus={autosaveStatus}
          lastSaved={lastSaved}
          validationSummary={validationSummary}
          dependencyCount={dependencyCount}
        />
      ) : null}
    </div>
  );
}
