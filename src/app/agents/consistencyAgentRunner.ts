import { agentManager } from './AgentManager';
import type { AgentTrigger } from './AgentContext';
import {
  CONSISTENCY_AGENT_ID,
  consistencyAgent,
  type ConsistencyAgentInput,
  type ConsistencyAgentOutput,
  type ConsistencyAgentTrigger,
} from './ConsistencyAgent';
import { evaluateConsistencyImpacts } from './consistencyRules';
import type { KnowledgeExtractedItem } from './knowledgeAgentHeuristics';
import { knowledgeAgent } from './KnowledgeAgent';
import { soaAgent } from './SoAAgent';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import { getProtocolBuildConsoleState } from '../domain/protocol/build/protocolBuildConsoleStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import { getStudyModel } from '../domain/study-model/studyModelStore';
import type { StudyModelPatch } from '../domain/study-model/studyModelPatch';

let initialized = false;

interface PendingConsistencyCheck {
  sourceSectionId: string;
  sourceSectionTitle?: string;
  changedItems: KnowledgeExtractedItem[];
  studyModelPatch?: StudyModelPatch;
  trigger: ConsistencyAgentTrigger;
}

const pendingImportChecks: PendingConsistencyCheck[] = [];
let importBatchTimer: ReturnType<typeof setTimeout> | null = null;

async function loadImportStore() {
  return import('../domain/protocol/import/protocolImportStore');
}

function ensureAgentsRegistered(): void {
  if (initialized) {
    return;
  }
  agentManager.register(knowledgeAgent);
  agentManager.register(consistencyAgent);
  agentManager.register(soaAgent);
  initialized = true;
}

function mapTrigger(trigger: AgentTrigger | ConsistencyAgentTrigger): ConsistencyAgentTrigger {
  if (trigger === 'sectionApproval') {
    return 'sectionReviewed';
  }
  if (trigger === 'background') {
    return 'manual';
  }
  return trigger as ConsistencyAgentTrigger;
}

async function isDraftProtectedFromOutOfSync(sectionId: string): Promise<boolean> {
  const { getSectionImportDrafts } = await loadImportStore();
  const draft = getSectionImportDrafts()[sectionId];
  if (!draft) {
    return true;
  }
  if (draft.generationStatus === 'failed') {
    return true;
  }
  const liveState = getProtocolBuildConsoleState().sectionStates[sectionId];
  if (liveState === 'generating' || liveState === 'queued') {
    return true;
  }
  return false;
}

async function canMarkDraftOutOfSync(sectionId: string): Promise<boolean> {
  const { getSectionImportDrafts } = await loadImportStore();
  const draft = getSectionImportDrafts()[sectionId];
  if (!draft || (await isDraftProtectedFromOutOfSync(sectionId))) {
    return false;
  }
  if (draft.workflowState === 'importedUnvalidated' || draft.workflowState === 'needsGeneration' || draft.workflowState === 'validationRunning' || draft.workflowState === 'validationProposed') {
    return false;
  }
  return true;
}

async function buildAppliedImpacts(options: PendingConsistencyCheck) {
  const { getSectionImportDrafts } = await loadImportStore();
  const availableSectionIds = Object.keys(getSectionImportDrafts());
  const sectionImpacts = evaluateConsistencyImpacts({
    sourceSectionId: options.sourceSectionId,
    changedItems: options.changedItems,
    availableSectionIds,
  });

  const filtered: Array<{
    sectionId: string;
    reasons: Array<{
      sourceSectionId: string;
      sourceSectionTitle?: string;
      changedItemName: string;
      changedItemCollection: string;
      relationship: string;
      reason: string;
      suggestedAction: 'validate' | 'regenerate' | 'edit';
    }>;
  }> = [];

  for (const impact of sectionImpacts) {
    if (!(await canMarkDraftOutOfSync(impact.sectionId))) {
      continue;
    }
    filtered.push({
      sectionId: impact.sectionId,
      reasons: impact.reasons.map((reason) => ({
        ...reason,
        sourceSectionId: options.sourceSectionId,
        sourceSectionTitle: options.sourceSectionTitle,
      })),
    });
  }

  return filtered;
}

async function applyConsistencyCheck(options: PendingConsistencyCheck): Promise<string[]> {
  if (!getStudyModel() || !options.changedItems.length) {
    return [];
  }
  const filteredImpacts = await buildAppliedImpacts(options);
  if (filteredImpacts.length === 0) {
    return [];
  }
  const { applyConsistencyAgentResults } = await loadImportStore();
  return applyConsistencyAgentResults(options.sourceSectionId, filteredImpacts);
}

