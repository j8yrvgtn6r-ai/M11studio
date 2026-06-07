import { agentManager } from './AgentManager';
import { ensureAgentsRegistered } from './consistencyAgentRunner';
import { SOA_AGENT_ID, soaAgent, type SoAAgentInput, type SoAAgentOutput } from './SoAAgent';
import { getKnowledgeGraph } from '../domain/knowledge-graph/knowledgeGraphStore';
import { patchKnowledgeGraph } from '../domain/knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import {
  getProtocolImportState,
  applyConsistencyAgentResults,
  getImportedProtocolSource,
  getProtocolKnowledgeModel,
} from '../domain/protocol/import/protocolImportStore';
import type { GeneratedSectionDraft } from '../domain/protocol/import/types';
import { getStudyModel } from '../domain/study-model/studyModelStore';
import { getCanonicalDocumentByUploadId } from '../domain/document-ingestion';
import {
  createSoANarrativeSyncProposalFromSoAAcceptance,
} from '../domain/soa-knowledge/soaNarrativeSyncStore';
import {
  applySoAConfigurationPatchSafely,
} from '../domain/soa-knowledge/soaConfigurationPatch';
import { applySoAKnowledgeGraphPatchSafely } from '../domain/soa-knowledge/soaKnowledgeGraphBridge';
import { sectionsFromImportDrafts } from '../domain/soa-knowledge/soaKnowledgeBuilder';
import { getSoAKnowledge, patchSoAKnowledge } from '../domain/soa-knowledge/soaKnowledgeStore';
import {
  acceptSoAProposal,
  createSoAProposal,
  getCurrentSoAProposal,
  rejectSoAProposal,
} from '../domain/soa-knowledge/soaProposalStore';
import type { SoAAgentTrigger } from '../domain/soa-knowledge/soaProposalTypes';
import {
  countSoAKnowledgePatch,
  evaluateSoAScheduleExtraction,
} from './soaAgentRules';

let initialized = false;

export function ensureSoAAgentRegistered(): void {
  if (initialized) {
    return;
  }
  ensureAgentsRegistered();
  if (!agentManager.getAgent(SOA_AGENT_ID)) {
    agentManager.register(soaAgent);
  }
  initialized = true;
}

function buildSoAAgentInput(options: {
  trigger: SoAAgentTrigger;
  drafts?: Record<string, GeneratedSectionDraft>;
  changedSectionIds?: string[];
}): SoAAgentInput {
  const drafts = options.drafts ?? getProtocolImportState().sectionDrafts;
  const importedSource = getImportedProtocolSource();
  const canonicalDocument = importedSource
    ? getCanonicalDocumentByUploadId(importedSource.uploadId)
    : null;
  return {
    protocolSections: sectionsFromImportDrafts(drafts),
    soaKnowledgeModel: getSoAKnowledge(),
    knowledgeGraph: getKnowledgeGraph(),
    coreStudyModel: undefined,
    studyModel: getStudyModel(),
    existingSoAConfiguration: getProtocolDocument(),
    canonicalDocument,
    extractedTables: importedSource?.tables ?? [],
    trigger: options.trigger,
    changedSectionIds: options.changedSectionIds,
  };
}

export async function runSoAAgent(options: {
  trigger: SoAAgentTrigger;
  drafts?: Record<string, GeneratedSectionDraft>;
  changedSectionIds?: string[];
  selectedSectionId?: string;
}): Promise<SoAAgentOutput | null> {
  ensureSoAAgentRegistered();
  const input = buildSoAAgentInput(options);
  const result = await agentManager.runAgent<SoAAgentInput, SoAAgentOutput>(SOA_AGENT_ID, {
    protocolDocument: getProtocolDocument(),
    selectedSectionId: options.selectedSectionId,
    protocolKnowledgeModel: getProtocolKnowledgeModel(),
    coreStudyModel: input.coreStudyModel,
    studyModel: input.studyModel,
    trigger: options.trigger === 'import' ? 'import' : 'manual',
    input,
  });
  return result.output ?? null;
}

