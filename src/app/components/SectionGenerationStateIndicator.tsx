import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';

import type { SectionGenerationState } from '../domain/protocol/build/protocolBuildConsoleStore';
import type { GeneratedSectionDraft } from '../domain/protocol/import/types';

export interface MapSectionTilePresentation {
  label: string;
  colorClass: string;
  overlayClass: string;
  dotClass: string;
  nextAction: string;
  sourceLabel: string;
}

export function sectionGenerationStateLabel(state: SectionGenerationState): string {
  return getMapSectionTilePresentation(state).label;
}

export function getMapSectionTilePresentation(
  state: SectionGenerationState,
  draft?: GeneratedSectionDraft,
): MapSectionTilePresentation {
  switch (state) {
    case 'imported':
    case 'importedUnvalidated':
      return {
        label: 'Imported from DOCX',
        colorClass: 'text-cyan-600 dark:text-cyan-400',
        overlayClass: 'ring-1 ring-cyan-500/50',
        dotClass: 'bg-cyan-500/85',
        nextAction: 'Run validation review',
        sourceLabel: 'Imported from DOCX',
      };
    case 'validationProposed':
    case 'unvalidated':
      return {
        label: 'Validation Proposed',
        colorClass: 'text-purple-600 dark:text-purple-400',
        overlayClass: 'ring-1 ring-purple-500/50',
        dotClass: 'bg-purple-500/85',
        nextAction: 'Accept or reject validation proposal',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'validated':
      return {
        label: 'Validated',
        colorClass: 'text-green-600 dark:text-green-400',
        overlayClass: 'ring-1 ring-green-500/50',
        dotClass: 'bg-green-500',
        nextAction: 'Review and approve section',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'reviewed':
    case 'approved':
      return {
        label: 'Reviewed',
        colorClass: 'text-green-700 dark:text-green-300',
        overlayClass: 'ring-1 ring-green-600/50',
        dotClass: 'bg-green-700',
        nextAction: 'Section review complete',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'generated':
    case 'needsReview':
      return {
        label: 'Generated',
        colorClass: 'text-sky-600 dark:text-sky-400',
        overlayClass: 'ring-1 ring-sky-500/50',
        dotClass: 'bg-sky-500',
        nextAction: 'Validate or approve generated draft',
        sourceLabel: 'Generated',
      };
    case 'outOfSync':
      return {
        label: 'Out of Sync',
        colorClass: 'text-amber-600 dark:text-amber-400',
        overlayClass: 'ring-1 ring-amber-500/60',
        dotClass: 'bg-amber-500',
        nextAction: 'Resolve consistency impacts',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'needsGeneration':
    case 'notGenerated':
      return {
        label: 'Needs Generation',
        colorClass: 'text-muted-foreground',
        overlayClass: 'ring-1 ring-muted-foreground/20',
        dotClass: 'bg-muted-foreground/25',
        nextAction: 'Generate section when import context is ready',
        sourceLabel: 'Not yet authored',
      };
    case 'generating':
    case 'validationRunning':
      return {
        label: state === 'validationRunning' ? 'Validating' : 'Generating',
        colorClass: 'text-primary',
        overlayClass: 'ring-2 ring-primary/60 animate-pulse',
        dotClass: 'bg-primary/40 animate-pulse',
        nextAction: 'Wait for agent completion',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'failed':
      return {
        label: 'Failed',
        colorClass: 'text-destructive',
        overlayClass: 'ring-2 ring-destructive/60',
        dotClass: 'bg-destructive',
        nextAction: 'Retry failed section',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    case 'queued':
    case 'backgroundQueued':
      return {
        label: 'Queued',
        colorClass: 'text-muted-foreground',
        overlayClass: 'ring-1 ring-muted-foreground/20 animate-pulse',
        dotClass: 'bg-muted-foreground/30',
        nextAction: 'Waiting in generation queue',
        sourceLabel: 'Pending generation',
      };
    case 'outOfDate':
      return {
        label: 'Out of Date',
        colorClass: 'text-purple-600 dark:text-purple-400',
        overlayClass: 'ring-1 ring-purple-500/60',
        dotClass: 'bg-purple-500',
        nextAction: 'Regenerate section',
        sourceLabel: draft?.contentOrigin === 'generated' ? 'Generated' : 'Imported from DOCX',
      };
    default:
      return {
        label: state,
        colorClass: 'text-muted-foreground',
        overlayClass: '',
        dotClass: 'bg-muted',
        nextAction: 'Inspect section state',
        sourceLabel: 'Unknown',
      };
  }
}

export function SectionGenerationStateIndicator({
  state,
  compact = false,
  animate = false,
  draft,
}: {
  state: SectionGenerationState;
  compact?: boolean;
  animate?: boolean;
  draft?: GeneratedSectionDraft;
}) {
  const className = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const presentation = getMapSectionTilePresentation(state, draft);
  const pulseClass =
    animate && (state === 'queued' || state === 'backgroundQueued' || state === 'importedUnvalidated')
      ? ' animate-pulse'
      : '';
  void presentation;

  switch (state) {
    case 'queued':
    case 'backgroundQueued':
      return <Circle className={`${className} text-muted-foreground/70${pulseClass}`} />;
    case 'generating':
    case 'validationRunning':
      return <Loader2 className={`${className} animate-spin text-primary`} />;
    case 'imported':
    case 'importedUnvalidated':
      return <FileText className={`${className} text-cyan-600 dark:text-cyan-400${pulseClass}`} />;
    case 'validationProposed':
    case 'unvalidated':
      return <ClipboardCheck className={`${className} text-purple-600 dark:text-purple-400`} />;
    case 'validated':
      return <Check className={`${className} text-green-600`} />;
    case 'reviewed':
    case 'approved':
      return <CheckCircle2 className={`${className} text-green-700 dark:text-green-300`} />;
    case 'generated':
    case 'needsReview':
      return <Sparkles className={`${className} text-sky-500`} />;
    case 'outOfSync':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'needsGeneration':
    case 'notGenerated':
      return <Plus className={`${className} text-muted-foreground/50`} />;
    case 'failed':
      return <AlertCircle className={`${className} text-destructive`} />;
    case 'outOfDate':
      return <AlertTriangle className={`${className} text-purple-500`} />;
    default:
      return <Circle className={`${className} text-muted-foreground/30`} />;
  }
}

export function sectionGenerationOverlayClass(state: SectionGenerationState): string {
  return getMapSectionTilePresentation(state).overlayClass;
}

export function sectionGenerationDotClass(state: SectionGenerationState): string {
  return getMapSectionTilePresentation(state).dotClass;
}

export function formatMapSectionTooltip(options: {
  sectionTitle: string;
  state: SectionGenerationState;
  draft?: GeneratedSectionDraft;
  extraLines?: string[];
}): string {
  const presentation = getMapSectionTilePresentation(options.state, options.draft);
  return [
    options.sectionTitle,
    `Workflow state: ${presentation.label}`,
    `Source: ${presentation.sourceLabel}`,
    `Next action: ${presentation.nextAction}`,
    ...(options.extraLines ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}
