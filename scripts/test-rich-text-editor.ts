import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  ensureManualSectionDraft,
  getProtocolImportState,
} from '../src/app/domain/protocol/import';
import { resolveSectionEditorContent } from '../src/app/domain/protocol/import/sectionAuthoring';
import {
  decodeHtmlEntities,
  hasSubstantiveEditorContent,
  normalizeEditorOutput,
  normalizeStoredRichText,
  sanitizeEditorContentForStorage,
} from '../src/app/domain/protocol/authoring/richTextContent';
import {
  containsDiagnosticMarkup,
  diagnosticHighlightsFromLineDiagnostics,
  stripDiagnosticHighlights,
  wrapPlainTextWithHighlights,
} from '../src/app/domain/protocol/authoring/diagnosticHighlights';
import { runProtocolLint } from '../src/app/domain/protocol/authoring/linting';
import { buildLineDiagnostics } from '../src/app/domain/protocol/authoring/editorIntegration';
import {
  buildEditorSessionSnapshot,
  isEditorSessionDirty,
} from '../src/app/domain/protocol/authoring/editorSessionState';
import { persistProjectReset } from '../src/app/domain/protocol/import/protocolImportStore';
import { resetProtocolStoreToBlank } from '../src/app/domain/protocol/store/protocolStore';

function testPlainTextRoundTrip() {
  const input = 'This is a test';
  assert.equal(normalizeEditorOutput(input), input);
  assert.equal(normalizeStoredRichText(input), input);
  assert.equal(normalizeStoredRichText(normalizeEditorOutput(input)), input);
}

function testTypingPreservesSpaces() {
  const html = 'This is a test';
  assert.equal(normalizeEditorOutput(html), 'This is a test');
  assert.equal(normalizeEditorOutput('This&nbsp;is&nbsp;a&nbsp;test'), 'This is a test');
}

function testPastedTextPreservesSpaces() {
  const pasted = 'Line one\nLine two with  double space';
  assert.equal(normalizeEditorOutput(pasted), pasted);
  assert.equal(
    normalizeEditorOutput('Line one<br>Line two with&nbsp;&nbsp;double space'),
    pasted,
  );
}

function testHtmlEntitiesAreNotDoubleEncoded() {
  const corrupted = '&amp;amp;amp;nbsp;This is';
  const repaired = normalizeStoredRichText(corrupted);
  assert.equal(repaired, 'This is');
  assert.doesNotMatch(repaired, /&amp;/);
  assert.doesNotMatch(repaired, /&nbsp;/);
}

function testDecodeHtmlEntitiesRepairsNestedEncoding() {
  assert.equal(decodeHtmlEntities('&amp;amp;amp;nbsp;'), ' ');
  assert.equal(decodeHtmlEntities('Hello&amp;nbsp;world'), 'Hello world');
}

function testManualSaveNormalizesContent() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', 'This is a test with normal spaces.');
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  assert.equal(draft.generatedText, 'This is a test with normal spaces.');
  assert.equal(resolveSectionEditorContent(draft), 'This is a test with normal spaces.');
}

function testRepeatedSaveDoesNotCorruptPlainText() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', 'This is');
  applyManualSectionContentEdit('2', 'Introduction', 'This is a test');
  applyManualSectionContentEdit('2', 'Introduction', 'This is a test');
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.equal(draft?.generatedText, 'This is a test');
}

function testEditorSessionInitRules() {
  const resolveInitialSession = (options: { isBlank: boolean; hasContent: boolean }) =>
    options.isBlank || !options.hasContent ? 'editing' : 'viewing';

  assert.equal(resolveInitialSession({ isBlank: true, hasContent: false }), 'editing');
  assert.equal(resolveInitialSession({ isBlank: false, hasContent: false }), 'editing');
  assert.equal(resolveInitialSession({ isBlank: false, hasContent: true }), 'viewing');
  assert.equal(resolveInitialSession({ isBlank: false, hasContent: true }), 'viewing');
}

function testHasSubstantiveEditorContent() {
  assert.equal(hasSubstantiveEditorContent(''), false);
  assert.equal(hasSubstantiveEditorContent(' '), false);
  assert.equal(hasSubstantiveEditorContent('<br>'), false);
  assert.equal(hasSubstantiveEditorContent('<p><br></p>'), false);
  assert.equal(hasSubstantiveEditorContent('&nbsp;'), false);
  assert.equal(hasSubstantiveEditorContent('Primary endpoint is overall survival.'), true);
  assert.equal(hasSubstantiveEditorContent('[Figure: Study Design Overview]'), true);
}

function testEditorSessionDirtyState() {
  assert.equal(isEditorSessionDirty('', ''), false);
  assert.equal(isEditorSessionDirty('', ' '), false);
  assert.equal(isEditorSessionDirty('', 'Draft text'), true);
  const snapshot = buildEditorSessionSnapshot('', 'Draft text');
  assert.equal(snapshot.isDirty, true);
  assert.equal(snapshot.hasSubstantiveContent, true);
  assert.equal(snapshot.initialHasSubstantiveContent, false);
}

const USER_STUDY_SENTENCE =
  'The purpose of this study is to compare Drug A versus Drug B.';

