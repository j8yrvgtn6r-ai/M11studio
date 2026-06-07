import type { SectionGenerationState } from '../build/protocolBuildConsoleStore';
import type { FieldDefinition } from '../../../types/protocol';
import type { GeneratedSectionDraft } from './types';
import { resolveSectionEditorContent } from './sectionAuthoring';
import { inferWorkflowState } from './sectionWorkflowState';
import { evaluateTitlePageCompletion } from '../authoring/titlePageAuthoring';

export type SectionWorkflowDisplayBadge =
  | 'Imported from DOCX'
  | 'Pending Validation'
  | 'Validation Proposed'
  | 'Generated'
  | 'Validated'
  | 'Reviewed'
  | 'Draft'
  | 'Out of Sync'
  | 'Needs Generation'
  | 'Required Missing'
  | 'Complete';

export function sectionHasAuthorableContent(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft) {
    return false;
  }
  return resolveSectionEditorContent(draft).trim().length > 0;
}

export function shouldShowRequiredMissing(options: {
  draft?: GeneratedSectionDraft;
  generationState?: SectionGenerationState;
  hasValidatedText?: boolean;
}): boolean {
  const { draft, generationState, hasValidatedText } = options;
  if (hasValidatedText || sectionHasAuthorableContent(draft)) {
    return false;
  }
  if (
    generationState &&
    generationState !== 'notGenerated' &&
    generationState !== 'needsGeneration'
  ) {
    return false;
  }
  const workflow = draft ? inferWorkflowState(draft) : null;
  if (
    workflow === 'importedUnvalidated' ||
    workflow === 'imported' ||
    workflow === 'validationProposed' ||
    workflow === 'unvalidated' ||
    workflow === 'validated' ||
    workflow === 'reviewed' ||
    workflow === 'generated'
  ) {
    return false;
  }
  return true;
}

export function resolveSectionWorkflowDisplayBadge(options: {
  draft?: GeneratedSectionDraft;
  generationState?: SectionGenerationState;
}): SectionWorkflowDisplayBadge | null {
  const { draft, generationState } = options;

  if (generationState === 'validated') {
    return 'Validated';
  }
  if (generationState === 'reviewed' || generationState === 'approved') {
    return 'Reviewed';
  }

  if (draft) {
    const workflow = inferWorkflowState(draft);
    if (
      draft.contentOrigin === 'manual' &&
      sectionHasAuthorableContent(draft) &&
      workflow !== 'validated' &&
      workflow !== 'reviewed' &&
      draft.state !== 'approved' &&
      draft.state !== 'validationPassed'
    ) {
      return 'Draft';
    }
    switch (workflow) {
      case 'importedUnvalidated':
      case 'imported':
        return 'Pending Validation';
      case 'validationProposed':
      case 'unvalidated':
        return 'Validation Proposed';
      case 'validated':
        return draft.state === 'approved' ? 'Reviewed' : 'Validated';
      case 'reviewed':
        return 'Reviewed';
      case 'generated':
        return 'Generated';
      case 'outOfSync':
        return 'Out of Sync';
      case 'needsGeneration':
        return 'Needs Generation';
      default:
        break;
    }
    if (draft.contentOrigin === 'imported' && sectionHasAuthorableContent(draft)) {
      return 'Imported from DOCX';
    }
  }

  if (generationState === 'needsGeneration' || generationState === 'notGenerated') {
    if (shouldShowRequiredMissing({ draft, generationState })) {
      return 'Required Missing';
    }
    return 'Needs Generation';
  }

  if (generationState === 'importedUnvalidated' || generationState === 'imported') {
    return 'Pending Validation';
  }
  if (generationState === 'validationProposed' || generationState === 'unvalidated') {
    return 'Validation Proposed';
  }
  if (generationState === 'generated' || generationState === 'needsReview') {
    return 'Generated';
  }
  if (generationState === 'outOfSync') {
    return 'Out of Sync';
  }

  return null;
}

/** Title Page viewport badge: field completion + validation workflow (never autosave). */
export function resolveTitlePageViewportBadge(options: {
  fields: FieldDefinition[];
  importDraft?: GeneratedSectionDraft;
  generationState?: SectionGenerationState;
}): SectionWorkflowDisplayBadge {
  const completion = evaluateTitlePageCompletion(options.fields);

  if (options.importDraft) {
    const workflowBadge = resolveSectionWorkflowDisplayBadge({
      draft: options.importDraft,
      generationState: options.generationState,
    });
    if (workflowBadge === 'Validated' || workflowBadge === 'Reviewed' || workflowBadge === 'Validation Proposed') {
      return workflowBadge;
    }
    if (workflowBadge === 'Pending Validation' && completion.allRequiredComplete) {
      return 'Pending Validation';
    }
  }

  if (!completion.allRequiredComplete) {
    return completion.displayBadge;
  }

  if (
    options.importDraft &&
    (options.importDraft.workflowState === 'validated' ||
      options.importDraft.state === 'validationPassed' ||
      options.importDraft.state === 'approved')
  ) {
    return options.importDraft.state === 'approved' ? 'Reviewed' : 'Validated';
  }

  return 'Pending Validation';
}

export function sectionWorkflowDisplayBadgeClass(badge: SectionWorkflowDisplayBadge): string {
  switch (badge) {
    case 'Imported from DOCX':
      return 'text-cyan-700 dark:text-cyan-300 border-cyan-500/40';
    case 'Pending Validation':
      return 'text-cyan-700 dark:text-cyan-300 border-cyan-500/40';
    case 'Validation Proposed':
      return 'text-purple-700 dark:text-purple-300 border-purple-500/40';
    case 'Generated':
      return 'text-sky-700 dark:text-sky-300 border-sky-500/40';
    case 'Validated':
      return 'text-green-700 dark:text-green-300 border-green-500/40';
    case 'Reviewed':
      return 'text-green-800 dark:text-green-200 border-green-600/40';
    case 'Out of Sync':
      return 'text-amber-700 dark:text-amber-300 border-amber-500/40';
    case 'Needs Generation':
      return 'text-muted-foreground border-border';
    case 'Draft':
      return 'text-blue-700 dark:text-blue-300 border-blue-500/40';
    case 'Complete':
      return 'text-green-700 dark:text-green-300 border-green-500/40';
    case 'Required Missing':
      return 'text-red-700 dark:text-red-300 border-red-500/40';
    default:
      return 'text-muted-foreground border-border';
  }
}
