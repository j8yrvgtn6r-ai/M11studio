import type {

  ProtocolDocument,

  ScheduleAssessment,

  ScheduleCell,

  ScheduleDefinition,

  ScheduleVisit,

  SoAAssessmentDefinition,

  VisitDefinition,

} from '../types';

import { resolveAssessmentReference } from '../assessmentScheduleRule/assessmentRefs';

import {

  findSoAAssessmentDefinitionInDocument,

  selectSoAAssessmentDefinitions,

} from '../soaAssessmentDefinition/lookup';

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



function resolveSoAColumnId(visitDefinition: VisitDefinition): string {

  if (visitDefinition.soaColumnId?.trim()) {

    return visitDefinition.soaColumnId;

  }



  const metadataScheduleVisitId = visitDefinition.metadata?.scheduleVisitId;

  if (typeof metadataScheduleVisitId === 'string' && metadataScheduleVisitId.trim()) {

    return metadataScheduleVisitId;

  }



  return visitDefinition.id;

}



function resolveGeneratedVisitLabel(visitDefinition: VisitDefinition): string {

  return visitDefinition.displayLabel?.trim() || visitDefinition.name;

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



function resolveGeneratedVisitTimepoint(

  document: ProtocolDocument,

  visitDefinition: VisitDefinition

): string | undefined {

  if (visitDefinition.timepointDisplay?.trim()) {

    return visitDefinition.timepointDisplay;

  }



  return renderVisitTimepoint(document, visitDefinition);

}



/** Maps a visit definition to the generated SoA column id. */

export function resolveGeneratedVisitColumnId(

  document: ProtocolDocument,

  visitDefinitionId: string

): string {

  const location = findVisitDefinitionInDocument(document, visitDefinitionId);

  if (!location) {

    return visitDefinitionId;

  }



  return resolveSoAColumnId(location.visitDefinition);

}



function resolveGeneratedLinkedSectionId(definition: SoAAssessmentDefinition): string | undefined {

  const legacyLinkedSectionRef = definition.metadata?.legacyLinkedSectionRef;

  if (typeof legacyLinkedSectionRef === 'string' && legacyLinkedSectionRef.trim()) {

    return legacyLinkedSectionRef;

  }



  return definition.linkedSectionId;

}



function buildAssessmentRowFromDefinition(

  definition: SoAAssessmentDefinition,

  outputId: string

): ScheduleAssessment {

  const linkedSectionId = resolveGeneratedLinkedSectionId(definition);



  return {

    id: outputId,

    label: definition.label,

    category: definition.category,

    ...(definition.clinicalDesignAssessmentId ? { entityId: definition.clinicalDesignAssessmentId } : {}),

    ...(linkedSectionId ? { linkedSectionId } : {}),

  };

}



function getAssessmentRowKey(document: ProtocolDocument, ruleAssessmentId: string): string {

  const resolution = resolveAssessmentReference(document, ruleAssessmentId);

  if (resolution?.clinicalDesignAssessmentId) {

    return `clinicalDesign:${resolution.clinicalDesignAssessmentId}`;

  }



  if (resolution?.soaAssessmentDefinitionId) {

    return `soaAssessment:${resolution.soaAssessmentDefinitionId}`;

  }



  if (resolution?.scheduleAssessmentId) {

    return `soaAssessment:${resolution.scheduleAssessmentId}`;

  }



  return `raw:${ruleAssessmentId}`;

}



/** Maps a rule assessment reference to the generated SoA row id. */

export function resolveGeneratedAssessmentRowId(

  document: ProtocolDocument,

  ruleAssessmentId: string

): string {

  const resolution = resolveAssessmentReference(document, ruleAssessmentId);

  if (resolution?.soaAssessmentDefinitionId) {

    return resolution.soaAssessmentDefinitionId;

  }



  if (resolution?.scheduleAssessmentId) {

    return resolution.scheduleAssessmentId;

  }



  if (resolution?.clinicalDesignAssessmentId) {

    const soaAssessmentDefinition = selectSoAAssessmentDefinitions(document).find(

      (definition) => definition.clinicalDesignAssessmentId === resolution.clinicalDesignAssessmentId

    );

    if (soaAssessmentDefinition) {

      return soaAssessmentDefinition.id;

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

  const catalogId = resolution?.soaAssessmentDefinitionId ?? resolution?.scheduleAssessmentId ?? ruleAssessmentId;

  const catalogLocation = findSoAAssessmentDefinitionInDocument(document, catalogId);



  if (catalogLocation) {

    return buildAssessmentRowFromDefinition(catalogLocation.soaAssessmentDefinition, outputId);

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



  return visitDefinitions.map((visitDefinition) => ({

    id: resolveSoAColumnId(visitDefinition),

    ...(visitDefinition.clinicalDesignVisitId

      ? { entityId: visitDefinition.clinicalDesignVisitId }

      : {}),

    label: resolveGeneratedVisitLabel(visitDefinition),

    order: visitDefinition.order,

    timepoint: resolveGeneratedVisitTimepoint(document, visitDefinition),

  }));

}



function generateAssessments(document: ProtocolDocument): ScheduleAssessment[] {

  const rules = document.assessmentScheduleRules ?? [];

  const rowsByKey = new Map<string, ScheduleAssessment>();

  const orderByCatalogId = new Map(

    selectSoAAssessmentDefinitions(document).map((definition) => [definition.id, definition.order])

  );



  for (const rule of rules) {

    const rowKey = getAssessmentRowKey(document, rule.assessmentId);

    if (rowsByKey.has(rowKey)) {

      continue;

    }



    const outputId = resolveGeneratedAssessmentRowId(document, rule.assessmentId);

    rowsByKey.set(rowKey, buildAssessmentRow(document, rule.assessmentId, outputId));

  }



  return [...rowsByKey.values()].sort((left, right) => {

    const leftOrder = orderByCatalogId.get(left.id) ?? Number.MAX_SAFE_INTEGER;

    const rightOrder = orderByCatalogId.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {

      return leftOrder - rightOrder;

    }

    return left.id.localeCompare(right.id);

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



/** Compares generated schedule content ignoring generation metadata timestamps. */

export function generatedScheduleContentEquals(

  left: Pick<ScheduleDefinition, 'visits' | 'assessments' | 'cells'>,

  right: Pick<ScheduleDefinition, 'visits' | 'assessments' | 'cells'>

): boolean {

  return (

    JSON.stringify(left.visits) === JSON.stringify(right.visits) &&

    JSON.stringify(left.assessments) === JSON.stringify(right.assessments) &&

    JSON.stringify(sortGeneratedCells(left.cells)) === JSON.stringify(sortGeneratedCells(right.cells))

  );

}



function sortGeneratedCells(cells: ScheduleCell[]): ScheduleCell[] {

  return [...cells].sort((left, right) => {

    const visitCompare = left.visitId.localeCompare(right.visitId);

    if (visitCompare !== 0) {

      return visitCompare;

    }

    return left.assessmentId.localeCompare(right.assessmentId);

  });

}



/** Verifies generation does not depend on legacy schedule visit/assessment metadata. */

export function verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata(

  document: ProtocolDocument

): boolean {

  const baseline = generateScheduleFromRules(document);

  const independentDocument: ProtocolDocument = structuredClone(document);

  independentDocument.schedule.visits = [];

  independentDocument.schedule.assessments = [];



  const independent = generateScheduleFromRules(independentDocument);



  return generatedScheduleContentEquals(baseline, independent);

}