function testDiagnosticMarkupIsStrippedBeforeStorage() {
  const highlighted = wrapPlainTextWithHighlights(
    USER_STUDY_SENTENCE,
    diagnosticHighlightsFromLineDiagnostics(
      USER_STUDY_SENTENCE,
      runProtocolLint({ sectionId: '2', content: USER_STUDY_SENTENCE }).issues.map((issue) => ({
        id: issue.id,
        sectionId: issue.sectionId,
        lineNumber: issue.lineNumber ?? 1,
        startOffset: issue.startOffset,
        endOffset: issue.endOffset,
        severity: issue.severity,
        category: issue.category === 'requiredContent' ? 'missingContent' : issue.category,
        message: issue.message,
        source: `liveLint:${issue.source}`,
        suggestedFix: issue.suggestedFix,
      })),
    ),
  );
  assert.ok(containsDiagnosticMarkup(highlighted));
  const stored = sanitizeEditorContentForStorage(highlighted);
  assert.equal(stored, USER_STUDY_SENTENCE);
  assert.doesNotMatch(stored, /protocol-diagnostic/);
  assert.doesNotMatch(stored, /data-diagnostic-id/);
  assert.doesNotMatch(stored, /title="/);
}

function testValidateSectionSimulationDoesNotPersistDiagnosticMarkup() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', USER_STUDY_SENTENCE);

  const lintIssues = runProtocolLint({ sectionId: '2', content: USER_STUDY_SENTENCE }).issues;
  const diagnostics = lintIssues.map((issue) => ({
    id: issue.id,
    sectionId: issue.sectionId,
    lineNumber: issue.lineNumber ?? 1,
    startOffset: issue.startOffset,
    endOffset: issue.endOffset,
    severity: issue.severity,
    category: issue.category === 'requiredContent' ? ('missingContent' as const) : issue.category,
    message: issue.message,
    source: `liveLint:${issue.source}`,
    suggestedFix: issue.suggestedFix,
  }));
  const decoratedHtml = wrapPlainTextWithHighlights(USER_STUDY_SENTENCE, diagnosticHighlightsFromLineDiagnostics(USER_STUDY_SENTENCE, diagnostics));
  const persisted = sanitizeEditorContentForStorage(decoratedHtml);
  applyManualSectionContentEdit('2', 'Introduction', persisted, USER_STUDY_SENTENCE);

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.equal(draft?.generatedText, USER_STUDY_SENTENCE);
  assert.doesNotMatch(draft?.generatedText ?? '', /protocol-diagnostic/);
}

function testRepeatedValidateSaveCyclesDoNotCorruptContent() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', USER_STUDY_SENTENCE);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const lintIssues = runProtocolLint({ sectionId: '2', content: USER_STUDY_SENTENCE }).issues;
    const diagnostics = buildLineDiagnostics({
      sectionId: '2',
      content: USER_STUDY_SENTENCE,
      draft: {
        ...(getProtocolImportState().sectionDrafts['2'] ?? {
          sectionId: '2',
          title: 'Introduction',
          generatedText: USER_STUDY_SENTENCE,
          validationFindings: [],
          validationStatus: 'not-run',
          state: 'draft',
        }),
        generatedText: USER_STUDY_SENTENCE,
        validationFindings: [],
        validationStatus: 'warnings',
        validationChanges: [],
      },
    }).concat(
      lintIssues.map((issue) => ({
        id: issue.id,
        sectionId: issue.sectionId,
        lineNumber: issue.lineNumber ?? 1,
        startOffset: issue.startOffset,
        endOffset: issue.endOffset,
        severity: issue.severity,
        category: issue.category === 'requiredContent' ? ('missingContent' as const) : issue.category,
        message: issue.message,
        source: `liveLint:${issue.source}`,
        suggestedFix: issue.suggestedFix,
      })),
    );
    const decorated = wrapPlainTextWithHighlights(
      USER_STUDY_SENTENCE,
      diagnosticHighlightsFromLineDiagnostics(USER_STUDY_SENTENCE, diagnostics),
    );
    const sanitized = sanitizeEditorContentForStorage(decorated);
    applyManualSectionContentEdit('2', 'Introduction', sanitized, USER_STUDY_SENTENCE);
  }

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.equal(draft?.generatedText, USER_STUDY_SENTENCE);
  assert.doesNotMatch(draft?.generatedText ?? '', /protocol-diagnostic|data-diagnostic-id|data-presentation-only/);
}

function testStripDiagnosticHighlightsRemovesPresentationOnlyAttributes() {
  const html =
    'The purpose of this <span contenteditable="false" data-presentation-only="true" class="protocol-diagnostic protocol-diagnostic-info protocol-diagnostic-terminology" data-diagnostic-id="diag-527316" title="M11 narrative prefers trial over study where appropriate">study</span> is to compare Drug A versus Drug B.';
  const stripped = stripDiagnosticHighlights(html);
  assert.equal(sanitizeEditorContentForStorage(stripped), USER_STUDY_SENTENCE);
}

async function main() {
  testPlainTextRoundTrip();
  testTypingPreservesSpaces();
  testPastedTextPreservesSpaces();
  testHtmlEntitiesAreNotDoubleEncoded();
  testDecodeHtmlEntitiesRepairsNestedEncoding();
  testManualSaveNormalizesContent();
  testRepeatedSaveDoesNotCorruptPlainText();
  testEditorSessionInitRules();
  testHasSubstantiveEditorContent();
  testEditorSessionDirtyState();
  testDiagnosticMarkupIsStrippedBeforeStorage();
  testValidateSectionSimulationDoesNotPersistDiagnosticMarkup();
  testRepeatedValidateSaveCyclesDoNotCorruptContent();
  testStripDiagnosticHighlightsRemovesPresentationOnlyAttributes();
  console.log('test-rich-text-editor: PASS');
}

void main();
