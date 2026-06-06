import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type {
  KnowledgeEntityInsert,
  KnowledgeEntityRow,
  KnowledgeEntityUpdate,
  ListByProtocolFilter,
} from '../types';

export class KnowledgeEntityRepository {
  async getById(id: string): Promise<KnowledgeEntityRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_entities').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.getById', error);
    }
    return (data as KnowledgeEntityRow | null) ?? null;
  }

  async listByProtocol(protocolId: string): Promise<KnowledgeEntityRow[]> {
    return this.list({ protocolId });
  }

  async list(filters?: ListByProtocolFilter): Promise<KnowledgeEntityRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('knowledge_entities').select('*').order('updated_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.list', error);
    }
    return (data as KnowledgeEntityRow[]) ?? [];
  }

  async listByType(protocolId: string, entityType: string): Promise<KnowledgeEntityRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_entities')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('entity_type', entityType)
      .order('name', { ascending: true });
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.listByType', error);
    }
    return (data as KnowledgeEntityRow[]) ?? [];
  }

  async findByNormalizedName(
    protocolId: string,
    entityType: string,
    normalizedName: string,
  ): Promise<KnowledgeEntityRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_entities')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('entity_type', entityType)
      .eq('normalized_name', normalizedName)
      .maybeSingle();
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.findByNormalizedName', error);
    }
    return (data as KnowledgeEntityRow | null) ?? null;
  }

  async create(input: KnowledgeEntityInsert): Promise<KnowledgeEntityRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_entities').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.create', error);
    }
    return data as KnowledgeEntityRow;
  }

  async update(id: string, input: KnowledgeEntityUpdate): Promise<KnowledgeEntityRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_entities')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.update', error);
    }
    return data as KnowledgeEntityRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('knowledge_entities').delete().eq('id', id);
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.delete', error);
    }
  }

  async upsertByTypeAndNormalizedName(input: KnowledgeEntityInsert): Promise<KnowledgeEntityRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_entities')
      .upsert(input, { onConflict: 'protocol_id,entity_type,normalized_name' })
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('KnowledgeEntityRepository.upsertByTypeAndNormalizedName', error);
    }
    return data as KnowledgeEntityRow;
  }
}

export const knowledgeEntityRepository = new KnowledgeEntityRepository();
