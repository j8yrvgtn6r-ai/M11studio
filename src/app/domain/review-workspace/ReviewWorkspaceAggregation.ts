import { inspectUsdmAlignmentGaps } from '../../agents/usdmAlignmentRules';
import { getLintIssues } from '../protocol/authoring/linting/protocolLintStore';
import { collectImportValidationFindings, getProtocolImportState } from '../protocol/import/protocolImportStore';
import { getValidationIssues } from '../protocol';
import { isBlankProjectMode } from '../protocol/store/protocolStore';
import { evaluateSoAEnrichmentReadiness, evaluateSoAFirstPassReadiness } from '../soa-knowledge/soaReadinessEvaluator';
import { getCurrentSoAEnrichmentProposal } from '../soa-knowledge/soaEnrichmentStore';
import {
  getCurrentSoANarrativeSyncProposal,
  getSoASectionRefreshDiagnostics,
} from '../soa-knowledge/soaNarrativeSyncStore';
import { getCurrentSoAProposal } from '../soa-knowledge/soaProposalStore';
import {
  detectStudyDesignConflicts,
  getCurrentNarrativeImpactProposal,
  getCurrentStudyDesignSyncProposal,
  getStudyDesign,
  getStudyDesignSummary,
  validateStudyDesign,
} from '../study-design';
import { evaluateUsdmExportReadiness } from '../usdm/usdmSelectors';
import type { ReviewItem, ReviewItemSeverity, ReviewItemSource } from './ReviewItemTypes';
import { getReviewItemStatusOverride } from './ReviewWorkspaceStore';

function now(): string {
  return new Date().toISOString();
}

function item(
  originId: string,
  source: ReviewItemSource,
  severity: ReviewItemSeverity,
  title: string,
  description: string,
  options: {
    sectionId?: string;
    relatedEntityIds?: string[];
    createdAt?: string;
    metadata?: Record<string, unknown>;
  } = {},
): ReviewItem {
  const provenanceKey = `${source}:${originId}`;
  const status = getReviewItemStatusOverride(provenanceKey) ?? 'open';
  const actions: ReviewItem['actions'] = ['openContext', 'accept', 'reject', 'defer'];

  return {
    id: provenanceKey,
    provenanceKey,
    source,
    severity,
    status,
    title,
    description,
    sectionId: options.sectionId,
    relatedEntityIds: options.relatedEntityIds,
    createdAt: options.createdAt ?? now(),
    actions,
    metadata: options.metadata,
  };
}

function normalizeSeverity(value: string | undefined): ReviewItemSeverity {
  if (value === 'error') return 'error';
  if (value === 'warning') return 'warning';
  return 'info';
}

