import {
  AlertCircle,
  AlertTriangle,
  Check,
  Circle,
  Loader2,
} from 'lucide-react';

import type { SectionGenerationState } from '../domain/protocol/build/protocolBuildConsoleStore';

export function sectionGenerationStateLabel(state: SectionGenerationState): string {
  switch (state) {
    case 'notGenerated':
      return 'Not generated';
    case 'queued':
      return 'Queued';
    case 'generating':
      return 'Generating';
    case 'generated':
      return 'Generated';
    case 'needsReview':
      return 'Needs review';
    case 'approved':
      return 'Approved';
    case 'failed':
      return 'Failed';
    case 'outOfDate':
      return 'Out of date';
    default:
      return state;
  }
}

export function SectionGenerationStateIndicator({
  state,
  compact = false,
}: {
  state: SectionGenerationState;
  compact?: boolean;
}) {
  const className = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  switch (state) {
    case 'queued':
      return <Circle className={`${className} text-muted-foreground/70`} />;
    case 'generating':
      return <Loader2 className={`${className} animate-spin text-primary`} />;
    case 'generated':
      return <Check className={`${className} text-sky-500`} />;
    case 'approved':
      return <Check className={`${className} text-green-600`} />;
    case 'needsReview':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'failed':
      return <AlertCircle className={`${className} text-destructive`} />;
    case 'outOfDate':
      return <AlertTriangle className={`${className} text-purple-500`} />;
    case 'notGenerated':
    default:
      return <Circle className={`${className} text-muted-foreground/30`} />;
  }
}

export function sectionGenerationOverlayClass(state: SectionGenerationState): string {
  switch (state) {
    case 'queued':
      return 'ring-1 ring-muted-foreground/20';
    case 'generating':
      return 'ring-2 ring-primary/60 animate-pulse';
    case 'generated':
      return 'ring-1 ring-sky-500/50';
    case 'needsReview':
      return 'ring-1 ring-amber-500/50';
    case 'approved':
      return 'ring-1 ring-green-500/50';
    case 'failed':
      return 'ring-2 ring-destructive/60';
    case 'outOfDate':
      return 'ring-1 ring-purple-500/60';
    default:
      return '';
  }
}

export function sectionGenerationDotClass(state: SectionGenerationState): string {
  switch (state) {
    case 'queued':
      return 'bg-muted-foreground/30';
    case 'generating':
      return 'bg-primary/40';
    case 'generated':
      return 'bg-sky-500';
    case 'needsReview':
      return 'bg-amber-500';
    case 'approved':
      return 'bg-green-500';
    case 'failed':
      return 'bg-destructive';
    case 'outOfDate':
      return 'bg-purple-500';
    default:
      return 'bg-muted';
  }
}
