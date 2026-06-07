import type { SoAKnowledgeChange, SoANarrativeImpactRecord } from './soaKnowledgeTypes';

const SAFETY_CATEGORIES = new Set(['safety', 'adverseEvents', 'vitalSigns', 'physicalExam']);
const ANALYSIS_KEYWORDS = ['statistical', 'analysis', 'endpoint', 'alpha', 'power', 'sample size'];

function uniqueSections(sectionIds: string[]): string[] {
  return [...new Set(sectionIds.filter(Boolean))];
}

export function getNarrativeSectionsImpactedBySoAChange(change: SoAKnowledgeChange): string[] {
  switch (change.kind) {
    case 'assessmentSchedule':
    case 'assessmentAdded':
    case 'scheduleRuleChanged':
      return uniqueSections(['1.3', '8', ...(isSafetyRelatedChange(change) ? ['9'] : []), ...(isAnalysisRelatedChange(change) ? ['10'] : [])]);
    case 'visitTiming':
    case 'visitAdded':
      return uniqueSections(['1.3', '4', '8']);
    case 'interventionActivity':
      return uniqueSections(['4', '6', '8']);
    default:
      return uniqueSections(['1.3']);
  }
}

function isSafetyRelatedChange(change: SoAKnowledgeChange): boolean {
  const haystack = `${change.entityName ?? ''} ${change.description ?? ''}`.toLowerCase();
  return (
    SAFETY_CATEGORIES.has(change.description ?? '') ||
    /adverse|safety|sae|vital|physical exam|ecg/.test(haystack)
  );
}

function isAnalysisRelatedChange(change: SoAKnowledgeChange): boolean {
  const haystack = `${change.entityName ?? ''} ${change.description ?? ''}`.toLowerCase();
  return ANALYSIS_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function getSoAFieldsImpactedByNarrativeSection(sectionId: string): string[] {
  const normalized = sectionId.replace(/^section-/, '');
  if (normalized === '1.3' || normalized.startsWith('1.3.')) {
    return ['visits', 'activities', 'scheduleRules', 'timingWindows', 'footnotes'];
  }
  if (normalized === '4' || normalized.startsWith('4.')) {
    return ['epochs', 'elements', 'arms', 'visits'];
  }
  if (normalized === '6' || normalized.startsWith('6.')) {
    return ['activities', 'arms', 'conditions'];
  }
  if (normalized === '8' || normalized.startsWith('8.')) {
    return ['assessments', 'procedures', 'scheduleRules', 'timingWindows'];
  }
  if (normalized === '9' || normalized.startsWith('9.')) {
    return ['assessments', 'scheduleRules', 'conditions'];
  }
  if (normalized === '10' || normalized.startsWith('10.')) {
    return ['scheduleRules', 'timingWindows', 'assessments'];
  }
  return [];
}

export function createSoANarrativeImpactRecord(change: SoAKnowledgeChange): SoANarrativeImpactRecord {
  const impactedSectionIds = getNarrativeSectionsImpactedBySoAChange(change);
  const reasons: Record<string, string> = {};

  for (const sectionId of impactedSectionIds) {
    switch (sectionId) {
      case '1.3':
        reasons[sectionId] = 'Schedule of Activities narrative must reflect schedule structure changes.';
        break;
      case '4':
        reasons[sectionId] = 'Trial design narrative describes epochs, elements, and visit timing.';
        break;
      case '6':
        reasons[sectionId] = 'Intervention section may reference on-treatment activities and conditions.';
        break;
      case '8':
        reasons[sectionId] = 'Assessments and procedures section defines what occurs at visits.';
        break;
      case '9':
        reasons[sectionId] = 'Safety reporting depends on safety assessment scheduling.';
        break;
      case '10':
        reasons[sectionId] = 'Statistical considerations may reference visit timing and assessment timing.';
        break;
      default:
        reasons[sectionId] = 'Related narrative may require review after SoA knowledge change.';
        break;
    }
  }

  return {
    change,
    impactedSectionIds,
    reasons,
    createdAt: new Date().toISOString(),
  };
}
