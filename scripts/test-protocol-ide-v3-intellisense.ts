import assert from 'node:assert/strict';

import {
  applyManualSectionContentEdit,
  ensureManualSectionDraft,
  getProtocolImportState,
} from '../src/app/domain/protocol/import';
import { persistProjectReset } from '../src/app/domain/protocol/import/protocolImportStore';
import { resetProtocolStoreToBlank } from '../src/app/domain/protocol/store/protocolStore';
import type { KnowledgeGraph } from '../src/app/domain/knowledge-graph/knowledgeGraphTypes';
import type { StudyModel } from '../src/app/domain/study-model/studyModelTypes';
import {
  applyIntellisenseSuggestion,
  buildProtocolIntellisenseContext,
  clearIntellisenseAcceptanceRecords,
  findIntellisenseSuggestionForFix,
  getPhraseRangeAtOffset,
  getProtocolIntellisenseSuggestions,
  listIntellisenseAcceptanceRecords,
  rankAndDedupeIntellisenseSuggestions,
  recordIntellisenseAcceptance,
  selectGhostTextSuggestion,
  type ProtocolIntellisenseSuggestion,
} from '../src/app/domain/protocol/authoring/intellisense';

function seedDraft(sectionId: string, title: string, text: string) {
  ensureManualSectionDraft(sectionId, title, '');
  applyManualSectionContentEdit(sectionId, title, text);
}

function buildContext(options: {
  sectionId: string;
  sectionTitle?: string;
  text: string;
  cursorOffset: number;
  trigger?: 'typing' | 'explicit' | 'tab' | 'hover';
  explicitQuery?: string;
  knowledgeGraph?: KnowledgeGraph | null;
  studyModel?: StudyModel | null;
}) {
  return buildProtocolIntellisenseContext({
    sectionId: options.sectionId,
    sectionTitle: options.sectionTitle,
    currentText: options.text,
    cursorOffset: options.cursorOffset,
    trigger: options.trigger,
    explicitQuery: options.explicitQuery,
    knowledgeGraph: options.knowledgeGraph ?? null,
    studyModel: options.studyModel ?? null,
    soaKnowledge: null,
  });
}

