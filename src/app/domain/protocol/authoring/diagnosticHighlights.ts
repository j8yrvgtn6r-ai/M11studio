import type { LineDiagnostic } from './lineDiagnostics';

export type DiagnosticHighlightSeverity = 'info' | 'warning' | 'error';

export interface DiagnosticHighlight {
  diagnosticId: string;
  startOffset: number;
  endOffset: number;
  severity: DiagnosticHighlightSeverity;
  category: LineDiagnostic['category'];
  message: string;
  suggestedFix?: string;
  source: string;
}

export function diagnosticHighlightsFromLineDiagnostics(
  plainText: string,
  diagnostics: LineDiagnostic[],
): DiagnosticHighlight[] {
  return diagnostics
    .filter((entry) => typeof entry.startOffset === 'number' && typeof entry.endOffset === 'number')
    .map((entry) => ({
      diagnosticId: entry.id,
      startOffset: entry.startOffset!,
      endOffset: entry.endOffset!,
      severity: entry.severity,
      category: entry.category,
      message: entry.message,
      suggestedFix: entry.suggestedFix,
      source: entry.source,
    }))
    .filter((entry) => entry.endOffset > entry.startOffset && entry.endOffset <= plainText.length);
}

export function wrapPlainTextWithHighlights(
  plainText: string,
  highlights: DiagnosticHighlight[],
): string {
  if (!highlights.length || !plainText) {
    return plainText;
  }

  const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);
  let html = plainText;
  for (const highlight of sorted) {
    const before = html.slice(0, highlight.startOffset);
    const target = html.slice(highlight.startOffset, highlight.endOffset);
    const after = html.slice(highlight.endOffset);
    html = `${before}<span class="protocol-diagnostic protocol-diagnostic-${highlight.severity} protocol-diagnostic-${highlight.category}" data-diagnostic-id="${highlight.diagnosticId}" title="${escapeAttr(highlight.message)}">${escapeHtml(target)}</span>${after}`;
  }
  return html.replace(/\n/g, '<br>');
}

export function stripDiagnosticHighlights(html: string): string {
  if (!html.includes('protocol-diagnostic')) {
    return html;
  }
  const container = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!container) {
    return html.replace(/<span[^>]*protocol-diagnostic[^>]*>(.*?)<\/span>/gi, '$1');
  }
  container.innerHTML = html;
  container.querySelectorAll('.protocol-diagnostic').forEach((node) => {
    const text = node.textContent ?? '';
    node.replaceWith(text);
  });
  return container.innerHTML;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

export function scrollToDiagnosticOffset(surface: HTMLElement, startOffset: number, plainText: string): void {
  const pre = plainText.slice(0, startOffset);
  const lines = pre.split('\n').length;
  const lineHeight = 24;
  surface.scrollTop = Math.max(0, (lines - 2) * lineHeight);
  surface.focus();
}
