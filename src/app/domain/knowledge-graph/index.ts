export type {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeGraph,
  KnowledgeGraphPatch,
  KnowledgeGraphSummary,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
} from './knowledgeGraphTypes';

export {
  applyKnowledgeGraphPatch,
  coerceKnowledgeEntityType,
  coerceKnowledgeRelationshipType,
  createEmptyKnowledgeGraph,
  normalizeKnowledgeName,
  upsertKnowledgeEntity,
  upsertKnowledgeRelationship,
} from './knowledgeGraphPatch';

export { buildKnowledgeGraphFromStudyModel, COLLECTION_ENTITY_TYPE } from './knowledgeGraphBuilder';

export {
  extractKnowledgeEntitiesFromSection,
  extractKnowledgeGraphFromSection,
  extractKnowledgeRelationshipsFromEntities,
} from './knowledgeGraphExtraction';

export {
  selectEntitiesByType,
  selectEntityById,
  selectEntityByNormalizedName,
  selectIncomingRelationships,
  selectOutgoingRelationships,
  selectRelationshipsByType,
  selectRelationshipsForEntity,
  selectSectionsReferencingEntity,
} from './knowledgeGraphSelectors';

export {
  clearKnowledgeGraph,
  getKnowledgeGraph,
  mergeKnowledgeGraphFromStudyModel,
  patchKnowledgeGraph,
  rebuildKnowledgeGraphFromStudyModel,
  resetKnowledgeGraphForTests,
  subscribeKnowledgeGraph,
} from './knowledgeGraphStore';

export {
  findKnowledgeEntityByName,
  getAffectedSectionsForEntity,
  getDownstreamSectionIdsFromGraph,
  getEntitiesDependingOn,
  getEntitiesMeasuredBy,
  getEntitiesRelatedToChangedNames,
  getKnowledgeEntitiesByType,
  getKnowledgeGraphSummary,
  getRelationshipsForEntity,
  getSectionsReferencingEntity,
} from './knowledgeGraphQueries';
