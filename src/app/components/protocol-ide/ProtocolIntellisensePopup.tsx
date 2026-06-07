import {
  BookOpen,
  BrainCircuit,
  FileText,
  GitBranch,
  Layers,
  Sparkles,
  Stethoscope,
  Target,
} from 'lucide-react';
import type { ProtocolIntellisenseKind, ProtocolIntellisenseSuggestion } from '../../domain/protocol/authoring/intellisense';
import { cn } from '../ui/utils';

const KIND_LABEL: Record<ProtocolIntellisenseKind, string> = {
  terminology: 'Terminology',
  synonym: 'Synonym',
  knowledgeEntity: 'Entity',
  objective: 'Objective',
  endpoint: 'Endpoint',
  estimand: 'Estimand',
  population: 'Population',
  intervention: 'Intervention',
  arm: 'Arm',
  assessment: 'Assessment',
  visit: 'Visit',
  soa: 'SoA',
  phrase: 'Phrase',
  ghostText: 'Ghost',
};

function KindIcon({ kind }: { kind: ProtocolIntellisenseKind }) {
  switch (kind) {
    case 'terminology':
    case 'synonym':
      return <BookOpen className="h-3.5 w-3.5" />;
    case 'knowledgeEntity':
    case 'objective':
    case 'endpoint':
    case 'estimand':
      return <Target className="h-3.5 w-3.5" />;
    case 'assessment':
    case 'visit':
    case 'soa':
      return <Stethoscope className="h-3.5 w-3.5" />;
    case 'population':
    case 'arm':
    case 'intervention':
      return <Layers className="h-3.5 w-3.5" />;
    case 'phrase':
      return <FileText className="h-3.5 w-3.5" />;
    default:
      return <Sparkles className="h-3.5 w-3.5" />;
  }
}

export interface ProtocolIntellisensePopupProps {
  suggestions: ProtocolIntellisenseSuggestion[];
  selectedIndex: number;
  anchor: { top: number; left: number };
  onSelect: (suggestion: ProtocolIntellisenseSuggestion) => void;
  onHover: (index: number) => void;
}

export function ProtocolIntellisensePopup({
  suggestions,
  selectedIndex,
  anchor,
  onSelect,
  onHover,
}: ProtocolIntellisensePopupProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute z-30 min-w-[280px] max-w-[360px] overflow-hidden rounded-md border border-border bg-popover shadow-lg"
      style={{ top: anchor.top, left: anchor.left }}
      data-testid="protocol-intellisense-popup"
      role="listbox"
    >
      <div className="border-b border-border px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Protocol IntelliSense
      </div>
      <div className="max-h-64 overflow-auto py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              'flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/70',
              index === selectedIndex && 'bg-muted',
            )}
            data-testid={`intellisense-item-${suggestion.kind}-${index}`}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(suggestion);
            }}
          >
            <span className="mt-0.5 text-muted-foreground">
              <KindIcon kind={suggestion.kind} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{suggestion.label}</span>
                <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {KIND_LABEL[suggestion.kind]}
                </span>
              </span>
              {suggestion.detail ? (
                <span className="block text-muted-foreground">{suggestion.detail}</span>
              ) : null}
              {suggestion.description ? (
                <span className="block text-muted-foreground/90 line-clamp-2">{suggestion.description}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
        ↑↓ navigate · Tab/Enter accept · Esc dismiss
      </div>
    </div>
  );
}

export function ProtocolGhostTextHint({
  ghostText,
  anchor,
}: {
  ghostText: string;
  anchor: { top: number; left: number };
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-md truncate text-xs italic text-muted-foreground/70"
      style={{ top: anchor.top, left: anchor.left }}
      data-testid="protocol-ghost-text-hint"
    >
      {ghostText}
      <span className="ml-2 not-italic text-[10px]">Tab to accept</span>
    </div>
  );
}

export function ProtocolIntellisenseSourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <GitBranch className="h-3 w-3" />
      <BrainCircuit className="h-3 w-3" />
      {source}
    </span>
  );
}
