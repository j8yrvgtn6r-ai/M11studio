import type { ProtocolDocument } from '../types';
import {
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_FIELD_SPECS_BY_ID,
  TITLE_PAGE_SECTION_ID,
  titlePageFieldSpecToElement,
} from './titlePageModel';

const LEGACY_AMENDMENT_SCOPE_ID = 'title_page.amendment_scope';

/** Ensures all canonical title page elements exist and migrates legacy values. */
export function migrateTitlePageElements(document: ProtocolDocument): boolean {
  let changed = false;
  const existingById = new Map(document.elements.map((element) => [element.id, element]));

  const legacyAmendmentScope = document.elements.find(
    (element) => element.id === LEGACY_AMENDMENT_SCOPE_ID && element.sectionId !== TITLE_PAGE_SECTION_ID,
  );
  if (legacyAmendmentScope) {
    legacyAmendmentScope.sectionId = TITLE_PAGE_SECTION_ID;
    changed = true;
  }

  const orderedElements = document.elements.filter((element) => !element.id.startsWith('title_page.'));
  const titleElements = TITLE_PAGE_FIELD_CATALOG.map((spec) => {
    const existing = existingById.get(spec.id);
    if (existing) {
      existing.sectionId = TITLE_PAGE_SECTION_ID;
      existing.label = spec.label;
      existing.requiredness = spec.conformance;
      existing.cardinality = spec.cardinality;
      existing.repeatable = spec.repeatable;
      existing.validationRuleIds = [...spec.validationRuleIds];
      if (spec.controlledTerminologyCodeList) {
        existing.controlledTerminology = {
          codeList: spec.controlledTerminologyCodeList,
          values: existing.controlledTerminology?.values ?? [],
        };
      }
      return existing;
    }
    changed = true;
    return titlePageFieldSpecToElement(spec);
  });

  const nextElements = [...titleElements, ...orderedElements];
  if (nextElements.length !== document.elements.length) {
    changed = true;
  }
  document.elements = nextElements;
  return changed;
}

export function hydrateTitlePageFromValues(
  document: ProtocolDocument,
  values: Record<string, unknown>,
): void {
  migrateTitlePageElements(document);
  for (const [fieldId, value] of Object.entries(values)) {
    const spec = TITLE_PAGE_FIELD_SPECS_BY_ID[fieldId as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID];
    if (!spec) {
      continue;
    }
    const element = document.elements.find((entry) => entry.id === fieldId);
    if (element && value !== undefined && value !== null && normalizeIncoming(value) !== '') {
      element.value = value;
    }
  }
}

function normalizeIncoming(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean).join('; ');
  }
  return String(value ?? '').trim();
}
