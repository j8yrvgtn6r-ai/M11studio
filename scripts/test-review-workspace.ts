import assert from 'node:assert/strict';

import { resetKnowledgeGraphForTests } from '../src/app/domain/knowledge-graph/knowledgeGraphStore';
import { setLintIssues } from '../src/app/domain/protocol/authoring/linting/protocolLintStore';
import { mutateProtocolDocument, clearBlankProjectMode } from '../src/app/domain/protocol/store/protocolStore';
import { getProtocolImportState } from '../src/app/domain/protocol/import/protocolImportStore';
import { createSoAProposal } from '../src/app/domain/soa-knowledge/soaProposalStore';
import {
  addManualStudyDesignEntity,
  getStudyDesign,
  resetStudyDesignForTests,
  setNarrativeImpactProposal,
  setStudyDesignSyncProposal,
} from '../src/app/domain/study-design';
import { buildStudyDesignFromKnowledgeGraph } from '../src/app/domain/study-design/StudyDesignSynchronization';
import { createNarrativeImpactProposal } from '../src/app/domain/study-design/synchronization/StudyDesignToNarrative';
import {
  acceptReviewItem,
  aggregateReviewItems,
  bulkAcceptReviewInfo,
  bulkDeferReviewItems,
  clearResolvedReviewWorkspaceItems,
  DEFAULT_REVIEW_WORKSPACE_FILTERS,
  deferReviewItem,
  filterReviewItems,
  getReviewActionHistory,
  getReviewWorkspaceSummary,
  openReviewItemContext,
  rejectReviewItem,
  resetReviewWorkspaceForTests,
} from '../src/app/domain/review-workspace';

function seedValidationIssue() {
  clearBlankProjectMode();
  mutateProtocolDocument((draft) => {
    draft.validationIssues.push({
      id: 'validation-test-1',
      ruleId: 'test-rule',
      name: 'Test validation',
      severity: 'error',
      sectionId: '4',
      message: 'Test validation issue for review workspace.',
    });
  });
}

function seedLintIssue() {
  setLintIssues('4', [
    {
      id: 'lint-test-1',
      sectionId: '4',
      lineNumber: 2,
      startOffset: 0,
      severity: 'warning',
      category: 'terminology',
      message: 'Lint issue for review workspace.',
      source: 'deterministic',
      createdAt: new Date().toISOString(),
    },
  ]);
}

function seedStudyDesignAndProposals() {
  resetStudyDesignForTests();
  addManualStudyDesignEntity('epoch', { name: 'Treatment' });
  const epochId = getStudyDesign()!.epochs[0]!.id;
  addManualStudyDesignEntity('visit', { name: 'Baseline', visitClass: 'scheduled', epochId });

  const visit = getStudyDesign()!.visits[0]!;
  setNarrativeImpactProposal(
    createNarrativeImpactProposal({
      entityKind: 'visit',
      entityId: visit.id,
      entityName: visit.name,
      changeType: 'modified',
    }),
  );

  resetKnowledgeGraphForTests();
  setStudyDesignSyncProposal(buildStudyDesignFromKnowledgeGraph());
}

function seedSoAProposal() {
  createSoAProposal({
    trigger: 'manualRefresh',
    summary: 'Test SoA proposal',
    soaKnowledgePatch: {
      visits: [{ id: 'visit-test', name: 'Week 1', sourceSectionIds: ['1.3'], inferenceSource: 'deterministic' }],
    },
    impactedNarrativeSections: [],
    diagnostics: [],
    warnings: ['SoA warning for review workspace'],
    sourceSectionIds: ['1.3'],
    counts: {
      arms: 0,
      epochs: 0,
      elements: 0,
      visits: 1,
      activities: 0,
      assessments: 0,
      scheduleRules: 0,
      conditions: 0,
      footnotes: 0,
    },
  });
}

function testAggregationCollectsSources() {
  resetReviewWorkspaceForTests();
  seedValidationIssue();
  seedLintIssue();
  seedStudyDesignAndProposals();
  seedSoAProposal();

  const items = aggregateReviewItems();
  assert.ok(items.some((item) => item.source === 'validation'));
  assert.ok(items.some((item) => item.source === 'lint'));
  assert.ok(items.some((item) => item.source === 'studyDesign'));
  assert.ok(items.some((item) => item.source === 'narrativeSync'));
  assert.ok(items.some((item) => item.source === 'soa'));
  assert.ok(items.some((item) => item.source === 'usdm'));
}

