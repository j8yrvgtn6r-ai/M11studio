import { mapSupabaseError, requireSupabaseClient } from './repositoryErrors';
import type {
  KnowledgeRelationshipInsert,
  KnowledgeRelationshipRow,
  KnowledgeRelationshipUpdate,
  ListByProtocolFilter,
} from '../types';

export class KnowledgeRelationshipRepository {
  async getById(id: string): Promise<KnowledgeRelationshipRow | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_relationships').select('*').eq('id', id).maybeSingle();
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.getById', error);
    }
    return (data as KnowledgeRelationshipRow | null) ?? null;
  }

  async list(filters?: ListByProtocolFilter): Promise<KnowledgeRelationshipRow[]> {
    const client = requireSupabaseClient();
    let query = client.from('knowledge_relationships').select('*').order('updated_at', { ascending: false });
    if (filters?.protocolId) {
      query = query.eq('protocol_id', filters.protocolId);
    }
    const { data, error } = await query;
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.list', error);
    }
    return (data as KnowledgeRelationshipRow[]) ?? [];
  }

  async listByProtocol(protocolId: string): Promise<KnowledgeRelationshipRow[]> {
    return this.list({ protocolId });
  }

  async listRelationshipsForEntity(entityId: string): Promise<KnowledgeRelationshipRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_relationships')
      .select('*')
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.listRelationshipsForEntity', error);
    }
    return (data as KnowledgeRelationshipRow[]) ?? [];
  }

  async listRelationshipsByType(protocolId: string, relationshipType: string): Promise<KnowledgeRelationshipRow[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_relationships')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('relationship_type', relationshipType);
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.listRelationshipsByType', error);
    }
    return (data as KnowledgeRelationshipRow[]) ?? [];
  }

  async create(input: KnowledgeRelationshipInsert): Promise<KnowledgeRelationshipRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('knowledge_relationships').insert(input).select('*').single();
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.create', error);
    }
    return data as KnowledgeRelationshipRow;
  }

  async update(id: string, input: KnowledgeRelationshipUpdate): Promise<KnowledgeRelationshipRow> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('knowledge_relationships')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.update', error);
    }
    return data as KnowledgeRelationshipRow;
  }

  async delete(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('knowledge_relationships').delete().eq('id', id);
    if (error) {
      mapSupabaseError('KnowledgeRelationshipRepository.delete', error);
    }
  }
}

export const knowledgeRelationshipRepository = new KnowledgeRelationshipRepository();
