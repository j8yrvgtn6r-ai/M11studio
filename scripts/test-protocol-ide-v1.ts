import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  ensureManualSectionDraft,
  getProtocolImportState,
} from '../src/app/domain/protocol/import';
import { persistProjectReset } from '../src/app/domain/protocol/import/protocolImportStore';
import { resolveSectionEditorContent } from '../src/app/domain/protocol/import/sectionAuthoring';
import {
  buildEditorGutterIndicators,
  buildSectionValidationSummary,
  getSectionDependencyReferences,
  getTerminologySuggestions,
} from '../src/app/domain/protocol/authoring/editorIntegration';
import { resolveProtocolIdeShortcut } from '../src/app/domain/protocol/authoring/protocolIdeShortcuts';
import {
  createProtocolAssetReference,
  formatImageReferenceToken,
  parseImageReferenceToken,
} from '../src/app/domain/protocol/assets/protocolAssetReference';
import { previewFindReplace } from '../src/app/domain/protocol/search/findReplace';
import { searchProtocolContent } from '../src/app/domain/protocol/search/protocolSearch';
import { getProtocolSections } from '../src/app/domain/protocol';
import {
  getProtocolDocument,
  resetProtocolStore,
  resetProtocolStoreToBlank,
} from '../src/app/domain/protocol/store/protocolStore';
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

function seedDraft(sectionId: string, title: string, text: string) {
  ensureManualSectionDraft(sectionId, title, '');
  applyManualSectionContentEdit(sectionId, title, text);
}

function testProtocolSearchAcrossSections() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Primary endpoint is overall survival.');
  seedDraft('3', 'Objectives', 'The primary endpoint measures overall survival.');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const result = searchProtocolContent(
    { query: 'overall survival', scopeSectionId: null },
    sections,
    drafts,
  );

  assert.equal(result.scope, 'protocol');
  assert.ok(result.matches.length >= 2, 'expected matches in multiple sections');
  assert.ok(result.sectionsWithMatches >= 2);
  const sectionIds = new Set(result.matches.map((match) => match.sectionId));
  assert.ok(sectionIds.has('2'));
  assert.ok(sectionIds.has('3'));
}

function testProtocolSearchScopedToSection() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Randomization uses stratified blocks.');
  seedDraft('3', 'Objectives', 'Randomization is described elsewhere.');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const result = searchProtocolContent(
    { query: 'Randomization', scopeSectionId: '2', caseSensitive: true },
    sections,
    drafts,
  );

  assert.equal(result.scope, 'section');
  assert.ok(result.matches.every((match) => match.sectionId === '2'));
}

function testSearchMatchNavigationPayload() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Visit window tolerance is ±3 days.');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const result = searchProtocolContent({ query: 'window' }, sections, drafts);
  assert.ok(result.matches.length >= 1);

  const match = result.matches[0];
  assert.equal(match.sectionId, '2');
  assert.ok(match.sectionTitle.length > 0);
  assert.ok(match.snippet.toLowerCase().includes('window'));
  assert.ok(match.lineNumber >= 1);
}

function testDependencyReferencesFromKnowledgeGraph() {
  resetProtocolStore();
  const document = getProtocolDocument();
  const sections = getProtocolSections();
  const references = getSectionDependencyReferences('3', document, sections);

  assert.ok(references.length > 0, 'section 3 seed entities should expose dependency references');
  assert.ok(references.some((ref) => ref.nodeType.length > 0));
}

function testImageReferenceTokenModel() {
  const reference = createProtocolAssetReference({
    type: 'figure',
    name: 'Study Design Overview',
    caption: 'Study Design Overview',
    storageLocation: 'protocol-assets/study-design-overview',
  });

  assert.ok(reference.id.startsWith('asset.'));
  assert.equal(reference.type, 'figure');
  assert.equal(reference.storageLocation, 'protocol-assets/study-design-overview');
  assert.ok(reference.createdAt);

  const token = formatImageReferenceToken(reference);
  assert.equal(token, '[Figure: Study Design Overview]');
  assert.equal(parseImageReferenceToken(token), 'Study Design Overview');
  assert.doesNotMatch(token, /data:image/);
}

function testImageReferenceInsertsIntoSectionText() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  const reference = createProtocolAssetReference({
    type: 'figure',
    name: 'Study Design Overview',
    caption: 'Study Design Overview',
  });
  const token = formatImageReferenceToken(reference);
  seedDraft('2', 'Introduction', `Design summary below.\n${token}`);

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  const content = resolveSectionEditorContent(draft);
  assert.ok(content.includes('[Figure: Study Design Overview]'));
  assert.doesNotMatch(content, /<img/i);
}

function testKeyboardShortcutResolution() {
  assert.equal(
    resolveProtocolIdeShortcut({ metaKey: true, key: 'f' }),
    'open-find',
  );
  assert.equal(
    resolveProtocolIdeShortcut({ ctrlKey: true, key: 'h' }),
    'open-replace',
  );
  assert.equal(
    resolveProtocolIdeShortcut({ ctrlKey: true, key: 's' }),
    'force-save',
  );
  assert.equal(
    resolveProtocolIdeShortcut({ ctrlKey: true, key: 'k' }),
    'toggle-protocol-search',
  );
  assert.equal(resolveProtocolIdeShortcut({ key: 'f' }), null);
}

function testFindReplacePreviewScaffold() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Endpoint endpoint endpoint');

  const preview = previewFindReplace(
    { find: 'endpoint', replace: 'outcome', scope: 'protocol' },
    getProtocolSections(),
    getProtocolImportState().sectionDrafts,
  );

  assert.equal(preview.totalReplacements, 3);
  assert.ok(preview.items.every((item) => item.after === 'outcome'));
}

function testValidationSummaryAndGutterIndicators() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Line one\nLine two');
  const section = findSectionById(getProtocolSections(), '2');
  assert.ok(section);
  const draft = getProtocolImportState().sectionDrafts['2'];
  const completeSection = { ...section, status: 'complete' as const };
  const summary = buildSectionValidationSummary('2', completeSection, draft, []);
  assert.equal(summary.passes, true);

  const gutter = buildEditorGutterIndicators('Line one\nLine two', summary);
  assert.ok(gutter.some((indicator) => indicator.kind === 'validation'));
}

function testTerminologySuggestionsHook() {
  const suggestions = getTerminologySuggestions('phase');
  assert.ok(Array.isArray(suggestions));
  for (const suggestion of suggestions) {
    assert.ok(suggestion.term.length > 0);
    assert.ok(suggestion.preferredTerm.length > 0);
  }
}

function testEditingAndAutosaveRegression() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  ensureManualSectionDraft('2', 'Introduction', '');
  applyManualSectionContentEdit('2', 'Introduction', 'First save');
  applyManualSectionContentEdit('2', 'Introduction', 'Second save with more detail');

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  assert.equal(resolveSectionEditorContent(draft), 'Second save with more detail');
}

async function main() {
  testProtocolSearchAcrossSections();
  testProtocolSearchScopedToSection();
  testSearchMatchNavigationPayload();
  testDependencyReferencesFromKnowledgeGraph();
  testImageReferenceTokenModel();
  testImageReferenceInsertsIntoSectionText();
  testKeyboardShortcutResolution();
  testFindReplacePreviewScaffold();
  testValidationSummaryAndGutterIndicators();
  testTerminologySuggestionsHook();
  testEditingAndAutosaveRegression();
  console.log('test-protocol-ide-v1: PASS');
}

void main();
