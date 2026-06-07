import type { CanonicalDocument } from '../document-ingestion/canonicalDocumentTypes';
import type { ExtractedTable } from '../protocol/import/types';
import type {
  SoAAssessment,
  SoACondition,
  SoAFootnote,
  SoAScheduleRule,
  SoAVisit,
} from './soaKnowledgeTypes';
import { createTableDiagnostic, formatTableDiagnostics } from './soaTableDiagnostics';
import {
  classifyCellMarker,
  inferTableRole,
  isScheduleHeading,
  normalizeTableCell,
  normalizeTableGrid,
  parseRecurringVisitLabel,
  scoreAssessmentLabel,
  scoreVisitLabel,
  slugTableEntity,
} from './soaTableNormalizer';
import type {
  SoATableCandidate,
  SoATableCellEvidence,
  SoATableExtractionResult,
  SoAMatrixProposalPreview,
} from './soaTableExtractionTypes';

function collectHeadingContext(document: CanonicalDocument, tableBlockIndex: number): string[] {
  const headings: string[] = [];
  for (let index = tableBlockIndex - 1; index >= 0 && headings.length < 4; index -= 1) {
    const block = document.blocks[index];
    if (!block) break;
    if (block.type === 'heading') {
      headings.unshift(block.text);
    }
    if (block.type === 'table') {
      break;
    }
  }
  return headings;
}

function resolveSourceSectionId(document: CanonicalDocument, tableBlockIndex: number): string | undefined {
  for (const section of document.sections) {
    if (tableBlockIndex >= section.startBlockIndex && tableBlockIndex <= section.endBlockIndex) {
      return section.id;
    }
  }
  return document.sections[0]?.id;
}

function mergeUniqueVisits(visits: SoAVisit[]): SoAVisit[] {
  const map = new Map<string, SoAVisit>();
  for (const visit of visits) {
    const key = visit.name.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, visit);
      continue;
    }
    map.set(key, {
      ...existing,
      sourceSectionIds: [...new Set([...existing.sourceSectionIds, ...visit.sourceSectionIds])],
      window: existing.window ?? visit.window,
    });
  }
  return [...map.values()];
}

function mergeUniqueAssessments(assessments: SoAAssessment[]): SoAAssessment[] {
  const map = new Map<string, SoAAssessment>();
  for (const assessment of assessments) {
    const key = assessment.name.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, assessment);
      continue;
    }
    map.set(key, {
      ...existing,
      sourceSectionIds: [...new Set([...existing.sourceSectionIds, ...assessment.sourceSectionIds])],
      category: existing.category ?? assessment.category,
    });
  }
  return [...map.values()];
}

function inferAssessmentCategory(name: string): SoAAssessment['category'] {
  const lower = name.toLowerCase();
  if (/vital/.test(lower)) return 'vitalSigns';
  if (/physical exam/.test(lower)) return 'physicalExam';
  if (/hematology|chemistry|lab/.test(lower)) return 'laboratory';
  if (/imaging|tumor/.test(lower)) return 'imaging';
  if (/adverse|ae/.test(lower)) return 'adverseEvents';
  if (/con(?:comitant)? med/.test(lower)) return 'concomitantMedication';
  if (/pk/.test(lower)) return 'pk';
  if (/ecg|safety/.test(lower)) return 'safety';
  return 'other';
}

function detectHeaderRowCount(normalizedCells: string[][]): number {
  if (normalizedCells.length === 0) {
    return 0;
  }
  const firstCell = normalizeTableCell(normalizedCells[0][0]);
  if (/assessment|procedure|activity|visit/i.test(firstCell)) {
    return 1;
  }
  return normalizedCells.length > 1 && scoreVisitLabel(firstCell) > 0 ? 0 : 1;
}

function extractScheduleFromCandidate(
  candidate: SoATableCandidate,
  protocolId?: string,
): Pick<
  SoATableExtractionResult,
  'extractedVisits' | 'extractedAssessments' | 'extractedScheduleRules' | 'extractedConditions' | 'extractedFootnotes' | 'cellEvidence' | 'diagnostics'
