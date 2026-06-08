import assert from 'node:assert/strict';

import { resetKnowledgeGraphForTests, getKnowledgeGraph } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument, mutateProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import { getProtocolImportState, updateSectionImportDraft } from '../src/app/domain/protocol/import/protocolImportStore';
import {
  evaluateSoAEnrichmentReadiness,
  evaluateSoAFirstPassReadiness,
} from '../src/app/domain/soa-knowledge/soaReadinessEvaluator';
import {
  getSoAKnowledge,
  resetSoAKnowledgeForTests,
  setSoAKnowledge,
} from '../src/app/domain/soa-knowledge/soaKnowledgeStore';
import { createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import { saveManualSoAEntity } from '../src/app/domain/soa-knowledge/soaManualAuthoringService';
import { createSoANarrativeImpactRecord } from '../src/app/domain/soa-knowledge/soaKnowledgeNarrativeSync';
import { validateSoAEntityForm } from '../src/app/domain/soa-knowledge/soaEntityValidation';
import { ensureDefaultScreeningAnchor } from '../src/app/domain/protocol/store/visitScheduleMutations';
import { rebuildStudyModel, clearStudyModel, setStudyModelPhase } from '../src/app/domain/study-model/studyModelStore';
import { addManualStudyDesignEntity, resetStudyDesignForTests } from '../src/app/domain/study-design';

function seedManualSectionContent(sectionId: string, text: string) {
  mutateProtocolDocument((draft) => {
    const existing = draft.elements.find((element) => element.sectionId === sectionId);
    if (existing) {
      existing.value = text;
      return;
    }
    draft.elements.push({
      id: `manual-content-${sectionId}`,
      sectionId,
      fieldId: `section_${sectionId.replace('.', '_')}_body`,
      label: sectionId,
      value: text,
      type: 'richText',
    } as never);
  });
}

function seedImportSection(sectionId: string, text: string) {
  updateSectionImportDraft(sectionId, {
    sectionId,
    title: sectionId,
    generatedText: text,
    sourceText: text,
    generatedAt: new Date().toISOString(),
    workflowState: 'importedUnvalidated',
    state: 'pendingReview',
    contentOrigin: 'imported',
  } as never);
}

function clearRelevantSectionContent() {
  mutateProtocolDocument((draft) => {
    draft.elements = (draft.elements ?? []).filter(
      (element) => !['1.3', '4', '6', '8', '9', '10'].includes(element.sectionId),
    );
  });
  getProtocolImportState().sectionDrafts = {};
}

async function testGenerateFirstPassHiddenWhenNoKnowledge() {
  clearStudyModel();
  resetSoAKnowledgeForTests();
  resetStudyDesignForTests();
  clearRelevantSectionContent();
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, false);
  assert.ok(readiness.suggestedNextActions.some((action) => /study design|first-pass/i.test(action)));
}

async function testGenerateFirstPassReadyWithStudyDesign() {
  clearStudyModel();
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, true);
}

async function testEnrichmentHiddenBeforeFirstPass() {
  resetSoAKnowledgeForTests();
  const readiness = evaluateSoAEnrichmentReadiness();
  assert.equal(readiness.ready, false);
  assert.ok(readiness.suggestedNextActions.some((action) => /first-pass/i.test(action)));
}

async function testEnrichmentReadyAfterKnowledgeExists() {
  resetSoAKnowledgeForTests();
  setSoAKnowledge(
    createEmptySoAKnowledgeModel(getProtocolDocument().id),
  );
  saveManualSoAEntity('visit', {
    name: 'Cycle 1 Day 1',
    anchorId: ensureDefaultScreeningAnchor(),
    visitType: 'treatment',
    required: true,
  });
  saveManualSoAEntity('assessment', {
    name: 'Vital Signs',
    category: 'vitalSigns',
  });
  const readiness = evaluateSoAEnrichmentReadiness();
  assert.equal(readiness.ready, true);
}

