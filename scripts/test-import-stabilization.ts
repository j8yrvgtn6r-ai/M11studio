import assert from 'node:assert/strict';

import { getMapSectionTilePresentation } from '../src/app/components/SectionGenerationStateIndicator';
import { resetImportBuildConsoleWorkspace } from '../src/app/domain/protocol/build/protocolBuildConsoleStore';
import {
  buildImportSummaryReport,
  buildLlmRoutingAuditReport,
} from '../src/app/domain/protocol/import/importSummaryReport';
import {
  clearImportInMemoryCaches,
  getProtocolImportState,
  persistImportWorkspaceReset,
  persistProjectReset,
} from '../src/app/domain/protocol/import/protocolImportStore';
import { resetImportWorkspace, resetProject } from '../src/app/domain/protocol/import/projectReset';
import {
  resolveSectionWorkflowDisplayBadge,
  shouldShowRequiredMissing,
} from '../src/app/domain/protocol/import/sectionDisplayStatus';
import { resolveProtocolDisplayIdentity } from '../src/app/domain/protocol/import/protocolIdentity';
import { buildSectionImportDiagnosticsForSection } from '../src/app/domain/protocol/import/sectionImportDiagnostics';
import type { GeneratedSectionDraft } from '../src/app/domain/protocol/import/types';
import { getProtocolDocument, resetProtocolStore } from '../src/app/domain/protocol/store/protocolStore';
import { formatValidationChangeTooltip } from '../src/app/agents/validationRules';

function testResetImportWorkspaceClearsState() {
  persistImportWorkspaceReset();
  const state = getProtocolImportState();
  assert.equal(Object.keys(state.sectionDrafts).length, 0);
  assert.equal(state.importedSourceSummary, null);
  assert.equal(state.sectionImportDiagnostics, undefined);
  resetImportBuildConsoleWorkspace();
}

async function testResetProjectClearsArtifacts() {
  await resetProject();
  const state = getProtocolImportState();
  assert.equal(state.lastImportCompletedAt, null);
  assert.equal(Object.keys(state.sectionDrafts).length, 0);
  assert.ok(getProtocolDocument().id);
}

function testImportedSectionsDoNotShowRequiredMissing() {
  const draft: GeneratedSectionDraft = {
    sectionId: '1',
    title: 'Protocol Summary',
    generatedText: 'Imported protocol summary text with enough content.',
    sourceUploadId: 'upload',
    sourceExtractionId: 'upload',
    knowledgeModelId: 'km',
    matchedSourceCandidateIds: [],
    extractionStatus: 'complete',
    generationStatus: 'complete',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'structural-mapping-v1',
      generatedAt: new Date().toISOString(),
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'test',
    stateHistory: [],
    generatedAt: new Date().toISOString(),
    contentOrigin: 'imported',
    workflowState: 'importedUnvalidated',
    validationStatus: 'not-run',
  };

  assert.equal(
    shouldShowRequiredMissing({ draft, generationState: 'importedUnvalidated' }),
    false,
  );
  assert.equal(
    resolveSectionWorkflowDisplayBadge({ draft, generationState: 'importedUnvalidated' }),
    'Pending Validation',
  );
}

function testMapIconsAndPresentation() {
  const imported = getMapSectionTilePresentation('importedUnvalidated');
  assert.equal(imported.label, 'Imported from DOCX');
  assert.match(imported.nextAction, /validation/i);

  const generated = getMapSectionTilePresentation('generated');
  assert.equal(generated.label, 'Generated');
}

function testFooterProtocolIdentityFallback() {
  const identity = resolveProtocolDisplayIdentity({
    importedSourceSummary: { filename: 'ACME-301.docx' } as never,
    fallbackProtocolId: 'PROTO-XYZ-301',
  });
  assert.equal(identity, 'ACME-301');
}

function testValidationHoverReasons() {
  const tooltip = formatValidationChangeTooltip({
    id: 'change-1',
    type: 'terminology',
    reason: 'Use controlled terminology for endpoint',
    severity: 'required',
    terminologyCode: 'ENDPOINT',
  });
  assert.match(tooltip, /Reason:/);
  assert.match(tooltip, /Source: Controlled Terminology/);
}

function testImportSummaryGenerated() {
  const summary = buildImportSummaryReport({
    mappings: [{ mappedM11SectionId: '1' } as never],
    suspiciousMappings: [],
    needsGenerationSectionIds: ['2'],
    sectionDrafts: {},
    sectionGenerationStates: {},
    generationSchedule: {
      queue: [],
      skippedSections: [],
      prioritizedSections: ['3'],
      backgroundSections: [],
      generationSummary: {
        queuedCount: 1,
        skippedCount: 1,
        priorityCount: 1,
        backgroundCount: 0,
        immediateCount: 1,
        status: 'scheduled',
      },
      reasons: [],
    },
    diagnostics: {},
  });
  assert.equal(summary.needsGeneration, 1);
  assert.equal(summary.generationQueued, 1);
}

function testOrphanDiagnosticsPopulated() {
  const diagnostics = buildSectionImportDiagnosticsForSection('8.4.2', {
    mappings: [],
    suspiciousMappings: [],
    needsGenerationSectionIds: ['8.4.2'],
    generationSchedule: {
      queue: [],
      skippedSections: [{ sectionId: '8.4.2', reason: 'No source context' }],
      prioritizedSections: [],
      backgroundSections: [],
      generationSummary: {
        queuedCount: 0,
        skippedCount: 1,
        priorityCount: 0,
        backgroundCount: 0,
        immediateCount: 0,
        status: 'skipped',
      },
      reasons: [],
    },
    importedSource: null,
    protocolKnowledgeModel: null,
    importContextPhase: 'ready',
    sectionDrafts: {},
    sectionSkipReasons: {},
    sectionGenerationStates: { '8.4.2': 'needsGeneration' },
  });
  assert.ok(diagnostics.orphanClassification);
  assert.ok(diagnostics.nextRecommendedAction);
  assert.match(diagnostics.diagnosticSummary, /Mapping:/);
}

async function main() {
  testResetImportWorkspaceClearsState();
  resetImportWorkspace();
  clearImportInMemoryCaches();
  await testResetProjectClearsArtifacts();
  resetProtocolStore();
  testImportedSectionsDoNotShowRequiredMissing();
  testMapIconsAndPresentation();
  testFooterProtocolIdentityFallback();
  testValidationHoverReasons();
  testImportSummaryGenerated();
  testOrphanDiagnosticsPopulated();
  buildLlmRoutingAuditReport({
    mappings: [],
    sectionDrafts: {},
    needsGenerationSectionIds: [],
    generationSchedule: {
      queue: [],
      skippedSections: [],
      prioritizedSections: [],
      backgroundSections: [],
      generationSummary: {
        queuedCount: 0,
        skippedCount: 0,
        priorityCount: 0,
        backgroundCount: 0,
        immediateCount: 0,
        status: 'scheduled',
      },
      reasons: [],
    },
  });
  console.log('Import stabilization tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
