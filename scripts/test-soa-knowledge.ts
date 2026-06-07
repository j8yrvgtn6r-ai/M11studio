import assert from 'node:assert/strict';

import {
  isSupabaseConfigured,
  RepositoryUnavailableError,
  resetStorageProviderForTests,
  resetSupabaseClientForTests,
  soaEntityRepository,
  soaKnowledgeRepository,
  soaScheduleRuleRepository,
} from '../src/app/backend';
import {
  buildKnowledgeGraphPatchFromSoAKnowledge,
  buildSoAKnowledgeFromProtocolSections,
  clearSoAKnowledge,
  createSoANarrativeImpactRecord,
  createSoAProposal,
  getCurrentSoAProposal,
  getNarrativeSectionsImpactedBySoAChange,
  getSoAKnowledge,
  patchSoAKnowledge,
  resetSoAKnowledgeForTests,
  resetSoAProposalStoreForTests,
  setSoAKnowledge,
} from '../src/app/domain/soa-knowledge';
import { resetImportWorkspace, resetProject } from '../src/app/domain/protocol/import/projectReset';
import { createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import { evaluateSoAScheduleExtraction, countSoAKnowledgePatch } from '../src/app/agents/soaAgentRules';
import { getProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';

const SOA_KNOWLEDGE_STORAGE_KEY = 'm11-soa-knowledge-v1';
const SOA_PROPOSAL_STORAGE_KEY = 'm11-soa-proposal-v1';

function assertSoAKnowledgeStorageCleared(): void {
  assert.equal(getSoAKnowledge(), null);
  if (typeof localStorage !== 'undefined') {
    assert.equal(localStorage.getItem(SOA_KNOWLEDGE_STORAGE_KEY), null);
  }
}

function assertSoAProposalStorageCleared(): void {
  assert.equal(getCurrentSoAProposal(), null);
  if (typeof localStorage !== 'undefined') {
    assert.equal(localStorage.getItem(SOA_PROPOSAL_STORAGE_KEY), null);
  }
}

function seedStaleSoAKnowledge(): void {
  patchSoAKnowledge({
    visits: [{ id: 'stale-visit-a', name: 'STALE-VISIT-PROTOCOL-A', order: 0, sourceSectionIds: ['1.3'] }],
    assessments: [{ id: 'stale-assessment-a', name: 'STALE-ASSESSMENT-A', category: 'other', sourceSectionIds: ['8'] }],
  });
  assert.ok(getSoAKnowledge()?.visits.some((visit) => visit.name === 'STALE-VISIT-PROTOCOL-A'));
}

function seedStaleSoAProposal(): void {
  const patch = {
    visits: [{ id: 'stale-proposal-visit', name: 'STALE-VISIT-PROTOCOL-A', order: 0, sourceSectionIds: ['1.3'] }],
  };
  createSoAProposal({
    trigger: 'import',
    summary: 'STALE-PROPOSAL-PROTOCOL-A',
    soaKnowledgePatch: patch,
    impactedNarrativeSections: [{ sectionId: '1.3', reason: 'Stale proposal from prior import' }],
    diagnostics: ['stale diagnostic'],
    warnings: [],
    sourceSectionIds: ['1.3'],
    counts: countSoAKnowledgePatch(patch),
  });
  assert.equal(getCurrentSoAProposal()?.summary, 'STALE-PROPOSAL-PROTOCOL-A');
}

function testStoreSetPatchClear() {
  resetSoAKnowledgeForTests();
  assert.equal(getSoAKnowledge(), null);

  const base = createEmptySoAKnowledgeModel('protocol-test');
  setSoAKnowledge(base);
  assert.ok(getSoAKnowledge()?.id.includes('protocol-test'));

  patchSoAKnowledge({
    visits: [{ id: 'visit-1', name: 'Screening', order: 0, sourceSectionIds: ['1.3'] }],
  });
  assert.equal(getSoAKnowledge()?.visits.length, 1);

  clearSoAKnowledge();
  assert.equal(getSoAKnowledge(), null);
}

function testExtractVisitsFromCycleDayText() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '1.3',
      title: 'Schedule of Activities',
      text: 'Assessments occur at Cycle 1 Day 1 and Week 4 visits.',
    },
  ]);
  assert.ok(model.visits.some((visit) => /cycle 1 day 1/i.test(visit.name)));
  assert.ok(model.visits.some((visit) => /week 4/i.test(visit.name)));
}

function testExtractAssessmentsFromSection8() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '8',
      title: 'Trial Assessments and Procedures',
      text: 'Vital signs, physical examination, clinical laboratory tests, and ECG will be collected.',
    },
  ]);
  assert.ok(model.assessments.some((assessment) => /vital signs/i.test(assessment.name)));
  assert.ok(model.assessments.some((assessment) => /physical examination/i.test(assessment.name)));
}

function testSafetyAssessmentCategory() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '9',
      title: 'Adverse Events',
      text: 'Adverse events and SAE reporting requirements apply throughout the study.',
    },
  ]);
  const adverseEvents = model.assessments.find((assessment) => /adverse events/i.test(assessment.name));
  assert.ok(adverseEvents);
  assert.equal(adverseEvents?.category, 'adverseEvents');
}

