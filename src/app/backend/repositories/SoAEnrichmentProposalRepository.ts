import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';

/** Prepared repository interface — not wired to runtime UI in v2. */
export interface SoAEnrichmentProposalRow {
  id: string;
  protocol_id: string;
  provider: string;
  status: string;
  summary: string;
  proposal_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SoAEnrichmentProposalInsert {
  id?: string;
  protocol_id: string;
  provider: string;
  status: string;
  summary: string;
  proposal_json: Record<string, unknown>;
}

export interface SoAEnrichmentProposalUpdate {
  status?: string;
  summary?: string;
  proposal_json?: Record<string, unknown>;
}

export class SoAEnrichmentProposalRepository {
  async getById(id: string): Promise<SoAEnrichmentProposalRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_enrichment_proposals').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('SoAEnrichmentProposalRepository.getById', error);
    }
    return (data as SoAEnrichmentProposalRow | null) ?? null;
  }

  async listByProtocol(protocolId: string): Promise<SoAEnrichmentProposalRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_enrichment_proposals')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('updated_at', { ascending: false });
    if (error) {
      mapSupabaseError('SoAEnrichmentProposalRepository.listByProtocol', error);
    }
    return (data as SoAEnrichmentProposalRow[]) ?? [];
  }

  async create(input: SoAEnrichmentProposalInsert): Promise<SoAEnrichmentProposalRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_enrichment_proposals').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoAEnrichmentProposalRepository.create', error);
    }
    return data as SoAEnrichmentProposalRow;
  }

  async update(id: string, input: SoAEnrichmentProposalUpdate): Promise<SoAEnrichmentProposalRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_enrichment_proposals')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('SoAEnrichmentProposalRepository.update', error);
    }
    return data as SoAEnrichmentProposalRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('soa_enrichment_proposals').delete().eq('id', id);
    if (error) {
      mapSupabaseError('SoAEnrichmentProposalRepository.delete', error);
    }
  }
}

export const soaEnrichmentProposalRepository = new SoAEnrichmentProposalRepository();
