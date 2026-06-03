import type {
  ProtocolDocument,
  ScheduleAssessment,
  ScheduleCell,
  ScheduleDefinition,
  ScheduleVisit,
  VisitDefinition,
} from '../types';
import {
  findScheduleAssessmentInDocument,
  resolveAssessmentReference,
} from '../assessmentScheduleRule/assessmentRefs';
import { findVisitDefinitionInDocument } from '../visitSchedule/lookup';

export type GeneratedScheduleMetadata = {
  generatedFromRules: true;
  generatedAt: string;
  sourceRuleCount: number;
  sourceVisitDefinitionCount: number;
};

export type GeneratedSchedule = ScheduleDefinition & {
  metadata: GeneratedScheduleMetadata;
};

export type ScheduleView = ScheduleDefinition & {
  metadata?: GeneratedScheduleMetadata;
};

function getScheduleVisitIdFromDefinition(visitDefinition: VisitDefinition): string | undefined {
  const scheduleVisitId = visitDefinition.metadata?.scheduleVisitId;
  return typeof scheduleVisitId === 'string' ? scheduleVisitId : undefined;
}

function findLegacyScheduleVisit(
  document: ProtocolDocument,
  scheduleVisitId: string | undefined
): ScheduleVisit | undefined {
  if (!scheduleVisitId) {
    return undefined;
  }

  return document.schedule.visits.find((visit) => visit.id === scheduleVisitId);
}

function renderVisitTimepoint(document: ProtocolDocument, visitDefinition: VisitDefinition): string | undefined {
  const anchor = document.visitSchedule.anchors.find((item) => item.id === visitDefinition.anchorId);
  if (!anchor) {
    return undefined;
  }

  if (visitDefinition.nominalDay !== undefined) {
    const before = visitDefinition.windowBeforeDays;
    const after = visitDefinition.windowAfterDays;
    if (before !== undefined || after !== undefined) {
      const beforeText = before ?? 0;
      const afterText = after ?? 0;
      if (visitDefinition.nominalDay < 0) {
        return `Day ${visitDefinition.nominalDay - beforeText} to ${visitDefinition.nominalDay + afterText}`;
      }
    }
    return visitDefinition.nominalDay < 0
      ? `Day ${visitDefinition.nominalDay}`
      : `Day ${visitDefinition.nominalDay}`;
  }

  if (visitDefinition.offsetDays !== undefined) {
    if (visitDefinition.offsetDays === 0) {
      return anchor.name;
    }
    return `${anchor.name} +${visitDefinition.offsetDays}d`;
  }

  return anchor.name;
}

/** Maps a visit definition to the generated SoA column id (legacy schedule id when bridged). */
export function resolveGeneratedVisitColumnId(
  document: ProtocolDocument,
  visitDefinitionId: string
): string {
  const location = findVisitDefinitionInDocument(document, visitDefinitionId);
  if (!location) {
    return visitDefinitionId;
  }

  return getScheduleVisitIdFromDefinition(location.visitDefinition) ?? location.visitDefinition.id;
}

function getAssessmentRowKey(document: ProtocolDocument, ruleAssessmentId: string): string {
  const resolution = resolveAssessmentReference(document, ruleAssessmentId);
  if (resolution?.clinicalDesignAssessmentId) {
    return `clinicalDesign:${resolution.clinicalDesignAssessmentId}`;
  }

  if (resolution?.scheduleAssessmentId) {
    return `schedule:${resolution.scheduleAssessmentId}`;
  }

  return `raw:${ruleAssessmentId}`;
}

/** Maps a rule assessment reference to the generated SoA row id. */
export function resolveGeneratedAssessmentRowId(
  document: ProtocolDocument,
  ruleAssessmentId: string
): string {
  const resolution = resolveAssessmentReference(document, ruleAssessmentId);
  if (resolution?.scheduleAssessmentId) {
    return resolution.scheduleAssessmentId;
  }

  if (resolution?.clinicalDesignAssessmentId) {
    const scheduleRow = document.schedule.assessments.find(
      (assessment) => assessment.entityId === resolution.clinicalDesignAssessmentId
    );
    if (scheduleRow) {
      return scheduleRow.id;
    }
    return resolution.clinicalDesignAssessmentId;
  }

  return ruleAssessmentId;
}

