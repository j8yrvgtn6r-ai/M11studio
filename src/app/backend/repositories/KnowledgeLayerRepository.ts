import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { KnowledgeLayerInsert, KnowledgeLayerRow, KnowledgeLayerUpdate, ListByProtocolFilter } from '../types';

export class KnowledgeLayerRepository {
  async getById(id: string): Promise<KnowledgeLayerRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_layers').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('KnowledgeLayerRepository.getById', error);
    }
    return (data as KnowledgeLayerRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<KnowledgeLayerRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('knowledge_layers').select('*').order('version', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('KnowledgeLayerRepository.list', error);
    }
    return (data as KnowledgeLayerRow[]) ?? [];
  }

  async create(input: KnowledgeLayerInsert): Promise<KnowledgeLayerRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_layers').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('KnowledgeLayerRepository.create', error);
    }
    return data as KnowledgeLayerRow;
  }

  async update(id: string, input: KnowledgeLayerUpdate): Promise<KnowledgeLayerRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_layers')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('KnowledgeLayerRepository.update', error);
    }
    return data as KnowledgeLayerRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('knowledge_layers').delete().eq('id', id);
    if (error) {
      mapSupabaseError('KnowledgeLayerRepository.delete', error);
    }
  }
}

export const knowledgeLayerRepository = new KnowledgeLayerRepository();
