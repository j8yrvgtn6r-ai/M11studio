import type { StudyModelCollectionKey } from '../study-model/studyModelTypes';
import { COLLECTION_ENTITY_TYPE } from './knowledgeGraphBuilder';
import { normalizeKnowledgeName } from './knowledgeGraphPatch';
import type { KnowledgeEntity, KnowledgeEntityType, KnowledgeRelationship } from './knowledgeGraphTypes';

export interface KnowledgeGraphExtractionInput {
  sectionId: string;
  extractedItems: Array<{
    collection: StudyModelCollectionKey | 'studyMetadata';
    name: string;
    description?: string;
  }>;
  protocolId?: string;
}

function slug(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `item_${index}`;
}

function entityTypeForCollection(collection: StudyModelCollectionKey | 'studyMetadata'): KnowledgeEntityType {
  if (collection === 'studyMetadata') {
    return 'study';
  }
  return COLLECTION_ENTITY_TYPE[collection] ?? 'other';
}

export function extractKnowledgeEntitiesFromSection(input: KnowledgeGraphExtractionInput): KnowledgeEntity[] {
  const now = new Date().toISOString();
  const entities: KnowledgeEntity[] = [];

  for (const [index, item] of input.extractedItems.entries()) {
    if (!item.name.trim()) {
      continue;
    }
    const entityType = entityTypeForCollection(item.collection);
    entities.push({
      id: `${entityType}_${slug(item.name, index)}`,
      protocolId: input.protocolId,
      entityType,
      name: item.name.trim(),
      description: item.description?.trim(),
      normalizedName: normalizeKnowledgeName(item.name),
      aliases: [],
      sourceSectionIds: [input.sectionId],
      sourceDocumentIds: [],
      metadata: { collection: item.collection },
      createdAt: now,
      updatedAt: now,
    });
  }

  if (input.sectionId) {
    entities.push({
      id: `section_${slug(input.sectionId, 0)}`,
      protocolId: input.protocolId,
      entityType: 'documentSection',
      name: `Section ${input.sectionId}`,
      normalizedName: normalizeKnowledgeName(input.sectionId),
      aliases: [input.sectionId],
      sourceSectionIds: [input.sectionId],
      sourceDocumentIds: [],
      metadata: { sectionId: input.sectionId },
      createdAt: now,
      updatedAt: now,
    });
  }

  return entities;
}

export function extractKnowledgeRelationshipsFromEntities(
  entities: KnowledgeEntity[],
  sectionId: string,
): KnowledgeRelationship[] {
  const now = new Date().toISOString();
  const relationships: KnowledgeRelationship[] = [];
  const objectives = entities.filter((entity) => entity.entityType === 'objective');
  const endpoints = entities.filter((entity) => entity.entityType === 'endpoint');
  const estimands = entities.filter((entity) => entity.entityType === 'estimand');
  const populations = entities.filter((entity) => entity.entityType === 'population');
  const sections = entities.filter((entity) => entity.entityType === 'documentSection');
  const sectionEntity = sections.find((entity) => entity.metadata.sectionId === sectionId) ?? sections[0];

  const add = (
    sourceEntityId: string,
    targetEntityId: string,
    relationshipType: KnowledgeRelationship['relationshipType'],
  ) => {
    if (!sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId) {
      return;
    }
    relationships.push({
      id: `${relationshipType}_${sourceEntityId}_${targetEntityId}`,
      protocolId: entities[0]?.protocolId,
      sourceEntityId,
      targetEntityId,
      relationshipType,
      sourceSectionIds: [sectionId],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
  };

  for (const objective of objectives) {
    for (const endpoint of endpoints) {
      const objectiveText = `${objective.name} ${objective.description ?? ''}`.toLowerCase();
      const endpointNeedle = endpoint.normalizedName;
      if (endpointNeedle.length >= 3 && objectiveText.includes(endpointNeedle)) {
        add(objective.id, endpoint.id, 'measured_by');
      }
    }
    for (const estimand of estimands) {
      add(objective.id, estimand.id, 'supports');
    }
  }

  if (objectives.length === 1 && endpoints.length === 1 && !relationships.some((rel) => rel.relationshipType === 'measured_by')) {
    add(objectives[0].id, endpoints[0].id, 'measured_by');
  }

  for (const endpoint of endpoints) {
    for (const population of populations) {
      add(endpoint.id, population.id, 'evaluated_in');
    }
  }

  if (sectionEntity) {
    for (const entity of entities) {
      if (entity.entityType === 'documentSection') {
        continue;
      }
      add(entity.id, sectionEntity.id, 'described_in');
    }
  }

  return relationships;
}

export function extractKnowledgeGraphFromSection(input: KnowledgeGraphExtractionInput): {
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRelationships: KnowledgeRelationship[];
} {
  const knowledgeEntities = extractKnowledgeEntitiesFromSection(input);
  const knowledgeRelationships = extractKnowledgeRelationshipsFromEntities(knowledgeEntities, input.sectionId);
  return { knowledgeEntities, knowledgeRelationships };
}
