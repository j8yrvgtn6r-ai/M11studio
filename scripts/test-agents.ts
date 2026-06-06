import assert from 'node:assert/strict';

import { agentManager } from '../src/app/agents/AgentManager';
import type { AgentContext } from '../src/app/agents/AgentContext';
import {
  CONSISTENCY_AGENT_ID,
  consistencyAgent,
  evaluateConsistencyImpacts,
  evaluateStructuralMapping,
  toStructuralMappingResult,
  evaluateValidation,
  buildTrackChangeSegments,
  enrichTrackChangeSegments,
  formatValidationChangeTooltip,
  summarizeValidationChanges,
  buildValidationReviewCompactSummary,
  resolveControlledTerminologyStatus,
  isLegacyTerminologyPendingMessage,
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
  applyValidationNoChangesRequired,
  getProtocolImportState,
  initProtocolImportStore,
  isValidationTextUnchanged,
  rejectSectionValidation,
  revertToDeterministicValidationProposal,
  clearLlmValidationInProgress,
  runSectionValidation,
} from '../src/app/domain/protocol/import/protocolImportStore';
import type { ExtractedParagraph, GeneratedSectionDraft } from '../src/app/domain/protocol/import/types';
import { detectSourceSections } from '../src/app/domain/protocol/import/sourceSectionDetection';
import { isMostlyTableOfContentsDots } from '../src/app/domain/protocol/import/sourceSectionBodyExtractor';
import { buildSectionImportDiagnosticsForSection } from '../src/app/domain/protocol/import/sectionImportDiagnostics';
import {
  inferWorkflowState,
  isValidationReviewReady,
  resolveWorkflowGenerationState,
} from '../src/app/domain/protocol/import/sectionWorkflowState';
import { applyStudyModelPatch } from '../src/app/domain/study-model/studyModelPatch';
import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';
import {
  applyKnowledgeGraphPatch,
  buildKnowledgeGraphFromStudyModel,
  createEmptyKnowledgeGraph,
  findKnowledgeEntityByName,
  getEntitiesMeasuredBy,
  getKnowledgeGraphSummary,
  patchKnowledgeGraph,
  resetKnowledgeGraphForTests,
} from '../src/app/domain/knowledge-graph';
import { augmentConsistencyImpactsWithKnowledgeGraph } from '../src/app/agents/consistencyRules';

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

