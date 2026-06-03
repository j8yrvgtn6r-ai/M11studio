import {
  findScheduleAnchor,
  findVisitDefinition,
  getAssessmentScheduleRule,
  getAssessmentScheduleRules,
  getAssessmentScheduleRulesForAssessment,
  getAssessmentScheduleRulesForVisit,
  getAssessments,
  getSchedule,
  getScheduleAnchors,
  getSoACells,
  getUseGeneratedSchedule,
  getVisitDefinition,
  getVisitDefinitions,
  getVisits,
  reportGeneratedScheduleDiff,
} from '../src/app/domain/protocol';
import {
  createAssessmentScheduleRule,
  deleteAssessmentScheduleRule,
  getProtocolDocument,
  getProtocolSnapshot,
  resetProtocolStore,
  subscribe,
  updateAssessmentScheduleRule,
  updateScheduleAnchor,
  updateVisitDefinition,
} from '../src/app/domain/protocol/store';
import { validateProtocol } from '../src/app/domain/protocol/validateProtocol';

function fail(message: string): never {
  console.error(`Smoke test failed: ${message}`);
  process.exitCode = 1;
  process.exit(1);
}

resetProtocolStore();

const seedValidation = validateProtocol(getProtocolDocument());
if (!seedValidation.valid) {
  fail('seed document failed validateProtocol()');
  console.error(seedValidation.errors);
}

const anchors = getScheduleAnchors();
const visitDefinitions = getVisitDefinitions();

if (anchors.length !== 5) {
  fail(`expected 5 schedule anchors, got ${anchors.length}`);
}

if (visitDefinitions.length !== 9) {
  fail(`expected 9 visit definitions, got ${visitDefinitions.length}`);
}

const screening = getVisitDefinition('vd-screening');
if (!screening || screening.anchorId !== 'anchor-randomization') {
  fail('getVisitDefinition("vd-screening") should resolve with randomization anchor');
}

const firstDoseAnchor = findScheduleAnchor('anchor-first-dose');
if (!firstDoseAnchor || firstDoseAnchor.anchor.sourceVisitId !== 'vd-c1d1') {
  fail('anchor-first-dose should reference vd-c1d1 as sourceVisitId');
}

const c1d1 = findVisitDefinition('vd-c1d1');
if (!c1d1 || c1d1.visitDefinition.clinicalDesignVisitId !== 'visit-2') {
  fail('vd-c1d1 should link to clinical design visit-2');
}

const invalidAnchorDoc = structuredClone(getProtocolDocument());
invalidAnchorDoc.visitSchedule.visitDefinitions[0].anchorId = 'missing-anchor-id';
const invalidAnchorResult = validateProtocol(invalidAnchorDoc);
if (invalidAnchorResult.valid) {
  fail('validateProtocol should reject visit definition with missing anchorId reference');
}
if (
  !invalidAnchorResult.errors.some((error) => error.code === 'invalid_visit_definition_anchor')
) {
  fail('validateProtocol should report invalid_visit_definition_anchor');
}

const invalidSourceVisitDoc = structuredClone(getProtocolDocument());
invalidSourceVisitDoc.visitSchedule.anchors[1].sourceVisitId = 'missing-visit-definition';
const invalidSourceVisitResult = validateProtocol(invalidSourceVisitDoc);
if (invalidSourceVisitResult.valid) {
  fail('validateProtocol should reject anchor with invalid sourceVisitId');
}
if (
  !invalidSourceVisitResult.errors.some((error) => error.code === 'invalid_schedule_anchor_source_visit')
) {
  fail('validateProtocol should report invalid_schedule_anchor_source_visit');
}

const missingScheduleDoc = structuredClone(getProtocolDocument());
// @ts-expect-error smoke fixture for missing visitSchedule
missingScheduleDoc.visitSchedule = undefined;
const missingScheduleResult = validateProtocol(missingScheduleDoc);
if (missingScheduleResult.valid) {
  fail('validateProtocol should reject document without visitSchedule');
}
if (!missingScheduleResult.errors.some((error) => error.code === 'missing_visit_schedule')) {
  fail('validateProtocol should report missing_visit_schedule');
}

