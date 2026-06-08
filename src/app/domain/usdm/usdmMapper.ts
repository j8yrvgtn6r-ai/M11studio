import { getKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument } from '../protocol/store/protocolStore';
import { getProtocolImportState } from '../protocol/import/protocolImportStore';
import { getStudyModel } from '../study-model/studyModelStore';
import { getSoAKnowledge } from '../soa-knowledge/soaKnowledgeStore';
import type { StudyDesign, StudyDesignVisit } from '../study-design/StudyDesignTypes';
import { getStudyDesign } from '../study-design/StudyDesignStore';
import type { UsdmExportContext } from './usdmExportTypes';
import { createUsdmIdFactory, type UsdmIdFactory } from './usdmIdFactory';
import type {
  UsdmActivity,
  UsdmCode,
  UsdmDocument,
  UsdmEncounter,
  UsdmProcedure,
  UsdmScheduledActivityInstance,
  UsdmScheduleTimeline,
  UsdmStudy,
  UsdmStudyDesign,
  UsdmStudyVersion,
  UsdmTiming,
} from './usdmTypes';

function emptyCode(factory: UsdmIdFactory, key: string, decode = ''): UsdmCode {
  return {
    id: factory.idFor('Code', key),
    extensionAttributes: [],
    code: '',
    codeSystem: '',
    codeSystemVersion: '',
    decode,
    instanceType: 'Code',
  };
}

function armTypeCode(factory: UsdmIdFactory, armType: string): UsdmCode {
  return {
    id: factory.idFor('Code', `arm-type-${armType}`),
    extensionAttributes: [],
    code: armType,
    codeSystem: 'M11Studio',
    codeSystemVersion: '1.0',
    decode: armType,
    instanceType: 'Code',
  };
}

function epochTypeCode(factory: UsdmIdFactory, epochName: string): UsdmCode {
  return {
    id: factory.idFor('Code', `epoch-type-${epochName}`),
    extensionAttributes: [],
    code: epochName,
    codeSystem: 'M11Studio',
    codeSystemVersion: '1.0',
    decode: epochName,
    instanceType: 'Code',
  };
}

function formatIsoDurationDays(days: number): string {
  const abs = Math.abs(Math.round(days));
  return days < 0 ? `-P${abs}D` : `P${abs}D`;
}

function visitCenterDay(visit: StudyDesignVisit): number | null {
  if (visit.nominalDay != null) return visit.nominalDay;
  if (visit.nominalWeek != null) return visit.nominalWeek * 7;
  if (visit.offsetDays != null) return visit.offsetDays;
  return null;
}

function buildTimingForVisit(
  visit: StudyDesignVisit,
  factory: UsdmIdFactory,
  timelineId: string,
): UsdmTiming {
  const center = visitCenterDay(visit);
  const value = center != null ? formatIsoDurationDays(center) : 'P0D';
  const before = visit.windowBefore ?? 0;
  const after = visit.windowAfter ?? 0;
  const unitMultiplier = visit.windowUnit === 'weeks' ? 7 : 1;
  const windowLower = before > 0 ? formatIsoDurationDays(before * unitMultiplier) : undefined;
  const windowUpper = after > 0 ? formatIsoDurationDays(after * unitMultiplier) : undefined;

  return {
    id: factory.idFor('Timing', visit.id),
    extensionAttributes: [],
    name: factory.idFor('Timing', visit.id),
    label: visit.shortName ?? visit.name,
    description: visit.referenceTimepoint ?? visit.name,
    type: emptyCode(factory, `timing-type-${visit.id}`, visit.visitClass),
    value,
    valueLabel:
      visit.nominalWeek != null
        ? `Week ${visit.nominalWeek}`
        : visit.nominalDay != null
          ? `Day ${visit.nominalDay}`
          : value,
    relativeToFrom: emptyCode(factory, `timing-relative-${visit.id}`, 'START'),
    relativeFromScheduledInstanceId: null,
    relativeToScheduledInstanceId: null,
    windowLower,
    windowUpper,
    windowLabel:
      before > 0 || after > 0 ? `-${before}/+${after} ${visit.windowUnit ?? 'days'}` : null,
    instanceType: 'Timing',
  };
}

