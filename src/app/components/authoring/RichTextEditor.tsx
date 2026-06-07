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
import {
  applyIntellisenseSuggestion,
  buildProtocolIntellisenseContext,
  getProtocolIntellisenseSuggestions,
  getTokenRangeAtOffset,
  recordIntellisenseAcceptance,
  type ProtocolIntellisenseSuggestion,
} from '../../domain/protocol/authoring/intellisense';
import {
  getRelatedEntitySuggestions,
  listProtocolEntityReferences,
  recordEntityAcceptance,
  resolveProtocolEntityHoverInfo,
  type ProtocolEntityHoverInfo,
  type ProtocolEntityType,
} from '../../domain/protocol/entities';
import {
  resolveTerminologyHoverInfo,
} from '../../domain/protocol/authoring/terminologyEditorIntegration';
import { extractFigureReferenceTokens } from '../../domain/protocol/assets/protocolAssetReference';
import { ProtocolGhostTextHint, ProtocolIntellisensePopup } from '../protocol-ide/ProtocolIntellisensePopup';
import { ProtocolEntityHoverCard } from '../protocol-ide/ProtocolEntityHoverCard';
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
  sectionTitle?: string;
  onTerminologyAccepted?: () => void;
  onIntellisenseAccepted?: () => void;
  explicitIntellisenseQuery?: string | null;
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

