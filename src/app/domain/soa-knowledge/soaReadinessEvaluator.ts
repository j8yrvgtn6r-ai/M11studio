import { getKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument } from '../protocol/store/protocolStore';
import { getProtocolImportState } from '../protocol/import/protocolImportStore';
import { hasSubstantiveEditorContent } from '../protocol/authoring/richTextContent';
import { getStudyModel, getStudyModelPhase } from '../study-model/studyModelStore';
import { hasStudyDesign } from '../study-design/StudyDesignSelectors';
import { getSoAKnowledge } from './soaKnowledgeStore';
import { getCurrentSoAProposal } from './soaProposalStore';

export const SOA_READINESS_RELEVANT_SECTION_IDS = ['1.3', '4', '6', '8', '9', '10'] as const;

export type SoAReadinessRelevantSectionId = (typeof SOA_READINESS_RELEVANT_SECTION_IDS)[number];

export interface SoAReadinessEvaluation {
  ready: boolean;
  reasons: string[];
  missingInputs: string[];
  suggestedNextActions: string[];
  populatedRelevantSections: SoAReadinessRelevantSectionId[];
}

export interface SoAEnrichmentReadinessEvaluation {
  ready: boolean;
  reasons: string[];
  missingInputs: string[];
  suggestedNextActions: string[];
}

function sectionHasImportedContent(sectionId: string): boolean {
  const draft = getProtocolImportState().sectionDrafts[sectionId];
  if (!draft) {
    return false;
  }
  const text =
    draft.validatedTargetText?.trim() ||
    draft.generatedText?.trim() ||
    draft.sourceText?.trim() ||
    '';
  return hasSubstantiveEditorContent(text);
}

function sectionHasManualContent(sectionId: string): boolean {
  const document = getProtocolDocument();
  const elements = document.elements ?? [];
  return elements.some(
    (element) =>
      element.sectionId === sectionId &&
      element.value !== undefined &&
      element.value !== null &&
      String(element.value).trim().length > 0,
  );
}

function sectionHasAuthoringContent(sectionId: string): boolean {
  return sectionHasImportedContent(sectionId) || sectionHasManualContent(sectionId);
}

function collectPopulatedRelevantSections(): SoAReadinessRelevantSectionId[] {
  return SOA_READINESS_RELEVANT_SECTION_IDS.filter((sectionId) => sectionHasAuthoringContent(sectionId));
}

function studyModelHasMeaningfulContent(): boolean {
  const studyModel = getStudyModel();
  if (!studyModel) {
    return false;
  }
  const collections = [
    studyModel.population,
    studyModel.arms,
    studyModel.epochs,
    studyModel.elements,
    studyModel.visits,
    studyModel.activities,
    studyModel.assessments,
    studyModel.interventions,
    studyModel.endpoints,
    studyModel.objectives,
  ];
  return collections.some((items) => items.length > 0);
}

function coreStudyModelExists(): boolean {
  const phase = getStudyModelPhase();
  return phase === 'core' || phase === 'enriching' || phase === 'deep' || studyModelHasMeaningfulContent();
}

function knowledgeGraphHasMeaningfulEntities(): boolean {
  const graph = getKnowledgeGraph();
  if (!graph) {
    return false;
  }
  const meaningfulTypes = new Set([
    'arm',
    'visit',
    'activity',
    'assessment',
    'procedure',
    'intervention',
    'population',
    'endpoint',
    'objective',
  ]);
  return (graph.entities ?? []).some((entity) => meaningfulTypes.has(entity.entityType));
}

function hasProtocolKnowledgeSignal(): boolean {
  return coreStudyModelExists() || knowledgeGraphHasMeaningfulEntities();
}