function buildProcedureForActivity(
  activityId: string,
  activityName: string,
  factory: UsdmIdFactory,
): UsdmProcedure {
  return {
    id: factory.idFor('Procedure', activityId),
    extensionAttributes: [],
    name: `${activityName} Procedure`,
    label: activityName,
    description: `Placeholder procedure for ${activityName}`,
    procedureType: 'assessment',
    code: emptyCode(factory, `procedure-code-${activityId}`, activityName),
    studyInterventionId: null,
    notes: [],
    instanceType: 'Procedure',
  };
}

export function buildUsdmExportContext(overrides: Partial<UsdmExportContext> = {}): UsdmExportContext {
  const document = getProtocolDocument();
  const studyModel = getStudyModel();
  const knowledge = getProtocolImportState();
  const graph = getKnowledgeGraph();
  const soa = getSoAKnowledge();

  const sponsorProtocolIdentifier =
    overrides.sponsorProtocolIdentifier ??
    document.elements
      .find((element) => element.id === 'title_page.sponsor_protocol_identifier')
      ?.value?.toString()
      .trim() ??
    studyModel?.protocolIdentifier?.trim();

  const protocolTitle =
    overrides.protocolTitle ??
    document.elements.find((element) => element.id === 'title_page.full_title')?.value?.toString().trim() ??
    studyModel?.title?.trim();

  const trialPhase =
    overrides.trialPhase ??
    document.elements.find((element) => element.id === 'title_page.trial_phase')?.value?.toString().trim() ??
    document.metadata?.phase?.toString().trim() ??
    studyModel?.phase?.trim();

  return {
    protocolTitle,
    sponsorProtocolIdentifier,
    trialPhase,
    studyIdentifiers:
      overrides.studyIdentifiers ??
      (sponsorProtocolIdentifier
        ? [{ text: sponsorProtocolIdentifier, scope: 'Study Sponsor Identifier' }]
        : []),
    knowledgeGraphSummary: overrides.knowledgeGraphSummary ?? {
      entityCount: graph?.entities.length ?? 0,
      relationshipCount: graph?.relationships.length ?? 0,
    },
    soaKnowledgeSummary: overrides.soaKnowledgeSummary ?? {
      visitCount: soa?.visits.length ?? 0,
      assessmentCount: soa?.assessments.length ?? 0,
      activityCount: soa?.activities.length ?? 0,
    },
    seed: overrides.seed ?? document.id ?? sponsorProtocolIdentifier ?? 'm11-studio',
  };
}

