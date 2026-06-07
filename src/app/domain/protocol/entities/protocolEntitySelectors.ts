import type { KnowledgeGraph } from '../../knowledge-graph/knowledgeGraphTypes';
import {
  selectEntityById,
  selectIncomingRelationships,
  selectOutgoingRelationships,
} from '../../knowledge-graph/knowledgeGraphSelectors';
import { getKnowledgeGraph } from '../../knowledge-graph/knowledgeGraphStore';
import { normalizeKnowledgeName } from '../../knowledge-graph/knowledgeGraphPatch';
import type {
  EntityDiagnostic,
  ProtocolEntity,
  ProtocolEntityHoverInfo,
  ProtocolEntityReference,
  ProtocolEntityRegistry,
  ProtocolEntityType,
} from './protocolEntityTypes';
import { buildProtocolEntityIndex, searchProtocolEntityIndex } from './protocolEntityIndex';
import { getProtocolEntityRegistry } from './protocolEntityRegistry';

const SECTION_ENTITY_PRIORITIES: Record<string, ProtocolEntityType[]> = {
  '3': ['objective', 'endpoint', 'estimand', 'population'],
  '4': ['arm', 'intervention', 'population'],
  '5': ['population', 'intervention'],
  '6': ['intervention', 'protocolAsset'],
  '8': ['assessment', 'procedure', 'visit', 'activity', 'timingWindow'],
  '9': ['safetyVariable', 'assessment'],
  '10': ['endpoint', 'estimand', 'statistic'],
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  has_endpoint: 'Associated endpoint',
  has_objective: 'Associated objective',
  has_assessment: 'Associated assessment',
  has_population: 'Associated population',
  has_statistical_method: 'Associated statistic',
  measured_by: 'Measured by',
  evaluated_in: 'Evaluated in',
  scheduled_at: 'Scheduled at',
  depends_on: 'Depends on',
  related_to: 'Related to',
};

function resolveRegistry(registry?: ProtocolEntityRegistry): ProtocolEntityRegistry {
  return registry ?? getProtocolEntityRegistry({ knowledgeGraph: getKnowledgeGraph() });
}

export function getSectionEntityPriorities(sectionId: string): ProtocolEntityType[] {
  return SECTION_ENTITY_PRIORITIES[sectionId] ?? [];
}

export function selectProtocolEntityById(
  registry: ProtocolEntityRegistry,
  entityId: string,
): ProtocolEntity | null {
  return registry.entities.find((entity) => entity.id === entityId) ?? null;
}

export function findProtocolEntityByName(
  registry: ProtocolEntityRegistry,
  name: string,
  type?: ProtocolEntityType,
): ProtocolEntity | null {
  const normalized = normalizeKnowledgeName(name);
  return (
    registry.entities.find(
      (entity) =>
        (type ? entity.type === type : true) &&
        (entity.normalizedName === normalized ||
          entity.aliases.some((alias) => normalizeKnowledgeName(alias) === normalized)),
    ) ?? null
  );
}

