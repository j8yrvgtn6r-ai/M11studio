import type { SoATableDiagnostic, SoATableDiagnosticCode } from './soaTableExtractionTypes';

export function createTableDiagnostic(
  code: SoATableDiagnosticCode,
  message: string,
  partial?: Pick<SoATableDiagnostic, 'tableId' | 'rowIndex' | 'columnIndex' | 'sectionId'>,
): SoATableDiagnostic {
  return { code, message, ...partial };
}

export function formatTableDiagnostics(diagnostics: SoATableDiagnostic[]): string[] {
  return diagnostics.map((entry) => {
    const location = [
      entry.tableId ? `table ${entry.tableId}` : null,
      entry.rowIndex !== undefined ? `row ${entry.rowIndex + 1}` : null,
      entry.columnIndex !== undefined ? `col ${entry.columnIndex + 1}` : null,
      entry.sectionId ? `section ${entry.sectionId}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return location ? `[${entry.code}] ${entry.message} (${location})` : `[${entry.code}] ${entry.message}`;
  });
}
