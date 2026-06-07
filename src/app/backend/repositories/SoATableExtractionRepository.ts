import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';

/** Prepared repository interface — not wired to runtime UI in v3. */
export interface SoATableExtractionRow {
  id: string;
  protocol_id: string;
  upload_id: string;
  table_id: string;
  extraction_json: Record<string, unknown>;
  diagnostics_json: Record<string, unknown>;
  created_at: string;
}

export interface SoATableExtractionInsert {
  protocol_id: string;
  upload_id: string;
  table_id: string;
  extraction_json: Record<string, unknown>;
  diagnostics_json?: Record<string, unknown>;
}

export class SoATableExtractionRepository {
  async create(input: SoATableExtractionInsert): Promise<SoATableExtractionRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_table_extractions').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoATableExtractionRepository.create', error);
    }
    return data as SoATableExtractionRow;
  }

  async listByUpload(uploadId: string): Promise<SoATableExtractionRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_table_extractions')
      .select('*')
      .eq('upload_id', uploadId)
      .order('created_at', { ascending: false });
    if (error) {
      mapSupabaseError('SoATableExtractionRepository.listByUpload', error);
    }
    return (data as SoATableExtractionRow[]) ?? [];
  }
}

export const soaTableExtractionRepository = new SoATableExtractionRepository();
