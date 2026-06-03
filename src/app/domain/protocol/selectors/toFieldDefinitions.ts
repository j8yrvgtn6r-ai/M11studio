import type { FieldDefinition } from '../../../types/protocol';
import type { ProtocolDocument, ProtocolElement } from '../types';

function toFieldDefinition(element: ProtocolElement): FieldDefinition {
  const field: FieldDefinition = {
    id: element.id,
    sectionId: element.sectionId,
    label: element.label,
    kind: element.kind,
    dataType: element.dataType,
    requiredness: element.requiredness,
  };

  if (element.cardinality !== undefined) {
    field.cardinality = element.cardinality;
  }

  if (element.repeatable !== undefined) {
    field.repeatable = element.repeatable;
  }

  if (element.reusable !== undefined) {
    field.reusable = element.reusable;
  }

  if (element.controlledTerminology !== undefined) {
    field.controlledTerminology = element.controlledTerminology;
  }

  if (element.validationRuleIds?.length) {
    field.validationRules = [...element.validationRuleIds];
  }

  if (element.aiHints?.length) {
    field.aiHints = [...element.aiHints];
  }

  if (element.value !== undefined) {
    field.value = element.value;
  }

  return field;
}

export function selectFieldDefinitions(document: ProtocolDocument): FieldDefinition[] {
  return document.elements.map(toFieldDefinition);
}
