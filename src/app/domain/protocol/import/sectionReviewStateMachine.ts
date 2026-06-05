import type { GeneratedSectionDraft, SectionReviewState, SectionStateHistoryEntry } from './types';

export type SectionReviewEvent =
  | 'importGenerated'
  | 'openReview'
  | 'requestChanges'
  | 'approve'
  | 'validationSucceeded'
  | 'validationFailed'
  | 'regenerate';

const TRANSITIONS: Record<SectionReviewState, Partial<Record<SectionReviewEvent, SectionReviewState>>> = {
  generated: { importGenerated: 'pendingReview', openReview: 'inReview' },
  pendingReview: { openReview: 'inReview', requestChanges: 'changesRequested', approve: 'validationPending' },
  inReview: { requestChanges: 'changesRequested', approve: 'validationPending' },
  changesRequested: { openReview: 'inReview', approve: 'validationPending', regenerate: 'pendingReview' },
  approved: { regenerate: 'pendingReview' },
  validationPending: {
    validationSucceeded: 'validationPassed',
    validationFailed: 'validationFailed',
  },
  validationPassed: { regenerate: 'pendingReview' },
  validationFailed: { openReview: 'inReview', requestChanges: 'changesRequested', regenerate: 'pendingReview' },
  superseded: {},
};

export function canTransitionSectionState(
  current: SectionReviewState,
  event: SectionReviewEvent,
): boolean {
  return Boolean(TRANSITIONS[current]?.[event]);
}

export function transitionSectionState(
  draft: GeneratedSectionDraft,
  event: SectionReviewEvent,
  actor = 'Current user',
  note?: string,
): GeneratedSectionDraft {
  const next = TRANSITIONS[draft.state]?.[event];
  if (!next) {
    return draft;
  }

  const entry: SectionStateHistoryEntry = {
    state: next,
    changedAt: new Date().toISOString(),
    changedBy: actor,
    note,
  };

  return {
    ...draft,
    state: next,
    stateChangedAt: entry.changedAt,
    stateChangedBy: actor,
    stateHistory: [...draft.stateHistory, entry],
  };
}

export function isSectionActionable(state: SectionReviewState): boolean {
  return state === 'pendingReview' || state === 'inReview' || state === 'changesRequested' || state === 'validationFailed';
}

export function isSectionApproved(state: SectionReviewState): boolean {
  return state === 'approved' || state === 'validationPassed';
}

export function validationStatusFromState(state: SectionReviewState): GeneratedSectionDraft['validationStatus'] {
  switch (state) {
    case 'validationPassed':
      return 'passed';
    case 'validationFailed':
      return 'failed';
    case 'validationPending':
      return 'not-run';
    default:
      return 'not-run';
  }
}