function testSection842VitalSignsImportDiagnostics() {
  const paragraphs = [
    buildMappingParagraph(0, '8.4 Study Assessments and Procedures', { isHeadingStyle: true, headingLevel: 2 }),
    buildMappingParagraph(
      1,
      'Study assessments and procedures will be performed according to the schedule of activities table.',
    ),
    buildMappingParagraph(2, '8.4.2 Vital Signs', { isHeadingStyle: true, headingLevel: 3 }),
    buildMappingParagraph(3, '8.4.2 Vital Signs'),
  ];
  const source = detectSourceSections(
    'upload-vital-signs',
    'fixture.docx',
    paragraphs.map((p) => p.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const structuralOutput = evaluateStructuralMapping({
    sourceExtraction: source,
    trigger: 'import',
  });
  const mappingResult = toStructuralMappingResult(structuralOutput);
  const suspicious842 = structuralOutput.suspiciousMappings.find((entry) => entry.mappedM11SectionId === '8.4.2');
  assert.ok(mappingResult.needsGenerationSectionIds.includes('8.4.2'));
  assert.ok(suspicious842, 'expected 8.4.2 Vital Signs to be flagged as suspicious/rejected mapping');

  const schedule = evaluateGenerationSchedule(
    baseScheduleInput({
      trigger: 'import',
      needsGenerationSectionIds: mappingResult.needsGenerationSectionIds,
      importedSource: source,
      protocolKnowledgeModel: null,
      generationContext: { ready: true, phase: 'core-ready' },
    }),
  );
  const skipped842 = schedule.skippedSections.find((entry) => entry.sectionId === '8.4.2');
  assert.ok(skipped842, 'expected generation schedule to skip 8.4.2 without knowledge model context');

  const diagnostics = buildSectionImportDiagnosticsForSection('8.4.2', {
    mappings: mappingResult.mappings,
    suspiciousMappings: structuralOutput.suspiciousMappings,
    needsGenerationSectionIds: mappingResult.needsGenerationSectionIds,
    generationSchedule: schedule,
    importedSource: source,
    protocolKnowledgeModel: null,
    importContextPhase: 'core-ready',
    sectionDrafts: {},
    sectionSkipReasons: Object.fromEntries(schedule.skippedSections.map((entry) => [entry.sectionId, entry.reason])),
    sectionGenerationStates: { '8.4.2': 'notGenerated' },
  });

  assert.equal(diagnostics.foundInSource, true);
  assert.match(diagnostics.sourceHeadingMatch ?? '', /vital signs/i);
  assert.equal(diagnostics.mappingStatus, 'suspicious');
  assert.equal(diagnostics.mappingReason, 'headingOnly');
  assert.equal(diagnostics.generationAttempted, false);
  assert.equal(diagnostics.generationEligibility, 'noSourceContext');
  assert.ok(diagnostics.generationSkipReason?.includes('source/context is insufficient'));
  assert.ok(diagnostics.diagnosticSummary.includes('8.4.2'));
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

function testValidationControlledTerminologyStatus() {
  const output = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: '3.1 Primary Objective(s) and Associated Estimand(s)',
    importedText:
      'The primary objective is to assess overall survival. Subjects with adverse events will be followed.',
    trigger: 'validateImported',
  });
  assert.ok(output.changes.some((change) => change.type === 'terminology'));
  assert.equal(resolveControlledTerminologyStatus(output.changes), 'Applied');
  assert.ok(
    output.findings.some(
      (finding) =>
        finding.code === 'controlled_terminology' &&
        finding.message.includes('Controlled terminology checks applied'),
    ),
  );
  assert.ok(
    !output.findings.some((finding) => finding.message.includes('narrative validation pending')),
  );
  const compact = buildValidationReviewCompactSummary(output.changes, output.findings);
  assert.match(compact, /proposed change/);
}

function testValidationTrackChangeTooltipMetadata() {
  const output = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: '3.1 Primary Objective(s) and Associated Estimand(s)',
    importedText:
      'The primary objective is to assess overall survival. Subjects with adverse events will be followed.',
    trigger: 'validateImported',
  });
  const segments = enrichTrackChangeSegments(output.originalText, output.validatedText, output.changes);
  const changed = segments.filter((segment) => segment.kind !== 'unchanged');
  assert.ok(changed.length > 0);
  assert.ok(changed.some((segment) => segment.change?.reason));
  const tooltip = formatValidationChangeTooltip(changed.find((segment) => segment.change)?.change);
  assert.match(tooltip, /Change type:/);
  assert.match(tooltip, /Reason:/);
  const summary = summarizeValidationChanges(output.changes);
  assert.ok(summary.total > 0);
  assert.match(summary.label, /proposed change/);
}

function testRevertDeterministicValidationProposal() {
  initProtocolImportStore();
  const original = 'Primary objective: improve overall survival for subjects.';
  const draft = buildImportedDraft('3.1', original);
  const deterministic = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: draft.title,
    importedText: original,
    trigger: 'validateImported',
  });
  applyValidationAgentProposal('3.1', deterministic);
  getProtocolImportState().sectionDrafts['3.1'] = {
    ...getProtocolImportState().sectionDrafts['3.1'],
    deterministicValidationBackup: {
      validatedTargetText: deterministic.validatedText,
      validationChanges: deterministic.changes,
      validationFindings: deterministic.findings,
      validationMessages: deterministic.findings.map((finding) => finding.message),
      validationProvider: 'local-deterministic',
    },
    validationProvider: 'openai',
    validatedTargetText: `${deterministic.validatedText} LLM extra`,
    validationChanges: deterministic.changes,
  };
  revertToDeterministicValidationProposal('3.1');
  const restored = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(restored.validationProvider, 'local-deterministic');
  assert.equal(restored.validatedTargetText, deterministic.validatedText);
}

function testLlmValidationFailurePreservesDeterministicProposal() {
  initProtocolImportStore();
  const draft = buildImportedDraft('3.1', 'Primary objective text for the trial.');
  applyValidationAgentProposal(
    '3.1',
    evaluateValidation({
      sectionId: '3.1',
      sectionTitle: draft.title,
      importedText: draft.generatedText,
      trigger: 'validateImported',
    }),
  );
  const before = getProtocolImportState().sectionDrafts['3.1'];
  getProtocolImportState().sectionDrafts['3.1'] = {
    ...before,
    llmValidationInProgress: true,
  };
  clearLlmValidationInProgress('3.1');
  const after = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(after.llmValidationInProgress, false);
  assert.equal(after.validatedTargetText, before.validatedTargetText);
  assert.equal(after.validationProvider, before.validationProvider ?? 'local-deterministic');
}