export function aggregateReviewItems(): ReviewItem[] {
  const items: ReviewItem[] = [];

  const hasImportDrafts = Object.keys(getProtocolImportState().sectionDrafts).length > 0;
  if (hasImportDrafts) {
    for (const finding of collectImportValidationFindings(getProtocolImportState().sectionDrafts)) {
      items.push(
        item(
          `${finding.sectionId}-${finding.code ?? finding.message}`,
          'validation',
          normalizeSeverity(finding.severity),
          finding.code ?? 'Validation finding',
          finding.message,
          { sectionId: finding.sectionId, createdAt: now() },
        ),
      );
    }
  } else if (!isBlankProjectMode()) {
    for (const issue of getValidationIssues()) {
      items.push(
        item(issue.id, 'validation', normalizeSeverity(issue.severity), issue.name ?? issue.id, issue.message, {
          sectionId: issue.sectionId,
          relatedEntityIds: issue.fieldId ? [issue.fieldId] : undefined,
        }),
      );
    }
  }

  for (const lintIssue of getLintIssues()) {
    items.push(
      item(lintIssue.id, 'lint', normalizeSeverity(lintIssue.severity), lintIssue.category, lintIssue.message, {
        sectionId: lintIssue.sectionId,
        relatedEntityIds: lintIssue.relatedEntityIds,
        createdAt: lintIssue.createdAt,
        metadata: {
          lineNumber: lintIssue.lineNumber,
          startOffset: lintIssue.startOffset,
          suggestedFix: lintIssue.suggestedFix,
        },
      }),
    );
  }

  const studyDesign = getStudyDesign();
  if (studyDesign) {
    const validation = validateStudyDesign(studyDesign);
    for (const issue of validation.issues) {
      items.push(
        item(
          `${issue.field}-${issue.entityId ?? issue.message}`,
          'studyDesign',
          normalizeSeverity(issue.severity),
          issue.field,
          issue.message,
          {
            sectionId: '1.3',
            relatedEntityIds: issue.entityId ? [issue.entityId] : undefined,
            metadata: { entityKind: issue.entityKind },
          },
        ),
      );
    }

    for (const conflict of detectStudyDesignConflicts(studyDesign)) {
      items.push(
        item(conflict.id, 'studyDesign', normalizeSeverity(conflict.severity), conflict.kind, conflict.message, {
          sectionId: '1.3',
          relatedEntityIds: conflict.entityId ? [conflict.entityId] : undefined,
          metadata: { resolutionSuggestion: conflict.resolutionSuggestion },
        }),
      );
    }
  }

  const narrativeImpact = getCurrentNarrativeImpactProposal();
  if (narrativeImpact?.status === 'proposed') {
    items.push(
      item(
        narrativeImpact.id,
        'narrativeSync',
        'warning',
        `Narrative update: ${narrativeImpact.entityName}`,
        narrativeImpact.suggestedNote,
        {
          sectionId: narrativeImpact.impactedSectionIds[0],
          relatedEntityIds: [narrativeImpact.entityId],
          createdAt: narrativeImpact.createdAt,
          metadata: {
            impactedSectionIds: narrativeImpact.impactedSectionIds,
            entityKind: narrativeImpact.entityKind,
          },
        },
      ),
    );
  }

  const studyDesignSync = getCurrentStudyDesignSyncProposal();
  if (studyDesignSync?.status === 'proposed') {
    items.push(
      item(
        studyDesignSync.id,
        'studyDesign',
        'info',
        'Study Design sync proposal',
        studyDesignSync.reason ??
          `${studyDesignSync.addedItems.length} added, ${studyDesignSync.modifiedItems.length} modified`,
        {
          sectionId: studyDesignSync.addedItems[0]?.sectionId ?? '4',
          createdAt: studyDesignSync.createdAt,
          metadata: {
            proposalKind: 'sync',
            addedCount: studyDesignSync.addedItems.length,
            modifiedCount: studyDesignSync.modifiedItems.length,
          },
        },
      ),
    );

    for (const syncItem of studyDesignSync.addedItems.slice(0, 20)) {
      items.push(
        item(
          `${studyDesignSync.id}-added-${syncItem.id}`,
          'narrativeSync',
          'info',
          `Add ${syncItem.kind}: ${syncItem.name}`,
          syncItem.reason,
          {
            sectionId: syncItem.sectionId,
            relatedEntityIds: [syncItem.id],
            createdAt: studyDesignSync.createdAt,
            metadata: { proposalKind: 'studyDesignSyncItem', changeType: 'added' },
          },
        ),
      );
    }
  }

  const soaProposal = getCurrentSoAProposal();
  if (soaProposal?.status === 'proposed') {
    items.push(
      item(soaProposal.id, 'soa', 'info', 'SoA first-pass proposal', soaProposal.summary, {
        sectionId: soaProposal.sourceSectionIds[0] ?? '1.3',
        createdAt: soaProposal.createdAt,
        metadata: { counts: soaProposal.counts },
      }),
    );
    for (const warning of soaProposal.warnings.slice(0, 10)) {
      items.push(
        item(`${soaProposal.id}-warn-${warning.slice(0, 40)}`, 'soa', 'warning', 'SoA warning', warning, {
          sectionId: '1.3',
          createdAt: soaProposal.updatedAt,
        }),
      );
    }
  }

  const enrichment = getCurrentSoAEnrichmentProposal();
  if (enrichment?.status === 'proposed') {
    items.push(
      item(enrichment.id, 'soaEnrichment', 'info', 'SoA enrichment proposal', enrichment.summary, {
        sectionId: enrichment.sourceSectionIds[0] ?? '1.3',
        createdAt: enrichment.createdAt,
        metadata: { enrichedCounts: enrichment.enrichedCounts },
      }),
    );
    for (const warning of enrichment.warnings.slice(0, 10)) {
      items.push(
        item(
          `${enrichment.id}-warn-${warning.slice(0, 40)}`,
          'soaEnrichment',
          'warning',
          'Enrichment warning',
          warning,
          { sectionId: '1.3', createdAt: enrichment.updatedAt },
        ),
      );
    }
  }

  const soaNarrativeSync = getCurrentSoANarrativeSyncProposal();
  if (soaNarrativeSync?.status === 'proposed') {
    items.push(
      item(
        soaNarrativeSync.id,
        'narrativeSync',
        'warning',
        'SoA narrative sync proposal',
        soaNarrativeSync.reason,
        {
          sectionId: soaNarrativeSync.impactedSectionIds[0],
          createdAt: soaNarrativeSync.createdAt,
          metadata: { impactedSectionIds: soaNarrativeSync.impactedSectionIds },
        },
      ),
    );
  }

  for (const diagnostic of getSoASectionRefreshDiagnostics()) {
    items.push(
      item(
        `${diagnostic.sectionId}-${diagnostic.message.slice(0, 32)}`,
        'narrativeSync',
        'info',
        'SoA section refresh',
        diagnostic.message,
        { sectionId: diagnostic.sectionId, createdAt: diagnostic.createdAt },
      ),
    );
  }

  for (const draft of Object.values(getProtocolImportState().sectionDrafts)) {
    for (const impact of draft.consistencyImpacts ?? []) {
      items.push(
        item(
          impact.impactId,
          'consistency',
          'warning',
          impact.changedItemName,
          impact.reason,
          {
            sectionId: draft.sectionId,
            createdAt: impact.detectedAt,
            metadata: {
              sourceSectionId: impact.sourceSectionId,
              suggestedAction: impact.suggestedAction,
            },
          },
        ),
      );
    }
  }

  const usdmAlignment = inspectUsdmAlignmentGaps();
  for (const suggestion of usdmAlignment.suggestions) {
    items.push(
      item(
        suggestion.id,
        'usdm',
        normalizeSeverity(suggestion.severity === 'error' ? 'error' : suggestion.severity === 'warning' ? 'warning' : 'info'),
        suggestion.message.split('.')[0] ?? suggestion.message,
        suggestion.suggestedFix ? `${suggestion.message} — ${suggestion.suggestedFix}` : suggestion.message,
        {
          sectionId: suggestion.entityKind === 'visit' ? '1.3' : 'title',
          relatedEntityIds: suggestion.entityId ? [suggestion.entityId] : undefined,
          metadata: { entityKind: suggestion.entityKind },
        },
      ),
    );
  }

  const usdmReadiness = evaluateUsdmExportReadiness();
  if (usdmReadiness.state === 'notReady') {
    for (const error of usdmReadiness.blockingErrors.slice(0, 5)) {
      items.push(
        item(`usdm-block-${error.slice(0, 32)}`, 'usdm', 'error', 'Schedule export blocked', error, {
          sectionId: '1.3',
        }),
      );
    }
  }

  return items;
}

