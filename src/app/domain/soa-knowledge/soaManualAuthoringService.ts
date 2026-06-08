import { patchKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import { createAssessmentScheduleRule, deleteAssessmentScheduleRule } from '../protocol/store/assessmentScheduleRuleMutations';
import {
  createSoAAssessmentDefinition,
  deleteSoAAssessmentDefinition,
  updateSoAAssessmentDefinition,
  type CreateSoAAssessmentDefinitionInput,
} from '../protocol/store/soaAssessmentDefinitionMutations';
import {
  createScheduleAnchor,
  createVisitDefinition,
  deleteScheduleAnchor,
  deleteVisitDefinition,
  ensureDefaultScreeningAnchor,
  updateScheduleAnchor,
  updateVisitDefinition,
} from '../protocol/store/visitScheduleMutations';
import { getProtocolDocument } from '../protocol/store/protocolStore';
import { applyConsistencyAgentResults, getProtocolImportState } from '../protocol/import/protocolImportStore';
import { applySoAKnowledgeGraphPatchSafely } from './soaKnowledgeGraphBridge';
import {
  applySoAKnowledgePatch,
  createEmptySoAKnowledgeModel,
  normalizeSoAName,
  removeSoAKnowledgeEntityById,
} from './soaKnowledgePatch';
import { createSoANarrativeImpactRecord } from './soaKnowledgeNarrativeSync';
import { createSoANarrativeSyncProposal } from './soaNarrativeSyncStore';
import { patchSoAKnowledge, getSoAKnowledge, setSoAKnowledge } from './soaKnowledgeStore';
import type {
  SoAActivity,
  SoAArm,
  SoAAssessment,
  SoACondition,
  SoAElement,
  SoAEpoch,
  SoAMilestone,
  SoAScheduleRule,
  SoAVisit,
} from './soaKnowledgeTypes';
import type { SoAEntityEditorKind, SoAEntityFormValues } from './soaEntityValidation';
import { describeEntityForImpact } from './soaEntityValidation';

function generateEntityId(prefix: string, name: string): string {
  const slug = normalizeSoAName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return `manual-${prefix}-${slug}-${Date.now().toString(36)}`;
}

function parseWindowDays(window?: string): { before?: number; after?: number } {
  if (!window?.trim()) {
    return {};
  }
  const match = window.match(/±?\s*(\d+)/);
  if (!match) {
    return {};
  }
  const days = Number.parseInt(match[1], 10);
  return Number.isFinite(days) ? { before: days, after: days } : {};
}

function parseOffsetDays(offset?: string): number | undefined {
  if (!offset?.trim()) {
    return undefined;
  }
  const match = offset.match(/([-+]?\d+)/);
  if (!match) {
    return undefined;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function isAgentGeneratedSource(source?: string): boolean {
  return (
    source === 'deterministic' ||
    source === 'deterministic-table' ||
    source === 'llm-inferred' ||
    source === 'llm-reconciled'
  );
}

function preserveAgentProvenance<T extends { inferenceSource?: string; evidence?: unknown[] }>(
  existing: T | undefined,
  next: T,
): T {
  if (!existing || !isAgentGeneratedSource(existing.inferenceSource)) {
    return next;
  }
  return {
    ...existing,
    ...next,
    inferenceSource: 'user-modified',
    evidence: existing.evidence,
  };
}

function syncKnowledgeGraphFromModel(): void {
  const knowledge = getSoAKnowledge();
  if (!knowledge) {
    return;
  }
  const graphPatch = applySoAKnowledgeGraphPatchSafely(knowledge);
  if (graphPatch.entities?.length || graphPatch.relationships?.length) {
    patchKnowledgeGraph(graphPatch);
  }
}

function markManualEditNarrativeImpact(
  kind: SoAEntityEditorKind,
  entity: { id: string; name: string },
): string[] {
  const impactMeta = describeEntityForImpact(kind, entity as never);
  const record = createSoANarrativeImpactRecord({
    kind: impactMeta.changeKind,
    entityKind: impactMeta.entityKind as never,
    entityId: entity.id,
    entityName: impactMeta.entityName,
    description: 'Manual SoA configuration edit',
  });

  const availableSectionIds = Object.keys(getProtocolImportState().sectionDrafts);

  createSoANarrativeSyncProposal({
    source: 'soaEdit',
    impactedSectionIds: record.impactedSectionIds,
    reason: `Manual SoA edit to ${entity.name} may require narrative review.`,
    proposedNarrativeUpdates: record.impactedSectionIds.map((sectionId) => ({
      sectionId,
      reason: record.reasons[sectionId] ?? 'SoA structure changed.',
      suggestedNote: `This SoA change may require updates to Section ${sectionId}.`,
    })),
  });

  if (availableSectionIds.length === 0) {
    return record.impactedSectionIds;
  }

  const impacts = record.impactedSectionIds
    .filter((sectionId) => availableSectionIds.includes(sectionId))
    .map((sectionId) => ({
      sectionId,
      reasons: [
        {
          sourceSectionId: 'soa-configuration',
          sourceSectionTitle: 'SoA Configuration',
          changedItemName: entity.name,
          changedItemCollection: impactMeta.entityKind,
          relationship: 'soa_manual_edit',
          reason: record.reasons[sectionId] ?? 'Manual SoA edit may require narrative review.',
          suggestedAction: 'edit' as const,
        },
      ],
    }));

  if (impacts.length === 0) {
    return record.impactedSectionIds;
  }

  return applyConsistencyAgentResults('soa-configuration', impacts);
}

function applyKnowledgePatch(patch: Parameters<typeof patchSoAKnowledge>[0]): void {
  const document = getProtocolDocument();
  const base = getSoAKnowledge() ?? createEmptySoAKnowledgeModel(document.id);
  const merged = applySoAKnowledgePatch(base, patch);
  patchSoAKnowledge(merged);
  syncKnowledgeGraphFromModel();
}

export interface ManualSoAEntitySaveResult {
  success: boolean;
  entityId?: string;
  error?: string;
  markedSections: string[];
}

export function saveManualSoAEntity(
  kind: SoAEntityEditorKind,
  values: SoAEntityFormValues,
  options: { entityId?: string } = {},
): ManualSoAEntitySaveResult {
  const document = getProtocolDocument();
  const entityId = options.entityId ?? values.code?.trim() ?? generateEntityId(kind, values.name);
  const sourceSectionIds = ['1.3'];
  const provenance = options.entityId ? ('user-modified' as const) : ('user-created' as const);
  let markedSections: string[] = [];

  switch (kind) {
    case 'epoch': {
      const entity: SoAEpoch = {
        id: entityId,
        name: values.name.trim(),
        description: values.description?.trim() || values.notes?.trim(),
        epochType: values.epochType?.trim(),
        order: values.order ?? (getSoAKnowledge()?.epochs.length ?? 0) + 1,
        startMilestoneId: values.startAnchor?.trim(),
        endMilestoneId: values.endAnchor?.trim(),
        sourceSectionIds,
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ epochs: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, entity);
      return { success: true, entityId, markedSections };
    }
    case 'arm': {
      const entity: SoAArm = {
        id: entityId,
        name: values.name.trim(),
        description: values.description?.trim() || values.intervention?.trim() || values.notes?.trim(),
        armType: values.armType?.trim(),
        interventionId: values.intervention?.trim(),
        sourceSectionIds: ['4', '6'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ arms: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, entity);
      return { success: true, entityId, markedSections };
    }
    case 'element': {
      const entity: SoAElement = {
        id: entityId,
        name: values.name.trim(),
        description: values.description?.trim() || values.notes?.trim(),
        armId: values.armId,
        epochId: values.epochId,
        plannedDuration: values.plannedDuration?.trim(),
        order: values.order ?? (getSoAKnowledge()?.elements.length ?? 0) + 1,
        sourceSectionIds: ['4'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ elements: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, entity);
      return { success: true, entityId, markedSections };
    }
    case 'activity': {
      const entity: SoAActivity = {
        id: entityId,
        name: values.name.trim(),
        visitId: values.visitId,
        elementId: values.elementId,
        activityType: values.category as SoAActivity['activityType'],
        order: values.order ?? (getSoAKnowledge()?.activities.length ?? 0) + 1,
        sourceSectionIds: ['6', '8'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ activities: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, entity);
      return { success: true, entityId, markedSections };
    }
    case 'assessment': {
      const configId = entityId.startsWith('manual-')
        ? entityId.replace(/^manual-assessment-/, 'soa-assessment-')
        : entityId;
      const knowledgeEntity: SoAAssessment = {
        id: configId,
        name: values.name.trim(),
        category: values.category as SoAAssessment['category'],
        description: values.description?.trim() || values.procedureName?.trim() || values.notes?.trim(),
        linkedActivityIds: values.linkedActivityIds,
        linkedVisitIds: values.linkedVisitIds ?? (values.visitId ? [values.visitId] : undefined),
        required: values.required,
        sourceSectionIds: ['8'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ assessments: [knowledgeEntity] });

      const configInput: CreateSoAAssessmentDefinitionInput = {
        id: configId,
        label: values.name.trim(),
        category: values.category?.trim() || 'other',
        order: (document.soaAssessmentDefinitions?.length ?? 0) + 1,
        linkedSectionId: '8',
        metadata: { inferenceSource: provenance },
      };
      if (!(document.soaAssessmentDefinitions ?? []).some((item) => item.id === configInput.id)) {
        createSoAAssessmentDefinition(configInput);
      } else if (options.entityId) {
        updateSoAAssessmentDefinition(configInput.id, {
          label: configInput.label,
          category: configInput.category,
        });
      }

      markedSections = markManualEditNarrativeImpact(kind, knowledgeEntity);
      return { success: true, entityId: configInput.id, markedSections };
    }
    case 'condition': {
      const entity: SoACondition = {
        id: entityId,
        label: values.name.trim(),
        description: values.description?.trim() || values.conditionText?.trim(),
        expressionText: values.triggerLogic?.trim() || values.conditionText?.trim(),
        appliesToEntityId: values.appliesToEntityId?.trim() || values.appliesTo?.trim(),
        appliesToEntityKind: values.appliesToEntityKind?.trim(),
        sourceSectionIds: ['8', '9'],
        inferenceSource: provenance,
        rationale: values.appliesTo?.trim() || values.notes?.trim(),
      };
      applyKnowledgePatch({ conditions: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, { id: entity.id, name: entity.label });
      return { success: true, entityId, markedSections };
    }
    case 'visit': {
      const anchorId = values.anchorId?.trim() || ensureDefaultScreeningAnchor();
      if (!(document.visitSchedule?.anchors ?? []).some((anchor) => anchor.id === anchorId)) {
        createScheduleAnchor({
          id: anchorId,
          name: values.startAnchor?.trim() || 'Manual Anchor',
          anchorType: 'screening',
        });
      }

      const visitConfigId = entityId.startsWith('manual-') ? entityId.replace(/^manual-visit-/, 'visit-') : entityId;
      const windowDays = parseWindowDays(values.window);
      const offsetDays = parseOffsetDays(values.offset);

      if (!(document.visitSchedule?.visitDefinitions ?? []).some((visit) => visit.id === visitConfigId)) {
        const created = createVisitDefinition({
          id: visitConfigId,
          name: values.name.trim(),
          visitType: (values.visitType as never) || 'treatment',
          anchorId,
          epoch: values.epochId,
          order: (document.visitSchedule?.visitDefinitions.length ?? 0) + 1,
          required: values.required ?? true,
          description: values.description?.trim() || values.notes?.trim(),
          nominalDay: values.nominalDay,
          nominalWeek: values.nominalWeek,
          windowBeforeDays: windowDays.before,
          windowAfterDays: windowDays.after,
          offsetDays,
        });
        if (!created) {
          return { success: false, error: 'Could not create visit definition.', markedSections: [] };
        }
      } else {
        updateVisitDefinition(visitConfigId, {
          name: values.name.trim(),
          visitType: (values.visitType as never) || 'treatment',
          anchorId,
          epoch: values.epochId,
          required: values.required ?? true,
          description: values.description?.trim() || values.notes?.trim(),
          nominalDay: values.nominalDay,
          nominalWeek: values.nominalWeek,
          windowBeforeDays: windowDays.before,
          windowAfterDays: windowDays.after,
          offsetDays,
        });
      }

      const knowledgeEntity: SoAVisit = {
        id: visitConfigId,
        name: values.name.trim(),
        visitType: values.visitType,
        epochId: values.epochId,
        anchorId,
        nominalDay: values.nominalDay,
        nominalWeek: values.nominalWeek,
        window: values.window?.trim(),
        required: values.required ?? true,
        order:
          getSoAKnowledge()?.visits.find((visit) => visit.id === visitConfigId)?.order ??
          (getSoAKnowledge()?.visits.length ?? 0) + 1,
        sourceSectionIds: ['1.3', '4'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ visits: [knowledgeEntity] });
      markedSections = markManualEditNarrativeImpact(kind, knowledgeEntity);
      return { success: true, entityId: visitConfigId, markedSections };
    }
    case 'scheduleRule': {
      const assessmentId = values.assessmentId!.trim();
      const visitDefinitionId = values.visitDefinitionId!.trim();
      const ruleId = entityId.startsWith('manual-')
        ? entityId.replace(/^manual-scheduleRule-/, 'rule-')
        : entityId;

      if (!(document.assessmentScheduleRules ?? []).some((rule) => rule.id === ruleId)) {
        const created = createAssessmentScheduleRule({
          id: ruleId,
          assessmentId,
          visitDefinitionId,
          required: values.required ?? true,
          timingNote: values.notes?.trim(),
          sourceSectionId: '1.3',
          metadata: { inferenceSource: provenance, footnote: values.footnote?.trim() },
        });
        if (!created) {
          return { success: false, error: 'Could not create schedule rule.', markedSections: [] };
        }
      }

      const knowledgeEntity: SoAScheduleRule = {
        id: ruleId,
        assessmentId,
        visitId: visitDefinitionId,
        conditionId: values.appliesTo,
        required: values.required ?? true,
        notes: values.footnote?.trim() || values.notes?.trim(),
        sourceSectionIds: ['1.3', '8'],
        inferenceSource: provenance,
      };
      applyKnowledgePatch({ scheduleRules: [knowledgeEntity] });
      markedSections = markManualEditNarrativeImpact(kind, { id: ruleId, name: values.name.trim() || ruleId });
      return { success: true, entityId: ruleId, markedSections };
    }
    case 'milestone': {
      const milestoneConfigId = entityId.startsWith('manual-')
        ? entityId.replace(/^manual-milestone-/, 'anchor-')
        : entityId;
      if (!(document.visitSchedule?.anchors ?? []).some((anchor) => anchor.id === milestoneConfigId)) {
        createScheduleAnchor({
          id: milestoneConfigId,
          name: values.name.trim(),
          anchorType: (values.milestoneType as never) || 'screening',
          description: values.description?.trim() || values.anchorDateOrEvent?.trim(),
        });
      } else if (options.entityId) {
        updateScheduleAnchor(milestoneConfigId, {
          name: values.name.trim(),
          anchorType: (values.milestoneType as never) || 'screening',
          description: values.description?.trim() || values.anchorDateOrEvent?.trim(),
        });
      }
      const entity: SoAMilestone = {
        id: milestoneConfigId,
        name: values.name.trim(),
        milestoneType: values.milestoneType?.trim(),
        anchorDateOrEvent: values.anchorDateOrEvent?.trim(),
        description: values.description?.trim() || values.notes?.trim(),
        sourceSectionIds: ['1.3', '4'],
        inferenceSource: provenance,
        rationale: values.notes?.trim(),
      };
      applyKnowledgePatch({ milestones: [entity] });
      markedSections = markManualEditNarrativeImpact(kind, entity);
      return { success: true, entityId: milestoneConfigId, markedSections };
    }
    default:
      return { success: false, error: `Unsupported entity kind: ${kind}`, markedSections: [] };
  }
}

export function listKnowledgeEntities(kind: SoAEntityEditorKind) {
  const knowledge = getSoAKnowledge();
  if (!knowledge) {
    return [];
  }
  switch (kind) {
    case 'epoch':
      return knowledge.epochs;
    case 'arm':
      return knowledge.arms;
    case 'visit':
      return knowledge.visits;
    case 'activity':
      return knowledge.activities;
    case 'element':
      return knowledge.elements;
    case 'assessment':
      return knowledge.assessments;
    case 'condition':
      return knowledge.conditions;
    case 'scheduleRule':
      return knowledge.scheduleRules;
    case 'milestone':
      return knowledge.milestones ?? [];
    default:
      return [];
  }
}

export function entityToFormValues(
  kind: SoAEntityEditorKind,
  entity: Record<string, unknown>,
): SoAEntityFormValues {
  return {
    name: String(entity.name ?? entity.label ?? ''),
    description: entity.description ? String(entity.description) : undefined,
    code: String(entity.id ?? ''),
    notes: entity.rationale ? String(entity.rationale) : undefined,
    epochType: entity.epochType ? String(entity.epochType) : undefined,
    order: typeof entity.order === 'number' ? entity.order : undefined,
    startAnchor: entity.startMilestoneId ? String(entity.startMilestoneId) : undefined,
    endAnchor: entity.endMilestoneId ? String(entity.endMilestoneId) : undefined,
    armType: entity.armType ? String(entity.armType) : undefined,
    intervention: entity.interventionId ? String(entity.interventionId) : undefined,
    visitType: entity.visitType ? String(entity.visitType) : undefined,
    epochId: entity.epochId ? String(entity.epochId) : entity.epoch ? String(entity.epoch) : undefined,
    anchorId: entity.anchorId ? String(entity.anchorId) : undefined,
    window: entity.window ? String(entity.window) : undefined,
    nominalDay: typeof entity.nominalDay === 'number' ? entity.nominalDay : undefined,
    nominalWeek: typeof entity.nominalWeek === 'number' ? entity.nominalWeek : undefined,
    required: typeof entity.required === 'boolean' ? entity.required : undefined,
    category: entity.category ? String(entity.category) : entity.activityType ? String(entity.activityType) : undefined,
    armId: entity.armId ? String(entity.armId) : undefined,
    visitId: entity.visitId ? String(entity.visitId) : undefined,
    elementId: entity.elementId ? String(entity.elementId) : undefined,
    activityId: entity.activityId ? String(entity.activityId) : undefined,
    assessmentId: entity.assessmentId ? String(entity.assessmentId) : undefined,
    visitDefinitionId: entity.visitId ? String(entity.visitId) : undefined,
    conditionText: entity.expressionText ? String(entity.expressionText) : undefined,
    triggerLogic: entity.expressionText ? String(entity.expressionText) : undefined,
    appliesToEntityId: entity.appliesToEntityId ? String(entity.appliesToEntityId) : undefined,
    appliesToEntityKind: entity.appliesToEntityKind ? String(entity.appliesToEntityKind) : undefined,
    footnote: entity.notes ? String(entity.notes) : undefined,
    milestoneType: entity.milestoneType ? String(entity.milestoneType) : undefined,
    anchorDateOrEvent: entity.anchorDateOrEvent ? String(entity.anchorDateOrEvent) : undefined,
    plannedDuration: entity.plannedDuration ? String(entity.plannedDuration) : undefined,
    linkedVisitIds: Array.isArray(entity.linkedVisitIds) ? (entity.linkedVisitIds as string[]) : undefined,
    linkedActivityIds: Array.isArray(entity.linkedActivityIds) ? (entity.linkedActivityIds as string[]) : undefined,
  };
}

export function deleteManualSoAEntity(kind: SoAEntityEditorKind, entityId: string): ManualSoAEntitySaveResult {
  const document = getProtocolDocument();
  const knowledge = getSoAKnowledge();
  if (!knowledge) {
    return { success: false, error: 'No SoA Knowledge model loaded.', markedSections: [] };
  }

  switch (kind) {
    case 'visit':
      if (!deleteVisitDefinition(entityId)) {
        return { success: false, error: 'Could not delete visit — schedule rules may reference it.', markedSections: [] };
      }
      break;
    case 'assessment':
      if (!deleteSoAAssessmentDefinition(entityId)) {
        return { success: false, error: 'Could not delete assessment — schedule rules may reference it.', markedSections: [] };
      }
      break;
    case 'scheduleRule':
      if (!deleteAssessmentScheduleRule(entityId)) {
        return { success: false, error: 'Could not delete schedule rule.', markedSections: [] };
      }
      break;
    case 'milestone':
      if (!deleteScheduleAnchor(entityId)) {
        return { success: false, error: 'Could not delete milestone — visits may reference it.', markedSections: [] };
      }
      break;
    default:
      break;
  }

  const next = removeSoAKnowledgeEntityById(knowledge, kind, entityId);
  setSoAKnowledge(next);
  syncKnowledgeGraphFromModel();
  const markedSections = markManualEditNarrativeImpact(kind, {
    id: entityId,
    name: entityId,
  });
  void document;
  return { success: true, entityId, markedSections };
}
