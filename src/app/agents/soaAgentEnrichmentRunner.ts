import { getKnowledgeGraph, patchKnowledgeGraph } from '../domain/knowledge-graph/knowledgeGraphStore';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import {
  applyConsistencyAgentResults,
  getProtocolImportState,
} from '../domain/protocol/import/protocolImportStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import {
  buildDeterministicBaselineModel,
  buildSoAEnrichmentProposal,
  runSoAEnrichmentProvider,
} from './soaAgentEnrichment';
import {
  applySoAConfigurationPatchSafely,
  buildProposedConfigurationPatch,
} from '../domain/soa-knowledge/soaConfigurationPatch';
import {
  enrichmentProposalToKnowledgePatch,
  type SoAEnrichmentProposal,
} from '../domain/soa-knowledge/soaEnrichmentProposal';
import {
  acceptSoAEnrichmentProposal,
  createSoAEnrichmentProposal,
  getCurrentSoAEnrichmentProposal,
  rejectSoAEnrichmentProposal,
} from '../domain/soa-knowledge/soaEnrichmentStore';
import { sectionsFromImportDrafts } from '../domain/soa-knowledge/soaKnowledgeBuilder';
import { applySoAKnowledgeGraphPatchSafely } from '../domain/soa-knowledge/soaKnowledgeGraphBridge';
import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel } from '../domain/soa-knowledge/soaKnowledgePatch';
import { getSoAKnowledge, patchSoAKnowledge } from '../domain/soa-knowledge/soaKnowledgeStore';

export async function runSoAEnrichment(): Promise<SoAEnrichmentProposal | null> {
  appendProtocolBuildEvent({ type: 'progress', message: 'SoA LLM enrichment started' });
  appendProtocolBuildEvent({ type: 'progress', message: 'Analyzing schedule structure' });

  const drafts = getProtocolImportState().sectionDrafts;
  const protocolSections = sectionsFromImportDrafts(drafts);
  const protocolDocument = getProtocolDocument();
  const existingKnowledge = getSoAKnowledge();
  const deterministicModel = buildDeterministicBaselineModel(
    protocolSections,
    protocolDocument.id,
    existingKnowledge,
  );

  appendProtocolBuildEvent({ type: 'progress', message: 'Reconciling schedule entities', provider: 'soa-enrichment' });

  const providerResult = await runSoAEnrichmentProvider({
    protocolSections,
    deterministicModel,
    knowledgeGraph: getKnowledgeGraph(),
    existingSoAConfiguration: protocolDocument,
  });

  if (providerResult.error) {
    appendProtocolBuildEvent({ type: 'warning', message: providerResult.error, provider: providerResult.provider, model: providerResult.model });
  }

  const built = buildSoAEnrichmentProposal(
    {
      protocolSections,
      deterministicModel,
      knowledgeGraph: getKnowledgeGraph(),
      existingSoAConfiguration: protocolDocument,
    },
    providerResult.response,
    providerResult.provider,
    providerResult.model,
  );

  const knowledgePatch = enrichmentProposalToKnowledgePatch(built.proposal);
  const previewModel = applySoAKnowledgePatch(
    existingKnowledge ?? createEmptySoAKnowledgeModel(protocolDocument.id),
    knowledgePatch,
  );
  const configurationPatch = buildProposedConfigurationPatch(previewModel, protocolDocument);

  const proposal = createSoAEnrichmentProposal({
    ...built.proposal,
    knowledgePatch,
    configurationPatch,
  });

  appendProtocolBuildEvent({
    type: 'success',
    message: 'Generated enrichment proposal',
    provider: proposal.provider,
    model: proposal.model,
    metadata: {
      visits: proposal.enrichedCounts.visits,
      assessments: proposal.enrichedCounts.assessments,
      scheduleRules: proposal.enrichedCounts.scheduleRules,
    },
  });
  appendProtocolBuildEvent({
    type: 'info',
    message: `Proposed: ${proposal.enrichedCounts.visits} visits, ${proposal.enrichedCounts.assessments} assessments, ${proposal.enrichedCounts.scheduleRules} rules`,
  });
  appendProtocolBuildEvent({ type: 'success', message: 'SoA LLM enrichment completed' });

  return proposal;
}

function markImpactedNarrativeSections(proposal: SoAEnrichmentProposal): string[] {
  const availableSectionIds = Object.keys(getProtocolImportState().sectionDrafts);
  if (availableSectionIds.length === 0 || proposal.impactedNarrativeSections.length === 0) {
    return [];
  }

  const impacts = proposal.impactedNarrativeSections
    .filter((entry) => availableSectionIds.includes(entry.sectionId))
    .map((entry) => ({
      sectionId: entry.sectionId,
      reasons: [
        {
          sourceSectionId: 'soa-enrichment',
          sourceSectionTitle: 'SoA LLM Enrichment',
          changedItemName: 'Schedule enrichment',
          changedItemCollection: 'schedule',
          relationship: 'soa_schedule_change',
          reason: entry.reason,
          suggestedAction: 'edit' as const,
        },
      ],
    }));

  if (impacts.length === 0) {
    return [];
  }

  return applyConsistencyAgentResults('soa-agent', impacts);
}

export function acceptCurrentSoAEnrichmentProposal(): {
  accepted: boolean;
  configurationDeferred: string[];
  markedSections: string[];
} {
  const proposal = getCurrentSoAEnrichmentProposal();
  if (!proposal || proposal.status !== 'proposed' || !proposal.knowledgePatch) {
    return {
      accepted: false,
      configurationDeferred: ['No proposed SoA enrichment proposal to accept.'],
      markedSections: [],
    };
  }

  const mergedKnowledge = patchSoAKnowledge(proposal.knowledgePatch);
  const configResult = applySoAConfigurationPatchSafely(proposal.configurationPatch);
  const graphPatch = applySoAKnowledgeGraphPatchSafely(mergedKnowledge);
  if (graphPatch.entities?.length || graphPatch.relationships?.length) {
    patchKnowledgeGraph(graphPatch);
  }

  acceptSoAEnrichmentProposal();
  const markedSections = markImpactedNarrativeSections(proposal);

  appendProtocolBuildEvent({
    type: 'success',
    message: 'SoA enrichment proposal accepted',
    metadata: { markedSections: markedSections.length, ...proposal.enrichedCounts },
  });

  return {
    accepted: true,
    configurationDeferred: configResult.deferred,
    markedSections,
  };
}

export function rejectCurrentSoAEnrichmentProposal(): boolean {
  const proposal = getCurrentSoAEnrichmentProposal();
  if (!proposal || proposal.status !== 'proposed') {
    return false;
  }
  rejectSoAEnrichmentProposal();
  appendProtocolBuildEvent({ type: 'info', message: 'SoA enrichment proposal rejected' });
  return true;
}

export { getCurrentSoAEnrichmentProposal };
