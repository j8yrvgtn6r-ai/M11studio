export type SoAConfigurationTabId =
  | 'epochs'
  | 'arms'
  | 'visits'
  | 'activities'
  | 'elements'
  | 'soa-assessments'
  | 'conditional-logic'
  | 'matrix';

export interface SoAConfigurationTabDefinition {
  id: SoAConfigurationTabId;
  label: string;
  description: string;
  planned?: boolean;
}

/** Workflow-oriented horizontal tabs (execution hierarchy order). */
export const SOA_CONFIGURATION_TABS: SoAConfigurationTabDefinition[] = [
  {
    id: 'epochs',
    label: 'Epochs',
    description: 'Define study epochs and sequencing across the clinical design timeline.',
  },
  {
    id: 'arms',
    label: 'Arms',
    description: 'Configure study arms, randomization references, and arm-scoped schedule rules.',
  },
  {
    id: 'visits',
    label: 'Visits',
    description: 'Visit schedule catalog, anchors, and assessment × visit rules.',
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
    label: 'Assessments',
    description: 'Author assessment catalog rows: labels, categories, and ordering.',
  },
  {
    id: 'conditional-logic',
    label: 'Conditional Logic',
    description: 'Protocol decision rules, pathway logic, and conditional schedule branches.',
    planned: true,
  },
  {
    id: 'matrix',
    label: 'Matrix',
    description: 'Read-only projection of the generated Schedule of Activities.',
  },
];

export const CHANGE_CONTROL_PLACEHOLDER = {
  title: 'Change Control',
  description:
    'Amendment diffs, version comparison, and export change packages will live in global protocol workspace chrome (alongside Dependency Graph). This shell button is an interim entry point until promotion is complete.',
};
