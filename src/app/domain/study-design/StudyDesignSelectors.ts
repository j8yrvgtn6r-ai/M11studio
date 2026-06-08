import { getProtocolDocument } from '../protocol/store/protocolStore';
import { getProtocolImportState } from '../protocol/import/protocolImportStore';
import { hasSubstantiveEditorContent } from '../protocol/authoring/richTextContent';
import { calculateStudyDesignHealthScore } from './StudyDesignHealthScore';
import type { StudyDesignHealthScore } from './StudyDesignTypes';
import { getStudyDesign } from './StudyDesignStore';
import { validateStudyDesign } from './StudyDesignValidation';

export interface StudyDesignCounts {
  arms: number;
  cohorts: number;
  epochs: number;
  elements: number;
  anchors: number;
  visits: number;
  activities: number;
  milestones: number;
  scheduleRules: number;
}

export interface StudyDesignSummary {
  exists: boolean;
  counts: StudyDesignCounts;
  detectionSources: StudyDesignDetectionSource[];
  validationStatus: 'healthy' | 'warnings' | 'errors';
  validationMessage: string;
  healthScore: StudyDesignHealthScore;
}

const RELEVANT_SECTION_IDS = ['1.3', '4', '6', '8', '9', '10'];

export function getStudyDesignCounts(model: StudyDesign | null = getStudyDesign()): StudyDesignCounts {
  return {
    arms: model?.arms.length ?? 0,
    cohorts: model?.cohorts.length ?? 0,
    epochs: model?.epochs.length ?? 0,
    elements: model?.elements.length ?? 0,
    anchors: model?.anchors?.length ?? 0,
    visits: model?.visits.length ?? 0,
    activities: model?.activities.length ?? 0,
    milestones: model?.milestones.length ?? 0,
    scheduleRules: model?.scheduleRules.length ?? 0,
  };
}

export function studyDesignHasEntities(model: StudyDesign | null = getStudyDesign()): boolean {
  if (!model) {
    return false;
  }
  const counts = getStudyDesignCounts(model);
  return (
    counts.arms +
      counts.epochs +
      counts.visits +
      counts.activities +
      counts.milestones +
      counts.scheduleRules +
      counts.elements +
      counts.cohorts >
    0
  );
}

export function hasStudyDesign(): boolean {
  return studyDesignHasEntities(getStudyDesign());
}

export function inferStudyDesignDetectionSources(model: StudyDesign | null = getStudyDesign()): StudyDesignDetectionSource[] {
  if (!model) {
    return [];
  }
  const sources = new Set<StudyDesignDetectionSource>(model.detectionSources);
  if (model.arms.some((item) => item.provenance.source === 'manualEntry')) {
    sources.add('manualEntry');
  }
  if (
    model.visits.some((item) =>
      ['knowledgeGraph', 'studyModel', 'soaKnowledge'].includes(item.provenance.source),
    )
  ) {
    sources.add('knowledgeGraph');
  }
  if (model.activities.some((item) => item.provenance.source === 'protocolNarrative')) {
    sources.add('protocolNarrative');
  }
  return [...sources];
}

export function getStudyDesignSummary(): StudyDesignSummary {
  const model = getStudyDesign();
  const counts = getStudyDesignCounts(model);
  const validation = validateStudyDesign(model);
  const exists = studyDesignHasEntities(model);
  const detectionSources = inferStudyDesignDetectionSources(model);

  let validationMessage = 'Healthy';
  if (validation.summary.status === 'warnings') {
    validationMessage = `${validation.summary.warningCount} warning(s)`;
  } else if (validation.summary.status === 'errors') {
    validationMessage = `${validation.summary.errorCount} error(s)`;
  }

  return {
    exists,
    counts,
    detectionSources,
    validationStatus: validation.summary.status,
    validationMessage,
    healthScore: calculateStudyDesignHealthScore(model),
  };
}

export function listStudyDesignEntities(kind: StudyDesignEntityKind) {
  const model = getStudyDesign();
  if (!model) {
    return [];
  }
  switch (kind) {
    case 'arm':
      return model.arms;
    case 'epoch':
      return model.epochs;
    case 'visit':
      return model.visits;
    case 'activity':
      return model.activities;
    case 'milestone':
      return model.milestones;
    case 'anchor':
      return model.anchors ?? [];
    default:
      return [];
  }
}

export function protocolNarrativeHasScheduleSignals(): boolean {
  const document = getProtocolDocument();
  const importDrafts = getProtocolImportState().sectionDrafts;
  for (const sectionId of RELEVANT_SECTION_IDS) {
    const draft = importDrafts[sectionId];
    const draftText =
      draft?.validatedTargetText?.trim() ||
      draft?.generatedText?.trim() ||
      draft?.sourceText?.trim() ||
      '';
    if (hasSubstantiveEditorContent(draftText)) {
      return true;
    }
    const manualText = (document.elements ?? [])
      .filter((element) => element.sectionId === sectionId)
      .map((element) => String(element.value ?? ''))
      .join(' ');
    if (hasSubstantiveEditorContent(manualText)) {
      return true;
    }
  }
  return false;
}

export type StudyDesignStudioState = 'noStudyDesign' | 'studyDesignExists' | 'firstPassSoAExists';

export function evaluateStudyDesignStudioState(
  firstPassExists: boolean,
): StudyDesignStudioState {
  if (firstPassExists) {
    return 'firstPassSoAExists';
  }
  if (hasStudyDesign()) {
    return 'studyDesignExists';
  }
  return 'noStudyDesign';
}
