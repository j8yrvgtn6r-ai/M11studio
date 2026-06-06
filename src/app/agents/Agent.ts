import type { AgentContext } from './AgentContext';
import type { AgentResult } from './AgentResult';

export interface Agent<TInput = unknown, TOutput = unknown> {
  id: string;
  label: string;
  description: string;
  execute(context: AgentContext<TInput>): Promise<AgentResult<TOutput>>;
}
