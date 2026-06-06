/**
 * Static M11 Template reference text keyed by Protocol Explorer section id.
 * Reference-only — never written into protocol elements.
 */

import {
  ICH_M11_TEMPLATE_SECTION_13_GUIDANCE,
  ICH_M11_TEMPLATE_SECTION_SPECS,
} from './ichM11Template';
import type { IchM11SectionSpec, IchM11TemplateSectionReference } from './types';

const SOURCE_DOCUMENT = 'ICH M11 Template' as const;

const CHILDREN_BY_PARENT = new Map<string, string[]>();
for (const spec of ICH_M11_TEMPLATE_SECTION_SPECS) {
  if (spec.parentId) {
    const siblings = CHILDREN_BY_PARENT.get(spec.parentId) ?? [];
    siblings.push(spec.id);
    CHILDREN_BY_PARENT.set(spec.parentId, siblings);
  }
}

type ReferenceOverride = Partial<
  Pick<
    IchM11TemplateSectionReference,
    'instructionalText' | 'placeholderPrompts' | 'pageRange' | 'headingOnly' | 'mappingQuality'
  >
>;

/** Explicit template guidance (from CeSHarP template structure and Section 1.3 requirements). */
const REFERENCE_OVERRIDES: Record<string, ReferenceOverride> = {
  '0': {
    pageRange: 'Foreword',
    instructionalText:
      'The Foreword provides template revision history, intended use, conventions, and abbreviations. This material supports protocol authoring but is not part of the finalized protocol body.',
    mappingQuality: 'explicit',
  },
  '0.1': {
    instructionalText: 'Document changes between template versions and the rationale for updates.',
    mappingQuality: 'explicit',
  },
  '0.2': {
    instructionalText:
      'Describe how sponsors should apply the CeSHarP template, including when structured electronic protocols are expected.',
    mappingQuality: 'explicit',
  },
  '0.3': {
    instructionalText:
      'Follow template conventions for headings, data elements, controlled terminology, and repeating subsections marked with <#>.',
    mappingQuality: 'explicit',
  },
  '0.4': {
    instructionalText: 'List abbreviations used within the template document itself (distinct from protocol abbreviations).',
    mappingQuality: 'explicit',
  },
  title: {
    pageRange: 'Title Page',
    instructionalText:
      'Provide full protocol title, protocol identifier, version, date, sponsor, and other required title page fields per the template.',
    placeholderPrompts: ['Protocol full title', 'Protocol number', 'Version and date'],
    mappingQuality: 'explicit',
  },
  amendment: {
    instructionalText:
      'When applicable, describe amendment scope (global or not), affected regions/sites, and summary of changes.',
    placeholderPrompts: ['Amendment number', 'Amendment scope', 'Summary of changes'],
    mappingQuality: 'explicit',
  },
  '1.3': {
    pageRange: 'Section 1.3',
    instructionalText: ICH_M11_TEMPLATE_SECTION_13_GUIDANCE,
    placeholderPrompts: [
      'List each trial visit and participant contact timepoint',
      'Map procedures/tests to visits including eligibility, randomization, and stratification assessments',
      'State allowable visit and procedure windows',
    ],
    mappingQuality: 'explicit',
  },
  '2.2': {
    instructionalText:
      'Summarize known and potential risks of trial interventions and procedures, mitigation strategies, anticipated benefits, and overall risk-benefit conclusion.',
    mappingQuality: 'explicit',
  },
  '3.1.1': {
    placeholderPrompts: ['Primary objective text', 'Associated estimand attributes (population, variable, intercurrent events, summary measure)'],
    mappingQuality: 'explicit',
  },
  '5.2': {
    instructionalText: 'List all inclusion criteria; each criterion should be unambiguous and verifiable at screening.',
    placeholderPrompts: ['Criterion 1', 'Criterion 2'],
    mappingQuality: 'explicit',
  },
  '5.3': {
    instructionalText: 'List all exclusion criteria with clear thresholds and timing (screening vs. randomization).',
    mappingQuality: 'explicit',
  },
  '8.4': {
    pageRange: 'Section 8.4',
    instructionalText:
      'Describe safety assessments and procedures performed during the trial, including examination types, vital signs, ECGs, clinical laboratory testing, pregnancy testing, and suicidal ideation monitoring as applicable.',
    placeholderPrompts: [
      'Physical examination schedule and scope',
      'Vital signs collection timepoints',
      'ECG methodology and timing',
      'Clinical laboratory panels and central/local lab approach',
    ],
    mappingQuality: 'explicit',
  },
  '8.4.3': {
    instructionalText:
      'Specify ECG acquisition method, lead configuration, reader/blinding approach, and schedule of assessments.',
    mappingQuality: 'explicit',
  },
  '10.11': {
    instructionalText:
      'Provide statistical assumptions, effect size, variability estimates, alpha, power, dropout, and resulting sample size with justification.',
    mappingQuality: 'explicit',
  },
};

