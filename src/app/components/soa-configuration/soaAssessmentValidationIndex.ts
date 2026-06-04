import type { AssessmentScheduleRule, ProtocolDocument, SoAAssessmentDefinition } from '../../domain/protocol/types';
import type { ProtocolValidationMessage } from '../../domain/protocol/validateProtocol';
import { validateProtocol } from '../../domain/protocol';

export interface SoAAssessmentValidationEntry {
  errors: ProtocolValidationMessage[];
  warnings: ProtocolValidationMessage[];
}

const SOA_ASSESSMENT_DEFINITION_PATH = /^soaAssessmentDefinitions\[(\d+)\]/;
const ASSESSMENT_RULE_PATH = /^assessmentScheduleRules\[(\d+)\]/;

function resolveAssessmentIdFromValidationPath(
  path: string | undefined,
  definitions: SoAAssessmentDefinition[],
  rules: AssessmentScheduleRule[],
): string | null {
  if (!path) {
    return null;
  }

  const definitionMatch = path.match(SOA_ASSESSMENT_DEFINITION_PATH);
  if (definitionMatch) {
    const index = Number(definitionMatch[1]);
    return definitions[index]?.id ?? null;
  }

  const ruleMatch = path.match(ASSESSMENT_RULE_PATH);
  if (ruleMatch) {
    const index = Number(ruleMatch[1]);
    return rules[index]?.assessmentId ?? null;
  }

  return null;
}

/** Maps validateProtocol messages to SoA assessment definition ids for badge display. */
export function buildSoAAssessmentValidationIndex(
  document: ProtocolDocument,
): Map<string, SoAAssessmentValidationEntry> {
  const index = new Map<string, SoAAssessmentValidationEntry>();
  const definitions = document.soaAssessmentDefinitions ?? [];
  const rules = document.assessmentScheduleRules ?? [];

  const ensure = (assessmentId: string): SoAAssessmentValidationEntry => {
    const existing = index.get(assessmentId);
    if (existing) {
      return existing;
    }
    const created: SoAAssessmentValidationEntry = { errors: [], warnings: [] };
    index.set(assessmentId, created);
    return created;
  };

  const result = validateProtocol(document);

  for (const message of result.errors) {
    const assessmentId = resolveAssessmentIdFromValidationPath(message.path, definitions, rules);
    if (assessmentId) {
      ensure(assessmentId).errors.push(message);
    }
  }

  for (const message of result.warnings) {
    const assessmentId = resolveAssessmentIdFromValidationPath(message.path, definitions, rules);
    if (assessmentId) {
      ensure(assessmentId).warnings.push(message);
    }
  }

  return index;
}