function getCaretOffset(node: HTMLDivElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(node);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
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
  sectionTitle,
  onTerminologyAccepted,
  onIntellisenseAccepted,
  explicitIntellisenseQuery = null,
  scrollToOffset = null,
  'data-testid': dataTestId = 'rich-text-editor',
}: RichTextEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const editorRef = surfaceRef ?? internalRef;
  const lastEmitted = useRef(normalizeStoredRichText(value));
  const isFocusedRef = useRef(false);
  const [suggestions, setSuggestions] = useState<ProtocolIntellisenseSuggestion[]>([]);
  const [ghostText, setGhostText] = useState<ProtocolIntellisenseSuggestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [suggestionAnchor, setSuggestionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [ghostAnchor, setGhostAnchor] = useState<{ top: number; left: number } | null>(null);
  const [fallbackRange, setFallbackRange] = useState<{ startOffset: number; endOffset: number } | null>(null);
  const [hoverCard, setHoverCard] = useState<{ top: number; left: number; token: string } | null>(null);
  const [entityHover, setEntityHover] = useState<{
    top: number;
    left: number;
    info: ProtocolEntityHoverInfo;
  } | null>(null);

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

  const dismissIntellisense = useCallback(() => {
    setSuggestions([]);
    setPopupOpen(false);
    setSelectedIndex(0);
    setGhostText(null);
    setGhostAnchor(null);
  }, []);

  const refreshIntellisense = useCallback(
    (trigger: 'typing' | 'explicit' = 'typing', explicitQuery?: string) => {
      const node = editorRef.current;
      if (!node || readOnly || !ideMode || !sectionId) {
        dismissIntellisense();
        return;
      }

      const offset = getCaretOffset(node);
      if (offset == null) {
        return;
      }

      const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
      const context = buildProtocolIntellisenseContext({
        sectionId,
        sectionTitle,
        currentText: plain,
        cursorOffset: offset,
        trigger,
        explicitQuery: explicitQuery ?? explicitIntellisenseQuery ?? undefined,
      });

      const result = getProtocolIntellisenseSuggestions(context);
      const tokenRange = getTokenRangeAtOffset(plain, offset);
      setFallbackRange(tokenRange ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset } : null);

      if (result.suggestions.length === 0) {
        setSuggestions([]);
        setPopupOpen(false);
      } else {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (range) {
          const rect = range.getBoundingClientRect();
          const host = node.getBoundingClientRect();
          setSuggestionAnchor({ top: rect.bottom - host.top + 4, left: rect.left - host.left });
        }
        setSuggestions(result.suggestions);
        setPopupOpen(true);
        setSelectedIndex(0);
      }

      if (result.ghostText && !result.suggestions.length) {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (range) {
          const rect = range.getBoundingClientRect();
          const host = node.getBoundingClientRect();
          setGhostAnchor({ top: rect.bottom - host.top + 2, left: rect.left - host.left + 8 });
        }
        setGhostText(result.ghostText);
      } else {
        setGhostText(null);
        setGhostAnchor(null);
      }
    },
    [dismissIntellisense, explicitIntellisenseQuery, ideMode, readOnly, sectionId, sectionTitle, editorRef],
  );

  useEffect(() => {
    if (explicitIntellisenseQuery && ideMode && sectionId) {
      refreshIntellisense('explicit', explicitIntellisenseQuery);
    }
  }, [explicitIntellisenseQuery, ideMode, refreshIntellisense, sectionId]);

  const acceptSuggestion = useCallback(
    (suggestion: ProtocolIntellisenseSuggestion) => {
      const node = editorRef.current;
      if (!node) {
        return;
      }
      const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
      const originalText = suggestion.replacementRange
        ? plain.slice(suggestion.replacementRange.startOffset, suggestion.replacementRange.endOffset)
        : fallbackRange
          ? plain.slice(fallbackRange.startOffset, fallbackRange.endOffset)
          : '';
      const next = applyIntellisenseSuggestion(plain, suggestion, fallbackRange ?? undefined);
      writeEditorDom(node, next, false);
      lastEmitted.current = next;
      onChange(next);

      const insertOffset =
        suggestion.replacementRange?.startOffset ?? fallbackRange?.startOffset ?? plain.length;
      const insertEnd = insertOffset + suggestion.insertText.length;

      if (sectionId) {
        recordIntellisenseAcceptance({
          sectionId,
          suggestionId: suggestion.id,
          kind: suggestion.kind,
          source: suggestion.source,
          originalText,
          insertedText: suggestion.insertText,
          metadata: suggestion.metadata,
        });
        if (suggestion.kind === 'terminology' || suggestion.kind === 'synonym') {
          onTerminologyAccepted?.();
        }

        if (suggestion.metadata?.entityId && suggestion.metadata?.entityType) {
          recordEntityAcceptance({
            sectionId,
            entityId: suggestion.metadata.entityId,
            entityType: suggestion.metadata.entityType as ProtocolEntityType,
            displayText: suggestion.insertText,
            offset: insertOffset,
            endOffset: insertEnd,
          });

          const relatedContext = buildProtocolIntellisenseContext({
            sectionId,
            sectionTitle,
            currentText: next,
            cursorOffset: insertEnd,
          });
          const related = getRelatedEntitySuggestions(suggestion.metadata.entityId, relatedContext);
          if (related.length > 0) {
            const selection = window.getSelection();
            const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
            if (range) {
              const rect = range.getBoundingClientRect();
              const host = node.getBoundingClientRect();
              setSuggestionAnchor({ top: rect.bottom - host.top + 4, left: rect.left - host.left });
            }
            setSuggestions(related);
            setPopupOpen(true);
            setSelectedIndex(0);
            setGhostText(null);
            setGhostAnchor(null);
            onIntellisenseAccepted?.();
            node.focus();
            return;
          }
        }

        onIntellisenseAccepted?.();
      }

      dismissIntellisense();
      node.focus();
    },
    [dismissIntellisense, editorRef, fallbackRange, onChange, onIntellisenseAccepted, onTerminologyAccepted, sectionId, sectionTitle],
  );

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
    dismissIntellisense();
    setHoverCard(null);
    setEntityHover(null);
  }, [dismissIntellisense, onBlurCommit, onChange, readOnly, editorRef, lineDiagnostics]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
    const node = editorRef.current;
    if (!node || readOnly) {
      return;
    }
    const plain = stripHtmlToPlainText(normalizeEditorOutput(node.innerHTML));
    writeEditorDom(node, plain, false);
  }, [readOnly, editorRef]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        if (popupOpen || ghostText) {
          event.preventDefault();
          dismissIntellisense();
        }
        return;
      }

      if (popupOpen && suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((current) => (current + 1) % suggestions.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          acceptSuggestion(suggestions[selectedIndex] ?? suggestions[0]);
          return;
        }
      }

      if (event.key === 'Tab' && ghostText && !popupOpen) {
        event.preventDefault();
        acceptSuggestion(ghostText);
      }
    },
    [acceptSuggestion, dismissIntellisense, ghostText, popupOpen, selectedIndex, suggestions],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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
      const tokenRange = getTokenRangeAtOffset(plain, offset);
      if (!tokenRange) {
        setHoverCard(null);
        setEntityHover(null);
        return;
      }

      const references = sectionId ? listProtocolEntityReferences(sectionId) : [];
      const entityInfo = resolveProtocolEntityHoverInfo(tokenRange.text, {
        sectionId,
        references,
      });
      const host = node.getBoundingClientRect();
      if (entityInfo) {
        setEntityHover({
          top: event.clientY - host.top + 12,
          left: event.clientX - host.left,
          info: entityInfo,
        });
        setHoverCard(null);
        return;
      }

      setEntityHover(null);
      const hover = resolveTerminologyHoverInfo(tokenRange.text);
      if (!hover) {
        setHoverCard(null);
        return;
      }
      setHoverCard({ top: event.clientY - host.top + 12, left: event.clientX - host.left, token: tokenRange.text });
    },
    [readOnly, editorRef, sectionId],
  );

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
        onInput={
          readOnly
            ? undefined
            : () => {
                emitChange();
                refreshIntellisense('typing');
              }
        }
        onFocus={readOnly ? undefined : handleFocus}
        onBlur={readOnly ? undefined : handleBlur}
        onKeyDown={readOnly ? undefined : handleKeyDown}
        onMouseMove={readOnly ? undefined : handleMouseMove}
      />

      {popupOpen && suggestions.length > 0 && suggestionAnchor ? (
        <ProtocolIntellisensePopup
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          anchor={suggestionAnchor}
          onSelect={acceptSuggestion}
          onHover={setSelectedIndex}
        />
      ) : null}

      {!popupOpen && ghostText && ghostAnchor ? (
        <ProtocolGhostTextHint ghostText={ghostText.insertText.trim()} anchor={ghostAnchor} />
      ) : null}

      {entityHover ? (
        <ProtocolEntityHoverCard hover={entityHover.info} anchor={entityHover} />
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
