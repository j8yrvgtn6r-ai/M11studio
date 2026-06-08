import { getKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import {
  normalizeKnowledgeName,
} from '../knowledge-graph/knowledgeGraphPatch';
import type {
  KnowledgeEntity,
  KnowledgeGraphPatch,
  KnowledgeRelationship,
} from '../knowledge-graph/knowledgeGraphTypes';
import type { SoAKnowledgeModel } from './soaKnowledgeTypes';
import { createEmptySoAKnowledgeModel } from './soaKnowledgePatch';

const SOA_ENTITY_LINKS_KEY = 'soaKnowledgeEntityLinks';

function readEntityLinks(): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(SOA_ENTITY_LINKS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeEntityLinks(links: Record<string, string>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(SOA_ENTITY_LINKS_KEY, JSON.stringify(links));
  } catch {
    // Ignore storage failures.
  }
}

function entityId(prefix: string, id: string): string {
  return `soa-${prefix}-${id}`;
}

function buildEntity(
  soaId: string,
  entityType: KnowledgeEntity['entityType'],
  name: string,
  sourceSectionIds: string[],
  protocolId?: string,
  inferenceSource?: string,
): KnowledgeEntity {
  const now = new Date().toISOString();
  return {
    id: entityId(entityType, soaId),
    protocolId,
    entityType,
    name,
    normalizedName: normalizeKnowledgeName(name),
    aliases: [],
    sourceSectionIds,
    sourceDocumentIds: [],
    metadata: {
      soaEntityId: soaId,
      ...(inferenceSource ? { inferenceSource } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildRelationship(
  sourceEntityId: string,
  targetEntityId: string,
  relationshipType: KnowledgeRelationship['relationshipType'],
  sourceSectionIds: string[],
  protocolId?: string,
  inferenceSource?: string,
): KnowledgeRelationship {
  const now = new Date().toISOString();
  return {
    id: `${sourceEntityId}|${relationshipType}|${targetEntityId}`,
    protocolId,
    sourceEntityId,
    targetEntityId,
    relationshipType,
    sourceSectionIds,
    metadata: {
      source: 'soa-knowledge-v1',
      ...(inferenceSource ? { inferenceSource } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function buildKnowledgeGraphPatchFromSoAKnowledge(
  model: SoAKnowledgeModel | null | undefined,
): KnowledgeGraphPatch {
  if (!model) {
    return { entities: [], relationships: [] };
  }

  const entities: KnowledgeEntity[] = [];
  const relationships: KnowledgeRelationship[] = [];

  for (const arm of model.arms) {
    entities.push(buildEntity(arm.id, 'arm', arm.name, arm.sourceSectionIds, model.protocolId, arm.inferenceSource));
  }
  for (const epoch of model.epochs) {
    entities.push(buildEntity(epoch.id, 'other', epoch.name, epoch.sourceSectionIds, model.protocolId, epoch.inferenceSource));
  }
  for (const visit of model.visits) {
    entities.push(buildEntity(visit.id, 'visit', visit.name, visit.sourceSectionIds, model.protocolId, visit.inferenceSource));
    if (visit.epochId) {
      relationships.push(
        buildRelationship(
          entityId('visit', visit.id),
          entityId('other', visit.epochId),
          'belongs_to',
          visit.sourceSectionIds,
          model.protocolId,
          visit.inferenceSource,
        ),
      );
    }
  }
  for (const activity of model.activities) {
    entities.push(
      buildEntity(activity.id, 'activity', activity.name, activity.sourceSectionIds, model.protocolId, activity.inferenceSource),
    );
    if (activity.visitId) {
      relationships.push(
        buildRelationship(
          entityId('activity', activity.id),
          entityId('visit', activity.visitId),
          'related_to',
          activity.sourceSectionIds,
          model.protocolId,
          activity.inferenceSource,
        ),
      );
      relationships.push(
        buildRelationship(
          entityId('activity', activity.id),
          entityId('visit', activity.visitId),
          'occurs_during',
          activity.sourceSectionIds,
          model.protocolId,
          activity.inferenceSource,
        ),
      );
    }
    if (activity.elementId) {
      const element = model.elements.find((item) => item.id === activity.elementId);
      if (element?.epochId) {
        relationships.push(
          buildRelationship(
            entityId('activity', activity.id),
            entityId('other', element.epochId),
            'occurs_during',
            activity.sourceSectionIds,
            model.protocolId,
            activity.inferenceSource,
          ),
        );
      }
    }
  }
  for (const assessment of model.assessments) {
    entities.push(
      buildEntity(assessment.id, 'assessment', assessment.name, assessment.sourceSectionIds, model.protocolId, assessment.inferenceSource),
    );
    for (const visitId of assessment.linkedVisitIds ?? []) {
      relationships.push(
        buildRelationship(
          entityId('assessment', assessment.id),
          entityId('visit', visitId),
          'occurs_during',
          assessment.sourceSectionIds,
          model.protocolId,
          assessment.inferenceSource,
        ),
      );
    }
  }
  for (const procedure of model.procedures) {
    entities.push(
      buildEntity(procedure.id, 'procedure', procedure.name, procedure.sourceSectionIds, model.protocolId, procedure.inferenceSource),
    );
    if (procedure.assessmentId) {
      relationships.push(
        buildRelationship(
          entityId('procedure', procedure.id),
          entityId('assessment', procedure.assessmentId),
          'related_to',
          procedure.sourceSectionIds,
          model.protocolId,
          procedure.inferenceSource,
        ),
      );
    }
  }

  for (const condition of model.conditions) {
    entities.push(
      buildEntity(condition.id, 'other', condition.label, condition.sourceSectionIds, model.protocolId, condition.inferenceSource),
    );
    if (condition.appliesToEntityId) {
      const targetPrefix = condition.appliesToEntityKind === 'visit'
        ? 'visit'
        : condition.appliesToEntityKind === 'activity'
          ? 'activity'
          : condition.appliesToEntityKind === 'assessment'
            ? 'assessment'
            : 'other';
      relationships.push(
        buildRelationship(
          entityId('other', condition.id),
          entityId(targetPrefix, condition.appliesToEntityId),
          'condition_applies_to',
          condition.sourceSectionIds,
          model.protocolId,
          condition.inferenceSource,
        ),
      );
    }
  }

  for (const milestone of model.milestones ?? []) {
    entities.push(
      buildEntity(milestone.id, 'other', milestone.name, milestone.sourceSectionIds, model.protocolId, milestone.inferenceSource),
    );
  }

  for (const rule of model.scheduleRules) {
    if (rule.assessmentId && rule.visitId) {
      relationships.push(
        buildRelationship(
          entityId('assessment', rule.assessmentId),
          entityId('visit', rule.visitId),
          'scheduled_at',
          rule.sourceSectionIds,
          model.protocolId,
          rule.inferenceSource,
        ),
      );
    }
    if (rule.procedureId && rule.visitId) {
      relationships.push(
        buildRelationship(
          entityId('procedure', rule.procedureId),
          entityId('visit', rule.visitId),
          'scheduled_at',
          rule.sourceSectionIds,
          model.protocolId,
          rule.inferenceSource,
        ),
      );
    }
    if (rule.activityId && rule.visitId) {
      relationships.push(
        buildRelationship(
          entityId('activity', rule.activityId),
          entityId('visit', rule.visitId),
          'related_to',
          rule.sourceSectionIds,
          model.protocolId,
          rule.inferenceSource,
        ),
      );
    }
    if (rule.conditionId && rule.assessmentId) {
      relationships.push(
        buildRelationship(
          entityId('other', rule.conditionId),
          entityId('assessment', rule.assessmentId),
          'requires',
          rule.sourceSectionIds,
          model.protocolId,
          rule.inferenceSource,
        ),
      );
      relationships.push(
        buildRelationship(
          entityId('other', rule.conditionId),
          entityId('assessment', rule.assessmentId),
          'condition_applies_to',
          rule.sourceSectionIds,
          model.protocolId,
          rule.inferenceSource,
        ),
      );
    }
  }

  for (const element of model.elements) {
    entities.push(buildEntity(element.id, 'other', element.name, element.sourceSectionIds, model.protocolId));
    if (element.epochId) {
      relationships.push(
        buildRelationship(
          entityId('other', element.id),
          entityId('other', element.epochId),
          'belongs_to',
          element.sourceSectionIds,
          model.protocolId,
        ),
      );
    }
    if (element.armId) {
      relationships.push(
        buildRelationship(
          entityId('other', element.id),
          entityId('arm', element.armId),
          'uses',
          element.sourceSectionIds,
          model.protocolId,
        ),
      );
    }
  }

  return { entities, relationships };
}

export function buildSoAKnowledgeFromKnowledgeGraph(
  graph = getKnowledgeGraph(),
  protocolId?: string,
): SoAKnowledgeModel | null {
  if (!graph) {
    return null;
  }

  const model = createEmptySoAKnowledgeModel(protocolId ?? graph.protocolId);

  for (const entity of graph.entities) {
    const soaId = String(entity.metadata.soaEntityId ?? entity.id);
    switch (entity.entityType) {
      case 'arm':
        model.arms.push({ id: soaId, name: entity.name, sourceSectionIds: entity.sourceSectionIds });
        break;
      case 'visit':
        model.visits.push({
          id: soaId,
          name: entity.name,
          order: model.visits.length,
          sourceSectionIds: entity.sourceSectionIds,
        });
        break;
      case 'activity':
        model.activities.push({
          id: soaId,
          name: entity.name,
          order: model.activities.length,
          sourceSectionIds: entity.sourceSectionIds,
        });
        break;
      case 'assessment':
        model.assessments.push({ id: soaId, name: entity.name, sourceSectionIds: entity.sourceSectionIds });
        break;
      case 'procedure':
        model.procedures.push({ id: soaId, name: entity.name, sourceSectionIds: entity.sourceSectionIds });
        break;
      default:
        if (entity.name.toLowerCase().includes('epoch')) {
          model.epochs.push({
            id: soaId,
            name: entity.name,
            order: model.epochs.length,
            sourceSectionIds: entity.sourceSectionIds,
          });
        }
        break;
    }
  }

  for (const relationship of graph.relationships) {
    if (relationship.relationshipType !== 'scheduled_at') {
      continue;
    }
    const assessmentMatch = relationship.sourceEntityId.match(/^soa-assessment-(.+)$/);
    const visitMatch = relationship.targetEntityId.match(/^soa-visit-(.+)$/);
    if (!assessmentMatch || !visitMatch) {
      continue;
    }
    model.scheduleRules.push({
      id: `rule-${assessmentMatch[1]}-${visitMatch[1]}`,
      assessmentId: assessmentMatch[1],
      visitId: visitMatch[1],
      required: true,
      sourceSectionIds: relationship.sourceSectionIds,
      notes: 'Imported from Knowledge Graph scheduled_at relationship',
    });
  }

  model.extractionNotes.push('Built from Knowledge Graph snapshot (v1 reverse bridge).');
  model.updatedAt = new Date().toISOString();
  return model;
}

export function linkSoAEntityToKnowledgeEntity(
  soaEntityId: string,
  knowledgeEntityId: string,
): Record<string, string> {
  const links = readEntityLinks();
  links[soaEntityId] = knowledgeEntityId;
  writeEntityLinks(links);
  return links;
}

export function getSoAEntityKnowledgeLinks(): Record<string, string> {
  return readEntityLinks();
}

export function applySoAKnowledgeGraphPatchSafely(model: SoAKnowledgeModel | null | undefined): KnowledgeGraphPatch {
  try {
    return buildKnowledgeGraphPatchFromSoAKnowledge(model);
  } catch {
    return { entities: [], relationships: [] };
  }
}
