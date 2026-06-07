import type { CanonicalDocument } from '../../document-ingestion/canonicalDocumentTypes';
import type { KnowledgeGraph } from '../../knowledge-graph/knowledgeGraphTypes';
import { normalizeKnowledgeName } from '../../knowledge-graph/knowledgeGraphPatch';
import { listAssets } from '../assets/protocolAssetRegistry';
import type { SoAKnowledgeModel } from '../../soa-knowledge/soaKnowledgeTypes';
import type { StudyModel, StudyModelCollectionKey } from '../../study-model/studyModelTypes';
import type { ProtocolEntity, ProtocolEntityRegistry, ProtocolEntityType } from './protocolEntityTypes';

const STUDY_MODEL_TYPE_MAP: Partial<Record<StudyModelCollectionKey, ProtocolEntityType>> = {
  objectives: 'objective',
  endpoints: 'endpoint',
  estimands: 'estimand',
  population: 'population',
  arms: 'arm',
  interventions: 'intervention',
  visits: 'visit',
  activities: 'activity',
  assessments: 'assessment',
  procedures: 'procedure',
  safetyMonitoring: 'safetyVariable',
  statisticalMethods: 'statistic',
};

const KG_TYPE_MAP: Record<string, ProtocolEntityType | undefined> = {
  objective: 'objective',
  endpoint: 'endpoint',
  estimand: 'estimand',
  population: 'population',
  arm: 'arm',
  intervention: 'intervention',
  assessment: 'assessment',
  procedure: 'procedure',
  visit: 'visit',
  activity: 'activity',
  safetyVariable: 'safetyVariable',
  statisticalMethod: 'statistic',
};

function entityKey(type: ProtocolEntityType, normalizedName: string): string {
  return `${type}:${normalizedName}`;
}

function upsertEntity(
  map: Map<string, ProtocolEntity>,
  entity: ProtocolEntity,
  preferExisting = false,
): void {
  const key = entityKey(entity.type, entity.normalizedName);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entity);
    return;
  }
  if (preferExisting) {
    return;
  }
  const mergedAliases = [...new Set([...existing.aliases, ...entity.aliases])];
  const mergedSections = [...new Set([...existing.sourceSections, ...entity.sourceSections])];
  const mergedRefs = [...new Set([...existing.references, ...entity.references])];
  map.set(key, {
    ...existing,
    aliases: mergedAliases,
    sourceSections: mergedSections,
    references: mergedRefs,
    description: existing.description ?? entity.description,
    metadata: { ...entity.metadata, ...existing.metadata },
  });
}

function fromKnowledgeGraph(graph: KnowledgeGraph | null | undefined, map: Map<string, ProtocolEntity>): void {
  if (!graph) {
    return;
  }
  for (const entity of graph.entities) {
    const type = KG_TYPE_MAP[entity.entityType];
    if (!type) {
      continue;
    }
    upsertEntity(
      map,
      {
        id: entity.id,
        type,
        name: entity.name,
        normalizedName: entity.normalizedName,
        aliases: entity.aliases,
        sourceSections: [...entity.sourceSectionIds],
        references: [],
        metadata: {
          knowledgeGraphEntityId: entity.id,
          entityType: entity.entityType,
        },
        description: entity.description,
        registrySource: 'knowledgeGraph',
      },
      true,
    );
  }
  for (const relationship of graph.relationships) {
    const source = graph.entities.find((entry) => entry.id === relationship.sourceEntityId);
    const target = graph.entities.find((entry) => entry.id === relationship.targetEntityId);
    if (!source || !target) {
      continue;
    }
    const sourceType = KG_TYPE_MAP[source.entityType];
    const targetType = KG_TYPE_MAP[target.entityType];
    if (!sourceType || !targetType) {
      continue;
    }
    const sourceKey = entityKey(sourceType, source.normalizedName);
    const existing = map.get(sourceKey);
    if (existing && !existing.references.includes(target.id)) {
      existing.references.push(target.id);
    }
  }
}

function fromStudyModel(model: StudyModel | null | undefined, map: Map<string, ProtocolEntity>): void {
  if (!model) {
    return;
  }
  for (const [collection, entityType] of Object.entries(STUDY_MODEL_TYPE_MAP) as Array<
    [StudyModelCollectionKey, ProtocolEntityType]
  >) {
    for (const item of model[collection]) {
      if (!item.name.trim()) {
        continue;
      }
      upsertEntity(map, {
        id: `sm.${collection}.${item.id}`,
        type: entityType,
        name: item.name.trim(),
        normalizedName: normalizeKnowledgeName(item.name),
        aliases: [],
        sourceSections: [...item.sourceSections],
        references: [],
        metadata: { studyModelItemId: item.id, collection },
        description: item.description,
        registrySource: 'studyModel',
      });
    }
  }
}

