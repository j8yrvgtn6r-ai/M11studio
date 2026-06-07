import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  ensureManualSectionDraft,
  getProtocolImportState,
  updateSectionImportDraft,
} from '../src/app/domain/protocol/import';
import { persistProjectReset } from '../src/app/domain/protocol/import/protocolImportStore';
import { resolveSectionEditorContent } from '../src/app/domain/protocol/import/sectionAuthoring';
import { resetImportWorkspace, resetProject } from '../src/app/domain/protocol/import/projectReset';
import {
  buildEditorGutterIndicators,
  buildSectionValidationSummary,
  getTerminologySuggestions,
} from '../src/app/domain/protocol/authoring/editorIntegration';
import {
  buildLineDiagnostics,
  diagnosticsToGutterIndicators,
  lineNumberFromOffset,
  offsetFromLineColumn,
} from '../src/app/domain/protocol/authoring/lineDiagnostics';
import {
  diagnosticHighlightsFromLineDiagnostics,
  wrapPlainTextWithHighlights,
} from '../src/app/domain/protocol/authoring/diagnosticHighlights';
import {
  applyTokenReplacement,
  getTokenAtOffset,
  recordTerminologyAcceptance,
  resolveTerminologyHoverInfo,
  suggestionToAcceptance,
} from '../src/app/domain/protocol/authoring/terminologyEditorIntegration';
import {
  addAsset,
  clearAssets,
  listAssets,
  reloadAssetRegistryFromStorage,
} from '../src/app/domain/protocol/assets/protocolAssetRegistry';
import {
  formatImageReferenceToken,
  parseImageReferenceToken,
} from '../src/app/domain/protocol/assets/protocolAssetReference';
import {
  applyReplaceTransaction,
  clearReplaceTransactions,
  getLastAppliedReplaceTransaction,
  groupMatchesBySection,
  buildReplacePreviewWithMatches,
  undoLastReplaceTransaction,
} from '../src/app/domain/protocol/search/replaceTransaction';
import { getProtocolSections } from '../src/app/domain/protocol';
import { resetProtocolStoreToBlank } from '../src/app/domain/protocol/store/protocolStore';
import type { ProtocolSection } from '../src/app/types/protocol';
import type { GeneratedSectionDraft } from '../src/app/domain/protocol/import/types';

function seedDraft(sectionId: string, title: string, text: string) {
  ensureManualSectionDraft(sectionId, title, '');
  applyManualSectionContentEdit(sectionId, title, text);
}

function testLineDiagnosticsMapFindingToLine() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  const content = 'Line one\nUse phase II wording here.';
  seedDraft('2', 'Introduction', content);

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft);
  updateSectionImportDraft('2', {
    validationChanges: [
      {
        id: 'change-1',
        type: 'terminology',
        originalText: 'phase II',
        replacementText: 'Phase 2',
        reason: 'Use controlled trial phase terminology',
        startIndex: content.indexOf('phase II'),
        endIndex: content.indexOf('phase II') + 'phase II'.length,
        severity: 'warning',
      },
    ],
  });

  const diagnostics = buildLineDiagnostics({
    sectionId: '2',
    content,
    draft: getProtocolImportState().sectionDrafts['2'],
  });

  const terminology = diagnostics.find((entry) => entry.category === 'terminology');
  assert.ok(terminology);
  assert.equal(terminology.lineNumber, 2);
  assert.equal(terminology.startOffset, content.indexOf('phase II'));
}

function testGutterShowsLineMarker() {
  const content = 'Alpha\nBeta terminology issue';
  const diagnostics = buildLineDiagnostics({
    sectionId: '2',
    content,
    draft: {
      ...(getProtocolImportState().sectionDrafts['2'] ?? {
        sectionId: '2',
        title: 'Introduction',
        generatedText: content,
        validationFindings: [],
        validationStatus: 'warnings',
        state: 'draft',
      }),
      validationFindings: [
        {
          code: 'terminology.non-preferred',
          severity: 'warning',
          message: 'Non-preferred terminology',
          suggestedTerm: 'Beta',
        },
      ],
    } as GeneratedSectionDraft,
  });

  const gutter = diagnosticsToGutterIndicators(diagnostics);
  assert.ok(gutter.some((entry) => entry.lineNumber === 2));
  assert.ok(gutter.some((entry) => entry.category === 'terminology'));

  const summary = buildSectionValidationSummary('2', null, undefined, []);
  const indicators = buildEditorGutterIndicators(content, summary, {
    sectionId: '2',
    draft: {
      sectionId: '2',
      title: 'Introduction',
      generatedText: content,
      validationFindings: [
        {
          code: 'terminology.non-preferred',
          severity: 'warning',
          message: 'Non-preferred terminology',
          suggestedTerm: 'Beta',
        },
      ],
      validationStatus: 'warnings',
      state: 'draft',
    } as GeneratedSectionDraft,
  });
  assert.ok(indicators.some((entry) => entry.lineNumber === 2 && entry.kind === 'terminology'));
}

