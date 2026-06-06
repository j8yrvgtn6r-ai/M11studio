import {
  AlertCircle,
  AlertTriangle,
  Check,
  Circle,
  Loader2,
  MoreHorizontal,
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
      return <MoreHorizontal className={`${className} text-muted-foreground`} />;
    case 'generating':
      return <Loader2 className={`${className} animate-spin text-primary`} />;
    case 'generated':
    case 'approved':
      return <Check className={`${className} ${state === 'approved' ? 'text-green-600' : 'text-sky-500'}`} />;
    case 'needsReview':
      return <span className={`inline-block rounded-full bg-amber-500 ${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} />;
    case 'failed':
      return <AlertCircle className={`${className} text-destructive`} />;
    case 'outOfDate':
      return <AlertTriangle className={`${className} text-amber-600`} />;
    case 'notGenerated':
    default:
      return <Circle className={`${className} text-muted-foreground/50`} />;
  }
}

export function sectionGenerationOverlayClass(state: SectionGenerationState): string {
  switch (state) {
    case 'queued':
      return 'ring-1 ring-muted-foreground/30';
    case 'generating':
      return 'ring-2 ring-primary/60 animate-pulse';
    case 'needsReview':
    case 'generated':
      return 'ring-1 ring-amber-500/50';
    case 'approved':
      return 'ring-1 ring-green-500/50';
    case 'failed':
      return 'ring-2 ring-destructive/60';
    case 'outOfDate':
      return 'ring-1 ring-amber-600/60';
    default:
      return '';
  }
}
