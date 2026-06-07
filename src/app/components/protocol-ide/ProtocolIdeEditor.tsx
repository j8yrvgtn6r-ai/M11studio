import { useCallback, useRef } from 'react';
import type { EditorGutterIndicator, SectionValidationSummary } from '../../domain/protocol/authoring/editorIntegration';
import {
  createProtocolAssetReference,
  formatImageReferenceToken,
} from '../../domain/protocol/assets/protocolAssetReference';
import { normalizeEditorOutput } from '../../domain/protocol/authoring/richTextContent';
import type { AutosaveStatus } from '../StatusBar';
import { RichTextEditor } from '../authoring/RichTextEditor';
import { EditorGutter, countEditorLines } from './EditorGutter';
import { ProtocolIdeToolbar } from './ProtocolIdeToolbar';
import { SectionEditorStatusBar } from './SectionEditorStatusBar';
import { cn } from '../ui/utils';

export interface ProtocolIdeEditorProps {
  value: string;
  onChange: (value: string) => void;
  editorKey?: string;
  placeholder?: string;
  readOnly?: boolean;
  sectionState: string;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  validationSummary: SectionValidationSummary;
  dependencyCount: number;
  gutterIndicators?: EditorGutterIndicator[];
  highlightQuery?: string;
  onValidate?: () => void;
  validateDisabled?: boolean;
  validateRunning?: boolean;
  onFind?: () => void;
  onReplace?: () => void;
  onForceSave?: () => void;
  'data-testid'?: string;
}

export function ProtocolIdeEditor({
  value,
  onChange,
  editorKey,
  placeholder,
  readOnly = false,
  sectionState,
  autosaveStatus,
  lastSaved,
  validationSummary,
  dependencyCount,
  gutterIndicators = [],
  highlightQuery,
  onValidate,
  validateDisabled,
  validateRunning,
  onFind,
  onReplace,
  onForceSave,
  'data-testid': dataTestId = 'protocol-ide-editor',
}: ProtocolIdeEditorProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const runOnSurface = useCallback((fn: (surface: HTMLDivElement) => void) => {
    const surface = surfaceRef.current ?? document.querySelector<HTMLDivElement>(`[data-testid="${dataTestId}-surface"]`);
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

  const handleInsertImageReference = () => {
    const caption = window.prompt('Figure caption', 'Study Design Overview');
    if (!caption?.trim()) {
      return;
    }
    const reference = createProtocolAssetReference({
      type: 'figure',
      name: caption.trim(),
      caption: caption.trim(),
    });
    const token = formatImageReferenceToken(reference);
    runOnSurface((surface) => {
      document.execCommand('insertText', false, token);
      void surface;
    });
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

      <div className="flex min-h-[240px]">
        {!readOnly ? (
          <EditorGutter lineCount={lineCount} indicators={gutterIndicators} showLineNumbers={false} />
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
