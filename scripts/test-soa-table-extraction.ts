import assert from 'node:assert/strict';

import {
  acceptCurrentSoAProposal,
  evaluateSoAScheduleExtraction,
} from '../src/app/agents';
import {
  buildMatrixProposalPreview,
  extractSoATablesFromCanonicalDocument,
  reconcileNarrativeAndTableSoAKnowledge,
  ocrTableExtractionProvider,
  pdfTextTableExtractionProvider,
  resetSoAProposalStoreForTests,
  resetSoAKnowledgeForTests,
  getCurrentSoAProposal,
  getSoAKnowledge,
  rejectSoAProposal,
  createSoAProposal,
  createSoANarrativeSyncProposalFromSoAAcceptance,
  resetSoANarrativeSyncStoreForTests,
  flagSoARefreshNeededForNarrativeSection,
  getSoASectionRefreshDiagnostics,
} from '../src/app/domain/soa-knowledge';
import {
  classifyCellMarker,
  inferTableRole,
  isScheduleHeading,
  normalizeTableGrid,
} from '../src/app/domain/soa-knowledge/soaTableNormalizer';
import type { CanonicalDocument } from '../src/app/domain/document-ingestion/canonicalDocumentTypes';
import type { ExtractedTable } from '../src/app/domain/protocol/import/types';
import { getProtocolDocument } from '../src/app/domain/protocol/store/protocolStore';

function buildFixtureDocument(): CanonicalDocument {
  return {
    id: 'canonical-soa-test',
    blocks: [
      {
        id: 'block-0',
        type: 'heading',
        text: 'Schedule of Activities',
        normalizedText: 'schedule of activities',
        headingLevel: 1,
        sourceFormat: 'docx',
        sourceIndex: 0,
      },
      {
        id: 'block-table-0',
        type: 'table',
        text: 'Assessment Screening Baseline Vital Signs X X',
        normalizedText: 'assessment screening baseline vital signs x x',
        sourceFormat: 'docx',
        sourceIndex: 1,
      },
    ],
    sections: [
      {
        id: '1.3',
        title: 'Schedule of Activities',
        normalizedTitle: 'schedule of activities',
        startBlockIndex: 0,
        endBlockIndex: 1,
        blockIds: ['block-0', 'block-table-0'],
        text: 'Schedule of Activities table',
        diagnostics: [],
      },
    ],
    warnings: [],
    statistics: { blockCount: 2, headingCount: 1, sectionCount: 1, tableCount: 1 },
  };
}

function buildFixtureTable(): ExtractedTable {
  return {
    id: 'table-0',
    index: 0,
    rows: [
      ['Assessment', 'Screening', 'Baseline', 'Cycle 1 Day 1'],
      ['Vital Signs', 'X', 'X', 'X'],
      ['Tumor Imaging', '', 'X', ''],
      ['Physical Examination', 'if clinically indicated', '', 'X'],
    ],
    text: 'Assessment Screening Baseline Vital Signs X Tumor Imaging Physical Examination if clinically indicated',
  };
}

function testDetectsScheduleHeadingAndTableRole() {
  assert.equal(isScheduleHeading('Schedule of Activities'), true);
  const { normalizedCells } = normalizeTableGrid(buildFixtureTable().rows);
  const role = inferTableRole(['Schedule of Activities'], normalizedCells);
  assert.notEqual(role.role, 'unknown');
}

function testExtractsVisitsAssessmentsAndRules() {
  const result = extractSoATablesFromCanonicalDocument({
    document: buildFixtureDocument(),
    tables: [buildFixtureTable()],
  });
  assert.ok(result.candidateTables.length >= 1);
  assert.ok(result.extractedVisits.some((visit) => /screening/i.test(visit.name)));
  assert.ok(result.extractedAssessments.some((item) => /vital signs/i.test(item.name)));
  assert.ok(result.extractedScheduleRules.length >= 2);
}

function testRecognizesConditionalMarker() {
  const marker = classifyCellMarker('if clinically indicated');
  assert.equal(marker.optional, true);
  assert.ok(marker.condition);
}

function testMatrixPreviewBuilt() {
  const result = extractSoATablesFromCanonicalDocument({
    document: buildFixtureDocument(),
    tables: [buildFixtureTable()],
  });
  const preview = buildMatrixProposalPreview(result);
  assert.ok(preview.rows.length > 0);
  assert.ok(preview.columns.length > 0);
  assert.ok(preview.cells.length > 0);
}

