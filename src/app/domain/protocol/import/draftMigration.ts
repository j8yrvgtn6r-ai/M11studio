import type { GeneratedSectionDraft, GeneratedSectionReviewStatus, SectionReviewState } from './types';

function reviewStatusToState(reviewStatus?: GeneratedSectionReviewStatus): SectionReviewState {
  switch (reviewStatus) {
    case 'approved':
      return 'validationPassed';
    case 'changes-requested':
      return 'changesRequested';
    default:
      return 'pendingReview';
  }
}

/** Normalizes legacy persisted drafts to v2 PR2 state machine shape. */
export function normalizeSectionDraft(draft: GeneratedSectionDraft): GeneratedSectionDraft {
  const state = draft.state ?? reviewStatusToState(draft.reviewStatus);
  const now = draft.stateChangedAt ?? draft.generatedAt ?? new Date().toISOString();
  const actor = draft.stateChangedBy ?? draft.reviewer ?? 'local-user';

  return {
    ...draft,
    knowledgeModelId: draft.knowledgeModelId ?? draft.sourceExtractionId ?? '',
    generationProvider: draft.generationProvider ?? 'local-deterministic',
    draftVersion: draft.draftVersion ?? 1,
    state,
    stateChangedAt: now,
    stateChangedBy: actor,
    stateHistory:
      draft.stateHistory?.length > 0
        ? draft.stateHistory
        : [{ state, changedAt: now, changedBy: actor, note: 'Migrated draft record' }],
    reviewStatus: undefined,
  };
}
