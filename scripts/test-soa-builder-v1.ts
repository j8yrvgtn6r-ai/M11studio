import assert from 'node:assert/strict';

import { resetKnowledgeGraphForTests, getKnowledgeGraph } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument, mutateProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import { getProtocolImportState } from '../src/app/domain/protocol/import/protocolImportStore';
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
import {
  deleteManualSoAEntity,
  saveManualSoAEntity,
} from '../src/app/domain/soa-knowledge/soaManualAuthoringService';
import {
  validateScheduledAssessmentNarrativeCoverage,
  validateSoAKnowledgeIntegrity,
} from '../src/app/domain/soa-knowledge/soaKnowledgeIntegrity';
import {
  getCurrentSoANarrativeSyncProposal,
  resetSoANarrativeSyncStoreForTests,
} from '../src/app/domain/soa-knowledge/soaNarrativeSyncStore';
import { ensureDefaultScreeningAnchor } from '../src/app/domain/protocol/store/visitScheduleMutations';
import { clearStudyModel, rebuildStudyModel, setStudyModelPhase } from '../src/app/domain/study-model/studyModelStore';
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

function seedImportDrafts() {
  getProtocolImportState().sectionDrafts = {
    '1.3': {
      sectionId: '1.3',
      title: 'Schedule of Activities',
      generatedText: 'Schedule of activities table describes visit timing.',
      contentOrigin: 'imported',
      workflowState: 'importedUnvalidated',
    } as never,
    '8': {
      sectionId: '8',
      title: 'Assessments and Procedures',
      generatedText: 'Assessments include vital signs.',
      contentOrigin: 'imported',
      workflowState: 'importedUnvalidated',
    } as never,
  };
}

function clearRelevantSectionContent() {
  mutateProtocolDocument((draft) => {
    draft.elements = (draft.elements ?? []).filter(
      (element) => !['1.3', '4', '6', '8', '9', '10'].includes(element.sectionId),
    );
  });
  getProtocolImportState().sectionDrafts = {};
}

async function testFirstPassHiddenWhenNoSignals() {
  clearStudyModel();
  resetSoAKnowledgeForTests();
  resetStudyDesignForTests();
  resetKnowledgeGraphForTests();
  clearRelevantSectionContent();
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, false);
}

async function testFirstPassNotReadyWithSectionContentOnly() {
  clearStudyModel();
  resetSoAKnowledgeForTests();
  resetStudyDesignForTests();
  resetKnowledgeGraphForTests();
  clearRelevantSectionContent();
  seedManualSectionContent('8', 'Laboratory assessments occur at screening and baseline.');
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, false);
}

async function testFirstPassReadyWithStudyDesign() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const readiness = evaluateSoAFirstPassReadiness();
  assert.equal(readiness.ready, true);
}

async function testEnrichmentHiddenBeforeFirstPass() {
  resetSoAKnowledgeForTests();
  const readiness = evaluateSoAEnrichmentReadiness();
  assert.equal(readiness.ready, false);
}

async function testAddEpochArmVisitAssessmentRule() {
  resetSoAKnowledgeForTests();
  resetKnowledgeGraphForTests();

  const epochResult = saveManualSoAEntity('epoch', {
    name: 'Treatment Epoch',
    epochType: 'treatment',
    order: 1,
    description: 'On-treatment period',
  });
  assert.equal(epochResult.success, true);

  const armResult = saveManualSoAEntity('arm', {
    name: 'Active Arm',
    armType: 'experimental',
    intervention: 'Drug A',
  });
  assert.equal(armResult.success, true);

  const anchorId = ensureDefaultScreeningAnchor();
  const visitResult = saveManualSoAEntity('visit', {
    name: 'Week 2 Visit',
    anchorId,
    visitType: 'treatment',
    epochId: epochResult.entityId,
    required: true,
  });
  assert.equal(visitResult.success, true);

  const assessmentResult = saveManualSoAEntity('assessment', {
    name: 'Chemistry Panel',
    category: 'laboratory',
  });
  assert.equal(assessmentResult.success, true);

  const visitId = getProtocolDocument().visitSchedule.visitDefinitions.find((visit) => /week 2/i.test(visit.name))!.id;
  const assessmentId = getProtocolDocument().soaAssessmentDefinitions!.find((item) => /chemistry/i.test(item.label))!.id;

  const ruleResult = saveManualSoAEntity('scheduleRule', {
    name: 'Chemistry at Week 2',
    assessmentId,
    visitDefinitionId: visitId,
    required: true,
  });
  assert.equal(ruleResult.success, true);

  const knowledge = getSoAKnowledge()!;
  assert.ok(knowledge.epochs.some((item) => /treatment epoch/i.test(item.name)));
  assert.ok(knowledge.arms.some((item) => /active arm/i.test(item.name)));
  assert.ok(knowledge.visits.some((item) => /week 2/i.test(item.name)));
  assert.ok(knowledge.assessments.some((item) => /chemistry/i.test(item.name)));
  assert.ok(knowledge.scheduleRules.some((rule) => rule.assessmentId === assessmentId && rule.visitId === visitId));
}

