import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type {
  ListByProtocolFilter,
  ProtocolSectionInsert,
  ProtocolSectionRow,
  ProtocolSectionUpdate,
} from '../types';

export class ProtocolSectionRepository {
  async getById(id: string): Promise<ProtocolSectionRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocol_sections').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('ProtocolSectionRepository.getById', error);
    }
    return (data as ProtocolSectionRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<ProtocolSectionRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('protocol_sections').select('*').order('section_id', { ascending: true });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('ProtocolSectionRepository.list', error);
    }
    return (data as ProtocolSectionRow[]) ?? [];
  }

  async create(input: ProtocolSectionInsert): Promise<ProtocolSectionRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('protocol_sections').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('ProtocolSectionRepository.create', error);
    }
    return data as ProtocolSectionRow;
  }

  async update(id: string, input: ProtocolSectionUpdate): Promise<ProtocolSectionRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('protocol_sections')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('ProtocolSectionRepository.update', error);
    }
    return data as ProtocolSectionRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('protocol_sections').delete().eq('id', id);
    if (error) {
      mapSupabaseError('ProtocolSectionRepository.delete', error);
    }
  }
}

export const protocolSectionRepository = new ProtocolSectionRepository();
