export type SoAConfigurationTabId =
  | 'overview'
  | 'arms'
  | 'epochs'
  | 'visits'
  | 'activities'
  | 'elements'
  | 'soa-assessments'
  | 'schedule-rules'
  | 'conditional-logic'
  | 'change-control';

export interface SoAConfigurationTabDefinition {
  id: SoAConfigurationTabId;
  label: string;
  description: string;
  planned?: boolean;
}

export const SOA_CONFIGURATION_TABS: SoAConfigurationTabDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Study-level summary, validation health, and generated schedule status.',
  },
  {
    id: 'arms',
    label: 'Arms',
    description: 'Configure study arms, randomization references, and arm-scoped schedule rules.',
  },
  {
    id: 'epochs',
    label: 'Epochs',
    description: 'Define study epochs and sequencing across the clinical design timeline.',
  },
  {
    id: 'visits',
    label: 'Visits',
    description: 'Author visit definitions, anchors, windows, and display metadata.',
  },
  {
    id: 'activities',
    label: 'Activities',
    description: 'Manage clinical design assessments and performed-at relationships.',
  },
  {
    id: 'elements',
    label: 'Elements',
    description: 'Configure study design elements and epoch mapping.',
  },
  {
    id: 'soa-assessments',
    label: 'SoA Assessments',
    description: 'Edit SoA catalog rows: labels, categories, ordering, and narrative links.',
  },
  {
    id: 'schedule-rules',
    label: 'Schedule Rules',
    description: 'Define assessment schedule rules that drive the generated SoA matrix.',
  },
  {
    id: 'conditional-logic',
    label: 'Conditional Logic',
    description: 'Protocol decision rules, pathway logic, and conditional schedule branches.',
    planned: true,
  },
  {
    id: 'change-control',
    label: 'Change Control',
    description: 'Amendment diffs, version comparison, and export change packages.',
  },
];