function testValidationNoChangesRequiredAutoValidates() {
  initProtocolImportStore();
  const original =
    'The primary objective is to assess overall survival (OS) in participants with the indicated condition.';
  const draft = buildImportedDraft('3.1', original);
  getProtocolImportState().sectionDrafts['3.1'] = draft;
  const output = evaluateValidation({
    sectionId: '3.1',
    sectionTitle: draft.title,
    importedText: original,
    trigger: 'validateImported',
  });
  assert.ok(isValidationTextUnchanged(original, output.validatedText));
  applyValidationNoChangesRequired('3.1', output);
  const updated = getProtocolImportState().sectionDrafts['3.1'];
  assert.equal(updated.workflowState, 'validated');
  assert.equal(updated.state, 'validationPassed');
  assert.equal(updated.validatedTargetText, undefined);
  assert.ok((updated.validationHistory ?? []).some((entry) => entry.outcome === 'no_changes_required'));
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

function buildSampleStudyModel() {
  return buildStudyModelFromSources({
    sourceUploadId: 'upload-kg-1',
    knowledge: {
      id: 'knowledge-kg-1',
      studyTitle: 'Example Study',
      primaryObjectives: ['Radiographic Progression Free Survival'],
      endpoints: ['rPFS'],
    } as never,
  });
}

function testKnowledgeGraphBuildsObjectiveEndpointEntities() {
  resetKnowledgeGraphForTests();
  const studyModel = buildSampleStudyModel();
  const graph = buildKnowledgeGraphFromStudyModel(studyModel);
  assert.ok(graph.entities.some((entity) => entity.entityType === 'objective'));
  assert.ok(graph.entities.some((entity) => entity.entityType === 'endpoint'));
}

function testKnowledgeGraphMeasuredByRelationship() {
  resetKnowledgeGraphForTests();
  const graph = buildKnowledgeGraphFromStudyModel(buildSampleStudyModel());
  assert.ok(graph.relationships.some((relationship) => relationship.relationshipType === 'measured_by'));
}

function testKnowledgeGraphUpsertsDuplicateEntities() {
  resetKnowledgeGraphForTests();
  let graph = createEmptyKnowledgeGraph('protocol-1');
  const entity = {
    id: 'objective_rpfs',
    protocolId: 'protocol-1',
    entityType: 'objective' as const,
    name: 'Radiographic Progression Free Survival',
    normalizedName: 'radiographic progression free survival',
    aliases: [],
    sourceSectionIds: ['3.1'],
    sourceDocumentIds: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  graph = applyKnowledgeGraphPatch(graph, { entities: [entity] });
  graph = applyKnowledgeGraphPatch(graph, {
    entities: [{ ...entity, aliases: ['Primary rPFS objective'], sourceSectionIds: ['3.2'] }],
  });
  const objectives = graph.entities.filter((entry) => entry.entityType === 'objective');
  assert.equal(objectives.length, 1);
  assert.ok(objectives[0].sourceSectionIds.includes('3.1'));
  assert.ok(objectives[0].sourceSectionIds.includes('3.2'));
}

function testKnowledgeGraphMergesSourceSectionIds() {
  resetKnowledgeGraphForTests();
  patchKnowledgeGraph({
    entities: [
      {
        id: 'endpoint_rpfs',
        entityType: 'endpoint',
        name: 'rPFS',
        normalizedName: 'rpfs',
        aliases: [],
        sourceSectionIds: ['3.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  patchKnowledgeGraph({
    entities: [
      {
        id: 'endpoint_rpfs',
        entityType: 'endpoint',
        name: 'rPFS',
        normalizedName: 'rpfs',
        aliases: [],
        sourceSectionIds: ['3.2'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const endpoint = findKnowledgeEntityByName('endpoint', 'rPFS');
  assert.ok(endpoint?.sourceSectionIds.includes('3.1'));
  assert.ok(endpoint?.sourceSectionIds.includes('3.2'));
}

function testKnowledgeGraphDoesNotWipeUnrelatedData() {
  resetKnowledgeGraphForTests();
  patchKnowledgeGraph({
    entities: [
      {
        id: 'population_primary',
        entityType: 'population',
        name: 'Adult participants',
        normalizedName: 'adult participants',
        aliases: [],
        sourceSectionIds: ['5.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  patchKnowledgeGraph({
    entities: [
      {
        id: 'endpoint_os',
        entityType: 'endpoint',
        name: 'Overall Survival',
        normalizedName: 'overall survival',
        aliases: [],
        sourceSectionIds: ['3.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const summary = getKnowledgeGraphSummary();
  assert.equal(summary.entityCount, 2);
}

function testKnowledgeGraphQueryHelpers() {
  resetKnowledgeGraphForTests();
  patchKnowledgeGraph({
    entities: [
      {
        id: 'obj_primary_rpfs',
        entityType: 'objective',
        name: 'Radiographic Progression Free Survival',
        normalizedName: 'radiographic progression free survival',
        aliases: [],
        sourceSectionIds: ['3.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'endpoint_rpfs',
        entityType: 'endpoint',
        name: 'rPFS',
        normalizedName: 'rpfs',
        aliases: [],
        sourceSectionIds: ['3.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    relationships: [
      {
        id: 'measured_by_obj_endpoint',
        sourceEntityId: 'obj_primary_rpfs',
        targetEntityId: 'endpoint_rpfs',
        relationshipType: 'measured_by',
        sourceSectionIds: ['3.1'],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const measuredBy = getEntitiesMeasuredBy('endpoint_rpfs');
  assert.equal(measuredBy.length, 1);
  assert.match(measuredBy[0].name, /Progression Free Survival/i);
}

function testConsistencyAgentUsesKnowledgeGraphWhenAvailable() {
  resetKnowledgeGraphForTests();
  patchKnowledgeGraph({
    entities: [
      {
        id: 'endpoint_rpfs',
        entityType: 'endpoint',
        name: 'rPFS',
        normalizedName: 'rpfs',
        aliases: [],
        sourceSectionIds: ['8.1'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const deterministic = evaluateConsistencyImpacts({
    sourceSectionId: '3.1',
    changedItems: [{ collection: 'endpoints', name: 'rPFS' }],
    availableSectionIds: ['3.1', '8.1', '10.1'],
  });
  const augmented = augmentConsistencyImpactsWithKnowledgeGraph({
    impacts: deterministic,
    changedItems: [{ collection: 'endpoints', name: 'rPFS' }],
    availableSectionIds: ['3.1', '8.1', '10.1'],
    sourceSectionId: '3.1',
    graphSectionIds: ['8.1'],
  });
  assert.equal(augmented.usedKnowledgeGraph, true);
  assert.ok(augmented.impacts.some((impact) => impact.sectionId === '8.1'));

  const fallback = augmentConsistencyImpactsWithKnowledgeGraph({
    impacts: deterministic,
    changedItems: [{ collection: 'endpoints', name: 'rPFS' }],
    availableSectionIds: ['3.1', '8.1', '10.1'],
    sourceSectionId: '3.1',
    graphSectionIds: [],
  });
  assert.equal(fallback.usedKnowledgeGraph, false);
}

function testKnowledgeGraphWorksWithoutSupabase() {
  resetKnowledgeGraphForTests();
  const malformed = buildKnowledgeGraphFromStudyModel(null);
  assert.equal(malformed.entities.length, 0);
  assert.equal(malformed.relationships.length, 0);
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
  testSection842VitalSignsImportDiagnostics();
  await testStructuralMappingAgentExecute();
  testValidationAgentTerminologyReplacement();
  testValidationControlledTerminologyStatus();
  testValidationTrackChangeTooltipMetadata();
  testValidationNoChangesRequiredAutoValidates();
  testRevertDeterministicValidationProposal();
  testLlmValidationFailurePreservesDeterministicProposal();
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
  testKnowledgeGraphBuildsObjectiveEndpointEntities();
  testKnowledgeGraphMeasuredByRelationship();
  testKnowledgeGraphUpsertsDuplicateEntities();
  testKnowledgeGraphMergesSourceSectionIds();
  testKnowledgeGraphDoesNotWipeUnrelatedData();
  testKnowledgeGraphQueryHelpers();
  testConsistencyAgentUsesKnowledgeGraphWhenAvailable();
  testKnowledgeGraphWorksWithoutSupabase();
  console.log('Agent architecture tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
