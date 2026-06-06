import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ProtocolInsert, ProtocolRow, ProtocolUpdate } from '../types';

export class ProtocolRepository {
  async getById(id: string): Promise<ProtocolRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocols').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('ProtocolRepository.getById', error);
    }
    return (data as ProtocolRow | null) ?? null;
  }

  async list(filters?: { status?: string }): Promise<ProtocolRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('protocols').select('*').order('updated_at', { ascending: false });
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('ProtocolRepository.list', error);
    }
    return (data as ProtocolRow[]) ?? [];
  }

  async create(input: ProtocolInsert): Promise<ProtocolRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocols').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('ProtocolRepository.create', error);
    }
    return data as ProtocolRow;
  }

  async update(id: string, input: ProtocolUpdate): Promise<ProtocolRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocols').update(input).eq('id', id).select('*').single();
    if (error) {
      mapSupabaseError('ProtocolRepository.update', error);
    }
    return data as ProtocolRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('protocols').delete().eq('id', id);
    if (error) {
      mapSupabaseError('ProtocolRepository.delete', error);
    }
  }
}

export const protocolRepository = new ProtocolRepository();
