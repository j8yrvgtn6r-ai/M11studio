import type { RequirednessType } from '../../../types/protocol';
import type { ProtocolDocument, ProtocolElement, Requiredness } from '../types';

export const TITLE_PAGE_SECTION_ID = 'title';

export type TitlePageConformance = RequirednessType;

export type TitlePageVisibilityRule =
  | { type: 'hide_when'; fieldId: string; equals: string | string[] }
  | { type: 'show_when'; fieldId: string; equals: string | string[] };

export interface TitlePageFieldSpec {
  id: string;
  sequence: number;
  label: string;
  conformance: TitlePageConformance;
  cardinality: 'one_to_one' | 'one_to_many';
  repeatable: boolean;
  visibilityRules: TitlePageVisibilityRule[];
  helpText: string;
  sourceTerm: string;
  aliases: string[];
  kind: ProtocolElement['kind'];
  dataType: string;
  controlledTerminologyCodeList?: string;
  validationRuleIds: string[];
}

/** Canonical M11 Title Page element sequence — order must not change. */
export const TITLE_PAGE_FIELD_CATALOG: readonly TitlePageFieldSpec[] = [
  {
    id: 'title_page.sponsor_confidentiality_statement',
    sequence: 1,
    label: 'Sponsor Confidentiality Statement',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Optional sponsor confidentiality language when included on the title page.',
    sourceTerm: '<Sponsor Confidentiality Statement>',
    aliases: ['confidentiality statement', 'confidential', 'proprietary information'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.full_title',
    sequence: 2,
    label: 'Full Title',
    conformance: 'required',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Scientific title identifying trial aspects and population.',
    sourceTerm: '<Full Title>',
    aliases: ['full title', 'protocol title', 'study title', 'title'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['must_not_be_blank'],
  },
  {
    id: 'title_page.trial_acronym',
    sequence: 3,
    label: 'Trial Acronym',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Short acronym or mnemonic for the trial.',
    sourceTerm: '<Trial Acronym>',
    aliases: ['trial acronym', 'acronym', 'study acronym'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.sponsor_protocol_identifier',
    sequence: 4,
    label: 'Sponsor Protocol Identifier',
    conformance: 'required',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Sponsor-assigned protocol identifier.',
    sourceTerm: '<Sponsor Protocol Identifier>',
    aliases: ['protocol number', 'protocol id', 'protocol identifier', 'sponsor protocol id'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['must_have_at_least_one_non_space_character'],
  },
  {
    id: 'title_page.original_protocol_indicator',
    sequence: 5,
    label: 'Original Protocol',
    conformance: 'required',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Indicates whether this document is an original protocol or an amendment.',
    sourceTerm: '[Original Protocol Indicator]',
    aliases: ['original protocol', 'original protocol indicator', 'amendment'],
    kind: 'value',
    dataType: 'valid_value',
    controlledTerminologyCodeList: 'C217046',
    validationRuleIds: ['if_no_then_amendment_fields_required'],
  },
  {
    id: 'title_page.version_number',
    sequence: 6,
    label: 'Version Number',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Protocol version number.',
    sourceTerm: '<Version Number>',
    aliases: ['version number', 'protocol version', 'version'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.version_date',
    sequence: 7,
    label: 'Version Date',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Date associated with the protocol version.',
    sourceTerm: '<Version Date>',
    aliases: ['version date', 'date of version', 'protocol date'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.amendment_identifier',
    sequence: 8,
    label: 'Amendment Identifier',
    conformance: 'conditional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [{ type: 'hide_when', fieldId: 'title_page.original_protocol_indicator', equals: ['Yes', 'C49488'] }],
    helpText: 'Required when the document is not an original protocol.',
    sourceTerm: '<Amendment Identifier>',
    aliases: ['amendment identifier', 'amendment number', 'amendment id'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['required_when_visible'],
  },
  {
    id: 'title_page.amendment_scope',
    sequence: 9,
    label: 'Amendment Scope',
    conformance: 'conditional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [{ type: 'hide_when', fieldId: 'title_page.original_protocol_indicator', equals: ['Yes', 'C49488'] }],
    helpText: 'Scope of the amendment when the document is not an original protocol.',
    sourceTerm: '[Amendment Scope]',
    aliases: ['amendment scope', 'scope of amendment'],
    kind: 'value',
    dataType: 'valid_value',
    controlledTerminologyCodeList: 'C217047',
    validationRuleIds: ['if_not_global_then_scope_identifiers_required'],
  },
  {
    id: 'title_page.sponsor_investigational_product_codes',
    sequence: 10,
    label: 'Sponsor Investigational Product Code(s)',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Sponsor code(s) for investigational product(s).',
    sourceTerm: '<Sponsor Investigational Product Code(s)>',
    aliases: ['investigational product code', 'product code', 'compound code'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.investigational_product_names',
    sequence: 11,
    label: 'Investigational Product Name(s)',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Name(s) of investigational product(s).',
    sourceTerm: '<Investigational Product Name(s)>',
    aliases: ['investigational product name', 'product name', 'study drug'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.trial_phase',
    sequence: 12,
    label: 'Trial Phase',
    conformance: 'required',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Clinical trial phase from ICH M11 controlled terminology.',
    sourceTerm: '[Trial Phase]',
    aliases: ['trial phase', 'phase', 'study phase'],
    kind: 'value',
    dataType: 'valid_value',
    controlledTerminologyCodeList: 'C217045',
    validationRuleIds: ['controlled_terminology_required'],
  },
  {
    id: 'title_page.short_title',
    sequence: 13,
    label: 'Short Title',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Brief title for operational use.',
    sourceTerm: '<Short Title>',
    aliases: ['short title', 'brief title'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.sponsor_name_and_address',
    sequence: 14,
    label: 'Sponsor Name and Address',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Primary sponsor name and address.',
    sourceTerm: '<Sponsor Name and Address>',
    aliases: ['sponsor name', 'sponsor address', 'sponsor'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.co_sponsor_name_and_address',
    sequence: 15,
    label: 'Co-Sponsor Name and Address',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Co-sponsor name and address when applicable.',
    sourceTerm: '<Co-Sponsor Name and Address>',
    aliases: ['co-sponsor', 'cosponsor'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.local_sponsor_name_and_address',
    sequence: 16,
    label: 'Local Sponsor Name and Address',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Local sponsor name and address when applicable.',
    sourceTerm: '<Local Sponsor Name and Address>',
    aliases: ['local sponsor'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.device_manufacturer_name_and_address',
    sequence: 17,
    label: 'Device Manufacturer Name and Address',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Device manufacturer when the trial involves a device.',
    sourceTerm: '<Device Manufacturer Name and Address>',
    aliases: ['device manufacturer', 'manufacturer name and address'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.regulatory_or_clinical_trial_identifiers',
    sequence: 18,
    label: 'Regulatory or Clinical Trial Identifier(s)',
    conformance: 'optional',
    cardinality: 'one_to_many',
    repeatable: true,
    visibilityRules: [],
    helpText: 'Registry or regulatory identifiers (e.g. NCT, EudraCT).',
    sourceTerm: '<Regulatory or Clinical Trial Identifier(s)>',
    aliases: ['nct', 'eudract', 'clinical trial identifier', 'registry identifier'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.sponsor_approval',
    sequence: 19,
    label: 'Sponsor Approval',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Sponsor approval statement or signature block.',
    sourceTerm: '<Sponsor Approval>',
    aliases: ['sponsor approval', 'approved by sponsor'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.sponsor_signatory',
    sequence: 20,
    label: 'Sponsor Signatory',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Name and role of sponsor signatory.',
    sourceTerm: '<Sponsor Signatory>',
    aliases: ['sponsor signatory', 'signatory', 'signed by'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.medical_expert_contact',
    sequence: 21,
    label: 'Medical Expert Contact',
    conformance: 'optional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [],
    helpText: 'Contact details for the medical expert.',
    sourceTerm: '<Medical Expert Contact>',
    aliases: ['medical expert', 'medical contact', 'medical monitor'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: [],
  },
  {
    id: 'title_page.country_identifier',
    sequence: 22,
    label: 'Country Identifier',
    conformance: 'conditional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [
      { type: 'hide_when', fieldId: 'title_page.original_protocol_indicator', equals: ['Yes', 'C49488'] },
      { type: 'hide_when', fieldId: 'title_page.amendment_scope', equals: ['Global', 'C68846', ''] },
    ],
    helpText: 'Country scope identifier when amendment scope is not global.',
    sourceTerm: '<Country Identifier>',
    aliases: ['country identifier', 'country id', 'country code'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['required_when_visible'],
  },
  {
    id: 'title_page.region_identifier',
    sequence: 23,
    label: 'Region Identifier',
    conformance: 'conditional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [
      { type: 'hide_when', fieldId: 'title_page.original_protocol_indicator', equals: ['Yes', 'C49488'] },
      { type: 'hide_when', fieldId: 'title_page.amendment_scope', equals: ['Global', 'C68846', ''] },
    ],
    helpText: 'Region scope identifier when amendment scope is not global.',
    sourceTerm: '<Region Identifier>',
    aliases: ['region identifier', 'region id'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['required_when_visible'],
  },
  {
    id: 'title_page.site_identifier',
    sequence: 24,
    label: 'Site Identifier',
    conformance: 'conditional',
    cardinality: 'one_to_one',
    repeatable: false,
    visibilityRules: [
      { type: 'hide_when', fieldId: 'title_page.original_protocol_indicator', equals: ['Yes', 'C49488'] },
      { type: 'hide_when', fieldId: 'title_page.amendment_scope', equals: ['Global', 'C68846', ''] },
    ],
    helpText: 'Site scope identifier when amendment scope is not global.',
    sourceTerm: '<Site Identifier>',
    aliases: ['site identifier', 'site id', 'site number'],
    kind: 'data',
    dataType: 'text',
    validationRuleIds: ['required_when_visible'],
  },
] as const;

export type TitlePageFieldId = (typeof TITLE_PAGE_FIELD_CATALOG)[number]['id'];

export const TITLE_PAGE_FIELD_SPECS_BY_ID = Object.fromEntries(
  TITLE_PAGE_FIELD_CATALOG.map((spec) => [spec.id, spec]),
) as Record<TitlePageFieldId, TitlePageFieldSpec>;

export const TITLE_PAGE_REQUIRED_FIELD_IDS = TITLE_PAGE_FIELD_CATALOG.filter(
  (spec) => spec.conformance === 'required',
).map((spec) => spec.id);

export interface TitlePageModel {
  sectionId: typeof TITLE_PAGE_SECTION_ID;
  fields: Record<TitlePageFieldId, unknown>;
}

export function normalizeTitlePageFieldValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean).join('; ');
  }
  return String(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function readTitlePageFieldValues(fields: Array<{ id: string; value?: unknown }>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields.filter((entry) => entry.id.startsWith('title_page.'))) {
    values[field.id] = field.value;
  }
  return values;
}

function ruleMatches(value: string, expected: string | string[]): boolean {
  const normalized = value.trim();
  const options = Array.isArray(expected) ? expected : [expected];
  if (!normalized) {
    return options.includes('');
  }
  return options.some((option) => option.toLowerCase() === normalized.toLowerCase());
}

/** Evaluates M11 visibility rules for a title page field. */
export function isTitlePageFieldVisible(
  spec: TitlePageFieldSpec,
  values: Record<string, unknown>,
): boolean {
  for (const rule of spec.visibilityRules) {
    const current = normalizeTitlePageFieldValue(values[rule.fieldId]);
    if (rule.type === 'hide_when' && ruleMatches(current, rule.equals)) {
      return false;
    }
    if (rule.type === 'show_when' && !ruleMatches(current, rule.equals)) {
      return false;
    }
  }
  return true;
}

export function listVisibleTitlePageFieldSpecs(values: Record<string, unknown>): TitlePageFieldSpec[] {
  return TITLE_PAGE_FIELD_CATALOG.filter((spec) => isTitlePageFieldVisible(spec, values));
}

export function titlePageFieldSpecToElement(spec: TitlePageFieldSpec, existingValue?: unknown): ProtocolElement {
  const element: ProtocolElement = {
    id: spec.id,
    sectionId: TITLE_PAGE_SECTION_ID,
    label: spec.label,
    kind: spec.kind,
    dataType: spec.dataType,
    requiredness: spec.conformance as Requiredness,
    cardinality: spec.cardinality,
    repeatable: spec.repeatable,
    validationRuleIds: [...spec.validationRuleIds],
    aiHints: spec.helpText ? [spec.helpText] : [],
    value: existingValue,
  };

  if (spec.controlledTerminologyCodeList) {
    element.controlledTerminology = { codeList: spec.controlledTerminologyCodeList, values: [] };
  }

  return element;
}

export function buildTitlePageModelFromFields(
  fields: Array<{ id: string; value?: unknown }>,
): TitlePageModel {
  const values = readTitlePageFieldValues(fields);
  return {
    sectionId: TITLE_PAGE_SECTION_ID,
    fields: values as Record<TitlePageFieldId, unknown>,
  };
}

export function buildTitlePageModelFromDocument(document: ProtocolDocument): TitlePageModel {
  return buildTitlePageModelFromFields(document.elements);
}

export function orderedTitlePageFieldDefinitions<T extends { id: string }>(fields: T[]): T[] {
  const byId = new Map(fields.map((field) => [field.id, field]));
  return TITLE_PAGE_FIELD_CATALOG.map((spec) => byId.get(spec.id)).filter(Boolean) as T[];
}
