import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  inspectUsdmAlignmentGaps,
  type UsdmAlignmentInput,
  type UsdmAlignmentOutput,
} from './usdmAlignmentRules';

export const USDM_ALIGNMENT_AGENT_ID = 'usdm-alignment-agent';

export type { UsdmAlignmentInput, UsdmAlignmentOutput, UsdmAlignmentSuggestion } from './usdmAlignmentRules';

/** Scaffold agent — inspects Study Design and suggests export fixes. Never auto-applies. */
export const usdmAlignmentAgent: Agent<UsdmAlignmentInput, UsdmAlignmentOutput> = {
  id: USDM_ALIGNMENT_AGENT_ID,
  label: 'USDM Alignment Agent',
  description: 'Inspects Study Design for schedule export readiness and suggests fixes.',
  async execute(context: AgentContext<UsdmAlignmentInput>): Promise<AgentResult<UsdmAlignmentOutput>> {
    const startedAt = new Date().toISOString();
    const output = inspectUsdmAlignmentGaps(context.input ?? {});

    return createAgentResult(USDM_ALIGNMENT_AGENT_ID, startedAt, {
      status: output.readinessState === 'notReady' ? 'partial' : 'success',
      output,
      warnings: output.suggestions.filter((item) => item.severity === 'warning').map((item) => item.message),
      events: [
        createAgentEvent(USDM_ALIGNMENT_AGENT_ID, {
          type: 'progress',
          message: 'Inspecting Study Design export readiness',
        }),
        createAgentEvent(USDM_ALIGNMENT_AGENT_ID, {
          type: 'info',
          message: output.summary,
        }),
      ],
    });
  },
};
