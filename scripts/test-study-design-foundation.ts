import assert from 'node:assert/strict';

import { resetKnowledgeGraphForTests, patchKnowledgeGraph } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument, mutateProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import { evaluateSoAFirstPassReadiness, firstPassSoAExists } from '../src/app/domain/soa-knowledge/soaReadinessEvaluator';
import {
  addManualStudyDesignEntity,
  buildAndApplyStudyDesignFromSources,
  buildSoAKnowledgeFromStudyDesign,
  buildStudyDesignFromKnowledgeGraph,
  createEmptyStudyDesign,
  getStudyDesign,
  hasStudyDesign,
  resetStudyDesignForTests,
  setStudyDesign,
  validateStudyDesign,
} from '../src/app/domain/study-design';
import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import { buildSoAKnowledgeFromProtocolSections } from '../src/app/domain/soa-knowledge/soaKnowledgeBuilder';

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

async function testCreateArmEpochVisitActivityMilestone() {
  resetStudyDesignForTests();
  assert.equal(hasStudyDesign(), false);

  assert.equal(addManualStudyDesignEntity('epoch', { name: 'Treatment' }).success, true);
  const epochId = getStudyDesign()!.epochs[0]!.id;

  assert.equal(addManualStudyDesignEntity('arm', { name: 'Drug A', type: 'treatment' }).success, true);
  assert.equal(
    addManualStudyDesignEntity('visit', { name: 'Week 4', visitClass: 'scheduled', epochId }).success,
    true,
  );
  assert.equal(
    addManualStudyDesignEntity('activity', { name: 'Vital Signs', activityType: 'assessment' }).success,
    true,
  );
  assert.equal(
    addManualStudyDesignEntity('milestone', { name: 'Randomization', milestoneType: 'randomization' }).success,
    true,
  );

  const design = getStudyDesign()!;
  assert.equal(design.arms.length, 1);
  assert.equal(design.epochs.length, 1);
  assert.equal(design.visits.length, 1);
  assert.equal(design.activities.length, 1);
  assert.equal(design.milestones.length, 1);
  assert.equal(hasStudyDesign(), true);
}

function seedVisitWithoutEpoch() {
  const design = createEmptyStudyDesign();
  design.visits.push({
    id: 'visit-no-epoch',
    name: 'Unanchored Visit',
    visitClass: 'scheduled',
    provenance: { source: 'manualEntry', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
  setStudyDesign(design);
}

async function testValidationDetectsMissingEpochOnVisit() {
  resetStudyDesignForTests();
  seedVisitWithoutEpoch();
  const issues = validateStudyDesign(getStudyDesign()).issues;
  assert.ok(issues.some((issue) => /no epoch/i.test(issue.message)));
}

async function testSynchronizationProposalFromKnowledgeGraph() {
  resetStudyDesignForTests();
  resetKnowledgeGraphForTests();
  patchKnowledgeGraph({
    entities: [
      {
        id: 'kg-arm-1',
        entityType: 'arm',
        name: 'Placebo Arm',
        normalizedName: 'placebo arm',
        aliases: [],
        sourceSectionIds: ['4'],
        sourceDocumentIds: [],
        metadata: { armType: 'placebo' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'kg-visit-1',
        entityType: 'visit',
        name: 'Screening Visit',
        normalizedName: 'screening visit',
        aliases: [],
        sourceSectionIds: ['1.3'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  const proposal = buildStudyDesignFromKnowledgeGraph(getProtocolDocument().id);
  assert.equal(proposal.status, 'proposed');
  assert.ok(proposal.addedItems.length > 0);
  assert.ok(proposal.proposedDesign.arms.some((arm) => /placebo/i.test(arm.name)));
}

async function testBuildStudyDesignFromSources() {
  resetStudyDesignForTests();
  seedManualSectionContent('4', 'Screening and treatment epochs include baseline and week 4 visits.');
  seedManualSectionContent('8', 'Vital signs and laboratory assessments occur at each visit.');

  const proposal = buildAndApplyStudyDesignFromSources(getProtocolDocument().id);
  assert.equal(proposal.status, 'accepted');
  assert.equal(hasStudyDesign(), true);
  assert.ok(getStudyDesign()!.detectionSources.includes('protocolNarrative'));
}

async function testSoAGenerationAdapterUsesStudyDesign() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Day 1', visitClass: 'scheduled', epochId });
  addManualStudyDesignEntity('activity', { name: 'ECG', activityType: 'assessment' });

  const fromDesign = buildSoAKnowledgeFromStudyDesign();
  assert.ok(fromDesign.visits.some((visit) => /day 1/i.test(visit.name)));
  assert.ok(fromDesign.activities.some((activity) => /ecg/i.test(activity.name)));

  const narrative = buildSoAKnowledgeFromProtocolSections(
    [{ sectionId: '8', title: 'Assessments', text: 'Additional narrative-only assessment.' }],
    getProtocolDocument().id,
  );
  const merged = applySoAKnowledgePatch(createEmptySoAKnowledgeModel(getProtocolDocument().id), {
    ...fromDesign,
    assessments: [...fromDesign.assessments, ...narrative.assessments],
  });
  assert.ok(merged.visits.length > 0);
  assert.ok(merged.assessments.length > 0);
}

async function testFirstPassGatingRequiresStudyDesign() {
  resetStudyDesignForTests();
  seedManualSectionContent('8', 'Section content alone should not unlock first-pass generation.');
  assert.equal(evaluateSoAFirstPassReadiness().ready, false);

  addManualStudyDesignEntity('epoch', { name: 'Screening' });
  assert.equal(evaluateSoAFirstPassReadiness().ready, true);
}

async function testEnrichmentGatingRequiresFirstPass() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  assert.equal(firstPassSoAExists(), false);
}

async function main() {
  await testCreateArmEpochVisitActivityMilestone();
  await testValidationDetectsMissingEpochOnVisit();
  await testSynchronizationProposalFromKnowledgeGraph();
  await testBuildStudyDesignFromSources();
  await testSoAGenerationAdapterUsesStudyDesign();
  await testFirstPassGatingRequiresStudyDesign();
  await testEnrichmentGatingRequiresFirstPass();
  console.log('test-study-design-foundation: PASS');
}

void main();
