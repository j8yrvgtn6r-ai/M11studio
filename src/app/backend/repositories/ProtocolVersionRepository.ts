import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, ProtocolVersionInsert, ProtocolVersionRow, ProtocolVersionUpdate } from '../types';

export class ProtocolVersionRepository {
  async getById(id: string): Promise<ProtocolVersionRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocol_versions').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('ProtocolVersionRepository.getById', error);
    }
    return (data as ProtocolVersionRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<ProtocolVersionRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('protocol_versions').select('*').order('created_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('ProtocolVersionRepository.list', error);
    }
    return (data as ProtocolVersionRow[]) ?? [];
  }

  async create(input: ProtocolVersionInsert): Promise<ProtocolVersionRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocol_versions').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('ProtocolVersionRepository.create', error);
    }
    return data as ProtocolVersionRow;
  }

  async update(id: string, input: ProtocolVersionUpdate): Promise<ProtocolVersionRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('protocol_versions')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('ProtocolVersionRepository.update', error);
    }
    return data as ProtocolVersionRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('protocol_versions').delete().eq('id', id);
    if (error) {
      mapSupabaseError('ProtocolVersionRepository.delete', error);
    }
  }
}

export const protocolVersionRepository = new ProtocolVersionRepository();