function testImagingAssessmentCategory() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '8.2',
      title: 'Imaging',
      text: 'MRI will be performed at selected visits.',
    },
  ]);
  const imaging = model.assessments.find((assessment) => assessment.category === 'imaging');
  assert.ok(imaging);
}

function testExplicitScheduleRuleLinksAssessmentToVisit() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '8',
      title: 'Assessments',
      text: 'Vital signs will be performed at each visit during Cycle 1 Day 1 and Week 4 visits.',
    },
  ]);
  assert.ok(model.scheduleRules.length > 0);
  assert.ok(model.scheduleRules.every((rule) => rule.assessmentId && rule.visitId));
}

function testAmbiguousTimingStoredAsDiagnostic() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '1.3',
      title: 'Schedule of Activities',
      text: 'Visits occur approximately 14 days apart when clinically feasible.',
    },
  ]);
  assert.ok(
    model.ambiguousScheduleStatements.length > 0 || model.unmappedTimingReferences.length > 0,
    'expected ambiguous or unmapped timing diagnostic',
  );
}

function testNarrativeImpactForAssessmentTimingChange() {
  const sections = getNarrativeSectionsImpactedBySoAChange({
    kind: 'assessmentSchedule',
    entityName: 'Vital Signs',
  });
  assert.ok(sections.includes('1.3'));
  assert.ok(sections.includes('8'));

  const record = createSoANarrativeImpactRecord({
    kind: 'assessmentSchedule',
    entityName: 'Vital Signs',
  });
  assert.ok(record.impactedSectionIds.includes('1.3'));
  assert.ok(record.reasons['1.3']);
}

function testGraphBridgeCreatesScheduledAtRelationship() {
  const model = buildSoAKnowledgeFromProtocolSections([
    {
      sectionId: '8',
      title: 'Assessments',
      text: 'Laboratory assessments at each visit during Screening and Baseline visits.',
    },
  ]);
  const patch = buildKnowledgeGraphPatchFromSoAKnowledge(model);
  assert.ok((patch.relationships ?? []).some((relationship) => relationship.relationshipType === 'scheduled_at'));
}

async function testSoAKnowledgeDoesNotSurviveNewProject() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  seedStaleSoAKnowledge();
  await resetProject();
  assertSoAKnowledgeStorageCleared();
}

async function testSoAProposalDoesNotSurviveNewProject() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  seedStaleSoAProposal();
  await resetProject();
  assertSoAProposalStorageCleared();
}

function testSoAKnowledgeDoesNotSurviveReplacementImport() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  seedStaleSoAKnowledge();
  resetImportWorkspace();
  assertSoAKnowledgeStorageCleared();

  const output = evaluateSoAScheduleExtraction({
    protocolSections: [
      {
        sectionId: '1.3',
        title: 'Schedule of Activities',
        text: 'Visits include Screening, Baseline, and End of Treatment only.',
      },
    ],
    trigger: 'import',
    existingSoAConfiguration: getProtocolDocument(),
    soaKnowledgeModel: getSoAKnowledge() ?? undefined,
  });

  const visitNames = (output.soaKnowledgePatch.visits ?? []).map((visit) => visit.name);
  assert.ok(!visitNames.includes('STALE-VISIT-PROTOCOL-A'));
  assert.ok(visitNames.some((name) => /screening/i.test(name)));
}

function testSoAProposalDoesNotSurviveReplacementImport() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  seedStaleSoAProposal();
  resetImportWorkspace();
  assertSoAProposalStorageCleared();
}

async function testBackendRepositoriesRequireSupabase() {
  resetSupabaseClientForTests();
  resetStorageProviderForTests();
  assert.equal(isSupabaseConfigured(), false);

  for (const repository of [soaKnowledgeRepository, soaEntityRepository, soaScheduleRuleRepository]) {
    let threw = false;
    try {
      await repository.listByProtocol('00000000-0000-0000-0000-000000000001');
    } catch (error) {
      threw = error instanceof RepositoryUnavailableError;
    }
    assert.ok(threw, `${repository.constructor.name} should throw when Supabase is unconfigured`);
  }
}

async function main() {
  testStoreSetPatchClear();
  testExtractVisitsFromCycleDayText();
  testExtractAssessmentsFromSection8();
  testSafetyAssessmentCategory();
  testImagingAssessmentCategory();
  testExplicitScheduleRuleLinksAssessmentToVisit();
  testAmbiguousTimingStoredAsDiagnostic();
  testNarrativeImpactForAssessmentTimingChange();
  testGraphBridgeCreatesScheduledAtRelationship();
  await testSoAKnowledgeDoesNotSurviveNewProject();
  await testSoAProposalDoesNotSurviveNewProject();
  testSoAKnowledgeDoesNotSurviveReplacementImport();
  testSoAProposalDoesNotSurviveReplacementImport();
  await testBackendRepositoriesRequireSupabase();
  console.log('test:soa-knowledge — all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