async function testAddVisitCreatesVisit() {
  resetSoAKnowledgeForTests();
  const anchorId = ensureDefaultScreeningAnchor();
  const result = saveManualSoAEntity('visit', {
    name: 'Week 4 Visit',
    anchorId,
    visitType: 'treatment',
    window: '±3 days',
    required: true,
  });
  assert.equal(result.success, true);
  const document = getProtocolDocument();
  assert.ok(document.visitSchedule.visitDefinitions.some((visit) => /week 4/i.test(visit.name)));
  assert.ok(getSoAKnowledge()?.visits.some((visit) => /week 4/i.test(visit.name)));
}

async function testAddAssessmentCreatesAssessment() {
  resetSoAKnowledgeForTests();
  const result = saveManualSoAEntity('assessment', {
    name: 'ECG',
    category: 'safety',
  });
  assert.equal(result.success, true);
  assert.ok(getProtocolDocument().soaAssessmentDefinitions?.some((item) => /ecg/i.test(item.label)));
  assert.ok(getSoAKnowledge()?.assessments.some((item) => /ecg/i.test(item.name)));
}

async function testAddScheduleRuleLinksAssessmentAndVisit() {
  resetSoAKnowledgeForTests();
  const anchorId = ensureDefaultScreeningAnchor();
  const visitResult = saveManualSoAEntity('visit', {
    name: 'Baseline',
    anchorId,
    visitType: 'baseline',
    required: true,
  });
  const assessmentResult = saveManualSoAEntity('assessment', {
    name: 'Physical Exam',
    category: 'physicalExam',
  });
  assert.equal(visitResult.success, true);
  assert.equal(assessmentResult.success, true);

  const visitId = getProtocolDocument().visitSchedule.visitDefinitions.find((visit) => /baseline/i.test(visit.name))!.id;
  const assessmentId = getProtocolDocument().soaAssessmentDefinitions!.find((item) => /physical exam/i.test(item.label))!.id;

  const ruleResult = saveManualSoAEntity('scheduleRule', {
    name: 'Physical Exam at Baseline',
    assessmentId,
    visitDefinitionId: visitId,
    required: true,
  });
  assert.equal(ruleResult.success, true);
  assert.ok(
    getProtocolDocument().assessmentScheduleRules.some(
      (rule) => rule.assessmentId === assessmentId && rule.visitDefinitionId === visitId,
    ),
  );
}

async function testManualEditsUpdateKnowledgeGraph() {
  resetSoAKnowledgeForTests();
  resetKnowledgeGraphForTests();
  saveManualSoAEntity('assessment', { name: 'Hematology', category: 'laboratory' });
  const graph = getKnowledgeGraph();
  assert.ok(graph?.entities.some((entity) => /hematology/i.test(entity.name)));
}

async function testManualEditsCreateNarrativeSyncImpact() {
  const record = createSoANarrativeImpactRecord({
    kind: 'visitAdded',
    entityKind: 'visit',
    entityId: 'visit-test',
    entityName: 'Screening',
  });
  assert.ok(record.impactedSectionIds.includes('1.3'));
  assert.ok(record.impactedSectionIds.includes('4'));
  assert.ok(record.impactedSectionIds.includes('8'));
}

async function testValidationRequiresVisitAnchor() {
  const issues = validateSoAEntityForm(
    'visit',
    { name: 'Unanchored Visit' },
    getProtocolDocument(),
  );
  assert.ok(issues.some((issue) => issue.field === 'anchorId' && issue.severity === 'error'));
}

async function testEmptyStateCopyPresent() {
  clearStudyModel();
  resetSoAKnowledgeForTests();
  resetStudyDesignForTests();
  clearRelevantSectionContent();
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missingInputs.length > 0);
  assert.ok(readiness.suggestedNextActions.some((action) => /study design|first-pass/i.test(action)));
}

async function main() {
  await testGenerateFirstPassHiddenWhenNoKnowledge();
  await testGenerateFirstPassReadyWithStudyDesign();
  await testEnrichmentHiddenBeforeFirstPass();
  await testEnrichmentReadyAfterKnowledgeExists();
  await testAddVisitCreatesVisit();
  await testAddAssessmentCreatesAssessment();
  await testAddScheduleRuleLinksAssessmentAndVisit();
  await testManualEditsUpdateKnowledgeGraph();
  await testManualEditsCreateNarrativeSyncImpact();
  await testValidationRequiresVisitAnchor();
  await testEmptyStateCopyPresent();
  console.log('test-soa-manual-authoring-ux: PASS');
}

void main();
