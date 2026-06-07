import assert from 'node:assert/strict';

import {
  acceptCurrentSoAProposal,
  evaluateSoAScheduleExtraction,
  runSoAAgent,
  SOA_AGENT_ID,
} from '../src/app/agents';
import { agentManager } from '../src/app/agents/AgentManager';
import { ensureSoAAgentRegistered } from '../src/app/agents/soaAgentRunner';
import { resetKnowledgeGraphForTests, getKnowledgeGraph, patchKnowledgeGraph } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';
import {
  buildKnowledgeGraphPatchFromSoAKnowledge,
  getCurrentSoAProposal,
  getSoAKnowledge,
  patchSoAKnowledge,
  rejectSoAProposal,
  resetSoAKnowledgeForTests,
  resetSoAProposalStoreForTests,
  setSoAKnowledge,
} from '../src/app/domain/soa-knowledge';
import { createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import { getNarrativeSectionsImpactedBySoAChange } from '../src/app/domain/soa-knowledge/soaKnowledgeNarrativeSync';

function section8Text() {
  return 'Vital signs, physical examination, hematology, chemistry, and tumor imaging will be performed. Assessments occur if clinically indicated.';
}

function section13Text() {
  return 'Visits include Screening, Baseline, Cycle 1 Day 1, Cycle 1 Day 15, Week 4, and End of Treatment. Vital signs at each visit during Cycle 1 Day 1 and Week 4 visits.';
}

async function testAgentExtractsVisitsAndAssessments() {
  resetSoAProposalStoreForTests();
  const output = evaluateSoAScheduleExtraction({
    protocolSections: [
      { sectionId: '1.3', title: 'SoA', text: section13Text() },
      { sectionId: '8', title: 'Assessments', text: section8Text() },
    ],
    trigger: 'generateFirstPass',
    existingSoAConfiguration: getProtocolDocument(),
  });
  assert.ok(output.soaKnowledgePatch.visits?.some((visit) => /cycle 1 day 1/i.test(visit.name)));
  assert.ok(output.soaKnowledgePatch.assessments?.some((item) => /vital signs/i.test(item.name)));
  assert.ok(output.soaKnowledgePatch.conditions?.some((item) => /clinically indicated/i.test(item.label)));
}

async function testExplicitScheduleRulesAndAmbiguousDiagnostics() {
  const output = evaluateSoAScheduleExtraction({
    protocolSections: [{ sectionId: '1.3', title: 'SoA', text: section13Text() }],
    trigger: 'manual',
    existingSoAConfiguration: getProtocolDocument(),
  });
  assert.ok((output.proposedScheduleRules?.length ?? 0) > 0);
  const ambiguousOutput = evaluateSoAScheduleExtraction({
    protocolSections: [
      {
        sectionId: '1.3',
        title: 'SoA',
        text: 'Visits occur every 8 weeks approximately when clinically feasible.',
      },
    ],
    trigger: 'manual',
    existingSoAConfiguration: getProtocolDocument(),
  });
  assert.ok(ambiguousOutput.diagnostics.some((entry) => /every 8 weeks|approximately|Interval timing/i.test(entry)));
  assert.equal(ambiguousOutput.proposedScheduleRules.length, 0);
}

async function testProposalCreatedNotAutoApplied() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  ensureSoAAgentRegistered();
  assert.ok(agentManager.getAgent(SOA_AGENT_ID));

  await runSoAAgent({
    trigger: 'generateFirstPass',
    drafts: {
      '1.3': {
        sectionId: '1.3',
        title: 'SoA',
        generatedText: section13Text(),
      } as never,
      '8': {
        sectionId: '8',
        title: 'Assessments',
        generatedText: section8Text(),
      } as never,
    },
  });

  const proposal = getCurrentSoAProposal();
  assert.equal(proposal?.status, 'proposed');
  assert.equal(getSoAKnowledge(), null);
}

async function testAcceptPatchesKnowledgeAndGraph() {
  resetSoAKnowledgeForTests();
  resetKnowledgeGraphForTests();
  resetSoAProposalStoreForTests();
  patchKnowledgeGraph({ entities: [], relationships: [] });

  await runSoAAgent({
    trigger: 'generateFirstPass',
    drafts: {
      '1.3': { sectionId: '1.3', title: 'SoA', generatedText: section13Text() } as never,
    },
  });

  const beforeGraph = getKnowledgeGraph();
  const acceptResult = acceptCurrentSoAProposal();
  assert.equal(acceptResult.accepted, true);
  assert.ok(getSoAKnowledge());
  assert.equal(getCurrentSoAProposal()?.status, 'accepted');

  const graph = getKnowledgeGraph();
  assert.ok((graph?.relationships.length ?? 0) >= (beforeGraph?.relationships.length ?? 0));
  const merged = patchSoAKnowledge(getCurrentSoAProposal()?.soaKnowledgePatch ?? {});
  const patch = buildKnowledgeGraphPatchFromSoAKnowledge(merged);
  assert.ok((patch.relationships ?? []).some((rel) => rel.relationshipType === 'scheduled_at'));
}

async function testRejectPreservesKnowledge() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  setSoAKnowledge(createEmptySoAKnowledgeModel(getProtocolDocument().id));

  await runSoAAgent({
    trigger: 'manual',
    drafts: {
      '8': { sectionId: '8', title: 'Assessments', generatedText: section8Text() } as never,
    },
  });
  rejectSoAProposal();
  assert.equal(getCurrentSoAProposal()?.status, 'rejected');
  assert.equal(getSoAKnowledge()?.assessments.length, 0);
}

function testNarrativeImpactMapping() {
  const sections = getNarrativeSectionsImpactedBySoAChange({ kind: 'assessmentSchedule' });
  assert.ok(sections.includes('1.3'));
  assert.ok(sections.includes('8'));
}

async function testDuplicateMergeOnRepeatedRun() {
  resetSoAProposalStoreForTests();
  const input = {
    protocolSections: [{ sectionId: '1.3', title: 'SoA', text: section13Text() }],
    trigger: 'manual' as const,
    existingSoAConfiguration: getProtocolDocument(),
  };
  const first = evaluateSoAScheduleExtraction(input);
  const second = evaluateSoAScheduleExtraction({
    ...input,
    soaKnowledgeModel: {
      ...createEmptySoAKnowledgeModel(getProtocolDocument().id),
      ...first.soaKnowledgePatch,
      visits: first.soaKnowledgePatch.visits ?? [],
      assessments: first.soaKnowledgePatch.assessments ?? [],
      scheduleRules: first.soaKnowledgePatch.scheduleRules ?? [],
    },
  });
  assert.equal(second.soaKnowledgePatch.visits?.length, first.soaKnowledgePatch.visits?.length);
}

async function main() {
  await testAgentExtractsVisitsAndAssessments();
  await testExplicitScheduleRulesAndAmbiguousDiagnostics();
  await testProposalCreatedNotAutoApplied();
  await testAcceptPatchesKnowledgeAndGraph();
  await testRejectPreservesKnowledge();
  testNarrativeImpactMapping();
  await testDuplicateMergeOnRepeatedRun();
  console.log('test:soa-agent — all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
