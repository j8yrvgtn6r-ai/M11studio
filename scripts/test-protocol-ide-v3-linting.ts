import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  applyConsistencyAgentResults,
  ensureManualSectionDraft,
  getProtocolImportState,
} from '../src/app/domain/protocol/import';
import { persistProjectReset, initProtocolImportStore } from '../src/app/domain/protocol/import/protocolImportStore';
import { resetProtocolStoreToBlank } from '../src/app/domain/protocol/store/protocolStore';
import type { GeneratedSectionDraft } from '../src/app/domain/protocol/import/types';
import { patchKnowledgeGraph, resetKnowledgeGraphForTests } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { clearStudyModel } from '../src/app/domain/study-model/studyModelStore';
import {
  resetSoAKnowledgeForTests,
  setSoAKnowledge,
} from '../src/app/domain/soa-knowledge/soaKnowledgeStore';
import { createEmptySoAKnowledgeModel } from '../src/app/domain/soa-knowledge/soaKnowledgePatch';
import {
  clearLintIssues,
  formatLintStatusLabel,
  getLintIssues,
  getLintQuickFixes,
  getLintSummary,
  lintIssuesToLineDiagnostics,
  mergeLineDiagnosticsWithLint,
  resetProtocolLintScheduler,
  runProtocolLint,
  runTerminologyLintRules,
  runStructureLintRules,
  scheduleImpactedSectionLint,
  scheduleSectionLint,
  setLintIssues,
} from '../src/app/domain/protocol/authoring/linting';
import {
  applyQuickFixToText,
  buildQuickFixesForIssue,
} from '../src/app/domain/protocol/authoring/linting/protocolLintEngine';
import { buildLineDiagnostics } from '../src/app/domain/protocol/authoring/editorIntegration';
import {
  diagnosticHighlightsFromLineDiagnostics,
  wrapPlainTextWithHighlights,
} from '../src/app/domain/protocol/authoring/diagnosticHighlights';
import { diagnosticsToGutterIndicators } from '../src/app/domain/protocol/authoring/lineDiagnostics';
import {
  clearIntellisenseAcceptanceRecords,
  listIntellisenseAcceptanceRecords,
  recordIntellisenseAcceptance,
} from '../src/app/domain/protocol/authoring/intellisense';

function buildLintDraft(sectionId: string, title: string, text: string): GeneratedSectionDraft {
  const now = new Date().toISOString();
  return {
    sectionId,
    title,
    generatedText: text,
    sourceUploadId: 'upload-lint',
    sourceExtractionId: 'extract-lint',
    knowledgeModelId: 'knowledge-lint',
    matchedSourceCandidateIds: [],
    extractionStatus: 'complete',
    generationStatus: 'complete',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'test',
      generatedAt: now,
    },
    draftVersion: 1,
    state: 'validationPassed',
    stateChangedAt: now,
    stateChangedBy: 'test',
    stateHistory: [],
    validationStatus: 'passed',
    validationMessages: [],
    validationFindings: [],
    generatedAt: now,
    contentOrigin: 'generated',
    workflowState: 'generated',
  };
}

function seedDraft(sectionId: string, title: string, text: string) {
  ensureManualSectionDraft(sectionId, title, '');
  applyManualSectionContentEdit(sectionId, title, text);
}

function resetLintHarness() {
  resetProtocolLintScheduler();
  clearLintIssues();
  resetKnowledgeGraphForTests();
  resetSoAKnowledgeForTests();
  clearStudyModel();
}

function testTerminologyDetectsSynonymAndSuggestsPreferredTerm() {
  resetLintHarness();
  const text = 'Each subject must provide informed consent before enrollment.';
  const issues = runTerminologyLintRules({
    sectionId: '5',
    content: text,
    plainText: text,
  });
  assert.ok(issues.some((entry) => entry.category === 'terminology'));
  const subjectIssue = issues.find((entry) => entry.message.includes('participant'));
  assert.ok(subjectIssue);
  assert.equal(subjectIssue?.suggestedFix, 'participant');
}

function testPlaceholderLintDetectsInsertMarker() {
  resetLintHarness();
  const text = 'The primary objective is [Insert primary objective here] for this trial.';
  const issues = runStructureLintRules({
    sectionId: '3',
    content: text,
    plainText: text,
  });
  assert.ok(
    issues.some(
      (entry) =>
        entry.category === 'structure' &&
        entry.message.toLowerCase().includes('placeholder'),
    ),
  );
}

function testThinContentLintWarns() {
  resetLintHarness();
  const text = 'Short objective text.';
  const issues = runStructureLintRules({
    sectionId: '3',
    content: text,
    plainText: text,
  });
  assert.ok(issues.some((entry) => entry.message.toLowerCase().includes('too thin')));
}

