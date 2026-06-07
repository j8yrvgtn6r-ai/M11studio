import type { ProtocolIntellisenseContext, ProtocolIntellisenseSuggestion } from './intellisenseTypes';

interface GhostTemplate {
  prefix: RegExp;
  build: (context: ProtocolIntellisenseContext) => string | null;
  confidence: number;
}

function firstStudyModelName(
  context: ProtocolIntellisenseContext,
  collection: 'endpoints' | 'objectives' | 'population' | 'assessments',
): string | null {
  const items = context.studyModel?.[collection] ?? [];
  const sectionItems = items.filter((item) => item.sourceSections.includes(context.sectionId));
  return (sectionItems[0] ?? items[0])?.name ?? null;
}

function firstKnowledgeEntityName(context: ProtocolIntellisenseContext, entityType: string): string | null {
  return (
    context.knowledgeGraph?.entities.find(
      (entity) => entity.entityType === entityType && entity.sourceSectionIds.includes(context.sectionId),
    )?.name ??
    context.knowledgeGraph?.entities.find((entity) => entity.entityType === entityType)?.name ??
    null
  );
}

const GHOST_TEMPLATES: GhostTemplate[] = [
  {
    prefix: /^the primary objective of this trial is\s*$/i,
    build: (context) => {
      const endpoint = firstStudyModelName(context, 'endpoints') ?? firstKnowledgeEntityName(context, 'endpoint');
      const population = firstStudyModelName(context, 'population') ?? firstKnowledgeEntityName(context, 'population');
      if (!endpoint && !population) {
        return null;
      }
      return ` to evaluate ${endpoint ?? '[primary endpoint]'} in ${population ?? '[population]'}.`;
    },
    confidence: 0.9,
  },
  {
    prefix: /^the primary endpoint is\s*$/i,
    build: (context) => {
      const endpoint = firstStudyModelName(context, 'endpoints') ?? firstKnowledgeEntityName(context, 'endpoint');
      return endpoint ? ` ${endpoint}.` : null;
    },
    confidence: 0.88,
  },
  {
    prefix: /^participants will be randomized to\s*$/i,
    build: (context) => {
      const arm = context.studyModel?.arms[0]?.name;
      return arm ? ` ${arm} or control.` : null;
    },
    confidence: 0.86,
  },
  {
    prefix: /^the schedule of activities includes\s*$/i,
    build: (context) => {
      const assessment =
        context.studyModel?.assessments.find((item) => item.sourceSections.includes(context.sectionId))?.name ??
        context.soaKnowledge?.assessments[0]?.name;
      return assessment ? ` ${assessment} at each visit.` : null;
    },
    confidence: 0.86,
  },
];

export function ghostTextProvider(context: ProtocolIntellisenseContext): ProtocolIntellisenseSuggestion[] {
  const lineStart = context.currentText.lastIndexOf('\n', Math.max(0, context.cursorOffset - 1)) + 1;
  const linePrefix = context.currentText.slice(lineStart, context.cursorOffset);
  for (const template of GHOST_TEMPLATES) {
    if (!template.prefix.test(linePrefix)) {
      continue;
    }
    const completion = template.build(context);
    if (!completion?.trim()) {
      continue;
    }
    return [
      {
        id: `ghost.${template.prefix.source}`,
        label: completion.trim(),
        insertText: completion,
        detail: 'Ghost completion',
        description: 'High-confidence phrase completion',
        kind: 'ghostText',
        source: 'localHeuristic',
        score: template.confidence,
        metadata: { linePrefix },
      },
    ];
  }
  return [];
}

export function selectGhostTextSuggestion(
  suggestions: ProtocolIntellisenseSuggestion[],
): ProtocolIntellisenseSuggestion | null {
  const ghost = suggestions.find((entry) => entry.kind === 'ghostText');
  if (!ghost || ghost.score < 0.85) {
    return null;
  }
  return ghost;
}
