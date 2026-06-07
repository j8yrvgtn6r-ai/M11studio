import type { ProtocolSection } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import { resolveSectionEditorContent } from '../import/sectionAuthoring';
import { stripHtmlToPlainText } from '../authoring/richTextContent';

export interface ProtocolSearchMatch {
  sectionId: string;
  sectionTitle: string;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  lineNumber: number;
}

export interface ProtocolSearchOptions {
  query: string;
  scopeSectionId?: string | null;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface ProtocolSearchResult {
  query: string;
  scope: 'section' | 'protocol';
  matches: ProtocolSearchMatch[];
  sectionsWithMatches: number;
}

export function flattenProtocolSections(sections: ProtocolSection[]): ProtocolSection[] {
  const flat: ProtocolSection[] = [];
  const walk = (items: ProtocolSection[]) => {
    for (const section of items) {
      if (section?.id) {
        flat.push(section);
      }
      if (section.children?.length) {
        walk(section.children.filter((child): child is ProtocolSection => Boolean(child?.id)));
      }
    }
  };
  walk(sections);
  return flat;
}

function sectionSearchText(
  section: ProtocolSection,
  drafts: Record<string, GeneratedSectionDraft>,
  fields: { id: string; sectionId: string; label: string; value?: unknown }[],
): string {
  const parts: string[] = [section.title ?? '', section.id];
  const draft = drafts[section.id];
  if (draft) {
    parts.push(stripHtmlToPlainText(resolveSectionEditorContent(draft)));
  }
  for (const field of fields.filter((entry) => entry.sectionId === section.id)) {
    parts.push(field.label, String(field.value ?? ''));
  }
  return parts.join('\n');
}

function buildRegex(options: ProtocolSearchOptions): RegExp | null {
  const query = options.query.trim();
  if (!query) {
    return null;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = options.caseSensitive ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function snippetAround(text: string, start: number, end: number): string {
  const pad = 40;
  const sliceStart = Math.max(0, start - pad);
  const sliceEnd = Math.min(text.length, end + pad);
  const prefix = sliceStart > 0 ? '…' : '';
  const suffix = sliceEnd < text.length ? '…' : '';
  return `${prefix}${text.slice(sliceStart, sliceEnd).replace(/\s+/g, ' ').trim()}${suffix}`;
}

/** Search narrative and field content within one section or the full protocol. */
export function searchProtocolContent(
  options: ProtocolSearchOptions,
  sections: ProtocolSection[],
  drafts: Record<string, GeneratedSectionDraft>,
  fields: { id: string; sectionId: string; label: string; value?: unknown }[] = [],
): ProtocolSearchResult {
  const regex = buildRegex(options);
  if (!regex) {
    return {
      query: options.query,
      scope: options.scopeSectionId ? 'section' : 'protocol',
      matches: [],
      sectionsWithMatches: 0,
    };
  }

  const flat = flattenProtocolSections(sections);
  const targets = options.scopeSectionId
    ? flat.filter((section) => section.id === options.scopeSectionId)
    : flat;

  const matches: ProtocolSearchMatch[] = [];
  const sectionIds = new Set<string>();

  for (const section of targets) {
    const text = sectionSearchText(section, drafts, fields);
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      matches.push({
        sectionId: section.id,
        sectionTitle: section.title ?? section.id,
        snippet: snippetAround(text, match.index, match.index + match[0].length),
        matchStart: match.index,
        matchEnd: match.index + match[0].length,
        lineNumber: lineNumberAt(text, match.index),
      });
      sectionIds.add(section.id);
      if (!regex.global) {
        break;
      }
      match = regex.exec(text);
    }
  }

  return {
    query: options.query,
    scope: options.scopeSectionId ? 'section' : 'protocol',
    matches,
    sectionsWithMatches: sectionIds.size,
  };
}