const negativeWindowDoc = structuredClone(getProtocolDocument());
negativeWindowDoc.visitSchedule.visitDefinitions[0].windowBeforeDays = -1;
const negativeWindowResult = validateProtocol(negativeWindowDoc);
if (negativeWindowResult.valid) {
  fail('validateProtocol should reject negative visit window bounds');
}
if (
  !negativeWindowResult.errors.some((error) => error.code === 'invalid_visit_window_before_days')
) {
  fail('validateProtocol should report invalid_visit_window_before_days');
}

resetProtocolStore();

const updatedAtBefore = getProtocolDocument().metadata.updatedAt;
let subscriberNotifications = 0;
const unsubscribe = subscribe(() => {
  subscriberNotifications += 1;
});

if (
  !updateVisitDefinition('vd-c1d15', {
    windowBeforeDays: 4,
    windowAfterDays: 5,
  })
) {
  fail('valid visit window update should succeed');
}

const updatedC1d15 = getVisitDefinition('vd-c1d15');
if (updatedC1d15?.windowBeforeDays !== 4 || updatedC1d15.windowAfterDays !== 5) {
  fail('visit window update did not persist in store');
}

const snapshotC1d15 = getProtocolSnapshot().visitSchedule.visitDefinitions.find(
  (visitDefinition) => visitDefinition.id === 'vd-c1d15'
);
if (snapshotC1d15?.windowBeforeDays !== 4) {
  fail('getProtocolSnapshot() did not reflect visit window mutation');
}

if (updateVisitDefinition('vd-c1d15', { windowBeforeDays: -2 })) {
  fail('invalid negative windowBeforeDays update should return false');
}

if (getVisitDefinition('vd-c1d15')?.windowBeforeDays !== 4) {
  fail('invalid negative window update should not mutate the store');
}

if (
  !updateVisitDefinition('vd-c2d1', {
    reanchorPolicy: 'reanchorToActualVisitDate',
    ripplePolicy: 'rippleSubsequentVisits',
  })
) {
  fail('reanchor/ripple policy update should succeed');
}

const updatedC2d1 = getVisitDefinition('vd-c2d1');
if (
  updatedC2d1?.reanchorPolicy !== 'reanchorToActualVisitDate' ||
  updatedC2d1?.ripplePolicy !== 'rippleSubsequentVisits'
) {
  fail('reanchor/ripple policy update did not persist');
}

const anchorDescription = findScheduleAnchor('anchor-first-dose')?.anchor.description ?? '';
if (
  !updateScheduleAnchor('anchor-first-dose', {
    description: `${anchorDescription} [smoke-test]`.trim(),
  })
) {
  fail('valid schedule anchor update should succeed');
}

if (!findScheduleAnchor('anchor-first-dose')?.anchor.description?.includes('[smoke-test]')) {
  fail('schedule anchor description update did not persist');
}

if (updateScheduleAnchor('anchor-first-dose', { sourceVisitId: 'missing-visit-definition' })) {
  fail('invalid sourceVisitId update should return false');
}

if (
  findScheduleAnchor('anchor-first-dose')?.anchor.sourceVisitId !== 'vd-c1d1'
) {
  fail('invalid sourceVisitId update should not mutate the store');
}

if (updateVisitDefinition('vd-c1d15', { anchorId: 'nonexistent-anchor' })) {
  fail('invalid anchorId update should return false');
}

const postMutationValidation = validateProtocol(getProtocolDocument());
if (!postMutationValidation.valid) {
  fail('validateProtocol() should pass after valid visit schedule mutations');
  console.error(postMutationValidation.errors);
}

if (getProtocolDocument().metadata.updatedAt <= updatedAtBefore) {
  fail('successful mutations should update metadata.updatedAt');
}

