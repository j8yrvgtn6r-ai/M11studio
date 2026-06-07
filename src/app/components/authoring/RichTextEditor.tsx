import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasRichFormatting,
  isEmptyRichText,
  normalizeEditorOutput,
  normalizeStoredRichText,
  stripHtmlToPlainText,
  storedValueToEditorDom,
} from '../../domain/protocol/authoring/richTextContent';
import type { LineDiagnostic } from '../../domain/protocol/authoring/editorIntegration';
import {
  diagnosticHighlightsFromLineDiagnostics,
  scrollToDiagnosticOffset,
  stripDiagnosticHighlights,
  wrapPlainTextWithHighlights,
} from '../../domain/protocol/authoring/diagnosticHighlights';
import { getTerminologySuggestions, type TerminologySuggestion } from '../../domain/protocol/authoring/editorIntegration';
import {
  applyTokenReplacement,
  getTokenAtOffset,
  recordTerminologyAcceptance,
  resolveTerminologyHoverInfo,
  suggestionToAcceptance,
} from '../../domain/protocol/authoring/terminologyEditorIntegration';
import { extractFigureReferenceTokens } from '../../domain/protocol/assets/protocolAssetReference';
import { FigureReferenceCard } from '../protocol-ide/FigureReferenceCard';
import { cn } from '../ui/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  editorKey?: string;
  onBlurCommit?: (value: string) => void;
  ideMode?: boolean;
  hideToolbar?: boolean;
  highlightQuery?: string;
  surfaceRef?: React.RefObject<HTMLDivElement | null>;
  lineDiagnostics?: LineDiagnostic[];
  sectionId?: string;
  onTerminologyAccepted?: () => void;
  scrollToOffset?: number | null;
  'data-testid'?: string;
}

function editorDomMatches(node: HTMLDivElement, value: string): boolean {
  const normalized = normalizeStoredRichText(value);
  if (!normalized.trim()) {
    return isEmptyRichText(node.innerHTML) && !(node.textContent ?? '').trim();
  }
  if (hasRichFormatting(normalized)) {
    return normalizeEditorOutput(node.innerHTML) === normalized;
  }
  return (node.textContent ?? '').replace(/\u00a0/g, ' ') === normalized.replace(/\u00a0/g, ' ');
}

