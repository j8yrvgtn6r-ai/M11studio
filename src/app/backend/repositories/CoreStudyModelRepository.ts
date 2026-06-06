import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { CoreStudyModelInsert, CoreStudyModelRow, CoreStudyModelUpdate, ListByProtocolFilter } from '../types';

export class CoreStudyModelRepository {
  async getById(id: string): Promise<CoreStudyModelRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('core_study_models').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('CoreStudyModelRepository.getById', error);
    }
    return (data as CoreStudyModelRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<CoreStudyModelRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('core_study_models').select('*').order('version', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('CoreStudyModelRepository.list', error);
    }
    return (data as CoreStudyModelRow[]) ?? [];
  }

  async create(input: CoreStudyModelInsert): Promise<CoreStudyModelRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('core_study_models').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('CoreStudyModelRepository.create', error);
    }
    return data as CoreStudyModelRow;
  }

  async update(id: string, input: CoreStudyModelUpdate): Promise<CoreStudyModelRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('core_study_models')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('CoreStudyModelRepository.update', error);
    }
    return data as CoreStudyModelRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('core_study_models').delete().eq('id', id);
    if (error) {
      mapSupabaseError('CoreStudyModelRepository.delete', error);
    }
  }
}

export const coreStudyModelRepository = new CoreStudyModelRepository();
