import type {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeGraph,
  KnowledgeGraphPatch,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
} from './knowledgeGraphTypes';

export function normalizeKnowledgeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function coerceKnowledgeEntityType(value: string | undefined): KnowledgeEntityType {
  const allowed: KnowledgeEntityType[] = [
    'study',
    'objective',
    'endpoint',
    'estimand',
    'population',
    'arm',
    'intervention',
    'visit',
    'activity',
    'assessment',
    'procedure',
    'safetyVariable',
    'statisticalMethod',
    'eligibilityCriterion',
    'terminologyTerm',
    'documentSection',
    'sourceDocument',
    'other',
  ];
  if (value && allowed.includes(value as KnowledgeEntityType)) {
    return value as KnowledgeEntityType;
  }
  return 'other';
}

export function coerceKnowledgeRelationshipType(value: string | undefined): KnowledgeRelationshipType {
  const allowed: KnowledgeRelationshipType[] = [
    'depends_on',
    'measured_by',
    'evaluated_in',
    'belongs_to',
    'supports',
    'derived_from',
    'requires',
    'described_in',
    'scheduled_at',
    'uses',
    'has_endpoint',
    'has_objective',
    'has_intervention',
    'has_assessment',
    'has_population',
    'has_statistical_method',
    'related_to',
  ];
  if (value && allowed.includes(value as KnowledgeRelationshipType)) {
    return value as KnowledgeRelationshipType;
  }
  return 'related_to';
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming].filter(Boolean))];
}

function relationshipKey(relationship: Pick<KnowledgeRelationship, 'sourceEntityId' | 'targetEntityId' | 'relationshipType'>): string {
  return `${relationship.sourceEntityId}|${relationship.targetEntityId}|${relationship.relationshipType}`;
}

function mergeEntity(existing: KnowledgeEntity, incoming: KnowledgeEntity): KnowledgeEntity {
  const now = new Date().toISOString();
  return {
    ...existing,
    name: incoming.name.trim() || existing.name,
    description: incoming.description?.trim() || existing.description,
    normalizedName: incoming.normalizedName || existing.normalizedName,
    aliases: mergeStringArrays(existing.aliases, [...incoming.aliases, incoming.name].filter(Boolean)),
    sourceSectionIds: mergeStringArrays(existing.sourceSectionIds, incoming.sourceSectionIds),
    sourceDocumentIds: mergeStringArrays(existing.sourceDocumentIds, incoming.sourceDocumentIds),
    metadata: { ...existing.metadata, ...incoming.metadata },
    protocolId: incoming.protocolId ?? existing.protocolId,
    updatedAt: now,
  };
}

function mergeRelationship(existing: KnowledgeRelationship, incoming: KnowledgeRelationship): KnowledgeRelationship {
  const now = new Date().toISOString();
  return {
    ...existing,
    sourceSectionIds: mergeStringArrays(existing.sourceSectionIds, incoming.sourceSectionIds),
    metadata: { ...existing.metadata, ...incoming.metadata },
    protocolId: incoming.protocolId ?? existing.protocolId,
    updatedAt: now,
  };
}

export function upsertKnowledgeEntity(graph: KnowledgeGraph, incoming: KnowledgeEntity): KnowledgeEntity {
  if (!incoming.name.trim()) {
    return incoming;
  }
  const normalizedName = incoming.normalizedName || normalizeKnowledgeName(incoming.name);
  const matchIndex = graph.entities.findIndex(
    (entity) => entity.entityType === incoming.entityType && entity.normalizedName === normalizedName,
  );
  if (matchIndex >= 0) {
    const merged = mergeEntity(graph.entities[matchIndex], { ...incoming, normalizedName });
    graph.entities[matchIndex] = merged;
    return merged;
  }
  const now = new Date().toISOString();
  const created: KnowledgeEntity = {
    ...incoming,
    name: incoming.name.trim(),
    normalizedName,
    aliases: mergeStringArrays([], incoming.aliases),
    sourceSectionIds: mergeStringArrays([], incoming.sourceSectionIds),
    sourceDocumentIds: mergeStringArrays([], incoming.sourceDocumentIds),
    metadata: incoming.metadata ?? {},
    createdAt: incoming.createdAt || now,
    updatedAt: now,
  };
  graph.entities.push(created);
  return created;
}

export function upsertKnowledgeRelationship(graph: KnowledgeGraph, incoming: KnowledgeRelationship): KnowledgeRelationship {
  const key = relationshipKey(incoming);
  const matchIndex = graph.relationships.findIndex((relationship) => relationshipKey(relationship) === key);
  if (matchIndex >= 0) {
    const merged = mergeRelationship(graph.relationships[matchIndex], incoming);
    graph.relationships[matchIndex] = merged;
    return merged;
  }
  const now = new Date().toISOString();
  const created: KnowledgeRelationship = {
    ...incoming,
    sourceSectionIds: mergeStringArrays([], incoming.sourceSectionIds),
    metadata: incoming.metadata ?? {},
    createdAt: incoming.createdAt || now,
    updatedAt: now,
  };
  graph.relationships.push(created);
  return created;
}

/** Applies a partial patch without replacing unrelated graph data. */
export function applyKnowledgeGraphPatch(
  graph: KnowledgeGraph,
  patch: KnowledgeGraphPatch,
): KnowledgeGraph {
  const next: KnowledgeGraph = {
    ...graph,
    entities: [...graph.entities],
    relationships: [...graph.relationships],
    version: graph.version + 1,
    updatedAt: new Date().toISOString(),
  };

  for (const entity of patch.entities ?? []) {
    if (!entity.name.trim()) {
      continue;
    }
    upsertKnowledgeEntity(next, entity);
  }

  for (const relationship of patch.relationships ?? []) {
    if (!relationship.sourceEntityId || !relationship.targetEntityId) {
      continue;
    }
    upsertKnowledgeRelationship(next, relationship);
  }

  return next;
}

export function createEmptyKnowledgeGraph(protocolId?: string): KnowledgeGraph {
  const now = new Date().toISOString();
  return {
    protocolId,
    entities: [],
    relationships: [],
    updatedAt: now,
    version: 0,
  };
}
