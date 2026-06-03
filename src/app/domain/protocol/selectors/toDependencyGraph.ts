import type { DependencyEdge, DependencyNode } from '../../../types/dependencyGraph';
import type { ClinicalDesignEntities, DesignEntity, ProtocolDocument } from '../types';

const DESIGN_ENTITY_GROUPS: (keyof ClinicalDesignEntities)[] = [
  'objectives',
  'endpoints',
  'assessments',
  'visits',
  'statisticalAnalyses',
  'studyArms',
  'populations',
  'eligibilityCriteria',
  'biomarkers',
  'interventions',
  'safetyAssessments',
];

function collectDesignEntities(clinicalDesign: ClinicalDesignEntities): DesignEntity[] {
  const entities: DesignEntity[] = [];

  for (const group of DESIGN_ENTITY_GROUPS) {
    const groupEntities = clinicalDesign[group];
    if (groupEntities?.length) {
      entities.push(...groupEntities);
    }
  }

  return entities;
}

function toDependencyNode(entity: DesignEntity): DependencyNode {
  const node: DependencyNode = {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    status: [...entity.status],
  };

  if (entity.sectionRef !== undefined) {
    node.sectionId = entity.sectionRef;
  }

  if (entity.description !== undefined) {
    node.description = entity.description;
  }

  if (entity.metadata !== undefined) {
    node.metadata = entity.metadata;
  }

  return node;
}

export function selectDependencyNodes(document: ProtocolDocument): DependencyNode[] {
  return collectDesignEntities(document.clinicalDesign).map(toDependencyNode);
}

export function selectDependencyEdges(document: ProtocolDocument): DependencyEdge[] {
  return document.relationships.map(({ id, sourceId, targetId, label }) => ({
    id,
    source: sourceId,
    target: targetId,
    ...(label !== undefined ? { label } : {}),
  }));
}
