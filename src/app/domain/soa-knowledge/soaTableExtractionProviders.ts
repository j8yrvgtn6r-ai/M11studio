import type {
  DocxTableExtractionInput,
  OcrTableExtractionInput,
  PdfTextTableExtractionInput,
  SoATableExtractionResult,
  SourceTableExtractionProvider,
} from './soaTableExtractionTypes';
import { createTableDiagnostic } from './soaTableDiagnostics';
import { extractSoATablesFromCanonicalDocument } from './soaTableExtractor';

function unavailableResult(providerId: string, message: string): SoATableExtractionResult {
  return {
    candidateTables: [],
    extractedVisits: [],
    extractedAssessments: [],
    extractedScheduleRules: [],
    extractedFootnotes: [],
    extractedConditions: [],
    diagnostics: [
      createTableDiagnostic('providerUnavailable', `[${providerId}] ${message}`),
    ],
    warnings: [message],
    cellEvidence: [],
  };
}

export const docxTableExtractionProvider: SourceTableExtractionProvider = {
  id: 'docx-table-v1',
  label: 'DOCX Table Extraction',
  supportedFormats: ['docx'],
  async extract(input: unknown): Promise<SoATableExtractionResult> {
    const payload = input as DocxTableExtractionInput;
    if (!payload?.document || !payload.tables) {
      return unavailableResult('docx-table-v1', 'Invalid DOCX table extraction input.');
    }
    return extractSoATablesFromCanonicalDocument({
      document: payload.document,
      tables: payload.tables,
      protocolId: payload.uploadId,
    });
  },
};

/** Placeholder — digital PDF text table extraction is a future path. */
export const pdfTextTableExtractionProvider: SourceTableExtractionProvider = {
  id: 'pdf-text-table-v1',
  label: 'PDF Text Table Extraction (future)',
  supportedFormats: ['pdf'],
  async extract(input: unknown): Promise<SoATableExtractionResult> {
    const payload = input as PdfTextTableExtractionInput;
    return unavailableResult(
      'pdf-text-table-v1',
      `PDF text table extraction is not implemented. Upload ${payload?.uploadId ?? 'document'} requires future digital PDF parser.`,
    );
  },
};

/** Placeholder — scanned PDF OCR is fallback-only and not implemented in v3. */
export const ocrTableExtractionProvider: SourceTableExtractionProvider = {
  id: 'ocr-table-v1',
  label: 'OCR Table Extraction (future fallback)',
  supportedFormats: ['pdf', 'image'],
  async extract(input: unknown): Promise<SoATableExtractionResult> {
    const payload = input as OcrTableExtractionInput;
    return unavailableResult(
      'ocr-table-v1',
      `OCR table extraction is not implemented. Scanned PDF/image pages (${payload?.imagePages ?? 0}) require future OCR pipeline.`,
    );
  },
};

export const TABLE_EXTRACTION_PROVIDERS: SourceTableExtractionProvider[] = [
  docxTableExtractionProvider,
  pdfTextTableExtractionProvider,
  ocrTableExtractionProvider,
];

export async function runDocxTableExtraction(input: DocxTableExtractionInput): Promise<SoATableExtractionResult> {
  return docxTableExtractionProvider.extract(input);
}
