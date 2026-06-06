import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  evaluateGenerationSchedule,
  resolveQueueTypeLabel,
  type GenerationAgentInput,
  type GenerationAgentOutput,
} from './generationSchedulingRules';

export const GENERATION_AGENT_ID = 'generation-agent';

export type {
  EstimatedComplexity,
  GenerationAgentInput,
  GenerationAgentOutput,
  GenerationAgentTrigger,
  GenerationQueueItem,
  GenerationQueuePriority,
  GenerationQueueSource,
  SkippedSectionRecord,
} from './generationSchedulingRules';

export {
  estimateSectionComplexity,
  evaluateGenerationSchedule,
  getPrioritySectionIdsForScheduling,
  resolveQueueTypeLabel,
} from './generationSchedulingRules';

export const generationAgent: Agent<GenerationAgentInput, GenerationAgentOutput> = {
  id: GENERATION_AGENT_ID,
  label: 'Generation Agent',
  description: 'Schedules M11 section generation by priority, context, and user intent.',
  async execute(
    context: AgentContext<GenerationAgentInput>,
  ): Promise<AgentResult<GenerationAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(GENERATION_AGENT_ID, {
        type: 'progress',
        message: 'Generation Agent started',
      }),
      createAgentEvent(GENERATION_AGENT_ID, {
        type: 'progress',
        message: 'Scheduling missing M11 sections',
      }),
    ];

    try {
      const output = evaluateGenerationSchedule(context.input);
      const queueType = resolveQueueTypeLabel(context.input.trigger, output);

      if (output.generationSummary.priorityCount > 0) {
        events.push(
          createAgentEvent(GENERATION_AGENT_ID, {
            type: 'success',
            message: `Queued ${output.generationSummary.priorityCount} priority sections`,
            metadata: { priorityCount: output.generationSummary.priorityCount },
          }),
        );
      }

      if (output.generationSummary.backgroundCount > 0) {
        events.push(
          createAgentEvent(GENERATION_AGENT_ID, {
            type: 'info',
            message: `Queued ${output.generationSummary.backgroundCount} background sections`,
            metadata: { backgroundCount: output.generationSummary.backgroundCount },
          }),
        );
      }

      if (output.generationSummary.skippedCount > 0) {
        events.push(
          createAgentEvent(GENERATION_AGENT_ID, {
            type: 'info',
            message: `Skipped ${output.generationSummary.skippedCount} sections`,
            metadata: { skippedCount: output.generationSummary.skippedCount },
          }),
        );
      }

      if (context.input.trigger === 'generateSection' && context.input.requestedSectionId) {
        events.push(
          createAgentEvent(GENERATION_AGENT_ID, {
            type: 'success',
            message: `Manual section prioritized: ${context.input.requestedSectionId}`,
            sectionId: context.input.requestedSectionId,
          }),
        );
      }

      if (context.input.trigger === 'retryFailed') {
        events.push(
          createAgentEvent(GENERATION_AGENT_ID, {
            type: 'info',
            message: 'Retry queue prepared',
            metadata: { retryCount: output.queue.length },
          }),
        );
      }

      events.push(
        createAgentEvent(GENERATION_AGENT_ID, {
          type: 'success',
          message: 'Generation Agent completed',
          metadata: { queueType },
        }),
      );

      return createAgentResult(GENERATION_AGENT_ID, startedAt, {
        status:
          output.generationSummary.status === 'failed'
            ? 'failed'
            : output.generationSummary.status === 'skipped'
              ? 'skipped'
              : output.generationSummary.status === 'partial'
                ? 'partial'
                : 'success',
        output,
        affectedSectionIds: output.queue.map((item) => item.sectionId),
        warnings: output.skippedSections.map((entry) => `${entry.sectionId}: ${entry.reason}`),
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(GENERATION_AGENT_ID, {
          type: 'error',
          message: `Generation Agent failed: ${message}`,
        }),
      );
      return createAgentResult(GENERATION_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        output: {
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
            status: 'failed',
          },
          reasons: [message],
        },
        events,
      });
    }
  },
};
