const TITLE_PAGE_PLACEHOLDERS: Record<string, string> = {
  'title_page.full_title': 'Enter the full scientific title of the trial.',
  'title_page.sponsor_protocol_identifier': 'Enter sponsor protocol identifier.',
  'title_page.trial_phase': 'Select trial phase.',
  'title_page.original_protocol_indicator': 'Select whether this is an original protocol.',
};

export function resolveTitlePagePlaceholder(fieldId: string, label: string): string {
  return TITLE_PAGE_PLACEHOLDERS[fieldId] ?? `Enter ${label.toLowerCase()}.`;
}

export function resolveTitlePageSelectPlaceholder(fieldId: string, label: string): string {
  return TITLE_PAGE_PLACEHOLDERS[fieldId] ?? `Select ${label.toLowerCase()}.`;
}