function testFiltering() {
  const items = aggregateReviewItems();
  const warnings = filterReviewItems(items, {
    ...DEFAULT_REVIEW_WORKSPACE_FILTERS,
    severities: ['warning'],
    statuses: ['open'],
  });
  assert.ok(warnings.every((item) => item.severity === 'warning'));
}

function testSummaryCounts() {
  const items = aggregateReviewItems();
  const summary = getReviewWorkspaceSummary(items);
  assert.ok(summary.open >= 1);
  assert.ok(typeof summary.usdmReadiness === 'string');
  assert.ok(typeof summary.studyDesignHealth === 'string');
}

function testAcceptRejectDefer() {
  resetReviewWorkspaceForTests();
  seedLintIssue();
  const lintItem = aggregateReviewItems().find((item) => item.source === 'lint');
  assert.ok(lintItem);

  deferReviewItem(lintItem!);
  assert.equal(
    aggregateReviewItems().find((item) => item.id === lintItem!.id)?.status,
    'deferred',
  );

  acceptReviewItem(lintItem!);
  assert.equal(
    aggregateReviewItems().find((item) => item.id === lintItem!.id)?.status,
    'accepted',
  );

  rejectReviewItem(lintItem!);
  assert.equal(
    aggregateReviewItems().find((item) => item.id === lintItem!.id)?.status,
    'rejected',
  );
}

function testBulkActions() {
  resetReviewWorkspaceForTests();
  seedLintIssue();
  seedSoAProposal();
  const before = aggregateReviewItems().filter((item) => item.status === 'open').length;
  bulkDeferReviewItems();
  const deferred = aggregateReviewItems().filter((item) => item.status === 'deferred').length;
  assert.ok(deferred >= 1);

  bulkAcceptReviewInfo();
  clearResolvedReviewWorkspaceItems();
  const after = aggregateReviewItems().filter((item) => item.status === 'accepted').length;
  assert.ok(before >= 1);
  assert.ok(after >= 0);
}

function testHistoryPersistence() {
  resetReviewWorkspaceForTests();
  seedLintIssue();
  const item = aggregateReviewItems().find((entry) => entry.source === 'lint');
  acceptReviewItem(item!);
  const history = getReviewActionHistory();
  assert.ok(history.some((record) => record.userAction === 'accepted' && record.source === 'lint'));
}

function testNavigationCallbacks() {
  let navigatedSection: string | null = null;
  let openedSoA = false;
  openReviewItemContext(
    {
      id: 'lint:lint-test-1',
      provenanceKey: 'lint:lint-test-1',
      source: 'lint',
      severity: 'warning',
      status: 'open',
      title: 'Lint',
      description: 'Test',
      sectionId: '4',
      createdAt: new Date().toISOString(),
      actions: ['openContext'],
      metadata: { lineNumber: 2 },
    },
    {
      onNavigateSection: (sectionId) => {
        navigatedSection = sectionId;
      },
      onNavigateLint: (sectionId) => {
        navigatedSection = sectionId;
      },
      onOpenSoAConfiguration: () => {
        openedSoA = true;
      },
    },
  );
  assert.equal(navigatedSection, '4');

  openReviewItemContext(
    {
      id: 'soa:test',
      provenanceKey: 'soa:test',
      source: 'soa',
      severity: 'info',
      status: 'open',
      title: 'SoA',
      description: 'Test',
      sectionId: '1.3',
      createdAt: new Date().toISOString(),
      actions: ['openContext'],
    },
    {
      onOpenSoAConfiguration: () => {
        openedSoA = true;
      },
    },
  );
  assert.equal(openedSoA, true);
}

async function main() {
  getProtocolImportState().sectionDrafts = {};
  testAggregationCollectsSources();
  testFiltering();
  testSummaryCounts();
  testAcceptRejectDefer();
  testBulkActions();
  testHistoryPersistence();
  testNavigationCallbacks();
  console.log('test-review-workspace: PASS');
}

void main();
