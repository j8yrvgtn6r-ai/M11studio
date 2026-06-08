import assert from 'node:assert/strict';

import { getKnowledgeGraph, resetKnowledgeGraphForTests } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument, mutateProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import {
  addManualStudyDesignEntity,
  applyStudyDesignKnowledgeGraphPatchSafely,
  buildKnowledgeGraphPatchFromStudyDesign,
  buildSoAExportHintsFromStudyDesign,
  buildSoAKnowledgeFromStudyDesign,
  calculateStudyDesignHealthScore,
  createEmptyStudyDesign,
  createNarrativeImpactProposal,
  detectNarrativeChangesForStudyDesign,
  detectStudyDesignConflicts,
  formatNarrativeImpactMessage,
  getStudyDesign,
  resetStudyDesignForTests,
  resetStudyDesignProposalsForTests,
  setStudyDesign,
  updateManualStudyDesignEntity,
  validateStudyDesign,
} from '../src/app/domain/study-design';

function provenance() {
  const timestamp = new Date().toISOString();
  return { source: 'manualEntry' as const, createdAt: timestamp, updatedAt: timestamp };
}

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

function testVisitWindowsValidation() {
  resetStudyDesignForTests();
  const design = createEmptyStudyDesign();
  design.epochs.push({ id: 'epoch-1', name: 'Treatment', provenance: provenance() });
  design.visits.push({
    id: 'visit-day-1',
    name: 'Day 1',
    visitClass: 'scheduled',
    epochId: 'epoch-1',
    nominalDay: 1,
    windowBefore: 3,
    windowAfter: 3,
    windowUnit: 'days',
    provenance: provenance(),
  });
  design.visits.push({
    id: 'visit-bad-window',
    name: 'Bad Window',
    visitClass: 'scheduled',
    epochId: 'epoch-1',
    nominalDay: 8,
    windowBefore: -1,
    windowAfter: 3,
    provenance: provenance(),
  });
  setStudyDesign(design);

  const issues = validateStudyDesign(design).issues;
  assert.ok(issues.some((issue) => /negative window/i.test(issue.message)));
  assert.ok(!issues.some((issue) => /Day 1/i.test(issue.message) && /negative/i.test(issue.message)));
}

function testScheduleAnchorsAndOffsetVisits() {
  resetStudyDesignForTests();
  assert.equal(
    addManualStudyDesignEntity('anchor', { name: 'First Dose', type: 'firstDose' }).success,
    true,
  );
  const anchorId = getStudyDesign()!.anchors![0]!.id;
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;

  assert.equal(
    addManualStudyDesignEntity('visit', {
      name: 'Week 4',
      visitClass: 'scheduled',
      epochId,
      scheduleAnchorId: anchorId,
      offsetDays: 28,
      offsetUnit: 'days',
    }).success,
    true,
  );

  const visit = getStudyDesign()!.visits[0]!;
  assert.equal(visit.scheduleAnchorId, anchorId);
  assert.equal(visit.offsetDays, 28);

  const hints = buildSoAExportHintsFromStudyDesign();
  assert.ok(hints.timingSuggestions.some((entry) => /Week 4/i.test(entry) && /First Dose/i.test(entry)));
}

function testMilestoneModelFields() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Baseline', visitClass: 'scheduled', epochId });
  const visitId = getStudyDesign()!.visits[0]!.id;

  assert.equal(
    addManualStudyDesignEntity('milestone', {
      name: 'Randomization',
      milestoneType: 'randomization',
      description: 'Subject randomization after screening',
      anchorVisitId: visitId,
      offsetDays: 0,
    }).success,
    true,
  );

  const milestone = getStudyDesign()!.milestones[0]!;
  assert.equal(milestone.milestoneType, 'randomization');
  assert.equal(milestone.description, 'Subject randomization after screening');
  assert.equal(milestone.anchorVisitId, visitId);
}

