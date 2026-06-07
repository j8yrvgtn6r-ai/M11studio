/** Canonical persisted text when a section is marked not applicable per M11 rules. */
export const NOT_APPLICABLE_SECTION_TEXT = 'Not applicable.';

/** Presentation-only strings that must never be auto-persisted as protocol content. */
export const NON_PERSISTED_GUIDANCE_MARKERS = [
  'Start writing this section',
  'Heading only — no text intended here',
] as const;
