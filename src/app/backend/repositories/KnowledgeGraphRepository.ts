import type { KnowledgeGraph } from '../../domain/knowledge-graph/knowledgeGraphTypes';
import { knowledgeEntityRepository } from './KnowledgeEntityRepository';
import { knowledgeRelationshipRepository } from './KnowledgeRelationshipRepository';
import type { KnowledgeEntityInsert, KnowledgeEntityRow, KnowledgeRelationshipInsert, KnowledgeRelationshipRow } from '../types';

function rowToEntity(row: KnowledgeEntityRow) {
  return {
    id: (row.metadata.domainId as string | undefined) ?? row.id,
    protocolId: row.protocol_id,
    entityType: row.entity_type,
    name: row.name,
    description: row.description ?? undefined,
    normalizedName: row.normalized_name,
    aliases: row.aliases,
    sourceSectionIds: row.source_section_ids,
    sourceDocumentIds: row.source_document_ids,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRelationship(row: KnowledgeRelationshipRow, entityIdMap: Map<string, string>) {
  return {
    id: (row.metadata.domainId as string | undefined) ?? row.id,
    protocolId: row.protocol_id,
    sourceEntityId: entityIdMap.get(row.source_entity_id) ?? row.source_entity_id,
    targetEntityId: entityIdMap.get(row.target_entity_id) ?? row.target_entity_id,
    relationshipType: row.relationship_type,
    sourceSectionIds: row.source_section_ids,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class KnowledgeGraphRepository {
  async loadGraph(protocolId: string): Promise<KnowledgeGraph> {
    const [entities, relationships] = await Promise.all([
      knowledgeEntityRepository.listByProtocol(protocolId),
      knowledgeRelationshipRepository.listByProtocol(protocolId),
    ]);
    const entityIdMap = new Map<string, string>();
    for (const row of entities) {
      entityIdMap.set(row.id, (row.metadata.domainId as string | undefined) ?? row.id);
    }
    const mappedEntities = entities.map(rowToEntity);
    const mappedRelationships = relationships.map((row) => rowToRelationship(row, entityIdMap));
    const updatedAt = [...mappedEntities, ...mappedRelationships]
      .map((entry) => entry.updatedAt)
      .sort()
      .at(-1);
    return {
      protocolId,
      entities: mappedEntities,
      relationships: mappedRelationships,
      updatedAt: updatedAt ?? new Date().toISOString(),
      version: mappedEntities.length + mappedRelationships.length,
    };
  }

  async saveGraph(protocolId: string, graph: KnowledgeGraph): Promise<void> {
    const rowIdByDomainId = new Map<string, string>();

    for (const entity of graph.entities) {
      const input: KnowledgeEntityInsert = {
        protocol_id: protocolId,
        entity_type: entity.entityType,
        name: entity.name,
        normalized_name: entity.normalizedName,
        description: entity.description ?? null,
        aliases: entity.aliases,
        source_section_ids: entity.sourceSectionIds,
        source_document_ids: entity.sourceDocumentIds,
        metadata: { ...entity.metadata, domainId: entity.id },
      };
      const row = await knowledgeEntityRepository.upsertByTypeAndNormalizedName(input);
      rowIdByDomainId.set(entity.id, row.id);
    }

    for (const relationship of graph.relationships) {
      const sourceRowId = rowIdByDomainId.get(relationship.sourceEntityId);
      const targetRowId = rowIdByDomainId.get(relationship.targetEntityId);
      if (!sourceRowId || !targetRowId) {
        continue;
      }
      const input: KnowledgeRelationshipInsert = {
        protocol_id: protocolId,
        source_entity_id: sourceRowId,
        target_entity_id: targetRowId,
        relationship_type: relationship.relationshipType,
        source_section_ids: relationship.sourceSectionIds,
        metadata: { ...relationship.metadata, domainId: relationship.id },
      };
      await knowledgeRelationshipRepository.create(input);
    }
  }
}

export const knowledgeGraphRepository = new KnowledgeGraphRepository();
