import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, SoAEntityInsert, SoAEntityRow, SoAEntityUpdate } from '../types';

export class SoAEntityRepository {
  async getById(id: string): Promise<SoAEntityRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_entities').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('SoAEntityRepository.getById', error);
    }
    return (data as SoAEntityRow | null) ?? null;
  }

  async listByProtocol(protocolId: string): Promise<SoAEntityRow[]> {
    return this.list({ protocolId });
  }

  async list(filters?: ListByProtocolFilter): Promise<SoAEntityRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('soa_entities').select('*').order('updated_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('SoAEntityRepository.list', error);
    }
    return (data as SoAEntityRow[]) ?? [];
  }

  async listByType(protocolId: string, entityType: string): Promise<SoAEntityRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_entities')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('entity_type', entityType)
      .order('name', { ascending: true });
    if (error) {
      mapSupabaseError('SoAEntityRepository.listByType', error);
    }
    return (data as SoAEntityRow[]) ?? [];
  }

  async findByNormalizedName(
    protocolId: string,
    entityType: string,
    normalizedName: string,
  ): Promise<SoAEntityRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_entities')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('entity_type', entityType)
      .eq('normalized_name', normalizedName)
      .maybeSingle();
    if (error) {
      mapSupabaseError('SoAEntityRepository.findByNormalizedName', error);
    }
    return (data as SoAEntityRow | null) ?? null;
  }

  async create(input: SoAEntityInsert): Promise<SoAEntityRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_entities').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoAEntityRepository.create', error);
    }
    return data as SoAEntityRow;
  }

  async update(id: string, input: SoAEntityUpdate): Promise<SoAEntityRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_entities')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('SoAEntityRepository.update', error);
    }
    return data as SoAEntityRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('soa_entities').delete().eq('id', id);
    if (error) {
      mapSupabaseError('SoAEntityRepository.delete', error);
    }
  }
}

export const soaEntityRepository = new SoAEntityRepository();