> {
  const diagnostics = candidate.rawCells.length === 0
    ? [createTableDiagnostic('malformedTable', 'Table has no rows.', { tableId: candidate.id })]
    : [];

  const extractedVisits: SoAVisit[] = [];
  const extractedAssessments: SoAAssessment[] = [];
  const extractedScheduleRules: SoAScheduleRule[] = [];
  const extractedConditions: SoACondition[] = [];
  const extractedFootnotes: SoAFootnote[] = [];
  const cellEvidence: SoATableCellEvidence[] = [];

  if (candidate.tableRole === 'unknown' || candidate.normalizedCells.length < 2) {
    return {
      extractedVisits,
      extractedAssessments,
      extractedScheduleRules,
      extractedConditions,
      extractedFootnotes,
      cellEvidence,
      diagnostics,
    };
  }

  const grid = candidate.normalizedCells;
  const headerRowCount = detectHeaderRowCount(grid);
  const headerRows = grid.slice(0, headerRowCount);
  const dataRows = grid.slice(headerRowCount);
  const columnLabels = headerRows[headerRows.length - 1] ?? grid[0] ?? [];
  const firstColumnIsAssessment = dataRows.every((row) => scoreAssessmentLabel(row[0] ?? '') >= scoreVisitLabel(row[0] ?? ''));

  if (!firstColumnIsAssessment) {
    diagnostics.push(
      createTableDiagnostic('ambiguousVisitColumn', 'Could not determine assessment row labels in first column.', {
        tableId: candidate.id,
      }),
    );
  }

  let visitOrder = 0;
  for (let columnIndex = 1; columnIndex < columnLabels.length; columnIndex += 1) {
    const rawLabel = normalizeTableCell(columnLabels[columnIndex]);
    if (!rawLabel || /^assessment|procedure|activity/i.test(rawLabel)) {
      continue;
    }
    if (scoreVisitLabel(rawLabel) === 0 && !/every/i.test(rawLabel)) {
      diagnostics.push(
        createTableDiagnostic('ambiguousVisitColumn', `Column "${rawLabel}" is not a recognized visit label.`, {
          tableId: candidate.id,
          columnIndex,
        }),
      );
      continue;
    }
    const parsed = parseRecurringVisitLabel(rawLabel);
    const visitId = slugTableEntity('visit', parsed.name);
    extractedVisits.push({
      id: visitId,
      name: parsed.name,
      window: parsed.window,
      order: visitOrder++,
      sourceSectionIds: candidate.sourceSectionId ? [candidate.sourceSectionId] : [],
      inferenceSource: 'deterministic-table',
      evidence: [
        {
          sectionId: candidate.sourceSectionId ?? 'table',
          sourceText: rawLabel,
          reason: `Visit column header in table ${candidate.id}`,
        },
      ],
    });
  }

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const row = dataRows[rowIndex];
    const assessmentName = normalizeTableCell(row[0]);
    if (!assessmentName || scoreAssessmentLabel(assessmentName) === 0) {
      continue;
    }
    const assessmentId = slugTableEntity('assessment', assessmentName);
    extractedAssessments.push({
      id: assessmentId,
      name: assessmentName,
      category: inferAssessmentCategory(assessmentName),
      sourceSectionIds: candidate.sourceSectionId ? [candidate.sourceSectionId] : [],
      inferenceSource: 'deterministic-table',
      evidence: [
        {
          sectionId: candidate.sourceSectionId ?? 'table',
          sourceText: assessmentName,
          reason: `Assessment row label in table ${candidate.id}`,
        },
      ],
    });

    for (let columnIndex = 1; columnIndex < row.length; columnIndex += 1) {
      const visitLabel = normalizeTableCell(columnLabels[columnIndex]);
      if (!visitLabel) continue;
      const cellText = normalizeTableCell(row[columnIndex]);
      const marker = classifyCellMarker(cellText);
      if (!marker.required && !marker.optional && !marker.ambiguous) {
        continue;
      }
      if (marker.ambiguous) {
        diagnostics.push(
          createTableDiagnostic('ambiguousMarker', `Ambiguous marker "${cellText}" at assessment "${assessmentName}".`, {
            tableId: candidate.id,
            rowIndex: rowIndex + headerRows.length,
            columnIndex,
          }),
        );
      }

      const parsedVisit = parseRecurringVisitLabel(visitLabel);
      const visitId = slugTableEntity('visit', parsedVisit.name);
      const evidence: SoATableCellEvidence = {
        tableId: candidate.id,
        rowIndex: rowIndex + headerRows.length,
        columnIndex,
        sourceCellText: cellText || 'X',
        headingContext: candidate.headingContext,
        sourceSectionId: candidate.sourceSectionId,
      };
      cellEvidence.push(evidence);

      let conditionId: string | undefined;
      if (marker.condition) {
        conditionId = slugTableEntity('condition', marker.condition);
        extractedConditions.push({
          id: conditionId,
          label: marker.condition,
          description: marker.condition,
          sourceSectionIds: candidate.sourceSectionId ? [candidate.sourceSectionId] : [],
          inferenceSource: 'deterministic-table',
          evidence: [
            {
              sectionId: candidate.sourceSectionId ?? 'table',
              sourceText: cellText,
              reason: `Conditional schedule marker in table ${candidate.id}`,
            },
          ],
        });
      }

      extractedScheduleRules.push({
        id: slugTableEntity('rule', `${assessmentId}-${visitId}-${rowIndex}-${columnIndex}`),
        assessmentId,
        visitId,
        conditionId,
        required: marker.required,
        sourceSectionIds: candidate.sourceSectionId ? [candidate.sourceSectionId] : [],
        notes: `${assessmentName} scheduled at ${parsedVisit.name}`,
        inferenceSource: 'deterministic-table',
        evidence: [
          {
            sectionId: candidate.sourceSectionId ?? 'table',
            sourceText: `${assessmentName} / ${parsedVisit.name}: ${cellText || 'X'}`,
            reason: `Table cell (${evidence.rowIndex + 1}, ${evidence.columnIndex + 1}) in ${candidate.id}`,
          },
        ],
      });
    }
  }

  void protocolId;
  return {
    extractedVisits: mergeUniqueVisits(extractedVisits),
    extractedAssessments: mergeUniqueAssessments(extractedAssessments),
    extractedScheduleRules,
    extractedConditions,
    extractedFootnotes,
    cellEvidence,
    diagnostics,
  };
}