function testEndpointMentionWithoutKgDefinitionWarns() {
  resetLintHarness();
  patchKnowledgeGraph({ entities: [], relationships: [] });
  const text =
    'The primary endpoint is radiographic tumor burden score in adult participants with NSCLC.';
  const result = runProtocolLint({ sectionId: '10', sectionTitle: 'Statistical Considerations', content: text });
  assert.ok(
    result.issues.some(
      (entry) =>
        entry.category === 'consistency' &&
        entry.message.toLowerCase().includes('not defined'),
    ),
  );
}

function testSoaAssessmentMentionedButUnscheduledWarns() {
  resetLintHarness();
  const soa = createEmptySoAKnowledgeModel('lint-test');
  setSoAKnowledge({
    ...soa,
    visits: [{ id: 'visit-1', name: 'Screening visit', order: 0, sourceSectionIds: ['8'] }],
    assessments: [{ id: 'asmt-ecg', name: 'ECG monitoring', category: 'other', sourceSectionIds: ['8'] }],
  });
  const text = 'Participants complete a novel biomarker assessment at screening.';
  const result = runProtocolLint({ sectionId: '8', sectionTitle: 'Trial Assessments', content: text });
  assert.ok(
    result.issues.some(
      (entry) =>
        entry.category === 'soa' &&
        entry.message.toLowerCase().includes('not found in soa knowledge'),
    ),
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function testLintSchedulerDebouncesTyping() {
  resetLintHarness();
  scheduleSectionLint({ sectionId: '2', content: 'Each subject', debounceMs: 80 });
  scheduleSectionLint({ sectionId: '2', content: 'Each subject must', debounceMs: 80 });
  scheduleSectionLint({ sectionId: '2', content: 'Each subject must consent.', debounceMs: 80 });
  await wait(220);
  const summary = getLintSummary('2');
  assert.equal(summary.schedulerState, 'complete');
  assert.ok(getLintIssues('2').length >= 1);
}

function testLintingDoesNotExitEditMode() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('3', 'Trial Objectives', 'Each subject participates in this study design.');
  const before = getProtocolImportState().sectionDrafts['3']?.workflowState;
  setLintIssues('3', runProtocolLint({ sectionId: '3', content: 'Each subject participates.' }).issues);
  const after = getProtocolImportState().sectionDrafts['3']?.workflowState;
  assert.equal(before, after);
}

function testLintingDoesNotTriggerAutosave() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('4', 'Trial Design', 'Original design text for this randomized trial intervention study.');
  const before = JSON.stringify(getProtocolImportState().sectionDrafts['4']);
  resetLintHarness();
  scheduleSectionLint({
    sectionId: '4',
    content: getProtocolImportState().sectionDrafts['4']?.generatedText ?? '',
    debounceMs: 0,
  });
  const after = JSON.stringify(getProtocolImportState().sectionDrafts['4']);
  assert.equal(before, after);
}

function testGutterReceivesLintMarkers() {
  resetLintHarness();
  const text = 'Each subject must consent.';
  const result = runProtocolLint({ sectionId: '5', content: text });
  const diagnostics = lintIssuesToLineDiagnostics(result.issues);
  const gutter = diagnosticsToGutterIndicators(diagnostics);
  assert.ok(gutter.some((entry) => entry.category === 'terminology'));
  assert.ok(gutter.some((entry) => entry.lineNumber === 1));
}

function testInlineSquiggleRendersForLintIssue() {
  resetLintHarness();
  const text = 'Each subject must consent.';
  const result = runProtocolLint({ sectionId: '5', content: text });
  const diagnostics = lintIssuesToLineDiagnostics(result.issues);
  const highlights = diagnosticHighlightsFromLineDiagnostics(text, diagnostics);
  assert.ok(highlights.length >= 1);
  const html = wrapPlainTextWithHighlights(text, highlights);
  assert.match(html, /protocol-diagnostic/);
  assert.match(html, /subject/);
}

function testQuickFixReplacesTerminologyText() {
  resetLintHarness();
  const text = 'Each subject must consent.';
  const result = runProtocolLint({ sectionId: '5', content: text });
  const issue = result.issues.find((entry) => entry.category === 'terminology');
  assert.ok(issue);
  const fix = buildQuickFixesForIssue(issue).find((entry) => entry.actionType === 'replaceText');
  assert.ok(fix);
  const { nextText, applied } = applyQuickFixToText(text, fix);
  assert.equal(applied, true);
  assert.match(nextText, /participant/);
  assert.doesNotMatch(nextText, /\bsubject\b/i);
}

