import type { CoreStudyModel } from '../domain/protocol/import/coreStudyModel';
import type { ProtocolDocument } from '../domain/protocol/types';
import type { KnowledgeGraph } from '../domain/knowledge-graph/knowledgeGraphTypes';
import type { StudyModel } from '../domain/study-model/studyModelTypes';
import type { CanonicalDocument } from '../domain/document-ingestion/canonicalDocumentTypes';
import type { ExtractedTable } from '../domain/protocol/import/types';
import {
  buildSoAKnowledgeFromProtocolSections,
  compareSoAKnowledgeToExistingConfiguration,
} from '../domain/soa-knowledge/soaKnowledgeBuilder';
import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel } from '../domain/soa-knowledge/soaKnowledgePatch';
import { buildProposedConfigurationPatch } from '../domain/soa-knowledge/soaConfigurationPatch';
import {
  createSoANarrativeImpactRecord,
  getNarrativeSectionsImpactedBySoAChange,
} from '../domain/soa-knowledge/soaKnowledgeNarrativeSync';
import type { SoAProposal, SoAAgentTrigger } from '../domain/soa-knowledge/soaProposalTypes';
import type {
  SoAMatrixProposalPreview,
  SoAProposalSourceSummary,
  SoATableExtractionResult,
} from '../domain/soa-knowledge/soaTableExtractionTypes';
import { buildMatrixProposalPreview, extractSoATablesFromCanonicalDocument } from '../domain/soa-knowledge/soaTableExtractor';
import { reconcileNarrativeAndTableSoAKnowledge } from '../domain/soa-knowledge/soaTableReconciliation';
import type {
  SoAAssessment,
  SoAAssessmentCategory,
  SoAKnowledgeModel,
  SoAKnowledgePatch,
  SoAProtocolSectionInput,
  SoAScheduleRule,
  SoAVisit,
} from '../domain/soa-knowledge/soaKnowledgeTypes';

export type { SoAAgentTrigger };

export interface SoAAgentProtocolSection {
  sectionId: string;
  title: string;
  text: string;
}

