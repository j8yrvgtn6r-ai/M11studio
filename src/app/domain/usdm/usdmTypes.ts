/** USDM-lite types aligned with OpenStudyBuilder export shape — not full USDM coverage. */

export interface UsdmCode {
  id: string;
  extensionAttributes?: unknown[];
  code: string;
  codeSystem: string;
  codeSystemVersion: string;
  decode: string;
  instanceType: 'Code';
}

export interface UsdmStudyArm {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  type?: UsdmCode;
  dataOriginDescription?: string;
  dataOriginType?: UsdmCode;
  populationIds?: string[];
  notes?: unknown[];
  instanceType: 'StudyArm';
}

export interface UsdmStudyEpoch {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  type?: UsdmCode;
  previousId?: string | null;
  nextId?: string | null;
  notes?: unknown[];
  instanceType: 'StudyEpoch';
}

export interface UsdmStudyElement {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  transitionStartRule?: unknown | null;
  transitionEndRule?: unknown | null;
  studyInterventionIds?: string[];
  notes?: unknown[];
  instanceType: 'StudyElement';
}

export interface UsdmProcedure {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string | null;
  procedureType?: string;
  code?: UsdmCode;
  studyInterventionId?: string | null;
  notes?: unknown[];
  instanceType: 'Procedure';
}

export interface UsdmActivity {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string | null;
  previousId?: string | null;
  nextId?: string | null;
  childIds?: string[];
  definedProcedures: UsdmProcedure[];
  biomedicalConceptIds?: string[];
  bcCategoryIds?: string[];
  bcSurrogateIds?: string[];
  timelineId?: string | null;
  notes?: unknown[];
  instanceType: 'Activity';
}

export interface UsdmTiming {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  type?: UsdmCode;
  value?: string;
  valueLabel?: string;
  relativeToFrom?: UsdmCode;
  relativeFromScheduledInstanceId?: string | null;
  relativeToScheduledInstanceId?: string | null;
  windowLower?: string;
  windowUpper?: string;
  windowLabel?: string | null;
  instanceType: 'Timing';
}

export interface UsdmEncounter {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  type?: UsdmCode;
  previousId?: string | null;
  nextId?: string | null;
  scheduledAtId: string;
  environmentalSettings?: unknown[];
  contactModes?: UsdmCode[];
  transitionStartRule?: unknown | null;
  transitionEndRule?: unknown | null;
  notes?: unknown[];
  instanceType: 'Encounter';
  /** M11 bridge — source study design visit id */
  sourceVisitId?: string;
  /** M11 bridge — source epoch id */
  epochId?: string;
}

export interface UsdmScheduledActivityInstance {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string | null;
  defaultConditionId?: string | null;
  epochId: string;
  encounterId?: string;
  activityIds: string[];
  timingId?: string;
  timelineId: string;
  timelineExitId?: string | null;
  instanceType: 'ScheduledActivityInstance';
}

export interface UsdmScheduleTimeline {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  mainTimeline: boolean;
  entryCondition?: unknown | null;
  entryId?: string | null;
  exits?: unknown[];
  timings: UsdmTiming[];
  instances: UsdmScheduledActivityInstance[];
  instanceType: 'ScheduleTimeline';
}

export interface UsdmStudyDesign {
  id: string;
  extensionAttributes?: unknown[];
  name: string;
  label?: string | null;
  description?: string;
  studyType?: UsdmCode;
  studyPhase?: UsdmCode;
  therapeuticAreas?: unknown[];
  characteristics?: unknown[];
  encounters: UsdmEncounter[];
  activities: UsdmActivity[];
  arms: UsdmStudyArm[];
  studyCells?: unknown[];
  rationale?: string;
  epochs: UsdmStudyEpoch[];
  elements: UsdmStudyElement[];
  estimands?: unknown[];
  indications?: unknown[];
  studyInterventionIds?: string[];
  objectives?: unknown[];
  population?: unknown;
  scheduleTimelines: UsdmScheduleTimeline[];
  biospecimenRetentions?: unknown[];
  documentVersionIds?: string[];
  eligibilityCriteria?: unknown[];
  analysisPopulations?: unknown[];
  notes?: unknown[];
  instanceType: 'StudyDesign';
}

export interface UsdmStudyIdentifier {
  id?: string;
  text: string;
  scope?: string;
  instanceType?: string;
}

export interface UsdmStudyVersion {
  id: string;
  extensionAttributes?: unknown[];
  versionIdentifier: string;
  rationale?: string;
  documentVersionIds?: string[];
  dateValues?: unknown[];
  amendments?: unknown[];
  businessTherapeuticAreas?: unknown[];
  studyIdentifiers: UsdmStudyIdentifier[];
  referenceIdentifiers?: unknown[];
  studyDesigns: UsdmStudyDesign[];
  titles?: unknown[];
  eligibilityCriterionItems?: unknown[];
  narrativeContentItems?: unknown[];
  abbreviations?: unknown[];
  roles?: unknown[];
  organizations?: unknown[];
  studyInterventions?: unknown[];
  administrableProducts?: unknown[];
  medicalDevices?: unknown[];
  productOrganizationRoles?: unknown[];
  biomedicalConcepts?: unknown[];
  bcCategories?: unknown[];
  bcSurrogates?: unknown[];
  dictionaries?: unknown[];
  conditions?: unknown[];
  notes?: unknown[];
  instanceType: 'StudyVersion';
}

export interface UsdmStudy {
  id: string;
  name: string;
  description?: string;
  label?: string | null;
  versions: UsdmStudyVersion[];
  documentedBy?: unknown[];
  instanceType: 'Study';
}

export interface UsdmDocument {
  study: UsdmStudy;
}
