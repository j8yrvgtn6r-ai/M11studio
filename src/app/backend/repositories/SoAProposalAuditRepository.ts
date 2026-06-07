import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';

/** Prepared repository interface — not wired to runtime UI in v3. */
export interface SoAProposalAuditRow {
  id: string;
  protocol_id: string;
  proposal_id: string;
  action: 'proposed' | 'accepted' | 'rejected';
  user_id?: string;
  evidence_json: Record<string, unknown>;
  table_coordinates_json?: Record<string, unknown>;
  created_at: string;
}

export interface SoAProposalAuditInsert {
  protocol_id: string;
  proposal_id: string;
  action: 'proposed' | 'accepted' | 'rejected';
  user_id?: string;
  evidence_json?: Record<string, unknown>;
  table_coordinates_json?: Record<string, unknown>;
}

export class SoAProposalAuditRepository {
  async create(input: SoAProposalAuditInsert): Promise<SoAProposalAuditRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_proposal_audit').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoAProposalAuditRepository.create', error);
    }
    return data as SoAProposalAuditRow;
  }

  async listByProposal(proposalId: string): Promise<SoAProposalAuditRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_proposal_audit')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });
    if (error) {
      mapSupabaseError('SoAProposalAuditRepository.listByProposal', error);
    }
    return (data as SoAProposalAuditRow[]) ?? [];
  }
}

export const soaProposalAuditRepository = new SoAProposalAuditRepository();
