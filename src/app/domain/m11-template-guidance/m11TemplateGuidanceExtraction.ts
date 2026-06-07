import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../protocol/ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../protocol/ichM11/types';
import type { M11SectionGuidance, M11TemplateGuidanceCatalog } from './m11TemplateGuidanceTypes';
import { GUIDANCE_SECTION_OVERRIDES } from './m11TemplateGuidanceCatalog';

const CHILDREN_BY_PARENT = new Map<string, string[]>();
for (const spec of ICH_M11_TEMPLATE_SECTION_SPECS) {
  if (spec.parentId) {
    const siblings = CHILDREN_BY_PARENT.get(spec.parentId) ?? [];
    siblings.push(spec.id);
    CHILDREN_BY_PARENT.set(spec.parentId, siblings);
  }
}

export const GUIDANCE_EXCLUDED_SECTION_IDS = new Set([
  'title',
  'amendment',
  '1.3',
]);

export const GUIDANCE_UI_DEFERRED_SECTION_IDS = new Set(['1.3']);

function hasChildSections(sectionId: string): boolean {
  return (CHILDREN_BY_PARENT.get(sectionId)?.length ?? 0) > 0;
}

function isSoASection(spec: IchM11SectionSpec): boolean {
  return spec.metadata?.viewKind === 'schedule-of-activities' || spec.id === '1.3';
}

function isForewordOrInstruction(spec: IchM11SectionSpec): boolean {
  return spec.sectionType === 'template-instruction' || spec.id === '0' || spec.id.startsWith('0.');
}

function buildScaffoldGuidance(spec: IchM11SectionSpec): Pick<
  M11SectionGuidance,
  | 'guidanceText'
  | 'insertionPrompts'
  | 'controlledTerminologyPrompts'
  | 'optionalityNotes'
  | 'conditionalityNotes'
  | 'notApplicableGuidance'
  | 'tableGuidance'
  | 'headingOnly'
  | 'allowsNotApplicable'
> {
  const parentHasChildren = hasChildSections(spec.id);
  const optional = spec.conformance === 'optional';
  const conditional = spec.conformance === 'conditional';

  if (parentHasChildren && spec.sectionType !== 'front-matter') {
    return {
      headingOnly: true,
      guidanceText: ['No text is intended here (heading only). Author detail in the subsections below.'],
      insertionPrompts: [],
      controlledTerminologyPrompts: [],
      optionalityNotes: optional
        ? ['Optional section — complete if applicable or indicate Not applicable per M11 rules.']
        : [],
      conditionalityNotes: conditional
        ? ['Include this section only when the condition described in the template applies.']
        : [],
      notApplicableGuidance: optional || conditional
        ? 'If this section does not apply, retain the heading and state "Not applicable."'
        : undefined,
      allowsNotApplicable: optional || conditional,
      tableGuidance: undefined,
    };
  }

  if (spec.sectionType === 'appendix') {
    return {
      headingOnly: false,
      guidanceText: [`Provide appendix content for ${spec.title} per sponsor and regulatory requirements.`],
      insertionPrompts: [`Enter narrative for ${spec.number}.`],
      controlledTerminologyPrompts: [],
      optionalityNotes: optional
        ? ['Optional appendix — include only if applicable.']
        : [],
      conditionalityNotes: [],
      notApplicableGuidance: optional ? 'If not applicable, retain the heading and state "Not applicable."' : undefined,
      allowsNotApplicable: optional,
      tableGuidance: undefined,
    };
  }

  return {
    headingOnly: false,
    guidanceText: [`Author ${spec.title} using the ICH M11 Template structure and sponsor medical writing standards.`],
    insertionPrompts: [`Enter narrative for ${spec.number} per template guidance.`],
    controlledTerminologyPrompts: [],
    optionalityNotes: optional
      ? ['Optional section — complete if applicable, otherwise mark Not applicable or omit according to M11 rules.']
      : [],
    conditionalityNotes: conditional
      ? ['Include this section only when the described condition applies to the trial.']
      : [],
    notApplicableGuidance:
      optional || conditional
        ? 'If this section does not apply, retain the heading and state "Not applicable."'
        : undefined,
    allowsNotApplicable: optional || conditional,
    tableGuidance: undefined,
  };
}

function mergeGuidance(spec: IchM11SectionSpec, override?: Partial<M11SectionGuidance>): M11SectionGuidance {
  const scaffold = buildScaffoldGuidance(spec);
  const excluded =
    GUIDANCE_EXCLUDED_SECTION_IDS.has(spec.id) ||
    isSoASection(spec) ||
    isForewordOrInstruction(spec);

  return {
    sectionId: spec.id,
    sectionTitle: spec.title,
    headingOnly: override?.headingOnly ?? scaffold.headingOnly,
    guidanceText: override?.guidanceText ?? scaffold.guidanceText,
    insertionPrompts: override?.insertionPrompts ?? scaffold.insertionPrompts,
    controlledTerminologyPrompts:
      override?.controlledTerminologyPrompts ?? scaffold.controlledTerminologyPrompts,
    optionalityNotes: override?.optionalityNotes ?? scaffold.optionalityNotes,
    conditionalityNotes: override?.conditionalityNotes ?? scaffold.conditionalityNotes,
    notApplicableGuidance: override?.notApplicableGuidance ?? scaffold.notApplicableGuidance,
    tableGuidance: override?.tableGuidance ?? scaffold.tableGuidance,
    sourceReference: override?.sourceReference,
    excludedFromGuidanceUi: excluded,
    optionalSection: spec.conformance === 'optional',
    allowsNotApplicable:
      override?.allowsNotApplicable ??
      (scaffold.allowsNotApplicable ?? (spec.conformance === 'optional' || spec.conformance === 'conditional')),
  };
}

/** Builds the deterministic M11 Template guidance catalog from ICH section specs + overrides. */
export function buildM11TemplateGuidanceCatalog(): M11TemplateGuidanceCatalog {
  const catalog = new Map<string, M11SectionGuidance>();
  for (const spec of ICH_M11_TEMPLATE_SECTION_SPECS) {
    if (isForewordOrInstruction(spec)) {
      continue;
    }
    const override = GUIDANCE_SECTION_OVERRIDES[spec.id];
    catalog.set(spec.id, mergeGuidance(spec, override));
  }
  return catalog;
}

let cachedCatalog: M11TemplateGuidanceCatalog | null = null;

export function getM11TemplateGuidanceCatalog(): M11TemplateGuidanceCatalog {
  if (!cachedCatalog) {
    cachedCatalog = buildM11TemplateGuidanceCatalog();
  }
  return cachedCatalog;
}

export function resetM11TemplateGuidanceCatalogCache(): void {
  cachedCatalog = null;
}
