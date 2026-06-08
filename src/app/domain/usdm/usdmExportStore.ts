import type { StudyDesign } from '../study-design/StudyDesignTypes';
import type { UsdmExportContext, UsdmExportResult } from './usdmExportTypes';
import { buildUsdmExportContext, mapStudyDesignToUsdm } from './usdmMapper';
import { evaluateUsdmExportReadiness } from './usdmSelectors';
import { validateUsdmExport } from './usdmValidation';

let lastExport: UsdmExportResult | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeUsdmExport(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastUsdmExport(): UsdmExportResult | null {
  return lastExport;
}

export function buildUsdmExport(
  studyDesign: StudyDesign | null,
  context: UsdmExportContext = buildUsdmExportContext(),
): UsdmExportResult {
  const document = mapStudyDesignToUsdm(studyDesign, context);
  const validation = validateUsdmExport(document);
  const readiness = evaluateUsdmExportReadiness(studyDesign, context);
  const result: UsdmExportResult = {
    document,
    validation,
    readiness,
    exportedAt: new Date().toISOString(),
  };
  lastExport = result;
  notify();
  return result;
}

export function serializeUsdmDocument(result: UsdmExportResult): string {
  return JSON.stringify(result.document, null, 2);
}

export function getUsdmExportFilename(context: UsdmExportContext = buildUsdmExportContext()): string {
  const base = context.sponsorProtocolIdentifier ?? context.protocolTitle ?? 'study-design';
  const sanitized = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'study-design';
  return `${sanitized}-usdm.json`;
}

export function downloadUsdmJson(result: UsdmExportResult): void {
  const json = serializeUsdmDocument(result);
  const filename = getUsdmExportFilename(buildUsdmExportContext());
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function resetUsdmExportStoreForTests(): void {
  lastExport = null;
  listeners.clear();
}