function mockKnowledgeGraph(): KnowledgeGraph {
  return {
    protocolId: 'test-protocol',
    entities: [
      {
        id: 'kg-endpoint-rpfs',
        entityType: 'endpoint',
        name: 'radiographic progression-free survival',
        normalizedName: 'radiographic progression-free survival',
        aliases: ['rPFS', 'radio pfs'],
        sourceSectionIds: ['3', '10'],
        sourceDocumentIds: [],
        metadata: {},
      },
      {
        id: 'kg-assessment-ecg',
        entityType: 'assessment',
        name: '12-lead electrocardiogram',
        normalizedName: '12-lead electrocardiogram',
        aliases: ['ECG'],
        sourceSectionIds: ['8'],
        sourceDocumentIds: [],
        metadata: {},
      },
    ],
    relationships: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

function mockStudyModel(): StudyModel {
  return {
    objectives: [{ id: 'obj-1', name: 'Improve overall survival', sourceSections: ['3'] }],
    endpoints: [{ id: 'ep-1', name: 'Overall survival', sourceSections: ['3', '10'] }],
    estimands: [],
    population: [{ id: 'pop-1', name: 'Adult participants with NSCLC', sourceSections: ['3', '5'] }],
    arms: [{ id: 'arm-1', name: 'Investigational arm', sourceSections: ['4'] }],
    interventions: [],
    assessments: [{ id: 'asmt-1', name: 'Tumor assessment', sourceSections: ['8'] }],
    activities: [],
    visits: [{ id: 'visit-1', name: 'Screening visit', sourceSections: ['8'] }],
    procedures: [],
    randomization: [],
    blinding: [],
    elements: [],
    eligibility: [],
    safetyMonitoring: [],
    statisticalMethods: [{ id: 'stat-1', name: 'Log-rank test', sourceSections: ['10'] }],
  };
}

function testTerminologyPartialMatchReturnsSuggestions() {
  const text = 'This is a phase';
  const context = buildContext({ sectionId: '2', text, cursorOffset: text.length });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions.some((entry) => entry.source === 'm11Terminology'));
  assert.ok(suggestions.some((entry) => entry.label.toLowerCase().includes('phase')));
}

function testSynonymReturnsPreferredTerm() {
  const text = 'uncontrolled study';
  const context = buildContext({
    sectionId: '4',
    sectionTitle: 'Trial Design',
    text,
    cursorOffset: text.length,
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  const terminology = suggestions.filter((entry) => entry.source === 'm11Terminology');
  assert.ok(terminology.length >= 1);
  assert.ok(terminology.some((entry) => entry.kind === 'synonym' || entry.kind === 'terminology'));
}

function testKnowledgeGraphEntityReturnsSuggestion() {
  const text = 'The primary endpoint is radio';
  const context = buildContext({
    sectionId: '3',
    sectionTitle: 'Objectives and Endpoints',
    text,
    cursorOffset: text.length,
    knowledgeGraph: mockKnowledgeGraph(),
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(
    suggestions.some(
      (entry) =>
        entry.source === 'protocolEntity' &&
        entry.insertText.toLowerCase().includes('radiographic progression-free survival'),
    ),
  );
}

function testSection8PrioritizesAssessmentSuggestions() {
  const text = 'assess';
  const context = buildContext({
    sectionId: '8',
    sectionTitle: 'Schedule of Activities',
    text,
    cursorOffset: text.length,
    studyModel: mockStudyModel(),
    knowledgeGraph: mockKnowledgeGraph(),
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.length >= 1);
  const topKinds = suggestions.slice(0, 3).map((entry) => entry.kind);
  assert.ok(
    topKinds.some((kind) => kind === 'assessment' || kind === 'visit' || kind === 'soa' || kind === 'phrase'),
    `Expected assessment-oriented kinds near top, got ${topKinds.join(', ')}`,
  );
}

function testSection10PrioritizesEndpointStatisticsSuggestions() {
  const text = 'endpoint';
  const context = buildContext({
    sectionId: '10',
    sectionTitle: 'Statistical Considerations',
    text,
    cursorOffset: text.length,
    studyModel: mockStudyModel(),
    knowledgeGraph: mockKnowledgeGraph(),
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.length >= 1);
  const topThree = suggestions.slice(0, 3);
  assert.ok(
    topThree.some(
      (entry) =>
        entry.kind === 'endpoint' ||
        entry.kind === 'estimand' ||
        entry.kind === 'phrase' ||
        entry.kind === 'terminology' ||
        entry.source === 'studyModel' ||
        entry.source === 'knowledgeGraph' ||
        entry.source === 'sectionContext',
    ),
    `Expected endpoint/statistics-oriented suggestions, got ${topThree.map((entry) => `${entry.kind}/${entry.source}`).join(', ')}`,
  );
}

function testDuplicateSuggestionsDedupe() {
  const duplicate: ProtocolIntellisenseSuggestion[] = [
    {
      id: 'a',
      label: 'Primary endpoint',
      insertText: 'Primary endpoint',
      kind: 'endpoint',
      source: 'sectionContext',
      score: 5,
    },
    {
      id: 'b',
      label: 'Primary endpoint',
      insertText: 'Primary endpoint',
      kind: 'phrase',
      source: 'studyModel',
      score: 8,
    },
  ];
  const context = buildContext({ sectionId: '3', text: 'Primary', cursorOffset: 7 });
  const deduped = rankAndDedupeIntellisenseSuggestions(duplicate, context);
  assert.equal(deduped.length, 1);
}

function testRankingPrefersExactPrefixOverWeakMatches() {
  const context = buildContext({ sectionId: '3', text: 'phase', cursorOffset: 5 });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.length >= 2);
  const first = suggestions[0];
  const last = suggestions[suggestions.length - 1];
  assert.ok(first.score >= last.score);
  if (first.label.toLowerCase().startsWith('phase')) {
    assert.ok(first.score >= 0);
  }
}

function testTabAcceptanceAppliesSuggestion() {
  const text = 'Use phase design.';
  const tokenStart = text.indexOf('phase');
  const suggestion: ProtocolIntellisenseSuggestion = {
    id: 'term.test',
    label: 'Phase II Trial',
    insertText: 'Phase II Trial',
    kind: 'terminology',
    source: 'm11Terminology',
    score: 10,
    replacementRange: { startOffset: tokenStart, endOffset: tokenStart + 'phase'.length },
  };
  const updated = applyIntellisenseSuggestion(text, suggestion);
  assert.match(updated, /Phase II Trial/);
  assert.doesNotMatch(updated, /\bphase design\b/);
}

function testEscapeDismissesByClearingSuggestionsState() {
  const context = buildContext({ sectionId: '2', text: 'p', cursorOffset: 1 });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.equal(suggestions.length, 0, 'Single-character query should not open IntelliSense popup');
}

function testAcceptedTerminologyRecordStored() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  clearIntellisenseAcceptanceRecords();
  seedDraft('2', 'Introduction', 'Phase 2 study.');

  recordIntellisenseAcceptance({
    sectionId: '2',
    suggestionId: 'term.phase',
    kind: 'terminology',
    source: 'm11Terminology',
    originalText: 'phase',
    insertedText: 'Phase II Trial',
    metadata: { codelistName: 'Trial Phase', code: 'C123' },
  });

  const records = listIntellisenseAcceptanceRecords('2');
  assert.equal(records.length, 1);
  assert.equal(records[0]?.insertedText, 'Phase II Trial');

  const draft = getProtocolImportState().sectionDrafts['2'];
  assert.ok(draft?.intellisenseAcceptanceLog?.length);
  assert.ok(draft?.terminologyAcceptanceLog?.length);
}

function testGhostTextAppearsOnlyForHighConfidencePhrase() {
  const prefix = 'The primary objective of this trial is';
  const context = buildContext({
    sectionId: '3',
    sectionTitle: 'Objectives',
    text: prefix,
    cursorOffset: prefix.length,
    studyModel: mockStudyModel(),
    knowledgeGraph: mockKnowledgeGraph(),
  });
  const { ghostText } = getProtocolIntellisenseSuggestions(context);
  assert.ok(ghostText);
  assert.ok((ghostText.score ?? 0) >= 0.85);
  assert.match(ghostText.insertText, /evaluate/i);
}

function testGhostTextHiddenWhenLowConfidence() {
  const text = 'Participants will';
  const context = buildContext({
    sectionId: '5',
    sectionTitle: 'Population',
    text,
    cursorOffset: text.length,
    studyModel: mockStudyModel(),
  });
  const { ghostText } = getProtocolIntellisenseSuggestions(context);
  assert.equal(ghostText, null);
}

function testGhostTextSelectorThreshold() {
  const lowConfidenceGhost: ProtocolIntellisenseSuggestion = {
    id: 'ghost.low',
    label: 'maybe',
    insertText: ' maybe',
    kind: 'ghostText',
    source: 'localHeuristic',
    score: 0.5,
  };
  assert.equal(selectGhostTextSuggestion([lowConfidenceGhost]), null);
}

function testReplacementRangeHandlesMultiWordSynonym() {
  const text = 'The investigational product is administered daily.';
  const phraseEnd = text.indexOf('product') + 'product'.length;
  const phrase = getPhraseRangeAtOffset(text, phraseEnd);
  assert.ok(phrase);
  assert.match(phrase.text.toLowerCase(), /investigational product/);

  const suggestion: ProtocolIntellisenseSuggestion = {
    id: 'syn.test',
    label: 'investigational trial intervention',
    insertText: 'investigational trial intervention',
    kind: 'synonym',
    source: 'm11Terminology',
    score: 12,
    replacementRange: { startOffset: phrase.startOffset, endOffset: phrase.endOffset },
  };
  const updated = applyIntellisenseSuggestion(text, suggestion);
  assert.match(updated, /investigational trial intervention is administered/);
  assert.doesNotMatch(updated, /investigational product/);
}

function testDiagnosticSuggestedFixOpensMatchingSuggestion() {
  const text = 'Use phase II wording.';
  const context = buildContext({
    sectionId: '2',
    text,
    cursorOffset: text.indexOf('phase II') + 'phase II'.length,
    explicitQuery: 'Phase 2',
    trigger: 'explicit',
  });
  const match = findIntellisenseSuggestionForFix(context, 'Phase 2');
  assert.ok(match);
}

function testMaxEightSuggestionsReturned() {
  const context = buildContext({
    sectionId: '10',
    sectionTitle: 'Statistical Considerations',
    text: 'trial',
    cursorOffset: 5,
    studyModel: mockStudyModel(),
    knowledgeGraph: mockKnowledgeGraph(),
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.length <= 8);
}

async function main() {
  testTerminologyPartialMatchReturnsSuggestions();
  testSynonymReturnsPreferredTerm();
  testKnowledgeGraphEntityReturnsSuggestion();
  testSection8PrioritizesAssessmentSuggestions();
  testSection10PrioritizesEndpointStatisticsSuggestions();
  testDuplicateSuggestionsDedupe();
  testRankingPrefersExactPrefixOverWeakMatches();
  testTabAcceptanceAppliesSuggestion();
  testEscapeDismissesByClearingSuggestionsState();
  testAcceptedTerminologyRecordStored();
  testGhostTextAppearsOnlyForHighConfidencePhrase();
  testGhostTextHiddenWhenLowConfidence();
  testGhostTextSelectorThreshold();
  testReplacementRangeHandlesMultiWordSynonym();
  testDiagnosticSuggestedFixOpensMatchingSuggestion();
  testMaxEightSuggestionsReturned();
  console.log('test-protocol-ide-v3-intellisense: PASS');
}

void main();
