import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, SourceDocumentInsert, SourceDocumentRow, SourceDocumentUpdate } from '../types';

export class SourceDocumentRepository {
  async getById(id: string): Promise<SourceDocumentRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('source_documents').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('SourceDocumentRepository.getById', error);
    }
    return (data as SourceDocumentRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<SourceDocumentRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('source_documents').select('*').order('created_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('SourceDocumentRepository.list', error);
    }
    return (data as SourceDocumentRow[]) ?? [];
  }

  async create(input: SourceDocumentInsert): Promise<SourceDocumentRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('source_documents').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SourceDocumentRepository.create', error);
    }
    return data as SourceDocumentRow;
  }

  async update(id: string, input: SourceDocumentUpdate): Promise<SourceDocumentRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('source_documents')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('SourceDocumentRepository.update', error);
    }
    return data as SourceDocumentRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('source_documents').delete().eq('id', id);
    if (error) {
      mapSupabaseError('SourceDocumentRepository.delete', error);
    }
  }
}

export const sourceDocumentRepository = new SourceDocumentRepository();
