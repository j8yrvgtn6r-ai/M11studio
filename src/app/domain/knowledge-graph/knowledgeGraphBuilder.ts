import type { StudyModel, StudyModelCollectionKey, StudyModelItem } from '../study-model/studyModelTypes';
import {
  applyKnowledgeGraphPatch,
  createEmptyKnowledgeGraph,
  normalizeKnowledgeName,
} from './knowledgeGraphPatch';
import type {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeGraph,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
} from './knowledgeGraphTypes';

const COLLECTION_ENTITY_TYPE: Partial<Record<StudyModelCollectionKey, KnowledgeEntityType>> = {
  objectives: 'objective',
  endpoints: 'endpoint',
  estimands: 'estimand',
  population: 'population',
  arms: 'arm',
  interventions: 'intervention',
  visits: 'visit',
  activities: 'activity',
  assessments: 'assessment',
  procedures: 'procedure',
  safetyMonitoring: 'safetyVariable',
  statisticalMethods: 'statisticalMethod',
  eligibility: 'eligibilityCriterion',
};

function slug(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `item_${index}`;
}

function entityFromItem(
  item: StudyModelItem,
  entityType: KnowledgeEntityType,
  protocolId?: string,
): KnowledgeEntity | null {
  if (!item.name.trim()) {
    return null;
  }
  const now = item.lastUpdated || new Date().toISOString();
  return {
    id: `${entityType}_${slug(item.name, 0)}`,
    protocolId,
    entityType,
    name: item.name.trim(),
    description: item.description?.trim(),
    normalizedName: normalizeKnowledgeName(item.name),
    aliases: [],
    sourceSectionIds: [...item.sourceSections],
    sourceDocumentIds: [],
    metadata: { studyModelItemId: item.id },
    createdAt: now,
    updatedAt: now,
  };
}