export function extractSoATablesFromCanonicalDocument(options: {
  document: CanonicalDocument;
  tables: ExtractedTable[];
  protocolId?: string;
}): SoATableExtractionResult {
  const { document, tables, protocolId } = options;
  const candidateTables: SoATableCandidate[] = [];
  const diagnostics: SoATableExtractionResult['diagnostics'] = [];
  const warnings: string[] = [];

  if (tables.length === 0) {
    diagnostics.push(createTableDiagnostic('noScheduleTables', 'No DOCX tables available for schedule extraction.'));
    return {
      candidateTables: [],
      extractedVisits: [],
      extractedAssessments: [],
      extractedScheduleRules: [],
      extractedFootnotes: [],
      extractedConditions: [],
      diagnostics,
      warnings,
      cellEvidence: [],
    };
  }

  const tableBlocks = document.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'table');

  for (const table of tables) {
    const blockEntry =
      tableBlocks.find(({ block }) => block.id === `block-table-${table.index}`) ??
      tableBlocks[table.index % Math.max(tableBlocks.length, 1)];
    const blockIndex = blockEntry?.index ?? document.blocks.length;
    const headingContext = collectHeadingContext(document, blockIndex);
    const sourceSectionId = resolveSourceSectionId(document, blockIndex);
    const { normalizedCells, diagnostics: normalizationDiagnostics } = normalizeTableGrid(table.rows);
    const { role, confidenceReason } = inferTableRole(headingContext, normalizedCells);
    const scheduleHeadingNearby = headingContext.some(isScheduleHeading);

    if (role === 'unknown' && !scheduleHeadingNearby) {
      continue;
    }

    candidateTables.push({
      id: `table-${table.index}`,
      sourceSectionId,
      headingContext,
      rowCount: normalizedCells.length,
      columnCount: Math.max(...normalizedCells.map((row) => row.length), 0),
      tableRole: scheduleHeadingNearby && role === 'unknown' ? 'scheduleOfActivities' : role,
      confidenceReason: scheduleHeadingNearby
        ? `${confidenceReason} Nearby schedule heading detected.`
        : confidenceReason,
      rawCells: table.rows,
      normalizedCells,
    });

    if (normalizationDiagnostics.some((entry) => /merged cell/i.test(entry))) {
      diagnostics.push(
        createTableDiagnostic('mergedCellUnavailable', 'Merged cell structure not available; normalized best effort.', {
          tableId: `table-${table.index}`,
          sectionId: sourceSectionId,
        }),
      );
    }
  }

  if (candidateTables.length === 0) {
    diagnostics.push(createTableDiagnostic('noScheduleTables', 'No SoA-like schedule tables detected in canonical document.'));
  }

  const aggregated: SoATableExtractionResult = {
    candidateTables,
    extractedVisits: [],
    extractedAssessments: [],
    extractedScheduleRules: [],
    extractedFootnotes: [],
    extractedConditions: [],
    diagnostics,
    warnings,
    cellEvidence: [],
  };

  for (const candidate of candidateTables) {
    if (candidate.tableRole === 'unknown') {
      warnings.push(`Table ${candidate.id} skipped — role unknown.`);
      continue;
    }
    const partial = extractScheduleFromCandidate(candidate, protocolId);
    aggregated.extractedVisits = mergeUniqueVisits([...aggregated.extractedVisits, ...partial.extractedVisits]);
    aggregated.extractedAssessments = mergeUniqueAssessments([
      ...aggregated.extractedAssessments,
      ...partial.extractedAssessments,
    ]);
    aggregated.extractedScheduleRules.push(...partial.extractedScheduleRules);
    aggregated.extractedConditions.push(...partial.extractedConditions);
    aggregated.extractedFootnotes.push(...partial.extractedFootnotes);
    aggregated.cellEvidence.push(...partial.cellEvidence);
    aggregated.diagnostics.push(...partial.diagnostics);
  }

  aggregated.warnings.push(...formatTableDiagnostics(aggregated.diagnostics.filter((d) => d.code !== 'noScheduleTables')));
  return aggregated;
}

