export interface StudyModelItem {
  id: string;
  name: string;
  description?: string;
  sourceSections: string[];
  lastUpdated: string;
}

export interface StudyMetadata {
  title?: string;
  shortTitle?: string;
  sponsor?: string;
  protocolIdentifier?: string;
  version?: string;
  phase?: string;
  indication?: string;
}

export interface StudyModel {
  id: string;
  sourceUploadId: string;
  builtAt: string;
  studyMetadata: StudyMetadata;
  population: StudyModelItem[];
  arms: StudyModelItem[];
  epochs: StudyModelItem[];
  elements: StudyModelItem[];
  visits: StudyModelItem[];
  activities: StudyModelItem[];
  assessments: StudyModelItem[];
  objectives: StudyModelItem[];
  estimands: StudyModelItem[];
  endpoints: StudyModelItem[];
  interventions: StudyModelItem[];
  eligibility: StudyModelItem[];
  randomization: StudyModelItem[];
  blinding: StudyModelItem[];
  procedures: StudyModelItem[];
  safetyMonitoring: StudyModelItem[];
  statisticalMethods: StudyModelItem[];
  references: StudyModelItem[];
}

export type StudyModelDependencyKind =
  | 'defines'
  | 'informs'
  | 'measured-by'
  | 'performed-at'
  | 'applies-to';

export interface StudyModelDependency {
  id: string;
  kind: StudyModelDependencyKind;
  studyModelItemId: string;
  protocolSectionId: string;
  dependencyGraphNodeId?: string;
  label?: string;
}

export type StudyModelCollectionKey = keyof Omit<
  StudyModel,
  'id' | 'sourceUploadId' | 'builtAt' | 'studyMetadata'
>;
