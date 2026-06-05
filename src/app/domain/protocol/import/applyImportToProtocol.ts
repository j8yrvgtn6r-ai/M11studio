import { mergeProtocolSectionsWithIchM11 } from '../ichM11/mergeProtocolSectionsWithIchM11';
import type { ProtocolDocument } from '../types';
import type { GeneratedSectionDraft } from './types';

const PRESERVED_ELEMENT_SECTION_IDS = new Set(['title', 'amendment']);

/** Clears draft narrative elements before import rewrite (keeps title/amendment and all SoA layers). */
export function clearDraftProtocolContentForImport(document: ProtocolDocument): void {
  document.elements = document.elements.filter((element) =>
    PRESERVED_ELEMENT_SECTION_IDS.has(element.sectionId),
  );
  document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);
}

/** Commits an approved generated section into protocol elements. */
export function applyApprovedSectionDraft(
  document: ProtocolDocument,
  draft: GeneratedSectionDraft,
): void {
  const elementId = `import.${draft.sectionId}.narrative`;
  const existing = document.elements.find((element) => element.id === elementId);

  if (existing) {
    existing.value = draft.generatedText;
  } else {
    document.elements.push({
      id: elementId,
      sectionId: draft.sectionId,
      label: 'Imported section narrative',
      kind: 'data',
      dataType: 'text',
      requiredness: 'required',
      cardinality: 'one_to_one',
      value: draft.generatedText,
    });
  }

  document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);
}
