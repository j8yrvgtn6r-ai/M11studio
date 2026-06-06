import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { AgentEventInsert, AgentEventRow, AgentEventUpdate, ListByProtocolFilter } from '../types';

export class AgentEventRepository {
  async getById(id: string): Promise<AgentEventRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('agent_events').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('AgentEventRepository.getById', error);
    }
    return (data as AgentEventRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter & { agentId?: string }): Promise<AgentEventRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('agent_events').select('*').order('created_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    if (filters?.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('AgentEventRepository.list', error);
    }
    return (data as AgentEventRow[]) ?? [];
  }

  async create(input: AgentEventInsert): Promise<AgentEventRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('agent_events').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('AgentEventRepository.create', error);
    }
    return data as AgentEventRow;
  }

  async update(id: string, input: AgentEventUpdate): Promise<AgentEventRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('agent_events').update(input).eq('id', id).select('*').single();
    if (error) {
      mapSupabaseError('AgentEventRepository.update', error);
    }
    return data as AgentEventRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('agent_events').delete().eq('id', id);
    if (error) {
      mapSupabaseError('AgentEventRepository.delete', error);
    }
  }
}

export const agentEventRepository = new AgentEventRepository();
