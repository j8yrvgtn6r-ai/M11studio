import type { StudyDesignEntityKind, NarrativeImpactProposal } from '../StudyDesignTypes';
import { STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS } from '../StudyDesignTypes';
import { getImpactedSectionsForEntityChange } from './StudyDesignImpactAnalysis';

function now(): string {
  return new Date().toISOString();
}

export function createNarrativeImpactProposal(options: {
  entityKind: StudyDesignEntityKind | 'epoch';
  entityId: string;
  entityName: string;
  changeType?: 'added' | 'modified' | 'removed';
}): NarrativeImpactProposal {
  const impactedSectionIds = getImpactedSectionsForEntityChange(options.entityKind, options.changeType);
  const changeLabel =
    options.changeType === 'removed' ? 'removed' : options.changeType === 'added' ? 'added' : 'updated';

  return {
    id: `narrative-impact-${Date.now()}`,
    createdAt: now(),
    status: 'proposed',
    source: 'studyDesignEdit',
    entityKind: options.entityKind,
    entityId: options.entityId,
    entityName: options.entityName,
    impactedSectionIds,
    message: 'Protocol narrative may need updating.',
    suggestedNote: `Study Design ${options.entityKind} "${options.entityName}" was ${changeLabel}. Protocol narrative may need updating in Section(s) ${impactedSectionIds.join(', ')}.`,
  };
}

export function formatNarrativeImpactMessage(proposal: NarrativeImpactProposal): string {
  return proposal.message;
}

export function allNarrativeImpactSections(): string[] {
  return [...STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS];
}