function fromSoAKnowledge(soa: SoAKnowledgeModel | null | undefined, map: Map<string, ProtocolEntity>): void {
  if (!soa) {
    return;
  }
  const add = (type: ProtocolEntityType, id: string, name: string, sourceSections: string[], description?: string) => {
    if (!name.trim()) {
      return;
    }
    upsertEntity(map, {
      id: `soa.${type}.${id}`,
      type,
      name: name.trim(),
      normalizedName: normalizeKnowledgeName(name),
      aliases: [],
      sourceSections: [...sourceSections],
      references: [],
      metadata: { soaEntityId: id },
      description,
      registrySource: 'soaKnowledge',
    });
  };

  for (const visit of soa.visits) {
    add('visit', visit.id, visit.name, visit.sourceSectionIds, visit.description);
  }
  for (const assessment of soa.assessments) {
    add('assessment', assessment.id, assessment.name, assessment.sourceSectionIds, assessment.description);
  }
  for (const procedure of soa.procedures) {
    add('procedure', procedure.id, procedure.name, procedure.sourceSectionIds);
  }
  for (const activity of soa.activities) {
    add('activity', activity.id, activity.name, activity.sourceSectionIds);
  }
  for (const window of soa.timingWindows) {
    add('timingWindow', window.id, window.label, window.sourceSectionIds);
  }
}

function fromProtocolAssets(map: Map<string, ProtocolEntity>): void {
  for (const asset of listAssets()) {
    const name = asset.caption || asset.name;
    if (!name.trim()) {
      continue;
    }
    upsertEntity(map, {
      id: `asset.${asset.id}`,
      type: 'protocolAsset',
      name: name.trim(),
      normalizedName: normalizeKnowledgeName(name),
      aliases: asset.name !== asset.caption ? [asset.name] : [],
      sourceSections: [],
      references: [],
      metadata: { assetId: asset.id, assetType: asset.type },
      registrySource: 'protocolAsset',
    });
  }
}

function fromCanonicalDocument(document: CanonicalDocument | null | undefined, map: Map<string, ProtocolEntity>): void {
  if (!document) {
    return;
  }
  for (const section of document.sections) {
    const title = section.title.trim();
    if (title.length < 4) {
      continue;
    }
    upsertEntity(map, {
      id: `cdm.section.${section.id}`,
      type: 'objective',
      name: title,
      normalizedName: normalizeKnowledgeName(title),
      aliases: [],
      sourceSections: [],
      references: [],
      metadata: { canonicalSectionId: section.id },
      description: section.text.slice(0, 160),
      registrySource: 'canonicalDocument',
    });
  }
}

let cachedRegistry: ProtocolEntityRegistry | null = null;
let cacheKey = '';

export function buildProtocolEntityRegistry(input: {
  knowledgeGraph?: KnowledgeGraph | null;
  studyModel?: StudyModel | null;
  soaKnowledge?: SoAKnowledgeModel | null;
  canonicalDocument?: CanonicalDocument | null;
}): ProtocolEntityRegistry {
  const key = [
    input.knowledgeGraph?.version ?? 0,
    input.studyModel?.builtAt ?? '',
    input.soaKnowledge?.updatedAt ?? '',
    input.canonicalDocument?.id ?? '',
    listAssets().length,
  ].join(':');

  if (cachedRegistry && cacheKey === key) {
    return cachedRegistry;
  }

  const map = new Map<string, ProtocolEntity>();
  fromKnowledgeGraph(input.knowledgeGraph, map);
  fromStudyModel(input.studyModel, map);
  fromSoAKnowledge(input.soaKnowledge, map);
  fromProtocolAssets(map);
  fromCanonicalDocument(input.canonicalDocument, map);

  cachedRegistry = {
    entities: [...map.values()],
    builtAt: new Date().toISOString(),
    version: map.size,
  };
  cacheKey = key;
  return cachedRegistry;
}

export function getProtocolEntityRegistry(input?: {
  knowledgeGraph?: KnowledgeGraph | null;
  studyModel?: StudyModel | null;
  soaKnowledge?: SoAKnowledgeModel | null;
  canonicalDocument?: CanonicalDocument | null;
}): ProtocolEntityRegistry {
  if (
    input &&
    (input.knowledgeGraph !== undefined ||
      input.studyModel !== undefined ||
      input.soaKnowledge !== undefined ||
      input.canonicalDocument !== undefined)
  ) {
    return buildProtocolEntityRegistry(input);
  }
  return buildProtocolEntityRegistry({});
}

export function resetProtocolEntityRegistryCache(): void {
  cachedRegistry = null;
  cacheKey = '';
}
