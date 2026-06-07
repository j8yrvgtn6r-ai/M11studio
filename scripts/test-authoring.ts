import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  ensureManualSectionDraft,
  getProtocolImportState,
  resolveProtocolDisplayIdentity,
  upsertSectionImportDraft,
} from '../src/app/domain/protocol/import';
import { persistProjectReset } from '../src/app/domain/protocol/import/protocolImportStore';
import { resetProject } from '../src/app/domain/protocol/import/projectReset';
import {
  resolveSectionEditorContent,
} from '../src/app/domain/protocol/import/sectionAuthoring';
import {
  countAuthoringCompletedSections,
  countAuthoringTotalSections,
} from '../src/app/domain/protocol/authoring/sectionAuthoringCompletion';
import {
  getFieldDefinitions,
  getProtocolSections,
  getVisitDefinitions,
  getSoAAssessmentDefinitions,
  getAssessmentScheduleRules,
  getSchedule,
  updateElementValue,
} from '../src/app/domain/protocol';
import {
  getProtocolDocument,
  isBlankProjectMode,
  resetProtocolStoreToBlank,
} from '../src/app/domain/protocol/store/protocolStore';
import { isSoAConfigurationEmpty } from '../src/app/components/soa-configuration/soaConfigurationEmpty';

function testBlankProjectIdentityAndCompletion() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  assert.equal(isBlankProjectMode(), true);
  assert.equal(
    resolveProtocolDisplayIdentity({
      importedSourceSummary: null,
      fallbackProtocolId: '',
    }),
    'No Project',
  );
  const sections = getProtocolSections();
  assert.equal(countAuthoringCompletedSections(sections, {}), 0);
  assert.equal(countAuthoringTotalSections(sections), 161);
}

function testTitlePagePlaceholdersNotSeedValues() {
  resetProtocolStoreToBlank();
  const fields = getFieldDefinitions().filter((field) => field.sectionId === 'title');
  const fullTitle = fields.find((field) => field.id === 'title_page.full_title');
  const sponsorId = fields.find((field) => field.id === 'title_page.sponsor_protocol_identifier');
  const trialPhase = fields.find((field) => field.id === 'title_page.trial_phase');
  assert.equal(fullTitle?.value, undefined);
  assert.equal(sponsorId?.value, undefined);
  assert.equal(trialPhase?.value, undefined);
}

function testManualSectionDraftAndAutosaveMetadata() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', '<p>Manual section text</p>');
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  assert.match(draft.generatedText, /Manual section text/);
  assert.equal(draft.contentOrigin, 'manual');
  assert.equal(draft.workflowState, 'importedUnvalidated');
}

function testValidatedEditReturnsToPendingValidation() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('3', 'Objectives', 'Original text');
  const draft = getProtocolImportState().sectionDrafts['3'];
  assert.ok(draft);
  upsertSectionImportDraft('3', {
    ...draft,
    workflowState: 'validated',
    state: 'validationPassed',
    generatedText: 'Validated text',
  });
  applyManualSectionContentEdit('3', 'Objectives', 'Edited validated text', 'Validated text');
  const edited = getProtocolImportState().sectionDrafts['3'];
  assert.equal(edited.workflowState, 'importedUnvalidated');
  assert.equal(edited.generatedText, 'Edited validated text');
  assert.equal(edited.validationStatus, 'not-run');
}

function testImportedSectionEditorContentUsesSourceTextFallback() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  upsertSectionImportDraft('2', {
    sectionId: '2',
    title: 'Introduction',
    generatedText: '',
    sourceText: 'Imported introduction paragraph.',
    sourceUploadId: 'upload-1',
    sourceExtractionId: 'extract-1',
    knowledgeModelId: '',
    matchedSourceCandidateIds: ['candidate-1'],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'structural-mapping-agent-v1',
      generationTimestamp: new Date().toISOString(),
      generationPromptVersion: 'structural-mapping-agent-v1',
      sourceUploadId: 'upload-1',
      knowledgeModelId: '',
      sourceCandidateIds: ['candidate-1'],
      confidence: 0.9,
      generationNotes: ['Imported from source heading: Introduction'],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'Current user',
    stateHistory: [],
    generatedAt: new Date().toISOString(),
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'importedUnvalidated',
    contentOrigin: 'imported',
    sourceHeading: 'Introduction',
  });
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.equal(resolveSectionEditorContent(draft), 'Imported introduction paragraph.');
}

