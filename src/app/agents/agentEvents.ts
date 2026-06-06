export type AgentEventType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface AgentEvent {
  id: string;
  agentId: string;
  timestamp: string;
  type: AgentEventType;
  message: string;
  sectionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

let agentEventCounter = 0;

export function createAgentEvent(
  agentId: string,
  event: Omit<AgentEvent, 'id' | 'agentId' | 'timestamp'> & { timestamp?: string },
): AgentEvent {
  agentEventCounter += 1;
  return {
    id: `agent-event-${agentEventCounter}`,
    agentId,
    timestamp: event.timestamp ?? new Date().toISOString(),
    type: event.type,
    message: event.message,
    sectionId: event.sectionId,
    metadata: event.metadata,
  };
}