export function getReviewWorkspaceDerivedSummary(): {
  usdmReadiness: string;
  studyDesignHealth: string;
  soaStatus: string;
  narrativeSyncStatus: string;
} {
  const studySummary = getStudyDesignSummary();
  const usdm = evaluateUsdmExportReadiness();
  const firstPass = evaluateSoAFirstPassReadiness();
  const enrichmentReady = evaluateSoAEnrichmentReadiness();

  const hasNarrativeSync =
    getCurrentNarrativeImpactProposal()?.status === 'proposed' ||
    getCurrentSoANarrativeSyncProposal()?.status === 'proposed' ||
    getSoASectionRefreshDiagnostics().length > 0;

  return {
    usdmReadiness: usdm.state === 'ready' ? 'Ready' : usdm.state === 'readyWithWarnings' ? 'Ready with warnings' : 'Not ready',
    studyDesignHealth: studySummary.exists
      ? `Grade ${studySummary.healthScore.grade} (${studySummary.healthScore.score})`
      : 'Not built',
    soaStatus: getCurrentSoAEnrichmentProposal()?.status === 'proposed'
      ? 'Enrichment proposed'
      : getCurrentSoAProposal()?.status === 'proposed'
        ? 'First-pass proposed'
        : enrichmentReady.ready
          ? 'Enrichment ready'
          : firstPass.ready
            ? 'First-pass ready'
            : 'Pending Study Design',
    narrativeSyncStatus: hasNarrativeSync ? 'Review required' : 'No pending sync',
  };
}