function testTimelineModelStructure() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Screening' });
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  addManualStudyDesignEntity('milestone', { name: 'First Dose', milestoneType: 'firstDose' });

  const design = getStudyDesign()!;
  assert.ok(design.epochs.length >= 2);
  assert.ok(design.milestones.some((item) => item.milestoneType === 'firstDose'));
  assert.ok(Array.isArray(design.anchors));
}

function testConflictEngine() {
  resetStudyDesignForTests();
  const design = createEmptyStudyDesign();
  design.epochs.push({ id: 'epoch-1', name: 'Treatment', provenance: provenance() });
  design.milestones.push(
    {
      id: 'ms-1',
      name: 'Randomization',
      milestoneType: 'randomization',
      provenance: provenance(),
    },
    {
      id: 'ms-2',
      name: 'Randomization',
      milestoneType: 'custom',
      provenance: provenance(),
    },
  );
  design.visits.push(
    {
      id: 'visit-a',
      name: 'Day 1',
      visitClass: 'scheduled',
      epochId: 'epoch-1',
      nominalDay: 1,
      windowBefore: 3,
      windowAfter: 3,
      provenance: provenance(),
    },
    {
      id: 'visit-b',
      name: 'Day 2',
      visitClass: 'scheduled',
      epochId: 'epoch-1',
      nominalDay: 2,
      windowBefore: 5,
      windowAfter: 5,
      provenance: provenance(),
    },
  );
  design.activities.push({
    id: 'act-1',
    name: 'Vital Signs',
    activityType: 'assessment',
    provenance: provenance(),
  });

  const conflicts = detectStudyDesignConflicts(design);
  assert.ok(conflicts.some((entry) => entry.kind === 'duplicateMilestone'));
  assert.ok(conflicts.some((entry) => entry.kind === 'visitOverlap'));
  assert.ok(conflicts.some((entry) => entry.kind === 'unscheduledActivity'));
}

function testNarrativeToStudyDesignSyncProposal() {
  resetStudyDesignForTests();
  resetStudyDesignProposalsForTests();
  seedManualSectionContent(
    '5',
    'Subjects attend visits every 4 weeks. Vital signs collected at every visit. Randomization occurs after Screening.',
  );

  const proposal = detectNarrativeChangesForStudyDesign(null);
  assert.ok(proposal);
  assert.equal(proposal!.status, 'proposed');
  assert.ok(proposal!.addedItems.length > 0 || proposal!.modifiedItems.length > 0);
  assert.ok(
    proposal!.addedItems.some((item) => item.kind === 'visit' || item.kind === 'activity' || item.kind === 'milestone'),
  );
  assert.ok(proposal!.proposedDesign.visits.length > 0 || proposal!.proposedDesign.activities.length > 0);
}

function testStudyDesignToNarrativeImpactProposal() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Week 8', visitClass: 'scheduled', epochId });

  const visit = getStudyDesign()!.visits[0]!;
  const proposal = createNarrativeImpactProposal({
    entityKind: 'visit',
    entityId: visit.id,
    entityName: visit.name,
    changeType: 'modified',
  });

  assert.equal(formatNarrativeImpactMessage(proposal), 'Protocol narrative may need updating.');
  assert.ok(proposal.impactedSectionIds.includes('4'));
  assert.ok(proposal.impactedSectionIds.some((sectionId) => ['5', '6', '8', '9'].includes(sectionId)));
}

function testHealthScore() {
  resetStudyDesignForTests();
  const empty = calculateStudyDesignHealthScore(null);
  assert.equal(empty.score, 0);
  assert.equal(empty.grade, 'D');

  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', {
    name: 'Day 1',
    visitClass: 'scheduled',
    epochId,
    nominalDay: 1,
    windowBefore: 3,
    windowAfter: 3,
  });
  addManualStudyDesignEntity('activity', { name: 'ECG', activityType: 'assessment' });
  addManualStudyDesignEntity('milestone', { name: 'First Dose', milestoneType: 'firstDose' });

  const score = calculateStudyDesignHealthScore();
  assert.ok(score.score > 0);
  assert.ok(['A', 'B', 'C', 'D'].includes(score.grade));
  assert.ok(score.dimensions.structureCompleteness > 0);
}

