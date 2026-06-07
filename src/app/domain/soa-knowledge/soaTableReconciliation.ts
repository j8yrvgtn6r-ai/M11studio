import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel } from './soaKnowledgePatch';
import type { SoAKnowledgeModel, SoAKnowledgePatch } from './soaKnowledgeTypes';
import { createTableDiagnostic, formatTableDiagnostics } from './soaTableDiagnostics';
import type { SoATableExtractionResult } from './soaTableExtractionTypes';
import { normalizeSoAName } from './soaKnowledgePatch';

export interface SoAReconciliationInput {
  narrativePatch: SoAKnowledgePatch;
  tableResult: SoATableExtractionResult;
  llmPatch?: SoAKnowledgePatch;
  protocolId?: string;
}

export interface SoAReconciliationResult {
  mergedPatch: SoAKnowledgePatch;
  mergedModel: SoAKnowledgeModel;
  diagnostics: string[];
  warnings: string[];
  conflictsCount: number;
  narrativeDerivedCount: number;
  tableDerivedCount: number;
  llmInferredCount: number;
}

function mergeEntitiesByName<T extends { name: string; id: string; sourceSectionIds: string[] }>(
  narrativeItems: T[],
  tableItems: T[],
  onDuplicate?: (narrative: T, table: T) => void,
): T[] {
  const map = new Map<string, T>();
  for (const item of narrativeItems) {
    map.set(normalizeSoAName(item.name), item);
  }
  for (const tableItem of tableItems) {
    const key = normalizeSoAName(tableItem.name);
    const existing = map.get(key);
    if (existing) {
      onDuplicate?.(existing, tableItem);
      map.set(key, {
        ...tableItem,
        id: existing.id,
        sourceSectionIds: [...new Set([...existing.sourceSectionIds, ...tableItem.sourceSectionIds])],
        inferenceSource: 'deterministic-table',
      });
      continue;
    }
    map.set(key, tableItem);
  }
  return [...map.values()];
}

function detectTimingConflict(
  narrativeRules: SoAKnowledgePatch['scheduleRules'],
  tableRules: SoAKnowledgePatch['scheduleRules'],
): number {
  let conflicts = 0;
  const tableByAssessment = new Map<string, Set<string>>();
  for (const rule of tableRules ?? []) {
    if (!rule.assessmentId || !rule.visitId) continue;
    const set = tableByAssessment.get(rule.assessmentId) ?? new Set<string>();
    set.add(rule.visitId);
    tableByAssessment.set(rule.assessmentId, set);
  }
  for (const rule of narrativeRules ?? []) {
    if (!rule.assessmentId || !rule.visitId) continue;
    const tableVisits = tableByAssessment.get(rule.assessmentId);
    if (!tableVisits) continue;
    if (!tableVisits.has(rule.visitId)) {
      conflicts += 1;
    }
  }
  return conflicts;
}

