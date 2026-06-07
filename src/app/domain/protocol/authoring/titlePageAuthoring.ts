import type { FieldDefinition, ProtocolDocument, ProtocolSection, StatusType } from '../../../types/protocol';
import { TITLE_PAGE_PLACEHOLDERS } from './titlePagePlaceholders';
import {
  isTitlePageFieldVisible,
  normalizeTitlePageFieldValue,
  readTitlePageFieldValues,
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_REQUIRED_FIELD_IDS,
  TITLE_PAGE_SECTION_ID,
  type TitlePageFieldSpec,
} from './titlePageModel';

export {
  TITLE_PAGE_SECTION_ID,
  TITLE_PAGE_REQUIRED_FIELD_IDS,
  TITLE_PAGE_FIELD_CATALOG,
  orderedTitlePageFieldDefinitions,
} from './titlePageModel';

export type TitlePageRequiredFieldId = (typeof TITLE_PAGE_REQUIRED_FIELD_IDS)[number];

export type TitlePageWorkflowBadge =
  | 'Required Missing'
  | 'Draft'
  | 'Pending Validation'
  | 'Validation Proposed'
  | 'Validated'
  | 'Reviewed';

export type TitlePageFieldDisplayBadge = 'Required' | 'Optional' | 'Controlled Terminology' | 'Required Missing';

export interface TitlePageCompletionSummary {
  requiredTotal: number;
  requiredComplete: number;
  missingFieldIds: string[];
  allRequiredComplete: boolean;
  sectionStatus: StatusType;
  displayBadge: TitlePageWorkflowBadge;
}

function fieldHasPlaceholder(fieldId: string, text: string): boolean {
  const placeholder = TITLE_PAGE_PLACEHOLDERS[fieldId as TitlePageRequiredFieldId];
  return Boolean(placeholder && text === placeholder);
}

function isSpecValueComplete(spec: TitlePageFieldSpec, value: unknown): boolean {
  if (spec.repeatable || spec.cardinality === 'one_to_many') {
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    return entries.some((entry) => {
      const text = normalizeTitlePageFieldValue(entry);
      return text.length > 0 && !fieldHasPlaceholder(spec.id, text);
    });
  }
  const text = normalizeTitlePageFieldValue(value);
  return text.length > 0 && !fieldHasPlaceholder(spec.id, text);
}

/** True when a title-page field has a real user value (not blank or placeholder copy). */
export function isTitlePageFieldValueComplete(fieldId: string, value: unknown): boolean {
  const spec = TITLE_PAGE_FIELD_CATALOG.find((entry) => entry.id === fieldId);
  if (!spec) {
    return normalizeTitlePageFieldValue(value).length > 0;
  }
  return isSpecValueComplete(spec, value);
}

export function evaluateTitlePageCompletion(fields: FieldDefinition[]): TitlePageCompletionSummary {
  const titleFields = fields.filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const values = readTitlePageFieldValues(titleFields);
  const missingFieldIds: string[] = [];

  for (const spec of TITLE_PAGE_FIELD_CATALOG) {
    if (spec.conformance !== 'required') {
      continue;
    }
    if (!isTitlePageFieldVisible(spec, values)) {
      continue;
    }
    if (!isSpecValueComplete(spec, values[spec.id])) {
      missingFieldIds.push(spec.id);
    }
  }

  const requiredTotal = TITLE_PAGE_REQUIRED_FIELD_IDS.length;
  const requiredComplete = requiredTotal - missingFieldIds.length;
  const allRequiredComplete = missingFieldIds.length === 0;

  let sectionStatus: StatusType = 'requiredMissing';
  let displayBadge: TitlePageCompletionSummary['displayBadge'] = 'Required Missing';

  if (allRequiredComplete) {
    sectionStatus = 'complete';
    displayBadge = 'Pending Validation';
  } else if (requiredComplete > 0) {
    sectionStatus = 'inProgress';
    displayBadge = 'Draft';
  }

  return {
    requiredTotal,
    requiredComplete,
    missingFieldIds,
    allRequiredComplete,
    sectionStatus,
    displayBadge,
  };
}

function updateSectionStatusInTree(sections: ProtocolSection[], sectionId: string, status: StatusType): boolean {
  for (const section of sections) {
    if (section.id === sectionId) {
      section.status = status;
      return true;
    }
    if (section.children?.length && updateSectionStatusInTree(section.children, sectionId, status)) {
      return true;
    }
  }
  return false;
}

/** Recomputes Title Page section status from current element values. */
export function syncTitlePageSectionStatus(document: ProtocolDocument, fields: FieldDefinition[]): void {
  const summary = evaluateTitlePageCompletion(fields);
  updateSectionStatusInTree(document.sections, TITLE_PAGE_SECTION_ID, summary.sectionStatus);
}

/** Field-level badge labels for Title Page structured controls. */
export function resolveTitlePageFieldDisplayBadges(field: FieldDefinition): TitlePageFieldDisplayBadge[] {
  const badges: TitlePageFieldDisplayBadge[] = [];

  if (field.controlledTerminology) {
    badges.push('Controlled Terminology');
  }

  if (field.requiredness === 'required') {
    badges.push(isTitlePageFieldValueComplete(field.id, field.value) ? 'Required' : 'Required Missing');
  } else if (field.requiredness === 'conditional') {
    badges.push(isTitlePageFieldValueComplete(field.id, field.value) ? 'Required' : 'Required Missing');
  } else if (field.requiredness === 'optional') {
    badges.push('Optional');
  }

  return badges;
}

export function titlePageFieldBadgeClass(badge: TitlePageFieldDisplayBadge): string {
  switch (badge) {
    case 'Required':
    case 'Required Missing':
      return 'text-red-600 dark:text-red-400 border-red-500/30';
    case 'Optional':
      return 'text-muted-foreground border-border';
    case 'Controlled Terminology':
      return 'text-sky-700 dark:text-sky-300 border-sky-500/40';
    default:
      return 'text-muted-foreground border-border';
  }
}

/** Viewport authoring mode label — autosave belongs in the footer, not section workflow badges. */
export function resolveViewportAuthoringModeLabel(options: {
  isTitlePageSection: boolean;
  titlePageMode: 'viewing' | 'editing';
  editorSession: 'viewing' | 'editing';
  showBlankAuthoring: boolean;
  canShowNarrativeSurface: boolean;
  showNarrativeReadOnly: boolean;
}): string {
  if (options.isTitlePageSection) {
    return options.titlePageMode === 'editing' ? 'Editing' : 'Viewing';
  }

  if (options.showBlankAuthoring || options.canShowNarrativeSurface) {
    return options.editorSession === 'editing'
      ? options.showBlankAuthoring
        ? 'Drafting section'
        : 'Editing'
      : 'Viewing';
  }

  if (options.editorSession === 'editing') {
    return 'Editing';
  }

  return options.showNarrativeReadOnly ? 'Viewing' : 'Editing';
}