export function evaluateSoAFirstPassReadiness(): SoAReadinessEvaluation {
  const populatedRelevantSections = collectPopulatedRelevantSections();
  const reasons: string[] = [];
  const missingInputs: string[] = [];
  const suggestedNextActions: string[] = [];

  const studyDesignReady = hasStudyDesign();

  if (studyDesignReady) {
    reasons.push('Study Design model exists and can seed first-pass SoA generation.');
  } else {
    missingInputs.push('Study Design');
    suggestedNextActions.push('Build Study Design from Knowledge Graph and protocol narrative, or add entities manually.');
  }

  if (hasRelevantSectionContent(populatedRelevantSections)) {
    reasons.push(
      `Relevant protocol sections have content (${populatedRelevantSections.join(', ')}).`,
    );
  }

  const ready = studyDesignReady;

  if (!ready) {
    suggestedNextActions.push('Create a Study Design before generating a first-pass SoA.');
  }

  return {
    ready,
    reasons,
    missingInputs,
    suggestedNextActions: [...new Set(suggestedNextActions)],
    populatedRelevantSections,
  };
}

function hasRelevantSectionContent(populatedRelevantSections: SoAReadinessRelevantSectionId[]): boolean {
  return populatedRelevantSections.length > 0;
}

function configurationHasScheduleContent(document: ReturnType<typeof getProtocolDocument>): boolean {
  const visitSchedule = document.visitSchedule ?? { anchors: [], visitDefinitions: [] };
  const hasRules = (document.assessmentScheduleRules ?? []).length > 0;
  const hasAssessments = (document.soaAssessmentDefinitions ?? []).length > 0;
  const hasVisits = visitSchedule.visitDefinitions.length > 0;
  const hasAnchors = visitSchedule.anchors.length > 0;
  const hasGeneratedCache = Boolean(document.schedule?.metadata?.generatedFromRules);
  return hasRules || hasAssessments || hasVisits || hasAnchors || hasGeneratedCache;
}

export function firstPassSoAExists(): boolean {
  const proposal = getCurrentSoAProposal();
  if (proposal && (proposal.status === 'proposed' || proposal.status === 'accepted')) {
    return true;
  }

  const knowledge = getSoAKnowledge();
  if (knowledge) {
    const entityCount =
      knowledge.visits.length +
      knowledge.assessments.length +
      knowledge.scheduleRules.length +
      knowledge.activities.length;
    if (entityCount > 0) {
      return true;
    }
  }

  return configurationHasScheduleContent(getProtocolDocument());
}

function deterministicExtractionHasRun(): boolean {
  const knowledge = getSoAKnowledge();
  if (!knowledge) {
    return false;
  }

  const hasDeterministicEntities = [
    ...knowledge.visits,
    ...knowledge.assessments,
    ...knowledge.scheduleRules,
    ...knowledge.activities,
    ...knowledge.epochs,
    ...knowledge.arms,
  ].some(
    (entity) =>
      entity.inferenceSource === 'deterministic' ||
      entity.inferenceSource === 'deterministic-table' ||
      entity.inferenceSource === 'user-created' ||
      entity.inferenceSource === 'user-modified' ||
      entity.inferenceSource === 'user-accepted',
  );

  if (hasDeterministicEntities) {
    return true;
  }

  return (
    knowledge.visits.length > 0 ||
    knowledge.assessments.length > 0 ||
    knowledge.scheduleRules.length > 0
  );
}

function soaKnowledgeHasScheduleEntities(): boolean {
  const knowledge = getSoAKnowledge();
  if (!knowledge) {
    return false;
  }
  return (
    knowledge.visits.length > 0 ||
    knowledge.assessments.length > 0 ||
    knowledge.scheduleRules.length > 0
  );
}

export function evaluateSoAEnrichmentReadiness(): SoAEnrichmentReadinessEvaluation {
  const reasons: string[] = [];
  const missingInputs: string[] = [];
  const suggestedNextActions: string[] = [];

  const hasFirstPass = firstPassSoAExists();

  if (hasFirstPass) {
    reasons.push('A first-pass SoA proposal or accepted schedule model exists.');
  } else {
    missingInputs.push('First-pass SoA');
    suggestedNextActions.push('Generate and accept a first-pass SoA.');
  }

  const ready = hasFirstPass;

  if (!ready) {
    suggestedNextActions.push('Generate a first-pass SoA before running LLM enrichment.');
  }

  return {
    ready,
    reasons,
    missingInputs,
    suggestedNextActions: [...new Set(suggestedNextActions)],
  };
}
