import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, ValidationRunInsert, ValidationRunRow, ValidationRunUpdate } from '../types';

export class ValidationRepository {
  async getById(id: string): Promise<ValidationRunRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('validation_runs').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('ValidationRepository.getById', error);
    }
    return (data as ValidationRunRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter & { sectionId?: string }): Promise<ValidationRunRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('validation_runs').select('*').order('created_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    if (filters?.sectionId) {
      query = query.eq('section_id', filters.sectionId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('ValidationRepository.list', error);
    }
    return (data as ValidationRunRow[]) ?? [];
  }

  async create(input: ValidationRunInsert): Promise<ValidationRunRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('validation_runs').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('ValidationRepository.create', error);
    }
    return data as ValidationRunRow;
  }

  async update(id: string, input: ValidationRunUpdate): Promise<ValidationRunRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('validation_runs')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('ValidationRepository.update', error);
    }
    return data as ValidationRunRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('validation_runs').delete().eq('id', id);
    if (error) {
      mapSupabaseError('ValidationRepository.delete', error);
    }
  }
}

export const validationRepository = new ValidationRepository();
