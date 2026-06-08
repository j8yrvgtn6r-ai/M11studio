import type { StudyDesignEntityKind } from '../StudyDesignTypes';
import { STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS } from '../StudyDesignTypes';

const ENTITY_SECTION_MAP: Record<string, string[]> = {
  epoch: ['4', '6'],
  visit: ['4', '5', '6', '8'],
  activity: ['6', '8', '9'],
  milestone: ['4', '5', '6'],
  anchor: ['4', '5', '6'],
  arm: ['4', '6'],
};

export function getImpactedSectionsForEntityChange(
  entityKind: StudyDesignEntityKind | 'epoch',
  changeType: 'added' | 'modified' | 'removed' = 'modified',
): string[] {
  const base = ENTITY_SECTION_MAP[entityKind] ?? ['4'];
  const sections = new Set<string>([...base, ...STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS.filter((id) => base.includes(id))]);
  if (changeType === 'removed' && entityKind === 'activity') {
    sections.add('8');
    sections.add('9');
  }
  if (entityKind === 'visit' && changeType === 'modified') {
    sections.add('5');
  }
  return [...sections].filter((id) =>
    (STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS as readonly string[]).includes(id),
  );
}

export function describeStudyDesignChangeImpact(
  entityKind: StudyDesignEntityKind | 'epoch',
  entityName: string,
): string {
  const sections = getImpactedSectionsForEntityChange(entityKind);
  return `Changes to ${entityKind} "${entityName}" may impact protocol sections ${sections.join(', ')}.`;
}

export function analyzeCrossLayerImpact(options: {
  visitCount: number;
  activityCount: number;
  milestoneCount: number;
  scheduleRuleCount: number;
}): string[] {
  const notes: string[] = [];
  if (options.visitCount > 0 && options.activityCount === 0) {
    notes.push('Visits exist without activities — Section 8 may be incomplete.');
  }
  if (options.activityCount > 0 && options.scheduleRuleCount === 0) {
    notes.push('Activities exist without schedule rules — Section 1.3 SoA may be incomplete.');
  }
  if (options.milestoneCount === 0 && options.visitCount > 0) {
    notes.push('Visits exist without milestones — Section 4 trial design timing may need milestones.');
  }
  return notes;
}
