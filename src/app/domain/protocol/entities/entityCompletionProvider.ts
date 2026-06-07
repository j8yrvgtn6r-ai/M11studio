import type { ProtocolIntellisenseContext, ProtocolIntellisenseKind, ProtocolIntellisenseSuggestion } from '../authoring/intellisense/intellisenseTypes';
import { getTokenRangeAtOffset } from '../authoring/intellisense/textRange';
import { listProtocolEntityReferences } from './protocolEntityReference';
import type { ProtocolEntity, ProtocolEntityType } from './protocolEntityTypes';
import { getProtocolEntityRegistry } from './protocolEntityRegistry';
import {
  findNearDuplicateProtocolEntity,
  getRelatedProtocolEntities,
  getSectionEntityPriorities,
  searchProtocolEntities,
} from './protocolEntitySelectors';

const ENTITY_KIND_MAP: Record<ProtocolEntityType, ProtocolIntellisenseKind> = {
  objective: 'objective',
  endpoint: 'endpoint',
  estimand: 'estimand',
  population: 'population',
  arm: 'arm',
  intervention: 'intervention',
  assessment: 'assessment',
  procedure: 'assessment',
  visit: 'visit',
  activity: 'assessment',
  timingWindow: 'visit',
  safetyVariable: 'assessment',
  statistic: 'endpoint',
  protocolAsset: 'soa',
};

function entityToSuggestion(
  entity: ProtocolEntity,
  context: ProtocolIntellisenseContext,
  score: number,
  detail?: string,
  metadata?: Record<string, string>,
): ProtocolIntellisenseSuggestion {
  const tokenRange = getTokenRangeAtOffset(context.currentText, context.cursorOffset);
  return {
    id: `entity.${entity.id}`,
    label: entity.name,
    insertText: entity.name,
    detail: detail ?? entity.type,
    description: entity.description,
    kind: ENTITY_KIND_MAP[entity.type] ?? 'knowledgeEntity',
    source: 'protocolEntity',
    score,
    replacementRange: tokenRange
      ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset }
      : undefined,
    metadata: {
      entityId: entity.id,
      entityType: entity.type,
      registrySource: entity.registrySource,
      ...metadata,
    },
  };
}

function scoreEntity(entity: ProtocolEntity, context: ProtocolIntellisenseContext, query: string): number {
  let score = 5;
  const references = listProtocolEntityReferences(context.sectionId);
  if (references.some((entry) => entry.entityId === entity.id)) {
    score += 25;
  }
  if (entity.sourceSections.includes(context.sectionId)) {
    score += 18;
  }
  const priorities = getSectionEntityPriorities(context.sectionId);
  const priorityIndex = priorities.indexOf(entity.type);
  if (priorityIndex >= 0) {
    score += 16 - priorityIndex;
  }
  if (entity.registrySource === 'knowledgeGraph') {
    score += 8;
  }
  if (entity.normalizedName.startsWith(query.toLowerCase())) {
    score += 15;
  } else if (entity.normalizedName.includes(query.toLowerCase())) {
    score += 8;
  }
  return score;
}

export function entityCompletionProvider(context: ProtocolIntellisenseContext): ProtocolIntellisenseSuggestion[] {
  const query = (context.explicitQuery ?? context.currentToken).trim();
  if (query.length < 2) {
    return [];
  }

  const registry = getProtocolEntityRegistry({
    knowledgeGraph: context.knowledgeGraph,
    studyModel: context.studyModel,
    soaKnowledge: context.soaKnowledge,
  });
  const tokenRange = getTokenRangeAtOffset(context.currentText, context.cursorOffset);
  const references = listProtocolEntityReferences(context.sectionId);
  const matches = searchProtocolEntities(query, {
    registry,
    sectionId: context.sectionId,
    sectionReferences: references,
    limit: 12,
  });

  const suggestions = matches.map((entity) =>
    entityToSuggestion(entity, context, scoreEntity(entity, context, query)),
  );

  const nearDuplicate = findNearDuplicateProtocolEntity(query, registry);
  if (nearDuplicate && nearDuplicate.normalizedName !== query.toLowerCase()) {
    suggestions.unshift(
      entityToSuggestion(nearDuplicate, context, scoreEntity(nearDuplicate, context, query) + 20, 'Existing protocol entity detected', {
        consistencyAction: 'useExisting',
      }),
    );
    suggestions.push({
      id: `entity.create.${nearDuplicate.id}`,
      label: query,
      insertText: query,
      detail: 'Create new entity',
      description: 'Keep typed wording as a new entity reference',
      kind: 'knowledgeEntity',
      source: 'protocolEntity',
      score: 3,
      replacementRange: tokenRange
        ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset }
        : undefined,
      metadata: {
        consistencyAction: 'createNew',
        nearDuplicateEntityId: nearDuplicate.id,
      },
    });
  }

  return suggestions;
}

export function relatedEntityCompletionProvider(
  context: ProtocolIntellisenseContext,
  sourceEntityId: string,
): ProtocolIntellisenseSuggestion[] {
  const registry = getProtocolEntityRegistry({
    knowledgeGraph: context.knowledgeGraph,
    studyModel: context.studyModel,
    soaKnowledge: context.soaKnowledge,
  });
  const related = getRelatedProtocolEntities(sourceEntityId, registry, context.knowledgeGraph ?? null);
  return related.slice(0, 6).map((entity) =>
    entityToSuggestion(entity, context, scoreEntity(entity, context, context.currentToken) + 12, 'Related entity', {
      relatedToEntityId: sourceEntityId,
    }),
  );
}

export function getRelatedEntitySuggestions(
  sourceEntityId: string,
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseSuggestion[] {
  return relatedEntityCompletionProvider(context, sourceEntityId);
}