async function testManualEditPatchesKnowledgeAndGraph() {
  resetSoAKnowledgeForTests();
  resetKnowledgeGraphForTests();
  saveManualSoAEntity('assessment', { name: 'Spirometry', category: 'efficacy' });
  const knowledge = getSoAKnowledge();
  assert.ok(knowledge?.assessments.some((item) => /spirometry/i.test(item.name)));
  const graph = getKnowledgeGraph();
  assert.ok(graph?.entities.some((entity) => /spirometry/i.test(entity.name)));
}

async function testNarrativeSyncProposalAfterManualEdit() {
  resetSoAKnowledgeForTests();
  resetSoANarrativeSyncStoreForTests();
  seedImportDrafts();

  saveManualSoAEntity('visit', {
    name: 'Follow-up Visit',
    anchorId: ensureDefaultScreeningAnchor(),
    visitType: 'follow-up',
    required: true,
  });

  const proposal = getCurrentSoANarrativeSyncProposal();
  assert.ok(proposal, 'Expected narrative sync proposal after manual SoA edit');
  assert.ok(
    proposal!.proposedNarrativeUpdates.some((update) =>
      /may require updates to Section/i.test(update.suggestedNote ?? ''),
    ),
  );
}

async function testValidationDetectsOrphanAssessment() {
  resetSoAKnowledgeForTests();
  setSoAKnowledge(createEmptySoAKnowledgeModel(getProtocolDocument().id));
  saveManualSoAEntity('assessment', { name: 'Orphan Lab', category: 'laboratory' });
  const issues = validateSoAKnowledgeIntegrity();
  assert.ok(issues.some((issue) => /orphan/i.test(issue.message)));
}

async function testValidationDetectsInvalidScheduleRule() {
  resetSoAKnowledgeForTests();
  const model = createEmptySoAKnowledgeModel(getProtocolDocument().id);
  model.scheduleRules.push({
    id: 'invalid-rule',
    assessmentId: 'missing-assessment',
    visitId: 'missing-visit',
    required: true,
    sourceSectionIds: ['1.3'],
    inferenceSource: 'user-created',
  });
  setSoAKnowledge(model);
  const issues = validateSoAKnowledgeIntegrity(model);
  assert.ok(issues.some((issue) => /missing visit|missing assessment|must link visit/i.test(issue.message)));
}

async function testScheduledAssessmentNarrativeCoverageWarning() {
  resetSoAKnowledgeForTests();
  clearRelevantSectionContent();
  seedManualSectionContent('8', 'Only vital signs are collected.');
  const anchorId = ensureDefaultScreeningAnchor();
  saveManualSoAEntity('visit', { name: 'Day 1', anchorId, visitType: 'baseline', required: true });
  saveManualSoAEntity('assessment', { name: 'MRI Scan', category: 'imaging' });
  const visitId = getProtocolDocument().visitSchedule.visitDefinitions.find((visit) => /day 1/i.test(visit.name))!.id;
  const assessmentId = getProtocolDocument().soaAssessmentDefinitions!.find((item) => /mri/i.test(item.label))!.id;
  saveManualSoAEntity('scheduleRule', {
    name: 'MRI at Day 1',
    assessmentId,
    visitDefinitionId: visitId,
    required: true,
  });
  const issues = validateScheduledAssessmentNarrativeCoverage();
  assert.ok(issues.some((issue) => /not described in Section 8/i.test(issue.message)));
}

async function testDeleteEpochFromKnowledge() {
  resetSoAKnowledgeForTests();
  const result = saveManualSoAEntity('epoch', { name: 'Screening', epochType: 'screening', order: 1 });
  assert.equal(result.success, true);
  const deleted = deleteManualSoAEntity('epoch', result.entityId!);
  assert.equal(deleted.success, true);
  assert.ok(!getSoAKnowledge()?.epochs.some((item) => item.id === result.entityId));
}

async function main() {
  void getProtocolImportState();
  await testFirstPassHiddenWhenNoSignals();
  await testFirstPassNotReadyWithSectionContentOnly();
  await testFirstPassReadyWithStudyDesign();
  await testEnrichmentHiddenBeforeFirstPass();
  await testAddEpochArmVisitAssessmentRule();
  await testManualEditPatchesKnowledgeAndGraph();
  await testNarrativeSyncProposalAfterManualEdit();
  await testValidationDetectsOrphanAssessment();
  await testValidationDetectsInvalidScheduleRule();
  await testScheduledAssessmentNarrativeCoverageWarning();
  await testDeleteEpochFromKnowledge();
  console.log('test-soa-builder-v1: PASS');
}

void main();
