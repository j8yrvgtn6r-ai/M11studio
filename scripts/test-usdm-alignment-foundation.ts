import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addManualStudyDesignEntity,
  getStudyDesign,
  resetStudyDesignForTests,
  setStudyDesign,
} from '../src/app/domain/study-design';
import { inspectUsdmAlignmentGaps } from '../src/app/agents/usdmAlignmentRules';
import {
  buildUsdmExport,
  createUsdmIdFactory,
  evaluateUsdmExportReadiness,
  mapStudyDesignToUsdm,
  resetUsdmExportStoreForTests,
  summarizeUsdmReference,
  validateUsdmExport,
} from '../src/app/domain/usdm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_FIXTURE = join(__dirname, '../fixtures/usdm/Study_000003_USDM.json');

function provenance() {
  const timestamp = new Date().toISOString();
  return { source: 'manualEntry' as const, createdAt: timestamp, updatedAt: timestamp };
}

function seedCompleteStudyDesign() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Screening' });
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const screeningEpochId = getStudyDesign()!.epochs.find((epoch) => epoch.name === 'Screening')!.id;
  const treatmentEpochId = getStudyDesign()!.epochs.find((epoch) => epoch.name === 'Treatment')!.id;

  addManualStudyDesignEntity('arm', { name: 'Drug A', type: 'treatment' });
  addManualStudyDesignEntity('visit', {
    name: 'Baseline',
    visitClass: 'scheduled',
    epochId: screeningEpochId,
    nominalDay: 1,
    windowBefore: 3,
    windowAfter: 3,
  });
  addManualStudyDesignEntity('visit', {
    name: 'Week 4',
    visitClass: 'scheduled',
    epochId: treatmentEpochId,
    nominalWeek: 4,
    windowBefore: 3,
    windowAfter: 3,
  });
  addManualStudyDesignEntity('activity', { name: 'Vital Signs', activityType: 'assessment' });
  addManualStudyDesignEntity('activity', { name: 'ECG', activityType: 'assessment' });

  const design = getStudyDesign()!;
  design.elements.push({
    id: 'element-main',
    name: 'Main Element',
    epochId: treatmentEpochId,
    provenance: provenance(),
  });

  const baselineVisit = design.visits.find((visit) => /baseline/i.test(visit.name))!;
  const weekVisit = design.visits.find((visit) => /week 4/i.test(visit.name))!;
  const vitalActivity = design.activities.find((activity) => /vital/i.test(activity.name))!;
  const ecgActivity = design.activities.find((activity) => /ecg/i.test(activity.name))!;

  design.scheduleRules.push(
    {
      id: 'rule-vitals-baseline',
      visitId: baselineVisit.id,
      activityId: vitalActivity.id,
      required: true,
      provenance: provenance(),
    },
    {
      id: 'rule-ecg-week4',
      visitId: weekVisit.id,
      activityId: ecgActivity.id,
      required: true,
      provenance: provenance(),
    },
  );
  setStudyDesign(design);
}

function getContext() {
  return {
    protocolTitle: 'Test Protocol',
    sponsorProtocolIdentifier: 'PROTO-TEST-001',
    trialPhase: 'Phase 2',
    studyIdentifiers: [{ text: 'PROTO-TEST-001', scope: 'Study Sponsor Identifier' }],
    seed: 'usdm-test-seed',
  };
}

function testMapsArmsEpochsVisitsActivities() {
  seedCompleteStudyDesign();
  const document = mapStudyDesignToUsdm(getStudyDesign(), getContext());
  const design = document.study.versions[0]!.studyDesigns[0]!;

  assert.equal(design.arms.length, 1);
  assert.equal(design.arms[0]!.instanceType, 'StudyArm');
  assert.equal(design.epochs.length, 2);
  assert.equal(design.epochs[0]!.instanceType, 'StudyEpoch');
  assert.equal(design.elements.length, 1);
  assert.equal(design.elements[0]!.instanceType, 'StudyElement');
  assert.equal(design.encounters.length, 2);
  assert.equal(design.encounters[0]!.instanceType, 'Encounter');
  assert.equal(design.activities.length, 2);
  assert.equal(design.activities[0]!.instanceType, 'Activity');
  assert.ok(design.activities.every((activity) => activity.definedProcedures.length > 0));
}

function testMapsScheduleRulesAndTimeline() {
  seedCompleteStudyDesign();
  const document = mapStudyDesignToUsdm(getStudyDesign(), getContext());
  const design = document.study.versions[0]!.studyDesigns[0]!;
  const timeline = design.scheduleTimelines[0]!;

  assert.equal(timeline.instanceType, 'ScheduleTimeline');
  assert.equal(timeline.mainTimeline, true);
  assert.equal(timeline.timings.length, 2);
  assert.equal(timeline.instances.length, 2);
  assert.equal(timeline.instances[0]!.instanceType, 'ScheduledActivityInstance');
  assert.ok(timeline.instances.every((instance) => instance.activityIds.length > 0));
  assert.ok(timeline.instances.every((instance) => instance.encounterId));
}

