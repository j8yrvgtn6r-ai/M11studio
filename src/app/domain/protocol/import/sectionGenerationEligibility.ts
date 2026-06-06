import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../ichM11/types';
import { listM11GenerationTargetSectionIds } from './importVisualizationUtils';
import { findRelevantSourceCandidates } from './m11SourceSectionMapping';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import { listQuickReconstructionSectionIds } from './quickReconstructionSections';
import type { GeneratedSectionDraft, ImportedProtocolSource } from './types';

function knowledgeElementsForSection(spec: IchM11SectionSpec, knowledge: ProtocolKnowledgeModel): string[] {
  const title = spec.title.toLowerCase();
  const id = spec.id;
  const elements: string[] = [];

  const push = (label: string, values?: string | string[]) => {
    if (!values) {
      return;
    }
    if (Array.isArray(values)) {
      for (const value of values.slice(0, 3)) {
        if (value.trim()) {
          elements.push(`${label}: ${value}`);
        }
      }
      return;
    }
    if (values.trim()) {
      elements.push(`${label}: ${values}`);
    }
  };

  if (id.startsWith('1') || title.includes('synopsis') || title.includes('title')) {
    push('Study title', knowledge.studyTitle);
    push('Protocol ID', knowledge.protocolIdentifier);
    push('Sponsor', knowledge.sponsor);
    push('Phase', knowledge.phase);
    push('Indication', knowledge.indication);
  }
  if (id.startsWith('3') || title.includes('objective')) {
    push('Primary objectives', knowledge.primaryObjectives);
    push('Secondary objectives', knowledge.secondaryObjectives);
    push('Estimands', knowledge.estimands);
    push('Endpoints', knowledge.endpoints);
  }
  if (id.startsWith('4') || title.includes('design') || title.includes('population')) {
    push('Target population', knowledge.targetPopulation);
    push('Arms', knowledge.arms);
    push('Intervention model', knowledge.interventionModel);
    push('Interventions', knowledge.interventions);
  }
  if (id.startsWith('5') || title.includes('eligibility')) {
    push('Inclusion', knowledge.inclusionCriteriaSummary);
    push('Exclusion', knowledge.exclusionCriteriaSummary);
  }
  if (title.includes('visit') || title.includes('schedule')) {
    push('Visits', knowledge.visits);
    push('Assessments', knowledge.assessments);
  }
  if (title.includes('safety')) {
    push('Safety monitoring', knowledge.safetyMonitoring);
  }
  if (id.startsWith('9') || title.includes('statistic')) {
    push('Statistics', knowledge.statisticalSummary);
  }
  if (title.includes('risk') || title.includes('benefit')) {
    push('Risk-benefit', knowledge.riskBenefitSummary);
  }

  return elements;
}

export function sectionHasGenerationSource(
  sectionId: string,
  importedSource: ImportedProtocolSource,
  knowledge: ProtocolKnowledgeModel,
): boolean {
  const spec = ICH_M11_TEMPLATE_SECTION_SPECS.find((entry) => entry.id === sectionId);
  if (!spec || spec.sectionType === 'template-instruction') {
    return false;
  }

  const relevantSource = findRelevantSourceCandidates(sectionId, spec.title, importedSource.sections, 1);
  if (relevantSource.length > 0) {
    return true;
  }

  return knowledgeElementsForSection(spec, knowledge).length > 0;
}

/** Non-priority sections that should continue generating automatically after Quick Reconstruction. */
export function listAutoBackgroundGenerationSectionIds(
  importedSource: ImportedProtocolSource,
  knowledge: ProtocolKnowledgeModel,
  sectionDrafts: Record<string, GeneratedSectionDraft>,
): string[] {
  const priorityIds = new Set(listQuickReconstructionSectionIds());

  return listM11GenerationTargetSectionIds().filter((sectionId) => {
    if (priorityIds.has(sectionId)) {
      return false;
    }
    const draft = sectionDrafts[sectionId];
    if (draft && draft.generationStatus !== 'failed') {
      return false;
    }
    return sectionHasGenerationSource(sectionId, importedSource, knowledge);
  });
}

/** Sections left as notGenerated (no source / heading-only containers). */
export function listPersistentNotGeneratedSectionIds(
  importedSource: ImportedProtocolSource,
  knowledge: ProtocolKnowledgeModel,
  sectionDrafts: Record<string, GeneratedSectionDraft>,
): string[] {
  const autoBackground = new Set(
    listAutoBackgroundGenerationSectionIds(importedSource, knowledge, sectionDrafts),
  );

  return listM11GenerationTargetSectionIds().filter((sectionId) => {
    const draft = sectionDrafts[sectionId];
    if (draft && draft.generationStatus !== 'failed') {
      return false;
    }
    return !autoBackground.has(sectionId);
  });
}
