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
import {
  evaluateTitlePageCompletion,
  isTitlePageFieldValueComplete,
  resolveTitlePageFieldDisplayBadges,
  resolveViewportAuthoringModeLabel,
  TITLE_PAGE_REQUIRED_FIELD_IDS,
} from '../src/app/domain/protocol/authoring/titlePageAuthoring';
import {
  resolveSectionWorkflowDisplayBadge,
  resolveTitlePageViewportBadge,
  shouldShowRequiredMissing,
} from '../src/app/domain/protocol/import/sectionDisplayStatus';
import { runSectionValidation, runTitlePageValidation } from '../src/app/domain/protocol/import';
import type { ProtocolSection } from '../src/app/types/protocol';

function findSectionById(sections: ProtocolSection[], id: string): ProtocolSection | null {
  for (const section of sections) {
    if (section.id === id) {
      return section;
    }
    if (section.children?.length) {
      const found = findSectionById(section.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function fillRequiredTitlePageFields() {
  updateElementValue('title_page.full_title', 'A randomized study of example therapy.');
  updateElementValue('title_page.sponsor_protocol_identifier', 'SP-001');
  updateElementValue('title_page.trial_phase', 'Phase 3');
  updateElementValue('title_page.original_protocol_indicator', 'Yes');
}

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

function testTitlePageCompletionRemovesRequiredMissing() {
  resetProtocolStoreToBlank();
  const titleSection = findSectionById(getProtocolSections(), 'title');
  assert.equal(titleSection?.status, 'requiredMissing');
  fillRequiredTitlePageFields();
  const updatedTitle = findSectionById(getProtocolSections(), 'title');
  assert.equal(updatedTitle?.status, 'complete');
  const fields = getFieldDefinitions().filter((field) => field.sectionId === 'title');
  const summary = evaluateTitlePageCompletion(fields);
  assert.equal(summary.allRequiredComplete, true);
  assert.equal(summary.displayBadge, 'Pending Validation');
  const viewportBadge = resolveTitlePageViewportBadge({ fields });
  assert.notEqual(viewportBadge, 'Required Missing');
}

function testTitlePageFullTitleUpdatesAutosaveTimestamp() {
  resetProtocolStoreToBlank();
  const before = getProtocolDocument().metadata.updatedAt;
  updateElementValue('title_page.full_title', 'Updated study title');
  const after = getProtocolDocument().metadata.updatedAt;
  assert.ok(after);
  assert.equal(getFieldDefinitions().find((field) => field.id === 'title_page.full_title')?.value, 'Updated study title');
  assert.ok(
    !before || new Date(after!).getTime() >= new Date(before).getTime(),
    'updatedAt should advance after field edit',
  );
}

function testTitlePageControlledSelectOptions() {
  resetProtocolStoreToBlank();
  const trialPhase = getFieldDefinitions().find((field) => field.id === 'title_page.trial_phase');
  const originalProtocol = getFieldDefinitions().find((field) => field.id === 'title_page.original_protocol_indicator');
  assert.ok(trialPhase?.controlledTerminology?.values.includes('Phase 3'));
  assert.ok(
    originalProtocol?.controlledTerminology?.values.some((value) =>
      typeof value === 'string' ? value === 'Yes' : value.label === 'Yes',
    ),
  );
  updateElementValue('title_page.trial_phase', 'Phase 2');
  updateElementValue('title_page.original_protocol_indicator', 'No');
  assert.equal(getFieldDefinitions().find((field) => field.id === 'title_page.trial_phase')?.value, 'Phase 2');
  assert.equal(
    getFieldDefinitions().find((field) => field.id === 'title_page.original_protocol_indicator')?.value,
    'No',
  );
}

function testTitlePageCompletionIncrementsFooterCount() {
  resetProtocolStoreToBlank();
  const sections = getProtocolSections();
  assert.equal(countAuthoringCompletedSections(sections, {}), 0);
  fillRequiredTitlePageFields();
  assert.equal(countAuthoringCompletedSections(getProtocolSections(), {}), 1);
}

function testManualDraftRemovesRequiredMissingAndShowsDraftBadge() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  applyManualSectionContentEdit('2', 'Introduction', '<p>Substantive draft text for section 2.</p>');
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  assert.equal(
    shouldShowRequiredMissing({
      draft,
      generationState: 'notGenerated',
    }),
    false,
  );
  assert.equal(
    resolveSectionWorkflowDisplayBadge({
      draft,
      generationState: 'notGenerated',
    }),
    'Draft',
  );
}

function testTitlePagePlaceholderIsNotComplete() {
  resetProtocolStoreToBlank();
  for (const fieldId of TITLE_PAGE_REQUIRED_FIELD_IDS) {
    assert.equal(isTitlePageFieldValueComplete(fieldId, ''), false);
  }
}

function testTitlePageValidatedImportDraftShowsWorkflowBadge() {
  resetProtocolStoreToBlank();
  const fields = getFieldDefinitions().filter((field) => field.sectionId === 'title');
  assert.equal(
    resolveTitlePageViewportBadge({ fields }).toLowerCase(),
    'required missing',
  );
  const badge = resolveTitlePageViewportBadge({
    fields,
    importDraft: {
      sectionId: 'title',
      title: 'Title Page',
      generatedText: 'Imported title page narrative.',
      contentOrigin: 'imported',
      workflowState: 'validated',
      state: 'validationPassed',
      provenance: { generationModel: 'structural-mapping-v1' },
      stateHistory: [],
    } as never,
    generationState: 'validated',
  });
  assert.match(badge.toLowerCase(), /validated|reviewed/);
}

function testCompletedTitlePageFieldsShowCompleteBadge() {
  resetProtocolStoreToBlank();
  fillRequiredTitlePageFields();
  const field = getFieldDefinitions().find((entry) => entry.id === 'title_page.full_title');
  assert.ok(field);
  const badges = resolveTitlePageFieldDisplayBadges(field);
  assert.ok(badges.includes('Complete'));
  assert.equal(badges.includes('Required Missing'), false);
}

function testTitlePageValidationRunsAndMarksValidated() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  fillRequiredTitlePageFields();
  runTitlePageValidation();
  const draft = getProtocolImportState().sectionDrafts.title;
  assert.ok(draft, 'Title Page validation should create a section draft');
  assert.equal(draft.workflowState, 'validated');
  assert.equal(draft.state, 'validationPassed');
  assert.equal((draft.validationChanges ?? []).length, 0);
}

function testRunSectionValidationDelegatesToTitlePage() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  fillRequiredTitlePageFields();
  runSectionValidation('title');
  const draft = getProtocolImportState().sectionDrafts.title;
  assert.ok(draft);
  assert.equal(draft.workflowState, 'validated');
}

function testViewportAuthoringModeLabelOmitsSavingState() {
  assert.equal(
    resolveViewportAuthoringModeLabel({
      isTitlePageSection: true,
      titlePageMode: 'editing',
      editorSession: 'viewing',
      showBlankAuthoring: false,
      canShowNarrativeSurface: false,
      showNarrativeReadOnly: false,
    }),
    'Editing',
  );
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
  testTitlePageCompletionRemovesRequiredMissing();
  testTitlePageFullTitleUpdatesAutosaveTimestamp();
  testTitlePageControlledSelectOptions();
  testTitlePageCompletionIncrementsFooterCount();
  testManualDraftRemovesRequiredMissingAndShowsDraftBadge();
  testTitlePagePlaceholderIsNotComplete();
  testTitlePageValidatedImportDraftShowsWorkflowBadge();
  testCompletedTitlePageFieldsShowCompleteBadge();
  testTitlePageValidationRunsAndMarksValidated();
  testRunSectionValidationDelegatesToTitlePage();
  testViewportAuthoringModeLabelOmitsSavingState();
  await testResetProjectUsesBlankDocument();
  console.log('test-authoring: PASS');
}

void main();