function testCreatesTimingForVisits() {
  seedCompleteStudyDesign();
  const document = mapStudyDesignToUsdm(getStudyDesign(), getContext());
  const design = document.study.versions[0]!.studyDesigns[0]!;
  const encounter = design.encounters[0]!;
  const timing = design.scheduleTimelines[0]!.timings.find((item) => item.id === encounter.scheduledAtId);

  assert.ok(timing);
  assert.equal(timing!.instanceType, 'Timing');
  assert.ok(timing!.value?.startsWith('P'));
}

function testStableIdsRemainStable() {
  seedCompleteStudyDesign();
  const design = getStudyDesign()!;
  const first = mapStudyDesignToUsdm(design, getContext());
  const second = mapStudyDesignToUsdm(design, getContext());

  const firstDesign = first.study.versions[0]!.studyDesigns[0]!;
  const secondDesign = second.study.versions[0]!.studyDesigns[0]!;

  assert.equal(firstDesign.arms[0]!.id, secondDesign.arms[0]!.id);
  assert.equal(firstDesign.encounters[0]!.id, secondDesign.encounters[0]!.id);
  assert.equal(firstDesign.activities[0]!.id, secondDesign.activities[0]!.id);
  assert.equal(firstDesign.scheduleTimelines[0]!.id, secondDesign.scheduleTimelines[0]!.id);

  const factory = createUsdmIdFactory('seed');
  assert.equal(factory.idFor('StudyArm', 'arm-abc'), factory.idFor('StudyArm', 'arm-abc'));
}

function testValidationCatchesMissingEncounterTiming() {
  seedCompleteStudyDesign();
  const document = mapStudyDesignToUsdm(getStudyDesign(), getContext());
  document.study.versions[0]!.studyDesigns[0]!.encounters[0]!.scheduledAtId = 'MissingTiming_1';

  const validation = validateUsdmExport(document);
  assert.ok(validation.errors.some((issue) => /missing timing/i.test(issue.message)));
}

function testValidationCatchesDuplicateIds() {
  seedCompleteStudyDesign();
  const document = mapStudyDesignToUsdm(getStudyDesign(), getContext());
  const design = document.study.versions[0]!.studyDesigns[0]!;
  design.activities[1]!.id = design.activities[0]!.id;

  const validation = validateUsdmExport(document);
  assert.ok(validation.errors.some((issue) => issue.code === 'duplicate_id'));
}

function testExportReadinessStates() {
  resetStudyDesignForTests();
  resetUsdmExportStoreForTests();

  const notReady = evaluateUsdmExportReadiness(null, getContext());
  assert.equal(notReady.state, 'notReady');

  seedCompleteStudyDesign();
  const ready = evaluateUsdmExportReadiness(getStudyDesign(), getContext());
  assert.ok(['ready', 'readyWithWarnings'].includes(ready.state));

  const withWarnings = evaluateUsdmExportReadiness(getStudyDesign(), {
    ...getContext(),
    trialPhase: undefined,
    sponsorProtocolIdentifier: undefined,
    studyIdentifiers: [],
  });
  assert.equal(withWarnings.state, 'readyWithWarnings');
}

function testReferenceOsbJsonSummary() {
  const json = JSON.parse(readFileSync(REFERENCE_FIXTURE, 'utf8'));
  const summary = summarizeUsdmReference(json);

  assert.equal(summary.arms, 2);
  assert.equal(summary.epochs, 4);
  assert.equal(summary.elements, 8);
  assert.equal(summary.encounters, 43);
  assert.equal(summary.activities, 205);
  assert.equal(summary.scheduleTimelines, 1);
  assert.equal(summary.timings, 43);
  assert.equal(summary.scheduledInstances, 43);
  assert.equal(summary.studyDesignCount, 1);
  assert.equal(summary.studyVersionCount, 1);
}

function testExportJsonShape() {
  seedCompleteStudyDesign();
  const result = buildUsdmExport(getStudyDesign(), getContext());
  assert.ok(result.document.study);
  assert.ok(result.document.study.versions[0]);
  assert.ok(result.document.study.versions[0]!.studyDesigns[0]);
}

function testAgentScaffoldSuggestions() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Unanchored', visitClass: 'scheduled', epochId });
  const output = inspectUsdmAlignmentGaps();
  assert.ok(output.suggestions.length > 0);
}

async function main() {
  testMapsArmsEpochsVisitsActivities();
  testMapsScheduleRulesAndTimeline();
  testCreatesTimingForVisits();
  testStableIdsRemainStable();
  testValidationCatchesMissingEncounterTiming();
  testValidationCatchesDuplicateIds();
  testExportReadinessStates();
  testReferenceOsbJsonSummary();
  testExportJsonShape();
  testAgentScaffoldSuggestions();
  console.log('test-usdm-alignment-foundation: PASS');
}

void main();
