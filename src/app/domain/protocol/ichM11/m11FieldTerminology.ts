/**
 * Maps protocol field elements to M11 controlled terminology for dropdown enrichment.
 */

import { getM11CodelistDropdownValues } from './ichM11ControlledTerminology';
import type { ControlledTerminologyRef } from '../types';

const FIELD_CODELIST_IDS: Record<string, string> = {
  'title_page.trial_phase': 'C217045',
  'title_page.original_protocol_indicator': 'C217046',
  'title_page.amendment_scope': 'C217047',
  'title_page.original_protocol': 'C217046',
};

/** Returns M11 terminology-backed values when the field has a known codelist binding. */
export function resolveM11ControlledTerminologyForField(
  elementId: string,
  existing?: ControlledTerminologyRef,
): ControlledTerminologyRef | undefined {
  const codeList = existing?.codeList ?? FIELD_CODELIST_IDS[elementId];
  if (!codeList) {
    return existing;
  }

  const values = getM11CodelistDropdownValues(codeList);
  if (values.length === 0) {
    return existing;
  }

  // Trial phase dropdown historically uses ICH preferred term strings.
  if (elementId === 'title_page.trial_phase') {
    return {
      codeList,
      values: values.map((entry) =>
        typeof entry === 'string' ? entry : entry.label,
      ),
    };
  }

  return {
    codeList,
    values,
  };
}