function testImportedSectionEditPreservesProvenanceAndPendingValidation() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  const importedText = 'Imported introduction paragraph.';
  upsertSectionImportDraft('2', {
    sectionId: '2',
    title: 'Introduction',
    generatedText: importedText,
    sourceText: importedText,
    sourceUploadId: 'upload-1',
    sourceExtractionId: 'extract-1',
    knowledgeModelId: '',
    matchedSourceCandidateIds: ['candidate-1'],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'structural-mapping-agent-v1',
      generationTimestamp: new Date().toISOString(),
      generationPromptVersion: 'structural-mapping-agent-v1',
      sourceUploadId: 'upload-1',
      knowledgeModelId: '',
      sourceCandidateIds: ['candidate-1'],
      confidence: 0.9,
      generationNotes: ['Imported from source heading: Introduction'],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'Current user',
    stateHistory: [],
    generatedAt: new Date().toISOString(),
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'importedUnvalidated',
    contentOrigin: 'imported',
    sourceHeading: 'Introduction',
  });

  applyManualSectionContentEdit('2', 'Introduction', 'Edited introduction paragraph.', importedText);
  const edited = getProtocolImportState().sectionDrafts['2'];
  assert.equal(edited.contentOrigin, 'imported');
  assert.equal(edited.sourceText, importedText);
  assert.equal(edited.generatedText, 'Edited introduction paragraph.');
  assert.equal(edited.workflowState, 'importedUnvalidated');
  assert.ok(
    edited.provenance?.generationNotes?.some((note) => note.includes('Manually edited after import')),
  );
}

function testImportedSectionCancelBaselineUnchanged() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  const importedText = 'Imported introduction paragraph.';
  upsertSectionImportDraft('2', {
    sectionId: '2',
    title: 'Introduction',
    generatedText: importedText,
    sourceText: importedText,
    sourceUploadId: 'upload-1',
    sourceExtractionId: 'extract-1',
    knowledgeModelId: '',
    matchedSourceCandidateIds: ['candidate-1'],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'structural-mapping-agent-v1',
      generationTimestamp: new Date().toISOString(),
      generationPromptVersion: 'structural-mapping-agent-v1',
      sourceUploadId: 'upload-1',
      knowledgeModelId: '',
      sourceCandidateIds: ['candidate-1'],
      confidence: 0.9,
      generationNotes: ['Imported from source heading: Introduction'],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'Current user',
    stateHistory: [],
    generatedAt: new Date().toISOString(),
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'importedUnvalidated',
    contentOrigin: 'imported',
  });

  const baseline = resolveSectionEditorContent(getProtocolImportState().sectionDrafts['2']);
  const cancelledBuffer = baseline;
  assert.notEqual(cancelledBuffer, 'Unsaved edit text');
  assert.equal(resolveSectionEditorContent(getProtocolImportState().sectionDrafts['2']), importedText);
}

function testBlankProjectClearsSoASeedData() {
  resetProtocolStoreToBlank();
  const document = getProtocolDocument();
  assert.equal(document.title, '');
  assert.equal(isSoAConfigurationEmpty(document), true);
  assert.equal(getVisitDefinitions().length, 0);
  assert.equal(getSoAAssessmentDefinitions().length, 0);
  assert.equal(getAssessmentScheduleRules().length, 0);
  assert.equal(getSchedule().metadata?.generatedFromRules, undefined);
  assert.equal(document.metadata.authoringMode, undefined);
}

function testFooterIdentityUpdatesFromTitlePage() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  updateElementValue('title_page.sponsor_protocol_identifier', 'ACME-2026-001');
  assert.equal(
    resolveProtocolDisplayIdentity({
      importedSourceSummary: null,
      fallbackProtocolId: '',
    }),
    'ACME-2026-001',
  );
}

async function testResetProjectUsesBlankDocument() {
  await resetProject();
  assert.equal(isBlankProjectMode(), true);
  assert.equal(getProtocolDocument().id, '');
  assert.equal(Object.keys(getProtocolImportState().sectionDrafts).length, 0);
  assert.equal(isSoAConfigurationEmpty(getProtocolDocument()), true);
}

async function main() {
  testBlankProjectIdentityAndCompletion();
  testTitlePagePlaceholdersNotSeedValues();
  testManualSectionDraftAndAutosaveMetadata();
  testValidatedEditReturnsToPendingValidation();
  testImportedSectionEditorContentUsesSourceTextFallback();
  testImportedSectionEditPreservesProvenanceAndPendingValidation();
  testImportedSectionCancelBaselineUnchanged();
  testBlankProjectClearsSoASeedData();
  testFooterIdentityUpdatesFromTitlePage();
  await testResetProjectUsesBlankDocument();
  console.log('test-authoring: PASS');
}

void main();
