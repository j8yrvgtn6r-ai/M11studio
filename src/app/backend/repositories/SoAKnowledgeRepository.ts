import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, SoAKnowledgeModelInsert, SoAKnowledgeModelRow, SoAKnowledgeModelUpdate } from '../types';

export class SoAKnowledgeRepository {
  async getById(id: string): Promise<SoAKnowledgeModelRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_knowledge_models').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('SoAKnowledgeRepository.getById', error);
    }
    return (data as SoAKnowledgeModelRow | null) ?? null;
  }

  async listByProtocol(protocolId: string): Promise<SoAKnowledgeModelRow[]> {
    return this.list({ protocolId });
  }

  async list(filters?: ListByProtocolFilter): Promise<SoAKnowledgeModelRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('soa_knowledge_models').select('*').order('updated_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('SoAKnowledgeRepository.list', error);
    }
    return (data as SoAKnowledgeModelRow[]) ?? [];
  }

  async create(input: SoAKnowledgeModelInsert): Promise<SoAKnowledgeModelRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_knowledge_models').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoAKnowledgeRepository.create', error);
    }
    return data as SoAKnowledgeModelRow;
  }

  async update(id: string, input: SoAKnowledgeModelUpdate): Promise<SoAKnowledgeModelRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_knowledge_models')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('SoAKnowledgeRepository.update', error);
    }
    return data as SoAKnowledgeModelRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('soa_knowledge_models').delete().eq('id', id);
    if (error) {
      mapSupabaseError('SoAKnowledgeRepository.delete', error);
    }
  }
}

export const soaKnowledgeRepository = new SoAKnowledgeRepository();
