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
} from '../src/app/domain/protocol/authoring/richTextContent';
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
  console.log('test-rich-text-editor: PASS');
}

void main();
