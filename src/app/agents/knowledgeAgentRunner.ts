import { agentManager } from './AgentManager';
import type { AgentTrigger } from './AgentContext';
import { KNOWLEDGE_AGENT_ID, knowledgeAgent } from './KnowledgeAgent';
import type { KnowledgeAgentInput, KnowledgeAgentOutput, KnowledgeAgentTextSource } from './knowledgeAgentHeuristics';
import {
  getImportedProtocolSource,
  getProtocolKnowledgeModel,
} from '../domain/protocol/import/protocolImportStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import { applyStudyModelPatch } from '../domain/study-model/studyModelPatch';
import { getStudyModel, patchStudyModel, rebuildStudyModel } from '../domain/study-model/studyModelStore';

const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
let initialized = false;

const studyModelUpdatedListeners = new Set<(message: string) => void>();

export function subscribeStudyModelUpdated(listener: (message: string) => void): () => void {
  studyModelUpdatedListeners.add(listener);
  return () => studyModelUpdatedListeners.delete(listener);
}

let lastStudyModelBannerAt = 0;

function notifyStudyModelUpdated(message: string): void {
  if (studyModelUpdatedListeners.size === 0) {
    return;
  }
  const now = Date.now();
  if (now - lastStudyModelBannerAt < 3000) {
    return;
  }
  lastStudyModelBannerAt = now;
  studyModelUpdatedListeners.forEach((listener) => listener(message));
}

function ensureAgentsRegistered(): void {
  if (initialized) {
    return;
  }
  agentManager.register(knowledgeAgent);
  initialized = true;
}

function ensureStudyModelReady(): void {
  if (getStudyModel()) {
    return;
  }
  rebuildStudyModel({
    sourceUploadId: getImportedProtocolSource()?.uploadId ?? getProtocolKnowledgeModel()?.id ?? 'protocol',
    knowledge: getProtocolKnowledgeModel(),
    document: getProtocolDocument(),
  });
}

export async function runKnowledgeAgentForSection(options: {
  sectionId: string;
  sectionTitle: string;
  currentText: string;
  previousText?: string;
  source: KnowledgeAgentTextSource;
  trigger: AgentTrigger;
}): Promise<void> {
  ensureAgentsRegistered();
  if (!options.currentText.trim()) {
    return;
  }

  try {
    const result = await agentManager.runAgent<KnowledgeAgentInput, KnowledgeAgentOutput>(KNOWLEDGE_AGENT_ID, {
      protocolDocument: getProtocolDocument(),
      selectedSectionId: options.sectionId,
      sourceExtraction: getImportedProtocolSource(),
      protocolKnowledgeModel: getProtocolKnowledgeModel(),
      studyModel: getStudyModel(),
      currentSectionText: options.currentText,
      previousSectionText: options.previousText,
      trigger: options.trigger,
      input: {
        sectionId: options.sectionId,
        sectionTitle: options.sectionTitle,
        currentText: options.currentText,
        previousText: options.previousText,
        source: options.source,
      },
    });

    if (
      result.studyModelUpdates &&
      (result.status === 'success' || result.status === 'partial')
    ) {
      ensureStudyModelReady();
      const base = getStudyModel();
      if (base) {
        patchStudyModel(
          applyStudyModelPatch(base, result.studyModelUpdates, options.sectionId),
          getProtocolDocument(),
        );
        notifyStudyModelUpdated(`Study Model updated from section ${options.sectionId}`);
      }
    }
  } catch {
    // Knowledge Agent must never crash callers.
  }
}

export function scheduleKnowledgeAgentForSectionEdit(options: {
  sectionId: string;
  sectionTitle: string;
  currentText: string;
  previousText?: string;
}): void {
  const existing = editDebounceTimers.get(options.sectionId);
  if (existing) {
    clearTimeout(existing);
  }
  editDebounceTimers.set(
    options.sectionId,
    setTimeout(() => {
      editDebounceTimers.delete(options.sectionId);
      void runKnowledgeAgentForSection({
        ...options,
        source: 'edited',
        trigger: 'sectionEdit',
      });
    }, 500),
  );
}

export function resolveKnowledgeSourceFromDraft(input: {
  contentOrigin?: string;
  workflowState?: string;
  state?: string;
}): KnowledgeAgentTextSource {
  if (input.workflowState === 'validated' || input.state === 'validationPassed') {
    return 'validated';
  }
  if (input.state === 'approved' || input.workflowState === 'reviewed') {
    return 'reviewed';
  }
  if (input.contentOrigin === 'generated') {
    return 'generated';
  }
  return 'imported';
}

export function triggerKnowledgeAgentFromDraft(
  draft: {
    sectionId: string;
    title: string;
    generatedText: string;
    contentOrigin?: string;
    workflowState?: string;
    state?: string;
  },
  trigger: AgentTrigger,
  previousText?: string,
): void {
  void runKnowledgeAgentForSection({
    sectionId: draft.sectionId,
    sectionTitle: draft.title,
    currentText: draft.generatedText,
    previousText,
    source: resolveKnowledgeSourceFromDraft(draft),
    trigger,
  });
}

export { agentManager };