function testInlineTerminologyHighlight() {
  const plain = 'Use phase II in this sentence.';
  const start = plain.indexOf('phase II');
  const diagnostics = buildLineDiagnostics({
    sectionId: '2',
    content: plain,
    draft: {
      sectionId: '2',
      title: 'Introduction',
      generatedText: plain,
      validationFindings: [],
      validationStatus: 'warnings',
      state: 'draft',
      validationChanges: [
        {
          id: 'c1',
          type: 'terminology',
          originalText: 'phase II',
          replacementText: 'Phase 2',
          reason: 'Controlled terminology',
          startIndex: start,
          endIndex: start + 'phase II'.length,
          severity: 'warning',
        },
      ],
    } as GeneratedSectionDraft,
  });

  const highlights = diagnosticHighlightsFromLineDiagnostics(plain, diagnostics);
  assert.ok(highlights.length >= 1);
  const html = wrapPlainTextWithHighlights(plain, highlights);
  assert.match(html, /protocol-diagnostic-terminology/);
  assert.match(html, /phase II/);
}

function testTerminologySuggestionAcceptanceFlow() {
  const text = 'The study uses phase 2 design.';
  const phaseEnd = text.indexOf('phase') + 'phase'.length;
  const token = getTokenAtOffset(text, phaseEnd);
  assert.ok(token);
  assert.equal(token.token, 'phase');

  const suggestions = getTerminologySuggestions('phase');
  assert.ok(suggestions.length >= 1);
  const suggestion = suggestions[0];

  const replaced = applyTokenReplacement(text, token, suggestion.preferredTerm);
  assert.ok(replaced.includes(suggestion.preferredTerm));

  const acceptance = suggestionToAcceptance(suggestion, token.token);
  assert.equal(acceptance.acceptedTerm, suggestion.preferredTerm);
  assert.ok(acceptance.codelistName.length > 0);
}

function testTerminologyAcceptanceAutosavesToDraft() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Phase 2 study.');
  const suggestions = getTerminologySuggestions('phase');
  assert.ok(suggestions[0]);
  recordTerminologyAcceptance('2', suggestionToAcceptance(suggestions[0], 'Phase'));
  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft?.terminologyAcceptanceLog?.length);
}

function testControlledTermHoverInfo() {
  const info = resolveTerminologyHoverInfo('phase');
  assert.ok(info);
  assert.ok(info.preferredTerm.length > 0);
  assert.ok(info.codelistName.length > 0);
  assert.ok(Array.isArray(info.synonyms));
}

function testReplacePreviewGroupsBySection() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Endpoint endpoint');
  seedDraft('3', 'Objectives', 'Endpoint measure');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const matches = buildReplacePreviewWithMatches(
    { find: 'endpoint', replace: 'outcome', scope: 'protocol' },
    sections,
    drafts,
  );
  const grouped = groupMatchesBySection(matches);
  assert.ok(grouped.size >= 2);
  assert.ok(grouped.has('2'));
  assert.ok(grouped.has('3'));
}

async function testApplyAndUndoReplace() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  clearReplaceTransactions();
  seedDraft('2', 'Introduction', 'Endpoint endpoint endpoint');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const matches = buildReplacePreviewWithMatches(
    { find: 'endpoint', replace: 'outcome', scope: 'section', scopeSectionId: '2' },
    sections,
    drafts,
  );
  const selectedIds = matches.map((match) => match.id);
  const applyResult = await applyReplaceTransaction(
    { find: 'endpoint', replace: 'outcome', scope: 'section', scopeSectionId: '2' },
    sections,
    drafts,
    selectedIds,
  );
  assert.equal(applyResult.applied, true);
  assert.ok(getLastAppliedReplaceTransaction()?.appliedAt);

  const afterApply = resolveSectionEditorContent(getProtocolImportState().sectionDrafts['2']);
  assert.equal(afterApply, 'outcome outcome outcome');

  const undoResult = await undoLastReplaceTransaction(sections);
  assert.equal(undoResult.reverted, true);
  const afterUndo = resolveSectionEditorContent(getProtocolImportState().sectionDrafts['2']);
  assert.equal(afterUndo, 'Endpoint endpoint endpoint');
}

