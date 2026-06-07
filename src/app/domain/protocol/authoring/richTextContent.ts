const SEMANTIC_FORMATTING_TAG_PATTERN = /<(b|strong|i|em|u|h[1-6]|ul|ol|li)\b/i;

/** Iteratively decode HTML entities (repairs multi-pass &amp; corruption). */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) {
    return text;
  }

  let decoded = text;
  for (let pass = 0; pass < 6 && decoded.includes('&'); pass += 1) {
    const next = decoded
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
    if (next === decoded) {
      break;
    }
    decoded = next;
  }
  return decoded.replace(/\u00a0/g, ' ');
}

export function stripHtmlToPlainText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function hasRichFormatting(html: string): boolean {
  return SEMANTIC_FORMATTING_TAG_PATTERN.test(html);
}

/** True when stored value has no meaningful content. */
export function isEmptyRichText(value: string): boolean {
  return stripHtmlToPlainText(value).length === 0;
}

/**
 * Canonical storage form for section narrative content.
 * Plain text when unformatted; minimal HTML when formatting tags are present.
 */
export function normalizeEditorOutput(rawHtml: string): string {
  if (!rawHtml.trim()) {
    return '';
  }

  const decoded = decodeHtmlEntities(rawHtml);
  if (!hasRichFormatting(decoded)) {
    return stripHtmlToPlainText(decoded);
  }
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = decoded;
    return div.innerHTML;
  }
  return decoded;
}

/** Repairs persisted values that may contain escaped entities or nbsp artifacts. */
export function normalizeStoredRichText(value: string | undefined | null): string {
  if (!value?.trim()) {
    return '';
  }
  const decoded = decodeHtmlEntities(value);
  if (!hasRichFormatting(decoded)) {
    return stripHtmlToPlainText(decoded);
  }
  return normalizeEditorOutput(decoded);
}

/** Maps stored value into contentEditable DOM without double-encoding plain text. */
export function storedValueToEditorDom(value: string): string {
  if (!value.trim()) {
    return '';
  }
  const normalized = normalizeStoredRichText(value);
  if (hasRichFormatting(normalized)) {
    return normalized;
  }
  return normalized;
}
