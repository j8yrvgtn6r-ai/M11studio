import type { FieldDefinition, ProtocolDocument, ProtocolSection, StatusType } from '../../../types/protocol';
import { TITLE_PAGE_PLACEHOLDERS } from './titlePagePlaceholders';

export const TITLE_PAGE_SECTION_ID = 'title';

export const TITLE_PAGE_REQUIRED_FIELD_IDS = [
  'title_page.full_title',
  'title_page.sponsor_protocol_identifier',
  'title_page.trial_phase',
  'title_page.original_protocol_indicator',
] as const;

export type TitlePageRequiredFieldId = (typeof TITLE_PAGE_REQUIRED_FIELD_IDS)[number];

export type TitlePageWorkflowBadge =
  | 'Required Missing'
  | 'Draft'
  | 'Pending Validation'
  | 'Validation Proposed'
  | 'Validated'
  | 'Reviewed';

export type TitlePageFieldDisplayBadge = 'Required Missing' | 'Complete' | 'Controlled Terminology';

export interface TitlePageCompletionSummary {
  requiredTotal: number;
  requiredComplete: number;
  missingFieldIds: TitlePageRequiredFieldId[];
  allRequiredComplete: boolean;
  sectionStatus: StatusType;
  displayBadge: TitlePageWorkflowBadge;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** True when a title-page field has a real user value (not blank or placeholder copy). */
export function isTitlePageFieldValueComplete(fieldId: string, value: unknown): boolean {
  const raw = value === undefined || value === null ? '' : String(value);
  const text = fieldId === 'title_page.full_title' ? stripHtml(raw) : raw.trim();
  if (!text) {
    return false;
  }
  const placeholder = TITLE_PAGE_PLACEHOLDERS[fieldId as TitlePageRequiredFieldId];
  if (placeholder && text === placeholder) {
    return false;
  }
  return true;
}

export function evaluateTitlePageCompletion(fields: FieldDefinition[]): TitlePageCompletionSummary {
  const titleFields = fields.filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const missingFieldIds: TitlePageRequiredFieldId[] = [];

  for (const fieldId of TITLE_PAGE_REQUIRED_FIELD_IDS) {
    const field = titleFields.find((entry) => entry.id === fieldId);
    if (!isTitlePageFieldValueComplete(fieldId, field?.value)) {
      missingFieldIds.push(fieldId);
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
  const complete = isTitlePageFieldValueComplete(field.id, field.value);

  if (field.requiredness === 'required') {
    badges.push(complete ? 'Complete' : 'Required Missing');
  }

  if (field.controlledTerminology) {
    badges.push('Controlled Terminology');
  }

  return badges;
}

export function titlePageFieldBadgeClass(badge: TitlePageFieldDisplayBadge): string {
  switch (badge) {
    case 'Required Missing':
      return 'text-red-600 dark:text-red-400 border-red-500/30';
    case 'Complete':
      return 'text-green-700 dark:text-green-300 border-green-600/40';
    case 'Controlled Terminology':
      return 'text-muted-foreground border-border';
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