export function reconcileNarrativeAndTableSoAKnowledge(input: SoAReconciliationInput): SoAReconciliationResult {
  const diagnostics: string[] = [];
  const warnings: string[] = [];
  const tableDiagnostics = formatTableDiagnostics(input.tableResult.diagnostics);

  const duplicateAssessmentMessages: string[] = [];
  const duplicateVisitMessages: string[] = [];

  const mergedVisits = mergeEntitiesByName(
    input.narrativePatch.visits ?? [],
    input.tableResult.extractedVisits,
    (narrative, table) => {
      duplicateVisitMessages.push(
        createTableDiagnostic(
          'duplicateVisitMerged',
          `Merged duplicate visit "${narrative.name}" from narrative and table evidence.`,
        ).message,
      );
    },
  );

  const mergedAssessments = mergeEntitiesByName(
    input.narrativePatch.assessments ?? [],
    input.tableResult.extractedAssessments,
    (narrative, table) => {
      duplicateAssessmentMessages.push(
        createTableDiagnostic(
          'duplicateAssessmentMerged',
          `Merged duplicate assessment "${narrative.name}" from narrative and table evidence.`,
        ).message,
      );
    },
  );

  const narrativeOnlyAssessments = (input.narrativePatch.assessments ?? []).filter(
    (item) => !input.tableResult.extractedAssessments.some((table) => normalizeSoAName(table.name) === normalizeSoAName(item.name)),
  );
  if (narrativeOnlyAssessments.length > 0 && input.tableResult.extractedAssessments.length > 0) {
    diagnostics.push(
      createTableDiagnostic(
        'missingTableSupport',
        `${narrativeOnlyAssessments.length} narrative assessment(s) have no table support.`,
      ).message,
    );
  }

  const tableOnlyAssessments = input.tableResult.extractedAssessments.filter(
    (item) => !(input.narrativePatch.assessments ?? []).some((narrative) => normalizeSoAName(narrative.name) === normalizeSoAName(item.name)),
  );
  if (tableOnlyAssessments.length > 0) {
    diagnostics.push(
      createTableDiagnostic(
        'missingNarrativeSupport',
        `${tableOnlyAssessments.length} table assessment(s) have no narrative support.`,
      ).message,
    );
  }

  // Table evidence generally wins for schedule placement.
  const tableRuleKeys = new Set(
    input.tableResult.extractedScheduleRules.map((rule) => `${rule.assessmentId ?? ''}:${rule.visitId ?? ''}`),
  );
  const narrativeRules = (input.narrativePatch.scheduleRules ?? []).filter((rule) => {
    const key = `${rule.assessmentId ?? ''}:${rule.visitId ?? ''}`;
    if (tableRuleKeys.has(key)) {
      diagnostics.push(
        createTableDiagnostic(
          'tableNarrativeConflict',
          `Table schedule rule overrides narrative rule for ${rule.notes ?? key}.`,
        ).message,
      );
      return false;
    }
    return true;
  });

  const conflictsCount =
    detectTimingConflict(input.narrativePatch.scheduleRules, input.tableResult.extractedScheduleRules) +
    diagnostics.filter((entry) => entry.includes('tableNarrativeConflict')).length;

  const mergedPatch: SoAKnowledgePatch = {
    ...input.narrativePatch,
    visits: mergedVisits,
    assessments: mergedAssessments,
    scheduleRules: [...narrativeRules, ...input.tableResult.extractedScheduleRules],
    conditions: [...(input.narrativePatch.conditions ?? []), ...input.tableResult.extractedConditions],
    footnotes: [...(input.narrativePatch.footnotes ?? []), ...input.tableResult.extractedFootnotes],
    extractionNotes: [
      ...(input.narrativePatch.extractionNotes ?? []),
      ...tableDiagnostics,
      ...duplicateAssessmentMessages,
      ...duplicateVisitMessages,
    ],
    ambiguousScheduleStatements: input.narrativePatch.ambiguousScheduleStatements,
    unmappedTimingReferences: input.narrativePatch.unmappedTimingReferences,
    sourceSectionIds: [
      ...new Set([
        ...(input.narrativePatch.sourceSectionIds ?? []),
        ...input.tableResult.extractedVisits.flatMap((visit) => visit.sourceSectionIds),
        ...input.tableResult.extractedAssessments.flatMap((assessment) => assessment.sourceSectionIds),
      ]),
    ],
  };

  if (input.llmPatch) {
    mergedPatch.visits = mergeEntitiesByName(mergedPatch.visits ?? [], input.llmPatch.visits ?? []);
    mergedPatch.assessments = mergeEntitiesByName(mergedPatch.assessments ?? [], input.llmPatch.assessments ?? []);
    mergedPatch.scheduleRules = [...(mergedPatch.scheduleRules ?? []), ...(input.llmPatch.scheduleRules ?? [])];
  }

  const mergedModel = applySoAKnowledgePatch(createEmptySoAKnowledgeModel(input.protocolId), mergedPatch);

  return {
    mergedPatch,
    mergedModel,
    diagnostics: [...diagnostics, ...tableDiagnostics],
    warnings,
    conflictsCount,
    narrativeDerivedCount:
      (input.narrativePatch.visits?.length ?? 0) +
      (input.narrativePatch.assessments?.length ?? 0) +
      (input.narrativePatch.scheduleRules?.length ?? 0),
    tableDerivedCount:
      input.tableResult.extractedVisits.length +
      input.tableResult.extractedAssessments.length +
      input.tableResult.extractedScheduleRules.length,
    llmInferredCount:
      (input.llmPatch?.visits?.length ?? 0) +
      (input.llmPatch?.assessments?.length ?? 0) +
      (input.llmPatch?.scheduleRules?.length ?? 0),
  };
}