export function searchProtocolEntities(
  query: string,
  options: {
    registry?: ProtocolEntityRegistry;
    sectionId?: string;
    sectionReferences?: ProtocolEntityReference[];
    limit?: number;
  } = {},
): ProtocolEntity[] {
  const registry = resolveRegistry(options.registry);
  const index = buildProtocolEntityIndex(registry);
  const matches = searchProtocolEntityIndex(index, query);
  const referencedIds = new Set((options.sectionReferences ?? []).map((entry) => entry.entityId));
  const priorities = options.sectionId ? getSectionEntityPriorities(options.sectionId) : [];

  return matches
    .map((entity) => {
      let score = 0;
      if (entity.normalizedName.startsWith(query.toLowerCase())) {
        score += 20;
      } else if (entity.normalizedName.includes(query.toLowerCase())) {
        score += 10;
      }
      if (referencedIds.has(entity.id)) {
        score += 25;
      }
      if (options.sectionId && entity.sourceSections.includes(options.sectionId)) {
        score += 18;
      }
      const priorityIndex = priorities.indexOf(entity.type);
      if (priorityIndex >= 0) {
        score += 16 - priorityIndex;
      }
      if (entity.registrySource === 'knowledgeGraph') {
        score += 8;
      }
      return { entity, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 12)
    .map((entry) => entry.entity);
}

export function findNearDuplicateProtocolEntity(
  query: string,
  registry?: ProtocolEntityRegistry,
): ProtocolEntity | null {
  const normalized = normalizeKnowledgeName(query);
  if (normalized.length < 4) {
    return null;
  }
  const resolved = resolveRegistry(registry);
  let best: { entity: ProtocolEntity; score: number } | null = null;
  for (const entity of resolved.entities) {
    if (entity.normalizedName === normalized) {
      continue;
    }
    const distance = normalized.includes(entity.normalizedName) || entity.normalizedName.includes(normalized);
    if (!distance) {
      continue;
    }
    const score = Math.max(entity.normalizedName.length, normalized.length);
    if (!best || score > best.score) {
      best = { entity, score };
    }
  }
  return best?.entity ?? null;
}

export function getRelatedProtocolEntities(
  entityId: string,
  registry?: ProtocolEntityRegistry,
  graph: KnowledgeGraph | null = getKnowledgeGraph(),
): ProtocolEntity[] {
  const resolved = resolveRegistry(registry);
  const entity = selectProtocolEntityById(resolved, entityId);
  if (!entity) {
    return [];
  }

  const relatedIds = new Set<string>(entity.references);
  if (graph) {
    for (const relationship of [
      ...selectOutgoingRelationships(graph, entityId),
      ...selectIncomingRelationships(graph, entityId),
    ]) {
      relatedIds.add(relationship.sourceEntityId);
      relatedIds.add(relationship.targetEntityId);
    }
  }

  relatedIds.delete(entityId);
  return [...relatedIds]
    .map((id) => selectProtocolEntityById(resolved, id))
    .filter((entry): entry is ProtocolEntity => Boolean(entry));
}

export function resolveProtocolEntityHoverInfo(
  token: string,
  options: {
    registry?: ProtocolEntityRegistry;
    sectionId?: string;
    references?: ProtocolEntityReference[];
    graph?: KnowledgeGraph | null;
  } = {},
): ProtocolEntityHoverInfo | null {
  const registry = resolveRegistry(options.registry);
  const graph = options.graph ?? getKnowledgeGraph();
  const reference = (options.references ?? []).find(
    (entry) => entry.displayText.toLowerCase() === token.toLowerCase(),
  );
  const entity =
    (reference ? selectProtocolEntityById(registry, reference.entityId) : null) ??
    findProtocolEntityByName(registry, token);

  if (!entity) {
    return null;
  }

  const relationships: ProtocolEntityHoverInfo['relationships'] = [];
  if (graph) {
    for (const relationship of selectOutgoingRelationships(graph, entity.id)) {
      const target = selectEntityById(graph, relationship.targetEntityId);
      if (target) {
        relationships.push({
          label: RELATIONSHIP_LABELS[relationship.relationshipType] ?? relationship.relationshipType,
          entityName: target.name,
          entityId: target.id,
        });
      }
    }
  }

  const referencedInSections = [...new Set(entity.sourceSections)];
  const usedBySections = [
    ...new Set(
      (options.references ?? [])
        .filter((entry) => entry.entityId === entity.id)
        .map((entry) => entry.sectionId),
    ),
  ];

  const downstreamSectionIds = new Set<string>();
  for (const related of getRelatedProtocolEntities(entity.id, registry, graph)) {
    for (const sectionId of related.sourceSections) {
      downstreamSectionIds.add(sectionId);
    }
  }

  return {
    entity,
    relationships: relationships.slice(0, 6),
    referencedInSections,
    usedBySections,
    downstreamSectionCount: downstreamSectionIds.size,
  };
}

export function buildEntityDiagnostics(input: {
  sectionId: string;
  content: string;
  references: ProtocolEntityReference[];
  registry?: ProtocolEntityRegistry;
  knowledgeGraph?: KnowledgeGraph | null;
}): EntityDiagnostic[] {
  const registry = resolveRegistry(input.registry);
  const diagnostics: EntityDiagnostic[] = [];
  const nameCounts = new Map<string, ProtocolEntity[]>();

  for (const entity of registry.entities) {
    const bucket = nameCounts.get(entity.normalizedName) ?? [];
    bucket.push(entity);
    nameCounts.set(entity.normalizedName, bucket);
  }

  if (input.knowledgeGraph) {
    const graphNameIds = new Map<string, string[]>();
    for (const entity of input.knowledgeGraph.entities) {
      const bucket = graphNameIds.get(entity.normalizedName) ?? [];
      bucket.push(entity.id);
      graphNameIds.set(entity.normalizedName, bucket);
    }
    for (const [name, ids] of graphNameIds.entries()) {
      if (ids.length > 1) {
        diagnostics.push({
          id: `entity-dup-kg-${name}`,
          sectionId: input.sectionId,
          severity: 'warning',
          code: 'duplicate_entity_name',
          message: `Duplicate protocol entity name detected: ${name}`,
          relatedEntityIds: ids,
        });
      }
    }
  }

  for (const [name, entities] of nameCounts.entries()) {
    if (entities.length > 1) {
      diagnostics.push({
        id: `entity-dup-${name}`,
        sectionId: input.sectionId,
        severity: 'warning',
        code: 'duplicate_entity_name',
        message: `Duplicate protocol entity name detected: ${entities[0]?.name}`,
        relatedEntityIds: entities.map((entity) => entity.id),
      });
    }
  }

  for (const entity of registry.entities) {
    for (const alias of entity.aliases) {
      const conflict = findProtocolEntityByName(registry, alias);
      if (conflict && conflict.id !== entity.id && conflict.normalizedName !== normalizeKnowledgeName(alias)) {
        diagnostics.push({
          id: `entity-alias-${entity.id}-${conflict.id}`,
          sectionId: input.sectionId,
          severity: 'warning',
          code: 'conflicting_alias',
          message: `Alias "${alias}" conflicts with entity "${conflict.name}"`,
          entityId: entity.id,
          relatedEntityIds: [conflict.id],
        });
      }
    }
  }

  for (const reference of input.references.filter((entry) => entry.sectionId === input.sectionId)) {
    const entity = selectProtocolEntityById(registry, reference.entityId);
    if (!entity) {
      diagnostics.push({
        id: `entity-orphan-${reference.entityId}-${reference.offset}`,
        sectionId: input.sectionId,
        severity: 'warning',
        code: 'orphaned_reference',
        message: `Orphaned entity reference for "${reference.displayText}"`,
        entityId: reference.entityId,
        startOffset: reference.offset,
        endOffset: reference.endOffset,
      });
      continue;
    }

    const span = input.content.slice(reference.offset, reference.endOffset);
    if (span.toLowerCase() !== reference.displayText.toLowerCase()) {
      diagnostics.push({
        id: `entity-unresolved-${reference.entityId}-${reference.offset}`,
        sectionId: input.sectionId,
        severity: 'info',
        code: 'unresolved_reference',
        message: `Entity reference text changed for "${entity.name}"`,
        entityId: reference.entityId,
        startOffset: reference.offset,
        endOffset: reference.endOffset,
        suggestedFix: entity.name,
      });
    }
  }

  return diagnostics;
}