function writeEditorDom(node: HTMLDivElement, value: string, withHighlights = false, diagnostics: LineDiagnostic[] = []): void {
  const domValue = storedValueToEditorDom(value);
  if (!domValue.trim()) {
    node.textContent = '';
    return;
  }
  if (withHighlights && diagnostics.length > 0 && !hasRichFormatting(domValue)) {
    const plain = stripHtmlToPlainText(domValue);
    const highlights = diagnosticHighlightsFromLineDiagnostics(plain, diagnostics);
    node.innerHTML = wrapPlainTextWithHighlights(plain, highlights);
    return;
  }
  if (hasRichFormatting(domValue)) {
    node.innerHTML = domValue;
    return;
  }
  node.textContent = domValue;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  editorKey,
  onBlurCommit,
  ideMode = false,
  highlightQuery,
  surfaceRef,
  lineDiagnostics = [],
  sectionId,
  onTerminologyAccepted,
  scrollToOffset = null,
  'data-testid': dataTestId = 'rich-text-editor',
}: RichTextEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const editorRef = surfaceRef ?? internalRef;
  const lastEmitted = useRef(normalizeStoredRichText(value));
  const isFocusedRef = useRef(false);
  const [suggestions, setSuggestions] = useState<TerminologySuggestion[]>([]);
  const [suggestionAnchor, setSuggestionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [activeToken, setActiveToken] = useState<{ token: string; startOffset: number; endOffset: number } | null>(null);
  const [hoverCard, setHoverCard] = useState<{ top: number; left: number; token: string } | null>(null);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) {
      lastEmitted.current = normalizeStoredRichText(value);
      return;
    }
    const normalized = normalizeStoredRichText(value);
    if (isFocusedRef.current) {
      lastEmitted.current = normalized;
      return;
    }
    if (editorDomMatches(node, normalized)) {
      lastEmitted.current = normalized;
      return;
    }
    writeEditorDom(node, normalized, true, lineDiagnostics);
    lastEmitted.current = normalized;
  }, [value, editorKey, editorRef, lineDiagnostics]);

  useEffect(() => {
    if (scrollToOffset == null || !editorRef.current) {
      return;
    }
    const plain = stripHtmlToPlainText(lastEmitted.current);
    scrollToDiagnosticOffset(editorRef.current, scrollToOffset, plain);
  }, [scrollToOffset, editorRef]);

  const emitChange = useCallback(() => {
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const cleaned = stripDiagnosticHighlights(node.innerHTML);
    if (cleaned !== node.innerHTML) {
      node.innerHTML = cleaned;
    }
    const normalized = normalizeEditorOutput(node.innerHTML);
    if (normalized !== lastEmitted.current) {
      lastEmitted.current = normalized;
      onChange(normalized);
    }
  }, [onChange, readOnly, editorRef]);

  const updateSuggestions = useCallback(() => {
    const node = editorRef.current;
    if (!node || readOnly) {
      setSuggestions([]);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
    const preRange = range.cloneRange();
    preRange.selectNodeContents(node);
    preRange.setEnd(range.startContainer, range.startOffset);
    const offset = preRange.toString().length;
    const tokenRange = getTokenAtOffset(plain, offset);
    if (!tokenRange || tokenRange.token.length < 2) {
      setSuggestions([]);
      setActiveToken(null);
      return;
    }
    const nextSuggestions = getTerminologySuggestions(tokenRange.token);
    if (nextSuggestions.length === 0) {
      setSuggestions([]);
      setActiveToken(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const host = node.getBoundingClientRect();
    setSuggestionAnchor({ top: rect.bottom - host.top + 4, left: rect.left - host.left });
    setActiveToken(tokenRange);
    setSuggestions(nextSuggestions);
  }, [readOnly, editorRef]);

  const acceptSuggestion = useCallback((suggestion: TerminologySuggestion) => {
    const node = editorRef.current;
    if (!node || !activeToken) {
      return;
    }
    const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
    const next = applyTokenReplacement(plain, activeToken, suggestion.preferredTerm);
    writeEditorDom(node, next, false);
    lastEmitted.current = next;
    onChange(next);
    if (sectionId) {
      recordTerminologyAcceptance(sectionId, suggestionToAcceptance(suggestion, activeToken.token));
      onTerminologyAccepted?.();
    }
    setSuggestions([]);
    setActiveToken(null);
    node.focus();
  }, [activeToken, editorRef, onChange, onTerminologyAccepted, sectionId]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const cleaned = stripDiagnosticHighlights(node.innerHTML);
    if (cleaned !== node.innerHTML) {
      node.innerHTML = cleaned;
    }
    const normalized = normalizeEditorOutput(node.innerHTML);
    lastEmitted.current = normalized;
    onChange(normalized);
    onBlurCommit?.(normalized);
    writeEditorDom(node, normalized, true, lineDiagnostics);
    setSuggestions([]);
    setHoverCard(null);
  }, [onBlurCommit, onChange, readOnly, editorRef, lineDiagnostics]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
    writeEditorDom(node, plain, false);
  }, [readOnly, editorRef]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab' && suggestions.length > 0) {
      event.preventDefault();
      acceptSuggestion(suggestions[0]);
    }
  }, [acceptSuggestion, suggestions]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!range) {
      return;
    }
    const preRange = range.cloneRange();
    preRange.selectNodeContents(node);
    preRange.setEnd(range.startContainer, range.startOffset);
    const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
    const offset = preRange.toString().length;
    const tokenRange = getTokenAtOffset(plain, offset);
    if (!tokenRange) {
      setHoverCard(null);
      return;
    }
    const hover = resolveTerminologyHoverInfo(tokenRange.token);
    if (!hover) {
      setHoverCard(null);
      return;
    }
    const host = node.getBoundingClientRect();
    setHoverCard({ top: event.clientY - host.top + 12, left: event.clientX - host.left, token: tokenRange.token });
  }, [readOnly, editorRef]);

  return (
    <div className={cn('relative space-y-2', className)} data-testid={dataTestId}>
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={cn(
          'min-h-[240px] px-3 py-2 text-sm leading-6 text-foreground caret-foreground',
          ideMode
            ? 'bg-transparent font-mono focus:outline-none [&_.protocol-diagnostic-error]:underline [&_.protocol-diagnostic-error]:decoration-red-500 [&_.protocol-diagnostic-error]:decoration-wavy [&_.protocol-diagnostic-warning]:underline [&_.protocol-diagnostic-warning]:decoration-amber-500 [&_.protocol-diagnostic-warning]:decoration-wavy [&_.protocol-diagnostic-info]:underline [&_.protocol-diagnostic-info]:decoration-sky-500/70 [&_.protocol-diagnostic-info]:decoration-dotted'
            : 'rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input/30',
          readOnly && !ideMode && 'bg-muted/20',
          highlightQuery && 'ring-1 ring-amber-500/40',
        )}
        data-placeholder={placeholder}
        data-testid={`${dataTestId}-surface`}
        data-highlight-query={highlightQuery || undefined}
        onInput={readOnly ? undefined : () => { emitChange(); updateSuggestions(); }}
        onFocus={readOnly ? undefined : handleFocus}
        onBlur={readOnly ? undefined : handleBlur}
        onKeyDown={readOnly ? undefined : handleKeyDown}
        onMouseMove={readOnly ? undefined : handleMouseMove}
      />

      {suggestions.length > 0 && suggestionAnchor ? (
        <div
          className="absolute z-20 min-w-[240px] rounded-md border border-border bg-popover p-2 shadow-md"
          style={{ top: suggestionAnchor.top, left: suggestionAnchor.left }}
          data-testid="terminology-intellisense-popup"
        >
          {suggestions.slice(0, 5).map((suggestion) => (
            <button
              key={`${suggestion.preferredTerm}-${suggestion.codelistName}`}
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              onMouseDown={(event) => {
                event.preventDefault();
                acceptSuggestion(suggestion);
              }}
            >
              <p className="font-medium">{suggestion.preferredTerm}</p>
              <p className="text-muted-foreground">{suggestion.codelistName}{suggestion.termCode ? ` · ${suggestion.termCode}` : ''}</p>
              <p className="text-muted-foreground mt-0.5">Press Tab to accept</p>
            </button>
          ))}
        </div>
      ) : null}

      {hoverCard ? (
        <div
          className="absolute z-20 max-w-xs rounded-md border border-border bg-popover p-2 text-xs shadow-md pointer-events-none"
          style={{ top: hoverCard.top, left: hoverCard.left }}
          data-testid="terminology-hover-card"
        >
          {(() => {
            const hover = resolveTerminologyHoverInfo(hoverCard.token);
            if (!hover) {
              return null;
            }
            return (
              <>
                <p className="font-medium">{hover.term}</p>
                <p className="text-muted-foreground">Preferred: {hover.preferredTerm}</p>
                {hover.code ? <p className="text-muted-foreground">Code: {hover.code}</p> : null}
                <p className="text-muted-foreground">Codelist: {hover.codelistName}</p>
                <p className="mt-1">{hover.definition}</p>
                {hover.isSynonymMatch && hover.suggestedPreferredTerm ? (
                  <p className="mt-1 text-amber-600 dark:text-amber-400">Suggested M11 term: {hover.suggestedPreferredTerm}</p>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {!readOnly && placeholder ? (
        <style>{`
          [data-testid="${dataTestId}-surface"]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
          }
        `}</style>
      ) : null}
    </div>
  );
}

export function RichTextReadOnlyView({ value, className }: { value: string; className?: string }) {
  const normalized = normalizeStoredRichText(value);
  const figureTokens = extractFigureReferenceTokens(normalized);

  if (!normalized.trim()) {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>No content authored yet.</p>;
  }

  if (figureTokens.length > 0 && !hasRichFormatting(normalized)) {
    const parts = normalized.split(/(\[Figure:[^\]]+\](?:\(asset:[^)]+\))?)/g);
    return (
      <div className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-foreground', className)} data-testid="rich-text-readonly-view">
        {parts.map((part, index) => {
          if (part.startsWith('[Figure:')) {
            return <FigureReferenceCard key={`figure-${index}`} token={part} />;
          }
          return part ? <span key={`text-${index}`}>{part}</span> : null;
        })}
      </div>
    );
  }

  if (hasRichFormatting(normalized)) {
    return (
      <div
        className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-foreground', className)}
        data-testid="rich-text-readonly-view"
        dangerouslySetInnerHTML={{ __html: normalized }}
      />
    );
  }
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-foreground', className)}
      data-testid="rich-text-readonly-view"
    >
      {normalized}
    </div>
  );
}
