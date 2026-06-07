import {
  hasSubstantiveEditorContent,
  normalizeEditorOutput,
} from './richTextContent';

export { hasSubstantiveEditorContent };

/** Normalized comparison baseline for editor dirty-state. */
export function normalizeEditorSessionContent(content: string): string {
  return normalizeEditorOutput(content);
}

export function isEditorSessionDirty(initialContent: string, currentContent: string): boolean {
  return (
    normalizeEditorSessionContent(initialContent) !== normalizeEditorSessionContent(currentContent)
  );
}

export interface EditorSessionSnapshot {
  initialContent: string;
  currentContent: string;
  isDirty: boolean;
  hasSubstantiveContent: boolean;
  initialHasSubstantiveContent: boolean;
}

export function buildEditorSessionSnapshot(
  initialContent: string,
  currentContent: string,
): EditorSessionSnapshot {
  return {
    initialContent: normalizeEditorSessionContent(initialContent),
    currentContent: normalizeEditorSessionContent(currentContent),
    isDirty: isEditorSessionDirty(initialContent, currentContent),
    hasSubstantiveContent: hasSubstantiveEditorContent(currentContent),
    initialHasSubstantiveContent: hasSubstantiveEditorContent(initialContent),
  };
}
