import type { ProtocolSection } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import { resolveSectionEditorContent } from '../import/sectionAuthoring';
import { stripHtmlToPlainText } from '../authoring/richTextContent';
import { flattenProtocolSections } from './protocolSearch';

export type FindReplaceScope = 'section' | 'protocol';

export interface FindReplacePreviewItem {
  sectionId: string;
  sectionTitle: string;
  lineNumber: number;
  before: string;
  after: string;
  snippet: string;
}

export interface FindReplacePreview {
  find: string;
  replace: string;
  scope: FindReplaceScope;
  caseSensitive: boolean;
  wholeWord: boolean;
  items: FindReplacePreviewItem[];
  totalReplacements: number;
}

export interface FindReplaceOptions {
  find: string;
  replace: string;
  scope: FindReplaceScope;
  scopeSectionId?: string | null;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

function buildReplaceRegex(options: FindReplaceOptions): RegExp | null {
  const find = options.find.trim();
  if (!find) {
    return null;
  }
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = options.caseSensitive ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/** Preview replacements without mutating protocol content (v1 scaffold). */
export function previewFindReplace(
  options: FindReplaceOptions,
  sections: ProtocolSection[],
  drafts: Record<string, GeneratedSectionDraft>,
): FindReplacePreview {
  const regex = buildReplaceRegex(options);
  if (!regex) {
    return {
      find: options.find,
      replace: options.replace,
      scope: options.scope,
      caseSensitive: Boolean(options.caseSensitive),
      wholeWord: Boolean(options.wholeWord),
      items: [],
      totalReplacements: 0,
    };
  }

  const flat = flattenProtocolSections(sections);
  const targets =
    options.scope === 'section' && options.scopeSectionId
      ? flat.filter((section) => section.id === options.scopeSectionId)
      : flat;

  const items: FindReplacePreviewItem[] = [];
  let totalReplacements = 0;

  for (const section of targets) {
    const draft = drafts[section.id];
    if (!draft) {
      continue;
    }
    const text = stripHtmlToPlainText(resolveSectionEditorContent(draft));
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      const before = match[0];
      const after = options.replace;
      items.push({
        sectionId: section.id,
        sectionTitle: section.title ?? section.id,
        lineNumber: text.slice(0, match.index).split('\n').length,
        before,
        after,
        snippet: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30),
      });
      totalReplacements += 1;
      if (!regex.global) {
        break;
      }
      match = regex.exec(text);
    }
  }

  return {
    find: options.find,
    replace: options.replace,
    scope: options.scope,
    caseSensitive: Boolean(options.caseSensitive),
    wholeWord: Boolean(options.wholeWord),
    items,
    totalReplacements,
  };
}

/** Apply replacements — disabled in v1; returns preview only. */
export function applyFindReplace(): { applied: false; reason: string } {
  return {
    applied: false,
    reason: 'Bulk replace is preview-only in Protocol IDE v1. Apply manually or wait for v2.',
  };
}