function buildAssessmentRow(
  document: ProtocolDocument,
  ruleAssessmentId: string,
  outputId: string
): ScheduleAssessment {
  const resolution = resolveAssessmentReference(document, ruleAssessmentId);
  const scheduleAssessment =
    (resolution?.scheduleAssessmentId
      ? findScheduleAssessmentInDocument(document, resolution.scheduleAssessmentId)
      : null) ??
    findScheduleAssessmentInDocument(document, ruleAssessmentId) ??
    (resolution?.clinicalDesignAssessmentId
      ? document.schedule.assessments.find(
          (assessment) => assessment.entityId === resolution.clinicalDesignAssessmentId
        )
      : undefined) ??
    null;

  if (scheduleAssessment) {
    return {
      id: outputId,
      ...(scheduleAssessment.entityId ? { entityId: scheduleAssessment.entityId } : {}),
      label: scheduleAssessment.label,
      category: scheduleAssessment.category,
      ...(scheduleAssessment.linkedSectionId
        ? { linkedSectionId: scheduleAssessment.linkedSectionId }
        : {}),
    };
  }

  const clinicalDesignAssessment = document.clinicalDesign.assessments?.find(
    (assessment) =>
      assessment.id === resolution?.clinicalDesignAssessmentId || assessment.id === ruleAssessmentId
  );

  if (clinicalDesignAssessment) {
    return {
      id: outputId,
      entityId: clinicalDesignAssessment.id,
      label: clinicalDesignAssessment.name,
      category: 'Assessment',
      ...(clinicalDesignAssessment.sectionRef
        ? { linkedSectionId: clinicalDesignAssessment.sectionRef }
        : {}),
    };
  }

  return {
    id: outputId,
    label: ruleAssessmentId,
    category: 'Unknown',
  };
}

function generateVisits(document: ProtocolDocument): ScheduleVisit[] {
  const visitDefinitions = [...document.visitSchedule.visitDefinitions].sort(
    (left, right) => left.order - right.order
  );

  return visitDefinitions.map((visitDefinition) => {
    const scheduleVisitId = getScheduleVisitIdFromDefinition(visitDefinition);
    const legacyVisit = findLegacyScheduleVisit(document, scheduleVisitId);

    return {
      id: scheduleVisitId ?? visitDefinition.id,
      ...(visitDefinition.clinicalDesignVisitId
        ? { entityId: visitDefinition.clinicalDesignVisitId }
        : legacyVisit?.entityId
          ? { entityId: legacyVisit.entityId }
          : {}),
      label: legacyVisit?.label ?? visitDefinition.name,
      order: visitDefinition.order,
      timepoint: legacyVisit?.timepoint ?? renderVisitTimepoint(document, visitDefinition),
    };
  });
}

function generateAssessments(document: ProtocolDocument): ScheduleAssessment[] {
  const rules = document.assessmentScheduleRules ?? [];
  const rowsByKey = new Map<string, ScheduleAssessment>();

  for (const rule of rules) {
    const rowKey = getAssessmentRowKey(document, rule.assessmentId);
    if (rowsByKey.has(rowKey)) {
      continue;
    }

    const outputId = resolveGeneratedAssessmentRowId(document, rule.assessmentId);
    rowsByKey.set(rowKey, buildAssessmentRow(document, rule.assessmentId, outputId));
  }

  const scheduleOrder = new Map(
    document.schedule.assessments.map((assessment, index) => [assessment.id, index])
  );

  return [...rowsByKey.values()].sort((left, right) => {
    const leftOrder = scheduleOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = scheduleOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function generateCells(document: ProtocolDocument): ScheduleCell[] {
  return (document.assessmentScheduleRules ?? []).map((rule) => ({
    visitId: resolveGeneratedVisitColumnId(document, rule.visitDefinitionId),
    assessmentId: resolveGeneratedAssessmentRowId(document, rule.assessmentId),
    required: rule.required,
    ...(rule.timingNote ? { notes: rule.timingNote } : {}),
  }));
}

/** Generates a Schedule-like SoA matrix from visit definitions and assessment schedule rules. */
export function generateScheduleFromRules(document: ProtocolDocument): GeneratedSchedule {
  const rules = document.assessmentScheduleRules ?? [];
  const visitDefinitions = document.visitSchedule?.visitDefinitions ?? [];

  return {
    visits: generateVisits(document),
    assessments: generateAssessments(document),
    cells: generateCells(document),
    metadata: {
      generatedFromRules: true,
      generatedAt: new Date().toISOString(),
      sourceRuleCount: rules.length,
      sourceVisitDefinitionCount: visitDefinitions.length,
    },
  };
}
