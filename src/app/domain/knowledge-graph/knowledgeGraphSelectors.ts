import type { KnowledgeEntity, KnowledgeEntityType, KnowledgeGraph, KnowledgeRelationship, KnowledgeRelationshipType } from './knowledgeGraphTypes';

export function selectEntitiesByType(
  graph: KnowledgeGraph | null | undefined,
  entityType: KnowledgeEntityType,
): KnowledgeEntity[] {
  if (!graph) {
    return [];
  }
  return graph.entities.filter((entity) => entity.entityType === entityType);
}

export function selectEntityByNormalizedName(
  graph: KnowledgeGraph | null | undefined,
  entityType: KnowledgeEntityType,
  normalizedName: string,
): KnowledgeEntity | undefined {
  if (!graph) {
    return undefined;
  }
  const needle = normalizedName.toLowerCase().trim();
  return graph.entities.find(
    (entity) => entity.entityType === entityType && entity.normalizedName === needle,
  );
}

export function selectEntityById(
  graph: KnowledgeGraph | null | undefined,
  entityId: string,
): KnowledgeEntity | undefined {
  if (!graph) {
    return undefined;
  }
  return graph.entities.find((entity) => entity.id === entityId);
}

export function selectRelationshipsForEntity(
  graph: KnowledgeGraph | null | undefined,
  entityId: string,
): KnowledgeRelationship[] {
  if (!graph) {
    return [];
  }
  return graph.relationships.filter(
    (relationship) => relationship.sourceEntityId === entityId || relationship.targetEntityId === entityId,
  );
}

export function selectRelationshipsByType(
  graph: KnowledgeGraph | null | undefined,
  relationshipType: KnowledgeRelationshipType,
): KnowledgeRelationship[] {
  if (!graph) {
    return [];
  }
  return graph.relationships.filter((relationship) => relationship.relationshipType === relationshipType);
}

export function selectIncomingRelationships(
  graph: KnowledgeGraph | null | undefined,
  entityId: string,
  relationshipType?: KnowledgeRelationshipType,
): KnowledgeRelationship[] {
  if (!graph) {
    return [];
  }
  return graph.relationships.filter(
    (relationship) =>
      relationship.targetEntityId === entityId &&
      (relationshipType ? relationship.relationshipType === relationshipType : true),
  );
}

export function selectOutgoingRelationships(
  graph: KnowledgeGraph | null | undefined,
  entityId: string,
  relationshipType?: KnowledgeRelationshipType,
): KnowledgeRelationship[] {
  if (!graph) {
    return [];
  }
  return graph.relationships.filter(
    (relationship) =>
      relationship.sourceEntityId === entityId &&
      (relationshipType ? relationship.relationshipType === relationshipType : true),
  );
}

export function selectSectionsReferencingEntity(
  graph: KnowledgeGraph | null | undefined,
  entityId: string,
): string[] {
  const entity = selectEntityById(graph, entityId);
  const fromEntity = entity?.sourceSectionIds ?? [];
  const fromRelationships = selectRelationshipsForEntity(graph, entityId).flatMap(
    (relationship) => relationship.sourceSectionIds,
  );
  return [...new Set([...fromEntity, ...fromRelationships].filter(Boolean))];
}