async function runConsistencyAgentWithEvents(options: PendingConsistencyCheck): Promise<string[]> {
  ensureAgentsRegistered();

  const studyModel = getStudyModel();
  if (!studyModel || !options.changedItems.length) {
    return [];
  }

  try {
    const { getSectionImportDrafts } = await loadImportStore();
    const availableSectionIds = Object.keys(getSectionImportDrafts());
    const result = await agentManager.runAgent<ConsistencyAgentInput, ConsistencyAgentOutput>(
      CONSISTENCY_AGENT_ID,
      {
        protocolDocument: getProtocolDocument(),
        selectedSectionId: options.sourceSectionId,
        studyModel,
        trigger: options.trigger,
        input: {
          sourceSectionId: options.sourceSectionId,
          sourceSectionTitle: options.sourceSectionTitle,
          changedItems: options.changedItems,
          studyModelPatch: options.studyModelPatch,
          currentStudyModel: studyModel,
          trigger: options.trigger,
          availableSectionIds,
        },
      },
    );

    const output = result.output;
    if (!output?.sectionImpacts?.length || result.status === 'skipped') {
      return [];
    }

    const marked = await applyConsistencyCheck(options);
    if (marked.length > 0) {
      appendProtocolBuildEvent({
        type: 'warning',
        message: `${marked.length} section(s) marked out of sync`,
        sectionId: options.sourceSectionId,
        metadata: { outOfSyncCount: marked.length },
      });
    } else {
      appendProtocolBuildEvent({
        type: 'info',
        message: 'No downstream impacts found',
        sectionId: options.sourceSectionId,
      });
    }
    return marked;
  } catch {
    return [];
  }
}

async function flushImportConsistencyBatch(): Promise<void> {
  importBatchTimer = null;
  if (pendingImportChecks.length === 0) {
    return;
  }

  const batch = [...pendingImportChecks];
  pendingImportChecks.length = 0;

  appendProtocolBuildEvent({
    type: 'progress',
    message: 'Consistency Agent started',
  });
  appendProtocolBuildEvent({
    type: 'progress',
    message: 'Evaluating downstream impact',
  });

  let totalMarked = 0;
  for (const check of batch) {
    totalMarked += (await applyConsistencyCheck(check)).length;
  }

  if (totalMarked > 0) {
    appendProtocolBuildEvent({
      type: 'warning',
      message: `${totalMarked} section(s) marked out of sync`,
      metadata: { outOfSyncCount: totalMarked },
    });
  } else {
    appendProtocolBuildEvent({
      type: 'info',
      message: 'No downstream impacts found',
    });
  }
}

export function scheduleConsistencyAgentCheck(options: {
  sourceSectionId: string;
  sourceSectionTitle?: string;
  changedItems: KnowledgeExtractedItem[];
  studyModelPatch?: StudyModelPatch;
  trigger: AgentTrigger | ConsistencyAgentTrigger;
}): void {
  if (!options.changedItems.length) {
    return;
  }

  const payload: PendingConsistencyCheck = {
    sourceSectionId: options.sourceSectionId,
    sourceSectionTitle: options.sourceSectionTitle,
    changedItems: options.changedItems,
    studyModelPatch: options.studyModelPatch,
    trigger: mapTrigger(options.trigger),
  };

  if (payload.trigger === 'import' || payload.trigger === 'regeneration') {
    pendingImportChecks.push(payload);
    if (importBatchTimer) {
      clearTimeout(importBatchTimer);
    }
    importBatchTimer = setTimeout(() => {
      void flushImportConsistencyBatch();
    }, 800);
    return;
  }

  void runConsistencyAgentWithEvents(payload);
}

export async function runConsistencyAgentCheck(options: {
  sourceSectionId: string;
  sourceSectionTitle?: string;
  changedItems: KnowledgeExtractedItem[];
  studyModelPatch?: StudyModelPatch;
  trigger: AgentTrigger | ConsistencyAgentTrigger;
}): Promise<string[]> {
  if (!options.changedItems.length) {
    return [];
  }
  return runConsistencyAgentWithEvents({
    sourceSectionId: options.sourceSectionId,
    sourceSectionTitle: options.sourceSectionTitle,
    changedItems: options.changedItems,
    studyModelPatch: options.studyModelPatch,
    trigger: mapTrigger(options.trigger),
  });
}

export { ensureAgentsRegistered };
