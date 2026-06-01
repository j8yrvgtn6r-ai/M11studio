import type { DependencyNode, DependencyEdge } from '../types/dependencyGraph';

export const dependencyNodes: DependencyNode[] = [
  // Objectives
  {
    id: 'obj-1',
    type: 'objective',
    name: 'Primary Objective: Overall Survival',
    status: ['complete'],
    sectionId: '2.1',
    description: 'Evaluate overall survival in patients treated with 177Lu-PSMA-617',
  },
  {
    id: 'obj-2',
    type: 'objective',
    name: 'Secondary Objective: Progression-Free Survival',
    status: ['complete'],
    sectionId: '2.1',
    description: 'Assess progression-free survival as a secondary endpoint',
  },

  // Endpoints
  {
    id: 'ep-1',
    type: 'endpoint',
    name: 'Overall Survival',
    status: ['complete'],
    sectionId: '2.2',
    description: 'Time from randomization to death from any cause',
  },
  {
    id: 'ep-2',
    type: 'endpoint',
    name: 'Progression-Free Survival',
    status: ['complete'],
    sectionId: '2.2',
    description: 'Time from randomization to disease progression or death',
  },
  {
    id: 'ep-3',
    type: 'endpoint',
    name: 'PSA Response Rate',
    status: ['incomplete'],
    sectionId: '2.2',
    description: 'Proportion of patients with ≥50% PSA decline',
  },

  // Assessments
  {
    id: 'assess-1',
    type: 'assessment',
    name: 'Tumor Assessment (CT/MRI)',
    status: ['complete'],
    sectionId: '1.3',
    description: 'Imaging assessment using RECIST 1.1 criteria',
  },
  {
    id: 'assess-2',
    type: 'assessment',
    name: 'PSA Level',
    status: ['complete'],
    sectionId: '1.3',
    description: 'Prostate-specific antigen blood test',
  },
  {
    id: 'assess-3',
    type: 'assessment',
    name: 'Safety Labs',
    status: ['validation-issue'],
    sectionId: '1.3',
    description: 'Hematology and chemistry panels',
  },

  // Visits
  {
    id: 'visit-1',
    type: 'visit',
    name: 'Screening Visit',
    status: ['complete'],
    sectionId: '1.3',
    description: 'Baseline assessments and eligibility confirmation',
  },
  {
    id: 'visit-2',
    type: 'visit',
    name: 'Cycle 1 Day 1',
    status: ['complete'],
    sectionId: '1.3',
    description: 'First treatment administration',
  },
  {
    id: 'visit-3',
    type: 'visit',
    name: 'Follow-up Visits',
    status: ['incomplete', 'ai-recommendation'],
    sectionId: '1.3',
    description: 'Regular monitoring visits every 6 weeks',
  },

  // Statistical Analysis
  {
    id: 'stat-1',
    type: 'statistical-analysis',
    name: 'Primary Analysis: OS',
    status: ['complete'],
    sectionId: '8.1',
    description: 'Kaplan-Meier analysis with log-rank test',
  },
  {
    id: 'stat-2',
    type: 'statistical-analysis',
    name: 'Secondary Analysis: PFS',
    status: ['complete'],
    sectionId: '8.1',
    description: 'Progression-free survival analysis',
  },

  // Study Arms
  {
    id: 'arm-1',
    type: 'study-arm',
    name: '177Lu-PSMA-617 + BSC',
    status: ['complete'],
    sectionId: '3.1',
    description: 'Experimental arm with radiopharmaceutical',
  },
  {
    id: 'arm-2',
    type: 'study-arm',
    name: 'Best Standard Care',
    status: ['complete'],
    sectionId: '3.1',
    description: 'Control arm',
  },

  // Population
  {
    id: 'pop-1',
    type: 'population',
    name: 'Target Population',
    status: ['complete'],
    sectionId: '4.1',
    description: 'mCRPC patients with PSMA-positive disease',
  },

  // Eligibility Criteria
  {
    id: 'elig-1',
    type: 'eligibility',
    name: 'PSMA-positive on PET scan',
    status: ['complete'],
    sectionId: '4.2',
    description: 'Confirmed PSMA expression by imaging',
  },
  {
    id: 'elig-2',
    type: 'eligibility',
    name: 'Progressive mCRPC',
    status: ['complete'],
    sectionId: '4.2',
    description: 'Disease progression despite castration therapy',
  },

  // Biomarker
  {
    id: 'bio-1',
    type: 'biomarker',
    name: 'PSMA Expression',
    status: ['complete'],
    sectionId: '5.1',
    description: 'PSMA-PET scan uptake',
  },

  // Intervention
  {
    id: 'interv-1',
    type: 'intervention',
    name: '177Lu-PSMA-617',
    status: ['complete'],
    sectionId: '6.1',
    description: '7.4 GBq IV every 6 weeks',
  },

  // Safety Assessment
  {
    id: 'safety-1',
    type: 'safety-assessment',
    name: 'Adverse Event Monitoring',
    status: ['recently-modified'],
    sectionId: '7.1',
    description: 'Continuous AE monitoring per CTCAE v5.0',
  },
];

export const dependencyEdges: DependencyEdge[] = [
  // Objective → Endpoint
  { id: 'e1', source: 'obj-1', target: 'ep-1', label: 'defines' },
  { id: 'e2', source: 'obj-2', target: 'ep-2', label: 'defines' },

  // Endpoint → Assessment
  { id: 'e3', source: 'ep-1', target: 'assess-1', label: 'measured by' },
  { id: 'e4', source: 'ep-2', target: 'assess-1', label: 'measured by' },
  { id: 'e5', source: 'ep-3', target: 'assess-2', label: 'measured by' },

  // Assessment → Visit
  { id: 'e6', source: 'assess-1', target: 'visit-1', label: 'performed at' },
  { id: 'e7', source: 'assess-1', target: 'visit-3', label: 'performed at' },
  { id: 'e8', source: 'assess-2', target: 'visit-1', label: 'performed at' },
  { id: 'e9', source: 'assess-2', target: 'visit-2', label: 'performed at' },
  { id: 'e10', source: 'assess-2', target: 'visit-3', label: 'performed at' },
  { id: 'e11', source: 'assess-3', target: 'visit-2', label: 'performed at' },
  { id: 'e12', source: 'assess-3', target: 'visit-3', label: 'performed at' },

  // Endpoint → Statistical Analysis
  { id: 'e13', source: 'ep-1', target: 'stat-1', label: 'analyzed by' },
  { id: 'e14', source: 'ep-2', target: 'stat-2', label: 'analyzed by' },

  // Population → Eligibility
  { id: 'e15', source: 'pop-1', target: 'elig-1', label: 'requires' },
  { id: 'e16', source: 'pop-1', target: 'elig-2', label: 'requires' },

  // Intervention → Study Arm
  { id: 'e17', source: 'interv-1', target: 'arm-1', label: 'assigned to' },

  // Biomarker → Endpoint
  { id: 'e18', source: 'bio-1', target: 'ep-3', label: 'predicts' },
  { id: 'e19', source: 'bio-1', target: 'elig-1', label: 'defines' },

  // Safety Assessment → Visit
  { id: 'e20', source: 'safety-1', target: 'visit-2', label: 'monitored at' },
  { id: 'e21', source: 'safety-1', target: 'visit-3', label: 'monitored at' },
];
