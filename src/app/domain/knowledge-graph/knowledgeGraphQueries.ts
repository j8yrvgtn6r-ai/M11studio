import { normalizeKnowledgeName } from './knowledgeGraphPatch';
import {
  selectEntitiesByType,
  selectEntityById,
  selectEntityByNormalizedName,
  selectIncomingRelationships,
  selectOutgoingRelationships,
  selectRelationshipsForEntity,
  selectSectionsReferencingEntity,
} from './knowledgeGraphSelectors';
import { getKnowledgeGraph } from './knowledgeGraphStore';
import type { KnowledgeEntityType, KnowledgeGraphSummary } from './knowledgeGraphTypes';

const EMPTY_SUMMARY: KnowledgeGraphSummary = {
  entityCount: 0,
  relationshipCount: 0,
  entityCountsByType: {},
  updatedAt: null,
  version: 0,
};

let cachedSummary: KnowledgeGraphSummary = EMPTY_SUMMARY;
let cachedVersion = -1;

function buildSummary(): KnowledgeGraphSummary {
  const graph = getKnowledgeGraph();
  if (!graph) {
    cachedSummary = EMPTY_SUMMARY;
    cachedVersion = -1;
    return EMPTY_SUMMARY;
  }
  if (graph.version === cachedVersion) {
    return cachedSummary;
  }
  const entityCountsByType: KnowledgeGraphSummary['entityCountsByType'] = {};
  for (const entity of graph.entities) {
    entityCountsByType[entity.entityType] = (entityCountsByType[entity.entityType] ?? 0) + 1;
  }
  cachedSummary = {
    entityCount: graph.entities.length,
    relationshipCount: graph.relationships.length,
    entityCountsByType,
    updatedAt: graph.updatedAt,
    version: graph.version,
  };
  cachedVersion = graph.version;
  return cachedSummary;
}

export function getKnowledgeEntitiesByType(type: KnowledgeEntityType) {
  return selectEntitiesByType(getKnowledgeGraph(), type);
}

export function findKnowledgeEntityByName(type: KnowledgeEntityType, name: string) {
  return selectEntityByNormalizedName(getKnowledgeGraph(), type, normalizeKnowledgeName(name));
}

export function getRelationshipsForEntity(entityId: string) {
  return selectRelationshipsForEntity(getKnowledgeGraph(), entityId);
}

export function getEntitiesDependingOn(entityId: string) {
  const graph = getKnowledgeGraph();
  const incoming = selectIncomingRelationships(graph, entityId, 'depends_on');
  return incoming
    .map((relationship) => selectEntityById(graph, relationship.sourceEntityId))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
}

export function getEntitiesMeasuredBy(endpointId: string) {
  const graph = getKnowledgeGraph();
  const incoming = selectIncomingRelationships(graph, endpointId, 'measured_by');
  return incoming
    .map((relationship) => selectEntityById(graph, relationship.sourceEntityId))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
}

export function getSectionsReferencingEntity(entityId: string): string[] {
  return selectSectionsReferencingEntity(getKnowledgeGraph(), entityId);
}

export function getAffectedSectionsForEntity(entityId: string): string[] {
  return getSectionsReferencingEntity(entityId);
}

export function getKnowledgeGraphSummary(): KnowledgeGraphSummary {
  return buildSummary();
}

export function getEntitiesRelatedToChangedNames(changedNames: string[]) {
  const graph = getKnowledgeGraph();
  if (!graph || changedNames.length === 0) {
    return [];
  }
  const needles = changedNames.map((name) => normalizeKnowledgeName(name));
  return graph.entities.filter((entity) => {
    if (needles.includes(entity.normalizedName)) {
      return true;
    }
    return entity.aliases.some((alias) => needles.includes(normalizeKnowledgeName(alias)));
  });
}

export function getDownstreamSectionIdsFromGraph(changedNames: string[]): string[] {
  const related = getEntitiesRelatedToChangedNames(changedNames);
  const sectionIds = related.flatMap((entity) => getAffectedSectionsForEntity(entity.id));
  const outgoing = related.flatMap((entity) =>
    selectOutgoingRelationships(getKnowledgeGraph(), entity.id).flatMap((relationship) => {
      const target = selectEntityById(getKnowledgeGraph(), relationship.targetEntityId);
      return target ? getAffectedSectionsForEntity(target.id) : [];
    }),
  );
  return [...new Set([...sectionIds, ...outgoing].filter(Boolean))];
}
