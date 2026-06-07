import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { M11SectionGuidance } from '../../domain/m11-template-guidance/m11TemplateGuidanceTypes';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface M11SectionGuidancePanelProps {
  guidance: M11SectionGuidance;
  compact?: boolean;
  defaultExpanded?: boolean;
  onInsertPrompt?: (prompt: string) => void;
  onMarkNotApplicable?: () => void;
  showInsertionPrompts?: boolean;
  showNotApplicableAction?: boolean;
}

export function M11SectionGuidancePanel({
  guidance,
  compact = false,
  defaultExpanded = true,
  onInsertPrompt,
  onMarkNotApplicable,
  showInsertionPrompts = true,
  showNotApplicableAction = true,
}: M11SectionGuidancePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (guidance.excludedFromGuidanceUi) {
    return null;
  }

  if (guidance.headingOnly) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 p-4"
        data-testid="m11-guidance-heading-only"
      >
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Heading only — no text intended here</p>
            {guidance.guidanceText.map((line) => (
              <p key={line} className="text-sm text-muted-foreground mt-1">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border bg-card/60 ${compact ? 'p-3' : 'p-4'}`}
      data-testid="m11-section-guidance-panel"
    >
      {!compact ? (
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left"
          onClick={() => setExpanded((value) => !value)}
          data-testid="m11-guidance-toggle"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-medium">M11 guidance</span>
          {guidance.optionalSection ? (
            <Badge variant="outline" className="ml-auto text-[10px]">
              Optional
            </Badge>
          ) : null}
        </button>
      ) : (
        <p className="text-xs font-medium text-muted-foreground mb-2">M11 guidance</p>
      )}

      {(compact || expanded) && (
        <div className={`space-y-3 ${compact ? '' : 'mt-3'}`}>
          <ul className="space-y-1.5">
            {guidance.guidanceText.map((line) => (
              <li key={line} className="text-sm text-muted-foreground leading-relaxed">
                {line}
              </li>
            ))}
          </ul>

          {guidance.optionalityNotes.map((line) => (
            <p key={line} className="text-xs text-amber-700 dark:text-amber-300">
              {line}
            </p>
          ))}

          {guidance.conditionalityNotes.map((line) => (
            <p key={line} className="text-xs text-sky-700 dark:text-sky-300">
              {line}
            </p>
          ))}

          {guidance.tableGuidance && guidance.tableGuidance.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Table guidance</p>
              <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                {guidance.tableGuidance.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {showInsertionPrompts && guidance.insertionPrompts.length > 0 && onInsertPrompt ? (
            <div className="flex flex-wrap gap-2" data-testid="m11-guidance-insertion-prompts">
              {guidance.insertionPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  data-testid={`m11-guidance-prompt-${prompt.slice(0, 24).replace(/\W+/g, '-')}`}
                  onClick={() => onInsertPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          ) : null}

          {showNotApplicableAction && guidance.allowsNotApplicable && onMarkNotApplicable ? (
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="m11-guidance-mark-not-applicable"
                onClick={onMarkNotApplicable}
              >
                Mark Not Applicable
              </Button>
              {guidance.notApplicableGuidance ? (
                <span className="text-xs text-muted-foreground">{guidance.notApplicableGuidance}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