function testKnowledgeGraphIntegration() {
  resetStudyDesignForTests();
  resetKnowledgeGraphForTests();

  addManualStudyDesignEntity('anchor', { name: 'Randomization', type: 'randomization' });
  const anchorId = getStudyDesign()!.anchors![0]!.id;
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', {
    name: 'Week 4',
    visitClass: 'scheduled',
    epochId,
    scheduleAnchorId: anchorId,
    offsetDays: 28,
    nominalDay: 28,
  });
  addManualStudyDesignEntity('activity', { name: 'Labs', activityType: 'assessment' });
  const activityId = getStudyDesign()!.activities[0]!.id;
  const visitId = getStudyDesign()!.visits[0]!.id;

  const design = getStudyDesign()!;
  design.scheduleRules.push({
    id: 'rule-1',
    visitId,
    activityId,
    required: true,
    provenance: provenance(),
  });
  setStudyDesign(design);
  applyStudyDesignKnowledgeGraphPatchSafely(design);

  const patch = buildKnowledgeGraphPatchFromStudyDesign(design);
  assert.ok(patch.entities?.some((entity) => entity.metadata?.studyDesignKind === 'scheduleAnchor'));
  assert.ok(patch.entities?.some((entity) => entity.entityType === 'visit'));
  assert.ok(patch.relationships?.some((rel) => rel.relationshipType === 'anchored_to'));
  assert.ok(patch.relationships?.some((rel) => rel.relationshipType === 'scheduled_at'));
  assert.ok(patch.relationships?.some((rel) => rel.relationshipType === 'belongs_to'));

  const graph = getKnowledgeGraph();
  assert.ok(graph);
  assert.ok(graph!.entities.some((entity) => entity.id === visitId));
}

function testSoAGenerationUsesStudyDesignV2Fields() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('anchor', { name: 'First Dose', type: 'firstDose' });
  const anchorId = getStudyDesign()!.anchors![0]!.id;
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', {
    name: 'Week 8',
    visitClass: 'scheduled',
    epochId,
    nominalWeek: 8,
    windowBefore: 1,
    windowAfter: 1,
    windowUnit: 'weeks',
    scheduleAnchorId: anchorId,
    offsetDays: 56,
  });
  addManualStudyDesignEntity('milestone', { name: 'End of Treatment', milestoneType: 'endOfTreatment' });

  const model = buildSoAKnowledgeFromStudyDesign();
  assert.ok(model.visits.some((visit) => /week 8/i.test(visit.name)));
  assert.ok(model.extractionNotes.some((note) => /study design/i.test(note)));

  const hints = buildSoAExportHintsFromStudyDesign();
  assert.ok(hints.milestoneRowSuggestions.some((row) => /End of Treatment/i.test(row)));
  assert.ok(hints.footnoteSuggestions.length > 0 || hints.timingSuggestions.length > 0);
}

function testUpdateVisitWindowsViaStore() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Day 1', visitClass: 'scheduled', epochId });
  const visitId = getStudyDesign()!.visits[0]!.id;

  const result = updateManualStudyDesignEntity('visit', visitId, {
    nominalDay: 1,
    windowBefore: 7,
    windowAfter: 3,
    windowUnit: 'days',
  });
  assert.equal(result.success, true);

  const updated = getStudyDesign()!.visits.find((visit) => visit.id === visitId)!;
  assert.equal(updated.windowBefore, 7);
  assert.equal(updated.windowAfter, 3);
}

async function main() {
  testVisitWindowsValidation();
  testScheduleAnchorsAndOffsetVisits();
  testMilestoneModelFields();
  testTimelineModelStructure();
  testConflictEngine();
  testNarrativeToStudyDesignSyncProposal();
  testStudyDesignToNarrativeImpactProposal();
  testHealthScore();
  testKnowledgeGraphIntegration();
  testSoAGenerationUsesStudyDesignV2Fields();
  testUpdateVisitWindowsViaStore();
  console.log('test-study-design-v2: PASS');
}

void main();