export function buildMatrixProposalPreview(
  tableResult: SoATableExtractionResult,
): SoAMatrixProposalPreview {
  const rows: SoAMatrixProposalPreview['rows'] = tableResult.extractedAssessments.map((assessment) => ({
    id: assessment.id,
    label: assessment.name,
    inferenceSource: 'deterministic-table',
  }));
  const columns: SoAMatrixProposalPreview['columns'] = tableResult.extractedVisits.map((visit) => ({
    id: visit.id,
    label: visit.name,
    inferenceSource: 'deterministic-table',
  }));
  const cells: SoAMatrixProposalPreview['cells'] = [];

  for (const rule of tableResult.extractedScheduleRules) {
    if (!rule.assessmentId || !rule.visitId) continue;
    const evidence = tableResult.cellEvidence.find(
      (entry) => rule.notes?.includes(entry.tableId) || entry.sourceCellText,
    );
    const assessment = tableResult.extractedAssessments.find((item) => item.id === rule.assessmentId);
    const visit = tableResult.extractedVisits.find((item) => item.id === rule.visitId);
    cells.push({
      rowId: rule.assessmentId,
      columnId: rule.visitId,
      assessmentName: assessment?.name ?? rule.assessmentId,
      visitName: visit?.name ?? rule.visitId,
      marker: rule.required ? 'X' : 'Optional',
      required: rule.required,
      conditionLabel: rule.conditionId,
      inferenceSource: 'deterministic-table',
      evidence,
    });
  }

  return { rows, columns, cells };
}
