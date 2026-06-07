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
  buildProtocolEntityRegistry,
  buildEntityDiagnostics,
  clearProtocolEntityReferences,
  entityCompletionProvider,
  getRelatedEntitySuggestions,
  getSectionEntityPriorities,
  recordEntityAcceptance,
  resolveProtocolEntityHoverInfo,
  searchProtocolEntities,
} from '../src/app/domain/protocol/entities';
import {
  buildProtocolIntellisenseContext,
  getProtocolIntellisenseSuggestions,
} from '../src/app/domain/protocol/authoring/intellisense';

function mockGraph(): KnowledgeGraph {
  return {
    protocolId: 'test',
    entities: [
      {
        id: 'endpoint_rpfs',
        entityType: 'endpoint',
        name: 'Radiographic Progression-Free Survival',
        normalizedName: 'radiographic progression-free survival',
        aliases: ['rPFS'],
        sourceSectionIds: ['3', '10'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'endpoint_os',
        entityType: 'endpoint',
        name: 'Overall Survival',
        normalizedName: 'overall survival',
        aliases: ['OS'],
        sourceSectionIds: ['3', '10'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'objective_primary',
        entityType: 'objective',
        name: 'Improve overall survival',
        normalizedName: 'improve overall survival',
        aliases: [],
        sourceSectionIds: ['3'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'assessment_tumor',
        entityType: 'assessment',
        name: 'Tumor Imaging',
        normalizedName: 'tumor imaging',
        aliases: [],
        sourceSectionIds: ['8'],
        sourceDocumentIds: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    relationships: [
      {
        id: 'rel_1',
        sourceEntityId: 'endpoint_rpfs',
        targetEntityId: 'assessment_tumor',
        relationshipType: 'measured_by',
        sourceSectionIds: ['8'],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rel_2',
        sourceEntityId: 'objective_primary',
        targetEntityId: 'endpoint_os',
        relationshipType: 'has_endpoint',
        sourceSectionIds: ['3'],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

function mockStudyModel(): StudyModel {
  return {
    id: 'sm-test',
    sourceUploadId: 'upload',
    builtAt: new Date().toISOString(),
    studyMetadata: {},
    objectives: [{ id: 'obj-1', name: 'Improve overall survival', sourceSections: ['3'], lastUpdated: new Date().toISOString() }],
    endpoints: [{ id: 'ep-1', name: 'Overall Survival', sourceSections: ['10'], lastUpdated: new Date().toISOString() }],
    estimands: [],
    population: [],
    arms: [],
    epochs: [],
    elements: [],
    visits: [
      { id: 'v1', name: 'Cycle 1 Day 1', sourceSections: ['8'], lastUpdated: new Date().toISOString() },
      { id: 'v2', name: 'Cycle 2 Day 1', sourceSections: ['8'], lastUpdated: new Date().toISOString() },
    ],
    activities: [],
    assessments: [{ id: 'a1', name: 'Tumor assessment', sourceSections: ['8'], lastUpdated: new Date().toISOString() }],
    interventions: [],
    eligibility: [],
    randomization: [],
    blinding: [],
    procedures: [],
    safetyMonitoring: [],
    statisticalMethods: [{ id: 'stat-1', name: 'Log-rank test', sourceSections: ['10'], lastUpdated: new Date().toISOString() }],
    references: [],
  };
}

function testEntityRegistryBuildsCorrectly() {
  const registry = buildProtocolEntityRegistry({
    knowledgeGraph: mockGraph(),
    studyModel: mockStudyModel(),
  });
  assert.ok(registry.entities.length >= 4);
  assert.ok(registry.entities.some((entry) => entry.name === 'Radiographic Progression-Free Survival'));
  assert.ok(registry.entities.some((entry) => entry.name === 'Cycle 1 Day 1'));
}

function testEntityCompletionReturnsGraphEntities() {
  const context = buildProtocolIntellisenseContext({
    sectionId: '3',
    sectionTitle: 'Objectives',
    currentText: 'Primary endpoint is radio',
    cursorOffset: 'Primary endpoint is radio'.length,
    knowledgeGraph: mockGraph(),
    studyModel: mockStudyModel(),
  });
  const suggestions = entityCompletionProvider(context);
  assert.ok(suggestions.some((entry) => entry.insertText.includes('Radiographic Progression-Free Survival')));
}

function testSectionAwareRankingWorks() {
  const registry = buildProtocolEntityRegistry({ knowledgeGraph: mockGraph(), studyModel: mockStudyModel() });
  const section8 = searchProtocolEntities('cycle', { registry, sectionId: '8', limit: 4 });
  const section10 = searchProtocolEntities('overall', { registry, sectionId: '10', limit: 4 });
  assert.ok(section8.some((entry) => entry.type === 'visit'));
  assert.ok(section10.some((entry) => entry.type === 'endpoint' || entry.type === 'statistic'));
  assert.deepEqual(getSectionEntityPriorities('8'), ['assessment', 'procedure', 'visit', 'activity', 'timingWindow']);
}

function testHoverCardsResolveEntityInfo() {
  const registry = buildProtocolEntityRegistry({ knowledgeGraph: mockGraph(), studyModel: mockStudyModel() });
  const hover = resolveProtocolEntityHoverInfo('Radiographic Progression-Free Survival', {
    registry,
    graph: mockGraph(),
  });
  assert.ok(hover);
  assert.equal(hover?.entity.type, 'endpoint');
  assert.ok(hover?.relationships.some((entry) => entry.entityName === 'Tumor Imaging'));
}

function testEntityReferencesCreated() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  clearProtocolEntityReferences();
  ensureManualSectionDraft('3', 'Objectives', '');
  applyManualSectionContentEdit('3', 'Objectives', 'Primary endpoint is OS.');

  recordEntityAcceptance({
    sectionId: '3',
    entityId: 'endpoint_os',
    entityType: 'endpoint',
    displayText: 'Overall Survival',
    offset: 20,
    endOffset: 36,
  });

  const draft = getProtocolImportState().sectionDrafts['3'];
  assert.ok(draft?.entityReferences?.length);
  assert.ok(draft?.entityInsertionLog?.length);
}

function testDuplicateEntityWarningAppears() {
  const registry = buildProtocolEntityRegistry({
    knowledgeGraph: {
      ...mockGraph(),
      entities: [
        ...mockGraph().entities,
        {
          id: 'endpoint_os_dup',
          entityType: 'endpoint',
          name: 'Overall Survival',
          normalizedName: 'overall survival',
          aliases: [],
          sourceSectionIds: ['10'],
          sourceDocumentIds: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  });
  const diagnostics = buildEntityDiagnostics({
    sectionId: '3',
    content: 'Overall Survival endpoint.',
    references: [],
    registry,
    knowledgeGraph: {
      ...mockGraph(),
      entities: [
        ...mockGraph().entities,
        {
          id: 'endpoint_os_dup',
          entityType: 'endpoint',
          name: 'Overall Survival Duplicate',
          normalizedName: 'overall survival',
          aliases: [],
          sourceSectionIds: ['10'],
          sourceDocumentIds: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  });
  assert.ok(diagnostics.some((entry) => entry.code === 'duplicate_entity_name'));
}

function testRelatedSuggestionsAppear() {
  const context = buildProtocolIntellisenseContext({
    sectionId: '3',
    currentText: 'Primary objective is ',
    cursorOffset: 'Primary objective is '.length,
    knowledgeGraph: mockGraph(),
    studyModel: mockStudyModel(),
  });
  const related = getRelatedEntitySuggestions('objective_primary', context);
  assert.ok(related.length >= 1);
  assert.ok(related.some((entry) => entry.metadata?.relatedToEntityId === 'objective_primary'));
}

function testUnifiedIntellisenseIncludesProtocolEntities() {
  const context = buildProtocolIntellisenseContext({
    sectionId: '10',
    sectionTitle: 'Statistics',
    currentText: 'overall',
    cursorOffset: 7,
    knowledgeGraph: mockGraph(),
    studyModel: mockStudyModel(),
  });
  const { suggestions } = getProtocolIntellisenseSuggestions(context);
  assert.ok(suggestions.some((entry) => entry.source === 'protocolEntity'));
}

function testAuditRecordStored() {
  resetProtocolStoreToBlank();
  persistProjectReset();
  clearProtocolEntityReferences();
  ensureManualSectionDraft('8', 'SoA', '');
  recordEntityAcceptance({
    sectionId: '8',
    entityId: 'assessment_tumor',
    entityType: 'assessment',
    displayText: 'Tumor Imaging',
    offset: 0,
    endOffset: 13,
  });
  const draft = getProtocolImportState().sectionDrafts['8'];
  assert.equal(draft?.entityInsertionLog?.[0]?.insertedText, 'Tumor Imaging');
}

async function main() {
  testEntityRegistryBuildsCorrectly();
  testEntityCompletionReturnsGraphEntities();
  testSectionAwareRankingWorks();
  testHoverCardsResolveEntityInfo();
  testEntityReferencesCreated();
  testDuplicateEntityWarningAppears();
  testRelatedSuggestionsAppear();
  testUnifiedIntellisenseIncludesProtocolEntities();
  testAuditRecordStored();
  console.log('test-protocol-ide-v3-entity-authoring: PASS');
}

void main();
