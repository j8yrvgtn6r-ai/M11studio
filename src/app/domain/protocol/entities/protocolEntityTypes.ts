export type ProtocolEntityType =
  | 'objective'
  | 'endpoint'
  | 'estimand'
  | 'population'
  | 'arm'
  | 'intervention'
  | 'assessment'
  | 'procedure'
  | 'visit'
  | 'activity'
  | 'timingWindow'
  | 'safetyVariable'
  | 'statistic'
  | 'protocolAsset';

export type ProtocolEntityRegistrySource =
  | 'knowledgeGraph'
  | 'studyModel'
  | 'soaKnowledge'
  | 'canonicalDocument'
  | 'protocolAsset';

export interface ProtocolEntity {
  id: string;
  type: ProtocolEntityType;
  name: string;
  normalizedName: string;
  aliases: string[];
  sourceSections: string[];
  references: string[];
  metadata: Record<string, string>;
  description?: string;
  registrySource: ProtocolEntityRegistrySource;
}

export interface ProtocolEntityRegistry {
  entities: ProtocolEntity[];
  builtAt: string;
  version: number;
}

export interface ProtocolEntityReference {
  entityId: string;
  entityType: ProtocolEntityType;
  displayText: string;
  sectionId: string;
  offset: number;
  endOffset: number;
  createdAt: string;
}

export interface EntityInsertionRecord {
  id: string;
  entityId: string;
  entityType: ProtocolEntityType;
  sectionId: string;
  insertedText: string;
  timestamp: string;
}

export interface ProtocolEntityHoverInfo {
  entity: ProtocolEntity;
  relationships: Array<{ label: string; entityName: string; entityId: string }>;
  referencedInSections: string[];
  usedBySections: string[];
  downstreamSectionCount: number;
}

export interface EntityDiagnostic {
  id: string;
  sectionId: string;
  severity: 'info' | 'warning' | 'error';
  code: 'duplicate_entity_name' | 'conflicting_alias' | 'orphaned_reference' | 'unresolved_reference' | 'near_duplicate_entity';
  message: string;
  entityId?: string;
  relatedEntityIds?: string[];
  startOffset?: number;
  endOffset?: number;
  suggestedFix?: string;
}
