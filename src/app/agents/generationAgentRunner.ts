import { agentManager } from './AgentManager';
import { ensureAgentsRegistered } from './consistencyAgentRunner';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../domain/protocol/ichM11/ichM11Template';
import {
  appendProtocolBuildEvent,
  getProtocolBuildConsoleState,
  setGenerationScheduleSnapshot,
  setSectionSkipReasons,
} from '../domain/protocol/build/protocolBuildConsoleStore';
import { getStudyModel } from '../domain/study-model/studyModelStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import {
  getPriorityGenerationContextDiagnostics,
  isPriorityGenerationContextReady,
} from '../domain/protocol/import/importGenerationContext';
import {
  GENERATION_AGENT_ID,
  generationAgent,
  type GenerationAgentInput,
  type GenerationAgentOutput,
  type GenerationAgentTrigger,
} from './GenerationAgent';
import {
  evaluateGenerationSchedule,
  resolveQueueTypeLabel,
} from './generationSchedulingRules';

let initialized = false;

function ensureGenerationAgentRegistered(): void {
  if (initialized) {
    return;
  }
  ensureAgentsRegistered();
  if (!agentManager.getAgent(GENERATION_AGENT_ID)) {
    agentManager.register(generationAgent);
  }
  initialized = true;
}

function buildGenerationContext() {
  const diagnostics = getPriorityGenerationContextDiagnostics();
  return {
    ready: isPriorityGenerationContextReady(),
    phase: diagnostics.phase,
    missing: diagnostics.missing,
  };
}

function emitScheduleEvents(trigger: GenerationAgentTrigger, output: GenerationAgentOutput): void {
  appendProtocolBuildEvent({ type: 'progress', message: 'Generation Agent started' });
  appendProtocolBuildEvent({ type: 'progress', message: 'Scheduling section generation' });

  if (output.generationSummary.priorityCount > 0) {
    appendProtocolBuildEvent({
      type: 'success',
      message: `Queued ${output.generationSummary.priorityCount} priority sections`,
      metadata: { priorityCount: output.generationSummary.priorityCount },
    });
  }

  if (output.generationSummary.backgroundCount > 0) {
    appendProtocolBuildEvent({
      type: 'info',
      message: `Queued ${output.generationSummary.backgroundCount} background sections`,
      metadata: { backgroundCount: output.generationSummary.backgroundCount },
    });
  }

  if (output.generationSummary.skippedCount > 0) {
    appendProtocolBuildEvent({
      type: 'info',
      message: `Skipped ${output.generationSummary.skippedCount} sections`,
      metadata: { skippedCount: output.generationSummary.skippedCount },
    });
  }

  if (trigger === 'generateSection' && output.generationSummary.immediateCount > 0) {
    appendProtocolBuildEvent({ type: 'success', message: 'Manual section prioritized' });
  }

  if (trigger === 'retryFailed') {
    appendProtocolBuildEvent({ type: 'info', message: 'Retry queue prepared' });
  }

  appendProtocolBuildEvent({
    type: 'success',
    message: 'Generation Agent completed',
    metadata: { queueType: resolveQueueTypeLabel(trigger, output) },
  });
}

function applyScheduleMetadata(trigger: GenerationAgentTrigger, output: GenerationAgentOutput): void {
  setSectionSkipReasons(
    Object.fromEntries(output.skippedSections.map((entry) => [entry.sectionId, entry.reason])),
  );
  setGenerationScheduleSnapshot({
    queueType: resolveQueueTypeLabel(trigger, output),
    queuedCount: output.generationSummary.queuedCount,
    skippedCount: output.generationSummary.skippedCount,
    priorityCount: output.generationSummary.priorityCount,
    backgroundCount: output.generationSummary.backgroundCount,
    trigger,
  });
}

export async function runGenerationAgentSchedule(
  input: Omit<GenerationAgentInput, 'generationContext' | 'm11TemplateSections' | 'protocolDocument' | 'studyModel'>,
): Promise<GenerationAgentOutput> {
  ensureGenerationAgentRegistered();

  try {
    const fullInput: GenerationAgentInput = {
      ...input,
      protocolDocument: getProtocolDocument(),
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      studyModel: getStudyModel(),
      generationContext: buildGenerationContext(),
      activeGeneratingSectionIds: Object.entries(getProtocolBuildConsoleState().sectionStates)
        .filter(([, state]) => state === 'generating')
        .map(([sectionId]) => sectionId),
    };

    const result = await agentManager.runAgent<GenerationAgentInput, GenerationAgentOutput>(
      GENERATION_AGENT_ID,
      {
        protocolDocument: fullInput.protocolDocument!,
        studyModel: fullInput.studyModel,
        trigger: input.trigger,
        input: fullInput,
      },
    );

    const output = result.output ?? evaluateGenerationSchedule(fullInput);
    emitScheduleEvents(input.trigger, output);
    applyScheduleMetadata(input.trigger, output);
    return output;
  } catch {
    const fallback = evaluateGenerationSchedule({
      ...input,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      generationContext: buildGenerationContext(),
    });
    emitScheduleEvents(input.trigger, fallback);
    applyScheduleMetadata(input.trigger, fallback);
    return fallback;
  }
}

export function scheduleGenerationSync(
  input: Omit<GenerationAgentInput, 'generationContext' | 'm11TemplateSections' | 'protocolDocument' | 'studyModel'>,
): GenerationAgentOutput {
  const output = evaluateGenerationSchedule({
    ...input,
    protocolDocument: getProtocolDocument(),
    m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
    studyModel: getStudyModel(),
    generationContext: buildGenerationContext(),
    activeGeneratingSectionIds: Object.entries(getProtocolBuildConsoleState().sectionStates)
      .filter(([, state]) => state === 'generating')
      .map(([sectionId]) => sectionId),
  });
  applyScheduleMetadata(input.trigger, output);
  return output;
}

export { ensureGenerationAgentRegistered };