if (subscriberNotifications < 3) {
  fail(`expected subscriber notifications after mutations, got ${subscriberNotifications}`);
}

resetProtocolStore();
unsubscribe();

const seedRules = getAssessmentScheduleRules();
if (seedRules.length !== 44) {
  fail(`expected 44 assessment schedule rules in seed, got ${seedRules.length}`);
}

const screeningRules = getAssessmentScheduleRulesForVisit('vd-screening');
if (screeningRules.length !== 8) {
  fail(`expected 8 rules for vd-screening, got ${screeningRules.length}`);
}

const tumorRules = getAssessmentScheduleRulesForAssessment('a8');
if (tumorRules.length !== 3) {
  fail(`expected 3 rules for schedule assessment a8, got ${tumorRules.length}`);
}

const tumorClinicalRules = getAssessmentScheduleRulesForAssessment('assess-1');
if (tumorClinicalRules.length !== 3) {
  fail(`expected 3 rules for clinical design assessment assess-1 via cross-layer lookup, got ${tumorClinicalRules.length}`);
}

const seedRule = getAssessmentScheduleRule('asr-v1-a1');
if (!seedRule || seedRule.assessmentId !== 'a1' || seedRule.visitDefinitionId !== 'vd-screening') {
  fail('getAssessmentScheduleRule("asr-v1-a1") should resolve seed rule');
}

if (seedRule.metadata?.assessmentRefKind !== 'schedule' || seedRule.metadata?.scheduleAssessmentId !== 'a1') {
  fail('seed schedule-layer rules should include explicit assessment reference metadata');
}

const linkedSeedRule = getAssessmentScheduleRule('asr-v1-a8');
if (linkedSeedRule?.metadata?.clinicalDesignAssessmentId !== 'assess-1') {
  fail('seed rule for schedule assessment a8 should link clinicalDesignAssessmentId assess-1 in metadata');
}

const smokeRuleId = 'asr-smoke-test';
if (
  !createAssessmentScheduleRule({
    id: smokeRuleId,
    assessmentId: 'assess-3',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    timingNote: 'Smoke test rule',
    relativeTiming: 'at-visit',
    sourceSectionId: '8',
  })
) {
  fail('create valid assessment schedule rule should succeed');
}

const createdSmokeRule = getAssessmentScheduleRule(smokeRuleId);
if (
  createdSmokeRule?.metadata?.assessmentRefKind !== 'clinicalDesign' ||
  createdSmokeRule.metadata?.clinicalDesignAssessmentId !== 'assess-3'
) {
  fail('createAssessmentScheduleRule should stamp canonical clinical design assessment metadata');
}

if (createAssessmentScheduleRule({
  id: smokeRuleId,
  assessmentId: 'assess-3',
  visitDefinitionId: 'vd-c1d8',
  required: true,
})) {
  fail('duplicate rule id should fail');
}

if (
  !createAssessmentScheduleRule({
    id: 'asr-smoke-schedule-ref',
    assessmentId: 'a10',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    timingNote: 'Schedule-layer transitional rule',
  })
) {
  fail('schedule-layer assessmentId create should still succeed during migration');
}

const transitionalRule = getAssessmentScheduleRule('asr-smoke-schedule-ref');
if (
  transitionalRule?.metadata?.assessmentRefKind !== 'schedule' ||
  transitionalRule.metadata?.scheduleAssessmentId !== 'a10'
) {
  fail('schedule-layer create should stamp schedule assessment reference metadata');
}

deleteAssessmentScheduleRule('asr-smoke-schedule-ref');

