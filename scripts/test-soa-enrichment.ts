import assert from 'node:assert/strict';

import {
  acceptCurrentSoAEnrichmentProposal,
  buildDeterministicBaselineModel,
  buildFixtureSoAEnrichmentResponse,
  buildSoAEnrichmentProposal,
  parseSoAEnrichmentLlmResponse,
  rejectCurrentSoAEnrichmentProposal,
  runSoAEnrichment,
  sanitizeSoAEnrichmentResponse,
} from '../src/app/agents';
import {
  resetSoAEnrichmentStoreForTests,
  resetSoAKnowledgeForTests,
} from '../src/app/domain/soa-knowledge';
import {
  isSupabaseConfigured,
  RepositoryUnavailableError,
  resetStorageProviderForTests,
  resetSupabaseClientForTests,
  soaEnrichmentProposalRepository,
} from '../src/app/backend';
import { resetKnowledgeGraphForTests } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolImportState } from '../src/app/domain/protocol/import/protocolImportStore';
import { getProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import { createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import { getSoAKnowledge, patchSoAKnowledge, setSoAKnowledge } from '../src/app/domain/soa-knowledge/soaKnowledgeStore';
import { getCurrentSoAEnrichmentProposal } from '../src/app/domain/soa-knowledge/soaEnrichmentStore';

const scheduleSections = [
  {
    sectionId: '1.3',
    title: 'Schedule of Activities',
    text: 'Visits include Screening and Cycle 1 Day 1. Tumor imaging every 8 weeks until progression if clinically indicated. A follow-up visit occurs at study completion.',
  },
  {
    sectionId: '8',
    title: 'Assessments',
    text: 'Radiographic assessment and vital signs will be performed. Assessments occur if clinically indicated.',
  },
];

function seedImportDrafts(): void {
  getProtocolImportState().sectionDrafts = {
    '1.3': {
      sectionId: '1.3',
      title: scheduleSections[0].title,
      generatedText: scheduleSections[0].text,
      contentOrigin: 'imported',
      workflowState: 'importedUnvalidated',
    } as never,
    '8': {
      sectionId: '8',
      title: scheduleSections[1].title,
      generatedText: scheduleSections[1].text,
      contentOrigin: 'imported',
      workflowState: 'importedUnvalidated',
    } as never,
  };
}

function testProposalCreatedFromDeterministicBaseline() {
  resetSoAEnrichmentStoreForTests();
  const baseline = buildDeterministicBaselineModel(scheduleSections, getProtocolDocument().id);
  assert.ok(baseline.visits.length > 0 || baseline.assessments.length > 0);
  const fixture = buildFixtureSoAEnrichmentResponse(scheduleSections, baseline);
  const built = buildSoAEnrichmentProposal(
    { protocolSections: scheduleSections, deterministicModel: baseline },
    fixture,
    'fixture',
    'soa-enrichment-fixture-v1',
  );
  assert.equal(built.proposal.status, 'proposed');
  assert.ok(built.proposal.deterministicCounts.assessments >= 0);
  assert.ok(built.proposal.enrichedCounts.timingWindows + built.proposal.enrichedCounts.conditions > 0);
}

function testEvidenceAttachedToEverySuggestion() {
  const baseline = buildDeterministicBaselineModel(scheduleSections, getProtocolDocument().id);
  const fixture = buildFixtureSoAEnrichmentResponse(scheduleSections, baseline);
  const built = buildSoAEnrichmentProposal(
    { protocolSections: scheduleSections, deterministicModel: baseline },
    fixture,
    'fixture',
  );
  for (const collection of [
    built.proposal.proposedVisits,
    built.proposal.proposedAssessments,
    built.proposal.proposedTimingWindows,
    built.proposal.proposedConditions,
    built.proposal.proposedScheduleRules,
  ]) {
    for (const item of collection) {
      assert.ok(item.evidence.length > 0, 'every proposed item must include evidence');
      assert.ok(item.evidence[0].sectionId);
      assert.ok(item.evidence[0].sourceText);
      assert.ok(item.evidence[0].reason);
    }
  }
}

function testMalformedJsonHandledSafely() {
  assert.equal(parseSoAEnrichmentLlmResponse('not-json'), null);
  const baseline = buildDeterministicBaselineModel(scheduleSections, getProtocolDocument().id);
  const sanitized = sanitizeSoAEnrichmentResponse(null, scheduleSections, baseline);
  assert.equal(sanitized.proposedVisits.length, 0);
  assert.ok(sanitized.diagnostics.some((entry) => /Malformed/i.test(entry)));
}

function testUnsupportedInferenceDiscarded() {
  const baseline = buildDeterministicBaselineModel(scheduleSections, getProtocolDocument().id);
  const sanitized = sanitizeSoAEnrichmentResponse(
    {
      visits: [{
        name: 'Invented Visit',
        sectionId: '1.3',
        sourceText: 'this text does not exist in protocol',
        reason: 'unsupported',
      }],
    },
    scheduleSections,
    baseline,
  );
  assert.equal(sanitized.proposedVisits.length, 0);
  assert.ok(sanitized.diagnostics.some((entry) => /Discarded visit/i.test(entry)));
}

function testDuplicateAssessmentsReconciled() {
  const sections = [{ sectionId: '8', title: 'Assessments', text: 'Tumor imaging and radiographic assessment are required at each visit.' }];
  const baseline = buildDeterministicBaselineModel(sections, getProtocolDocument().id);
  const fixture = buildFixtureSoAEnrichmentResponse(sections, baseline);
  assert.ok(
    fixture.assessments?.some((item) => item.inferenceSource === 'llm-reconciled'),
    'fixture should emit reconciled assessment suggestion',
  );
  const built = buildSoAEnrichmentProposal({ protocolSections: sections, deterministicModel: baseline }, fixture, 'fixture');
  assert.ok(
    built.proposal.rationaleEntries.some((entry) => /reconcil/i.test(entry.rationale)) ||
      built.proposal.proposedAssessments.some((item) => item.inferenceSource === 'llm-reconciled') ||
      built.proposal.diagnostics.some((entry) => /reconcil/i.test(entry)),
    'reconciliation should appear in proposal output or diagnostics',
  );
}

function testTimingWindowExtracted() {
  const baseline = buildDeterministicBaselineModel(scheduleSections, getProtocolDocument().id);
  const fixture = buildFixtureSoAEnrichmentResponse(scheduleSections, baseline);
  const built = buildSoAEnrichmentProposal(
    { protocolSections: scheduleSections, deterministicModel: baseline },
    fixture,
    'fixture',
  );
  assert.ok(built.proposal.proposedTimingWindows.some((window) => /every 8 weeks/i.test(window.label)));
}

function testConditionExtracted() {
  const sections = [
    {
      sectionId: '8',
      title: 'Assessments',
      text: 'Optional assessments may be performed at investigator discretion when safety concerns arise.',
    },
  ];
  const baseline = buildDeterministicBaselineModel(sections, getProtocolDocument().id);
  const fixture = buildFixtureSoAEnrichmentResponse(sections, baseline);
  const built = buildSoAEnrichmentProposal({ protocolSections: sections, deterministicModel: baseline }, fixture, 'fixture');
  assert.ok(built.proposal.proposedConditions.some((condition) => /investigator discretion/i.test(condition.label)));
}

async function testAcceptMergesIntoSoAKnowledge() {
  resetSoAKnowledgeForTests();
  resetSoAEnrichmentStoreForTests();
  resetKnowledgeGraphForTests();
  seedImportDrafts();
  setSoAKnowledge(createEmptySoAKnowledgeModel(getProtocolDocument().id));

  await runSoAEnrichment();
  const beforeCount = getSoAKnowledge()?.conditions.length ?? 0;
  const acceptResult = acceptCurrentSoAEnrichmentProposal();
  assert.equal(acceptResult.accepted, true);
  assert.ok((getSoAKnowledge()?.conditions.length ?? 0) >= beforeCount);
  assert.equal(getCurrentSoAEnrichmentProposal()?.status, 'accepted');
}

async function testRejectPreservesCurrentModel() {
  resetSoAKnowledgeForTests();
  resetSoAEnrichmentStoreForTests();
  seedImportDrafts();
  setSoAKnowledge(createEmptySoAKnowledgeModel(getProtocolDocument().id));
  patchSoAKnowledge({ visits: [{ id: 'keep-visit', name: 'Screening', order: 0, sourceSectionIds: ['1.3'], inferenceSource: 'user-created' }] });
  const before = getSoAKnowledge()?.visits.length ?? 0;

  await runSoAEnrichment();
  rejectCurrentSoAEnrichmentProposal();
  assert.equal(getSoAKnowledge()?.visits.length, before);
  assert.equal(getCurrentSoAEnrichmentProposal()?.status, 'rejected');
}

async function testProvenancePreservedOnAccept() {
  resetSoAKnowledgeForTests();
  resetSoAEnrichmentStoreForTests();
  seedImportDrafts();
  setSoAKnowledge(createEmptySoAKnowledgeModel(getProtocolDocument().id));
  await runSoAEnrichment();
  acceptCurrentSoAEnrichmentProposal();
  const model = getSoAKnowledge();
  const enrichedItems = [
    ...(model?.visits ?? []),
    ...(model?.assessments ?? []),
    ...(model?.conditions ?? []),
    ...(model?.timingWindows ?? []),
  ].filter((item) => item.inferenceSource === 'llm-inferred' || item.inferenceSource === 'llm-reconciled');
  assert.ok(enrichedItems.length > 0, 'expected accepted enrichment items with LLM provenance');
  assert.ok(enrichedItems.every((item) => (item.evidence?.length ?? 0) > 0));
}

async function testNarrativeImpactsCreated() {
  resetSoAKnowledgeForTests();
  resetSoAEnrichmentStoreForTests();
  seedImportDrafts();
  await runSoAEnrichment();
  const proposal = getCurrentSoAEnrichmentProposal();
  assert.ok(proposal?.impactedNarrativeSections.some((entry) => entry.sectionId === '1.3' || entry.sectionId === '8'));
}

async function testWorksWithoutSupabase() {
  resetSupabaseClientForTests();
  resetStorageProviderForTests();
  assert.equal(isSupabaseConfigured(), false);
  let threw = false;
  try {
    await soaEnrichmentProposalRepository.listByProtocol('00000000-0000-0000-0000-000000000001');
  } catch (error) {
    threw = error instanceof RepositoryUnavailableError;
  }
  assert.ok(threw, 'SoAEnrichmentProposalRepository should throw when Supabase is unconfigured');
}

async function main() {
  testProposalCreatedFromDeterministicBaseline();
  testEvidenceAttachedToEverySuggestion();
  testMalformedJsonHandledSafely();
  testUnsupportedInferenceDiscarded();
  testDuplicateAssessmentsReconciled();
  testTimingWindowExtracted();
  testConditionExtracted();
  await testAcceptMergesIntoSoAKnowledge();
  await testRejectPreservesCurrentModel();
  await testProvenancePreservedOnAccept();
  await testNarrativeImpactsCreated();
  await testWorksWithoutSupabase();
  console.log('test:soa-enrichment — all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