export async function runSoAAgentFromImport(
  drafts: Record<string, GeneratedSectionDraft>,
): Promise<SoAAgentOutput | null> {
  return runSoAAgent({ trigger: 'import', drafts });
}

export async function generateFirstPassSoA(): Promise<SoAAgentOutput | null> {
  appendProtocolBuildEvent({ type: 'progress', message: 'Generate First-Pass SoA requested' });
  return runSoAAgent({ trigger: 'generateFirstPass' });
}

function markImpactedNarrativeSections(
  proposal = getCurrentSoAProposal(),
): string[] {
  if (!proposal?.impactedNarrativeSections.length) {
    return [];
  }
  const availableSectionIds = Object.keys(getProtocolImportState().sectionDrafts);
  if (availableSectionIds.length === 0) {
    return [];
  }

  const impacts = proposal.impactedNarrativeSections
    .filter((entry) => availableSectionIds.includes(entry.sectionId))
    .map((entry) => ({
      sectionId: entry.sectionId,
      reasons: [
        {
          sourceSectionId: 'soa-agent',
          sourceSectionTitle: 'SoA Agent',
          changedItemName: 'Schedule structure',
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

export function acceptCurrentSoAProposal(): {
  accepted: boolean;
  configurationDeferred: string[];
  markedSections: string[];
} {
  const proposal = getCurrentSoAProposal();
  if (!proposal || proposal.status !== 'proposed') {
    return { accepted: false, configurationDeferred: ['No proposed SoA proposal to accept.'], markedSections: [] };
  }

  const mergedKnowledge = patchSoAKnowledge(proposal.soaKnowledgePatch);
  const configResult = applySoAConfigurationPatchSafely(proposal.configurationPatch);
  const graphPatch = applySoAKnowledgeGraphPatchSafely(mergedKnowledge);
  if (graphPatch.entities?.length || graphPatch.relationships?.length) {
    patchKnowledgeGraph(graphPatch);
  }

  acceptSoAProposal();
  const markedSections = markImpactedNarrativeSections(proposal);
  const narrativeSyncProposal = createSoANarrativeSyncProposalFromSoAAcceptance({
    relatedProposalId: proposal.id,
    changeKind: 'scheduleRuleChanged',
  });
  if (narrativeSyncProposal) {
    appendProtocolBuildEvent({
      type: 'info',
      message: 'Narrative sync proposal created',
      metadata: { impactedSections: narrativeSyncProposal.impactedSectionIds.length },
    });
  }

  appendProtocolBuildEvent({
    type: 'success',
    message: 'SoA proposal accepted',
    metadata: { ...proposal.counts, markedSections: markedSections.length },
  });
  if (!configResult.applied) {
    appendProtocolBuildEvent({
      type: 'info',
      message: 'SoA Configuration update deferred — review adapter notes in proposal diagnostics.',
    });
  }

  return {
    accepted: true,
    configurationDeferred: configResult.deferred,
    markedSections,
  };
}

export function rejectCurrentSoAProposal(): boolean {
  const proposal = getCurrentSoAProposal();
  if (!proposal || proposal.status !== 'proposed') {
    return false;
  }
  rejectSoAProposal();
  appendProtocolBuildEvent({ type: 'info', message: 'SoA proposal rejected' });
  return true;
}

export function createEmptySoAProposalSafely(trigger: SoAAgentTrigger = 'manual'): void {
  const output = evaluateSoAScheduleExtraction({
    protocolSections: [],
    trigger,
    existingSoAConfiguration: getProtocolDocument(),
  });
  createSoAProposal({
    trigger,
    summary: output.summary,
    soaKnowledgePatch: output.soaKnowledgePatch,
    configurationPatch: output.proposedConfigurationPatch,
    impactedNarrativeSections: output.impactedNarrativeSections,
    diagnostics: output.diagnostics,
    warnings: output.warnings,
    sourceSectionIds: [],
    counts: countSoAKnowledgePatch(output.soaKnowledgePatch),
  });
}

export { getCurrentSoAProposal };
