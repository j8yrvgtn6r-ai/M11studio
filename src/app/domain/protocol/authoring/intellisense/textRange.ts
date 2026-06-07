export interface TextRange {
  text: string;
  startOffset: number;
  endOffset: number;
}

/** Extracts the word/token immediately before the caret in plain text. */
export function getTokenRangeAtOffset(text: string, offset: number): TextRange | null {
  const before = text.slice(0, offset);
  const match = /([A-Za-z0-9][A-Za-z0-9\-_/]*)\s*$/.exec(before);
  if (!match?.[1] || match[1].length < 1) {
    return null;
  }
  const token = match[1];
  return {
    text: token,
    startOffset: offset - token.length,
    endOffset: offset,
  };
}

/** Extracts the longest phrase (up to maxWords) ending at the caret. */
export function getPhraseRangeAtOffset(text: string, offset: number, maxWords = 5): TextRange | null {
  const before = text.slice(0, offset);
  const pattern = new RegExp(
    `((?:[A-Za-z0-9][A-Za-z0-9\\-_/]*)(?:\\s+(?:[A-Za-z0-9][A-Za-z0-9\\-_/]*)){0,${maxWords - 1}})\\s*$`,
  );
  const match = pattern.exec(before);
  if (!match?.[1]?.trim()) {
    return getTokenRangeAtOffset(text, offset);
  }
  const phrase = match[1].trimEnd();
  return {
    text: phrase,
    startOffset: offset - phrase.length,
    endOffset: offset,
  };
}

export function applyRangeReplacement(text: string, range: TextRange, replacement: string): string {
  return `${text.slice(0, range.startOffset)}${replacement}${text.slice(range.endOffset)}`;
}

export function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

export function getLineAtOffset(text: string, offset: number): string {
  const lines = text.split('\n');
  const lineNumber = lineNumberFromOffset(text, offset);
  return lines[lineNumber - 1] ?? '';
}

export function getNearbyText(text: string, offset: number, radius = 80): string {
  const start = Math.max(0, offset - radius);
  const end = Math.min(text.length, offset + radius);
  return text.slice(start, end);
}
