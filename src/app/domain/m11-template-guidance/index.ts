export type {
  M11SectionGuidance,
  M11SectionGuidanceSourceReference,
  M11TemplateGuidanceCatalog,
} from './m11TemplateGuidanceTypes';

export {
  NOT_APPLICABLE_SECTION_TEXT,
  NON_PERSISTED_GUIDANCE_MARKERS,
} from './m11TemplateGuidanceConstants';

export {
  buildM11TemplateGuidanceCatalog,
  getM11TemplateGuidanceCatalog,
  resetM11TemplateGuidanceCatalogCache,
  GUIDANCE_EXCLUDED_SECTION_IDS,
  GUIDANCE_UI_DEFERRED_SECTION_IDS,
} from './m11TemplateGuidanceExtraction';

export { GUIDANCE_SECTION_OVERRIDES } from './m11TemplateGuidanceCatalog';

export { runM11TemplateGuidanceLintRules } from './m11TemplateGuidanceLintRules';

export {
  allowsMarkNotApplicable,
  getEditorPlaceholderText,
  getGenerationGuidancePayload,
  getNotApplicableInsertText,
  getSectionGuidance,
  guidanceContainsInsertionPrompt,
  isGuidanceExcludedSection,
  isHeadingOnlyWithAuthoredText,
  listMajorSectionGuidanceIds,
  shouldShowHeadingOnlyAuthoring,
  shouldSkipRequiredMissingForEmptySection,
  shouldUseM11TemplateGuidanceLayer,
} from './m11TemplateGuidanceSelectors';