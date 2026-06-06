import assert from 'node:assert/strict';

import { agentManager } from '../src/app/agents/AgentManager';
import type { AgentContext } from '../src/app/agents/AgentContext';
import {
  CONSISTENCY_AGENT_ID,
  consistencyAgent,
  evaluateConsistencyImpacts,
  evaluateStructuralMapping,
  evaluateValidation,
  buildTrackChangeSegments,
  STRUCTURAL_MAPPING_AGENT_ID,
  structuralMappingAgent,
  VALIDATION_AGENT_ID,
  validationAgent,
  evaluateGenerationSchedule,
  GENERATION_AGENT_ID,
  generationAgent,
  getPrioritySectionIdsForScheduling,
} from '../src/app/agents';
import { isQuickReconstructionSection } from '../src/app/domain/protocol/import/quickReconstructionSections';
import { extractKnowledgeFromSectionText } from '../src/app/agents/knowledgeAgentHeuristics';
import { KNOWLEDGE_AGENT_ID, knowledgeAgent } from '../src/app/agents/KnowledgeAgent';
import { updateSectionGenerationState } from '../src/app/domain/protocol/build/protocolBuildConsoleStore';
import {
  applyConsistencyAgentResults,
  acceptSectionValidation,
  applyValidationAgentProposal,
  getProtocolImportState,
  initProtocolImportStore,
  rejectSectionValidation,
  runSectionValidation,
} from '../src/app/domain/protocol/import/protocolImportStore';
import type { ExtractedParagraph, GeneratedSectionDraft } from '../src/app/domain/protocol/import/types';
import { detectSourceSections } from '../src/app/domain/protocol/import/sourceSectionDetection';
import { isMostlyTableOfContentsDots } from '../src/app/domain/protocol/import/sourceSectionBodyExtractor';
import {
  inferWorkflowState,
  isValidationReviewReady,
  resolveWorkflowGenerationState,
} from '../src/app/domain/protocol/import/sectionWorkflowState';
import { applyStudyModelPatch } from '../src/app/domain/study-model/studyModelPatch';
import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';

function buildDraft(sectionId: string, overrides: Partial<GeneratedSectionDraft> = {}): GeneratedSectionDraft {
  return {
    sectionId,
    title: `Section ${sectionId}`,
    generatedText: 'Draft text',
    sourceUploadId: 'upload-1',
    sourceExtractionId: 'extract-1',
    knowledgeModelId: 'knowledge-1',
    matchedSourceCandidateIds: [],
    extractionStatus: 'complete',
    generationStatus: 'complete',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'test',
      generatedAt: new Date().toISOString(),
    },
    draftVersion: 1,
    state: 'validationPassed',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'test',
    stateHistory: [],
    validationStatus: 'passed',
    validationMessages: [],
    validationFindings: [],
    generatedAt: new Date().toISOString(),
    contentOrigin: 'generated',
    workflowState: 'validated',
    ...overrides,
  };
}

function setDrafts(drafts: Record<string, GeneratedSectionDraft>): void {
  initProtocolImportStore();
  getProtocolImportState().sectionDrafts = drafts;
}

