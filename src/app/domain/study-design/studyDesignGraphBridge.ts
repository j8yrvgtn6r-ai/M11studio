import { patchKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import type { KnowledgeEntity, KnowledgeGraphPatch, KnowledgeRelationship } from '../knowledge-graph/knowledgeGraphTypes';
import { normalizeSoAName } from '../soa-knowledge/soaKnowledgePatch';
import { getStudyDesign } from './StudyDesignStore';
import type { StudyDesign } from './StudyDesignTypes';

function entity(
  id: string,
  entityType: KnowledgeEntity['entityType'],
  name: string,
  sourceSectionIds: string[],
  metadata: Record<string, unknown> = {},
): KnowledgeEntity {
  const now = new Date().toISOString();
  return {
    id,
    entityType,
    name,
    normalizedName: normalizeSoAName(name),
    aliases: [],
    sourceSectionIds,
    sourceDocumentIds: [],
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

function relationship(
  sourceEntityId: string,
  targetEntityId: string,
  relationshipType: KnowledgeRelationship['relationshipType'],
  sourceSectionIds: string[],
  metadata: Record<string, unknown> = {},
): KnowledgeRelationship {
  const now = new Date().toISOString();
  return {
    id: `kg-rel-${sourceEntityId}-${relationshipType}-${targetEntityId}`,
    sourceEntityId,
    targetEntityId,
    relationshipType,
    sourceSectionIds,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildKnowledgeGraphPatchFromStudyDesign(
  model: StudyDesign | null = getStudyDesign(),
): KnowledgeGraphPatch {
  if (!model) return { entities: [], relationships: [] };

  const entities: KnowledgeEntity[] = [];
  const relationships: KnowledgeRelationship[] = [];

  for (const epoch of model.epochs) {
    entities.push(entity(epoch.id, 'other', epoch.name, ['4'], { studyDesignKind: 'epoch' }));
  }

  for (const arm of model.arms) {
    entities.push(entity(arm.id, 'arm', arm.name, ['4', '6'], { armType: arm.type }));
  }

  for (const anchor of model.anchors ?? []) {
    entities.push(
      entity(anchor.id, 'other', anchor.name, ['4', '5'], {
        studyDesignKind: 'scheduleAnchor',
        anchorType: anchor.anchorType,
      }),
    );
  }

  for (const milestone of model.milestones) {
    entities.push(
      entity(milestone.id, 'other', milestone.name, ['4', '5'], {
        studyDesignKind: 'milestone',
        milestoneType: milestone.milestoneType,
      }),
    );
    if (milestone.anchorVisitId) {
      relationships.push(
        relationship(milestone.id, milestone.anchorVisitId, 'anchored_to', ['4'], {
          offsetDays: milestone.offsetDays,
        }),
      );
    }
  }

  for (const visit of model.visits) {
    entities.push(
      entity(visit.id, 'visit', visit.name, ['1.3', '4', '5'], {
        visitClass: visit.visitClass,
        nominalDay: visit.nominalDay,
        nominalWeek: visit.nominalWeek,
        windowBefore: visit.windowBefore,
        windowAfter: visit.windowAfter,
      }),
    );
    if (visit.epochId) {
      relationships.push(relationship(visit.id, visit.epochId, 'belongs_to', ['4']));
      relationships.push(relationship(visit.id, visit.epochId, 'occurs_during', ['4']));
    }
    if (visit.scheduleAnchorId) {
      relationships.push(
        relationship(visit.id, visit.scheduleAnchorId, 'anchored_to', ['4', '5'], {
          offsetDays: visit.offsetDays,
          offsetUnit: visit.offsetUnit,
        }),
      );
    }
  }

  for (const activity of model.activities) {
    const type = activity.activityType === 'procedure' ? 'procedure' : 'assessment';
    entities.push(entity(activity.id, type, activity.name, ['8', '9'], { activityType: activity.activityType }));
  }

  for (const rule of model.scheduleRules) {
    entities.push(
      entity(rule.id, 'other', `${rule.activityId}@${rule.visitId}`, ['1.3'], {
        studyDesignKind: 'scheduleRule',
        required: rule.required,
      }),
    );
    relationships.push(relationship(rule.activityId, rule.visitId, 'scheduled_at', ['1.3', '8']));
    relationships.push(relationship(rule.id, rule.activityId, 'uses', ['1.3']));
    relationships.push(relationship(rule.id, rule.visitId, 'requires', ['1.3']));
  }

  // occurs_before / occurs_after between sequential visits by nominal day
  const sortedVisits = [...model.visits]
    .filter((visit) => visit.nominalDay != null)
    .sort((a, b) => (a.nominalDay ?? 0) - (b.nominalDay ?? 0));
  for (let i = 0; i < sortedVisits.length - 1; i++) {
    relationships.push(
      relationship(sortedVisits[i].id, sortedVisits[i + 1].id, 'occurs_before', ['4']),
    );
    relationships.push(
      relationship(sortedVisits[i + 1].id, sortedVisits[i].id, 'occurs_after', ['4']),
    );
  }

  return { entities, relationships };
}

export function applyStudyDesignKnowledgeGraphPatchSafely(
  model: StudyDesign | null = getStudyDesign(),
): KnowledgeGraphPatch {
  try {
    const patch = buildKnowledgeGraphPatchFromStudyDesign(model);
    if (patch.entities?.length || patch.relationships?.length) {
      patchKnowledgeGraph(patch);
    }
    return patch;
  } catch {
    return { entities: [], relationships: [] };
  }
}