function addRelationship(
  graph: KnowledgeGraph,
  input: {
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: KnowledgeRelationshipType;
    sourceSectionIds?: string[];
  },
): KnowledgeGraph {
  if (!input.sourceEntityId || !input.targetEntityId || input.sourceEntityId === input.targetEntityId) {
    return graph;
  }
  const now = new Date().toISOString();
  const relationship: KnowledgeRelationship = {
    id: `${input.relationshipType}_${input.sourceEntityId}_${input.targetEntityId}`,
    protocolId: graph.protocolId,
    sourceEntityId: input.sourceEntityId,
    targetEntityId: input.targetEntityId,
    relationshipType: input.relationshipType,
    sourceSectionIds: input.sourceSectionIds ?? [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  return applyKnowledgeGraphPatch(graph, { relationships: [relationship] });
}

function entitiesForCollection(
  studyModel: StudyModel,
  collection: StudyModelCollectionKey,
  protocolId?: string,
): KnowledgeEntity[] {
  const entityType = COLLECTION_ENTITY_TYPE[collection];
  if (!entityType) {
    return [];
  }
  return studyModel[collection]
    .map((item) => entityFromItem(item, entityType, protocolId))
    .filter((entity): entity is KnowledgeEntity => entity !== null);
}

function addSectionEntities(studyModel: StudyModel, protocolId?: string): KnowledgeEntity[] {
  const sectionIds = new Set<string>();
  for (const collection of Object.keys(COLLECTION_ENTITY_TYPE) as StudyModelCollectionKey[]) {
    for (const item of studyModel[collection]) {
      for (const sectionId of item.sourceSections) {
        sectionIds.add(sectionId);
      }
    }
  }
  const now = studyModel.builtAt;
  return [...sectionIds].map((sectionId) => ({
    id: `section_${slug(sectionId, 0)}`,
    protocolId,
    entityType: 'documentSection' as const,
    name: `Section ${sectionId}`,
    normalizedName: normalizeKnowledgeName(sectionId),
    aliases: [sectionId],
    sourceSectionIds: [sectionId],
    sourceDocumentIds: [],
    metadata: { sectionId },
    createdAt: now,
    updatedAt: now,
  }));
}

function studyEntityFromModel(studyModel: StudyModel, protocolId?: string): KnowledgeEntity | null {
  const title = studyModel.studyMetadata.title?.trim();
  if (!title) {
    return null;
  }
  const now = studyModel.builtAt;
  return {
    id: `study_${slug(title, 0)}`,
    protocolId,
    entityType: 'study',
    name: title,
    description: studyModel.studyMetadata.indication,
    normalizedName: normalizeKnowledgeName(title),
    aliases: studyModel.studyMetadata.shortTitle ? [studyModel.studyMetadata.shortTitle] : [],
    sourceSectionIds: ['1.1'],
    sourceDocumentIds: [],
    metadata: {
      phase: studyModel.studyMetadata.phase,
      sponsor: studyModel.studyMetadata.sponsor,
      protocolIdentifier: studyModel.studyMetadata.protocolIdentifier,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function mayMeasureBy(objective: KnowledgeEntity, endpoint: KnowledgeEntity): boolean {
  const objectiveText = `${objective.name} ${objective.description ?? ''}`.toLowerCase();
  const endpointName = endpoint.normalizedName;
  if (endpointName.length >= 3 && objectiveText.includes(endpointName)) {
    return true;
  }
  const abbrev = endpoint.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (abbrev.length >= 3 && objectiveText.includes(abbrev)) {
    return true;
  }
  return false;
}

/**
 * Builds a conservative knowledge graph from a structured Study Model.
 * Does not invent relationships when source data is missing.
 */
export function buildKnowledgeGraphFromStudyModel(
  studyModel: StudyModel | null | undefined,
  protocolId?: string,
): KnowledgeGraph {
  if (!studyModel) {
    return createEmptyKnowledgeGraph(protocolId);
  }

  let graph = createEmptyKnowledgeGraph(protocolId ?? studyModel.id);

  const study = studyEntityFromModel(studyModel, graph.protocolId);
  if (study) {
    graph = applyKnowledgeGraphPatch(graph, { entities: [study] });
  }

  const entities: KnowledgeEntity[] = [];
  for (const collection of Object.keys(COLLECTION_ENTITY_TYPE) as StudyModelCollectionKey[]) {
    entities.push(...entitiesForCollection(studyModel, collection, graph.protocolId));
  }
  entities.push(...addSectionEntities(studyModel, graph.protocolId));

  if (entities.length > 0) {
    graph = applyKnowledgeGraphPatch(graph, { entities });
  }

  const byType = (type: KnowledgeEntityType) => graph.entities.filter((entity) => entity.entityType === type);
  const objectives = byType('objective');
  const endpoints = byType('endpoint');
  const estimands = byType('estimand');
  const populations = byType('population');
  const arms = byType('arm');
  const interventions = byType('intervention');
  const visits = byType('visit');
  const assessments = byType('assessment');
  const statisticalMethods = byType('statisticalMethod');
  const eligibility = byType('eligibilityCriterion');
  const sections = byType('documentSection');

  if (study) {
    graph = applyKnowledgeGraphPatch(graph, { entities: [study] });
    for (const objective of objectives) {
      graph = addRelationship(graph, {
        sourceEntityId: study.id,
        targetEntityId: objective.id,
        relationshipType: 'has_objective',
        sourceSectionIds: objective.sourceSectionIds,
      });
    }
    for (const population of populations) {
      graph = addRelationship(graph, {
        sourceEntityId: study.id,
        targetEntityId: population.id,
        relationshipType: 'has_population',
        sourceSectionIds: population.sourceSectionIds,
      });
    }
  }

  for (const objective of objectives) {
    for (const endpoint of endpoints) {
      if (mayMeasureBy(objective, endpoint)) {
        graph = addRelationship(graph, {
          sourceEntityId: objective.id,
          targetEntityId: endpoint.id,
          relationshipType: 'measured_by',
          sourceSectionIds: mergeSections(objective.sourceSectionIds, endpoint.sourceSectionIds),
        });
      }
    }
    for (const estimand of estimands) {
      if (objective.sourceSectionIds.some((sectionId) => estimand.sourceSectionIds.includes(sectionId))) {
        graph = addRelationship(graph, {
          sourceEntityId: objective.id,
          targetEntityId: estimand.id,
          relationshipType: 'supports',
          sourceSectionIds: mergeSections(objective.sourceSectionIds, estimand.sourceSectionIds),
        });
      }
    }
  }

  if (objectives.length === 1 && endpoints.length === 1 && !graph.relationships.some((r) => r.relationshipType === 'measured_by')) {
    graph = addRelationship(graph, {
      sourceEntityId: objectives[0].id,
      targetEntityId: endpoints[0].id,
      relationshipType: 'measured_by',
      sourceSectionIds: mergeSections(objectives[0].sourceSectionIds, endpoints[0].sourceSectionIds),
    });
  }

  for (const endpoint of endpoints) {
    for (const population of populations) {
      graph = addRelationship(graph, {
        sourceEntityId: endpoint.id,
        targetEntityId: population.id,
        relationshipType: 'evaluated_in',
        sourceSectionIds: mergeSections(endpoint.sourceSectionIds, population.sourceSectionIds),
      });
    }
  }

  for (let index = 0; index < Math.min(arms.length, interventions.length); index += 1) {
    graph = addRelationship(graph, {
      sourceEntityId: arms[index].id,
      targetEntityId: interventions[index].id,
      relationshipType: 'has_intervention',
      sourceSectionIds: mergeSections(arms[index].sourceSectionIds, interventions[index].sourceSectionIds),
    });
  }

  for (let index = 0; index < Math.min(visits.length, assessments.length); index += 1) {
    graph = addRelationship(graph, {
      sourceEntityId: visits[index].id,
      targetEntityId: assessments[index].id,
      relationshipType: 'has_assessment',
      sourceSectionIds: mergeSections(visits[index].sourceSectionIds, assessments[index].sourceSectionIds),
    });
    graph = addRelationship(graph, {
      sourceEntityId: assessments[index].id,
      targetEntityId: visits[index].id,
      relationshipType: 'scheduled_at',
      sourceSectionIds: mergeSections(assessments[index].sourceSectionIds, visits[index].sourceSectionIds),
    });
  }

  for (const method of statisticalMethods) {
    for (const endpoint of endpoints) {
      if (method.sourceSectionIds.some((sectionId) => endpoint.sourceSectionIds.includes(sectionId))) {
        graph = addRelationship(graph, {
          sourceEntityId: method.id,
          targetEntityId: endpoint.id,
          relationshipType: 'supports',
          sourceSectionIds: mergeSections(method.sourceSectionIds, endpoint.sourceSectionIds),
        });
      }
    }
  }

  for (const criterion of eligibility) {
    for (const population of populations) {
      graph = addRelationship(graph, {
        sourceEntityId: criterion.id,
        targetEntityId: population.id,
        relationshipType: 'belongs_to',
        sourceSectionIds: mergeSections(criterion.sourceSectionIds, population.sourceSectionIds),
      });
    }
  }

  for (const entity of graph.entities) {
    if (entity.entityType === 'documentSection') {
      continue;
    }
    for (const sectionId of entity.sourceSectionIds) {
      const section = sections.find((entry) => entry.metadata.sectionId === sectionId || entry.aliases.includes(sectionId));
      if (section) {
        graph = addRelationship(graph, {
          sourceEntityId: entity.id,
          targetEntityId: section.id,
          relationshipType: 'described_in',
          sourceSectionIds: [sectionId],
        });
      }
    }
  }

  return graph;
}

function mergeSections(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].filter(Boolean))];
}

export { COLLECTION_ENTITY_TYPE };
