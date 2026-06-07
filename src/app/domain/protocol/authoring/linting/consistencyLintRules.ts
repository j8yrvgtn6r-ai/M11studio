import { getKnowledgeGraph } from '../../../knowledge-graph/knowledgeGraphStore';
import { getStudyModel } from '../../../study-model/studyModelStore';
import { searchProtocolEntities } from '../../entities/protocolEntitySelectors';
import type { ProtocolLintContext, ProtocolLintIssue } from './protocolLintTypes';

const ENDPOINT_PATTERN = /\b(primary|secondary|key)?\s*endpoint[s]?\b[^.\n]{0,80}/gi;
const OBJECTIVE_PATTERN = /\b(primary|secondary)?\s*objective[s]?\b[^.\n]{0,120}/gi;
const INTERVENTION_PATTERN = /\binvestigational (?:trial )?intervention[s]?\b|\bstudy drug[s]?\b/gi;

function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

function entityDefined(name: string): boolean {
  const graph = getKnowledgeGraph();
  const studyModel = getStudyModel();
  const normalized = name.toLowerCase().trim();
  if (!normalized || normalized.length < 4) {
    return true;
  }
  const registryMatches = searchProtocolEntities(normalized.slice(0, Math.min(12, normalized.length)), {
    knowledgeGraph: graph,
    studyModel,
    limit: 3,
  });
  if (registryMatches.some((entry) => entry.normalizedName.includes(normalized) || normalized.includes(entry.normalizedName))) {
    return true;
  }
  return graph?.entities.some(
    (entity) =>
      entity.normalizedName.includes(normalized) ||
      entity.name.toLowerCase().includes(normalized) ||
      entity.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
  ) ?? false;
}

export function runConsistencyLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const issues: ProtocolLintIssue[] = [];
  const text = context.plainText;
  const graph = getKnowledgeGraph();

  let match: RegExpExecArray | null;
  const endpointPattern = new RegExp(ENDPOINT_PATTERN.source, ENDPOINT_PATTERN.flags);
  while ((match = endpointPattern.exec(text)) !== null) {
    const phrase = match[0];
    const endpointName = phrase.replace(/\b(primary|secondary|key)\s+endpoint[s]?\s*(?:is|are|of|:)?/gi, '').trim();
    if (endpointName.length >= 6 && !entityDefined(endpointName)) {
      issues.push({
        id: `lint.consistency.endpoint.${match.index}`,
        sectionId: context.sectionId,
        lineNumber: lineNumberFromOffset(text, match.index),
        startOffset: match.index,
        endOffset: match.index + phrase.length,
        severity: 'warning',
        category: 'consistency',
        message: `Endpoint mention "${endpointName}" is not defined in the Knowledge Graph or Study Model.`,
        suggestedFix: endpointName,
        source: 'knowledgeGraph',
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (context.sectionId === '3' && graph) {
    const objectivePattern = new RegExp(OBJECTIVE_PATTERN.source, OBJECTIVE_PATTERN.flags);
    while ((match = objectivePattern.exec(text)) !== null) {
      const hasEndpoint = graph.entities.some((entity) => entity.entityType === 'endpoint');
      if (!hasEndpoint) {
        issues.push({
          id: `lint.consistency.objective-no-endpoint.${match.index}`,
          sectionId: context.sectionId,
          lineNumber: lineNumberFromOffset(text, match.index),
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          severity: 'info',
          category: 'consistency',
          message: 'Objective section mentions objectives but no endpoint is defined in the Knowledge Graph.',
          source: 'knowledgeGraph',
          relatedSectionIds: ['3', '10'],
          createdAt: new Date().toISOString(),
        });
        break;
      }
    }
  }

  const interventionPattern = new RegExp(INTERVENTION_PATTERN.source, INTERVENTION_PATTERN.flags);
  while ((match = interventionPattern.exec(text)) !== null) {
    const defined =
      graph?.entities.some((entity) => entity.entityType === 'intervention') ||
      (getStudyModel()?.interventions.length ?? 0) > 0;
    if (!defined) {
      issues.push({
        id: `lint.consistency.intervention.${match.index}`,
        sectionId: context.sectionId,
        lineNumber: lineNumberFromOffset(text, match.index),
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        severity: 'warning',
        category: 'consistency',
        message: 'Intervention mentioned but no intervention entity exists in the study model.',
        source: 'studyModel',
        relatedSectionIds: ['6'],
        createdAt: new Date().toISOString(),
      });
      break;
    }
  }

  return issues;
}
