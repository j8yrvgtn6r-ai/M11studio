export type KnowledgeEntityType =
  | 'study'
  | 'objective'
  | 'endpoint'
  | 'estimand'
  | 'population'
  | 'arm'
  | 'intervention'
  | 'visit'
  | 'activity'
  | 'assessment'
  | 'procedure'
  | 'safetyVariable'
  | 'statisticalMethod'
  | 'eligibilityCriterion'
  | 'terminologyTerm'
  | 'documentSection'
  | 'sourceDocument'
  | 'epoch'
  | 'milestone'
  | 'scheduleAnchor'
  | 'scheduleRule'
  | 'other';

export type KnowledgeRelationshipType =
  | 'depends_on'
  | 'measured_by'
  | 'evaluated_in'
  | 'belongs_to'
  | 'supports'
  | 'derived_from'
  | 'requires'
  | 'described_in'
  | 'scheduled_at'
  | 'uses'
  | 'has_endpoint'
  | 'has_objective'
  | 'has_intervention'
  | 'has_assessment'
  | 'has_population'
  | 'has_statistical_method'
  | 'related_to'
  | 'occurs_during'
  | 'condition_applies_to'
  | 'anchored_to'
  | 'occurs_after'
  | 'occurs_before';

export interface KnowledgeEntity {
  id: string;
  protocolId?: string;
  entityType: KnowledgeEntityType;
  name: string;
  description?: string;
  normalizedName: string;
  aliases: string[];
  sourceSectionIds: string[];
  sourceDocumentIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationship {
  id: string;
  protocolId?: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: KnowledgeRelationshipType;
  sourceSectionIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraph {
  protocolId?: string;
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  updatedAt: string;
  version: number;
}

export interface KnowledgeGraphPatch {
  entities?: KnowledgeEntity[];
  relationships?: KnowledgeRelationship[];
}

export interface KnowledgeGraphSummary {
  entityCount: number;
  relationshipCount: number;
  entityCountsByType: Partial<Record<KnowledgeEntityType, number>>;
  updatedAt: string | null;
  version: number;
}
