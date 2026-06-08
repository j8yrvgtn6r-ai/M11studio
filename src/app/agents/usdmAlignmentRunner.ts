import { agentManager } from './AgentManager';
import { ensureAgentsRegistered } from './consistencyAgentRunner';
import {
  USDM_ALIGNMENT_AGENT_ID,
  usdmAlignmentAgent,
  type UsdmAlignmentInput,
  type UsdmAlignmentOutput,
} from './UsdmAlignmentAgent';
import { inspectUsdmAlignmentGaps } from './usdmAlignmentRules';

let initialized = false;

export function ensureUsdmAlignmentAgentRegistered(): void {
  if (initialized) return;
  ensureAgentsRegistered();
  if (!agentManager.getAgent(USDM_ALIGNMENT_AGENT_ID)) {
    agentManager.register(usdmAlignmentAgent);
  }
  initialized = true;
}

export async function runUsdmAlignmentAgent(
  input: UsdmAlignmentInput = {},
): Promise<UsdmAlignmentOutput> {
  ensureUsdmAlignmentAgentRegistered();
  const result = await agentManager.runAgent<UsdmAlignmentInput, UsdmAlignmentOutput>(
    USDM_ALIGNMENT_AGENT_ID,
    { input },
  );
  return result.output ?? inspectUsdmAlignmentGaps(input);
}

export function inspectUsdmAlignment(input: UsdmAlignmentInput = {}): UsdmAlignmentOutput {
  return inspectUsdmAlignmentGaps(input);
}
