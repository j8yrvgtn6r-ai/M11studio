import { ensureArray } from '../../../utils/ensureArray';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';

/** Fields on ProtocolKnowledgeModel that must always be arrays at runtime. */
export const PROTOCOL_KNOWLEDGE_ARRAY_FIELDS = [
  'primaryObjectives',
  'secondaryObjectives',
  'exploratoryObjectives',
  'estimands',
  'arms',
  'armDefinitions',
  'interventions',
  'visits',
  'assessments',
  'safetyMonitoring',
  'safetyAssessments',
  'efficacyAssessments',
  'endpoints',
  'objectives',
  'extractionNotes',
] as const satisfies ReadonlyArray<keyof ProtocolKnowledgeModel>;

type ArrayKnowledgeField = (typeof PROTOCOL_KNOWLEDGE_ARRAY_FIELDS)[number];

export function normalizeProtocolKnowledgeModelArrays(
  model: Partial<ProtocolKnowledgeModel>,
): Partial<ProtocolKnowledgeModel> {
  const normalized: Partial<ProtocolKnowledgeModel> = { ...model };

  for (const field of PROTOCOL_KNOWLEDGE_ARRAY_FIELDS) {
    const value = normalized[field as ArrayKnowledgeField];
    if (value !== undefined) {
      (normalized as Record<string, unknown>)[field] = ensureArray<string>(value);
    }
  }

  if (normalized.sourceReferences !== undefined) {
    normalized.sourceReferences = ensureArray(normalized.sourceReferences);
  }

  return normalized;
}

export function mergeKnowledgeArrayField(
  existing: unknown,
  incoming: unknown,
): string[] {
  return [...new Set([...ensureArray<string>(existing), ...ensureArray<string>(incoming)])];
}