function testQuickFixRecordsAcceptance() {
  resetLintHarness();
  clearIntellisenseAcceptanceRecords();
  const text = 'Each subject must consent.';
  const result = runProtocolLint({ sectionId: '5', content: text });
  const issue = result.issues.find((entry) => entry.category === 'terminology');
  assert.ok(issue);
  const fix = buildQuickFixesForIssue(issue).find((entry) => entry.actionType === 'replaceText');
  assert.ok(fix);
  const { nextText } = applyQuickFixToText(text, fix);
  recordIntellisenseAcceptance({
    sectionId: '5',
    suggestionId: fix.id,
    kind: 'terminology',
    source: 'm11Terminology',
    originalText: 'subject',
    insertedText: fix.replacementText ?? '',
  });
  assert.match(nextText, /participant/);
  assert.ok(listIntellisenseAcceptanceRecords().some((entry) => entry.sectionId === '5'));
}

function testValidationPanelListsLintIssues() {
  resetLintHarness();
  const result = runProtocolLint({ sectionId: '5', content: 'Each subject must consent before screening.' });
  setLintIssues('5', result.issues, result.quickFixes);
  const issues = getLintIssues('5');
  const fixes = getLintQuickFixes('5');
  assert.ok(issues.length >= 1);
  assert.ok(fixes.length >= 1);
  assert.ok(formatLintStatusLabel(getLintSummary('5')).includes('issue'));
}

function testNoDuplicateIssuesFromValidationAndLinting() {
  resetLintHarness();
  const text = 'Each subject must consent.';
  const validationDiagnostics = buildLineDiagnostics({
    sectionId: '5',
    content: text,
    draft: {
      sectionId: '5',
      title: 'Trial Population',
      generatedText: text,
      validationFindings: [],
      validationStatus: 'warnings',
      state: 'draft',
      validationChanges: [
        {
          id: 'validation-subject',
          type: 'terminology',
          originalText: 'subject',
          replacementText: 'participant',
          reason: 'M11 prefers "participant" over "subject"',
          startIndex: text.indexOf('subject'),
          endIndex: text.indexOf('subject') + 'subject'.length,
          severity: 'warning',
        },
      ],
    },
  });
  const lintIssues = runProtocolLint({ sectionId: '5', content: text }).issues;
  const merged = mergeLineDiagnosticsWithLint(validationDiagnostics, lintIssues);
  assert.ok(validationDiagnostics.length >= 1);
  assert.ok(lintIssues.length >= 1);
  assert.ok(merged.length < validationDiagnostics.length + lintIssues.length);
}

async function testCrossSectionLintScheduledForImpactedSections() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('3', 'Trial Objectives', 'Primary objective is overall survival.');
  seedDraft('10', 'Statistical Considerations', 'Analysis includes overall survival.');
  resetLintHarness();
  scheduleImpactedSectionLint([
    { sectionId: '3', sectionTitle: 'Trial Objectives', content: 'Each subject participates in this study.' },
    { sectionId: '10', sectionTitle: 'Statistical Considerations', content: 'This study evaluates the primary endpoint.' },
  ]);
  await wait(950);
  assert.ok(getLintIssues('3').length >= 1);
  assert.ok(getLintIssues('10').length >= 1);
}

function testConsistencyAgentMarksImpactedSectionsForBackgroundLint() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  initProtocolImportStore();
  getProtocolImportState().sectionDrafts = {
    '3': buildLintDraft('3', 'Trial Objectives', 'Primary objective is overall survival.'),
    '10': buildLintDraft('10', 'Statistical Considerations', 'Analysis includes overall survival.'),
  };
  resetLintHarness();
  const marked = applyConsistencyAgentResults('3', [
    {
      sectionId: '10',
      reasons: [
        {
          sourceSectionId: '3',
          sourceSectionTitle: 'Trial Objectives',
          changedItemName: 'overall survival',
          changedItemCollection: 'endpoints',
          relationship: 'references',
          reason: 'Endpoint changed in objectives',
          suggestedAction: 'validate',
        },
      ],
    },
  ]);
  assert.deepEqual(marked, ['10']);
}

async function main() {
  testTerminologyDetectsSynonymAndSuggestsPreferredTerm();
  testPlaceholderLintDetectsInsertMarker();
  testThinContentLintWarns();
  testEndpointMentionWithoutKgDefinitionWarns();
  testSoaAssessmentMentionedButUnscheduledWarns();
  await testLintSchedulerDebouncesTyping();
  testLintingDoesNotExitEditMode();
  testLintingDoesNotTriggerAutosave();
  testGutterReceivesLintMarkers();
  testInlineSquiggleRendersForLintIssue();
  testQuickFixReplacesTerminologyText();
  testQuickFixRecordsAcceptance();
  testValidationPanelListsLintIssues();
  testNoDuplicateIssuesFromValidationAndLinting();
  await testCrossSectionLintScheduledForImpactedSections();
  testConsistencyAgentMarksImpactedSectionsForBackgroundLint();
  console.log('test-protocol-ide-v3-linting: PASS');
}

void main();