async function testAgentManagerReturnsResultOnFailure() {
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

function testObjectiveChangeMarksDownstreamSections() {
  setDrafts({
    '3.1': buildDraft('3.1', { workflowState: 'validated', title: '3.1 Primary Objectives' }),
    '1.1': buildDraft('1.1', { workflowState: 'reviewed', state: 'approved' }),
    '10.1': buildDraft('10.1', { workflowState: 'generated' }),
    '4.1': buildDraft('4.1', { workflowState: 'validated' }),
  });

  const impacts = evaluateConsistencyImpacts({
    sourceSectionId: '3.1',
    changedItems: [{ collection: 'objectives', name: 'Reduce disease progression' }],
    availableSectionIds: Object.keys(getProtocolImportState().sectionDrafts),
  });

  assert.ok(impacts.some((impact) => impact.sectionId === '1.1'));
  assert.ok(impacts.some((impact) => impact.sectionId === '10.1'));
  assert.ok(impacts.some((impact) => impact.sectionId === '4.1'));
  assert.ok(!impacts.some((impact) => impact.sectionId === '3.1'));
}

function testPopulationChangeMarksTrialPopulationSections() {
  setDrafts({
    '5.2': buildDraft('5.2', { workflowState: 'validated', title: '5.2 Inclusion Criteria' }),
    '1.1': buildDraft('1.1', { workflowState: 'generated' }),
    '10.11': buildDraft('10.11', { workflowState: 'reviewed', state: 'approved' }),
  });

  const impacts = evaluateConsistencyImpacts({
    sourceSectionId: '5.2',
    changedItems: [{ collection: 'eligibility', name: 'Age 18-75 years' }],
    availableSectionIds: Object.keys(getProtocolImportState().sectionDrafts),
  });

  assert.ok(impacts.some((impact) => impact.sectionId === '1.1'));
  assert.ok(impacts.some((impact) => impact.sectionId === '10.11'));
  assert.ok(!impacts.some((impact) => impact.sectionId === '5.2'));
}

function testSourceSectionIsNotMarkedOutOfSync() {
  setDrafts({
    '3.1': buildDraft('3.1', { workflowState: 'validated' }),
    '1.1': buildDraft('1.1', { workflowState: 'generated' }),
  });

  const marked = applyConsistencyAgentResults('3.1', [
    {
      sectionId: '1.1',
      reasons: [
        {
          sourceSectionId: '3.1',
          changedItemName: 'Reduce disease progression',
          changedItemCollection: 'objectives',
          relationship: 'objectives-estimands',
          reason: 'Objectives changed',
          suggestedAction: 'validate',
        },
      ],
    },
    {
      sectionId: '3.1',
      reasons: [
        {
          sourceSectionId: '3.1',
          changedItemName: 'Reduce disease progression',
          changedItemCollection: 'objectives',
          relationship: 'objectives-estimands',
          reason: 'Should be ignored',
          suggestedAction: 'validate',
        },
      ],
    },
  ]);

  assert.deepEqual(marked, ['1.1']);
  assert.equal(getProtocolImportState().sectionDrafts['3.1'].workflowState, 'validated');
  assert.equal(getProtocolImportState().sectionDrafts['1.1'].workflowState, 'outOfSync');
}

function testGeneratingAndFailedSectionsAreNotOverwritten() {
  setDrafts({
    '3.1': buildDraft('3.1', { workflowState: 'validated' }),
    '1.1': buildDraft('1.1', { workflowState: 'generated', generationStatus: 'failed' }),
    '10.1': buildDraft('10.1', { workflowState: 'generated' }),
  });
  updateSectionGenerationState('10.1', 'generating');

  const impacts = evaluateConsistencyImpacts({
    sourceSectionId: '3.1',
    changedItems: [{ collection: 'objectives', name: 'Updated objective' }],
    availableSectionIds: Object.keys(getProtocolImportState().sectionDrafts),
  }).filter((impact) => impact.sectionId !== '3.1');

  const marked = applyConsistencyAgentResults(
    '3.1',
    impacts.map((impact) => ({
      sectionId: impact.sectionId,
      reasons: impact.reasons.map((reason) => ({
        ...reason,
        sourceSectionId: '3.1',
      })),
    })),
  );

  assert.ok(!marked.includes('1.1'));
  assert.ok(!marked.includes('10.1'));
  assert.equal(getProtocolImportState().sectionDrafts['1.1'].workflowState, 'generated');
}

function testRepeatedChangesDoNotDuplicateReasons() {
  setDrafts({
    '3.1': buildDraft('3.1', { workflowState: 'validated' }),
    '1.1': buildDraft('1.1', { workflowState: 'generated' }),
  });

  const reason = {
    sourceSectionId: '3.1',
    changedItemName: 'Reduce disease progression',
    changedItemCollection: 'objectives',
    relationship: 'objectives-estimands',
    reason: 'Objectives changed',
    suggestedAction: 'validate' as const,
  };

  applyConsistencyAgentResults('3.1', [{ sectionId: '1.1', reasons: [reason] }]);
  applyConsistencyAgentResults('3.1', [{ sectionId: '1.1', reasons: [reason] }]);

  const impacts = getProtocolImportState().sectionDrafts['1.1'].consistencyImpacts ?? [];
  assert.equal(impacts.length, 1);
}

function testOutOfSyncWorkflowStateSurfacesInGenerationState() {
  const draft = buildDraft('1.1', { workflowState: 'outOfSync', priorWorkflowState: 'generated' });
  assert.equal(resolveWorkflowGenerationState(draft), 'outOfSync');
  assert.equal(inferWorkflowState(draft), 'outOfSync');
}

async function testConsistencyAgentExecute() {
  agentManager.register(consistencyAgent);
  const result = await agentManager.runAgent(CONSISTENCY_AGENT_ID, {
    protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
    trigger: 'manual',
    studyModel: buildStudyModelFromSources({ sourceUploadId: 'upload-1' }),
    input: {
      sourceSectionId: '3.1',
      changedItems: [{ collection: 'objectives', name: 'Improve response rate' }],
      currentStudyModel: buildStudyModelFromSources({ sourceUploadId: 'upload-1' }),
      trigger: 'manual',
      availableSectionIds: ['1.1', '3.1', '4.1', '8.1', '10.1'],
    },
  });

  assert.equal(result.status, 'success');
  const output = result.output as { outOfSyncSectionIds: string[] };
  assert.ok(output.outOfSyncSectionIds.includes('1.1'));
  assert.ok(!output.outOfSyncSectionIds.includes('3.1'));
}

function buildMappingParagraph(textIndex: number, text: string, options: Partial<ExtractedParagraph> = {}): ExtractedParagraph {
  return {
    id: `paragraph-${textIndex}`,
    index: textIndex,
    text,
    isHeadingStyle: false,
    ...options,
  };
}

function buildMappingParagraphs(): ExtractedParagraph[] {
  return [
    buildMappingParagraph(0, '2 Study Objectives', { isHeadingStyle: true, headingLevel: 1 }),
    buildMappingParagraph(1, 'Primary objective: Demonstrate improvement in overall survival for participants.'),
    buildMappingParagraph(2, 'Secondary objective: Evaluate safety and tolerability.'),
    buildMappingParagraph(3, 'Table of Contents'),
    buildMappingParagraph(4, '1 Summary .......... 3'),
  ];
}

function testStructuralMappingImportsVerbatimBody() {
  const paragraphs = buildMappingParagraphs();
  const source = detectSourceSections(
    'upload-1',
    'fixture.docx',
    paragraphs.map((p) => p.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const output = evaluateStructuralMapping({
    sourceExtraction: source,
    trigger: 'import',
  });
  const objectives = output.mappedSections.find((entry) => entry.mappedM11SectionId === '3');
  assert.ok(objectives);
  assert.match(objectives!.importedText, /overall survival/);
  assert.ok(objectives!.importedTextLength >= 50);
  assert.equal(objectives!.mappingMethod, 'semanticTitle');
}

function testTocFragmentDoesNotImport() {
  const paragraphs = buildMappingParagraphs();
  const source = detectSourceSections(
    'upload-1',
    'fixture.docx',
    paragraphs.map((p) => p.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const output = evaluateStructuralMapping({
    sourceExtraction: source,
    trigger: 'import',
  });
  assert.ok(output.suspiciousMappings.length > 0 || !output.mappedSections.some((entry) => isMostlyTableOfContentsDots(entry.importedText)));
  for (const mapped of output.mappedSections) {
    assert.doesNotMatch(mapped.importedText, /\.{4,}/);
  }
}

function testShortNonsenseTextBecomesSuspicious() {
  const paragraphs = [
    buildMappingParagraph(0, '1 Protocol Summary', { isHeadingStyle: true, headingLevel: 1 }),
    buildMappingParagraph(1, 'Pr'),
  ];
  const source = detectSourceSections(
    'upload-1',
    'fixture.docx',
    paragraphs.map((p) => p.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const output = evaluateStructuralMapping({
    sourceExtraction: source,
    trigger: 'import',
  });
  assert.ok(output.suspiciousMappings.length > 0 || output.mappingSummary.importedCount === 0);
}

async function testStructuralMappingAgentExecute() {
  agentManager.register(structuralMappingAgent);
  const paragraphs = buildMappingParagraphs();
  const source = detectSourceSections(
    'upload-1',
    'fixture.docx',
    paragraphs.map((p) => p.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const result = await agentManager.runAgent(STRUCTURAL_MAPPING_AGENT_ID, {
    protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
    trigger: 'import',
    sourceExtraction: source,
    input: {
      sourceExtraction: source,
      trigger: 'import',
    },
  });
  assert.ok(result.status === 'success' || result.status === 'partial');
  const output = result.output as { mappedSections: Array<{ importedTextLength: number }> };
  assert.ok(output.mappedSections.some((entry) => entry.importedTextLength >= 50));
}

function buildImportedDraft(sectionId: string, text: string): GeneratedSectionDraft {
  return buildDraft(sectionId, {
    title: '3.1 Primary Objective(s) and Associated Estimand(s)',
    generatedText: text,
    sourceText: text,
    contentOrigin: 'imported',
    workflowState: 'importedUnvalidated',
    state: 'pendingReview',
    validationStatus: 'not-run',
  });
}

function testValidationAgentTerminologyReplacement() {
  const output = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: '3.1 Primary Objective(s) and Associated Estimand(s)',
    importedText:
      'The primary objective is to assess overall survival. Subjects with adverse events will be followed.',
    trigger: 'validateImported',
  });
  assert.match(output.validatedText, /overall survival \(OS\)/i);
  assert.match(output.validatedText, /participants/i);
  assert.ok(output.changes.some((change) => change.type === 'terminology'));
  assert.ok(output.terminologySuggestions.length > 0);
}

function testValidationProposedStateFromStore() {
  initProtocolImportStore();
  const draft = buildImportedDraft('3.1', 'Primary objective: improve overall survival for subjects.');
  getProtocolImportState().sectionDrafts['3.1'] = draft;
  applyValidationAgentProposal('3.1', evaluateValidation({
    sectionId: '3.1',
    sectionTitle: draft.title,
    importedText: draft.generatedText,
    trigger: 'validateImported',
  }));
  const updated = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(updated.workflowState, 'validationProposed');
  assert.ok(updated.validatedTargetText);
  assert.ok(isValidationReviewReady(updated));
  assert.equal(resolveWorkflowGenerationState(updated), 'validationProposed');
}

function testTrackChangesAndSideBySideSegments() {
  const original = 'Subjects will be followed for adverse events.';
  const output = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: 'Objectives',
    importedText: original,
    trigger: 'validateImported',
  });
  const segments = buildTrackChangeSegments(original, output.validatedText, output.changes);
  assert.ok(segments.some((segment) => segment.kind === 'addition' || segment.kind === 'terminology' || segment.kind === 'deletion'));
}

function testAcceptValidationSetsValidated() {
  initProtocolImportStore();
  const original = 'Primary objective: improve overall survival for subjects.';
  const draft = buildImportedDraft('3.1', original);
  applyValidationAgentProposal('3.1', evaluateValidation({
    sectionId: '3.1',
    sectionTitle: draft.title,
    importedText: original,
    trigger: 'validateImported',
  }));
  getProtocolImportState().sectionDrafts['3.1'] = {
    ...getProtocolImportState().sectionDrafts['3.1'],
    generatedText: original,
  };
  acceptSectionValidation('3.1');
  const updated = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(updated.workflowState, 'validated');
  assert.equal(updated.state, 'validationPassed');
  assert.match(updated.generatedText, /overall survival \(OS\)/i);
}

function testRejectValidationRestoresImportedUnvalidated() {
  initProtocolImportStore();
  const original = 'Primary objective: improve overall survival for subjects.';
  const draft = buildImportedDraft('3.1', original);
  applyValidationAgentProposal('3.1', evaluateValidation({
    sectionId: '3.1',
    sectionTitle: draft.title,
    importedText: original,
    trigger: 'validateImported',
  }));
  rejectSectionValidation('3.1');
  const updated = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(updated.workflowState, 'importedUnvalidated');
  assert.equal(updated.generatedText, original);
  assert.equal(updated.validatedTargetText, undefined);
  assert.ok((updated.validationHistory ?? []).some((entry) => entry.outcome === 'rejected'));
}

function testRunSectionValidationAvoidsDuplicateProposal() {
  initProtocolImportStore();
  const draft = buildImportedDraft('3.1', 'Primary objective text for the trial.');
  getProtocolImportState().sectionDrafts['3.1'] = draft;
  runSectionValidation('3.1');
  assert.equal(getProtocolImportState().sectionDrafts['3.1'].workflowState, 'validationRunning');
  runSectionValidation('3.1');
  assert.equal(getProtocolImportState().sectionDrafts['3.1'].workflowState, 'validationRunning');
}

async function testValidationAgentExecute() {
  agentManager.register(validationAgent);
  const result = await agentManager.runAgent(VALIDATION_AGENT_ID, {
    protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
    trigger: 'sectionValidation',
    input: {
      sectionId: '3.1',
      sectionTitle: '3.1 Primary Objective(s) and Associated Estimand(s)',
      importedText: 'Primary objective: assess overall survival in study subjects.',
      trigger: 'validateImported',
    },
  });
  assert.ok(result.status === 'success' || result.status === 'partial');
  const output = result.output as { changes: Array<{ type: string }> };
  assert.ok(output.changes.length > 0);
}

function baseScheduleInput(overrides: Partial<import('../src/app/agents/generationSchedulingRules').GenerationAgentInput> = {}) {
  return {
    trigger: 'import' as const,
    sectionDrafts: {},
    generationContext: { ready: true },
    needsGenerationSectionIds: [],
    importedSource: null,
    protocolKnowledgeModel: null,
    ...overrides,
  };
}

function testManualGenerateSectionIsFirstInQueue() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'generateSection',
      requestedSectionId: '5.2',
      sectionDrafts: {},
    }),
  );
  assert.equal(output.queue[0]?.sectionId, '5.2');
  assert.equal(output.queue[0]?.priority, 'immediate');
}

function testFailedRetryQueuesOnlyFailedSections() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'retryFailed',
      failedSectionIds: ['3.1', '10.1'],
      sectionDrafts: {
        '3.1': buildDraft('3.1', { generationStatus: 'failed', generatedText: '', workflowState: 'needsGeneration', contentOrigin: 'generated' }),
        '10.1': buildDraft('10.1', { generationStatus: 'failed', generatedText: '', workflowState: 'needsGeneration', contentOrigin: 'generated' }),
        '5.2': buildImportedDraft('5.2', 'ok text'),
      },
    }),
  );
  assert.deepEqual(
    output.queue.map((item) => item.sectionId).sort(),
    ['10.1', '3.1'],
  );
}

