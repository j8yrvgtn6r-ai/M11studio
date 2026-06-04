import type { AssessmentScheduleRule, ProtocolDocument, VisitDefinition } from '../../domain/protocol/types';
import type { ProtocolValidationMessage } from '../../domain/protocol/validateProtocol';
import { validateProtocol } from '../../domain/protocol';

export interface VisitValidationEntry {
  errors: ProtocolValidationMessage[];
  warnings: ProtocolValidationMessage[];
}

const VISIT_DEFINITION_PATH = /^visitSchedule\.visitDefinitions\[(\d+)\]/;
const ASSESSMENT_RULE_PATH = /^assessmentScheduleRules\[(\d+)\]/;

function resolveVisitIdFromValidationPath(
  path: string | undefined,
  visitDefinitions: VisitDefinition[],
  rules: AssessmentScheduleRule[],
): string | null {
  if (!path) {
    return null;
  }

  const visitMatch = path.match(VISIT_DEFINITION_PATH);
  if (visitMatch) {
    const index = Number(visitMatch[1]);
    return visitDefinitions[index]?.id ?? null;
  }

  const ruleMatch = path.match(ASSESSMENT_RULE_PATH);
  if (ruleMatch) {
    const index = Number(ruleMatch[1]);
    return rules[index]?.visitDefinitionId ?? null;
  }

  return null;
}

/** Maps validateProtocol messages to visitDefinition ids for badge display. */
export function buildVisitValidationIndex(document: ProtocolDocument): Map<string, VisitValidationEntry> {
  const index = new Map<string, VisitValidationEntry>();
  const visitDefinitions = document.visitSchedule?.visitDefinitions ?? [];
  const rules = document.assessmentScheduleRules ?? [];

  const ensure = (visitId: string): VisitValidationEntry => {
    const existing = index.get(visitId);
    if (existing) {
      return existing;
    }
    const created: VisitValidationEntry = { errors: [], warnings: [] };
    index.set(visitId, created);
    return created;
  };

  const result = validateProtocol(document);

  for (const message of result.errors) {
    const visitId = resolveVisitIdFromValidationPath(message.path, visitDefinitions, rules);
    if (visitId) {
      ensure(visitId).errors.push(message);
    }
  }

  for (const message of result.warnings) {
    const visitId = resolveVisitIdFromValidationPath(message.path, visitDefinitions, rules);
    if (visitId) {
      ensure(visitId).warnings.push(message);
    }
  }

  return index;
}

export function getAnchorValidationMessages(
  document: ProtocolDocument,
  anchorIndex: number,
): { errors: ProtocolValidationMessage[]; warnings: ProtocolValidationMessage[] } {
  const prefix = `visitSchedule.anchors[${anchorIndex}]`;
  const result = validateProtocol(document);
  return {
    errors: result.errors.filter((message) => message.path?.startsWith(prefix)),
    warnings: result.warnings.filter((message) => message.path?.startsWith(prefix)),
  };
}