export function mapStudyDesignToUsdm(
  studyDesign: StudyDesign | null = getStudyDesign(),
  context: UsdmExportContext = buildUsdmExportContext(),
): UsdmDocument {
  const factory = createUsdmIdFactory(context.seed ?? 'm11-studio');
  const design = studyDesign ?? {
    id: 'study-design-empty',
    protocolId: context.sponsorProtocolIdentifier ?? 'protocol-draft',
    updatedAt: new Date().toISOString(),
    detectionSources: [],
    arms: [],
    cohorts: [],
    epochs: [],
    elements: [],
    anchors: [],
    visits: [],
    activities: [],
    milestones: [],
    scheduleRules: [],
  };

  const studyId = factory.idFor('Study', design.protocolId ?? context.seed);
  const versionId = factory.idFor('StudyVersion', `${design.protocolId}-v1`);
  const studyDesignId = factory.idFor('StudyDesign', design.id);
  const timelineId = factory.idFor('ScheduleTimeline', `${design.id}-main`);

  const activities: UsdmActivity[] = design.activities.map((activity) => {
    const procedure = buildProcedureForActivity(activity.id, activity.name, factory);
    return {
      id: factory.idFor('Activity', activity.id),
      extensionAttributes: [],
      name: activity.name,
      label: activity.name,
      description: activity.description ?? null,
      previousId: null,
      nextId: null,
      childIds: [],
      definedProcedures: [procedure],
      biomedicalConceptIds: [],
      bcCategoryIds: [],
      bcSurrogateIds: [],
      timelineId: null,
      notes: [],
      instanceType: 'Activity',
    };
  });

  const activityIdBySource = new Map(
    design.activities.map((activity) => [activity.id, factory.idFor('Activity', activity.id)]),
  );

  const epochIdBySource = new Map(
    design.epochs.map((epoch) => [epoch.id, factory.idFor('StudyEpoch', epoch.id)]),
  );

  const timings: UsdmTiming[] = design.visits.map((visit) =>
    buildTimingForVisit(visit, factory, timelineId),
  );
  const timingIdByVisit = new Map(
    design.visits.map((visit) => [visit.id, factory.idFor('Timing', visit.id)]),
  );

  const encounters: UsdmEncounter[] = design.visits.map((visit, index) => {
    const encounterId = factory.idFor('Encounter', visit.id);
    const previousVisit = design.visits[index - 1];
    const nextVisit = design.visits[index + 1];
    return {
      id: encounterId,
      extensionAttributes: [],
      name: visit.shortName ?? visit.name,
      label: visit.name,
      description: visit.referenceTimepoint ?? visit.name,
      type: emptyCode(factory, `encounter-type-${visit.id}`, visit.visitClass),
      previousId: previousVisit ? factory.idFor('Encounter', previousVisit.id) : null,
      nextId: nextVisit ? factory.idFor('Encounter', nextVisit.id) : null,
      scheduledAtId: timingIdByVisit.get(visit.id)!,
      environmentalSettings: [],
      contactModes: [emptyCode(factory, `encounter-contact-${visit.id}`, 'site')],
      transitionStartRule: null,
      transitionEndRule: null,
      notes: [],
      instanceType: 'Encounter',
      sourceVisitId: visit.id,
      epochId: visit.epochId ? epochIdBySource.get(visit.epochId) : undefined,
    };
  });

  const encounterIdByVisit = new Map(
    design.visits.map((visit) => [visit.id, factory.idFor('Encounter', visit.id)]),
  );

  const rulesByVisit = new Map<string, string[]>();
  for (const rule of design.scheduleRules) {
    const activityUsdmId = activityIdBySource.get(rule.activityId);
    if (!activityUsdmId) continue;
    rulesByVisit.set(rule.visitId, [...(rulesByVisit.get(rule.visitId) ?? []), activityUsdmId]);
  }

  const instances: UsdmScheduledActivityInstance[] = design.visits.map((visit) => {
    const visitRules = rulesByVisit.get(visit.id) ?? [];
    const fallbackActivities =
      visitRules.length > 0
        ? visitRules
        : design.activities.length > 0
          ? [activityIdBySource.get(design.activities[0]!.id)!].filter(Boolean)
          : [];
    const epochUsdmId =
      (visit.epochId && epochIdBySource.get(visit.epochId)) ||
      (design.epochs[0] ? factory.idFor('StudyEpoch', design.epochs[0].id) : factory.idFor('StudyEpoch', 'default'));

    return {
      id: factory.idFor('ScheduledActivityInstance', visit.id),
      extensionAttributes: [],
      name: `${visit.name} Schedule`,
      label: visit.name,
      description: null,
      defaultConditionId: null,
      epochId: epochUsdmId,
      encounterId: encounterIdByVisit.get(visit.id),
      activityIds: fallbackActivities,
      timingId: timingIdByVisit.get(visit.id),
      timelineId,
      timelineExitId: null,
      instanceType: 'ScheduledActivityInstance',
    };
  });

  const timeline: UsdmScheduleTimeline = {
    id: timelineId,
    extensionAttributes: [],
    name: 'Main Schedule Timeline',
    label: context.protocolTitle ?? 'Study Schedule',
    description: 'Primary schedule timeline derived from Study Design',
    mainTimeline: true,
    entryCondition: null,
    entryId: encounters[0]?.id ?? null,
    exits: [],
    timings,
    instances,
    instanceType: 'ScheduleTimeline',
  };

  const studyDesignExport: UsdmStudyDesign = {
    id: studyDesignId,
    extensionAttributes: [],
    name: context.protocolTitle ?? design.protocolId ?? 'Study Design',
    label: context.sponsorProtocolIdentifier ?? design.protocolId,
    description: 'Study design exported from M11 Studio Study Design model',
    studyType: emptyCode(factory, 'study-type-interventional', 'interventional'),
    studyPhase: context.trialPhase
      ? {
          id: factory.idFor('Code', `phase-${context.trialPhase}`),
          extensionAttributes: [],
          code: context.trialPhase,
          codeSystem: 'M11Studio',
          codeSystemVersion: '1.0',
          decode: context.trialPhase,
          instanceType: 'Code',
        }
      : emptyCode(factory, 'study-phase-empty', ''),
    therapeuticAreas: [],
    characteristics: [],
    encounters,
    activities,
    arms: design.arms.map((arm) => ({
      id: factory.idFor('StudyArm', arm.id),
      extensionAttributes: [],
      name: arm.name,
      label: arm.shortName ?? arm.name,
      description: arm.name,
      type: armTypeCode(factory, String(arm.type)),
      dataOriginDescription: '',
      dataOriginType: emptyCode(factory, `arm-origin-${arm.id}`, 'Collected'),
      populationIds: [],
      notes: [],
      instanceType: 'StudyArm',
    })),
    studyCells: [],
    rationale: '',
    epochs: design.epochs.map((epoch, index) => ({
      id: factory.idFor('StudyEpoch', epoch.id),
      extensionAttributes: [],
      name: epoch.name,
      label: epoch.name,
      description: epoch.name,
      type: epochTypeCode(factory, epoch.name),
      previousId: index > 0 ? factory.idFor('StudyEpoch', design.epochs[index - 1]!.id) : null,
      nextId:
        index < design.epochs.length - 1
          ? factory.idFor('StudyEpoch', design.epochs[index + 1]!.id)
          : null,
      notes: [],
      instanceType: 'StudyEpoch',
    })),
    elements: design.elements.map((element) => ({
      id: factory.idFor('StudyElement', element.id),
      extensionAttributes: [],
      name: element.name,
      label: element.name,
      description: element.name,
      transitionStartRule: null,
      transitionEndRule: null,
      studyInterventionIds: [],
      notes: [],
      instanceType: 'StudyElement',
    })),
    estimands: [],
    indications: [],
    studyInterventionIds: [],
    objectives: [],
    population: {},
    scheduleTimelines: [timeline],
    biospecimenRetentions: [],
    documentVersionIds: [],
    eligibilityCriteria: [],
    analysisPopulations: [],
    notes: [],
    instanceType: 'StudyDesign',
  };

  const version: UsdmStudyVersion = {
    id: versionId,
    extensionAttributes: [],
    versionIdentifier: '1.0',
    rationale: 'Initial export from M11 Studio Study Design',
    documentVersionIds: [],
    dateValues: [],
    amendments: [],
    businessTherapeuticAreas: [],
    studyIdentifiers: (context.studyIdentifiers ?? []).map((identifier, index) => ({
      id: factory.idFor('Code', `study-identifier-${index}`),
      text: identifier.text,
      scope: identifier.scope,
      instanceType: 'StudyIdentifier',
    })),
    referenceIdentifiers: [],
    studyDesigns: [studyDesignExport],
    titles: context.protocolTitle ? [{ text: context.protocolTitle }] : [],
    eligibilityCriterionItems: [],
    narrativeContentItems: [],
    abbreviations: [],
    roles: [],
    organizations: [],
    studyInterventions: [],
    administrableProducts: [],
    medicalDevices: [],
    productOrganizationRoles: [],
    biomedicalConcepts: [],
    bcCategories: [],
    bcSurrogates: [],
    dictionaries: [],
    conditions: [],
    notes: [],
    instanceType: 'StudyVersion',
  };

  const study: UsdmStudy = {
    id: studyId,
    name: context.sponsorProtocolIdentifier ?? context.protocolTitle ?? design.protocolId ?? 'Study',
    description: context.protocolTitle,
    label: context.protocolTitle ?? null,
    versions: [version],
    documentedBy: [],
    instanceType: 'Study',
  };

  return { study };
}
