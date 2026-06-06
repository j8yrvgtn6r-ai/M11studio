import assert from 'node:assert/strict';

import { agentManager } from '../src/app/agents/AgentManager';
import type { AgentContext } from '../src/app/agents/AgentContext';
import { extractKnowledgeFromSectionText } from '../src/app/agents/knowledgeAgentHeuristics';
import { KNOWLEDGE_AGENT_ID, knowledgeAgent } from '../src/app/agents/KnowledgeAgent';
import { applyStudyModelPatch } from '../src/app/domain/study-model/studyModelPatch';
import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';

function testAgentManagerReturnsResultOnFailure() {
  agentManager.register({
    id: 'failing-agent',
    label: 'Failing Agent',
    description: 'Always throws',
    execute: async () => {
      throw new Error('boom');
    },
  });

  return agentManager
    .runAgent('failing-agent', {
      protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
      trigger: 'manual',
      input: {},
    })
    .then((result) => {
      assert.equal(result.status, 'failed');
      assert.match(result.errors.join(' '), /boom/);
    });
}

function testKnowledgeAgentExtractsObjective() {
  const output = extractKnowledgeFromSectionText({
    sectionId: '3.1',
    sectionTitle: '3.1 Primary Objectives',
    currentText: 'Primary objective: Demonstrate superiority in overall survival.',
    source: 'imported',
  });
  assert.ok(output.extractedItems.some((item) => /overall survival/i.test(item.name)));
}

function testKnowledgeAgentUpdatesSourceSections() {
  const model = buildStudyModelFromSources({ sourceUploadId: 'upload-1' });
  const output = extractKnowledgeFromSectionText({
    sectionId: '3.1',
    sectionTitle: '3.1 Primary Objectives',
    currentText: 'Primary objective: Reduce disease progression.',
    source: 'generated',
  });
  const patched = applyStudyModelPatch(model, output.studyModelPatch, '3.1');
  assert.ok(patched.objectives.some((item) => item.sourceSections.includes('3.1')));
}

async function testKnowledgeAgentExecute() {
  agentManager.register(knowledgeAgent);
  const result = await agentManager.runAgent(KNOWLEDGE_AGENT_ID, {
    protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
    trigger: 'import',
    input: {
      sectionId: '3.1',
      sectionTitle: '3.1 Primary Objectives',
      currentText: 'Primary objective: Demonstrate improvement in response rate.',
      source: 'imported',
    },
  });
  assert.ok(result.status === 'success' || result.status === 'partial');
  assert.ok((result.output as { extractedItems: unknown[] }).extractedItems.length > 0);
}

async function main() {
  await testAgentManagerReturnsResultOnFailure();
  testKnowledgeAgentExtractsObjective();
  testKnowledgeAgentUpdatesSourceSections();
  await testKnowledgeAgentExecute();
  console.log('Agent architecture tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