function testImportedUnvalidatedSectionsNotGeneratedByDefault() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'import',
      needsGenerationSectionIds: ['3.1', '5.2'],
      sectionDrafts: {
        '3.1': buildImportedDraft('3.1', 'Imported objective text that is long enough to validate.'),
      },
      mappedSections: [
        {
          mappedM11SectionId: '3.1',
          mappedM11SectionTitle: '3.1 Primary Objective(s)',
          sourceSectionId: 'source-1',
          sourceHeading: 'Objectives',
          sourceText: 'Imported objective text',
          sourceCandidateId: 'source-1',
          sourceStartIndex: 0,
          sourceEndIndex: 10,
          mappingConfidence: 0.9,
          mappingMethod: 'semanticTitle',
          needsValidation: true,
          importedTextLength: 100,
          sourcePreview: 'Imported objective text',
        },
      ],
    }),
  );
  assert.ok(!output.queue.some((item) => item.sectionId === '3.1'));
}

function testValidatedSectionsNotGeneratedByDefault() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'generateRemaining',
      sectionDrafts: {
        '5.2': buildDraft('5.2', { workflowState: 'validated', contentOrigin: 'imported', generatedText: 'Validated inclusion criteria text.' }),
      },
    }),
  );
  assert.ok(!output.queue.some((item) => item.sectionId === '5.2'));
}