async function testKnowledgeAgentPipelineAfterReplace() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  clearReplaceTransactions();
  seedDraft('2', 'Introduction', 'Primary endpoint is survival.');

  const sections = getProtocolSections();
  const drafts = getProtocolImportState().sectionDrafts;
  const matches = buildReplacePreviewWithMatches(
    { find: 'endpoint', replace: 'outcome', scope: 'section', scopeSectionId: '2' },
    sections,
    drafts,
  );

  const { scheduleKnowledgeAgentForSectionEdit } = await import('../src/app/agents/knowledgeAgentRunner');
  assert.equal(typeof scheduleKnowledgeAgentForSectionEdit, 'function');

  const result = await applyReplaceTransaction(
    { find: 'endpoint', replace: 'outcome', scope: 'section', scopeSectionId: '2' },
    sections,
    drafts,
    matches.map((match) => match.id),
  );
  assert.equal(result.applied, true);
}

function testAssetRegistryCrud() {
  clearAssets();
  reloadAssetRegistryFromStorage();
  assert.equal(listAssets().length, 0);

  const asset = addAsset({
    type: 'figure',
    name: 'Study Design',
    caption: 'Study Design Overview',
    source: 'generated',
  });
  assert.ok(asset.id);
  assert.equal(listAssets().length, 1);

  clearAssets();
  assert.equal(listAssets().length, 0);
}

function testImageReferenceTokenInsertFormat() {
  const asset = addAsset({
    type: 'figure',
    name: 'Study Design Overview',
    caption: 'Study Design Overview',
    source: 'url',
    url: 'https://example.com/figure.png',
  });
  const token = formatImageReferenceToken({ id: asset.id, caption: asset.caption });
  assert.equal(token, `[Figure: Study Design Overview](asset:${asset.id})`);
  assert.doesNotMatch(token, /data:image/);
  clearAssets();
}

function testFigureReferenceParseForReadOnlyCard() {
  const parsed = parseImageReferenceToken('[Figure: Study Design Overview](asset:asset.test)');
  assert.ok(parsed);
  assert.equal(parsed.caption, 'Study Design Overview');
  assert.equal(parsed.assetId, 'asset.test');
}

function testLineOffsetHelpers() {
  const text = 'a\nb\nc';
  assert.equal(lineNumberFromOffset(text, 2), 2);
  assert.equal(offsetFromLineColumn(text, 3), 4);
}

async function testResetProjectClearsAssetsAndTransactions() {
  clearAssets();
  addAsset({
    type: 'figure',
    name: 'Keep test',
    caption: 'Keep test',
    source: 'generated',
  });
  clearReplaceTransactions();
  resetProtocolStoreToBlank();
  persistProjectReset();
  seedDraft('2', 'Introduction', 'Endpoint');
  await applyReplaceTransaction(
    { find: 'Endpoint', replace: 'Outcome', scope: 'section', scopeSectionId: '2' },
    getProtocolSections(),
    getProtocolImportState().sectionDrafts,
    buildReplacePreviewWithMatches(
      { find: 'Endpoint', replace: 'Outcome', scope: 'section', scopeSectionId: '2' },
      getProtocolSections(),
      getProtocolImportState().sectionDrafts,
    ).map((match) => match.id),
  );
  assert.ok(getLastAppliedReplaceTransaction());

  await resetProject();
  reloadAssetRegistryFromStorage();
  assert.equal(listAssets().length, 0);
  assert.equal(getLastAppliedReplaceTransaction(), null);
}

function testReplacementImportPreservesUserAssets() {
  clearAssets();
  addAsset({
    type: 'figure',
    name: 'User asset',
    caption: 'User asset',
    source: 'uploaded',
  });
  addAsset({
    type: 'figure',
    name: 'Imported asset',
    caption: 'Imported asset',
    source: 'imported',
  });
  assert.equal(listAssets().length, 2);

  resetImportWorkspace();
  assert.equal(listAssets().length, 1);
  assert.equal(listAssets()[0]?.source, 'uploaded');
  clearAssets();
}

async function main() {
  testLineDiagnosticsMapFindingToLine();
  testGutterShowsLineMarker();
  testInlineTerminologyHighlight();
  testTerminologySuggestionAcceptanceFlow();
  testTerminologyAcceptanceAutosavesToDraft();
  testControlledTermHoverInfo();
  testReplacePreviewGroupsBySection();
  await testApplyAndUndoReplace();
  await testKnowledgeAgentPipelineAfterReplace();
  testAssetRegistryCrud();
  testImageReferenceTokenInsertFormat();
  testFigureReferenceParseForReadOnlyCard();
  testLineOffsetHelpers();
  await testResetProjectClearsAssetsAndTransactions();
  testReplacementImportPreservesUserAssets();
  console.log('test-protocol-ide-v2: PASS');
}

void main();
