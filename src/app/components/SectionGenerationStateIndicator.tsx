import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
} from 'lucide-react';

import type { SectionGenerationState } from '../domain/protocol/build/protocolBuildConsoleStore';

export function sectionGenerationStateLabel(state: SectionGenerationState): string {
  switch (state) {
    case 'notGenerated':
      return 'Not generated';
    case 'needsGeneration':
      return 'Needs generation';
    case 'queued':
      return 'Queued';
    case 'backgroundQueued':
      return 'Background queued';
    case 'generating':
      return 'Generating';
    case 'generated':
      return 'Generated';
    case 'imported':
    case 'importedUnvalidated':
      return 'Imported (unvalidated)';
    case 'validationRunning':
      return 'Validation running';
    case 'validationProposed':
      return 'Validation proposed';
    case 'unvalidated':
      return 'Unvalidated (review)';
    case 'validated':
      return 'Validated';
    case 'reviewed':
      return 'Reviewed';
    case 'outOfSync':
      return 'Out of sync';
    case 'needsReview':
      return 'Needs review';
    case 'approved':
      return 'Approved';
    case 'failed':
      return 'Validation error';
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
    case 'backgroundQueued':
      return <Circle className={`${className} text-indigo-500/80`} />;
    case 'generating':
      return <Loader2 className={`${className} animate-spin text-primary`} />;
    case 'imported':
    case 'importedUnvalidated':
      return <Circle className={`${className} text-cyan-600 dark:text-cyan-400`} />;
    case 'validationRunning':
      return <Loader2 className={`${className} animate-spin text-primary`} />;
    case 'validationProposed':
      return <Circle className={`${className} text-slate-500`} />;
    case 'unvalidated':
      return <AlertTriangle className={`${className} text-slate-500`} />;
    case 'validated':
      return <Check className={`${className} text-green-600`} />;
    case 'reviewed':
      return <CheckCircle2 className={`${className} text-green-600`} />;
    case 'generated':
      return <Sparkles className={`${className} text-sky-500`} />;
    case 'approved':
      return <Check className={`${className} text-green-600`} />;
    case 'needsReview':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'outOfSync':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'needsGeneration':
      return <Circle className={`${className} text-muted-foreground/40`} />;
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
    case 'backgroundQueued':
      return 'ring-1 ring-indigo-400/40';
    case 'generating':
      return 'ring-2 ring-primary/60 animate-pulse';
    case 'imported':
    case 'importedUnvalidated':
      return 'ring-1 ring-cyan-500/50';
    case 'validationRunning':
      return 'ring-2 ring-primary/60 animate-pulse';
    case 'validationProposed':
    case 'unvalidated':
      return 'ring-1 ring-slate-400/50';
    case 'validated':
    case 'reviewed':
    case 'approved':
      return 'ring-1 ring-green-500/50';
    case 'generated':
      return 'ring-1 ring-sky-500/50';
    case 'needsReview':
      return 'ring-1 ring-amber-500/50';
    case 'outOfSync':
      return 'ring-1 ring-amber-500/60';
    case 'needsGeneration':
      return 'ring-1 ring-muted-foreground/20';
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
    case 'backgroundQueued':
      return 'bg-indigo-400/70';
    case 'generating':
      return 'bg-primary/40';
    case 'imported':
    case 'importedUnvalidated':
      return 'bg-cyan-500/80';
    case 'unvalidated':
      return 'bg-slate-400';
    case 'validated':
    case 'reviewed':
    case 'approved':
      return 'bg-green-500';
    case 'generated':
      return 'bg-sky-500';
    case 'needsReview':
      return 'bg-amber-500';
    case 'outOfSync':
      return 'bg-amber-500';
    case 'needsGeneration':
      return 'bg-muted-foreground/25';
    case 'failed':
      return 'bg-destructive';
    case 'outOfDate':
      return 'bg-purple-500';
    default:
      return 'bg-muted';
  }
}