function testInstructionSectionsAreSkipped() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'generateSection',
      requestedSectionId: '0',
    }),
  );
  assert.equal(output.queue.length, 0);
  assert.ok(output.skippedSections.some((entry) => entry.sectionId === '0'));
}

function testPriorityMissingSectionsAreHighPriority() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'import',
      needsGenerationSectionIds: ['5.2', '5.3', '11.1'],
    }),
  );
  const priority = output.queue.find((item) => item.sectionId === '5.2');
  assert.ok(priority);
  assert.equal(priority?.priority, 'high');
  assert.ok(isQuickReconstructionSection('5.2'));
}

function testBackgroundQueueExcludesNoContextSections() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'import',
      needsGenerationSectionIds: ['2', '7'],
    }),
  );
  assert.equal(output.queue.length, 0);
  assert.ok(output.skippedSections.length >= 1);
}

function testNoDuplicateQueueItems() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'retryFailed',
      failedSectionIds: ['3.1', '3.1', '10.1'],
    }),
  );
  assert.equal(new Set(output.queue.map((item) => item.sectionId)).size, output.queue.length);
}

function testGenerateRemainingUsesAgentQueue() {
  const output = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'generateRemaining',
      sectionDrafts: {},
      needsGenerationSectionIds: ['5.2', '5.3'],
    }),
  );
  assert.ok(output.queue.some((item) => item.sectionId === '5.2' || item.sectionId === '5.3'));
  assert.ok(output.generationSummary.queuedCount >= 1);
}

