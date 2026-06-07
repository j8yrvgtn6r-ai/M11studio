import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type { ListByProtocolFilter, SoAScheduleRuleInsert, SoAScheduleRuleRow, SoAScheduleRuleUpdate } from '../types';

export class SoAScheduleRuleRepository {
  async getById(id: string): Promise<SoAScheduleRuleRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_schedule_rules').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.getById', error);
    }
    return (data as SoAScheduleRuleRow | null) ?? null;
  }

  async listByProtocol(protocolId: string): Promise<SoAScheduleRuleRow[]> {
    return this.list({ protocolId });
  }

  async list(filters?: ListByProtocolFilter): Promise<SoAScheduleRuleRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('soa_schedule_rules').select('*').order('updated_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.list', error);
    }
    return (data as SoAScheduleRuleRow[]) ?? [];
  }

  async listByVisit(protocolId: string, visitId: string): Promise<SoAScheduleRuleRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_schedule_rules')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('visit_id', visitId);
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.listByVisit', error);
    }
    return (data as SoAScheduleRuleRow[]) ?? [];
  }

  async create(input: SoAScheduleRuleInsert): Promise<SoAScheduleRuleRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('soa_schedule_rules').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.create', error);
    }
    return data as SoAScheduleRuleRow;
  }

  async update(id: string, input: SoAScheduleRuleUpdate): Promise<SoAScheduleRuleRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('soa_schedule_rules')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.update', error);
    }
    return data as SoAScheduleRuleRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('soa_schedule_rules').delete().eq('id', id);
    if (error) {
      mapSupabaseError('SoAScheduleRuleRepository.delete', error);
    }
  }
}

export const soaScheduleRuleRepository = new SoAScheduleRuleRepository();