export interface SoAAgentInput {
  protocolSections: SoAAgentProtocolSection[];
  selectedSectionId?: string;
  soaKnowledgeModel?: SoAKnowledgeModel | null;
  knowledgeGraph?: KnowledgeGraph | null;
  coreStudyModel?: CoreStudyModel | null;
  studyModel?: StudyModel | null;
  existingSoAConfiguration?: ProtocolDocument;
  canonicalDocument?: CanonicalDocument | null;
  extractedTables?: ExtractedTable[];
  trigger: SoAAgentTrigger;
  changedSectionIds?: string[];
  changedSoAEntityIds?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface SoAExtractedItem {
  kind: 'arm' | 'epoch' | 'element' | 'visit' | 'activity' | 'assessment' | 'procedure' | 'timingWindow' | 'scheduleRule' | 'condition' | 'footnote';
  id: string;
  name: string;
  sectionId?: string;
  category?: SoAAssessmentCategory;
}

export interface SoAAgentOutput {
  soaKnowledgePatch: SoAKnowledgePatch;
  proposedConfigurationPatch?: ReturnType<typeof buildProposedConfigurationPatch>;
  extractedItems: SoAExtractedItem[];
  proposedScheduleRules: SoAScheduleRule[];
  impactedNarrativeSections: Array<{ sectionId: string; reason: string }>;
  diagnostics: string[];
  warnings: string[];
  skippedItems: string[];
  summary: string;
  tableExtraction?: SoATableExtractionResult;
  matrixPreview?: SoAMatrixProposalPreview;
  sourceSummary?: SoAProposalSourceSummary;
}

const EXTRA_ASSESSMENT_PATTERNS: Array<{ pattern: RegExp; name: string; category: SoAAssessmentCategory }> = [
  { pattern: /\btumor imaging\b/gi, name: 'Tumor Imaging', category: 'imaging' },
  { pattern: /\bhematology\b/gi, name: 'Hematology', category: 'laboratory' },
  { pattern: /\bchemistry\b/gi, name: 'Chemistry', category: 'laboratory' },
  { pattern: /\bpk sampling\b/gi, name: 'PK Sampling', category: 'pk' },
];

const EXTRA_VISIT_PATTERNS: RegExp[] = [
  /\b(end of treatment)\b/gi,
  /\b(end of study)\b/gi,
  /\b(tumor assessment visit[s]?)\b/gi,
];

const INTERVAL_TIMING_PATTERN = /\bevery\s+(\d+)\s+(weeks?|days?|months?|cycles?)\b/gi;

function slugId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}`;
}

function mergeUniqueByName<T extends { name: string }>(items: T[], incoming: T[]): T[] {
  const map = new Map(items.map((item) => [item.name.toLowerCase().trim(), item]));
  for (const item of incoming) {
    const key = item.name.toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function extractExtraVisits(sections: SoAProtocolSectionInput[]): SoAVisit[] {
  const visits: SoAVisit[] = [];
  let order = 0;
  for (const section of sections) {
    for (const pattern of EXTRA_VISIT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(section.text)) !== null) {
        const name = match[1]?.trim() ?? match[0]?.trim();
        if (!name) continue;
        visits.push({
          id: slugId('visit', name),
          name: name.replace(/\b\w/g, (char, index) => (index === 0 ? char.toUpperCase() : char)),
          order: order++,
          sourceSectionIds: [section.sectionId],
        });
      }
    }
  }
  return visits;
}

function extractExtraAssessments(sections: SoAProtocolSectionInput[]): SoAAssessment[] {
  const assessments: SoAAssessment[] = [];
  for (const section of sections) {
    for (const entry of EXTRA_ASSESSMENT_PATTERNS) {
      entry.pattern.lastIndex = 0;
      if (!entry.pattern.test(section.text)) continue;
      assessments.push({
        id: slugId('assessment', entry.name),
        name: entry.name,
        category: entry.category,
        sourceSectionIds: [section.sectionId],
      });
    }
  }
  return assessments;
}

function extractIntervalDiagnostics(sections: SoAProtocolSectionInput[]): string[] {
  const diagnostics: string[] = [];
  for (const section of sections) {
    INTERVAL_TIMING_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INTERVAL_TIMING_PATTERN.exec(section.text)) !== null) {
      diagnostics.push(
        `${section.sectionId}: Interval timing "${match[0].trim()}" recorded — schedule rule not inferred without explicit visit linkage.`,
      );
    }
  }
  return diagnostics;
}

function modelToPatch(model: SoAKnowledgeModel): SoAKnowledgePatch {
  return {
    protocolId: model.protocolId,
    arms: model.arms,
    epochs: model.epochs,
    elements: model.elements,
    visits: model.visits,
    activities: model.activities,
    assessments: model.assessments,
    procedures: model.procedures,
    timingWindows: model.timingWindows,
    scheduleRules: model.scheduleRules,
    conditions: model.conditions,
    footnotes: model.footnotes,
    sourceSectionIds: model.sourceSectionIds,
    extractionNotes: model.extractionNotes,
    unmappedTimingReferences: model.unmappedTimingReferences,
    ambiguousScheduleStatements: model.ambiguousScheduleStatements,
  };
}

function collectExtractedItems(model: SoAKnowledgeModel): SoAExtractedItem[] {
  const items: SoAExtractedItem[] = [];
  for (const visit of model.visits) {
    items.push({ kind: 'visit', id: visit.id, name: visit.name, sectionId: visit.sourceSectionIds[0] });
  }
  for (const assessment of model.assessments) {
    items.push({
      kind: 'assessment',
      id: assessment.id,
      name: assessment.name,
      sectionId: assessment.sourceSectionIds[0],
      category: assessment.category,
    });
  }
  for (const rule of model.scheduleRules) {
    items.push({
      kind: 'scheduleRule',
      id: rule.id,
      name: rule.notes ?? `${rule.assessmentId ?? 'assessment'} → ${rule.visitId ?? 'visit'}`,
      sectionId: rule.sourceSectionIds[0],
    });
  }
  for (const condition of model.conditions) {
    items.push({ kind: 'condition', id: condition.id, name: condition.label, sectionId: condition.sourceSectionIds[0] });
  }
  return items;
}

function buildImpactedNarrativeSections(model: SoAKnowledgeModel): Array<{ sectionId: string; reason: string }> {
  const sections = new Map<string, string>();

  if (model.scheduleRules.length > 0 || model.assessments.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'assessmentSchedule' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'assessmentSchedule' }).reasons[sectionId] ?? 'Assessment schedule may require narrative review.');
    }
  }
  if (model.visits.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'visitTiming' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'visitTiming' }).reasons[sectionId] ?? 'Visit timing may require narrative review.');
    }
  }
  if (model.activities.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'interventionActivity' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'interventionActivity' }).reasons[sectionId] ?? 'Intervention activity may require narrative review.');
    }
  }

  return [...sections.entries()].map(([sectionId, reason]) => ({ sectionId, reason }));
}

export function evaluateSoAScheduleExtraction(input: SoAAgentInput): SoAAgentOutput {
  const sections: SoAProtocolSectionInput[] = (input.protocolSections ?? []).map((section) => ({
    sectionId: section.sectionId,
    title: section.title,
    text: section.text ?? '',
  }));

  const protocolId = input.existingSoAConfiguration?.id ?? input.soaKnowledgeModel?.protocolId;

  if (sections.every((section) => !section.text.trim()) && !(input.extractedTables?.length ?? 0)) {
    return {
      soaKnowledgePatch: {},
      extractedItems: [],
      proposedScheduleRules: [],
      impactedNarrativeSections: [],
      diagnostics: ['No schedule-related narrative text or DOCX tables available — empty proposal created safely.'],
      warnings: [],
      skippedItems: [],
      summary: 'No schedule content found',
      tableExtraction: {
        candidateTables: [],
        extractedVisits: [],
        extractedAssessments: [],
        extractedScheduleRules: [],
        extractedFootnotes: [],
        extractedConditions: [],
        diagnostics: [],
        warnings: [],
        cellEvidence: [],
      },
      matrixPreview: { rows: [], columns: [], cells: [] },
      sourceSummary: {
        narrativeDerivedCount: 0,
        tableDerivedCount: 0,
        llmInferredCount: 0,
        conflictsCount: 0,
        diagnosticsCount: 1,
      },
    };
  }

  const extracted = buildSoAKnowledgeFromProtocolSections(sections, protocolId);
  const extraVisits = extractExtraVisits(sections);
  const extraAssessments = extractExtraAssessments(sections);
  const intervalDiagnostics = extractIntervalDiagnostics(sections);

  const narrativeModel = applySoAKnowledgePatch(createEmptySoAKnowledgeModel(protocolId), {
    ...modelToPatch(extracted),
    visits: mergeUniqueByName(extracted.visits, extraVisits),
    assessments: mergeUniqueByName(extracted.assessments, extraAssessments),
    extractionNotes: [
      ...extracted.extractionNotes,
      ...(intervalDiagnostics.length > 0 ? ['Interval timing captured as diagnostics only.'] : []),
    ],
    ambiguousScheduleStatements: [
      ...extracted.ambiguousScheduleStatements,
      ...intervalDiagnostics.filter((entry) => entry.includes('Interval timing')),
    ],
  });

  const tableExtraction =
    input.canonicalDocument && input.extractedTables
      ? extractSoATablesFromCanonicalDocument({
          document: input.canonicalDocument,
          tables: input.extractedTables,
          protocolId,
        })
      : {
          candidateTables: [],
          extractedVisits: [],
          extractedAssessments: [],
          extractedScheduleRules: [],
          extractedFootnotes: [],
          extractedConditions: [],
          diagnostics: [],
          warnings: input.extractedTables?.length
            ? ['Canonical document unavailable — table extraction skipped.']
            : [],
          cellEvidence: [],
        };

  const reconciliation = reconcileNarrativeAndTableSoAKnowledge({
    narrativePatch: modelToPatch(narrativeModel),
    tableResult: tableExtraction,
    protocolId,
  });

  let mergedModel = reconciliation.mergedModel;
  if (input.soaKnowledgeModel) {
    mergedModel = applySoAKnowledgePatch(input.soaKnowledgeModel, modelToPatch(mergedModel));
  }

  const comparison = compareSoAKnowledgeToExistingConfiguration(
    mergedModel,
    input.existingSoAConfiguration,
  );
  const warnings: string[] = [...reconciliation.warnings];
  if (comparison.unmatchedKnowledgeAssessments.length > 0) {
    warnings.push(
      `${comparison.unmatchedKnowledgeAssessments.length} proposed assessment(s) are not yet in SoA Configuration.`,
    );
  }

  const configurationPatch = buildProposedConfigurationPatch(mergedModel, input.existingSoAConfiguration);
  if (configurationPatch.notes?.length) {
    warnings.push(...configurationPatch.notes);
  }

  const patch = modelToPatch(mergedModel);
  const matrixPreview = buildMatrixProposalPreview(tableExtraction);
  const sourceSummary: SoAProposalSourceSummary = {
    narrativeDerivedCount: reconciliation.narrativeDerivedCount,
    tableDerivedCount: reconciliation.tableDerivedCount,
    llmInferredCount: reconciliation.llmInferredCount,
    conflictsCount: reconciliation.conflictsCount,
    diagnosticsCount: reconciliation.diagnostics.length + tableExtraction.diagnostics.length,
  };

  const summary = `${mergedModel.visits.length} visits, ${mergedModel.assessments.length} assessments, ${mergedModel.scheduleRules.length} schedule rules proposed (${sourceSummary.tableDerivedCount} table-derived)`;

  return {
    soaKnowledgePatch: patch,
    proposedConfigurationPatch: configurationPatch,
    extractedItems: collectExtractedItems(mergedModel),
    proposedScheduleRules: mergedModel.scheduleRules,
    impactedNarrativeSections: buildImpactedNarrativeSections(mergedModel),
    diagnostics: [
      ...mergedModel.extractionNotes,
      ...mergedModel.unmappedTimingReferences,
      ...mergedModel.ambiguousScheduleStatements,
      ...reconciliation.diagnostics,
    ],
    warnings,
    skippedItems: comparison.unmatchedConfigurationAssessments.map(
      (name) => `Existing configuration assessment not extracted from narrative: ${name}`,
    ),
    summary,
    tableExtraction,
    matrixPreview,
    sourceSummary,
  };
}

export function countSoAKnowledgePatch(patch: SoAKnowledgePatch): SoAProposal['counts'] {
  return {
    arms: patch.arms?.length ?? 0,
    epochs: patch.epochs?.length ?? 0,
    elements: patch.elements?.length ?? 0,
    visits: patch.visits?.length ?? 0,
    activities: patch.activities?.length ?? 0,
    assessments: patch.assessments?.length ?? 0,
    scheduleRules: patch.scheduleRules?.length ?? 0,
    conditions: patch.conditions?.length ?? 0,
    footnotes: patch.footnotes?.length ?? 0,
  };
}
