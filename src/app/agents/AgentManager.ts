import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import { applyStudyModelPatch } from '../domain/study-model/studyModelPatch';
import { getStudyModel, patchStudyModel } from '../domain/study-model/studyModelStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import type { AgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';

const registry = new Map<string, Agent>();

function emitAgentEvents(events: AgentEvent[]): void {
  for (const event of events) {
    appendProtocolBuildEvent({
      type: event.type,
      message: event.message,
      sectionId: event.sectionId,
      metadata: event.metadata,
    });
  }
}

export class AgentManager {
  register(agent: Agent): void {
    registry.set(agent.id, agent);
  }

  getAgent(agentId: string): Agent | undefined {
    return registry.get(agentId);
  }

  listAgents(): Agent[] {
    return [...registry.values()];
  }

  async runAgent<TInput, TOutput>(
    agentId: string,
    context: AgentContext<TInput>,
  ): Promise<AgentResult<TOutput>> {
    const startedAt = new Date().toISOString();
    const agent = registry.get(agentId);
    if (!agent) {
      return createAgentResult(agentId, startedAt, {
        status: 'failed',
        errors: [`Unknown agent: ${agentId}`],
        events: [],
      });
    }

    try {
      const result = (await agent.execute(context)) as AgentResult<TOutput>;
      emitAgentEvents(result.events);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendProtocolBuildEvent({
        type: 'error',
        message: `${agent.label} failed: ${message}`,
        sectionId: context.selectedSectionId,
      });
      return createAgentResult(agentId, startedAt, {
        status: 'failed',
        errors: [message],
        events: [],
      });
    }
  }

  async runSequential<TInput, TOutput>(
    agentIds: string[],
    context: AgentContext<TInput>,
  ): Promise<AgentResult<TOutput>[]> {
    const results: AgentResult<TOutput>[] = [];
    for (const agentId of agentIds) {
      results.push(await this.runAgent<TInput, TOutput>(agentId, context));
    }
    return results;
  }
}

export const agentManager = new AgentManager();

export function applyAgentStudyModelUpdates(result: AgentResult<unknown>, sectionId: string): boolean {
  if (!result.studyModelUpdates) {
    return false;
  }
  const base = getStudyModel();
  if (!base) {
    return false;
  }
  patchStudyModel(applyStudyModelPatch(base, result.studyModelUpdates, sectionId), getProtocolDocument());
  return true;
}
