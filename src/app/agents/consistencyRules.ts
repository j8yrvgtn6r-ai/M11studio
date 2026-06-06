import type { StudyModelCollectionKey } from '../domain/study-model/studyModelTypes';
import type { KnowledgeExtractedItem } from './knowledgeAgentHeuristics';

export type ConsistencySuggestedAction = 'validate' | 'regenerate' | 'edit';

export interface ConsistencyImpactReason {
  changedItemName: string;
  changedItemCollection: string;
  relationship: string;
  reason: string;
  suggestedAction: ConsistencySuggestedAction;
}

export interface ConsistencySectionImpact {
  sectionId: string;
  reasons: ConsistencyImpactReason[];
}

export interface M11SectionDependencyRule {
  id: string;
  label: string;
  collections: Array<StudyModelCollectionKey | 'studyMetadata'>;
  affectedSectionIds: string[];
  relationship: string;
  suggestedAction: ConsistencySuggestedAction;
}

/** Deterministic M11 downstream section map for Consistency Agent v1. */
export const M11_CONSISTENCY_DEPENDENCY_RULES: M11SectionDependencyRule[] = [
  {
    id: 'objectives',
    label: 'Objectives / estimands',
    collections: ['objectives', 'estimands'],
    affectedSectionIds: ['1.1', '3', '4', '8', '10'],
    relationship: 'objectives-estimands',
    suggestedAction: 'validate',
  },
  {
    id: 'endpoints',
    label: 'Endpoints',
    collections: ['endpoints'],
    affectedSectionIds: ['1.1', '3', '8', '10'],
    relationship: 'endpoints',
    suggestedAction: 'validate',
  },
  {
    id: 'population',
    label: 'Population / eligibility',
    collections: ['population', 'eligibility'],
    affectedSectionIds: ['1.1', '4', '5', '10'],
    relationship: 'population-eligibility',
    suggestedAction: 'validate',
  },
  {
    id: 'intervention-design',
    label: 'Arms / interventions / randomization / blinding',
    collections: ['arms', 'interventions', 'randomization', 'blinding'],
    affectedSectionIds: ['1.1', '1.2', '4', '6', '10'],
    relationship: 'intervention-design',
    suggestedAction: 'regenerate',
  },
  {
    id: 'assessments',
    label: 'Assessments / procedures',
    collections: ['assessments', 'procedures', 'activities', 'visits'],
    affectedSectionIds: ['1.3', '8', '9', '10'],
    relationship: 'assessments-procedures',
    suggestedAction: 'validate',
  },
  {
    id: 'statistics',
    label: 'Sample size / statistical methods',
    collections: ['statisticalMethods'],
    affectedSectionIds: ['1.1', '10'],
    relationship: 'statistical-methods',
    suggestedAction: 'validate',
  },
];

function normalizeCollection(value: string): string {
  return value === 'studyMetadata' ? 'studyMetadata' : value;
}

function matchesRule(rule: M11SectionDependencyRule, item: KnowledgeExtractedItem): boolean {
  const collection = normalizeCollection(item.collection);
  return rule.collections.some((candidate) => candidate === collection);
}

function reasonKey(reason: ConsistencyImpactReason): string {
  return `${reason.changedItemCollection}:${reason.changedItemName}:${reason.relationship}`;
}

export function expandM11SectionTargets(
  targetSectionIds: string[],
  availableSectionIds: string[],
): string[] {
  const expanded = new Set<string>();
  for (const target of targetSectionIds) {
    for (const sectionId of availableSectionIds) {
      if (sectionId === target || sectionId.startsWith(`${target}.`)) {
        expanded.add(sectionId);
      }
    }
  }
  return [...expanded];
}

export function evaluateConsistencyImpacts(input: {
  sourceSectionId: string;
  changedItems: KnowledgeExtractedItem[];
  availableSectionIds: string[];
}): ConsistencySectionImpact[] {
  if (input.changedItems.length === 0) {
    return [];
  }

  const impactsBySection = new Map<string, Map<string, ConsistencyImpactReason>>();

  for (const changedItem of input.changedItems) {
    for (const rule of M11_CONSISTENCY_DEPENDENCY_RULES) {
      if (!matchesRule(rule, changedItem)) {
        continue;
      }

      const targets = expandM11SectionTargets(rule.affectedSectionIds, input.availableSectionIds).filter(
        (sectionId) => sectionId !== input.sourceSectionId,
      );

      for (const sectionId of targets) {
        const reason: ConsistencyImpactReason = {
          changedItemName: changedItem.name,
          changedItemCollection: normalizeCollection(changedItem.collection),
          relationship: rule.relationship,
          reason: `${rule.label} changed in section ${input.sourceSectionId} ("${changedItem.name}") may affect this section.`,
          suggestedAction: rule.suggestedAction,
        };

        const sectionReasons = impactsBySection.get(sectionId) ?? new Map<string, ConsistencyImpactReason>();
        sectionReasons.set(reasonKey(reason), reason);
        impactsBySection.set(sectionId, sectionReasons);
      }
    }
  }

  return [...impactsBySection.entries()].map(([sectionId, reasons]) => ({
    sectionId,
    reasons: [...reasons.values()],
  }));
}

export function augmentConsistencyImpactsWithKnowledgeGraph(input: {
  impacts: ConsistencySectionImpact[];
  changedItems: KnowledgeExtractedItem[];
  availableSectionIds: string[];
  sourceSectionId: string;
  graphSectionIds?: string[];
}): { impacts: ConsistencySectionImpact[]; usedKnowledgeGraph: boolean } {
  const graphSectionIds = (input.graphSectionIds ?? []).filter(
    (sectionId) => sectionId && sectionId !== input.sourceSectionId && input.availableSectionIds.includes(sectionId),
  );

  if (graphSectionIds.length === 0) {
    return { impacts: input.impacts, usedKnowledgeGraph: false };
  }

  const impactsBySection = new Map<string, Map<string, ConsistencyImpactReason>>();
  for (const impact of input.impacts) {
    impactsBySection.set(impact.sectionId, new Map(impact.reasons.map((reason) => [reasonKey(reason), reason])));
  }

  for (const sectionId of expandM11SectionTargets(graphSectionIds, input.availableSectionIds)) {
    if (sectionId === input.sourceSectionId) {
      continue;
    }
    const changedItem = input.changedItems[0];
    const reason: ConsistencyImpactReason = {
      changedItemName: changedItem?.name ?? 'study fact',
      changedItemCollection: normalizeCollection(changedItem?.collection ?? 'objectives'),
      relationship: 'knowledge-graph',
      reason: `Knowledge Graph relationship links changed study facts to section ${sectionId}.`,
      suggestedAction: 'validate',
    };
    const sectionReasons = impactsBySection.get(sectionId) ?? new Map<string, ConsistencyImpactReason>();
    sectionReasons.set(reasonKey(reason), reason);
    impactsBySection.set(sectionId, sectionReasons);
  }

  return {
    impacts: [...impactsBySection.entries()].map(([sectionId, reasons]) => ({
      sectionId,
      reasons: [...reasons.values()],
    })),
    usedKnowledgeGraph: true,
  };
}

export function getM11ConsistencyDependencyMetadata(): Array<{
  ruleId: string;
  relationship: string;
  affectedSectionIds: string[];
}> {
  return M11_CONSISTENCY_DEPENDENCY_RULES.map((rule) => ({
    ruleId: rule.id,
    relationship: rule.relationship,
    affectedSectionIds: rule.affectedSectionIds,
  }));
}
