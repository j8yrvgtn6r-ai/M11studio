import type { KnowledgeEntity, KnowledgeEntityType } from '../../../knowledge-graph/knowledgeGraphTypes';
import type { ProtocolIntellisenseContext, ProtocolIntellisenseKind, ProtocolIntellisenseSuggestion } from './intellisenseTypes';
import { getTokenRangeAtOffset } from './textRange';

const ENTITY_KIND_MAP: Partial<Record<KnowledgeEntityType, ProtocolIntellisenseKind>> = {
  objective: 'objective',
  endpoint: 'endpoint',
  estimand: 'estimand',
  population: 'population',
  intervention: 'intervention',
  arm: 'arm',
  assessment: 'assessment',
  activity: 'assessment',
  procedure: 'assessment',
  visit: 'visit',
};

function entityMatchesQuery(entity: KnowledgeEntity, query: string): boolean {
  const lower = query.toLowerCase();
  if (entity.name.toLowerCase().includes(lower)) {
    return true;
  }
  if (entity.normalizedName.includes(lower.replace(/\s+/g, ' '))) {
    return true;
  }
  return entity.aliases.some((alias) => alias.toLowerCase().includes(lower));
}

function entityScore(entity: KnowledgeEntity, query: string, sectionId: string): number {
  const lower = query.toLowerCase();
  let score = 5;
  if (entity.name.toLowerCase().startsWith(lower)) {
    score += 15;
  } else if (entity.name.toLowerCase().includes(lower)) {
    score += 8;
  }
  if (entity.sourceSectionIds.includes(sectionId)) {
    score += 10;
  }
  return score;
}

export function knowledgeGraphCompletionProvider(
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseSuggestion[] {
  const graph = context.knowledgeGraph;
  const query = (context.explicitQuery ?? context.currentToken).trim();
  if (!graph || query.length < 2) {
    return [];
  }

  const tokenRange = getTokenRangeAtOffset(context.currentText, context.cursorOffset);
  const suggestions: ProtocolIntellisenseSuggestion[] = [];

  for (const entity of graph.entities) {
    if (!entityMatchesQuery(entity, query)) {
      continue;
    }
    const kind = ENTITY_KIND_MAP[entity.entityType] ?? 'knowledgeEntity';
    suggestions.push({
      id: `kg.${entity.id}`,
      label: entity.name,
      insertText: entity.name,
      detail: entity.entityType,
      description: entity.description,
      kind,
      source: 'knowledgeGraph',
      score: entityScore(entity, query, context.sectionId),
      replacementRange: tokenRange
        ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset }
        : undefined,
      metadata: {
        entityId: entity.id,
        entityType: entity.entityType,
        sourceSections: entity.sourceSectionIds.join(', '),
      },
    });
  }

  return suggestions.slice(0, 12);
}
