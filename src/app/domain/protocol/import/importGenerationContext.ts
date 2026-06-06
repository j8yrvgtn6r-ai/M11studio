import { getProtocolImportState, getImportedProtocolSource, getProtocolKnowledgeModel } from './protocolImportStore';
import type { ImportContextPhase } from './types';

export interface ImportGenerationContextDiagnostics {
  ready: boolean;
  phase: ImportContextPhase;
  missing: string[];
}

export class ImportGenerationContextNotReadyError extends Error {
  readonly diagnostics: ImportGenerationContextDiagnostics;

  constructor(diagnostics: ImportGenerationContextDiagnostics) {
    super(
      diagnostics.missing.length > 0
        ? `Import generation context not ready. Missing: ${diagnostics.missing.join(', ')}`
        : 'Import generation context not ready.',
    );
    this.name = 'ImportGenerationContextNotReadyError';
    this.diagnostics = diagnostics;
  }
}

export function getImportGenerationContextDiagnostics(): ImportGenerationContextDiagnostics {
  const state = getProtocolImportState();
  const missing: string[] = [];

  if (!state.artifact) {
    missing.push('artifact');
  }
  if (!state.importedSourceSummary?.uploadId) {
    missing.push('importedSourceSummary.uploadId');
  }
  if (!getImportedProtocolSource()) {
    missing.push('sourceExtraction');
  }
  if (!state.protocolKnowledgeModelId) {
    missing.push('protocolKnowledgeModelId');
  }
  if (!getProtocolKnowledgeModel()) {
    missing.push('protocolKnowledgeModel');
  }
  if (state.importContextPhase !== 'ready') {
    missing.push(`importContextPhase(${state.importContextPhase ?? 'idle'})`);
  }

  return {
    ready: missing.length === 0,
    phase: state.importContextPhase ?? 'idle',
    missing,
  };
}

export function isImportGenerationContextReady(): boolean {
  return getImportGenerationContextDiagnostics().ready;
}

export function assertImportGenerationContextReady(operation: string): void {
  const diagnostics = getImportGenerationContextDiagnostics();
  if (!diagnostics.ready) {
    console.warn(`[import-generation] ${operation} blocked — missing context:`, diagnostics.missing.join(', '));
    throw new ImportGenerationContextNotReadyError(diagnostics);
  }
}

export function logImportGenerationContextGap(operation: string): ImportGenerationContextDiagnostics {
  const diagnostics = getImportGenerationContextDiagnostics();
  console.warn(`[import-generation] ${operation} unavailable — missing context:`, diagnostics.missing.join(', '));
  return diagnostics;
}