function hasChildSections(sectionId: string): boolean {
  return (CHILDREN_BY_PARENT.get(sectionId)?.length ?? 0) > 0;
}

function buildScaffoldInstruction(spec: IchM11SectionSpec): string {
  if (spec.sectionType === 'template-instruction') {
    return REFERENCE_OVERRIDES[spec.id]?.instructionalText ?? 'Template instruction — not included in finalized protocol body.';
  }
  if (spec.sectionType === 'appendix') {
    return `Complete appendix content for ${spec.title} per sponsor and regulatory requirements.`;
  }
  if (hasChildSections(spec.id)) {
    return `This heading organizes subsections for ${spec.title}. Author detail in the child subsections below.`;
  }
  return `Author ${spec.title} using the CeSHarP M11 Template structure and sponsor medical writing standards.`;
}

function buildPlaceholderPrompts(spec: IchM11SectionSpec): string[] | undefined {
  if (spec.title.includes('<#>')) {
    return ['Replace <#> with the instance number for this repeating template subsection.'];
  }
  if (spec.sectionType === 'front-matter') {
    return undefined;
  }
  if (hasChildSections(spec.id)) {
    return undefined;
  }
  return [`Enter narrative for ${spec.number} per template guidance.`];
}

function buildReference(spec: IchM11SectionSpec): IchM11TemplateSectionReference {
  const override = REFERENCE_OVERRIDES[spec.id];
  const instructionalOnly = spec.sectionType === 'template-instruction';
  const headingOnly = hasChildSections(spec.id) && !override?.instructionalText?.includes('\n');
  const explicit = override?.mappingQuality === 'explicit';
  const templateGuidance = spec.metadata?.templateGuidance as string | undefined;

  let instructionalText =
    override?.instructionalText ?? templateGuidance ?? (explicit ? undefined : buildScaffoldInstruction(spec));

  let mappingQuality: IchM11TemplateSectionReference['mappingQuality'] =
    override?.mappingQuality ?? (instructionalText ? 'scaffold' : 'unmapped');

  if (!instructionalText && mappingQuality === 'unmapped') {
    instructionalText = undefined;
  }

  if (instructionalText && !override?.mappingQuality) {
    mappingQuality = 'scaffold';
  }

  return {
    sectionId: spec.id,
    sectionNumber: spec.number,
    title: spec.title,
    sourceDocument: SOURCE_DOCUMENT,
    pageRange: override?.pageRange,
    instructionalText,
    placeholderPrompts: override?.placeholderPrompts ?? buildPlaceholderPrompts(spec),
    headingOnly: override?.headingOnly ?? (headingOnly && !instructionalOnly),
    instructionalOnly,
    mappingQuality,
  };
}

const REFERENCE_BY_SECTION_ID = new Map<string, IchM11TemplateSectionReference>(
  ICH_M11_TEMPLATE_SECTION_SPECS.map((spec) => [spec.id, buildReference(spec)]),
);

export function getTemplateSectionReference(sectionId: string | null | undefined): IchM11TemplateSectionReference | null {
  if (!sectionId) {
    return null;
  }
  return REFERENCE_BY_SECTION_ID.get(sectionId) ?? null;
}

export function hasMappedTemplateReference(sectionId: string | null | undefined): boolean {
  const ref = getTemplateSectionReference(sectionId);
  return ref !== null && ref.mappingQuality !== 'unmapped' && Boolean(ref.instructionalText?.trim());
}

export function getTemplateReferenceCopyText(sectionId: string | null | undefined): string {
  const ref = getTemplateSectionReference(sectionId);
  if (!ref?.instructionalText) {
    return '';
  }
  const parts = [ref.instructionalText];
  if (ref.placeholderPrompts?.length) {
    parts.push('', 'Placeholder prompts:', ...ref.placeholderPrompts.map((prompt) => `• ${prompt}`));
  }
  return parts.join('\n');
}

export function listUnmappedTemplateSectionIds(): string[] {
  return [...REFERENCE_BY_SECTION_ID.values()]
    .filter((ref) => ref.mappingQuality === 'unmapped' || !ref.instructionalText?.trim())
    .map((ref) => ref.sectionId);
}

export const ICH_M11_TEMPLATE_SECTION_REFERENCE_COUNT = REFERENCE_BY_SECTION_ID.size;

export function listForewordTemplateReferenceSections(): IchM11TemplateSectionReference[] {
  return ['0', '0.1', '0.2', '0.3', '0.4']
    .map((sectionId) => getTemplateSectionReference(sectionId))
    .filter((ref): ref is IchM11TemplateSectionReference => ref !== null);
}
