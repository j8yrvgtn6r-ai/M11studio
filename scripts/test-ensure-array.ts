import assert from 'node:assert/strict';

import { ensureArray } from '../src/app/utils/ensureArray';
import { mergeKnowledgeArrayField, normalizeProtocolKnowledgeModelArrays } from '../src/app/domain/protocol/import/protocolKnowledgeNormalization';
import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';
import type { ProtocolKnowledgeModel } from '../src/app/domain/protocol/import/protocolKnowledgeTypes';

function testEnsureArray() {
  assert.deepEqual(ensureArray(null), []);
  assert.deepEqual(ensureArray(undefined), []);
  assert.deepEqual(ensureArray(['a', 'b']), ['a', 'b']);
  assert.deepEqual(ensureArray('single'), ['single']);
  assert.deepEqual(ensureArray('  '), []);
  assert.equal(typeof ensureArray('bad').filter, 'function');
}

function testNormalizeKnowledgeArrays() {
  const normalized = normalizeProtocolKnowledgeModelArrays({
    arms: 'Treatment A vs B' as unknown as string[],
    primaryObjectives: 'Reduce symptoms' as unknown as string[],
  });
  assert.deepEqual(normalized.arms, ['Treatment A vs B']);
  assert.deepEqual(normalized.primaryObjectives, ['Reduce symptoms']);
}

function testMergeKnowledgeArrayField() {
  assert.deepEqual(mergeKnowledgeArrayField('first', 'second'), ['first', 'second']);
  assert.deepEqual(mergeKnowledgeArrayField(['a'], 'b'), ['a', 'b']);
}

function testStudyModelBuilderWithStringFields() {
  const base: ProtocolKnowledgeModel = {
    id: 'k1',
    sourceUploadId: 'x',
    extractedAt: '',
    knowledgeProvider: 'openai',
    understandingModel: 'gpt',
    understandingPromptVersion: '1',
    confidence: 0.5,
    extractionNotes: [],
    sourceReferences: [],
    primaryObjectives: [],
    secondaryObjectives: [],
    exploratoryObjectives: [],
    estimands: [],
    arms: [],
    armDefinitions: [],
    interventions: [],
    visits: [],
    assessments: [],
    safetyMonitoring: [],
    safetyAssessments: [],
    efficacyAssessments: [],
    endpoints: [],
  };

  buildStudyModelFromSources({
    sourceUploadId: 'x',
    knowledge: {
      ...base,
      arms: 'Treatment A vs B' as unknown as string[],
      primaryObjectives: 'Reduce symptoms' as unknown as string[],
    },
  });
}

testEnsureArray();
testNormalizeKnowledgeArrays();
testMergeKnowledgeArrayField();
testStudyModelBuilderWithStringFields();

console.log('ensureArray normalization tests passed');