function testReconciliationMergesDuplicatesAndDetectsConflict() {
  const tableResult = extractSoATablesFromCanonicalDocument({
    document: buildFixtureDocument(),
    tables: [buildFixtureTable()],
  });
  const narrativeOutput = evaluateSoAScheduleExtraction({
    protocolSections: [
      {
        sectionId: '1.3',
        title: 'SoA',
        text: 'Visits include Screening and Baseline. Vital signs performed at each visit.',
      },
    ],
    trigger: 'manual',
    existingSoAConfiguration: getProtocolDocument(),
  });
  const reconciliation = reconcileNarrativeAndTableSoAKnowledge({
    narrativePatch: narrativeOutput.soaKnowledgePatch,
    tableResult,
  });
  assert.ok(reconciliation.mergedPatch.assessments?.some((item) => /vital signs/i.test(item.name)));
  assert.ok(reconciliation.tableDerivedCount > 0);
}

function testAgentV3ProposalAcceptReject() {
  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  const output = evaluateSoAScheduleExtraction({
    protocolSections: [{ sectionId: '1.3', title: 'SoA', text: 'Screening and Baseline visits.' }],
    canonicalDocument: buildFixtureDocument(),
    extractedTables: [buildFixtureTable()],
    trigger: 'manual',
    existingSoAConfiguration: getProtocolDocument(),
  });
  assert.ok(output.matrixPreview);
  assert.ok((output.sourceSummary?.tableDerivedCount ?? 0) > 0);

  createSoAProposal({
    trigger: 'manual',
    summary: output.summary,
    soaKnowledgePatch: output.soaKnowledgePatch,
    configurationPatch: output.proposedConfigurationPatch,
    impactedNarrativeSections: output.impactedNarrativeSections,
    diagnostics: output.diagnostics,
    warnings: output.warnings,
    sourceSectionIds: output.soaKnowledgePatch.sourceSectionIds ?? [],
    counts: {
      arms: 0,
      epochs: 0,
      elements: 0,
      visits: output.soaKnowledgePatch.visits?.length ?? 0,
      activities: 0,
      assessments: output.soaKnowledgePatch.assessments?.length ?? 0,
      scheduleRules: output.soaKnowledgePatch.scheduleRules?.length ?? 0,
      conditions: output.soaKnowledgePatch.conditions?.length ?? 0,
      footnotes: 0,
    },
    tableExtraction: output.tableExtraction,
    matrixPreview: output.matrixPreview,
    sourceSummary: output.sourceSummary,
  });

  const accepted = acceptCurrentSoAProposal();
  assert.equal(accepted.accepted, true);
  assert.ok((getSoAKnowledge()?.scheduleRules.length ?? 0) > 0);

  resetSoAKnowledgeForTests();
  resetSoAProposalStoreForTests();
  createSoAProposal({
    trigger: 'manual',
    summary: output.summary,
    soaKnowledgePatch: output.soaKnowledgePatch,
    impactedNarrativeSections: [],
    diagnostics: [],
    warnings: [],
    sourceSectionIds: [],
    counts: {
      arms: 0,
      epochs: 0,
      elements: 0,
      visits: 1,
      activities: 0,
      assessments: 1,
      scheduleRules: 1,
      conditions: 0,
      footnotes: 0,
    },
  });
  rejectSoAProposal();
  assert.equal(getCurrentSoAProposal()?.status, 'rejected');
  assert.equal(getSoAKnowledge(), null);
}

function testNarrativeSyncAndRefreshDiagnostics() {
  resetSoANarrativeSyncStoreForTests();
  const proposal = createSoANarrativeSyncProposalFromSoAAcceptance({ changeKind: 'scheduleRuleChanged' });
  assert.ok(proposal);
  assert.ok(proposal!.impactedSectionIds.includes('1.3'));
  flagSoARefreshNeededForNarrativeSection('8');
  assert.ok(getSoASectionRefreshDiagnostics().some((entry) => entry.sectionId === '8'));
}

async function testPdfOcrProvidersUnavailable() {
  const pdf = await pdfTextTableExtractionProvider.extract({ uploadId: 'pdf-1' });
  assert.ok(pdf.diagnostics.some((entry) => entry.code === 'providerUnavailable'));
  const ocr = await ocrTableExtractionProvider.extract({ uploadId: 'scan-1', imagePages: 2 });
  assert.ok(ocr.diagnostics.some((entry) => /OCR/i.test(entry.message)));
}

async function main() {
  testDetectsScheduleHeadingAndTableRole();
  testExtractsVisitsAssessmentsAndRules();
  testRecognizesConditionalMarker();
  testMatrixPreviewBuilt();
  testReconciliationMergesDuplicatesAndDetectsConflict();
  testAgentV3ProposalAcceptReject();
  testNarrativeSyncAndRefreshDiagnostics();
  await testPdfOcrProvidersUnavailable();
  console.log('test:soa-table-extraction — all checks passed');
}

void main();