if (
  createAssessmentScheduleRule({
    id: smokeRuleId,
    assessmentId: 'assess-3',
    visitDefinitionId: 'vd-c1d8',
    required: true,
  })
) {
  fail('duplicate rule id should fail after deleting transitional rule');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-invalid-assessment',
    assessmentId: 'missing-assessment',
    visitDefinitionId: 'vd-c1d8',
    required: true,
  })
) {
  fail('invalid assessmentId should fail');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-invalid-visit',
    assessmentId: 'assess-3',
    visitDefinitionId: 'missing-visit-definition',
    required: true,
  })
) {
  fail('invalid visitDefinitionId should fail');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-invalid-section',
    assessmentId: 'assess-3',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    sourceSectionId: 'nonexistent-section-id',
  })
) {
  fail('invalid sourceSectionId should fail');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-negative-window',
    assessmentId: 'assess-3',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    windowBeforeDays: -1,
  })
) {
  fail('negative windowBeforeDays should fail');
}

if (
  !updateAssessmentScheduleRule(smokeRuleId, {
    timingNote: 'Updated smoke test rule',
    windowBeforeDays: 2,
    windowAfterDays: 1,
  })
) {
  fail('update valid assessment schedule rule should succeed');
}

const updatedSmokeRule = getAssessmentScheduleRule(smokeRuleId);
if (
  updatedSmokeRule?.timingNote !== 'Updated smoke test rule' ||
  updatedSmokeRule.windowBeforeDays !== 2
) {
  fail('assessment schedule rule update did not persist');
}

if (updateAssessmentScheduleRule(smokeRuleId, { windowAfterDays: -3 })) {
  fail('update with negative windowAfterDays should fail');
}

if (!deleteAssessmentScheduleRule(smokeRuleId)) {
  fail('delete assessment schedule rule should succeed');
}

if (getAssessmentScheduleRule(smokeRuleId)) {
  fail('deleted assessment schedule rule should no longer resolve');
}

const postRuleMutationValidation = validateProtocol(getProtocolDocument());
if (!postRuleMutationValidation.valid) {
  fail('validateProtocol() should pass after valid assessment schedule rule mutations');
  console.error(postRuleMutationValidation.errors);
}

if (getUseGeneratedSchedule() !== false) {
  fail('useGeneratedSchedule default should be false');
}

const legacyVisits = getVisits();
const generatedVisits = getVisits(getProtocolDocument(), { generated: true });
if (legacyVisits.length !== generatedVisits.length) {
  fail('legacy and generated visit counts should match for seed preview');
}

const generatedSchedule = getSchedule(getProtocolDocument(), { generated: true });
if (
  !generatedSchedule.metadata?.generatedFromRules ||
  generatedSchedule.metadata.sourceRuleCount !== 44 ||
  generatedSchedule.metadata.sourceVisitDefinitionCount !== 9
) {
  fail('generated schedule metadata should describe rule-derived preview');
}

const diffReport = reportGeneratedScheduleDiff(getProtocolDocument());
if (!diffReport.structurallyEquivalent) {
  fail('reportGeneratedScheduleDiff should report structural equivalence for seed');
}

if (getVisits().length !== legacyVisits.length) {
  fail('default getVisits() behavior should remain legacy');
}

if (getAssessments().length !== getAssessments(getProtocolDocument(), { generated: true }).length) {
  fail('legacy and generated assessment counts should match for seed preview');
}

if (getSoACells().length !== getSoACells(getProtocolDocument(), { generated: true }).length) {
  fail('legacy and generated cell counts should match for seed preview');
}

resetProtocolStore();

console.log('Visit schedule smoke test passed.');
console.log(`  anchors: ${anchors.length}`);
console.log(`  visitDefinitions: ${visitDefinitions.length}`);
console.log(`  assessmentScheduleRules: ${seedRules.length}`);
console.log(`  lookup helpers verified`);
console.log(`  anchor and visitDefinition validation verified`);
console.log(`  visit window and policy mutations verified`);
console.log(`  assessment schedule rule CRUD verified`);
console.log(`  feature-flagged schedule selectors verified`);
console.log(`  subscriber notifications: ${subscriberNotifications}`);
console.log(`  store reset to seed`);