async function testGenerationAgentExecute() {
  agentManager.register(generationAgent);
  const result = await agentManager.runAgent(GENERATION_AGENT_ID, {
    protocolDocument: { protocolId: 'p1', sections: [] } as AgentContext['protocolDocument'],
    trigger: 'import',
    input: baseScheduleInput({
      needsGenerationSectionIds: ['5.2', '5.3'],
    }),
  });
  assert.ok(result.status === 'success' || result.status === 'partial' || result.status === 'skipped');
  const output = result.output as { queue: Array<{ sectionId: string }> };
  assert.ok(Array.isArray(output.queue));
}

async function main() {
  await testAgentManagerReturnsResultOnFailure();
  testKnowledgeAgentExtractsObjective();
  testKnowledgeAgentUpdatesSourceSections();
  await testKnowledgeAgentExecute();
  testObjectiveChangeMarksDownstreamSections();
  testPopulationChangeMarksTrialPopulationSections();
  testSourceSectionIsNotMarkedOutOfSync();
  testGeneratingAndFailedSectionsAreNotOverwritten();
  testRepeatedChangesDoNotDuplicateReasons();
  testOutOfSyncWorkflowStateSurfacesInGenerationState();
  await testConsistencyAgentExecute();
  testStructuralMappingImportsVerbatimBody();
  testTocFragmentDoesNotImport();
  testShortNonsenseTextBecomesSuspicious();
  await testStructuralMappingAgentExecute();
  testValidationAgentTerminologyReplacement();
  testValidationProposedStateFromStore();
  testTrackChangesAndSideBySideSegments();
  testAcceptValidationSetsValidated();
  testRejectValidationRestoresImportedUnvalidated();
  testRunSectionValidationAvoidsDuplicateProposal();
  await testValidationAgentExecute();
  testManualGenerateSectionIsFirstInQueue();
  testFailedRetryQueuesOnlyFailedSections();
  testImportedUnvalidatedSectionsNotGeneratedByDefault();
  testValidatedSectionsNotGeneratedByDefault();
  testInstructionSectionsAreSkipped();
  testPriorityMissingSectionsAreHighPriority();
  testBackgroundQueueExcludesNoContextSections();
  testNoDuplicateQueueItems();
  testGenerateRemainingUsesAgentQueue();
  await testGenerationAgentExecute();
  console.log('Agent architecture tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
