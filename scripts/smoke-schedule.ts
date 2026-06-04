import {
  findScheduleAnchor,
  findVisitDefinition,
  getSoAAssessmentDefinition,
  getSoAAssessmentDefinitions,
  getSoAAssessmentDefinitionsByCategory,
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
  getVisitDefinitionBySoAColumnId,
  getVisitDefinitions,
  getVisits,
  isScheduleCacheStale,
  generatedScheduleContentEquals,
  generateScheduleFromRules,
  reportGeneratedScheduleDiff,
  verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata,
  getCreateSoAAssessmentDefinitionFailure,
  getDeleteSoAAssessmentDefinitionFailure,
} from '../src/app/domain/protocol';
import {
  createAssessmentScheduleRule,
  createSoAAssessmentDefinition,
  deleteAssessmentScheduleRule,
  deleteSoAAssessmentDefinition,
  getProtocolDocument,
  getProtocolSnapshot,
  regenerateScheduleCache,
  resetProtocolStore,
  subscribe,
  updateAssessmentScheduleRule,
  updateScheduleAnchor,
  updateSoAAssessmentDefinition,
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

const c1d1ByColumn = getVisitDefinitionBySoAColumnId('v3');
if (!c1d1ByColumn || c1d1ByColumn.id !== 'vd-c1d1' || c1d1ByColumn.displayLabel !== 'C1D1') {
  fail('getVisitDefinitionBySoAColumnId("v3") should resolve vd-c1d1 with display metadata');
}

const screeningByColumn = getVisitDefinitionBySoAColumnId('v1');
if (
  !screeningByColumn ||
  screeningByColumn.soaColumnId !== 'v1' ||
  screeningByColumn.timepointDisplay !== 'Day -28 to -1'
) {
  fail('getVisitDefinitionBySoAColumnId("v1") should resolve screening visit display metadata');
}

const duplicateSoaColumnDoc = structuredClone(getProtocolDocument());
duplicateSoaColumnDoc.visitSchedule.visitDefinitions[1].soaColumnId = 'v1';
const duplicateSoaColumnResult = validateProtocol(duplicateSoaColumnDoc);
if (duplicateSoaColumnResult.valid) {
  fail('validateProtocol should reject duplicate soaColumnId values');
}
if (
  !duplicateSoaColumnResult.errors.some((error) => error.code === 'duplicate_visit_definition_soa_column_id')
) {
  fail('validateProtocol should report duplicate_visit_definition_soa_column_id');
}

const emptyDisplayLabelDoc = structuredClone(getProtocolDocument());
emptyDisplayLabelDoc.visitSchedule.visitDefinitions[2].displayLabel = '   ';
const emptyDisplayLabelResult = validateProtocol(emptyDisplayLabelDoc);
if (emptyDisplayLabelResult.valid) {
  fail('validateProtocol should reject empty displayLabel');
}
if (
  !emptyDisplayLabelResult.errors.some((error) => error.code === 'invalid_visit_definition_display_label')
) {
  fail('validateProtocol should report invalid_visit_definition_display_label');
}

const soaColumnMetadataMismatchDoc = structuredClone(getProtocolDocument());
soaColumnMetadataMismatchDoc.visitSchedule.visitDefinitions[0].soaColumnId = 'v99';
const soaColumnMetadataMismatchResult = validateProtocol(soaColumnMetadataMismatchDoc);
if (!soaColumnMetadataMismatchResult.valid) {
  fail('validateProtocol should remain valid when soaColumnId disagrees with metadata.scheduleVisitId');
}
if (
  !soaColumnMetadataMismatchResult.warnings.some(
    (warning) => warning.code === 'visit_definition_soa_column_id_metadata_mismatch'
  )
) {
  fail('validateProtocol should warn on visit_definition_soa_column_id_metadata_mismatch');
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

const missingSoADefinitionsDoc = structuredClone(getProtocolDocument());
// @ts-expect-error smoke fixture for missing soaAssessmentDefinitions
missingSoADefinitionsDoc.soaAssessmentDefinitions = undefined;
const missingSoADefinitionsResult = validateProtocol(missingSoADefinitionsDoc);
if (missingSoADefinitionsResult.valid) {
  fail('validateProtocol should reject document without soaAssessmentDefinitions');
}
if (
  !missingSoADefinitionsResult.errors.some((error) => error.code === 'missing_soa_assessment_definitions')
) {
  fail('validateProtocol should report missing_soa_assessment_definitions');
}

const invalidLinkedSectionDoc = structuredClone(getProtocolDocument());
invalidLinkedSectionDoc.soaAssessmentDefinitions[0].linkedSectionId = 'nonexistent-section-id';
const invalidLinkedSectionResult = validateProtocol(invalidLinkedSectionDoc);
if (invalidLinkedSectionResult.valid) {
  fail('validateProtocol should reject SoA assessment definition with invalid linkedSectionId');
}
if (
  !invalidLinkedSectionResult.errors.some(
    (error) => error.code === 'invalid_soa_assessment_definition_linked_section'
  )
) {
  fail('validateProtocol should report invalid_soa_assessment_definition_linked_section');
}

const invalidClinicalDesignRefDoc = structuredClone(getProtocolDocument());
invalidClinicalDesignRefDoc.soaAssessmentDefinitions[6].clinicalDesignAssessmentId = 'missing-assessment-id';
const invalidClinicalDesignRefResult = validateProtocol(invalidClinicalDesignRefDoc);
if (invalidClinicalDesignRefResult.valid) {
  fail('validateProtocol should reject SoA assessment definition with invalid clinicalDesignAssessmentId');
}
if (
  !invalidClinicalDesignRefResult.errors.some(
    (error) => error.code === 'invalid_soa_assessment_definition_clinical_design_ref'
  )
) {
  fail('validateProtocol should report invalid_soa_assessment_definition_clinical_design_ref');
}

const soaDefinitions = getSoAAssessmentDefinitions();
if (soaDefinitions.length !== 12) {
  fail(`expected 12 SoA assessment definitions in seed, got ${soaDefinitions.length}`);
}

const informedConsent = getSoAAssessmentDefinition('a1');
if (!informedConsent || informedConsent.label !== 'Informed Consent' || informedConsent.order !== 1) {
  fail('getSoAAssessmentDefinition("a1") should resolve seed catalog row');
}

const tumorAssessment = getSoAAssessmentDefinition('a8');
if (tumorAssessment?.clinicalDesignAssessmentId !== 'assess-1') {
  fail('getSoAAssessmentDefinition("a8") should link clinicalDesignAssessmentId assess-1');
}

const safetyDefinitions = getSoAAssessmentDefinitionsByCategory('Safety');
if (safetyDefinitions.length !== 6) {
  fail(`expected 6 Safety SoA assessment definitions, got ${safetyDefinitions.length}`);
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

if (
  seedRule.metadata?.assessmentRefKind !== 'soaAssessment' ||
  seedRule.metadata?.soaAssessmentDefinitionId !== 'a1'
) {
  fail('seed rules should reference canonical soaAssessmentDefinitions metadata');
}

const linkedSeedRule = getAssessmentScheduleRule('asr-v1-a8');
if (
  linkedSeedRule?.metadata?.clinicalDesignAssessmentId !== 'assess-1' ||
  linkedSeedRule.metadata?.soaAssessmentDefinitionId !== 'a8'
) {
  fail('seed rule for SoA assessment a8 should link clinicalDesignAssessmentId assess-1 in metadata');
}

const smokeRuleId = 'asr-smoke-test';
if (
  !createAssessmentScheduleRule({
    id: smokeRuleId,
    assessmentId: 'a7',
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
  createdSmokeRule?.metadata?.assessmentRefKind !== 'soaAssessment' ||
  createdSmokeRule.metadata?.soaAssessmentDefinitionId !== 'a7' ||
  createdSmokeRule.metadata?.clinicalDesignAssessmentId !== 'assess-3'
) {
  fail('createAssessmentScheduleRule should stamp canonical SoA assessment catalog metadata');
}

if (createAssessmentScheduleRule({
  id: smokeRuleId,
  assessmentId: 'a7',
  visitDefinitionId: 'vd-c1d8',
  required: true,
})) {
  fail('duplicate rule id should fail');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-clinical-ref',
    assessmentId: 'assess-3',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    timingNote: 'Clinical design id should be rejected on rules',
  })
) {
  fail('clinical design assessmentId create should fail; rules must reference soaAssessmentDefinitions');
}

if (
  !createAssessmentScheduleRule({
    id: 'asr-smoke-soa-ref',
    assessmentId: 'a10',
    visitDefinitionId: 'vd-c1d8',
    required: true,
    timingNote: 'SoA catalog rule',
  })
) {
  fail('SoA catalog assessmentId create should succeed');
}

const catalogRule = getAssessmentScheduleRule('asr-smoke-soa-ref');
if (
  catalogRule?.metadata?.assessmentRefKind !== 'soaAssessment' ||
  catalogRule.metadata?.soaAssessmentDefinitionId !== 'a10'
) {
  fail('SoA catalog create should stamp soaAssessment reference metadata');
}

deleteAssessmentScheduleRule('asr-smoke-soa-ref');

if (
  createAssessmentScheduleRule({
    id: smokeRuleId,
    assessmentId: 'a7',
    visitDefinitionId: 'vd-c1d8',
    required: true,
  })
) {
  fail('duplicate rule id should fail after deleting catalog rule');
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
    assessmentId: 'a7',
    visitDefinitionId: 'missing-visit-definition',
    required: true,
  })
) {
  fail('invalid visitDefinitionId should fail');
}

if (
  createAssessmentScheduleRule({
    id: 'asr-smoke-invalid-section',
    assessmentId: 'a7',
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
    assessmentId: 'a7',
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
  fail('useGeneratedSchedule default should be false (authoritative cache mode)');
}

const cacheVisits = getVisits();
const livePreviewVisits = getVisits(getProtocolDocument(), { generated: true });
if (cacheVisits.length !== livePreviewVisits.length) {
  fail('cache and live preview visit counts should match for aligned seed');
}

const livePreviewSchedule = getSchedule(getProtocolDocument(), { generated: true });
if (
  !livePreviewSchedule.metadata?.generatedFromRules ||
  livePreviewSchedule.metadata.sourceRuleCount !== 44 ||
  livePreviewSchedule.metadata.sourceVisitDefinitionCount !== 9
) {
  fail('live preview schedule metadata should describe rule-derived output');
}

const diffReport = reportGeneratedScheduleDiff(getProtocolDocument());
if (!diffReport.structurallyEquivalent) {
  fail('reportGeneratedScheduleDiff should report structural equivalence for aligned cache');
}

if (getVisits().length !== cacheVisits.length) {
  fail('default getVisits() should read authoritative generated cache');
}

if (getAssessments().length !== getAssessments(getProtocolDocument(), { generated: true }).length) {
  fail('cache and live preview assessment counts should match for aligned seed');
}

if (getSoACells().length !== getSoACells(getProtocolDocument(), { generated: true }).length) {
  fail('cache and live preview cell counts should match for aligned seed');
}

if (!verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata(getProtocolDocument())) {
  fail('generateScheduleFromRules should not depend on legacy schedule.visits or schedule.assessments metadata');
}

resetProtocolStore();

const seedCacheValidation = validateProtocol(getProtocolDocument());
if (
  seedCacheValidation.warnings.some((warning) => warning.code.startsWith('schedule_cache_'))
) {
  fail('aligned seed should not emit schedule cache warnings on cold load');
}

if (!getProtocolDocument().schedule.metadata?.generatedFromRules) {
  fail('seed schedule.metadata.generatedFromRules should be true after cache alignment');
}

if (isScheduleCacheStale(getProtocolDocument())) {
  fail('isScheduleCacheStale() should be false for aligned seed schedule cache');
}

if (!regenerateScheduleCache()) {
  fail('regenerateScheduleCache() should succeed');
}

const regeneratedDocument = getProtocolDocument();
const cacheMetadata = regeneratedDocument.schedule.metadata;

if (
  !cacheMetadata?.generatedFromRules ||
  !cacheMetadata.generatedAt ||
  !cacheMetadata.sourceHash ||
  cacheMetadata.sourceRuleCount !== 44 ||
  cacheMetadata.sourceVisitDefinitionCount !== 9 ||
  cacheMetadata.sourceSoAAssessmentDefinitionCount !== 12
) {
  fail('regenerateScheduleCache() should write schedule cache metadata');
}

if (isScheduleCacheStale(regeneratedDocument)) {
  fail('isScheduleCacheStale() should be false immediately after regeneration');
}

const postRegenerationValidation = validateProtocol(regeneratedDocument);
const postRegenerationCacheWarnings = postRegenerationValidation.warnings.filter((warning) =>
  warning.code.startsWith('schedule_cache_')
);

if (postRegenerationCacheWarnings.length > 0) {
  fail(
    `schedule cache warnings should clear after regeneration: ${postRegenerationCacheWarnings
      .map((warning) => warning.code)
      .join(', ')}`
  );
}

const hashAfterRegeneration = cacheMetadata.sourceHash;

if (
  !updateAssessmentScheduleRule('asr-v1-a1', {
    timingNote: 'Auto-regeneration smoke mutation',
  })
) {
  fail('assessment schedule rule update for auto-regeneration smoke should succeed');
}

if (isScheduleCacheStale(getProtocolDocument())) {
  fail('isScheduleCacheStale() should be false after mutating assessmentScheduleRules (auto-regenerated cache)');
}

const hashAfterRuleMutation = getProtocolDocument().schedule.metadata?.sourceHash;
if (!hashAfterRuleMutation || hashAfterRuleMutation === hashAfterRegeneration) {
  fail('schedule.metadata.sourceHash should change when assessmentScheduleRules change');
}

const freshAfterRuleMutation = validateProtocol(getProtocolDocument());
if (freshAfterRuleMutation.warnings.some((warning) => warning.code.startsWith('schedule_cache_'))) {
  fail('validateProtocol should not emit schedule cache warnings after auto-regeneration');
}

if (
  !updateVisitDefinition('vd-c1d15', {
    windowAfterDays: 4,
  })
) {
  fail('visit definition update for auto-regeneration smoke should succeed');
}

if (isScheduleCacheStale(getProtocolDocument())) {
  fail('isScheduleCacheStale() should be false after mutating visitSchedule.visitDefinitions (auto-regenerated cache)');
}

const hashAfterVisitMutation = getProtocolDocument().schedule.metadata?.sourceHash;
if (!hashAfterVisitMutation || hashAfterVisitMutation === hashAfterRuleMutation) {
  fail('schedule.metadata.sourceHash should change when visitSchedule.visitDefinitions change');
}

const generatedAfterMutations = generateScheduleFromRules(getProtocolDocument());
if (!generatedScheduleContentEquals(getProtocolDocument().schedule, generatedAfterMutations)) {
  fail('auto-regenerated schedule cache should match generateScheduleFromRules output');
}

if (
  !getProtocolDocument().schedule.metadata?.generatedFromRules ||
  !getProtocolDocument().schedule.metadata.generatedAt ||
  !getProtocolDocument().schedule.metadata.sourceHash ||
  getProtocolDocument().schedule.metadata.sourceRuleCount !== 44
) {
  fail('auto-regeneration should maintain generated schedule cache metadata');
}

const hashBeforeSoADefinitionMutation = getProtocolDocument().schedule.metadata?.sourceHash;
const soaDefinitionCountBeforeCreate = getSoAAssessmentDefinitions().length;

const smokeSoADefinitionId = 'a-smoke-catalog';
if (
  !createSoAAssessmentDefinition({
    id: smokeSoADefinitionId,
    label: 'Smoke Catalog Assessment',
    category: 'Smoke',
    order: 99,
    linkedSectionId: '8',
    metadata: { smokeTest: true },
  })
) {
  fail('create valid SoA assessment definition should succeed');
}

const createdSoADefinition = getSoAAssessmentDefinition(smokeSoADefinitionId);
if (
  !createdSoADefinition ||
  createdSoADefinition.label !== 'Smoke Catalog Assessment' ||
  createdSoADefinition.linkedSectionId !== '8'
) {
  fail('createSoAAssessmentDefinition should persist catalog metadata');
}

if (getSoAAssessmentDefinitions().length !== soaDefinitionCountBeforeCreate + 1) {
  fail('createSoAAssessmentDefinition should append to soaAssessmentDefinitions');
}

if (isScheduleCacheStale(getProtocolDocument())) {
  fail('isScheduleCacheStale() should be false after creating SoA assessment definition');
}

const hashAfterSoACreate = getProtocolDocument().schedule.metadata?.sourceHash;
if (!hashAfterSoACreate || hashAfterSoACreate === hashBeforeSoADefinitionMutation) {
  fail('schedule.metadata.sourceHash should change when soaAssessmentDefinitions change');
}

if (
  getProtocolDocument().schedule.metadata?.sourceSoAAssessmentDefinitionCount !==
  soaDefinitionCountBeforeCreate + 1
) {
  fail('createSoAAssessmentDefinition should update schedule cache sourceSoAAssessmentDefinitionCount');
}

if (
  createSoAAssessmentDefinition({
    id: smokeSoADefinitionId,
    label: 'Duplicate',
    category: 'Smoke',
    order: 100,
  })
) {
  fail('duplicate SoA assessment definition id should fail');
}

if (
  getCreateSoAAssessmentDefinitionFailure(getProtocolDocument(), {
    id: 'a-smoke-invalid-section',
    label: 'Invalid section',
    category: 'Smoke',
    order: 100,
    linkedSectionId: 'nonexistent-section-id',
  }) !== 'invalid_linked_section'
) {
  fail('getCreateSoAAssessmentDefinitionFailure should report invalid_linked_section');
}

if (
  createSoAAssessmentDefinition({
    id: 'a-smoke-invalid-section',
    label: 'Invalid section',
    category: 'Smoke',
    order: 100,
    linkedSectionId: 'nonexistent-section-id',
  })
) {
  fail('invalid linkedSectionId should fail SoA assessment definition create');
}

if (
  !updateSoAAssessmentDefinition(smokeSoADefinitionId, {
    label: 'Updated Smoke Catalog Assessment',
    order: 100,
  })
) {
  fail('update valid SoA assessment definition should succeed');
}

const updatedSoADefinition = getSoAAssessmentDefinition(smokeSoADefinitionId);
if (
  !updatedSoADefinition ||
  updatedSoADefinition.label !== 'Updated Smoke Catalog Assessment' ||
  updatedSoADefinition.order !== 100
) {
  fail('updateSoAAssessmentDefinition should persist catalog metadata');
}

if (getDeleteSoAAssessmentDefinitionFailure('a1') !== 'referenced_by_rules') {
  fail('getDeleteSoAAssessmentDefinitionFailure should block delete when schedule rules reference assessment');
}

if (deleteSoAAssessmentDefinition('a1')) {
  fail('deleteSoAAssessmentDefinition should fail when schedule rules reference assessment');
}

if (!deleteSoAAssessmentDefinition(smokeSoADefinitionId)) {
  fail('delete SoA assessment definition without schedule rules should succeed');
}

if (getSoAAssessmentDefinition(smokeSoADefinitionId)) {
  fail('deleted SoA assessment definition should be removed from store');
}

if (getSoAAssessmentDefinitions().length !== soaDefinitionCountBeforeCreate) {
  fail('deleteSoAAssessmentDefinition should remove catalog row and auto-regenerate schedule cache');
}

if (
  getProtocolDocument().schedule.metadata?.sourceSoAAssessmentDefinitionCount !==
  soaDefinitionCountBeforeCreate
) {
  fail('deleteSoAAssessmentDefinition should restore schedule cache sourceSoAAssessmentDefinitionCount');
}

resetProtocolStore();

console.log('Visit schedule smoke test passed.');
console.log(`  anchors: ${anchors.length}`);
console.log(`  visitDefinitions: ${visitDefinitions.length}`);
console.log(`  soaAssessmentDefinitions: ${soaDefinitions.length}`);
console.log(`  assessmentScheduleRules: ${seedRules.length}`);
console.log(`  lookup helpers verified`);
console.log(`  anchor and visitDefinition validation verified`);
console.log(`  visit window and policy mutations verified`);
console.log(`  assessment schedule rule CRUD verified`);
console.log(`  SoA assessment definition CRUD verified`);
console.log(`  feature-flagged schedule selectors verified`);
console.log(`  schedule cache regeneration and auto-regeneration verified`);
console.log(`  subscriber notifications: ${subscriberNotifications}`);
console.log(`  store reset to seed`);
