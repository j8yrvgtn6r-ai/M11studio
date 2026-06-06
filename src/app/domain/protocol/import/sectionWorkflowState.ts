import type { SectionGenerationState } from '../build/protocolBuildConsoleStore';

import type { GeneratedSectionDraft, ProtocolSectionWorkflowState } from './types';

export function inferWorkflowState(draft: GeneratedSectionDraft): ProtocolSectionWorkflowState {
  if (draft.workflowState) {
    if (draft.workflowState === 'imported') {
      return 'importedUnvalidated';
    }
    if (draft.workflowState === 'unvalidated') {
      return 'validationProposed';
    }
    return draft.workflowState;
  }

  if (draft.contentOrigin === 'imported') {
    return draft.validatedTargetText ? 'validationProposed' : 'importedUnvalidated';
  }

  if (draft.state === 'validationPassed' || draft.state === 'approved') {
    return 'validated';
  }

  if (draft.contentOrigin === 'generated' || draft.provenance.generationModel !== 'structural-mapping-v1') {
    return 'generated';
  }

  return 'importedUnvalidated';
}

export function resolveWorkflowGenerationState(
  draft: GeneratedSectionDraft | undefined,
): SectionGenerationState {
  if (!draft) {
    return 'notGenerated';
  }

  if (draft.generationStatus === 'failed') {
    return 'failed';
  }

  const workflow = inferWorkflowState(draft);

  switch (workflow) {
    case 'importedUnvalidated':
    case 'imported':
      return 'importedUnvalidated';
    case 'validationRunning':
      return 'validationRunning';
    case 'validationProposed':
    case 'unvalidated':
      return 'validationProposed';
    case 'validationRejected':
      return 'importedUnvalidated';
    case 'validated':
      return draft.state === 'approved' || draft.state === 'validationPassed' ? 'reviewed' : 'validated';
    case 'generated':
      return 'generated';
    case 'reviewed':
      return 'reviewed';
    case 'outOfSync':
      return 'outOfSync';
    case 'needsGeneration':
      return 'needsGeneration';
    default:
      return 'needsReview';
  }
}

export function workflowStateLabel(state: ProtocolSectionWorkflowState): string {
  switch (state) {
    case 'importedUnvalidated':
    case 'imported':
      return 'Imported (unvalidated)';
    case 'validationRunning':
      return 'Validation running';
    case 'validationProposed':
    case 'unvalidated':
      return 'Validation proposed';
    case 'validationRejected':
      return 'Validation rejected';
    case 'validated':
      return 'Validated';
    case 'generated':
      return 'Generated';
    case 'reviewed':
      return 'Reviewed';
    case 'outOfSync':
      return 'Out of sync';
    case 'needsGeneration':
      return 'Needs generation';
    default:
      return state;
  }
}

export function contentOriginLabel(draft: GeneratedSectionDraft): string {
  return draft.contentOrigin === 'generated' ? 'Generated' : 'Imported';
}

export function importedSectionTooltip(draft: GeneratedSectionDraft | undefined): string | null {
  if (!draft || draft.contentOrigin !== 'imported') {
    return null;
  }

  const workflow = inferWorkflowState(draft);
  if (
    workflow !== 'importedUnvalidated' &&
    workflow !== 'validationProposed' &&
    workflow !== 'unvalidated' &&
    workflow !== 'imported'
  ) {
    return null;
  }

  return 'Imported from source protocol — pending validation';
}

export function isValidationReviewReady(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft?.validatedTargetText) {
    return false;
  }
  const workflow = inferWorkflowState(draft);
  return workflow === 'validationProposed' || workflow === 'unvalidated';
}
